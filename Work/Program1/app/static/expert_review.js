(function () {
  const root = document.getElementById('expertReviewRoot');
  if (!root) return;
  const systemId = Number(root.dataset.systemId);
  let variant = root.dataset.variant || 'city';

  const CITY_FIELDS = ['unit_name','project_owner','contact_phone','system_name','self_level','experts','review_date','review_opinion','leader_signature','member_signatures'];
  const DEP_FIELDS = ['unit_name','unit_address','project_owner','contact_phone','email','system_name','self_level','review_date','review_opinion'];

  const $ = (id) => document.getElementById(id);
  const authHeaders = () => {
    const token = localStorage.getItem('auth_token') || '';
    return token ? { 'X-Auth-Token': token } : {};
  };
  const setResult = (text, isErr) => {
    const el = $('expertReviewResult');
    if (el) el.textContent = text;
    if (isErr && window.appDialog) window.appDialog.alert(text, '提示');
  };
  const cnLevel = (n) => ['未计算','第一级','第二级','第三级','第四级','第五级'][Number(n) || 0] || '未计算';

  function fieldPrefix() { return variant === 'city' ? 'exCity_' : 'exDep_'; }
  function currentFields() { return variant === 'city' ? CITY_FIELDS : DEP_FIELDS; }

  function showSection() {
    document.querySelectorAll('[data-variant-section]').forEach((el) => {
      el.hidden = el.dataset.variantSection !== variant;
    });
    const lbl = $('variantLabel');
    if (lbl) lbl.textContent = variant === 'city' ? '市级单位' : '厅级单位';
  }

  async function loadData() {
    try {
      const res = await fetch(`/api/systems/${systemId}/expert-review?variant=${variant}`, { headers: authHeaders() });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { setResult(`加载失败：${data.detail || res.status}`, true); return; }
      const d = data.data || {};
      $('exOrgName').textContent = d.organization?.name || '-';
      $('exSysName').textContent = d.system?.name || '-';
      $('exSysLevel').textContent = (d.content?.self_level) || cnLevel(d.system?.level);
      $('expertReviewHint').textContent = '填写完成后点击保存；导出 Word 时会严格按模板格式写入。';
      const content = d.content || {};
      currentFields().forEach((f) => {
        const el = $(`${fieldPrefix()}${f}`);
        if (el) el.value = content[f] || '';
      });
    } catch (err) {
      setResult(`加载失败：${err.message || err}`, true);
    }
  }

  async function save() {
    const content = {};
    currentFields().forEach((f) => { const el = $(`${fieldPrefix()}${f}`); if (el) content[f] = el.value; });
    const res = await fetch(`/api/systems/${systemId}/expert-review?variant=${variant}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify({ content }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) { setResult(`保存失败：${data.detail || res.status}`, true); return; }
    setResult('保存成功。');
  }

  function switchVariant(next) {
    if (next === variant) return;
    const current = window.location.pathname;
    window.location.href = `${current}?variant=${next}`;
  }

  document.addEventListener('DOMContentLoaded', () => {
    showSection();
    $('expertReviewSaveBtn')?.addEventListener('click', save);
    $('expertReviewExportBtn')?.addEventListener('click', async () => {
      await save();
      window.location.href = `/api/systems/${systemId}/export/expert-review?variant=${variant}`;
    });
    document.querySelectorAll('[data-variant-switch]').forEach((btn) => {
      btn.addEventListener('click', () => switchVariant(btn.dataset.variantSwitch));
    });
    loadData();
  });
})();
