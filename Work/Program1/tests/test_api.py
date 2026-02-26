import importlib
import os
import unittest

from fastapi.testclient import TestClient


class ApiFlowTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        os.environ['DATABASE_URL'] = 'sqlite:///:memory:'

        import app.db as db_module
        import app.main as main_module
        import app.models as models_module

        importlib.reload(db_module)
        importlib.reload(models_module)
        importlib.reload(main_module)
        db_module.init_db()

        cls.client = TestClient(main_module.app)

    @classmethod
    def tearDownClass(cls):
        cls.client.close()

    def test_01_org_system_report_flow(self):
        org_payload = {
            'name': '测试单位A',
            'credit_code': '91350100M000100Y43',
            'legal_representative': '张三',
            'address': '福建省福州市',
            'office_phone': '0591-1234567',
            'mobile_phone': '13800138000',
            'email': 'a@example.com',
            'industry': '金融',
            'organization_type': '企业',
            'filing_region': '福州',
            'created_by': 'tester',
        }
        org_resp = self.client.post('/api/organizations', json=org_payload)
        self.assertEqual(org_resp.status_code, 200)
        org_id = org_resp.json()['data']['id']

        system_payload = {
            'organization_id': org_id,
            'system_name': '核心业务系统',
            'proposed_level': 3,
            'deployment_mode': '混合部署',
            'created_by': 'tester',
        }
        sys_resp = self.client.post('/api/systems', json=system_payload)
        self.assertEqual(sys_resp.status_code, 200)
        system_id = sys_resp.json()['data']['id']

        report_resp = self.client.post(f'/api/reports/generate?system_id={system_id}&report_type=grading_report&actor=tester')
        self.assertEqual(report_resp.status_code, 200)
        report_id = report_resp.json()['data']['id']

        submit_resp = self.client.post(f'/api/reports/{report_id}/submit?actor=tester&reviewer=leader')
        self.assertEqual(submit_resp.status_code, 200)
        self.assertEqual(submit_resp.json()['status'], 'submitted')

        review_resp = self.client.post(f'/api/reports/{report_id}/review?actor=leader&action=approve&comment=通过')
        self.assertEqual(review_resp.status_code, 200)
        self.assertEqual(review_resp.json()['status'], 'approved')

    def test_02_validation_and_dashboard(self):
        bad_payload = {
            'name': '测试单位B',
            'credit_code': 'BAD',
            'legal_representative': '李四',
            'address': '北京市',
            'mobile_phone': '13800138000',
            'email': 'b@example.com',
            'industry': '政府',
            'organization_type': '机关单位',
            'filing_region': '北京',
            'created_by': 'tester',
        }
        bad_resp = self.client.post('/api/organizations', json=bad_payload)
        self.assertEqual(bad_resp.status_code, 400)

        good_payload = {
            'name': '测试单位C',
            'credit_code': '91350100M000100Y44',
            'legal_representative': '王五',
            'address': '北京市',
            'mobile_phone': '13900139000',
            'email': 'c@example.com',
            'industry': '政府',
            'organization_type': '机关单位',
            'filing_region': '北京',
            'created_by': 'tester',
        }
        ok_resp = self.client.post('/api/organizations', json=good_payload)
        self.assertEqual(ok_resp.status_code, 200)

        dash_resp = self.client.get('/api/dashboard/summary?city=北京')
        self.assertEqual(dash_resp.status_code, 200)
        self.assertIn('totals', dash_resp.json())


if __name__ == '__main__':
    unittest.main()
