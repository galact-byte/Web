"""验证实际打包的 Python 后端及随包分发的模板和规则。"""

import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile
import zipfile


package_dir = Path(sys.argv[1] if len(sys.argv) > 1 else "dist_setup/win-unpacked").resolve()
resources = package_dir / "resources"
backend = resources / "bin" / "main3.exe"
assert backend.is_file(), f"Missing packaged backend: {backend}"
assert (resources / "app.asar").is_file(), "Missing Electron application archive"
rules = sorted((resources / "rules").glob("*.json"))
assert rules, "No packaged rules"
expected = []
for rule in rules:
    name = json.loads(rule.read_text(encoding="utf-8"))["文档名称"]
    assert (resources / "templates" / name).is_file(), f"Missing template: {name}"
    expected.append(Path(name).with_suffix(".docx").name)

project = {
    "项目编号": "CI-001",
    "项目名称": "构建验证项目",
    "单位名称": "构建验证单位",
    "委托单位联系人": "测试联系人",
    "委托单位联系方式": "00000000000",
    "具体业务名称": "测试业务",
    "系统": [{"系统名称": "测试系统", "系统级别": "二级"}],
}
env = {**os.environ, "PYTHONUTF8": "1", "PYTHONIOENCODING": "utf-8"}
with tempfile.TemporaryDirectory(prefix="docgen-smoke-") as temp:
    work = Path(temp)
    shutil.copytree(resources / "templates", work / "templates")
    shutil.copytree(resources / "rules", work / "rules")

    def run(*args):
        result = subprocess.run(
            [str(backend), *args], cwd=work, env=env, capture_output=True,
            text=True, encoding="utf-8", timeout=60,
        )
        print(result.stdout)
        if result.stderr:
            print(result.stderr, file=sys.stderr)
        return result

    assert run("--help").returncode == 0, "Backend cannot start"
    assert run("--mode", "1", "--config", "missing.json").returncode != 0, "Missing config must fail"
    for mode, config in [("1", project), ("2", {"projects": [project, {**project, "项目编号": "CI-002"}]})]:
        (work / "fixture.json").write_text(json.dumps(config, ensure_ascii=False), encoding="utf-8")
        assert run("--mode", mode, "--config", "fixture.json").returncode == 0, f"Mode {mode} failed"
        output = work / "授权文档输出目录"
        directories = [output] if mode == "1" else [
            output / "CI-001_构建验证项目", output / "CI-002_构建验证项目"
        ]
        for directory in directories:
            actual = sorted(path.name for path in directory.glob("*.docx"))
            assert actual == sorted(expected), f"Incomplete output in {directory}: {actual}"
            for name in expected:
                with zipfile.ZipFile(directory / name) as document:
                    assert document.testzip() is None, f"Corrupt document: {name}"
                    assert "word/document.xml" in document.namelist(), f"Invalid Word document: {name}"
        shutil.rmtree(output)
        print(f"PASS: mode {mode}, {len(directories) * len(expected)} valid documents")

print("PASS: packaged backend, templates, rules and missing-config handling")
