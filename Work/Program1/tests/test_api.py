import importlib
import hashlib
import io
import json
import os
import unittest
from datetime import datetime
from pathlib import Path

from docx import Document
from fastapi.testclient import TestClient
from openpyxl import Workbook


class ApiFlowTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        os.environ['DATABASE_URL'] = 'sqlite:///:memory:'
        os.environ['API_AUTH_REQUIRED'] = '0'

        import app.db as db_module
        import app.main as main_module
        import app.models as models_module

        importlib.reload(db_module)
        importlib.reload(models_module)
        importlib.reload(main_module)
        db_module.init_db()

        db = db_module.SessionLocal()
        try:
            admin = db.query(models_module.UserAccount).filter(models_module.UserAccount.username == 'admin').first()
            if not admin:
                db.add(
                    models_module.UserAccount(
                        username='admin',
                        password_hash=hashlib.sha256('admin123'.encode('utf-8')).hexdigest(),
                        role='admin',
                        enabled=True,
                    )
                )
                db.commit()
        finally:
            db.close()

        cls.client = TestClient(main_module.app)
        cls.main_module = main_module
        cls.db_module = db_module
        login_resp = cls.client.post('/api/auth/login', json={'username': 'admin', 'password': 'admin123'})
        assert login_resp.status_code == 200, login_resp.text
        cls.admin_token = login_resp.json()['token']
        cls.admin_headers = {'X-Auth-Token': cls.admin_token}

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

        submit_resp = self.client.post(
            f'/api/reports/{report_id}/submit?actor=tester&reviewer=leader',
            headers=self.admin_headers,
        )
        self.assertEqual(submit_resp.status_code, 200)
        self.assertEqual(submit_resp.json()['status'], 'submitted')

        review_resp = self.client.post(
            f'/api/reports/{report_id}/review?actor=leader&action=approve&comment=通过',
            headers=self.admin_headers,
        )
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

        bad_name_payload = {
            'name': '/',
            'credit_code': '91350100M000100Y53',
            'legal_representative': '赵六',
            'address': '天津市',
            'mobile_phone': '13900139001',
            'email': 'd@example.com',
            'industry': '政府',
            'organization_type': '机关单位',
            'filing_region': '天津',
            'created_by': 'tester',
        }
        bad_name_resp = self.client.post('/api/organizations', json=bad_name_payload)
        self.assertEqual(bad_name_resp.status_code, 400)

        bad_format_payload = {
            'name': '测试单位D',
            'credit_code': '/',
            'legal_representative': '/',
            'address': '/',
            'mobile_phone': '/',
            'email': '/',
            'industry': '/',
            'organization_type': '/',
            'filing_region': '/',
            'created_by': 'tester',
        }
        bad_format_resp = self.client.post('/api/organizations', json=bad_format_payload)
        self.assertEqual(bad_format_resp.status_code, 400)

        placeholder_payload = {
            'name': '测试单位E',
            'credit_code': '91350100M000100Y53',
            'legal_representative': '/',
            'address': '/',
            'mobile_phone': '13900139001',
            'email': 'placeholder@example.com',
            'industry': '/',
            'organization_type': '/',
            'filing_region': '/',
            'created_by': 'tester',
        }
        placeholder_resp = self.client.post('/api/organizations', json=placeholder_payload)
        self.assertEqual(placeholder_resp.status_code, 200)

        dash_resp = self.client.get('/api/dashboard/summary?city=北京')
        self.assertEqual(dash_resp.status_code, 200)
        self.assertIn('totals', dash_resp.json())

    def test_03_word_import_and_collection_review(self):
        doc = Document()
        doc.add_paragraph('单位名称: 客户填报单位')
        doc.add_paragraph('统一社会信用代码: 91350100M000100Y45')
        doc.add_paragraph('单位负责人: 赵六')
        doc.add_paragraph('单位地址: 上海市浦东新区')
        doc.add_paragraph('移动电话: 13700137000')
        doc.add_paragraph('邮箱: d@example.com')
        doc.add_paragraph('所属行业: 能源')
        doc.add_paragraph('单位类型: 企业')
        doc.add_paragraph('备案地区: 上海')
        bio = io.BytesIO()
        doc.save(bio)
        bio.seek(0)
        files = {'file': ('org.docx', bio.getvalue(), 'application/vnd.openxmlformats-officedocument.wordprocessingml.document')}
        import_resp = self.client.post('/api/organizations/import/word?actor=tester', files=files)
        self.assertEqual(import_resp.status_code, 200)
        imported_org_id = import_resp.json()['data']['id']

        link_resp = self.client.post(
            f'/api/organizations/collection-links?organization_id={imported_org_id}&expires_days=7&actor=tester',
            headers=self.admin_headers,
        )
        self.assertEqual(link_resp.status_code, 200)
        token = link_resp.json()['data']['token']

        submit_payload = {
            'address': '上海市黄浦区',
            'mobile_phone': '13600136000',
            'email': 'new@example.com',
            'submitter': '客户A',
        }
        submit_resp = self.client.post(f'/api/public/organizations/collect/{token}', json=submit_payload)
        self.assertEqual(submit_resp.status_code, 200)
        submission_id = submit_resp.json()['data']['submission_id']

        review_resp = self.client.post(
            f'/api/organizations/submissions/{submission_id}/review?action=approve&actor=tester',
            headers=self.admin_headers,
        )
        self.assertEqual(review_resp.status_code, 200)
        self.assertEqual(review_resp.json()['status'], 'approved')

    def test_04_system_word_import_and_pdf_encrypt_export(self):
        org_payload = {
            'name': '系统导入单位',
            'credit_code': '91350100M000100Y46',
            'legal_representative': '周七',
            'address': '广州市',
            'mobile_phone': '13500135000',
            'email': 'sys@example.com',
            'industry': '交通',
            'organization_type': '企业',
            'filing_region': '广州',
            'created_by': 'tester',
        }
        org_resp = self.client.post('/api/organizations', json=org_payload)
        self.assertEqual(org_resp.status_code, 200)
        org_id = org_resp.json()['data']['id']

        doc = Document()
        doc.add_paragraph('系统名称: 轨道调度系统')
        doc.add_paragraph(f'单位ID: {org_id}')
        doc.add_paragraph('拟定等级: 3级')
        doc.add_paragraph('部署方式: 混合部署')
        doc.add_paragraph('系统类型: 生产控制')
        doc.add_paragraph('上线时间: 2025-01-01')
        doc.add_paragraph('定级依据: 按照指南执行')
        doc.add_paragraph('定级理由: 影响范围较大')
        bio = io.BytesIO()
        doc.save(bio)
        bio.seek(0)
        files = {'file': ('sys.docx', bio.getvalue(), 'application/vnd.openxmlformats-officedocument.wordprocessingml.document')}
        import_resp = self.client.post('/api/systems/import/word?actor=tester', files=files)
        self.assertEqual(import_resp.status_code, 200)
        system_id = import_resp.json()['data']['id']

        report_resp = self.client.post(f'/api/reports/generate?system_id={system_id}&report_type=grading_report&actor=tester')
        self.assertEqual(report_resp.status_code, 200)
        report_id = report_resp.json()['data']['id']

        pdf_resp = self.client.get(f'/api/reports/{report_id}/export/pdf?password=123456')
        self.assertEqual(pdf_resp.status_code, 200)
        self.assertIn('application/pdf', pdf_resp.headers.get('content-type', ''))

    def test_05_report_sections_and_dashboard_export(self):
        org_payload = {
            'name': '章节测试单位',
            'credit_code': '91350100M000100Y47',
            'legal_representative': '钱八',
            'address': '成都市',
            'mobile_phone': '13400134000',
            'email': 'sec@example.com',
            'industry': '医疗',
            'organization_type': '事业单位',
            'filing_region': '成都',
            'created_by': 'tester',
        }
        org_resp = self.client.post('/api/organizations', json=org_payload)
        self.assertEqual(org_resp.status_code, 200)
        org_id = org_resp.json()['data']['id']

        sys_payload = {
            'organization_id': org_id,
            'system_name': '章节管理系统',
            'proposed_level': 2,
            'created_by': 'tester',
        }
        sys_resp = self.client.post('/api/systems', json=sys_payload)
        self.assertEqual(sys_resp.status_code, 200)
        system_id = sys_resp.json()['data']['id']

        report_resp = self.client.post(f'/api/reports/generate?system_id={system_id}&report_type=grading_report&actor=tester')
        self.assertEqual(report_resp.status_code, 200)
        report_id = report_resp.json()['data']['id']

        add_section_resp = self.client.post(
            f'/api/reports/{report_id}/sections?actor=tester',
            json={'name': '补充章节', 'content': {'说明': '自动化测试'}},
        )
        self.assertEqual(add_section_resp.status_code, 200)

        reorder_resp = self.client.post(
            f'/api/reports/{report_id}/sections/reorder?from_index=0&to_index=1&actor=tester',
            headers=self.admin_headers,
        )
        self.assertEqual(reorder_resp.status_code, 200)

        drill_resp = self.client.get('/api/dashboard/drilldown?dimension=region&value=成都')
        self.assertEqual(drill_resp.status_code, 200)
        self.assertIn('organizations', drill_resp.json())

        excel_resp = self.client.get('/api/dashboard/export/excel?city=成都')
        self.assertEqual(excel_resp.status_code, 200)
        self.assertIn('application/vnd.openxmlformats', excel_resp.headers.get('content-type', ''))

        pdf_resp = self.client.get('/api/dashboard/export/pdf?city=成都')
        self.assertEqual(pdf_resp.status_code, 200)
        self.assertIn('application/pdf', pdf_resp.headers.get('content-type', ''))

    def test_06_workflow_rules_and_knowledge_versioning(self):
        org_payload = {
            'name': '流程测试单位',
            'credit_code': '91350100M000100Y48',
            'legal_representative': '孙九',
            'address': '杭州市',
            'mobile_phone': '13300133000',
            'email': 'wf@example.com',
            'industry': '教育',
            'organization_type': '事业单位',
            'filing_region': '杭州',
            'created_by': 'tester',
        }
        org_resp = self.client.post('/api/organizations', json=org_payload)
        self.assertEqual(org_resp.status_code, 200)
        org_id = org_resp.json()['data']['id']

        sys_payload = {
            'organization_id': org_id,
            'system_name': '流程时限系统',
            'proposed_level': 2,
            'created_by': 'tester',
        }
        sys_resp = self.client.post('/api/systems', json=sys_payload)
        self.assertEqual(sys_resp.status_code, 200)
        system_id = sys_resp.json()['data']['id']

        rule_payload = {
            'updated_by': 'admin',
            'rules': [
                {'step_name': '信息收集', 'owner': 'collector', 'time_limit_hours': 1, 'enabled': True},
                {'step_name': '信息审核', 'owner': 'reviewer', 'time_limit_hours': 2, 'enabled': True},
            ],
        }
        rule_resp = self.client.put('/api/workflow/rules', json=rule_payload, headers=self.admin_headers)
        self.assertEqual(rule_resp.status_code, 200)

        instance_resp = self.client.get(f'/api/workflow/instances/{system_id}')
        self.assertEqual(instance_resp.status_code, 200)
        self.assertIn('due_at', instance_resp.json())

        remind_resp = self.client.get('/api/workflow/reminders?mode=due&within_hours=24&send=true')
        self.assertEqual(remind_resp.status_code, 200)
        self.assertIn('items', remind_resp.json())

        files = {'file': ('a.docx', b'v1', 'application/octet-stream')}
        upload_resp = self.client.post(
            '/api/knowledge/upload',
            data={'title': '模板A', 'doc_type': '备案表模板', 'actor': 'admin'},
            files=files,
            headers=self.admin_headers,
        )
        self.assertEqual(upload_resp.status_code, 200)
        doc_id = upload_resp.json()['data']['id']

        pin_resp = self.client.post(f'/api/knowledge/{doc_id}/pin?enabled=true&actor=admin', headers=self.admin_headers)
        self.assertEqual(pin_resp.status_code, 200)

        update_resp = self.client.put(
            f'/api/knowledge/{doc_id}?actor=admin',
            json={'city': '杭州', 'district': '西湖区'},
            headers=self.admin_headers,
        )
        self.assertEqual(update_resp.status_code, 200)

        files_v2 = {'file': ('a_v2.docx', b'v2', 'application/octet-stream')}
        new_version_resp = self.client.post(
            f'/api/knowledge/{doc_id}/new-version',
            data={'actor': 'admin'},
            files=files_v2,
            headers=self.admin_headers,
        )
        self.assertEqual(new_version_resp.status_code, 200)

        versions_resp = self.client.get(f'/api/knowledge/{doc_id}/versions')
        self.assertEqual(versions_resp.status_code, 200)
        self.assertGreaterEqual(versions_resp.json()['total'], 2)

        version_id = versions_resp.json()['items'][-1]['id']
        rollback_resp = self.client.post(
            f'/api/knowledge/{doc_id}/rollback/{version_id}?actor=admin',
            headers=self.admin_headers,
        )
        self.assertEqual(rollback_resp.status_code, 200)

    def test_07_auth_and_template_flow(self):
        create_user_resp = self.client.post(
            '/api/auth/users',
            json={'username': 'template_admin', 'password': 'secret123', 'role': 'admin'},
            headers=self.admin_headers,
        )
        self.assertIn(create_user_resp.status_code, [200, 409])

        local_tpl_docs = [
            ('01-自动测试备案表.docx', '网络安全等级保护备案表'),
            ('02-自动测试定级报告.docx', '网络安全等级保护定级报告'),
            ('03-自动测试专家评审意见表.docx', '专家评审意见表'),
        ]

        def _safe_remove(path: Path) -> None:
            try:
                path.unlink(missing_ok=True)
            except PermissionError:
                pass

        for filename, title in local_tpl_docs:
            p = Path(filename)
            d = Document()
            d.add_paragraph(title)
            t = d.add_table(rows=2, cols=2)
            t.cell(0, 0).text = '单位名称'
            t.cell(0, 1).text = '山西晋深交易有限公司'
            t.cell(1, 0).text = '系统名称'
            t.cell(1, 1).text = '山西省省属企业采购与供应链信息管理系统'
            d.save(p)
            self.addCleanup(_safe_remove, p)

        import_local_resp = self.client.post('/api/templates/import-local-official?actor=admin', headers=self.admin_headers)
        self.assertEqual(import_local_resp.status_code, 200)
        self.assertGreaterEqual(len(import_local_resp.json().get('imported', [])), 3)

        tpl_config = {
            'title': '福州市专家评审意见表模板',
            'sections': [
                {'名称': '基础信息', '内容': {'地区': '福州', '说明': '地市模板测试'}},
                {'名称': '专家结论', '内容': {'意见': ''}},
            ],
            'signatures': {'公司签章': '', '测评师签章': ''},
        }
        tpl_file = {'file': ('expert_fz.docx', b'expert-template', 'application/octet-stream')}
        upload_tpl_resp = self.client.post(
            '/api/templates/upload',
            data={
                'template_name': '福州专家模板',
                'report_type': 'expert_review_form',
                'city': '福州',
                'protection_level': '3',
                'is_default': 'true',
                'config_json': json.dumps(tpl_config, ensure_ascii=False),
            },
            files=tpl_file,
            headers=self.admin_headers,
        )
        self.assertEqual(upload_tpl_resp.status_code, 200)
        template_id = upload_tpl_resp.json()['data']['id']

        list_tpl_resp = self.client.get('/api/templates?report_type=expert_review_form')
        self.assertEqual(list_tpl_resp.status_code, 200)
        self.assertGreaterEqual(list_tpl_resp.json()['total'], 1)

        test_fill_resp = self.client.post(f'/api/templates/{template_id}/test-fill')
        self.assertEqual(test_fill_resp.status_code, 200)
        self.assertIn('preview', test_fill_resp.json())

        org_payload = {
            'name': '模板匹配单位',
            'credit_code': '91350100M000100Y49',
            'legal_representative': '吴十',
            'address': '福州市',
            'mobile_phone': '13200132000',
            'email': 'tplmatch@example.com',
            'industry': '政府',
            'organization_type': '机关单位',
            'filing_region': '福州',
            'created_by': 'tester',
        }
        org_resp = self.client.post('/api/organizations', json=org_payload)
        self.assertEqual(org_resp.status_code, 200)
        org_id = org_resp.json()['data']['id']

        sys_payload = {
            'organization_id': org_id,
            'system_name': '专家模板匹配系统',
            'proposed_level': 3,
            'created_by': 'tester',
        }
        sys_resp = self.client.post('/api/systems', json=sys_payload)
        self.assertEqual(sys_resp.status_code, 200)
        system_id = sys_resp.json()['data']['id']

        report_resp = self.client.post(
            f'/api/reports/generate?system_id={system_id}&report_type=expert_review_form&actor=tester'
        )
        self.assertEqual(report_resp.status_code, 200)
        content = report_resp.json()['data']['content']
        self.assertIn('模板信息', content)
        self.assertEqual(content['模板信息']['template_id'], template_id)

    def test_08_recycle_bin_and_report_compare(self):
        org_payload = {
            'name': '回收站测试单位',
            'credit_code': '91350100M000100Y50',
            'legal_representative': '郑十一',
            'address': '南京市',
            'mobile_phone': '13100131000',
            'email': 'recycle@example.com',
            'industry': '企业',
            'organization_type': '企业',
            'filing_region': '南京',
            'created_by': 'tester',
        }
        org_resp = self.client.post('/api/organizations', json=org_payload)
        self.assertEqual(org_resp.status_code, 200)
        org_id = org_resp.json()['data']['id']

        sys_payload = {
            'organization_id': org_id,
            'system_name': '回收站系统',
            'proposed_level': 2,
            'created_by': 'tester',
        }
        sys_resp = self.client.post('/api/systems', json=sys_payload)
        self.assertEqual(sys_resp.status_code, 200)
        system_id = sys_resp.json()['data']['id']

        delete_org_fail = self.client.delete(f'/api/organizations/{org_id}?actor=tester')
        self.assertEqual(delete_org_fail.status_code, 400)
        self.assertIn('关联系统', str(delete_org_fail.json().get('detail', '')))

        delete_sys_ok = self.client.delete(f'/api/systems/{system_id}?actor=tester')
        self.assertEqual(delete_sys_ok.status_code, 200)

        sys_recycle = self.client.get('/api/systems/recycle-bin/list')
        self.assertEqual(sys_recycle.status_code, 200)
        self.assertTrue(any(i['id'] == system_id for i in sys_recycle.json()['items']))

        restore_sys_ok = self.client.post(f'/api/systems/{system_id}/restore?actor=tester')
        self.assertEqual(restore_sys_ok.status_code, 200)

        report1_resp = self.client.post(
            f'/api/reports/generate?system_id={system_id}&report_type=grading_report&actor=tester'
        )
        self.assertEqual(report1_resp.status_code, 200)
        report1_id = report1_resp.json()['data']['id']

        content_resp = self.client.get(f'/api/reports/{report1_id}')
        self.assertEqual(content_resp.status_code, 200)
        edited_content = content_resp.json()['content']
        edited_content['备注'] = '版本1修改内容'
        edit_resp = self.client.put(
            f'/api/reports/{report1_id}?actor=tester',
            json={'content': edited_content},
        )
        self.assertEqual(edit_resp.status_code, 200)

        report2_resp = self.client.post(
            f'/api/reports/generate?system_id={system_id}&report_type=grading_report&actor=tester'
        )
        self.assertEqual(report2_resp.status_code, 200)
        report2_id = report2_resp.json()['data']['id']

        compare_resp = self.client.get(f'/api/reports/{report1_id}/compare/{report2_id}')
        self.assertEqual(compare_resp.status_code, 200)
        self.assertIn('summary', compare_resp.json())
        self.assertGreaterEqual(compare_resp.json()['summary']['field_change_count'], 1)

        delete_sys_blocked = self.client.delete(f'/api/systems/{system_id}?actor=tester')
        self.assertEqual(delete_sys_blocked.status_code, 400)
        self.assertIn('关联报告', str(delete_sys_blocked.json().get('detail', '')))

    def test_09_delete_request_attachment_batch_and_knowledge_exact(self):
        org_payload = {
            'name': '删除申请单位',
            'credit_code': '91350100M000100Y51',
            'legal_representative': '王十二',
            'address': '厦门市',
            'mobile_phone': '13000130000',
            'email': 'delreq@example.com',
            'industry': '企业',
            'organization_type': '企业',
            'filing_region': '厦门',
            'created_by': 'tester',
        }
        org_resp = self.client.post('/api/organizations', json=org_payload)
        self.assertEqual(org_resp.status_code, 200)
        org_id = org_resp.json()['data']['id']

        req_resp = self.client.post(
            f'/api/organizations/{org_id}/delete-request?actor=tester&reason=重复录入',
        )
        self.assertEqual(req_resp.status_code, 200)
        request_id = req_resp.json()['data']['request_id']

        review_resp = self.client.post(
            f'/api/delete-requests/{request_id}/review?action=approve&actor=admin',
            headers=self.admin_headers,
        )
        self.assertEqual(review_resp.status_code, 200)
        self.assertEqual(review_resp.json()['status'], 'approved')

        recycle_resp = self.client.get('/api/organizations/recycle-bin/list')
        self.assertEqual(recycle_resp.status_code, 200)
        self.assertTrue(any(i['id'] == org_id for i in recycle_resp.json()['items']))

        org2_payload = {
            'name': '附件批量单位',
            'credit_code': '91350100M000100Y52',
            'legal_representative': '赵十三',
            'address': '泉州市',
            'mobile_phone': '13900129000',
            'email': 'att@example.com',
            'industry': '企业',
            'organization_type': '企业',
            'filing_region': '泉州',
            'created_by': 'tester',
        }
        org2_resp = self.client.post('/api/organizations', json=org2_payload)
        self.assertEqual(org2_resp.status_code, 200)
        org2_id = org2_resp.json()['data']['id']

        files = [
            ('files', ('a.pdf', b'%PDF-1.4 test', 'application/pdf')),
            ('files', ('b.png', b'\x89PNG\r\n\x1a\n', 'image/png')),
        ]
        batch_resp = self.client.post(
            f'/api/attachments/organization/{org2_id}/batch?actor=tester',
            files=files,
        )
        self.assertEqual(batch_resp.status_code, 200)
        self.assertEqual(batch_resp.json()['uploaded'], 2)

        list_att = self.client.get(f'/api/attachments/organization/{org2_id}')
        self.assertEqual(list_att.status_code, 200)
        self.assertGreaterEqual(list_att.json()['total'], 2)
        attachment_id = list_att.json()['items'][0]['id']

        preview_resp = self.client.get(f'/api/attachment-files/{attachment_id}/preview')
        self.assertEqual(preview_resp.status_code, 200)
        self.assertIn('content-type', preview_resp.headers)

        upload_resp = self.client.post(
            '/api/knowledge/upload',
            data={'title': '精确检索文档', 'doc_type': '政策文件', 'actor': 'admin', 'keywords': '精确关键字'},
            files={'file': ('exact.docx', b'content', 'application/octet-stream')},
            headers=self.admin_headers,
        )
        self.assertEqual(upload_resp.status_code, 200)
        list_exact = self.client.get('/api/knowledge?keyword=精确关键字&match_mode=exact')
        self.assertEqual(list_exact.status_code, 200)
        self.assertTrue(any(i['title'] == '精确检索文档' for i in list_exact.json()['items']))

    def test_10_permission_boundaries(self):
        unauth_collection = self.client.get('/api/organizations/collection-links')
        self.assertEqual(unauth_collection.status_code, 401)

        create_user_resp = self.client.post(
            '/api/auth/users',
            json={'username': 'ev_user', 'password': 'evpass123', 'role': 'evaluator', 'require_password_change': False},
            headers=self.admin_headers,
        )
        self.assertIn(create_user_resp.status_code, [200, 409])

        evaluator_login = self.client.post('/api/auth/login', json={'username': 'ev_user', 'password': 'evpass123'})
        self.assertEqual(evaluator_login.status_code, 200)
        evaluator_headers = {'X-Auth-Token': evaluator_login.json()['token']}

        org_payload = {
            'name': '权限边界单位',
            'credit_code': '91350100M000100Y54',
            'legal_representative': '周十',
            'address': '福州市',
            'mobile_phone': '13100131000',
            'email': 'perm@example.com',
            'industry': '政府',
            'organization_type': '机关单位',
            'filing_region': '福州',
            'created_by': 'tester',
        }
        org_resp = self.client.post('/api/organizations', json=org_payload)
        self.assertEqual(org_resp.status_code, 200)
        org_id = org_resp.json()['data']['id']

        system_payload = {
            'organization_id': org_id,
            'system_name': '权限边界系统',
            'proposed_level': 3,
            'created_by': 'tester',
        }
        sys_resp = self.client.post('/api/systems', json=system_payload)
        self.assertEqual(sys_resp.status_code, 200)
        system_id = sys_resp.json()['data']['id']

        report_resp = self.client.post(f'/api/reports/generate?system_id={system_id}&report_type=grading_report&actor=tester')
        self.assertEqual(report_resp.status_code, 200)
        report_id = report_resp.json()['data']['id']

        submit_resp = self.client.post(
            f'/api/reports/{report_id}/submit?actor=tester&reviewer=leader',
            headers=self.admin_headers,
        )
        self.assertEqual(submit_resp.status_code, 200)

        eval_review_resp = self.client.post(
            f'/api/reports/{report_id}/review?actor=ev_user&action=approve&comment=越权审核测试',
            headers=evaluator_headers,
        )
        self.assertEqual(eval_review_resp.status_code, 403)

        evaluator_collection = self.client.get('/api/organizations/collection-links', headers=evaluator_headers)
        self.assertEqual(evaluator_collection.status_code, 200)

    def test_11_change_password_revokes_old_sessions(self):
        create_user_resp = self.client.post(
            '/api/auth/users',
            json={'username': 'pw_rotate_user', 'password': 'oldpass123', 'role': 'evaluator'},
            headers=self.admin_headers,
        )
        self.assertIn(create_user_resp.status_code, [200, 409])

        login_old = self.client.post('/api/auth/login', json={'username': 'pw_rotate_user', 'password': 'oldpass123'})
        self.assertEqual(login_old.status_code, 200)
        old_token = login_old.json()['token']
        old_headers = {'X-Auth-Token': old_token}

        me_before = self.client.get('/api/auth/me', headers=old_headers)
        self.assertEqual(me_before.status_code, 200)

        change_resp = self.client.post(
            '/api/auth/change-password',
            json={'current_password': 'oldpass123', 'new_password': 'newpass123'},
            headers=old_headers,
        )
        self.assertEqual(change_resp.status_code, 200)

        me_after = self.client.get('/api/auth/me', headers=old_headers)
        self.assertEqual(me_after.status_code, 401)

        login_old_again = self.client.post('/api/auth/login', json={'username': 'pw_rotate_user', 'password': 'oldpass123'})
        self.assertEqual(login_old_again.status_code, 401)

        login_new = self.client.post('/api/auth/login', json={'username': 'pw_rotate_user', 'password': 'newpass123'})
        self.assertEqual(login_new.status_code, 200)

    def test_12_must_change_password_is_enforced_server_side(self):
        create_user_resp = self.client.post(
            '/api/auth/users',
            json={'username': 'must_change_user', 'password': 'temp12345', 'role': 'evaluator'},
            headers=self.admin_headers,
        )
        self.assertIn(create_user_resp.status_code, [200, 409])

        login_resp = self.client.post('/api/auth/login', json={'username': 'must_change_user', 'password': 'temp12345'})
        self.assertEqual(login_resp.status_code, 200)
        self.assertTrue(login_resp.json().get('must_change_password'))
        old_token = login_resp.json()['token']
        old_headers = {'X-Auth-Token': old_token}

        me_resp = self.client.get('/api/auth/me', headers=old_headers)
        self.assertEqual(me_resp.status_code, 200)
        self.assertTrue(me_resp.json().get('must_change_password'))

        blocked_resp = self.client.get('/api/organizations/collection-links', headers=old_headers)
        self.assertEqual(blocked_resp.status_code, 403)

        change_resp = self.client.post(
            '/api/auth/change-password',
            json={'current_password': 'temp12345', 'new_password': 'temp12345_new'},
            headers=old_headers,
        )
        self.assertEqual(change_resp.status_code, 200)

        old_token_resp = self.client.get('/api/auth/me', headers=old_headers)
        self.assertEqual(old_token_resp.status_code, 401)

        login_new = self.client.post('/api/auth/login', json={'username': 'must_change_user', 'password': 'temp12345_new'})
        self.assertEqual(login_new.status_code, 200)
        self.assertFalse(login_new.json().get('must_change_password'))
        new_headers = {'X-Auth-Token': login_new.json()['token']}

        allowed_resp = self.client.get('/api/organizations/collection-links', headers=new_headers)
        self.assertEqual(allowed_resp.status_code, 200)

    def test_13_require_password_change_explicit_bool_parse(self):
        create_false_resp = self.client.post(
            '/api/auth/users',
            json={
                'username': 'bool_parse_user',
                'password': 'boolpass123',
                'role': 'evaluator',
                'require_password_change': 'false',
            },
            headers=self.admin_headers,
        )
        self.assertEqual(create_false_resp.status_code, 200)
        self.assertFalse(create_false_resp.json()['data']['must_change_password'])

        invalid_resp = self.client.post(
            '/api/auth/users',
            json={
                'username': 'bool_parse_user_bad',
                'password': 'boolpass123',
                'role': 'evaluator',
                'require_password_change': 'not-bool',
            },
            headers=self.admin_headers,
        )
        self.assertEqual(invalid_resp.status_code, 400)

    def test_14_is_admin_param_cannot_bypass_lock_and_report_freeze(self):
        create_eval_resp = self.client.post(
            '/api/auth/users',
            json={'username': 'non_admin_editor', 'password': 'editor123', 'role': 'evaluator', 'require_password_change': False},
            headers=self.admin_headers,
        )
        self.assertIn(create_eval_resp.status_code, [200, 409])
        eval_login = self.client.post('/api/auth/login', json={'username': 'non_admin_editor', 'password': 'editor123'})
        self.assertEqual(eval_login.status_code, 200)
        eval_headers = {'X-Auth-Token': eval_login.json()['token']}

        org_resp = self.client.post(
            '/api/organizations',
            json={
                'name': '权限绕过修复单位',
                'credit_code': '91350100M000100Y55',
                'legal_representative': '赵一',
                'address': '修复城A',
                'mobile_phone': '13100131001',
                'email': 'permfix@example.com',
                'industry': '政府',
                'organization_type': '机关单位',
                'filing_region': '修复城A',
                'created_by': 'tester',
            },
        )
        self.assertEqual(org_resp.status_code, 200)
        org_id = org_resp.json()['data']['id']

        sys_resp = self.client.post(
            '/api/systems',
            json={
                'organization_id': org_id,
                'system_name': '权限绕过修复系统',
                'proposed_level': 3,
                'created_by': 'tester',
            },
        )
        self.assertEqual(sys_resp.status_code, 200)
        system_id = sys_resp.json()['data']['id']

        report_resp = self.client.post(f'/api/reports/generate?system_id={system_id}&report_type=grading_report&actor=tester')
        self.assertEqual(report_resp.status_code, 200)
        report_id = report_resp.json()['data']['id']

        submit_resp = self.client.post(
            f'/api/reports/{report_id}/submit?actor=tester&reviewer=leader',
            headers=self.admin_headers,
        )
        self.assertEqual(submit_resp.status_code, 200)

        bypass_edit_resp = self.client.put(
            f'/api/reports/{report_id}?actor=non_admin_editor&is_admin=true',
            json={'content': {'标题': '尝试绕过'}},
            headers=eval_headers,
        )
        self.assertEqual(bypass_edit_resp.status_code, 403)

        admin_edit_resp = self.client.put(
            f'/api/reports/{report_id}?actor=admin&is_admin=true',
            json={'content': {'标题': '管理员可编辑'}},
            headers=self.admin_headers,
        )
        self.assertEqual(admin_edit_resp.status_code, 200)

        archive_org_resp = self.client.post(f'/api/organizations/{org_id}/archive?actor=tester')
        self.assertEqual(archive_org_resp.status_code, 200)
        bypass_org_update_resp = self.client.put(
            f'/api/organizations/{org_id}?actor=non_admin_editor&is_admin=true',
            json={'address': '被绕过地址'},
            headers=eval_headers,
        )
        self.assertEqual(bypass_org_update_resp.status_code, 403)
        admin_org_update_resp = self.client.put(
            f'/api/organizations/{org_id}?actor=admin&is_admin=true',
            json={'address': '管理员地址'},
            headers=self.admin_headers,
        )
        self.assertEqual(admin_org_update_resp.status_code, 200)

        archive_sys_resp = self.client.post(f'/api/systems/{system_id}/archive?actor=tester')
        self.assertEqual(archive_sys_resp.status_code, 200)
        bypass_sys_update_resp = self.client.put(
            f'/api/systems/{system_id}?actor=non_admin_editor&is_admin=true',
            json={'system_name': '绕过系统名'},
            headers=eval_headers,
        )
        self.assertEqual(bypass_sys_update_resp.status_code, 403)
        admin_sys_update_resp = self.client.put(
            f'/api/systems/{system_id}?actor=admin&is_admin=true',
            json={'system_name': '管理员系统名'},
            headers=self.admin_headers,
        )
        self.assertEqual(admin_sys_update_resp.status_code, 200)

    def test_15_batch_download_and_dashboard_filter_consistency(self):
        upload_resp = self.client.post(
            '/api/knowledge/upload',
            data={'title': '批量下载下架校验', 'doc_type': '政策文件', 'actor': 'admin'},
            files={'file': ('disabled.docx', b'content', 'application/octet-stream')},
            headers=self.admin_headers,
        )
        self.assertEqual(upload_resp.status_code, 200)
        disabled_doc_id = upload_resp.json()['data']['id']

        disable_resp = self.client.post(
            f'/api/knowledge/{disabled_doc_id}/toggle?enabled=false&actor=admin',
            headers=self.admin_headers,
        )
        self.assertEqual(disable_resp.status_code, 200)

        batch_resp = self.client.post(
            '/api/knowledge/batch-download?actor=admin',
            json=[disabled_doc_id],
            headers=self.admin_headers,
        )
        self.assertEqual(batch_resp.status_code, 403)

        city_a = '筛选一致城A'
        city_b = '筛选一致城B'
        org_a_resp = self.client.post(
            '/api/organizations',
            json={
                'name': '看板筛选A单位',
                'credit_code': '91350100M000100Y56',
                'legal_representative': '甲',
                'address': city_a,
                'mobile_phone': '13100131002',
                'email': 'citya@example.com',
                'industry': '教育',
                'organization_type': '事业单位',
                'filing_region': city_a,
                'created_by': 'tester',
            },
        )
        self.assertEqual(org_a_resp.status_code, 200)
        org_a_id = org_a_resp.json()['data']['id']

        org_b_resp = self.client.post(
            '/api/organizations',
            json={
                'name': '看板筛选B单位',
                'credit_code': '91350100M000100Y57',
                'legal_representative': '乙',
                'address': city_b,
                'mobile_phone': '13100131003',
                'email': 'cityb@example.com',
                'industry': '教育',
                'organization_type': '事业单位',
                'filing_region': city_b,
                'created_by': 'tester',
            },
        )
        self.assertEqual(org_b_resp.status_code, 200)
        org_b_id = org_b_resp.json()['data']['id']

        sys_a_resp = self.client.post(
            '/api/systems',
            json={'organization_id': org_a_id, 'system_name': '看板系统A', 'proposed_level': 2, 'created_by': 'tester'},
        )
        self.assertEqual(sys_a_resp.status_code, 200)
        sys_a_id = sys_a_resp.json()['data']['id']

        sys_b_resp = self.client.post(
            '/api/systems',
            json={'organization_id': org_b_id, 'system_name': '看板系统B', 'proposed_level': 2, 'created_by': 'tester'},
        )
        self.assertEqual(sys_b_resp.status_code, 200)
        sys_b_id = sys_b_resp.json()['data']['id']

        report_a = self.client.post(f'/api/reports/generate?system_id={sys_a_id}&report_type=grading_report&actor=tester')
        self.assertEqual(report_a.status_code, 200)
        report_b = self.client.post(f'/api/reports/generate?system_id={sys_b_id}&report_type=grading_report&actor=tester')
        self.assertEqual(report_b.status_code, 200)
        report_b_id = report_b.json()['data']['id']

        submit_b = self.client.post(
            f'/api/reports/{report_b_id}/submit?actor=tester&reviewer=leader',
            headers=self.admin_headers,
        )
        self.assertEqual(submit_b.status_code, 200)

        archive_b = self.client.post(f'/api/systems/{sys_b_id}/archive?actor=tester')
        self.assertEqual(archive_b.status_code, 200)

        summary_resp = self.client.get(f'/api/dashboard/summary?city={city_a}')
        self.assertEqual(summary_resp.status_code, 200)
        totals = summary_resp.json()['totals']
        self.assertEqual(totals['archived_system_count'], 0)
        self.assertEqual(totals['pending_review_reports'], 0)
        self.assertEqual(totals['in_progress_projects'], 1)

    def test_16_lite_mode_can_edit_frozen_report_with_is_admin_flag(self):
        org_resp = self.client.post(
            '/api/organizations',
            json={
                'name': '无鉴权演示单位',
                'credit_code': '91350100M000100Y58',
                'legal_representative': '丙',
                'address': '演示城',
                'mobile_phone': '13100131004',
                'email': 'lite@example.com',
                'industry': '政务',
                'organization_type': '机关单位',
                'filing_region': '演示城',
                'created_by': 'tester',
            },
        )
        self.assertEqual(org_resp.status_code, 200)
        org_id = org_resp.json()['data']['id']

        sys_resp = self.client.post(
            '/api/systems',
            json={'organization_id': org_id, 'system_name': '无鉴权演示系统', 'proposed_level': 2, 'created_by': 'tester'},
        )
        self.assertEqual(sys_resp.status_code, 200)
        system_id = sys_resp.json()['data']['id']

        report_resp = self.client.post(f'/api/reports/generate?system_id={system_id}&report_type=grading_report&actor=tester')
        self.assertEqual(report_resp.status_code, 200)
        report_id = report_resp.json()['data']['id']

        submit_resp = self.client.post(
            f'/api/reports/{report_id}/submit?actor=tester&reviewer=leader',
            headers=self.admin_headers,
        )
        self.assertEqual(submit_resp.status_code, 200)

        lite_edit_resp = self.client.put(
            f'/api/reports/{report_id}?actor=demo_admin&is_admin=true',
            json={'content': {'标题': '无鉴权维护'}},
        )
        self.assertEqual(lite_edit_resp.status_code, 200)

    def test_17_import_excel_flush_error_does_not_break_whole_transaction(self):
        wb = Workbook()
        ws = wb.active
        ws.append(['name', 'credit_code', 'legal_representative', 'address', 'office_phone', 'mobile_phone', 'email', 'industry', 'organization_type', 'filing_region'])
        ws.append(['导入A', '91350100M000100Y59', '张一', 'A市', '', '13100131005', 'a59@example.com', '教育', '事业单位', 'A市'])
        ws.append(['导入B', '91350100M000100Y59', '张二', 'B市', '', '13100131006', 'b59@example.com', '教育', '事业单位', 'B市'])
        bio = io.BytesIO()
        wb.save(bio)
        bio.seek(0)

        original_checker = self.__class__.main_module.assert_credit_code_available
        self.__class__.main_module.assert_credit_code_available = lambda *args, **kwargs: None
        try:
            resp = self.client.post(
                '/api/organizations/import/excel?actor=tester',
                files={'file': ('orgs.xlsx', bio.getvalue(), 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')},
            )
        finally:
            self.__class__.main_module.assert_credit_code_available = original_checker

        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertEqual(data['imported'], 1)
        self.assertGreaterEqual(len(data['skipped']), 1)

    def test_18_update_template_empty_required_fields_returns_400(self):
        upload_resp = self.client.post(
            '/api/templates/upload',
            data={
                'template_name': '必填校验模板',
                'report_type': 'expert_review_form',
                'category': '测试',
                'city': '测试城',
                'protection_level': '2',
                'is_default': 'false',
                'config_json': '{}',
            },
            files={'file': ('req_template.docx', b'template', 'application/octet-stream')},
            headers=self.admin_headers,
        )
        self.assertEqual(upload_resp.status_code, 200)
        tpl_id = upload_resp.json()['data']['id']

        bad_status = self.client.put(
            f'/api/templates/{tpl_id}',
            json={'status': ''},
            headers=self.admin_headers,
        )
        self.assertEqual(bad_status.status_code, 400)

        bad_name = self.client.put(
            f'/api/templates/{tpl_id}',
            json={'template_name': ''},
            headers=self.admin_headers,
        )
        self.assertEqual(bad_name.status_code, 400)

    def test_19_generate_system_code_not_reused_without_insert(self):
        db = self.__class__.db_module.SessionLocal()
        try:
            code1 = self.__class__.main_module.generate_system_code(db)
            code2 = self.__class__.main_module.generate_system_code(db)
        finally:
            db.close()
        self.assertNotEqual(code1, code2)

    def test_20_restore_deleted_system_requires_alive_org(self):
        org_resp = self.client.post(
            '/api/organizations',
            json={
                'name': '恢复校验单位',
                'credit_code': '91350100M000100Y60',
                'legal_representative': '丁',
                'address': '恢复城',
                'mobile_phone': '13100131006',
                'email': 'restore60@example.com',
                'industry': '政务',
                'organization_type': '机关单位',
                'filing_region': '恢复城',
                'created_by': 'tester',
            },
        )
        self.assertEqual(org_resp.status_code, 200)
        org_id = org_resp.json()['data']['id']

        sys_resp = self.client.post(
            '/api/systems',
            json={'organization_id': org_id, 'system_name': '恢复校验系统', 'proposed_level': 2, 'created_by': 'tester'},
        )
        self.assertEqual(sys_resp.status_code, 200)
        system_id = sys_resp.json()['data']['id']

        delete_sys_resp = self.client.delete(f'/api/systems/{system_id}?actor=tester')
        self.assertEqual(delete_sys_resp.status_code, 200)

        delete_org_resp = self.client.delete(f'/api/organizations/{org_id}?actor=tester')
        self.assertEqual(delete_org_resp.status_code, 200)

        restore_sys_resp = self.client.post(f'/api/systems/{system_id}/restore?actor=tester')
        self.assertEqual(restore_sys_resp.status_code, 400)
        self.assertIn('先恢复单位', str(restore_sys_resp.json().get('detail', '')))

    def test_21_system_excel_import_accepts_datetime_cell(self):
        org_resp = self.client.post(
            '/api/organizations',
            json={
                'name': 'Excel日期单位',
                'credit_code': '91350100M000100Y61',
                'legal_representative': '戊',
                'address': 'Excel城',
                'mobile_phone': '13100131007',
                'email': 'excel61@example.com',
                'industry': '教育',
                'organization_type': '事业单位',
                'filing_region': 'Excel城',
                'created_by': 'tester',
            },
        )
        self.assertEqual(org_resp.status_code, 200)
        org_id = org_resp.json()['data']['id']

        wb = Workbook()
        ws = wb.active
        ws.append(['系统名称', '系统编号', '单位ID', '拟定等级', '部署方式', '系统类型', '上线时间', '录入人'])
        ws.append(['Excel日期系统', '', org_id, 3, '混合部署', '管理系统', datetime(2025, 1, 1, 0, 0, 0), 'tester'])
        bio = io.BytesIO()
        wb.save(bio)
        bio.seek(0)

        resp = self.client.post(
            '/api/systems/import/excel?actor=tester',
            files={'file': ('systems_datetime.xlsx', bio.getvalue(), 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')},
        )
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.json()['imported'], 1)
        self.assertEqual(len(resp.json()['skipped']), 0)

        list_resp = self.client.get('/api/systems?system_name=Excel日期系统')
        self.assertEqual(list_resp.status_code, 200)
        self.assertTrue(
            any((item.get('go_live_date') or '').startswith('2025-01-01') for item in list_resp.json().get('items', []))
        )

    def test_22_system_import_validates_proposed_level_range(self):
        org_resp = self.client.post(
            '/api/organizations',
            json={
                'name': '等级校验单位',
                'credit_code': '91350100M000100Y62',
                'legal_representative': '己',
                'address': '等级城',
                'mobile_phone': '13100131008',
                'email': 'level62@example.com',
                'industry': '医疗',
                'organization_type': '企业',
                'filing_region': '等级城',
                'created_by': 'tester',
            },
        )
        self.assertEqual(org_resp.status_code, 200)
        org_id = org_resp.json()['data']['id']

        wb = Workbook()
        ws = wb.active
        ws.append(['系统名称', '系统编号', '单位ID', '拟定等级', '部署方式', '系统类型', '上线时间', '录入人'])
        ws.append(['非法等级系统', '', org_id, 10, '混合部署', '业务系统', '', 'tester'])
        bio = io.BytesIO()
        wb.save(bio)
        bio.seek(0)

        excel_resp = self.client.post(
            '/api/systems/import/excel?actor=tester',
            files={'file': ('systems_invalid_level.xlsx', bio.getvalue(), 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')},
        )
        self.assertEqual(excel_resp.status_code, 200)
        self.assertEqual(excel_resp.json()['imported'], 0)
        self.assertTrue(any('1-5级范围' in msg for msg in excel_resp.json()['skipped']))

        doc = Document()
        doc.add_paragraph('系统名称: Word非法等级系统')
        doc.add_paragraph(f'单位ID: {org_id}')
        doc.add_paragraph('拟定等级: 10级')
        bio_doc = io.BytesIO()
        doc.save(bio_doc)
        bio_doc.seek(0)
        word_resp = self.client.post(
            '/api/systems/import/word?actor=tester',
            files={'file': ('sys_invalid_level.docx', bio_doc.getvalue(), 'application/vnd.openxmlformats-officedocument.wordprocessingml.document')},
        )
        self.assertEqual(word_resp.status_code, 400)
        self.assertIn('1-5级范围', str(word_resp.json().get('detail', '')))

    def test_23_knowledge_download_returns_404_when_file_missing(self):
        upload_resp = self.client.post(
            '/api/knowledge/upload',
            data={'title': '缺失文件下载校验', 'doc_type': '政策文件', 'actor': 'admin'},
            files={'file': ('missing.docx', b'missing-content', 'application/octet-stream')},
            headers=self.admin_headers,
        )
        self.assertEqual(upload_resp.status_code, 200)
        doc_id = upload_resp.json()['data']['id']

        db = self.__class__.db_module.SessionLocal()
        try:
            row = db.query(self.__class__.main_module.KnowledgeDocument).filter_by(id=doc_id).first()
            self.assertIsNotNone(row)
            row.file_path = f"{row.file_path}.missing"
            db.commit()
        finally:
            db.close()

        download_resp = self.client.get(f'/api/knowledge/{doc_id}/download', headers=self.admin_headers)
        self.assertEqual(download_resp.status_code, 404)
        self.assertIn('文件不存在', str(download_resp.json().get('detail', '')))

    def test_24_workflow_reminders_reuse_rule_map(self):
        org_resp = self.client.post(
            '/api/organizations',
            json={
                'name': '提醒性能单位',
                'credit_code': '91350100M000100Y63',
                'legal_representative': '庚',
                'address': '提醒城',
                'mobile_phone': '13100131009',
                'email': 'wf63@example.com',
                'industry': '能源',
                'organization_type': '企业',
                'filing_region': '提醒城',
                'created_by': 'tester',
            },
        )
        self.assertEqual(org_resp.status_code, 200)
        org_id = org_resp.json()['data']['id']

        for idx in range(2):
            sys_resp = self.client.post(
                '/api/systems',
                json={
                    'organization_id': org_id,
                    'system_name': f'提醒性能系统{idx}',
                    'proposed_level': 2,
                    'created_by': 'tester',
                },
            )
            self.assertEqual(sys_resp.status_code, 200)

        original_func = self.__class__.main_module.get_or_create_workflow_step_rules
        call_count = {'value': 0}

        def wrapped(db, config):
            call_count['value'] += 1
            return original_func(db, config)

        self.__class__.main_module.get_or_create_workflow_step_rules = wrapped
        try:
            resp = self.client.get('/api/workflow/reminders?mode=all')
        finally:
            self.__class__.main_module.get_or_create_workflow_step_rules = original_func

        self.assertEqual(resp.status_code, 200)
        self.assertEqual(call_count['value'], 1)

    def test_25_template_download_returns_404_when_file_missing(self):
        upload_resp = self.client.post(
            '/api/templates/upload',
            data={
                'template_name': '缺失模板下载校验',
                'report_type': 'grading_report',
                'category': '测试',
                'city': '测试城',
                'protection_level': '2',
                'is_default': 'false',
                'config_json': '{}',
            },
            files={'file': ('missing_template.docx', b'template-content', 'application/octet-stream')},
            headers=self.admin_headers,
        )
        self.assertEqual(upload_resp.status_code, 200)
        tpl_id = upload_resp.json()['data']['id']

        db = self.__class__.db_module.SessionLocal()
        try:
            row = db.query(self.__class__.main_module.ReportTemplate).filter_by(id=tpl_id).first()
            self.assertIsNotNone(row)
            row.file_path = f"{row.file_path}.missing"
            db.commit()
        finally:
            db.close()

        download_resp = self.client.get(f'/api/templates/{tpl_id}/download')
        self.assertEqual(download_resp.status_code, 404)
        self.assertIn('模板文件不存在', str(download_resp.json().get('detail', '')))

    def test_26_attachment_file_endpoints_return_404_when_file_missing(self):
        org_resp = self.client.post(
            '/api/organizations',
            json={
                'name': '附件缺失校验单位',
                'credit_code': '91350100M000100Y64',
                'legal_representative': '辛',
                'address': '附件城',
                'mobile_phone': '13100131010',
                'email': 'att64@example.com',
                'industry': '教育',
                'organization_type': '事业单位',
                'filing_region': '附件城',
                'created_by': 'tester',
            },
        )
        self.assertEqual(org_resp.status_code, 200)
        org_id = org_resp.json()['data']['id']

        upload_resp = self.client.post(
            f'/api/attachments/organization/{org_id}?actor=tester',
            files={'file': ('attach.pdf', b'%PDF-1.4 attachment-content', 'application/pdf')},
        )
        self.assertEqual(upload_resp.status_code, 200)
        attachment_id = upload_resp.json()['data']['id']

        db = self.__class__.db_module.SessionLocal()
        try:
            row = db.query(self.__class__.main_module.Attachment).filter_by(id=attachment_id).first()
            self.assertIsNotNone(row)
            row.file_path = f"{row.file_path}.missing"
            db.commit()
        finally:
            db.close()

        preview_resp = self.client.get(f'/api/attachment-files/{attachment_id}/preview')
        self.assertEqual(preview_resp.status_code, 404)
        self.assertIn('附件文件不存在', str(preview_resp.json().get('detail', '')))

        download_resp = self.client.get(f'/api/attachment-files/{attachment_id}/download')
        self.assertEqual(download_resp.status_code, 404)
        self.assertIn('附件文件不存在', str(download_resp.json().get('detail', '')))

    def test_27_update_workflow_rules_invalid_time_limit_returns_400(self):
        bad_rule_payload = {
            'updated_by': 'admin',
            'rules': [
                {'step_name': '信息收集', 'owner': 'collector', 'time_limit_hours': 'abc', 'enabled': True},
            ],
        }
        resp = self.client.put('/api/workflow/rules', json=bad_rule_payload, headers=self.admin_headers)
        self.assertEqual(resp.status_code, 400)
        self.assertIn('time_limit_hours', str(resp.json().get('detail', '')))

    def test_28_knowledge_list_pagination_and_pinned_order(self):
        keyword = '分页置顶专用关键字_001'
        doc_ids: list[int] = []
        for idx in range(3):
            upload_resp = self.client.post(
                '/api/knowledge/upload',
                data={
                    'title': f'分页置顶文档{idx}',
                    'doc_type': '政策文件',
                    'actor': 'admin',
                    'keywords': keyword,
                },
                files={'file': (f'page_pin_{idx}.docx', f'content-{idx}'.encode('utf-8'), 'application/octet-stream')},
                headers=self.admin_headers,
            )
            self.assertEqual(upload_resp.status_code, 200)
            doc_ids.append(upload_resp.json()['data']['id'])

        pin_resp = self.client.post(f'/api/knowledge/{doc_ids[-1]}/pin?enabled=true&actor=admin', headers=self.admin_headers)
        self.assertEqual(pin_resp.status_code, 200)

        list_resp = self.client.get('/api/knowledge', params={'keyword': keyword, 'match_mode': 'exact', 'page': 1, 'page_size': 2})
        self.assertEqual(list_resp.status_code, 200)
        data = list_resp.json()
        self.assertEqual(data['total'], 3)
        self.assertEqual(len(data['items']), 2)
        self.assertTrue(data['items'][0]['pinned'])
        self.assertEqual(data['items'][0]['id'], doc_ids[-1])

    def test_29_knowledge_list_without_pagination_returns_all_for_compatibility(self):
        keyword = f"兼容全量关键字_{datetime.now().strftime('%Y%m%d%H%M%S%f')}"
        db = self.__class__.db_module.SessionLocal()
        try:
            for idx in range(55):
                db.add(
                    self.__class__.main_module.KnowledgeDocument(
                        title=f'兼容全量文档{idx}',
                        keywords=keyword,
                        city='兼容城',
                        district='兼容区',
                        doc_type='政策文件',
                        protection_level='2',
                        version_no=1,
                        status='enabled',
                        file_name=f'compat_{idx}.docx',
                        file_path=f'/tmp/compat_{idx}.docx',
                        file_size=10,
                        uploaded_by='tester',
                    )
                )
            db.commit()
        finally:
            db.close()

        list_resp = self.client.get('/api/knowledge', params={'keyword': keyword, 'match_mode': 'exact'})
        self.assertEqual(list_resp.status_code, 200)
        data = list_resp.json()
        self.assertEqual(data['total'], 55)
        self.assertEqual(len(data['items']), 55)

    def test_30_login_page_is_accessible(self):
        resp = self.client.get('/login')
        self.assertEqual(resp.status_code, 200)
        self.assertIn('账号登录', resp.text)
        self.assertIn('管理员统一创建和分发', resp.text)
        self.assertIn('默认管理员账号：admin / admin123', resp.text)

    def test_31_register_then_login_success(self):
        register_resp = self.client.post(
            '/api/auth/register',
            json={
                'username': 'self_register_user',
                'password': 'register123',
                'confirm_password': 'register123',
            },
        )
        self.assertEqual(register_resp.status_code, 403)
        self.assertIn('未开放自助注册', str(register_resp.json().get('detail', '')))

    def test_32_admin_can_open_users_page(self):
        resp = self.client.get('/users', headers=self.admin_headers)
        self.assertEqual(resp.status_code, 200)
        self.assertIn('用户管理', resp.text)


if __name__ == '__main__':
    unittest.main()
