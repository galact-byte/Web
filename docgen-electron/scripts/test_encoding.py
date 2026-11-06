"""验证后端在非 UTF-8 系统编码和重定向输出下仍以 UTF-8 通信。"""

import os
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest


ROOT = Path(__file__).resolve().parents[1]
BACKEND = os.environ.get("DOCGEN_TEST_BACKEND")
COMMAND = [str(Path(BACKEND).resolve())] if BACKEND else [sys.executable, str(ROOT / "main3.py")]


class BackendEncodingTest(unittest.TestCase):
    def run_backend(self, *args):
        env = {**os.environ, "PYTHONUTF8": "0", "PYTHONIOENCODING": "cp1252"}
        with tempfile.TemporaryDirectory(prefix="docgen-encoding-") as work:
            return subprocess.run(
                [*COMMAND, *args], cwd=work, env=env, capture_output=True, timeout=60,
            )

    def test_help_starts_and_emits_chinese_as_utf8(self):
        result = self.run_backend("--help")
        self.assertEqual(result.returncode, 0, result.stderr.decode("utf-8", errors="replace"))
        self.assertIn("已加载环境变量", result.stdout.decode("utf-8"))
        self.assertNotIn(b"UnicodeEncodeError", result.stderr)

    def test_argument_errors_emit_chinese_as_utf8(self):
        result = self.run_backend("--未知参数")
        self.assertEqual(result.returncode, 2, result.stderr.decode("utf-8", errors="replace"))
        self.assertIn("--未知参数", result.stderr.decode("utf-8"))
        self.assertNotIn(b"UnicodeEncodeError", result.stderr)

    def test_missing_config_returns_a_readable_error(self):
        result = self.run_backend("--mode", "1", "--config", "missing.json")
        self.assertEqual(result.returncode, 1)
        self.assertIn("错误: 找不到配置文件", result.stdout.decode("utf-8"))
        self.assertNotIn(b"UnicodeEncodeError", result.stderr)


if __name__ == "__main__":
    unittest.main()
