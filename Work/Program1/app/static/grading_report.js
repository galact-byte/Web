(function () {
  const root = document.getElementById('gradingReportRoot');
  if (!root) return;
  const systemId = Number(root.dataset.systemId);
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

  function applyMatrix(tableId, matrix, emptyId) {
    const table = document.querySelector(`#${tableId}`);
    if (!table) return;
    const empty = $(emptyId);
    let any = false;
    for (let r = 0; r < 3; r++) {
      for (let c = 0; c < 3; c++) {
        const cell = table.querySelector(`[data-cell="${r}-${c}"]`);
        if (!cell) continue;
        const hit = matrix && matrix[r] && matrix[r][c];
        cell.classList.toggle('matrix-hit', !!hit);
        if (hit) any = true;
      }
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
      const d = data.data || {};
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
      renderTopologyPreview(d.topology_url || null);
    } catch (err) {
      setResult(`加载失败：${err.message || err}`, true);
    }
  }

  async function save() {
    const content = {};
    FIELDS.forEach((f) => { const el = $(`grField_${f}`); if (el) content[f] = el.value; });
    const res = await fetch(`/api/systems/${systemId}/grading-report`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify({ content }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) { setResult(`保存失败：${data.detail || res.status}`, true); return; }
    setResult('保存成功。');
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

  document.addEventListener('DOMContentLoaded', () => {
    $('gradingReportSaveBtn')?.addEventListener('click', save);
    $('gradingReportExportBtn')?.addEventListener('click', async () => {
      await save();
      window.location.href = `/api/systems/${systemId}/export/grading-report`;
    });
    $('gradingTopologyPickBtn')?.addEventListener('click', () => $('gradingTopologyFile')?.click());
    $('gradingTopologyFile')?.addEventListener('change', (e) => {
      const f = e.target.files && e.target.files[0];
      if (f) uploadTopology(f);
    });
    loadData();
  });
})();
