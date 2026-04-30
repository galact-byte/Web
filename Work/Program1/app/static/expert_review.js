(function () {
  const root = document.getElementById('expertReviewRoot');
  if (!root) return;
  const systemId = Number(root.dataset.systemId);
  let variant = root.dataset.variant || 'city';
  const state = {
    draftRestoreDone: false,
    draftSuspend: false,
    draftTimer: null,
  };

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

  function buildSavePayload() {
    const content = {};
    currentFields().forEach((f) => {
      const el = $(`${fieldPrefix()}${f}`);
      if (el) content[f] = el.value;
    });
    return { content };
  }

  function draftStorageKey() {
    return `expert_review_draft_${systemId || 0}_${variant}`;
  }

  function readDraft() {
    const raw = localStorage.getItem(draftStorageKey());
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch (_error) {
      localStorage.removeItem(draftStorageKey());
      return null;
    }
  }

  function clearDraft() {
    localStorage.removeItem(draftStorageKey());
  }

  function saveDraftSnapshot() {
    if (!systemId || state.draftSuspend) return;
    localStorage.setItem(draftStorageKey(), JSON.stringify({
      saved_at: new Date().toISOString(),
      payload: buildSavePayload(),
    }));
  }

  function queueDraftSave() {
    if (!systemId || state.draftSuspend) return;
    window.clearTimeout(state.draftTimer);
    state.draftTimer = window.setTimeout(saveDraftSnapshot, 300);
  }

  async function restoreDraftIfNeeded(detail) {
    if (!systemId || state.draftRestoreDone) return detail;
    state.draftRestoreDone = true;
    const draft = readDraft();
    if (!draft || !draft.payload || !draft.payload.content) return detail;
    const ok = await window.appDialog.confirm(
      `检测到本机草稿，保存时间：${draft.saved_at || '-'}。是否恢复？`,
      '恢复草稿',
      '恢复草稿',
      '忽略'
    );
    if (!ok) return detail;
    return {
      ...detail,
      content: {
        ...(detail.content || {}),
        ...(draft.payload.content || {}),
      },
    };
  }

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
      const d = await restoreDraftIfNeeded(data.data || {});
      state.draftSuspend = true;
      $('exOrgName').textContent = d.organization?.name || '-';
      $('exSysName').textContent = d.system?.name || '-';
      $('exSysLevel').textContent = (d.content?.self_level) || cnLevel(d.system?.level);
      $('expertReviewHint').textContent = '填写完成后点击保存；导出 Word 时会严格按模板格式写入。';
      const content = d.content || {};
      currentFields().forEach((f) => {
        const el = $(`${fieldPrefix()}${f}`);
        if (el) el.value = content[f] || '';
      });
      state.draftSuspend = false;
    } catch (err) {
      state.draftSuspend = false;
      setResult(`加载失败：${err.message || err}`, true);
    }
  }

  async function save(options = {}) {
    const popupSuccess = options.popupSuccess !== false;
    const res = await fetch(`/api/systems/${systemId}/expert-review?variant=${variant}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify(buildSavePayload()),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setResult(`保存失败：${data.detail || res.status}`, true);
      return false;
    }
    clearDraft();
    setResult('保存成功。');
    if (popupSuccess && window.appDialog) {
      await window.appDialog.alert(data.message || '保存成功。', '提示');
    }
    return true;
  }

  function switchVariant(next) {
    if (next === variant) return;
    const current = window.location.pathname;
    window.location.href = `${current}?variant=${next}`;
  }

  async function importWord(file) {
    if (!file) return;
    setResult('正在解析 Word 文件...');
    const fd = new FormData();
    fd.append('file', file);
    try {
      const res = await fetch(`/api/systems/${systemId}/expert-review/import-word?variant=${variant}`, {
        method: 'POST',
        headers: authHeaders(),
        body: fd,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { setResult(`导入失败：${data.detail || res.status}`, true); return; }
      const content = data.data?.content || {};
      const fields = currentFields();
      const prefix = fieldPrefix();
      const filled = [];
      fields.forEach((f) => {
        const el = $(`${prefix}${f}`);
        if (el && content[f]) { el.value = content[f]; filled.push(f); }
      });
      queueDraftSave();
      setResult(filled.length ? `导入成功，已回填 ${filled.length} 个字段。` : '导入完成，但未匹配到可回填的字段。');
    } catch (err) {
      setResult(`导入失败：${err.message || err}`, true);
    }
  }

  document.addEventListener('DOMContentLoaded', () => {
    showSection();
    root.querySelectorAll('input, textarea, select').forEach((el) => {
      el.addEventListener('input', queueDraftSave);
      el.addEventListener('change', queueDraftSave);
    });
    $('expertReviewSaveBtn')?.addEventListener('click', async () => {
      await save();
    });
    $('expertReviewExportBtn')?.addEventListener('click', async () => {
      const ok = await save({ popupSuccess: false });
      if (!ok) return;
      window.location.href = `/api/systems/${systemId}/export/expert-review?variant=${variant}`;
    });
    $('expertImportWordBtn')?.addEventListener('click', () => $('expertImportWordFile')?.click());
    $('expertImportWordFile')?.addEventListener('change', (e) => {
      const f = e.target.files && e.target.files[0];
      if (f) importWord(f);
      e.target.value = '';
    });
    document.querySelectorAll('[data-variant-switch]').forEach((btn) => {
      btn.addEventListener('click', () => switchVariant(btn.dataset.variantSwitch));
    });
    loadData();
  });
})();
