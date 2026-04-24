import subprocess
import unittest
from pathlib import Path


class FilingWorkspaceRadioToggleTests(unittest.TestCase):
    def test_checked_radio_can_be_cleared_by_clicking_same_row(self):
        script = Path('tests/test_filing_workspace_radio_toggle.js')
        completed = subprocess.run(
            ['node', str(script)],
            check=False,
            capture_output=True,
            text=True,
        )
        if completed.returncode != 0:
            self.fail(completed.stdout + completed.stderr)


if __name__ == '__main__':
    unittest.main()
