import unittest
from pathlib import Path
from types import SimpleNamespace

from jinja2 import Environment, FileSystemLoader


class UiTemplateTests(unittest.TestCase):
    def render_base(self, path: str = '/reports') -> str:
        env = Environment(loader=FileSystemLoader('app/templates'))
        return env.get_template('base.html').render(
            request=SimpleNamespace(url=SimpleNamespace(path=path)),
            lite_mode=False,
            show_api_docs=False,
        )

    def render_template(self, name: str) -> str:
        env = Environment(loader=FileSystemLoader('app/templates'))
        return env.get_template(name).render(
            request=SimpleNamespace(url=SimpleNamespace(path='/placeholder')),
            lite_mode=False,
            show_api_docs=False,
        )

    def test_base_template_contains_navigation_transition_hooks(self):
        html = self.render_base()

        self.assertIn('navigateWithTransition', html)
        self.assertIn('app-route-transition', html)
        self.assertIn('resolveRouteDirection', html)
        self.assertIn('prefetchRoute', html)
        self.assertIn('scheduleRoutePrefetch', html)
        self.assertIn('ROUTE_TRANSITION_CLEAR_DELAY', html)
        self.assertIn('syncRouteScrollPosition', html)
        self.assertIn('window.scrollTo(0, 0)', html)
        self.assertIn('name="view-transition"', html)
        self.assertIn('header-action', html)
        self.assertIn('待登录', html)
        self.assertNotIn('访客模式', html)
        self.assertNotIn('route-curtain', html)
        self.assertNotIn('breadcrumb-path', html)
        self.assertNotIn('????', html)

    def test_base_template_marks_management_pages_with_tight_layout_variant(self):
        management_html = self.render_base('/templates')
        reports_html = self.render_base('/reports')

        self.assertIn('page-layout-management-tight', management_html)
        self.assertIn('page-layout-standard', reports_html)
        self.assertNotIn('<section class="page-hero">', management_html)
        self.assertIn('<section class="page-hero">', reports_html)

    def test_stylesheet_contains_cross_document_transition_hooks(self):
        css = Path('app/static/style.css').read_text(encoding='utf-8')

        self.assertIn('@view-transition', css)
        self.assertIn('view-transition-name: none', css)
        self.assertIn('route-slide-new-forward', css)
        self.assertIn('route-content', css)
        self.assertIn('.page-layout-management-tight .content', css)
        self.assertIn('.page-layout-management-tight .top-header', css)
        self.assertIn('.page-layout-management-tight .sidebar', css)
        self.assertIn('padding-top: 0;', css)
        self.assertNotIn('route-title', css)
        self.assertNotIn('active-nav-pill', css)
        self.assertNotIn('route-pill-new', css)
        self.assertIn('inline-check', css)

    def test_reports_template_uses_section_intro_layout(self):
        html = self.render_template('reports.html')

        self.assertIn('section-intro', html)
        self.assertIn('section-flag', html)

    def test_systems_template_uses_section_intro_layout(self):
        html = self.render_template('systems.html')

        self.assertIn('section-intro', html)
        self.assertIn('section-flag', html)

    def test_index_template_uses_dashboard_overview_layout(self):
        html = self.render_template('index.html')

        self.assertIn('section-intro', html)
        self.assertIn('dashboard-actions', html)

    def test_workflow_template_uses_section_intro_layout(self):
        html = self.render_template('workflow.html')

        self.assertIn('section-intro', html)
        self.assertIn('section-flag', html)

    def test_users_template_uses_refined_admin_layout(self):
        html = self.render_template('users.html')

        self.assertIn('section-intro', html)
        self.assertIn('inline-check', html)
        self.assertIn('userCountHint', html)

    def test_knowledge_template_uses_refined_management_layout(self):
        html = self.render_template('knowledge.html')

        self.assertIn('section-intro', html)
        self.assertIn('search-bar-flat', html)
        self.assertIn('knowledgeTable', html)

    def test_templates_template_uses_refined_management_layout(self):
        html = self.render_template('templates.html')

        self.assertIn('section-intro', html)
        self.assertIn('tplResult', html)
        self.assertIn('tplTable', html)

    def test_backup_template_uses_refined_management_layout(self):
        html = self.render_template('backup.html')

        self.assertIn('section-intro', html)
        self.assertIn('backupResult', html)
        self.assertIn('backupTable', html)


if __name__ == '__main__':
    unittest.main()
