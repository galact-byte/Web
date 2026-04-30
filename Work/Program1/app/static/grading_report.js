(function () {
  const root = document.getElementById('gradingReportRoot');
  if (!root) return;
  const systemId = Number(root.dataset.systemId);
  const state = {
    draftRestoreDone: false,
    draftSuspend: false,
    draftTimer: null,
  };
  const FIELDS = [
    'responsible_subject', 'object_composition', 'carried_business', 'carried_data',
    'security_responsibility',
    'business_info_description', 'business_info_damage_object', 'business_info_damage_degree',
    'service_description', 'service_damage_object', 'service_damage_degree',
    'fill_date',
  ];

  const $ = (id) => document.getElementById(id);
  const authHeaders = () => {
    const token = localStorage.getItem('auth_token') || '';
    return token ? { 'X-Auth-Token': token } : {};
  };
  const setResult = (text, isErr) => {
    const el = $('gradingReportResult');
    if (el) el.textContent = text;
    if (isErr && window.appDialog) window.appDialog.alert(text, '提示');
  };
  const cnLevel = (n) => ['未计算','第一级','第二级','第三级','第四级','第五级'][Number(n) || 0] || '未计算';

  function buildSavePayload() {
    const content = {};
    FIELDS.forEach((f) => {
      const el = $(`grField_${f}`);
      if (el) content[f] = el.value;
    });
    return { content };
  }

  function draftStorageKey() {
    return `grading_report_draft_${systemId || 0}`;
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

  function renderFinalLevelSummary(d) {
    const table3 = d.table3 || {};
    const systemName = d.system?.name || '-';
    const businessLevel = Number(table3.business_security_level) || 0;
    const serviceLevel = Number(table3.service_security_level) || 0;
    const finalLevel = Number(table3.final_level) || Number(d.system?.level) || Math.max(businessLevel, serviceLevel) || 0;
    const finalLabel = cnLevel(finalLevel);
    if ($('gradingFinalSystemName')) $('gradingFinalSystemName').textContent = systemName;
    if ($('gradingBusinessLevelCell')) $('gradingBusinessLevelCell').textContent = cnLevel(businessLevel);
    if ($('gradingServiceLevelCell')) $('gradingServiceLevelCell').textContent = cnLevel(serviceLevel);
    if ($('gradingFinalLevelCell')) $('gradingFinalLevelCell').textContent = finalLabel;
    if ($('gradingFinalConclusion')) {
      $('gradingFinalConclusion').textContent = `定级对象的安全保护等级由业务信息安全保护等级和系统服务安全保护等级较高者决定，最终确定${systemName}的网络安全保护等级为${finalLabel}。`;
    }
  }

  function applyMatrix(tableId, matrix, emptyId) {
    const table = document.querySelector(`#${tableId}`);
    if (!table) return;
    const empty = $(emptyId);
    let any = false;
    for (let r = 0; r < 3; r++) {
      let rowHit = false;
      for (let c = 0; c < 3; c++) {
        const cell = table.querySelector(`[data-cell="${r}-${c}"]`);
        if (!cell) continue;
        const hit = matrix && matrix[r] && matrix[r][c];
        cell.classList.toggle('matrix-hit', !!hit);
        if (hit) { any = true; rowHit = true; }
      }
      table.querySelector(`tbody tr[data-row="${r}"] td:first-child`)?.classList.toggle('matrix-hit', rowHit);
    }
    if (empty) empty.hidden = any;
  }

  function renderTopologyPreview(url) {
    const box = $('gradingTopologyPreview');
    if (!box) return;
    if (url) {
      box.innerHTML = `<img src="${url}" alt="拓扑图" style="max-width:100%;max-height:360px;border:1px solid var(--border);border-radius:8px">`;
    } else {
      box.innerHTML = '<div class="table-meta">暂未上传拓扑图。</div>';
    }
  }

  async function loadData() {
    try {
      const res = await fetch(`/api/systems/${systemId}/grading-report`, { headers: authHeaders() });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setResult(`加载失败：${data.detail || res.status}`, true);
        return;
      }
      const d = await restoreDraftIfNeeded(data.data || {});
      state.draftSuspend = true;
      $('gradingOrgName').textContent = d.organization?.name || '-';
      $('gradingSysName').textContent = d.system?.name || '-';
      $('gradingSysLevel').textContent = cnLevel(d.system?.level);
      $('gradingReportHint').textContent = '填写各节内容，保存后导出 Word；矩阵表根据备案表表三自动涂黑。';
      const content = d.content || {};
      FIELDS.forEach((f) => {
        const el = $(`grField_${f}`);
        if (el) el.value = content[f] || '';
      });
      applyMatrix('businessMatrix', d.business_matrix, 'businessMatrixEmpty');
      applyMatrix('serviceMatrix', d.service_matrix, 'serviceMatrixEmpty');
      renderFinalLevelSummary(d);
      renderTopologyPreview(d.topology_url || null);
      state.draftSuspend = false;
    } catch (err) {
      state.draftSuspend = false;
      setResult(`加载失败：${err.message || err}`, true);
    }
  }

  async function save(options = {}) {
    const popupSuccess = options.popupSuccess !== false;
    const res = await fetch(`/api/systems/${systemId}/grading-report`, {
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

  async function uploadTopology(file) {
    if (!file) return;
    $('gradingTopologyStatus').textContent = '正在上传...';
    const fd = new FormData();
    fd.append('file', file);
    const res = await fetch(`/api/systems/${systemId}/grading-report/topology`, {
      method: 'POST',
      headers: authHeaders(),
      body: fd,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      $('gradingTopologyStatus').textContent = '';
      setResult(`拓扑图上传失败：${data.detail || res.status}`, true);
      return;
    }
    $('gradingTopologyStatus').textContent = `已上传：${data.data?.file_name || ''}`;
    renderTopologyPreview(`/api/systems/${systemId}/grading-report/topology/file?t=${Date.now()}`);
  }

  async function importWord(file) {
    if (!file) return;
    setResult('正在解析 Word 文件...');
    const fd = new FormData();
    fd.append('file', file);
    try {
      const res = await fetch(`/api/systems/${systemId}/grading-report/import-word`, {
        method: 'POST',
        headers: authHeaders(),
        body: fd,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { setResult(`导入失败：${data.detail || res.status}`, true); return; }
      const content = data.data?.content || {};
      const filled = [];
      FIELDS.forEach((f) => {
        const el = $(`grField_${f}`);
        if (el && content[f]) { el.value = content[f]; filled.push(f); }
      });
      queueDraftSave();
      setResult(filled.length ? `导入成功，已回填 ${filled.length} 个字段。` : '导入完成，但未匹配到可回填的字段。');
    } catch (err) {
      setResult(`导入失败：${err.message || err}`, true);
    }
  }

  document.addEventListener('DOMContentLoaded', () => {
    root.querySelectorAll('input, textarea, select').forEach((el) => {
      el.addEventListener('input', queueDraftSave);
      el.addEventListener('change', queueDraftSave);
    });
    $('gradingReportSaveBtn')?.addEventListener('click', async () => {
      await save();
    });
    $('gradingReportExportBtn')?.addEventListener('click', async () => {
      const ok = await save({ popupSuccess: false });
      if (!ok) return;
      window.location.href = `/api/systems/${systemId}/export/grading-report`;
    });
    $('gradingImportWordBtn')?.addEventListener('click', () => $('gradingImportWordFile')?.click());
    $('gradingImportWordFile')?.addEventListener('change', (e) => {
      const f = e.target.files && e.target.files[0];
      if (f) importWord(f);
      e.target.value = '';
    });
    $('gradingTopologyPickBtn')?.addEventListener('click', () => $('gradingTopologyFile')?.click());
    $('gradingTopologyFile')?.addEventListener('change', (e) => {
      const f = e.target.files && e.target.files[0];
      if (f) uploadTopology(f);
    });
    loadData();
  });
})();
