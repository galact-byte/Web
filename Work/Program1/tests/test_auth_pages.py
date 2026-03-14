import asyncio
import importlib
import os
import sys
import types
import unittest

import httpx


def install_reportlab_stub():
    try:
        import reportlab  # noqa: F401
        return
    except ModuleNotFoundError:
        pass

    reportlab = types.ModuleType('reportlab')
    reportlab_lib = types.ModuleType('reportlab.lib')
    reportlab_pagesizes = types.ModuleType('reportlab.lib.pagesizes')
    reportlab_pagesizes.A4 = (595, 842)

    reportlab_pdfbase = types.ModuleType('reportlab.pdfbase')
    reportlab_pdfmetrics = types.ModuleType('reportlab.pdfbase.pdfmetrics')
    reportlab_pdfmetrics.registerFont = lambda *_args, **_kwargs: None
    reportlab_cidfonts = types.ModuleType('reportlab.pdfbase.cidfonts')

    class UnicodeCIDFont:
        def __init__(self, *_args, **_kwargs):
            pass

    reportlab_cidfonts.UnicodeCIDFont = UnicodeCIDFont

    reportlab_pdfgen = types.ModuleType('reportlab.pdfgen')
    reportlab_canvas = types.ModuleType('reportlab.pdfgen.canvas')

    class Canvas:
        def __init__(self, *_args, **_kwargs):
            pass

    reportlab_canvas.Canvas = Canvas

    sys.modules['reportlab'] = reportlab
    sys.modules['reportlab.lib'] = reportlab_lib
    sys.modules['reportlab.lib.pagesizes'] = reportlab_pagesizes
    sys.modules['reportlab.pdfbase'] = reportlab_pdfbase
    sys.modules['reportlab.pdfbase.pdfmetrics'] = reportlab_pdfmetrics
    sys.modules['reportlab.pdfbase.cidfonts'] = reportlab_cidfonts
    sys.modules['reportlab.pdfgen'] = reportlab_pdfgen
    sys.modules['reportlab.pdfgen.canvas'] = reportlab_canvas


def reload_modules():
    install_reportlab_stub()
    import app.db as db_module
    import app.main as main_module
    import app.models as models_module

    importlib.reload(db_module)
    importlib.reload(models_module)
    importlib.reload(main_module)
    return db_module, main_module


class AuthPageTests(unittest.TestCase):
    def setUp(self):
        os.environ['DATABASE_URL'] = 'sqlite:///:memory:'
        os.environ['API_AUTH_REQUIRED'] = '0'
        self.db_module, self.main_module = reload_modules()
        self.db_module.init_db()
        self.transport = httpx.ASGITransport(app=self.main_module.app)

    def tearDown(self):
        asyncio.run(self.transport.aclose())

    async def get(self, path: str) -> httpx.Response:
        async with httpx.AsyncClient(transport=self.transport, base_url='http://testserver') as client:
            return await client.get(path)

    def test_login_page_does_not_expose_default_credentials(self):
        response = asyncio.run(self.get('/login'))

        self.assertEqual(response.status_code, 200)
        self.assertNotIn('默认管理员账号', response.text)
        self.assertNotIn('admin123', response.text)
        self.assertNotIn('更克制、更清晰', response.text)


class ProtectedPageAuthTests(unittest.TestCase):
    def setUp(self):
        os.environ['DATABASE_URL'] = 'sqlite:///:memory:'
        os.environ['APP_LITE_MODE'] = '0'
        os.environ['API_AUTH_REQUIRED'] = '1'
        self.db_module, self.main_module = reload_modules()
        self.db_module.init_db()
        self.transport = httpx.ASGITransport(app=self.main_module.app)

    def tearDown(self):
        asyncio.run(self.transport.aclose())

    async def get(self, path: str) -> httpx.Response:
        async with httpx.AsyncClient(transport=self.transport, base_url='http://testserver', follow_redirects=False) as client:
            return await client.get(path)

    def test_guest_visit_root_redirects_to_login(self):
        response = asyncio.run(self.get('/'))

        self.assertEqual(response.status_code, 307)
        self.assertEqual(response.headers.get('location'), '/login?next=/')

    def test_guest_visit_reports_redirects_to_login(self):
        response = asyncio.run(self.get('/reports'))

        self.assertEqual(response.status_code, 307)
        self.assertEqual(response.headers.get('location'), '/login?next=/reports')

    def test_login_page_remains_public_when_auth_enabled(self):
        response = asyncio.run(self.get('/login'))

        self.assertEqual(response.status_code, 200)


if __name__ == '__main__':
    unittest.main()
