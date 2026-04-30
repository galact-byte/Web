import unittest
from pathlib import Path

from app.main import _matrix_cells_from_labels
from app.services.reporting import _read_docx_xml, _shade_matrix_cells
from app.services.reporting import parse_grading_report_docx


class GradingReportImportTests(unittest.TestCase):
    def test_parse_grading_report_collects_all_paragraphs_under_section(self):
        template_path = next(Path("template_docs").glob("02-*.docx"))

        parsed = parse_grading_report_docx(template_path.read_bytes())

        object_composition = parsed.get("object_composition", "")
        self.assertIn("云安全防护区和云服务器区", object_composition)
        self.assertIn("25台服务器", object_composition)
        self.assertIn("VPN+堡垒机进行远程管理", object_composition)

    def test_matrix_labels_map_to_report_cells(self):
        matrix = _matrix_cells_from_labels([
            "对公民、法人和其他组织的合法权益造成严重损害",
            "对社会秩序和公共利益造成严重损害",
        ])

        self.assertEqual(matrix, [[0, 1, 0], [0, 1, 0], [0, 0, 0]])

    def test_shade_matrix_cells_also_shades_hit_row_headers(self):
        template_path = next(Path("template_docs").glob("02-*.docx"))
        xml, _others = _read_docx_xml(template_path)

        shaded = _shade_matrix_cells(xml, [[0, 1, 0], [0, 1, 0], [0, 0, 0]], None)

        self.assertGreaterEqual(shaded.count('w:fill="BFBFBF"'), 4)


if __name__ == "__main__":
    unittest.main()
