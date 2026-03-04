/**
 * 项目相关共享工具函数
 */

// 业务类别简写映射
export const categoryMap = {
  '等保测评': '等保', '密码评估': '密评', '风险评估': '风评',
  '安全评估': '安评', '数据评估': '数评', '软件测试': '软测',
  '安全服务': '安服', '其他': '其他'
}

export function getCategoryShort(category) {
  return categoryMap[category] || category
}

export function getStatusClass(status) {
  return { draft: 'badge-warning', assigned: 'badge-info', completed: 'badge-success' }[status] || 'badge-info'
}

export function getStatusText(status) {
  return { draft: '待分发', assigned: '进行中', completed: '已完成' }[status] || status
}
