import importlib
import hashlib
import io
import json
import os
import unittest
from pathlib import Path

from docx import Document
from fastapi.testclient import TestClient


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
            json={'username': 'ev_user', 'password': 'evpass123', 'role': 'evaluator'},
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


if __name__ == '__main__':
    unittest.main()
