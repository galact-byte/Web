import unittest
from pathlib import Path


class StartBatTests(unittest.TestCase):
    def test_start_bat_forces_full_mode(self):
        content = Path('start.bat').read_text(encoding='utf-8')

        self.assertIn('set "APP_LITE_MODE=0"', content)
        self.assertIn('set "API_AUTH_REQUIRED=1"', content)
        self.assertIn('Launch mode: full', content)


if __name__ == '__main__':
    unittest.main()
