"""使用真实模板验证互斥文档选择、旧配置和重复生成。"""

import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile
import unittest
import zipfile


ROOT = Path(__file__).resolve().parents[1]
BACKEND = os.environ.get("DOCGEN_TEST_BACKEND")
COMMAND = [str(Path(BACKEND).resolve())] if BACKEND else [sys.executable, str(ROOT / "main3.py")]
WAIVER = "13自愿放弃验证测试声明（V4.5）.docx"
AUTHORIZATION = "14验证测试授权书.docx"
COMMON = {"08风险告知与规避方案.docx", "11现场测评授权书.docx", "19测评环境恢复确认表.docx"}


class VerificationModeTest(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix="docgen-verification-")
        self.addCleanup(self.temp.cleanup)
        self.work = Path(self.temp.name)
        shutil.copytree(ROOT / "templates", self.work / "templates")
        shutil.copytree(ROOT / "rules", self.work / "rules")
        self.project = {
            "项目编号": "TEST-001",
            "项目名称": "互斥文档测试项目",
            "单位名称": "测试单位",
            "具体业务名称": "在线业务",
            "系统": [{"系统名称": "测试系统", "系统级别": "三级"}],
        }
        self.output = self.work / "授权文档输出目录"

    def generate(self, mode, data):
        config = self.work / "fixture.json"
        config.write_text(json.dumps(data, ensure_ascii=False), encoding="utf-8")
        return subprocess.run(
            [*COMMAND, "--mode", mode, "--config", str(config)],
            cwd=self.work, capture_output=True, text=True, encoding="utf-8", timeout=60,
            env={**os.environ, "PYTHONUTF8": "1", "PYTHONIOENCODING": "utf-8"},
        )

    def assert_documents(self, directory, selected):
        self.assertEqual({p.name for p in directory.glob("*.docx")}, COMMON | {selected})
        for path in directory.glob("*.docx"):
            with zipfile.ZipFile(path) as doc:
                self.assertIsNone(doc.testzip())
                xml = doc.read("word/document.xml").decode("utf-8")
                self.assertIn("互斥文档测试项目", xml)

    def test_single_project_generates_only_selected_document(self):
        for choice, selected in [("执行验证测试", AUTHORIZATION), ("自愿放弃验证测试", WAIVER)]:
            with self.subTest(choice=choice):
                result = self.generate("1", {**self.project, "验证测试方式": choice})
                self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
                self.assert_documents(self.output, selected)

    def test_legacy_project_defaults_to_waiver(self):
        result = self.generate("1", self.project)
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        self.assert_documents(self.output, WAIVER)

    def test_batch_projects_use_individual_choices(self):
        projects = [
            {**self.project, "验证测试方式": "执行验证测试"},
            {**self.project, "项目编号": "TEST-002", "验证测试方式": "自愿放弃验证测试"},
            {**self.project, "项目编号": "TEST-003"},
        ]
        result = self.generate("2", {"projects": projects})
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        for number, selected in [("TEST-001", AUTHORIZATION), ("TEST-002", WAIVER), ("TEST-003", WAIVER)]:
            self.assert_documents(self.output / f"{number}_互斥文档测试项目", selected)

    def test_invalid_choice_fails_before_generating_documents(self):
        result = self.generate("1", {**self.project, "验证测试方式": "不支持的方式"})
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("验证测试方式", result.stdout + result.stderr)
        self.assertFalse(self.output.exists())

    def test_switching_choice_preserves_previous_document_in_history(self):
        for mode in ["1", "2"]:
            with self.subTest(mode=mode):
                directory = self.output if mode == "1" else self.output / "TEST-001_互斥文档测试项目"
                for old_name, choice, selected in [
                    (WAIVER, "执行验证测试", AUTHORIZATION),
                    (AUTHORIZATION, "自愿放弃验证测试", WAIVER),
                ]:
                    directory.mkdir(parents=True, exist_ok=True)
                    old_bytes = f"previous user document: {mode} {old_name}".encode("utf-8")
                    (directory / old_name).write_bytes(old_bytes)
                    project = {**self.project, "验证测试方式": choice}
                    result = self.generate(mode, project if mode == "1" else {"projects": [project]})
                    self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
                    self.assert_documents(directory, selected)
                    archives = list((directory / "历史文档").rglob(old_name))
                    self.assertTrue(any(p.read_bytes() == old_bytes for p in archives))


if __name__ == "__main__":
    unittest.main()
