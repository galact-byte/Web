import type { Category, Asset } from '../types';

let idCounter = Date.now();
function genId(): string {
  return `id-${++idCounter}-${Math.random().toString(36).slice(2, 8)}`;
}

let templateCounter = 0;
function tpl(label: string, required = true): { id: string; label: string; required: boolean } {
  return { id: `tpl-${++templateCounter}`, label, required };
}

const defaultCategories: Category[] = [
  {
    id: 'cat-physical',
    name: '物理环境',
    type: 'checklist',
    order: 1,
    defaultItems: [
      tpl('内部全景照片（如内部敏感，则可留存机房出入口处机房名牌照片）'),
      tpl('门禁'),
      tpl('空调'),
      tpl('机房温湿度（能看清温度和湿度）'),
      tpl('地板'),
      tpl('UPS（容量）'),
      tpl('监控、（摄像头）/防盗（报警器）'),
      tpl('防火（灭火系统）'),
      tpl('防雷（浪涌保护器、防雷保护器）'),
      tpl('防静电手环或者静电消除器'),
      tpl('漏水检测措施'),
      tpl('拦水坝'),
      tpl('通信线缆'),
      tpl('现场照片（人员现场核查）'),
    ],
  },
  {
    id: 'cat-network',
    name: '网络设备',
    type: 'checklist',
    order: 2,
    defaultItems: [
      tpl('登录界面（带IP地址信息）'),
      tpl('口令复杂度及口令定期更换'),
      tpl('登录失败处理及超时'),
      tpl('账户分配情况'),
      tpl('设备开启日志及六个月日志审计记录证明（重点！！！日志转存到日志审计设备中存储）'),
      tpl('登录地址限定（如果通过堡垒机登录，放从堡垒机中访问的截图）'),
      tpl('数据的备份方式（设备配置文件备份）'),
      tpl('数据加密方式、版本号'),
      tpl('Vlan划分'),
      tpl('Cpu内存使用率'),
      tpl('！！！如果多个设备，依次复制表格，更改表头名称', false),
    ],
  },
  {
    id: 'cat-security',
    name: '安全设备',
    type: 'checklist',
    order: 3,
    defaultItems: [
      tpl('登录界面（带IP地址信息）'),
      tpl('口令复杂度及口令定期更换'),
      tpl('登录失败处理及超时'),
      tpl('账户分配情况'),
      tpl('设备开启日志及六个月日志审计记录证明（重点！！！日志转存到日志审计设备中存储）'),
      tpl('流量日志'),
      tpl('登录地址限定（如果通过堡垒机登录，放从堡垒机中访问的截图）'),
      tpl('数据的备份方式（设备配置文件备份）'),
      tpl('版本号'),
      tpl('规则库'),
      tpl('策略'),
      tpl('Cpu内存'),
      tpl('！！！如果多个设备，依次复制表格，更改表头名称', false),
    ],
  },
  {
    id: 'cat-host',
    name: '主机设备',
    type: 'checklist',
    order: 4,
    defaultItems: [
      tpl('登录界面（带IP地址信息）'),
      tpl('口令复杂度及口令定期更换'),
      tpl('登录失败处理及超时'),
      tpl('账户分配情况'),
      tpl('设备开启日志及六个月日志审计记录证明（重点！！！日志转存到日志审计设备中存储）'),
      tpl('登录地址限定（如果通过堡垒机登录，放从堡垒机中访问的截图）'),
      tpl('服务器本身安装的防入侵和防病毒软件（类似于电脑管家、360安全卫士等软件）'),
      tpl('数据的备份方式（设备配置文件备份）'),
      tpl('版本号'),
      tpl('服务器部署的程序'),
      tpl('！！！如果多个设备，依次复制表格，更改表头名称', false),
    ],
  },
  {
    id: 'cat-system-mgmt',
    name: '系统管理软件',
    type: 'checklist',
    order: 5,
    defaultItems: [
      tpl('登录界面（带IP地址信息）'),
      tpl('口令复杂度及口令定期更换'),
      tpl('登录失败处理及超时'),
      tpl('账户分配情况'),
      tpl('设备开启日志及六个月日志审计记录证明（重点！！！日志转存到日志审计设备中存储）'),
      tpl('登录地址限定（如果开启了远程管理）'),
      tpl('数据的备份方式（设备配置文件备份）'),
      tpl('版本号'),
    ],
  },
  {
    id: 'cat-app',
    name: '应用系统',
    type: 'checklist',
    order: 6,
    defaultItems: [
      tpl('登录界面（带IP地址信息）'),
      tpl('口令复杂度及口令定期更换'),
      tpl('登录失败处理及超时'),
      tpl('账户分配情况'),
      tpl('设备开启日志及六个月日志审计记录证明（前端界面能看到）'),
      tpl('数据传输加密'),
      tpl('鉴别数据加密存储算法、个人数据加密存储算法'),
      tpl('版本号'),
      tpl('！！！如果多个设备，依次复制表格，更改表头名称', false),
    ],
  },
  {
    id: 'cat-management',
    name: '管理层面',
    type: 'freestyle',
    order: 7,
    defaultItems: [],
  },
  {
    id: 'cat-other',
    name: '其他',
    type: 'checklist',
    order: 8,
    defaultItems: [],
  },
];

function makeAsset(name: string, categoryId: string, cats: Category[]): Asset {
  const cat = cats.find((c) => c.id === categoryId);
  return {
    id: genId(),
    name,
    categoryId,
    items: (cat?.defaultItems || []).map((tpl) => ({
      id: genId(),
      label: tpl.label,
      required: tpl.required,
      fromTemplateId: tpl.id,
      images: [],
    })),
  };
}

/** 创建预设示例资产（对应 Word 模板中的样例） */
export function createPresetAssets(categories: Category[]): Asset[] {
  const cats = categories;
  return [
    makeAsset('XXX机房', 'cat-physical', cats),
    makeAsset('XX交换机（地址）', 'cat-network', cats),
    makeAsset('XX防火墙（地址）', 'cat-security', cats),
    makeAsset('XX服务器（地址）', 'cat-host', cats),
    makeAsset('XX数据库（地址）', 'cat-system-mgmt', cats),
    makeAsset('XX中间件（地址）', 'cat-system-mgmt', cats),
    makeAsset('XX应用系统（地址）', 'cat-app', cats),
    makeAsset('制度', 'cat-management', cats),
  ];
}

export default defaultCategories;

/** 初始化项目元数据 */
export function createDefaultMeta() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return {
    projectCode: '',
    projectName: '',
    unitName: '',
    systemName: '',
    reportDate: `${year}-${month}-${day}`,
  };
}
