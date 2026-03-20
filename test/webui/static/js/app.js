/* ============================================================
   CodeAudit — Global JS
   ============================================================ */

// Toast 通知
function showToast(message, type) {
  type = type || 'success';
  var container = document.querySelector('.toast-container');
  if (!container) {
    container = document.createElement('div');
    container.className = 'toast-container';
    document.body.appendChild(container);
  }

  var toast = document.createElement('div');
  toast.className = 'toast toast-' + type;
  toast.textContent = message;
  container.appendChild(toast);

  setTimeout(function() {
    toast.style.opacity = '0';
    toast.style.transition = 'opacity 150ms ease';
    setTimeout(function() { toast.remove(); }, 150);
  }, 3000);
}

// 删除审计记录
function deleteAudit(id) {
  if (!confirm('确定删除这条审计记录？')) return;

  fetch('/api/audit/' + id, { method: 'DELETE' })
    .then(function(r) { return r.json(); })
    .then(function(d) {
      if (d.ok) {
        var row = document.querySelector('tr[data-id="' + id + '"]');
        if (row) row.remove();
        showToast('已删除', 'success');
        // 如果表格空了，刷新显示空态
        var tbody = document.querySelector('.data-table tbody');
        if (tbody && !tbody.children.length) location.reload();
      }
    })
    .catch(function(err) { showToast('删除失败: ' + err.message, 'error'); });
}

// highlight.js 初始化
document.addEventListener('DOMContentLoaded', function() {
  if (typeof hljs !== 'undefined') {
    hljs.highlightAll();
  }
});
