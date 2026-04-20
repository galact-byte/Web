(function () {
  const state = {
    overview: [],
    openOrgIds: new Set(),
    currentSystemId: null,
    detail: null,
    includeArchived: false,
    createMode: false,
    createOrgId: null,
    draftRestoreDone: false,
    draftSuspend: false,
    draftTimer: null,
  };

  const INDUSTRY_OPTIONS = [
    ['1', '海关'], ['2', '税务'], ['3', '市场监督管理'], ['4', '广播电视'], ['5', '体育'], ['6', '统计'],
    ['7', '国际发展合作'], ['8', '医疗保障'], ['9', '参事'], ['10', '机关事务管理'], ['11', '外交'], ['12', '国防科技工业'],
    ['13', '发展和改革'], ['14', '教育'], ['15', '科学技术'], ['16', '工业和信息化'], ['17', '民族事务'], ['18', '公安'],
    ['19', '安全'], ['20', '民政'], ['21', '司法'], ['22', '财政'], ['23', '人力资源和社会保障'], ['24', '自然资源'],
    ['25', '生态环境'], ['26', '住房和城乡建设'], ['27', '交通运输'], ['28', '水利'], ['29', '农业农村'], ['30', '商务'],
    ['31', '文化和旅游'], ['32', '卫生健康'], ['33', '退役军人事务'], ['34', '应急管理'], ['35', '银行'], ['36', '审计'],
    ['37', '铁路'], ['38', '电信'], ['39', '经营性公众互联网'], ['40', '保险'], ['41', '证券'], ['42', '气象'],
    ['43', '民航'], ['44', '电力'], ['45', '能源'], ['46', '邮政'], ['47', '数据管理'], ['48', '电子政务'], ['99', '其他'],
  ];
  const AFFILIATION_OPTIONS = [['1', '中央'], ['2', '省(自治区、直辖市)'], ['3', '地(区、市、州、盟)'], ['4', '县（区、市、旗）'], ['9', '其他']];
  const ORG_TYPE_OPTIONS = [['1', '党委机关'], ['2', '政府机关'], ['3', '事业单位'], ['4', '企业'], ['9', '其他']];
  const OBJECT_TYPE_OPTIONS = [['通信网络设施', '通信网络设施'], ['信息系统', '信息系统'], ['数据资源', '数据资源']];
  const TECHNOLOGY_OPTIONS = [['云计算技术', '云计算技术'], ['移动互联技术', '移动互联技术'], ['物联网技术', '物联网技术'], ['工业控制技术', '工业控制技术'], ['大数据技术', '大数据技术'], ['其他', '其他']];
  const BUSINESS_TYPE_OPTIONS = [['生产作业', '生产作业'], ['指挥调度', '指挥调度'], ['内部办公', '内部办公'], ['公众服务', '公众服务'], ['其他', '其他']];
  const SERVICE_SCOPE_OPTIONS = [['10', '全国'], ['11', '跨省（区、市）'], ['20', '全省（区、市）'], ['21', '跨地（市、区）'], ['30', '地（市、区）内'], ['99', '其他']];
  const SERVICE_TARGET_OPTIONS = [['单位内部人员', '单位内部人员'], ['社会公众人员', '社会公众人员'], ['两者均包括', '两者均包括'], ['其他', '其他']];
  const COVERAGE_OPTIONS = [['1', '局域网'], ['2', '城域网'], ['3', '广域网'], ['9', '其他']];
  const NETWORK_NATURE_OPTIONS = [['1', '业务专网'], ['2', '互联网'], ['9', '其他']];
  const INTERCONNECTION_OPTIONS = [['与其他行业系统连接', '与其他行业系统连接'], ['与本行业其他单位系统连接', '与本行业其他单位系统连接'], ['与本单位其他系统连接', '与本单位其他系统连接'], ['其他', '其他']];
  const DAMAGE_LEVEL_OPTIONS = [
    { label: '仅对公民、法人和其他组织的合法权益造成一般损害', level: 1, legacyLabel: '仅对公民、法人和其他组织的合法权益造成一般损害' },
    {
      label: '对公民、法人和其他组织的合法权益造成严重损害',
      level: 2,
      legacyLabel: '对公民、法人和其他组织的合法权益造成严重损害 / 对公民、法人和其他组织的合法权益造成特别严重损害 / 对社会秩序和公共利益造成一般损害',
    },
    {
      label: '对公民、法人和其他组织的合法权益造成特别严重损害',
      level: 2,
      legacyLabel: '对公民、法人和其他组织的合法权益造成严重损害 / 对公民、法人和其他组织的合法权益造成特别严重损害 / 对社会秩序和公共利益造成一般损害',
    },
    {
      label: '对社会秩序和公共利益造成一般损害',
      level: 2,
      legacyLabel: '对公民、法人和其他组织的合法权益造成严重损害 / 对公民、法人和其他组织的合法权益造成特别严重损害 / 对社会秩序和公共利益造成一般损害',
    },
    { label: '对社会秩序和公共利益造成严重损害', level: 3, legacyLabel: '对社会秩序和公共利益造成严重损害' },
    {
      label: '对社会秩序和公共利益造成特别严重损害',
      level: 4,
      legacyLabel: '对社会秩序和公共利益造成特别严重损害 / 对国家安全或地区安全、国计民生造成一般损害',
    },
    {
      label: '对国家安全或地区安全、国计民生造成一般损害',
      level: 4,
      legacyLabel: '对社会秩序和公共利益造成特别严重损害 / 对国家安全或地区安全、国计民生造成一般损害',
    },
    {
      label: '对国家安全或地区安全、国计民生造成严重损害',
      level: 5,
      legacyLabel: '对国家安全或地区安全、国计民生造成严重损害 / 对国家安全或地区安全、国计民生造成特别严重损害',
    },
    {
      label: '对国家安全或地区安全、国计民生造成特别严重损害',
      level: 5,
      legacyLabel: '对国家安全或地区安全、国计民生造成严重损害 / 对国家安全或地区安全、国计民生造成特别严重损害',
    },
  ];
  const DAMAGE_LEVEL_OPTION_MAP = new Map(DAMAGE_LEVEL_OPTIONS.map((option) => [option.label, option]));
  const DAMAGE_LEVEL_LEGACY_MAP = new Map();
  const DAMAGE_LEVEL_GROUPS = [];
  DAMAGE_LEVEL_OPTIONS.forEach((option) => {
    if (option.legacyLabel && !DAMAGE_LEVEL_LEGACY_MAP.has(option.legacyLabel)) {
      DAMAGE_LEVEL_LEGACY_MAP.set(option.legacyLabel, option);
    }
    const currentGroup = DAMAGE_LEVEL_GROUPS[DAMAGE_LEVEL_GROUPS.length - 1];
    if (!currentGroup || currentGroup.level !== option.level) {
      DAMAGE_LEVEL_GROUPS.push({ level: option.level, items: [option] });
    } else {
      currentGroup.items.push(option);
    }
  });
  const CLOUD_RESPONSIBILITY_OPTIONS = [['云服务商', '云服务商'], ['云服务客户', '云服务客户']];
  const CLOUD_SERVICE_MODE_OPTIONS = [['基础设施即服务IaaS', '基础设施即服务IaaS'], ['平台即服务PaaS', '平台即服务PaaS'], ['软件即服务SaaS', '软件即服务SaaS'], ['其他', '其他']];
  const CLOUD_DEPLOYMENT_OPTIONS = [['私有云', '私有云'], ['公有云', '公有云'], ['混合云', '混合云'], ['其他', '其他']];
  const MOBILE_CHANNEL_OPTIONS = [['公共WIFI', '公共WIFI'], ['专用WIFI', '专用WIFI'], ['移动通信网', '移动通信网']];
  const MOBILE_TERMINAL_OPTIONS = [['通用终端', '通用终端'], ['专用终端', '专用终端']];
  const IOT_PERCEPTION_OPTIONS = [['感知节点', '感知节点'], ['感知网关', '感知网关'], ['RFID标签', 'RFID标签'], ['RFID读写器', 'RFID读写器'], ['其他', '其他']];
  const IOT_TRANSPORT_OPTIONS = [['互联网', '互联网'], ['专用网', '专用网'], ['移动通信网', '移动通信网'], ['其他', '其他']];
  const INDUSTRIAL_LAYER_OPTIONS = [['生产管理层', '生产管理层'], ['过程监控层', '过程监控层'], ['现场控制层', '现场控制层'], ['现场设备层', '现场设备层']];
  const INDUSTRIAL_COMPONENT_OPTIONS = [['数据采集与监视控制系统（SCADA）', '数据采集与监视控制系统（SCADA）'], ['分布式控制系统（DCS）', '分布式控制系统（DCS）'], ['可编程逻辑控制器（PLC）', '可编程逻辑控制器（PLC）'], ['远程终端单元（RTU）', '远程终端单元（RTU）'], ['主终端单元（MTU）', '主终端单元（MTU）'], ['上位机（SC）', '上位机（SC）'], ['其他', '其他']];
  const BIG_DATA_COMPONENT_OPTIONS = [['大数据平台', '大数据平台'], ['大数据应用', '大数据应用'], ['大数据资源', '大数据资源']];
  const MATERIAL_SLOTS = [
    ['network_topology', '网络拓扑结构及说明'],
    ['security_org_and_rules', '网络安全组织架构及管理制度清单'],
    ['security_design_plan', '网络安全建设设计方案或整改设计方案'],
    ['security_products', '网络安全专用产品清单及相关证明'],
    ['security_services', '使用的安全服务清单'],
    ['supervisor_guidance', '行业主管部门指导定级文件'],
  ];
  const PERSONAL_INFO_OPTIONS = [['涉及敏感个人信息', '涉及敏感个人信息'], ['涉及未成年人的个人信息', '涉及未成年人的个人信息'], ['涉及一般个人信息', '涉及一般个人信息'], ['不涉及', '不涉及']];
  const DATA_SOURCE_OPTIONS = [['系统采集', '系统采集'], ['系统产生', '系统产生'], ['人工填报', '人工填报'], ['交易购买', '交易购买'], ['共享交换', '共享交换'], ['其他', '其他']];
  const DATA_LEVEL_OPTIONS = [['1', '一般数据'], ['2', '重要及以上数据']];
  const INTERACTION_OPTIONS = [['1', '对外提供给'], ['2', '委托处理'], ['3', '共同处理'], ['4', '无交互']];
  const STORAGE_CLOUD_OPTIONS = [['1', '私有云'], ['2', '公有云'], ['3', '混合云'], ['4', '政务云'], ['5', '非云计算平台']];
  const STORAGE_ROOM_OPTIONS = [['1', '本单位机房'], ['2', '外单位机房'], ['3', '国内第三方托管机房']];
  const STORAGE_REGION_OPTIONS = [['1', '境内'], ['2', '境外']];
  const PROVINCE_OPTIONS = ['北京市', '天津市', '河北省', '山西省', '内蒙古自治区', '辽宁省', '吉林省', '黑龙江省', '上海市', '江苏省', '浙江省', '安徽省', '福建省', '江西省', '山东省', '河南省', '湖北省', '湖南省', '广东省', '广西壮族自治区', '海南省', '重庆市', '四川省', '贵州省', '云南省', '西藏自治区', '陕西省', '甘肃省', '青海省', '宁夏回族自治区', '新疆维吾尔自治区', '香港特别行政区', '澳门特别行政区', '台湾省'];
  const REGION_TREE = {
    山西省: [
      { name: '太原市', postal_code: '030000', districts: [{ name: '小店区', district_code: '140105', postal_code: '030032' }, { name: '迎泽区', district_code: '140106', postal_code: '030001' }, { name: '杏花岭区', district_code: '140107', postal_code: '030009' }, { name: '尖草坪区', district_code: '140108', postal_code: '030023' }, { name: '万柏林区', district_code: '140109', postal_code: '030024' }, { name: '晋源区', district_code: '140110', postal_code: '030025' }, { name: '清徐县', district_code: '140121', postal_code: '030400' }, { name: '阳曲县', district_code: '140122', postal_code: '030100' }, { name: '娄烦县', district_code: '140123', postal_code: '030300' }, { name: '古交市', district_code: '140181', postal_code: '030200' }] },
      { name: '大同市', postal_code: '037000', districts: [{ name: '平城区', district_code: '140213' }, { name: '云冈区', district_code: '140214' }, { name: '新荣区', district_code: '140212' }, { name: '云州区', district_code: '140215' }, { name: '阳高县', district_code: '140221' }, { name: '天镇县', district_code: '140222' }, { name: '广灵县', district_code: '140223' }, { name: '灵丘县', district_code: '140224' }, { name: '浑源县', district_code: '140225' }, { name: '左云县', district_code: '140226' }] },
      { name: '阳泉市', postal_code: '045000', districts: [{ name: '城区', district_code: '140302' }, { name: '矿区', district_code: '140303' }, { name: '郊区', district_code: '140311' }, { name: '平定县', district_code: '140321' }, { name: '盂县', district_code: '140322' }] },
      { name: '长治市', postal_code: '046000', districts: [{ name: '潞州区', district_code: '140403' }, { name: '上党区', district_code: '140404' }, { name: '屯留区', district_code: '140405' }, { name: '潞城区', district_code: '140406' }, { name: '襄垣县', district_code: '140423' }, { name: '平顺县', district_code: '140425' }, { name: '黎城县', district_code: '140426' }, { name: '壶关县', district_code: '140427' }, { name: '长子县', district_code: '140428' }, { name: '武乡县', district_code: '140429' }, { name: '沁县', district_code: '140430' }, { name: '沁源县', district_code: '140431' }] },
      { name: '晋城市', postal_code: '048000', districts: [{ name: '城区', district_code: '140502' }, { name: '沁水县', district_code: '140521' }, { name: '阳城县', district_code: '140522' }, { name: '陵川县', district_code: '140524' }, { name: '泽州县', district_code: '140525' }, { name: '高平市', district_code: '140581' }] },
      { name: '朔州市', postal_code: '038500', districts: [{ name: '朔城区', district_code: '140602' }, { name: '平鲁区', district_code: '140603' }, { name: '山阴县', district_code: '140621' }, { name: '应县', district_code: '140622' }, { name: '右玉县', district_code: '140623' }, { name: '怀仁市', district_code: '140681' }] },
      { name: '晋中市', postal_code: '030600', districts: [{ name: '榆次区', district_code: '140702' }, { name: '太谷区', district_code: '140703' }, { name: '榆社县', district_code: '140721' }, { name: '左权县', district_code: '140722' }, { name: '和顺县', district_code: '140723' }, { name: '昔阳县', district_code: '140724' }, { name: '寿阳县', district_code: '140725' }, { name: '祁县', district_code: '140727' }, { name: '平遥县', district_code: '140728' }, { name: '灵石县', district_code: '140729' }, { name: '介休市', district_code: '140781' }] },
      { name: '运城市', postal_code: '044000', districts: [{ name: '盐湖区', district_code: '140802' }, { name: '临猗县', district_code: '140821' }, { name: '万荣县', district_code: '140822' }, { name: '闻喜县', district_code: '140823' }, { name: '稷山县', district_code: '140824' }, { name: '新绛县', district_code: '140825' }, { name: '绛县', district_code: '140826' }, { name: '垣曲县', district_code: '140827' }, { name: '夏县', district_code: '140828' }, { name: '平陆县', district_code: '140829' }, { name: '芮城县', district_code: '140830' }, { name: '永济市', district_code: '140881' }, { name: '河津市', district_code: '140882' }] },
      { name: '忻州市', postal_code: '034000', districts: [{ name: '忻府区', district_code: '140902' }, { name: '定襄县', district_code: '140921' }, { name: '五台县', district_code: '140922' }, { name: '代县', district_code: '140923' }, { name: '繁峙县', district_code: '140924' }, { name: '宁武县', district_code: '140925' }, { name: '静乐县', district_code: '140926' }, { name: '神池县', district_code: '140927' }, { name: '五寨县', district_code: '140928' }, { name: '岢岚县', district_code: '140929' }, { name: '河曲县', district_code: '140930' }, { name: '保德县', district_code: '140931' }, { name: '偏关县', district_code: '140932' }, { name: '原平市', district_code: '140981' }] },
      { name: '临汾市', postal_code: '041000', districts: [{ name: '尧都区', district_code: '141002' }, { name: '曲沃县', district_code: '141021' }, { name: '翼城县', district_code: '141022' }, { name: '襄汾县', district_code: '141023' }, { name: '洪洞县', district_code: '141024' }, { name: '古县', district_code: '141025' }, { name: '安泽县', district_code: '141026' }, { name: '浮山县', district_code: '141027' }, { name: '吉县', district_code: '141028' }, { name: '乡宁县', district_code: '141029' }, { name: '大宁县', district_code: '141030' }, { name: '隰县', district_code: '141031' }, { name: '永和县', district_code: '141032' }, { name: '蒲县', district_code: '141033' }, { name: '汾西县', district_code: '141034' }, { name: '侯马市', district_code: '141081' }, { name: '霍州市', district_code: '141082' }] },
      { name: '吕梁市', postal_code: '033000', districts: [{ name: '离石区', district_code: '141102' }, { name: '文水县', district_code: '141121' }, { name: '交城县', district_code: '141122' }, { name: '兴县', district_code: '141123' }, { name: '临县', district_code: '141124' }, { name: '柳林县', district_code: '141125' }, { name: '石楼县', district_code: '141126' }, { name: '岚县', district_code: '141127' }, { name: '方山县', district_code: '141128' }, { name: '中阳县', district_code: '141129' }, { name: '交口县', district_code: '141130' }, { name: '孝义市', district_code: '141181' }, { name: '汾阳市', district_code: '141182' }] },
    ],
  };

  const $ = (id) => document.getElementById(id);
  const root = () => $('filingWorkspaceRoot');
  const pageMode = () => root()?.dataset.mode || 'list';
  const isDetailPage = () => pageMode() === 'detail';
  const isListPage = () => pageMode() === 'list';
  const initialSystemId = () => Number(root()?.dataset.systemId || 0);

  function authHeaders() {
    const token = localStorage.getItem('auth_token') || '';
    return token ? { 'X-Auth-Token': token } : {};
  }

  function esc(value) {
    return String(value ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#39;');
  }

  function actorName() {
    return typeof currentActorName === 'function' ? currentActorName() : 'admin';
  }

  function apiErrorText(data) {
    if (!data) return '请求失败';
    if (typeof data.detail === 'string') return data.detail;
    if (data.detail && typeof data.detail === 'object') return '请求参数不合法';
    return data.message || '请求失败';
  }

  function levelBadge(level) {
    const num = Number(level) || 0;
    return num ? `<span class="mini-badge mini-badge-level">第${num}级</span>` : '<span class="mini-badge">未计算</span>';
  }

  function statusBadge(archived) {
    return archived ? '<span class="status-badge status-archived">已归档</span>' : '<span class="status-badge status-active">在用</span>';
  }

  function reqStatusBadge(status) {
    const map = { pending: ['status-pending', '待审核'], approved: ['status-approved', '已通过'], rejected: ['status-rejected', '已驳回'] };
    const [cls, label] = map[status] || ['', status || '-'];
    return `<span class="status-badge ${cls}">${esc(label)}</span>`;
  }

  function formatDateTime(value) {
    if (!value) return '-';
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return esc(value);
    return esc(parsed.toLocaleString('zh-CN', { hour12: false }));
  }

  window.requestReviewMeta = function requestReviewMeta(item) {
    if (!item || item.status === 'pending') return '<span class="table-meta">等待管理员处理</span>';
    return `<div class="table-meta"><strong>处理人：</strong>${esc(item.reviewed_by || '-')}<br><span>时间：${formatDateTime(item.reviewed_at)}</span><br><span>说明：${esc(item.review_comment || (item.status === 'approved' ? '已处理' : '-'))}</span></div>`;
  };

  function isErrorText(text) {
    const content = String(text || '');
    return /失败|错误|异常|不存在|不合法|请先|缺少|无法|不可|冲突|超限|未找到|禁止/.test(content);
  }

  function flashResult(el) {
    if (!el) return;
    el.style.borderColor = 'var(--primary)';
    window.setTimeout(() => {
      el.style.borderColor = '';
    }, 1400);
  }

  function showPageResult(elementId, text, options = {}) {
    const el = $(elementId);
    if (el) {
      el.textContent = text;
      flashResult(el);
    }
    const popup = options.popup !== undefined ? options.popup : isErrorText(text);
    if (popup && window.appDialog) {
      window.appDialog.alert(text, options.title || '提示');
    }
  }

  function setListResult(text, options) {
    showPageResult('workspaceListResult', text, options);
  }

  function setDetailResult(text, options) {
    showPageResult('workspaceDetailResult', text, options);
  }

  function setCreateModalResult(text, options) {
    showPageResult('workspaceCreateModalResult', text, options);
  }

  function boolSelect(id, trueLabel, falseLabel) {
    return `<select id="${id}"><option value="false">${falseLabel}</option><option value="true">${trueLabel}</option></select>`;
  }

  function optionsHtml(items) {
    return items.map(([code, label]) => `<option value="${esc(code)}">${esc(label)}</option>`).join('');
  }

  function choiceGroupHtml(name, items, config = {}) {
    const type = config.type || 'checkbox';
    const layoutClass = config.layoutClass || '';
    return `<div class="choice-grid ${layoutClass}">${items.map(([value, label]) => `<label class="choice-chip ${config.chipClass || ''}"><input type="${type}" name="${name}" value="${esc(value)}"><span>${esc(label)}</span></label>`).join('')}</div>`;
  }

  function checkboxGroupHtml(name, items, layoutClass = '') {
    return choiceGroupHtml(name, items, { type: 'checkbox', layoutClass });
  }

  function radioGroupHtml(name, items, layoutClass = 'choice-row') {
    return choiceGroupHtml(name, items, { type: 'radio', layoutClass, chipClass: 'choice-chip-sm' });
  }

  function boolRadioHtml(name, trueLabel = '是', falseLabel = '否') {
    return radioGroupHtml(name, [['true', trueLabel], ['false', falseLabel]]);
  }

  function uploadFieldHtml(label, inputId, slotKey, accept, attachmentId, hint = '选择文件后自动上传，未上传按无处理。') {
    return `
      <div class="upload-inline-field">
        <label>${esc(label)}</label>
        <div class="upload-inline-box">
          <input id="${inputId}" type="file" accept="${esc(accept)}" data-auto-upload-slot="${esc(slotKey)}">
          <div class="table-meta">${esc(hint)}</div>
          <div class="attachment-list" id="${attachmentId}"></div>
          <div class="table-meta" id="${attachmentId}Status"></div>
        </div>
      </div>
    `;
  }

  function sectionBlock(title, hint, body, extraClass) {
    return `<details class="workspace-collapsible ${extraClass || ''}" open><summary><span>${esc(title)}</span><small>${esc(hint || '')}</small></summary><div class="workspace-collapsible-body">${body}</div></details>`;
  }

  function normalizeRegionName(value) {
    return String(value || '').replace(/\s+/g, '').replace(/特别行政区|维吾尔自治区|回族自治区|壮族自治区|自治区|自治州|省|市|盟|地区|区|县|旗$/g, '');
  }

  function findProvinceEntry(value) {
    const text = String(value || '').trim();
    if (!text) return '';
    const direct = Object.keys(REGION_TREE).find((item) => item === text);
    if (direct) return direct;
    return Object.keys(REGION_TREE).find((item) => normalizeRegionName(item) === normalizeRegionName(text)) || text;
  }

  function findCityEntry(provinceName, cityName) {
    const cities = REGION_TREE[provinceName] || [];
    const normalized = normalizeRegionName(cityName);
    return cities.find((item) => normalizeRegionName(item.name) === normalized) || null;
  }

  function findDistrictEntry(provinceName, cityName, districtName) {
    const city = findCityEntry(provinceName, cityName);
    if (!city) return null;
    const normalized = normalizeRegionName(districtName);
    return (city.districts || []).find((item) => normalizeRegionName(item.name) === normalized) || null;
  }

  function renderAddressPickerOptions() {
    if ($('orgProvince')) {
      const current = getValue('orgProvince');
      $('orgProvince').innerHTML = `<option value="">请选择省份</option>${PROVINCE_OPTIONS.map((item) => `<option value="${esc(item)}">${esc(item)}</option>`).join('')}`;
      if (current) $('orgProvince').value = current;
    }
  }

  function syncAddressPicker(preserveMeta) {
    const provinceName = findProvinceEntry(getValue('orgProvince'));
    const cityInput = $('orgCity');
    const districtInput = $('orgDistrict');
    const currentCity = cityInput ? cityInput.value : '';
    const currentDistrict = districtInput ? districtInput.value : '';
    const cities = REGION_TREE[provinceName] || [];
    if (cityInput) {
      cityInput.innerHTML = `<option value="">请选择地市</option>${cities.map((item) => `<option value="${esc(item.name)}">${esc(item.name)}</option>`).join('')}`;
      if (currentCity && cities.some((item) => normalizeRegionName(item.name) === normalizeRegionName(currentCity))) {
        cityInput.value = cities.find((item) => normalizeRegionName(item.name) === normalizeRegionName(currentCity)).name;
      } else {
        cityInput.value = '';
      }
    }
    const cityEntry = findCityEntry(provinceName, cityInput ? cityInput.value : '');
    if (districtInput) {
      districtInput.innerHTML = `<option value="">请选择区县</option>${(cityEntry?.districts || []).map((item) => `<option value="${esc(item.name)}">${esc(item.name)}</option>`).join('')}`;
      if (currentDistrict && cityEntry && (cityEntry.districts || []).some((item) => normalizeRegionName(item.name) === normalizeRegionName(currentDistrict))) {
        districtInput.value = (cityEntry.districts || []).find((item) => normalizeRegionName(item.name) === normalizeRegionName(currentDistrict)).name;
      } else {
        districtInput.value = '';
      }
    }
    const districtEntry = findDistrictEntry(provinceName, cityInput ? cityInput.value : '', districtInput ? districtInput.value : '');
    if (!preserveMeta) {
      if (districtEntry?.district_code) setValue('orgDistrictCode', districtEntry.district_code);
      if (districtEntry?.postal_code) {
        setValue('orgPostalCode', districtEntry.postal_code);
      } else if (cityEntry?.postal_code && !getValue('orgPostalCode')) {
        setValue('orgPostalCode', cityEntry.postal_code);
      }
    }
  }

  function copyCyberDeptToDataDept() {
    setValue('dataDept', getValue('cyberDept'));
    setValue('dataOwnerName', getValue('cyberOwnerName'));
    setValue('dataOwnerTitle', getValue('cyberOwnerTitle'));
    setValue('dataOwnerPhone', getValue('cyberOwnerPhone'));
    setValue('dataOwnerMobile', getValue('cyberOwnerMobile'));
    setValue('dataOwnerEmail', getValue('cyberOwnerEmail'));
    setDetailResult('已复制网络安全责任部门信息到数据安全管理部门。');
  }

  function renderShell() {
    if ($('createOrgIndustry')) $('createOrgIndustry').innerHTML = `<option value="">请选择</option>${optionsHtml(INDUSTRY_OPTIONS)}`;
    if ($('createOrgType')) $('createOrgType').innerHTML = `<option value="">请选择</option>${optionsHtml(ORG_TYPE_OPTIONS)}`;

    if ($('workspaceTable1')) $('workspaceTable1').innerHTML = renderTable1();
    if ($('workspaceTable2')) $('workspaceTable2').innerHTML = renderTable2();
    if ($('workspaceTable3')) $('workspaceTable3').innerHTML = renderTable3();
    if ($('workspaceTable4')) $('workspaceTable4').innerHTML = renderTable4();
    if ($('workspaceTable5')) $('workspaceTable5').innerHTML = renderTable5();
    if ($('workspaceTable6')) $('workspaceTable6').innerHTML = renderTable6();
    renderAddressPickerOptions();
  }

  function openCreateModal(mode, org) {
    const modal = $('workspaceCreateModal');
    if (modal && modal.parentElement !== document.body) {
      document.body.appendChild(modal);
    }
    const isOrg = mode === 'organization';
    $('workspaceCreateModalTitle').innerHTML = isOrg ? '<i class="fas fa-plus"></i> 新建单位' : '<i class="fas fa-plus"></i> 新增系统';
    $('workspaceCreateModalHint').textContent = isOrg ? '先建单位，再在单位下新增系统' : `当前单位：${org && org.name ? org.name : '未选择单位'}`;
    $('workspaceCreateOrgForm').hidden = !isOrg;
    $('workspaceCreateSystemForm').hidden = isOrg;
    $('createOrgBtn').disabled = false;
    $('createSystemBtn').disabled = false;
    setCreateModalResult(isOrg ? '请填写信息后保存。' : '请填写系统信息后保存。');
    if (org) {
      state.createOrgId = org.id;
      $('createSystemOrgName').value = org.name || '';
    }
    modal.classList.add('visible');
    modal.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
  }

  function closeCreateModal() {
    const modal = $('workspaceCreateModal');
    modal.classList.remove('visible');
    modal.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
  }

  function refreshAttentionIfAvailable() {
    if (typeof refreshAttentionSummary === 'function') {
      refreshAttentionSummary();
    }
  }

  function focusOrganizationByCreditCode(creditCode) {
    const target = state.overview.find((item) => String((item.organization || {}).credit_code || '').trim().toUpperCase() === String(creditCode || '').trim().toUpperCase());
    if (!target) return false;
    state.openOrgIds.add(target.organization.id);
    renderOverview();
    return true;
  }

  function switchMaintenanceTab(tabName) {
    document.querySelectorAll('[data-maintenance-tab]').forEach((btn) => {
      btn.classList.toggle('is-active', btn.dataset.maintenanceTab === tabName);
    });
    document.querySelectorAll('[data-maintenance-panel]').forEach((panel) => {
      const active = panel.dataset.maintenancePanel === tabName;
      panel.hidden = !active;
      panel.classList.toggle('is-active', active);
    });
  }

  function initialAttentionTab() {
    const params = new URLSearchParams(window.location.search);
    const tabName = String(params.get('attention') || '').trim();
    const validTabs = new Set(['org-requests', 'sys-requests', 'org-recycle', 'sys-recycle']);
    return validTabs.has(tabName) ? tabName : '';
  }

  function renderTable1() {
    return sectionBlock('表一 单位基本情况', '单位信息以 Word 模板为准', `
      <div class="form-grid form-grid-3">
        <div><label>单位名称</label><input id="orgName"></div>
        <div><label>统一社会信用代码</label><input id="orgCreditCode"></div>
        <div><label>备案地区</label><input id="orgFilingRegion"></div>
        <div class="grid-span-3"><label>单位使用互联网地址</label><input id="unitInternetAddresses" placeholder="没有请填写无"></div>
      </div>

      <div class="workspace-subsection">
        <h3>单位地址</h3>
        <div class="form-grid form-grid-4">
          <div><label>省(自治区、直辖市)</label><select id="orgProvince"><option value="">请选择省份</option></select></div>
          <div><label>地(区、市、州、盟)</label><select id="orgCity"><option value="">请选择地市</option></select></div>
          <div><label>县(区、市、旗)</label><select id="orgDistrict"><option value="">请选择区县</option></select></div>
          <div><label>详细地址</label><input id="orgDetailAddress" placeholder="例如：太原市小店区龙城大街 88 号"></div>
          <div><label>邮政编码</label><input id="orgPostalCode" placeholder="匹配到区县时自动回填，也可手动修改"></div>
          <div><label>行政区划代码</label><input id="orgDistrictCode" placeholder="匹配到区县时自动回填，也可手动修改"></div>
        </div>
      </div>

      <div class="workspace-subsection">
        <h3>单位负责人</h3>
        <div class="form-grid form-grid-4">
          <div><label>姓名</label><input id="orgLeaderName"></div>
          <div><label>职务/职称</label><input id="orgLeaderTitle"></div>
          <div><label>办公电话</label><input id="orgLeaderPhone" placeholder="可填写 /"></div>
          <div><label>电子邮件</label><input id="orgLeaderEmail"></div>
        </div>
      </div>

      <div class="workspace-subsection">
        <h3>网络安全责任部门</h3>
        <div class="form-grid form-grid-5">
          <div><label>责任部门</label><input id="cyberDept"></div>
          <div><label>联系人姓名</label><input id="cyberOwnerName"></div>
          <div><label>职务/职称</label><input id="cyberOwnerTitle"></div>
          <div><label>办公电话</label><input id="cyberOwnerPhone" placeholder="可填写 /"></div>
          <div><label>移动电话</label><input id="cyberOwnerMobile"></div>
          <div class="grid-span-2 filing-contact-email"><label>电子邮件</label><input id="cyberOwnerEmail"></div>
        </div>
      </div>

      <div class="workspace-subsection">
        <div class="workspace-subsection-head">
          <h3>数据安全管理部门</h3>
          <button class="btn-lite btn-sm" type="button" id="copyCyberToDataBtn"><i class="fas fa-copy"></i> 复制网络安全责任部门</button>
        </div>
        <div class="form-grid form-grid-5">
          <div><label>管理部门</label><input id="dataDept"></div>
          <div><label>联系人姓名</label><input id="dataOwnerName"></div>
          <div><label>职务/职称</label><input id="dataOwnerTitle"></div>
          <div><label>办公电话</label><input id="dataOwnerPhone" placeholder="可填写 /"></div>
          <div><label>移动电话</label><input id="dataOwnerMobile"></div>
          <div class="grid-span-2 filing-contact-email"><label>电子邮件</label><input id="dataOwnerEmail"></div>
        </div>
      </div>

      <div class="workspace-subsection">
        <h3>隶属关系</h3>
        ${radioGroupHtml('orgAffiliationCode', AFFILIATION_OPTIONS, 'choice-row')}
        <div id="orgAffiliationOtherWrap" class="inline-field" hidden><label>隶属关系-其他</label><input id="orgAffiliationOther"></div>
      </div>

      <div class="workspace-subsection">
        <h3>单位类型</h3>
        ${radioGroupHtml('orgTypeCode', ORG_TYPE_OPTIONS, 'choice-row')}
        <div id="orgTypeOtherWrap" class="inline-field" hidden><label>单位类型-其他</label><input id="orgTypeOther"></div>
      </div>

      <div class="workspace-subsection">
        <h3>行业类别</h3>
        <div class="form-grid form-grid-3">
          <div class="grid-span-2"><label>行业类别</label><select id="orgIndustryCode"><option value="">请选择</option>${optionsHtml(INDUSTRY_OPTIONS)}</select></div>
          <div id="orgIndustryOtherWrap" hidden><label>行业类别-其他</label><input id="orgIndustryOther"></div>
        </div>
      </div>

      <div class="workspace-subsection filing-counts-section">
        <h3>备案数量</h3>
        <div class="filing-counts-board">
          <section class="filing-count-group">
            <div class="filing-count-group-title">本次备案的定级对象数量</div>
            <div class="filing-count-summary">
              <label class="filing-count-cell filing-count-cell-summary">
                <span class="filing-count-label">本次备案总数</span>
                <span class="filing-count-input-wrap">
                  <input id="currentCountTotal" type="number" min="0" value="0">
                  <span class="filing-count-unit">个</span>
                </span>
              </label>
            </div>
            <div class="filing-count-table filing-count-table-even">
              <label class="filing-count-cell">
                <span class="filing-count-label">第二级定级对象数</span>
                <span class="filing-count-input-wrap">
                  <input id="currentCount2" type="number" min="0" value="0">
                  <span class="filing-count-unit">个</span>
                </span>
              </label>
              <label class="filing-count-cell">
                <span class="filing-count-label">第三级定级对象数</span>
                <span class="filing-count-input-wrap">
                  <input id="currentCount3" type="number" min="0" value="0">
                  <span class="filing-count-unit">个</span>
                </span>
              </label>
              <label class="filing-count-cell">
                <span class="filing-count-label">第四级定级对象数</span>
                <span class="filing-count-input-wrap">
                  <input id="currentCount4" type="number" min="0" value="0">
                  <span class="filing-count-unit">个</span>
                </span>
              </label>
              <label class="filing-count-cell">
                <span class="filing-count-label">第五级定级对象数</span>
                <span class="filing-count-input-wrap">
                  <input id="currentCount5" type="number" min="0" value="0">
                  <span class="filing-count-unit">个</span>
                </span>
              </label>
            </div>
          </section>
          <section class="filing-count-group">
            <div class="filing-count-group-title">定级对象总数（含本次备案）</div>
            <div class="filing-count-summary">
              <label class="filing-count-cell filing-count-cell-summary">
                <span class="filing-count-label">定级对象总数</span>
                <span class="filing-count-input-wrap">
                  <input id="totalCountTotal" type="number" min="0" value="0">
                  <span class="filing-count-unit">个</span>
                </span>
              </label>
            </div>
            <div class="filing-count-table filing-count-table-total">
              <label class="filing-count-cell">
                <span class="filing-count-label">第一级定级对象数</span>
                <span class="filing-count-input-wrap">
                  <input id="totalCount1" type="number" min="0" value="0">
                  <span class="filing-count-unit">个</span>
                </span>
              </label>
              <label class="filing-count-cell">
                <span class="filing-count-label">第二级定级对象数</span>
                <span class="filing-count-input-wrap">
                  <input id="totalCount2" type="number" min="0" value="0">
                  <span class="filing-count-unit">个</span>
                </span>
              </label>
              <label class="filing-count-cell">
                <span class="filing-count-label">第三级定级对象数</span>
                <span class="filing-count-input-wrap">
                  <input id="totalCount3" type="number" min="0" value="0">
                  <span class="filing-count-unit">个</span>
                </span>
              </label>
              <label class="filing-count-cell">
                <span class="filing-count-label">第四级定级对象数</span>
                <span class="filing-count-input-wrap">
                  <input id="totalCount4" type="number" min="0" value="0">
                  <span class="filing-count-unit">个</span>
                </span>
              </label>
              <label class="filing-count-cell">
                <span class="filing-count-label">第五级定级对象数</span>
                <span class="filing-count-input-wrap">
                  <input id="totalCount5" type="number" min="0" value="0">
                  <span class="filing-count-unit">个</span>
                </span>
              </label>
            </div>
          </section>
        </div>
      </div>
    `);
  }

  function renderTable2() {
    return sectionBlock('表二 定级对象情况', '按备案表原顺序填写', `
      <div class="form-grid form-grid-3">
        <div><label>定级对象</label><input id="systemName"></div>
        <div><label>运行状态</label>${radioGroupHtml('systemRunningStatus', [['在建设', '在建设'], ['已运行', '已运行']], 'choice-row')}</div>
      </div>
      <div class="workspace-subsection">
        <h3>定级对象类型（可多选）</h3>
        ${checkboxGroupHtml('objectTypes', OBJECT_TYPE_OPTIONS, 'choice-row')}
        <div id="technologyTypesWrap" class="inline-field">
          <label>信息系统采用技术类型（可多选）</label>
          ${checkboxGroupHtml('technologyTypes', TECHNOLOGY_OPTIONS, 'choice-row')}
          <div id="technologyOtherWrap" class="inline-field" hidden><label>其他技术</label><input id="technologyOther"></div>
        </div>
      </div>
      <div class="workspace-subsection">
        <h3>承载业务情况</h3>
        <label>业务类型</label>
        ${checkboxGroupHtml('businessTypes', BUSINESS_TYPE_OPTIONS, 'choice-row')}
        <div id="businessOtherWrap" class="inline-field" hidden><label>其他业务类型</label><input id="businessOther"></div>
        <label>业务描述</label>
        <textarea id="businessDescription"></textarea>
      </div>
      <div class="workspace-subsection">
        <h3>网络服务情况</h3>
        <label>服务范围</label>
        ${radioGroupHtml('serviceScopeCode', SERVICE_SCOPE_OPTIONS, 'choice-row')}
        <div class="form-grid form-grid-3">
          <div id="crossProvinceWrap" hidden><label>跨省（区、市）数量</label><input id="crossProvinceCount" type="number" min="0"></div>
          <div id="crossCityWrap" hidden><label>跨地（市、区）数量</label><input id="crossCityCount" type="number" min="0"></div>
          <div id="serviceScopeOtherWrap" hidden><label>服务范围-其他</label><input id="serviceScopeOther"></div>
        </div>
      </div>
      <div class="workspace-subsection">
        <h3>服务对象</h3>
        ${radioGroupHtml('serviceTargetCode', SERVICE_TARGET_OPTIONS, 'choice-row')}
        <div id="serviceTargetOtherWrap" class="inline-field" hidden><label>服务对象-其他</label><input id="serviceTargetOther"></div>
      </div>
      <div class="workspace-subsection">
        <h3>网络平台</h3>
        <label>部署范围</label>
        ${radioGroupHtml('coverageCode', COVERAGE_OPTIONS, 'choice-row')}
        <div id="coverageOtherWrap" class="inline-field" hidden><label>部署范围-其他</label><input id="coverageOther"></div>
        <label>网络性质</label>
        ${radioGroupHtml('networkNatureCode', NETWORK_NATURE_OPTIONS, 'choice-row')}
        <div class="form-grid form-grid-3">
          <div id="networkNatureOtherWrap" hidden><label>网络性质-其他</label><input id="networkNatureOther"></div>
          <div class="grid-span-3" id="internetFieldsWrap" hidden>
            <div class="form-grid form-grid-3">
              <div><label>源站 IP 地址范围</label><input id="sourceIpRange"></div>
              <div><label>域名</label><input id="sourceDomain"></div>
              <div><label>主要协议/端口</label><input id="sourceProtocolPorts"></div>
            </div>
          </div>
        </div>
        <h4>网络互联情况</h4>
        ${checkboxGroupHtml('interconnectionItems', INTERCONNECTION_OPTIONS, 'choice-row')}
        <div id="interconnectionOtherWrap" class="inline-field" hidden><label>网络互联-其他</label><input id="interconnectionOther"></div>
      </div>
      <div class="form-grid form-grid-3">
          <div><label>何时投入运行使用</label><input id="systemGoLiveDate" type="date"></div>
          <div class="grid-span-2"><label>是否是分系统</label>${boolRadioHtml('isSubSystem', '是', '否')}</div>
          <div id="parentSystemWrap" hidden><label>上级系统名称</label><input id="parentSystemName"></div>
          <div id="parentOrgWrap" hidden><label>上级系统所属单位名称</label><input id="parentOrganizationName"></div>
      </div>
    `);
  }

  function damageLevelTableHtml(name, title) {
    return `
      <section class="level-card">
        <h3>${esc(title)}</h3>
        <div class="damage-level-table">
          ${DAMAGE_LEVEL_GROUPS.map((group) => `
            <section class="damage-level-group">
              <div class="damage-level-group-head">
                <strong class="damage-level-group-title">第${group.level}级</strong>
                <span class="damage-level-group-meta">${group.items.length}种情形</span>
              </div>
              <div class="damage-level-group-body">
                ${group.items.map((item) => `
                  <label class="damage-level-row">
                    <span class="damage-level-control"><input type="radio" name="${damageLevelGroupName(name, group.level)}" value="${esc(item.label)}"></span>
                    <span class="damage-level-text">${esc(item.label)}</span>
                  </label>
                `).join('')}
              </div>
            </section>
          `).join('')}
        </div>
        <div class="level-display">同步级别：<strong id="${name === 'businessDamageLevel' ? 'businessLevelDisplay' : 'serviceLevelDisplay'}">未计算</strong></div>
      </section>
    `;
  }

  function renderTable3() {
    return sectionBlock('表三 定级情况', '同级单选、可跨级多选，系统自动同步保护等级', `
      <div class="level-layout">
        ${damageLevelTableHtml('businessDamageLevel', '确定业务信息安全保护等级')}
        ${damageLevelTableHtml('serviceDamageLevel', '确定系统服务安全保护等级')}
      </div>
      <div class="final-level-box">定级对象安全保护等级：<strong id="finalLevelDisplay">未计算</strong></div>
      <div class="form-grid form-grid-3">
        <div><label>定级时间</label><input id="gradingDate" type="date"></div>
      </div>
      <div class="workspace-subsection">
        <h3>定级报告</h3>
        ${radioGroupHtml('gradingReportStatus', [['has', '有'], ['none', '无']], 'choice-row')}
        <div id="gradingReportUploadWrap" hidden>
          ${uploadFieldHtml('定级报告附件', 'uploadTable3GradingReport', 'table3.grading_report', '.doc,.docx,.pdf', 'attachmentTable3GradingReport')}
        </div>
      </div>
      <div class="workspace-subsection">
        <h3>专家评审情况</h3>
        ${radioGroupHtml('expertReviewStatus', [['reviewed', '已评审'], ['unreviewed', '未评审']], 'choice-row')}
        <div id="expertReviewUploadWrap" hidden>
          ${uploadFieldHtml('专家评审附件', 'uploadTable3ExpertReview', 'table3.expert_review', '.doc,.docx,.pdf', 'attachmentTable3ExpertReview')}
        </div>
      </div>
      <div class="workspace-subsection">
        <h3>上级行业主管部门</h3>
        ${boolRadioHtml('hasSupervisor', '有', '无')}
        <div id="supervisorNameWrap" hidden><label>上级行业主管部门名称</label><input id="supervisorName"></div>
        <div id="supervisorReviewWrap" hidden>
          <label>上级行业主管部门审核定级情况</label>
          ${radioGroupHtml('supervisorReviewStatus', [['reviewed', '已审核'], ['unreviewed', '未审核']], 'choice-row')}
        </div>
        <div id="supervisorReviewUploadWrap" hidden>
          ${uploadFieldHtml('上级行业主管部门审核附件', 'uploadTable3SupervisorReview', 'table3.supervisor_review', '.doc,.docx,.pdf', 'attachmentTable3SupervisorReview')}
        </div>
      </div>
      <div class="form-grid form-grid-3">
        <div><label>填表人</label><input id="fillerName"></div>
        <div><label>填表日期</label><input id="filledDate" type="date"></div>
      </div>
    `);
  }

  function sceneBlock(key, title, enabledHtml, body) {
    return `<details class="workspace-collapsible workspace-scene" open><summary><span>${esc(title)}</span><small>按实际采用情况填写</small></summary><div class="workspace-collapsible-body"><div class="inline-field">${enabledHtml}</div><div id="${key}DetailWrap">${body}</div></div></details>`;
  }

  function renderTable4() {
    return sectionBlock('表四 新技术新应用场景', '选“否”时不显示对应补充项', `
      ${sceneBlock('cloudScene', '云计算应用场景补充信息', `<label>是否采用云计算技术</label>${boolRadioHtml('cloudEnabled', '是', '否')}`, `
        <div class="workspace-subsection"><h4>责任主体类型</h4>${checkboxGroupHtml('cloudResponsibilityTypes', CLOUD_RESPONSIBILITY_OPTIONS, 'choice-row')}</div>
        <div class="workspace-subsection"><h4>云计算服务模式</h4>${checkboxGroupHtml('cloudServiceModes', CLOUD_SERVICE_MODE_OPTIONS, 'choice-row')}<div id="cloudServiceModeOtherWrap" class="inline-field" hidden><label>其他服务模式</label><input id="cloudServiceModeOther"></div></div>
        <div class="workspace-subsection"><h4>云计算部署模式</h4>${checkboxGroupHtml('cloudDeploymentModes', CLOUD_DEPLOYMENT_OPTIONS, 'choice-row')}<div id="cloudDeploymentOtherWrap" class="inline-field" hidden><label>其他部署模式</label><input id="cloudDeploymentOther"></div></div>
        <div id="cloudProviderSectionWrap" class="workspace-subsection" hidden>
          <h4>云服务商填写</h4>
          <div class="form-grid form-grid-3">
            <div><label>云服务客户数量</label><input id="cloudCustomerCount"></div>
            <div><label>云平台基础设施地点</label><input id="cloudInfraLocation"></div>
            <div><label>云平台运维地点</label><input id="cloudOpsLocation"></div>
          </div>
        </div>
        <div id="cloudCustomerSectionWrap" class="workspace-subsection" hidden>
          <h4>云服务客户填写</h4>
          <div class="form-grid form-grid-3">
            <div><label>云服务商</label><input id="cloudProviderName"></div>
            <div><label>平台安全等级</label><input id="cloudProviderLevel"></div>
            <div><label>平台名称</label><input id="cloudProviderPlatformName"></div>
            <div><label>平台备案编号</label><input id="cloudProviderRecordNo"></div>
            <div class="grid-span-2"><label>云服务客户运维地点</label><input id="cloudCustomerOpsLocation"></div>
          </div>
          ${uploadFieldHtml('云平台备案证明', 'uploadTable4Cloud', 'table4.cloud', '.doc,.docx,.pdf', 'attachmentTable4Cloud')}
        </div>
      `)}
      ${sceneBlock('mobileScene', '移动互联应用场景补充信息', `<label>是否采用移动互联技术</label>${boolRadioHtml('mobileEnabled', '是', '否')}`, `
        <div class="form-grid form-grid-3">
          <div class="grid-span-3"><label>移动应用软件名称、小程序名称等</label><input id="mobileAppName"></div>
        </div>
        <div class="workspace-subsection"><h4>无线通道情况</h4>${checkboxGroupHtml('mobileWirelessChannels', MOBILE_CHANNEL_OPTIONS, 'choice-row')}</div>
        <div class="workspace-subsection"><h4>移动终端情况</h4>${checkboxGroupHtml('mobileTerminalTypes', MOBILE_TERMINAL_OPTIONS, 'choice-row')}</div>
      `)}
      ${sceneBlock('iotScene', '物联网应用场景补充信息', `<label>是否为物联网系统</label>${boolRadioHtml('iotEnabled', '是', '否')}`, `
        <div class="workspace-subsection"><h4>系统感知层（可多选）</h4>${checkboxGroupHtml('iotPerceptionLayers', IOT_PERCEPTION_OPTIONS, 'choice-row')}<div id="iotPerceptionOtherWrap" class="inline-field" hidden><label>感知层-其他</label><input id="iotPerceptionOther"></div></div>
        <div class="workspace-subsection"><h4>系统网络传输层（可多选）</h4>${checkboxGroupHtml('iotTransportLayers', IOT_TRANSPORT_OPTIONS, 'choice-row')}<div id="iotTransportOtherWrap" class="inline-field" hidden><label>传输层-其他</label><input id="iotTransportOther"></div></div>
      `)}
      ${sceneBlock('industrialScene', '工业控制系统应用场景补充信息', `<label>是否为工业控制系统</label>${boolRadioHtml('industrialEnabled', '是', '否')}`, `
        <div class="workspace-subsection"><h4>系统功能层次（可多选）</h4>${checkboxGroupHtml('industrialFunctionLayers', INDUSTRIAL_LAYER_OPTIONS, 'choice-row')}</div>
        <div class="workspace-subsection"><h4>工业控制系统组成（可多选）</h4>${checkboxGroupHtml('industrialComponents', INDUSTRIAL_COMPONENT_OPTIONS, 'choice-row')}<div id="industrialComponentOtherWrap" class="inline-field" hidden><label>系统组成-其他</label><input id="industrialComponentOther"></div></div>
      `)}
      ${sceneBlock('bigDataScene', '大数据应用场景补充信息', `<label>是否采用大数据技术</label>${boolRadioHtml('bigDataEnabled', '是', '否')}`, `
        <div class="workspace-subsection"><h4>大数据系统组成（可多选）</h4>${checkboxGroupHtml('bigDataComponents', BIG_DATA_COMPONENT_OPTIONS, 'choice-row')}</div>
        <div class="workspace-subsection"><h4>大数据出境情况</h4>${radioGroupHtml('bigDataCrossBorderStatus', [['无出境需求', '无出境需求'], ['有出境需求', '有出境需求']], 'choice-row')}</div>
        <div id="bigDataPlatformWrap" class="workspace-subsection" hidden>
          <h4>大数据平台填写</h4>
          <div class="form-grid form-grid-3">
            <div><label>大数据应用数量</label><input id="bigDataApplicationCount"></div>
            <div><label>大数据平台基础设施地点</label><input id="bigDataInfraLocation"></div>
            <div><label>大数据平台运维地点</label><input id="bigDataOpsLocation"></div>
          </div>
        </div>
        <div id="bigDataConsumerWrap" class="workspace-subsection" hidden>
          <h4>大数据应用、大数据资源填写</h4>
          <div class="form-grid form-grid-3">
            <div><label>平台服务商</label><input id="bigDataProviderName"></div>
            <div><label>平台安全等级</label><input id="bigDataProviderLevel"></div>
            <div><label>平台名称</label><input id="bigDataProviderPlatformName"></div>
            <div><label>平台备案编号</label><input id="bigDataProviderRecordNo"></div>
          </div>
          ${uploadFieldHtml('大数据平台备案证明', 'uploadTable4BigData', 'table4.big_data', '.doc,.docx,.pdf', 'attachmentTable4BigData')}
        </div>
      `)}
    `);
  }

  function renderTable5() {
    return sectionBlock('表五 提交材料情况', '选"有"后上传附件，选"无"则跳过', `
      <div class="materials-stack">
        ${MATERIAL_SLOTS.map(([key, label]) => `
          <div class="material-slot material-slot-row">
            <div class="material-slot-head">
              <strong>${esc(label)}</strong>
              <div class="choice-grid choice-row" style="margin-top:6px">
                <label class="choice-chip choice-chip-sm"><input type="radio" name="table5_status_${key}" value="has"><span>有</span></label>
                <label class="choice-chip choice-chip-sm"><input type="radio" name="table5_status_${key}" value="none" checked><span>无</span></label>
              </div>
            </div>
            <div class="material-slot-upload" id="table5Upload_${key}" hidden>
              ${uploadFieldHtml(label, `upload_${key}`, `table5.${key}`, '.doc,.docx,.pdf,.jpg,.jpeg,.png,.vsd,.vsdx', `attachment_${key}`)}
            </div>
          </div>
        `).join('')}
      </div>
    `);
  }

  function renderTable6() {
    return sectionBlock('表六 数据摸底调查表', '支持新增多条数据项，导出 Word 默认使用第一条', `
      <div class="panel-actions">
        <button class="btn-lite btn-sm" id="addDataItemBtn"><i class="fas fa-plus"></i> 新增数据项</button>
      </div>
      <div id="table6Items" class="data-item-stack"></div>
    `);
  }

  function table6CardRadioHtml(field, items, currentValue, index, layoutClass = 'choice-row') {
    const groupName = `table6_${field}_${index}`;
    return `<div class="choice-grid ${layoutClass}">${items.map(([value, label]) => `<label class="choice-chip choice-chip-sm"><input type="radio" name="${groupName}" data-radio-field="${field}" value="${esc(value)}" ${String(currentValue || '') === String(value) ? 'checked' : ''}><span>${esc(label)}</span></label>`).join('')}</div>`;
  }

  function dataItemCard(item, index) {
    const value = (key) => esc(item && item[key] ? item[key] : '');
    const checked = (key, target) => Array.isArray(item && item[key]) && item[key].includes(target) ? 'checked' : '';
    const radioValue = (key) => {
      if (!item) return '';
      if (key === 'data_level_code' && !item[key] && item.data_level) {
        return DATA_LEVEL_OPTIONS.find((option) => option[1] === item.data_level)?.[0] || '';
      }
      return String(item[key] || '');
    };
    return `
      <article class="data-item-card" data-index="${index}">
        <div class="card-head">
          <strong>数据项 ${index + 1}</strong>
          <button type="button" class="btn-lite btn-sm btn-danger" data-remove-data-index="${index}">删除</button>
        </div>
        <div class="form-grid form-grid-3">
          <div><label>数据名称</label><input data-field="data_name" value="${value('data_name')}"></div>
          <div class="grid-span-2"><label>拟定数据级别</label>${table6CardRadioHtml('data_level_code', DATA_LEVEL_OPTIONS, radioValue('data_level_code'), index)}</div>
          <div><label>数据类别</label><input data-field="data_category" value="${value('data_category')}"></div>
          <div><label>数据安全责任部门</label><input data-field="data_security_dept" value="${value('data_security_dept')}"></div>
          <div><label>数据安全负责人</label><input data-field="data_security_owner" value="${value('data_security_owner')}"></div>
        </div>
        <div class="workspace-subsection">
          <h4>个人信息涉及情况</h4>
          <div class="choice-grid choice-row">${PERSONAL_INFO_OPTIONS.map(([val, label]) => `<label class="choice-chip choice-chip-sm"><input type="checkbox" data-array-field="personal_info_flags" value="${esc(val)}" ${checked('personal_info_flags', val)}><span>${esc(label)}</span></label>`).join('')}</div>
        </div>
        <div class="workspace-subsection">
          <h4>数据总量</h4>
          <div class="data-quantity-inline">
            <label class="choice-chip choice-chip-sm"><input type="radio" data-radio-field="data_total_unit" name="table6_data_total_unit_${index}" value="gb" ${(item && item.data_total_unit === 'gb') || (item && item.data_total_gb) ? 'checked' : ''}><span>GB</span></label>
            <label class="choice-chip choice-chip-sm"><input type="radio" data-radio-field="data_total_unit" name="table6_data_total_unit_${index}" value="tb" ${(item && item.data_total_unit === 'tb') || (item && !item.data_total_gb && item.data_total_tb) ? 'checked' : ''}><span>TB</span></label>
            <span data-qty-input-gb class="data-qty-input-toggle" hidden><input data-field="data_total_gb" value="${value('data_total_gb')}"></span>
            <span data-qty-input-tb class="data-qty-input-toggle" hidden><input data-field="data_total_tb" value="${value('data_total_tb')}"></span>
            <span class="data-qty-hint">根据数据量级选择后填写</span>
          </div>
          <div class="data-quantity-inline" style="margin-top:8px">
            <label class="data-qty-item"><input data-field="data_total_records" value="${value('data_total_records')}"><span class="data-qty-unit">万条</span></label>
            <span class="data-qty-hint">若为个人信息，填写涉及的个人信息条数</span>
          </div>
        </div>
        <div class="workspace-subsection">
          <h4>数据月增长量</h4>
          <div class="data-quantity-inline">
            <label class="choice-chip choice-chip-sm"><input type="radio" data-radio-field="monthly_growth_unit" name="table6_monthly_growth_unit_${index}" value="gb" ${(item && item.monthly_growth_unit === 'gb') || (item && item.monthly_growth_gb) ? 'checked' : ''}><span>GB</span></label>
            <label class="choice-chip choice-chip-sm"><input type="radio" data-radio-field="monthly_growth_unit" name="table6_monthly_growth_unit_${index}" value="tb" ${(item && item.monthly_growth_unit === 'tb') || (item && !item.monthly_growth_gb && item.monthly_growth_tb) ? 'checked' : ''}><span>TB</span></label>
            <span data-qty-input-growth-gb class="data-qty-input-toggle" hidden><input data-field="monthly_growth_gb" value="${value('monthly_growth_gb')}"></span>
            <span data-qty-input-growth-tb class="data-qty-input-toggle" hidden><input data-field="monthly_growth_tb" value="${value('monthly_growth_tb')}"></span>
            <span class="data-qty-hint">根据数据量级选择后填写</span>
          </div>
        </div>
        <div class="workspace-subsection">
          <h4>数据来源（可多选）</h4>
          <div class="choice-grid choice-row">${DATA_SOURCE_OPTIONS.map(([val, label]) => `<label class="choice-chip choice-chip-sm"><input type="checkbox" data-array-field="data_sources" value="${esc(val)}" ${checked('data_sources', val)}><span>${esc(label)}</span></label>`).join('')}</div>
          <div data-source-other-wrap hidden><label>数据来源-其他</label><input data-field="data_source_other" value="${value('data_source_other')}"></div>
        </div>
        <div class="workspace-subsection">
          <h4>单位间数据流转情况</h4>
          <div class="form-grid form-grid-3">
            <div><label>数据来源单位1</label><input data-field="source_unit_1" value="${value('source_unit_1')}"></div>
            <div><label>数据来源单位2</label><input data-field="source_unit_2" value="${value('source_unit_2')}"></div>
            <div><label>数据来源单位3</label><input data-field="source_unit_3" value="${value('source_unit_3')}"></div>
            <div><label>数据流出单位1</label><input data-field="target_unit_1" value="${value('target_unit_1')}"></div>
            <div><label>数据流出单位2</label><input data-field="target_unit_2" value="${value('target_unit_2')}"></div>
            <div><label>数据流出单位3</label><input data-field="target_unit_3" value="${value('target_unit_3')}"></div>
          </div>
        </div>
        <div class="workspace-subsection">
          <h4>与其他数据处理者的交互情况</h4>
          <div class="choice-grid choice-row">${INTERACTION_OPTIONS.map(([val, label]) => `<label class="choice-chip choice-chip-sm"><input type="checkbox" data-array-field="interaction_types" value="${esc(val)}" ${checked('interaction_types', val)}><span>${esc(label)}</span></label>`).join('')}</div>
          <div class="form-grid form-grid-3">
            <div data-interaction-provide-wrap hidden><label>对外提供给</label><input data-field="interaction_provide_to" value="${value('interaction_provide_to')}"></div>
            <div data-interaction-entrust-wrap hidden><label>委托处理方</label><input data-field="interaction_entrust_to" value="${value('interaction_entrust_to')}"></div>
            <div data-interaction-share-wrap hidden><label>共同处理方</label><input data-field="interaction_shared_with" value="${value('interaction_shared_with')}"></div>
          </div>
        </div>
        <div class="workspace-subsection">
          <h4>数据存储位置（名称）</h4>
          <label>云平台类型</label>
          ${table6CardRadioHtml('storage_cloud_type', STORAGE_CLOUD_OPTIONS, radioValue('storage_cloud_type'), index)}
          <div data-storage-cloud-wrap hidden><label>云平台名称</label><input data-field="storage_cloud_name" value="${value('storage_cloud_name')}"></div>
          <label>机房类型</label>
          ${table6CardRadioHtml('storage_room_type', STORAGE_ROOM_OPTIONS, radioValue('storage_room_type'), index)}
          <div data-storage-room-wrap hidden><label>机房名称</label><input data-field="storage_room_name" value="${value('storage_room_name')}"></div>
          <label>地域</label>
          ${table6CardRadioHtml('storage_region_type', STORAGE_REGION_OPTIONS, radioValue('storage_region_type'), index)}
          <div data-storage-region-wrap hidden><label>地域名称</label><input data-field="storage_region_name" value="${value('storage_region_name')}"></div>
        </div>
      </article>
    `;
  }

  function setValue(id, value) {
    const el = $(id);
    if (el) el.value = value ?? '';
  }

  function getValue(id) {
    const el = $(id);
    return el ? String(el.value || '').trim() : '';
  }

  function setCheckedValues(name, values) {
    const selected = new Set(Array.isArray(values) ? values : []);
    document.querySelectorAll(`input[name="${name}"]`).forEach((input) => {
      input.checked = selected.has(input.value);
    });
  }

  function getCheckedValues(name) {
    return Array.from(document.querySelectorAll(`input[name="${name}"]:checked`)).map((item) => item.value);
  }

  function setRadioValue(name, value) {
    document.querySelectorAll(`input[name="${name}"]`).forEach((input) => {
      input.checked = input.value === String(value);
    });
  }

  function getRadioValue(name) {
    const current = document.querySelector(`input[name="${name}"]:checked`);
    return current ? current.value : '';
  }

  function show(id, visible) {
    const el = $(id);
    if (el) el.hidden = !visible;
  }

  function selectedLabel(items, code) {
    return (items.find((item) => item[0] === code) || [null, ''])[1];
  }

  function numberValue(id) {
    const raw = getValue(id);
    if (!raw) return 0;
    const num = Number(raw);
    return Number.isFinite(num) ? num : 0;
  }

  function ensureDataItems(items) {
    return Array.isArray(items) && items.length ? items : [{}];
  }

  function resolveDamageLevelOption(item) {
    const text = String(item || '').trim();
    if (!text) return null;
    return DAMAGE_LEVEL_OPTION_MAP.get(text) || DAMAGE_LEVEL_LEGACY_MAP.get(text) || null;
  }

  function normalizeDamageLevelSelection(item) {
    return resolveDamageLevelOption(item)?.label || String(item || '').trim();
  }

  function damageLevelGroupName(baseName, level) {
    return `${baseName}_level_${level}`;
  }

  function setDamageLevelSelections(baseName, items) {
    const selectedByLevel = new Map();
    (Array.isArray(items) ? items : []).forEach((item) => {
      const option = resolveDamageLevelOption(item);
      if (option && !selectedByLevel.has(option.level)) {
        selectedByLevel.set(option.level, option.label);
      }
    });
    DAMAGE_LEVEL_GROUPS.forEach((group) => {
      setRadioValue(damageLevelGroupName(baseName, group.level), selectedByLevel.get(group.level) || '');
    });
  }

  function getDamageLevelSelections(baseName) {
    return DAMAGE_LEVEL_GROUPS
      .map((group) => getRadioValue(damageLevelGroupName(baseName, group.level)))
      .filter(Boolean);
  }

  function computeLevelFromItems(items) {
    let level = 0;
    (Array.isArray(items) ? items : []).forEach((item) => {
      const found = resolveDamageLevelOption(item);
      if (found && found.level > level) level = found.level;
    });
    return level;
  }

  function updateLevelDisplays() {
    const businessLevel = computeLevelFromItems(getDamageLevelSelections('businessDamageLevel'));
    const serviceLevel = computeLevelFromItems(getDamageLevelSelections('serviceDamageLevel'));
    const finalLevel = Math.max(businessLevel, serviceLevel, 0);
    if ($('businessLevelDisplay')) $('businessLevelDisplay').textContent = businessLevel ? `第${businessLevel}级` : '未计算';
    if ($('serviceLevelDisplay')) $('serviceLevelDisplay').textContent = serviceLevel ? `第${serviceLevel}级` : '未计算';
    if ($('finalLevelDisplay')) $('finalLevelDisplay').textContent = finalLevel ? `第${finalLevel}级` : '未计算';
  }

  function syncConditionalFields() {
    const serviceScope = getRadioValue('serviceScopeCode');
    show('crossProvinceWrap', serviceScope === '11');
    show('crossCityWrap', serviceScope === '21');
    show('serviceScopeOtherWrap', serviceScope === '99');
    show('serviceTargetOtherWrap', getRadioValue('serviceTargetCode') === '其他');
    show('technologyTypesWrap', getCheckedValues('objectTypes').includes('信息系统'));
    show('technologyOtherWrap', getCheckedValues('technologyTypes').includes('其他'));
    show('businessOtherWrap', getCheckedValues('businessTypes').includes('其他'));
    show('coverageOtherWrap', getRadioValue('coverageCode') === '9');
    show('networkNatureOtherWrap', getRadioValue('networkNatureCode') === '9');
    show('internetFieldsWrap', getRadioValue('networkNatureCode') === '2');
    show('interconnectionOtherWrap', getCheckedValues('interconnectionItems').includes('其他'));
    show('parentSystemWrap', getRadioValue('isSubSystem') === 'true');
    show('parentOrgWrap', getRadioValue('isSubSystem') === 'true');
    show('orgAffiliationOtherWrap', getRadioValue('orgAffiliationCode') === '9');
    show('orgTypeOtherWrap', getRadioValue('orgTypeCode') === '9');
    show('orgIndustryOtherWrap', getValue('orgIndustryCode') === '99');
    show('gradingReportUploadWrap', getRadioValue('gradingReportStatus') === 'has');
    show('expertReviewUploadWrap', getRadioValue('expertReviewStatus') === 'reviewed');
    show('supervisorNameWrap', getRadioValue('hasSupervisor') === 'true');
    show('supervisorReviewWrap', getRadioValue('hasSupervisor') === 'true');
    show('supervisorReviewUploadWrap', getRadioValue('hasSupervisor') === 'true' && getRadioValue('supervisorReviewStatus') === 'reviewed');
    show('cloudServiceModeOtherWrap', getCheckedValues('cloudServiceModes').includes('其他'));
    show('cloudDeploymentOtherWrap', getCheckedValues('cloudDeploymentModes').includes('其他'));
    show('iotPerceptionOtherWrap', getCheckedValues('iotPerceptionLayers').includes('其他'));
    show('iotTransportOtherWrap', getCheckedValues('iotTransportLayers').includes('其他'));
    show('industrialComponentOtherWrap', getCheckedValues('industrialComponents').includes('其他'));
    show('cloudSceneDetailWrap', getRadioValue('cloudEnabled') === 'true');
    show('mobileSceneDetailWrap', getRadioValue('mobileEnabled') === 'true');
    show('iotSceneDetailWrap', getRadioValue('iotEnabled') === 'true');
    show('industrialSceneDetailWrap', getRadioValue('industrialEnabled') === 'true');
    show('bigDataSceneDetailWrap', getRadioValue('bigDataEnabled') === 'true');
    const cloudRoles = getCheckedValues('cloudResponsibilityTypes');
    show('cloudProviderSectionWrap', cloudRoles.includes('云服务商'));
    show('cloudCustomerSectionWrap', cloudRoles.includes('云服务客户'));
    const bigDataComponents = getCheckedValues('bigDataComponents');
    show('bigDataPlatformWrap', bigDataComponents.includes('大数据平台'));
    show('bigDataConsumerWrap', bigDataComponents.includes('大数据应用') || bigDataComponents.includes('大数据资源'));
    MATERIAL_SLOTS.forEach(([key]) => {
      show(`table5Upload_${key}`, getRadioValue(`table5_status_${key}`) === 'has');
    });
    syncTable6ConditionalFields();
  }

  function syncTable6ConditionalFields() {
    document.querySelectorAll('.data-item-card').forEach((card) => {
      const personalInfoChecks = Array.from(card.querySelectorAll('[data-array-field="personal_info_flags"]'));
      const personalInfoValues = personalInfoChecks.filter((field) => field.checked).map((field) => field.value);
      if (personalInfoValues.includes('不涉及')) {
        personalInfoChecks.forEach((field) => {
          field.checked = field.value === '不涉及';
        });
      }
      const hasOtherDataSource = Array.from(card.querySelectorAll('[data-array-field="data_sources"]:checked')).some((field) => field.value === '其他');
      card.querySelectorAll('[data-source-other-wrap]').forEach((element) => {
        element.hidden = !hasOtherDataSource;
      });
      const interactionChecks = Array.from(card.querySelectorAll('[data-array-field="interaction_types"]'));
      let interactionValues = interactionChecks.filter((field) => field.checked).map((field) => field.value);
      if (interactionValues.includes('4')) {
        interactionChecks.forEach((field) => {
          field.checked = field.value === '4';
        });
        interactionValues = ['4'];
      }
      card.querySelectorAll('[data-interaction-provide-wrap]').forEach((element) => {
        element.hidden = !interactionValues.includes('1');
      });
      card.querySelectorAll('[data-interaction-entrust-wrap]').forEach((element) => {
        element.hidden = !interactionValues.includes('2');
      });
      card.querySelectorAll('[data-interaction-share-wrap]').forEach((element) => {
        element.hidden = !interactionValues.includes('3');
      });
      const storageCloudType = card.querySelector('[data-radio-field="storage_cloud_type"]:checked')?.value || '';
      const storageRoomType = card.querySelector('[data-radio-field="storage_room_type"]:checked')?.value || '';
      const storageRegionType = card.querySelector('[data-radio-field="storage_region_type"]:checked')?.value || '';
      card.querySelectorAll('[data-storage-cloud-wrap]').forEach((element) => {
        element.hidden = !storageCloudType;
      });
      card.querySelectorAll('[data-storage-room-wrap]').forEach((element) => {
        element.hidden = !storageRoomType;
      });
      card.querySelectorAll('[data-storage-region-wrap]').forEach((element) => {
        element.hidden = !storageRegionType;
      });
      const dataTotalUnit = card.querySelector('[data-radio-field="data_total_unit"]:checked')?.value || '';
      card.querySelectorAll('[data-qty-input-gb]').forEach((el) => { el.hidden = dataTotalUnit !== 'gb'; });
      card.querySelectorAll('[data-qty-input-tb]').forEach((el) => { el.hidden = dataTotalUnit !== 'tb'; });
      const monthlyGrowthUnit = card.querySelector('[data-radio-field="monthly_growth_unit"]:checked')?.value || '';
      card.querySelectorAll('[data-qty-input-growth-gb]').forEach((el) => { el.hidden = monthlyGrowthUnit !== 'gb'; });
      card.querySelectorAll('[data-qty-input-growth-tb]').forEach((el) => { el.hidden = monthlyGrowthUnit !== 'tb'; });
    });
  }

  function renderTable6Items(items) {
    $('table6Items').innerHTML = ensureDataItems(items).map((item, index) => dataItemCard(item, index)).join('');
    syncTable6ConditionalFields();
  }

  function renderAttachmentList(elementId, attachments) {
    const el = $(elementId);
    if (!el) return;
    const items = Array.isArray(attachments) ? attachments : [];
    el.innerHTML = items.length
      ? items.map((item) => `<a href="/api/attachment-files/${item.id}/download" target="_blank">${esc(item.file_name || `附件${item.id}`)}</a>`).join('')
      : '<span class="table-meta">未上传</span>';
    const statusEl = $(`${elementId}Status`);
    if (statusEl) statusEl.textContent = items.length ? `已上传 ${items.length} 个文件` : '暂未上传';
  }

  function draftStorageKey(systemId) {
    return `filing_workspace_draft_${Number(systemId) || 0}`;
  }

  function readDraft(systemId) {
    const raw = localStorage.getItem(draftStorageKey(systemId));
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch (_error) {
      localStorage.removeItem(draftStorageKey(systemId));
      return null;
    }
  }

  function clearDraft(systemId) {
    localStorage.removeItem(draftStorageKey(systemId));
  }

  function saveDraftSnapshot() {
    if (!state.currentSystemId || !state.detail || state.draftSuspend) return;
    const payload = buildSavePayload();
    localStorage.setItem(draftStorageKey(state.currentSystemId), JSON.stringify({
      saved_at: new Date().toISOString(),
      payload,
    }));
  }

  function queueDraftSave() {
    if (!isDetailPage() || !state.currentSystemId || !state.detail || state.draftSuspend) return;
    window.clearTimeout(state.draftTimer);
    state.draftTimer = window.setTimeout(saveDraftSnapshot, 300);
  }

  async function restoreDraftIfNeeded(detail) {
    if (!state.currentSystemId || state.draftRestoreDone) return detail;
    state.draftRestoreDone = true;
    const draft = readDraft(state.currentSystemId);
    if (!draft || !draft.payload) return detail;
    const ok = await window.appDialog.confirm(
      `检测到本机草稿，保存时间：${formatDateTime(draft.saved_at)}。是否恢复？`,
      '恢复草稿',
      '恢复草稿',
      '忽略'
    );
    if (!ok) return detail;
    const payload = draft.payload;
    return {
      organization: {
        ...(detail.organization || {}),
        ...(payload.organization || {}),
        filing_detail: (payload.organization || {}).filing_detail || (detail.organization || {}).filing_detail || {},
      },
      system: {
        ...(detail.system || {}),
        ...(payload.system || {}),
        filing_detail: (payload.system || {}).filing_detail || (detail.system || {}).filing_detail || {},
      },
    };
  }

  function fillWorkspace(detail) {
    state.draftSuspend = true;
    state.detail = detail;
    const org = detail.organization || {};
    const system = detail.system || {};
    const table1 = (org.filing_detail || {}).table1 || {};
    const table2 = (system.filing_detail || {}).table2 || {};
    const table3 = (system.filing_detail || {}).table3 || {};
    const table4 = (system.filing_detail || {}).table4 || {};
    const table5 = (system.filing_detail || {}).table5 || {};
    const table6 = (system.filing_detail || {}).table6 || {};
    const address = table1.address_parts || {};
    const leader = table1.responsible_person || {};
    const affiliation = table1.affiliation || {};
    const orgType = table1.organization_type_detail || {};
    const industry = table1.industry_category || {};

    if ($('workspaceDetailPanel')) $('workspaceDetailPanel').hidden = false;
    if ($('workspaceDetailHead')) {
      $('workspaceDetailHead').innerHTML = `
        <div class="workspace-detail-summary">
          <div><span>单位</span><strong>${esc(org.name || '-')}</strong></div>
          <div><span>系统</span><strong>${esc(system.system_name || '-')}</strong></div>
          <div><span>当前等级</span><strong>${levelBadge(system.proposed_level)}</strong></div>
          <div><span>状态</span><strong>${statusBadge(Boolean(system.archived))}</strong></div>
        </div>
      `;
    }
    if ($('workspaceDetailHint')) $('workspaceDetailHint').textContent = `${org.name || '-'} / ${system.system_name || '-'} 正在编辑`;

    setValue('orgName', org.name);
    setValue('orgCreditCode', org.credit_code);
    setValue('orgFilingRegion', org.filing_region);
    setValue('unitInternetAddresses', table1.unit_internet_addresses || '无');
    setValue('orgProvince', findProvinceEntry(address.province));
    setValue('orgCity', address.city);
    setValue('orgDistrict', address.district);
    setValue('orgDetailAddress', address.detail);
    setValue('orgPostalCode', table1.postal_code);
    setValue('orgDistrictCode', table1.district_code);
    setRadioValue('orgAffiliationCode', affiliation.code);
    setValue('orgAffiliationOther', affiliation.other);
    setRadioValue('orgTypeCode', orgType.code);
    setValue('orgTypeOther', orgType.other);
    setValue('orgIndustryCode', industry.code);
    setValue('orgIndustryOther', industry.other);
    setValue('orgLeaderName', leader.name || org.legal_representative);
    setValue('orgLeaderTitle', leader.title);
    setValue('orgLeaderPhone', leader.office_phone || org.office_phone);
    setValue('orgLeaderEmail', leader.email || org.email);
    setValue('cyberDept', org.cybersecurity_dept);
    setValue('cyberOwnerName', org.cybersecurity_owner_name);
    setValue('cyberOwnerTitle', org.cybersecurity_owner_title);
    setValue('cyberOwnerPhone', org.cybersecurity_owner_phone);
    setValue('cyberOwnerMobile', org.mobile_phone);
    setValue('cyberOwnerEmail', org.cybersecurity_owner_email);
    setValue('dataDept', org.data_security_dept);
    setValue('dataOwnerName', org.data_security_owner_name);
    setValue('dataOwnerTitle', org.data_security_owner_title);
    setValue('dataOwnerPhone', org.data_security_owner_phone);
    setValue('dataOwnerMobile', org.mobile_phone);
    setValue('dataOwnerEmail', org.data_security_owner_email);
    setValue('currentCountTotal', (table1.current_filing_counts || {}).total || 0);
    ['2', '3', '4', '5'].forEach((key) => setValue(`currentCount${key}`, (table1.current_filing_counts || {})[key] || 0));
    setValue('totalCountTotal', (table1.total_filing_counts || {}).total || 0);
    ['1', '2', '3', '4', '5'].forEach((key) => setValue(`totalCount${key}`, (table1.total_filing_counts || {})[key] || 0));

    setValue('systemName', system.system_name);
    setRadioValue('systemRunningStatus', table2.running_status || '');
    setValue('systemGoLiveDate', table2.go_live_date);
    setCheckedValues('objectTypes', table2.object_types);
    setCheckedValues('technologyTypes', table2.technology_types);
    setValue('technologyOther', table2.technology_other);
    setCheckedValues('businessTypes', table2.business_types);
    setValue('businessOther', table2.business_other);
    setValue('businessDescription', table2.business_description || system.business_description);
    setRadioValue('serviceScopeCode', (table2.network_service || {}).scope_code);
    setValue('crossProvinceCount', (table2.network_service || {}).cross_province_count);
    setValue('crossCityCount', (table2.network_service || {}).cross_city_count);
    setValue('serviceScopeOther', (table2.network_service || {}).other);
    setRadioValue('serviceTargetCode', ((table2.network_service || {}).service_targets || [])[0] || '');
    setValue('serviceTargetOther', (table2.network_service || {}).service_target_other);
    setRadioValue('coverageCode', ((table2.network_platform || {}).coverage || {}).code);
    setValue('coverageOther', ((table2.network_platform || {}).coverage || {}).other);
    setRadioValue('networkNatureCode', ((table2.network_platform || {}).network_nature || {}).code);
    setValue('networkNatureOther', ((table2.network_platform || {}).network_nature || {}).other);
    setValue('sourceIpRange', ((table2.network_platform || {}).network_nature || {}).source_ip_range);
    setValue('sourceDomain', ((table2.network_platform || {}).network_nature || {}).domain);
    setValue('sourceProtocolPorts', ((table2.network_platform || {}).network_nature || {}).protocol_ports);
    setCheckedValues('interconnectionItems', ((table2.network_platform || {}).interconnection || {}).items);
    setValue('interconnectionOther', ((table2.network_platform || {}).interconnection || {}).other);
    setRadioValue('isSubSystem', table2.is_sub_system ? 'true' : 'false');
    setValue('parentSystemName', table2.parent_system_name);
    setValue('parentOrganizationName', table2.parent_organization_name);

    setDamageLevelSelections('businessDamageLevel', (table3.business_security_damage_items || []).map(normalizeDamageLevelSelection));
    setDamageLevelSelections('serviceDamageLevel', (table3.service_security_damage_items || []).map(normalizeDamageLevelSelection));
    setValue('gradingDate', table3.grading_date);
    setValue('fillerName', table3.filler_name);
    setValue('filledDate', table3.filled_date);
    setRadioValue('hasSupervisor', table3.has_supervisor ? 'true' : 'false');
    setValue('supervisorName', table3.supervisor_name);
    setRadioValue('gradingReportStatus', (table3.grading_report || {}).has_file ? 'has' : 'none');
    setRadioValue('expertReviewStatus', (table3.expert_review || {}).status || 'unreviewed');
    setRadioValue('supervisorReviewStatus', (table3.supervisor_review || {}).status || 'unreviewed');
    renderAttachmentList('attachmentTable3GradingReport', (table3.grading_report || {}).attachments);
    renderAttachmentList('attachmentTable3ExpertReview', (table3.expert_review || {}).attachments);
    renderAttachmentList('attachmentTable3SupervisorReview', (table3.supervisor_review || {}).attachments);

    setRadioValue('cloudEnabled', table4.cloud && table4.cloud.enabled ? 'true' : 'false');
    setCheckedValues('cloudResponsibilityTypes', (table4.cloud || {}).responsibility_types);
    setCheckedValues('cloudServiceModes', (table4.cloud || {}).service_modes);
    setValue('cloudServiceModeOther', (table4.cloud || {}).service_mode_other);
    setCheckedValues('cloudDeploymentModes', (table4.cloud || {}).deployment_modes);
    setValue('cloudDeploymentOther', (table4.cloud || {}).deployment_mode_other);
    setValue('cloudCustomerCount', (table4.cloud || {}).customer_count);
    setValue('cloudInfraLocation', (table4.cloud || {}).infra_location);
    setValue('cloudOpsLocation', (table4.cloud || {}).ops_location);
    setValue('cloudCustomerOpsLocation', (table4.cloud || {}).customer_ops_location);
    setValue('cloudProviderName', (table4.cloud || {}).provider_name);
    setValue('cloudProviderLevel', (table4.cloud || {}).provider_level);
    setValue('cloudProviderPlatformName', (table4.cloud || {}).provider_platform_name);
    setValue('cloudProviderRecordNo', (table4.cloud || {}).provider_record_no);
    renderAttachmentList('attachmentTable4Cloud', (table4.cloud || {}).attachments);
    setRadioValue('mobileEnabled', table4.mobile && table4.mobile.enabled ? 'true' : 'false');
    setValue('mobileAppName', (table4.mobile || {}).app_name);
    setCheckedValues('mobileWirelessChannels', (table4.mobile || {}).wireless_channels);
    setCheckedValues('mobileTerminalTypes', (table4.mobile || {}).terminal_types);
    setRadioValue('iotEnabled', table4.iot && table4.iot.enabled ? 'true' : 'false');
    setCheckedValues('iotPerceptionLayers', (table4.iot || {}).perception_layers);
    setValue('iotPerceptionOther', (table4.iot || {}).perception_other);
    setCheckedValues('iotTransportLayers', (table4.iot || {}).transport_layers);
    setValue('iotTransportOther', (table4.iot || {}).transport_other);
    setRadioValue('industrialEnabled', table4.industrial_control && table4.industrial_control.enabled ? 'true' : 'false');
    setCheckedValues('industrialFunctionLayers', (table4.industrial_control || {}).function_layers);
    setCheckedValues('industrialComponents', (table4.industrial_control || {}).components);
    setValue('industrialComponentOther', (table4.industrial_control || {}).component_other);
    setRadioValue('bigDataEnabled', table4.big_data && table4.big_data.enabled ? 'true' : 'false');
    setCheckedValues('bigDataComponents', (table4.big_data || {}).system_components);
    setRadioValue('bigDataCrossBorderStatus', (table4.big_data || {}).cross_border_status);
    setValue('bigDataApplicationCount', (table4.big_data || {}).application_count);
    setValue('bigDataInfraLocation', (table4.big_data || {}).infra_location);
    setValue('bigDataOpsLocation', (table4.big_data || {}).ops_location);
    setValue('bigDataProviderName', (table4.big_data || {}).provider_name);
    setValue('bigDataProviderLevel', (table4.big_data || {}).provider_level);
    setValue('bigDataProviderPlatformName', (table4.big_data || {}).provider_platform_name);
    setValue('bigDataProviderRecordNo', (table4.big_data || {}).provider_record_no);
    renderAttachmentList('attachmentTable4BigData', (table4.big_data || {}).attachments);

    MATERIAL_SLOTS.forEach(([key]) => {
      const slotData = table5[key] || {};
      const hasFile = slotData.status === 'has' || Boolean(slotData.file_name || (slotData.attachments || []).length || (slotData.attachment_ids || []).length);
      setRadioValue(`table5_status_${key}`, hasFile ? 'has' : 'none');
      renderAttachmentList(`attachment_${key}`, slotData.attachments);
    });

    renderTable6Items(table6.items);
    syncAddressPicker(true);
    updateLevelDisplays();
    syncConditionalFields();
    state.draftSuspend = false;
  }

  function collectTable6Items() {
    return Array.from(document.querySelectorAll('.data-item-card')).map((card) => {
      const item = {};
      card.querySelectorAll('[data-field]').forEach((field) => {
        item[field.dataset.field] = String(field.value || '').trim();
      });
      card.querySelectorAll('[data-radio-field]:checked').forEach((field) => {
        item[field.dataset.radioField] = String(field.value || '').trim();
      });
      const arrays = {};
      card.querySelectorAll('[data-array-field]:checked').forEach((field) => {
        const key = field.dataset.arrayField;
        arrays[key] = arrays[key] || [];
        arrays[key].push(field.value);
      });
      Object.assign(item, arrays);
      if (!Array.isArray(item.personal_info_flags)) item.personal_info_flags = [];
      if (item.personal_info_flags.includes('不涉及')) item.personal_info_flags = ['不涉及'];
      if (!Array.isArray(item.data_sources)) item.data_sources = [];
      if (!item.data_sources.includes('其他')) item.data_source_other = '';
      if (!Array.isArray(item.interaction_types)) item.interaction_types = [];
      if (item.interaction_types.includes('4')) item.interaction_types = ['4'];
      if (!item.interaction_types.includes('1')) item.interaction_provide_to = '';
      if (!item.interaction_types.includes('2')) item.interaction_entrust_to = '';
      if (!item.interaction_types.includes('3')) item.interaction_shared_with = '';
      if (!item.storage_cloud_type) item.storage_cloud_name = '';
      if (!item.storage_room_type) item.storage_room_name = '';
      if (!item.storage_region_type) item.storage_region_name = '';
      item.data_level = selectedLabel(DATA_LEVEL_OPTIONS, item.data_level_code);
      return item;
    });
  }

  function attachmentRefs(slot, fileNameKey = 'file_name') {
    const safe = { attachment_ids: Array.isArray(slot && slot.attachment_ids) ? slot.attachment_ids : [] };
    if (fileNameKey) safe[fileNameKey] = String((slot && slot[fileNameKey]) || '').trim();
    return safe;
  }

  function buildSavePayload() {
    const orgIndustryCode = getValue('orgIndustryCode');
    const orgTypeCode = getRadioValue('orgTypeCode');
    const affiliationCode = getRadioValue('orgAffiliationCode');
    const businessDamageItems = getDamageLevelSelections('businessDamageLevel');
    const serviceDamageItems = getDamageLevelSelections('serviceDamageLevel');
    const objectTypes = getCheckedValues('objectTypes');
    const technologyTypes = objectTypes.includes('信息系统') ? getCheckedValues('technologyTypes') : [];
    const businessTypes = getCheckedValues('businessTypes');
    const serviceScopeCode = getRadioValue('serviceScopeCode');
    const serviceTargetCode = getRadioValue('serviceTargetCode');
    const coverageCode = getRadioValue('coverageCode');
    const networkNatureCode = getRadioValue('networkNatureCode');
    const isSubSystem = getRadioValue('isSubSystem') === 'true';
    const gradingReportStatus = getRadioValue('gradingReportStatus');
    const expertReviewStatus = getRadioValue('expertReviewStatus') || 'unreviewed';
    const hasSupervisor = getRadioValue('hasSupervisor') === 'true';
    const supervisorReviewStatus = hasSupervisor ? (getRadioValue('supervisorReviewStatus') || 'unreviewed') : 'unreviewed';
    const cloudEnabled = getRadioValue('cloudEnabled') === 'true';
    const cloudResponsibilityTypes = cloudEnabled ? getCheckedValues('cloudResponsibilityTypes') : [];
    const cloudServiceModes = cloudEnabled ? getCheckedValues('cloudServiceModes') : [];
    const cloudDeploymentModes = cloudEnabled ? getCheckedValues('cloudDeploymentModes') : [];
    const cloudIsProvider = cloudResponsibilityTypes.includes('云服务商');
    const cloudIsCustomer = cloudResponsibilityTypes.includes('云服务客户');
    const mobileEnabled = getRadioValue('mobileEnabled') === 'true';
    const iotEnabled = getRadioValue('iotEnabled') === 'true';
    const industrialEnabled = getRadioValue('industrialEnabled') === 'true';
    const bigDataEnabled = getRadioValue('bigDataEnabled') === 'true';
    const bigDataComponents = bigDataEnabled ? getCheckedValues('bigDataComponents') : [];
    const bigDataHasPlatform = bigDataComponents.includes('大数据平台');
    const bigDataHasConsumer = bigDataComponents.includes('大数据应用') || bigDataComponents.includes('大数据资源');
    const businessLevel = computeLevelFromItems(businessDamageItems);
    const serviceLevel = computeLevelFromItems(serviceDamageItems);
    const finalLevel = Math.max(businessLevel, serviceLevel, 0);
    const baseOrgDetail = ((state.detail || {}).organization || {}).filing_detail || {};
    const baseSystemDetail = ((state.detail || {}).system || {}).filing_detail || {};
    const prevTable3 = baseSystemDetail.table3 || {};
    const prevTable4 = baseSystemDetail.table4 || {};
    const prevTable5 = baseSystemDetail.table5 || {};

    return {
      organization: {
        id: state.detail.organization.id,
        name: getValue('orgName'),
        credit_code: getValue('orgCreditCode'),
        address: `${getValue('orgProvince')}${getValue('orgCity')}${getValue('orgDistrict')}${getValue('orgDetailAddress')}`,
        mobile_phone: getValue('cyberOwnerMobile') || getValue('dataOwnerMobile'),
        office_phone: getValue('orgLeaderPhone'),
        email: getValue('orgLeaderEmail'),
        industry: selectedLabel(INDUSTRY_OPTIONS, orgIndustryCode) || getValue('orgIndustryOther'),
        organization_type: selectedLabel(ORG_TYPE_OPTIONS, orgTypeCode) || getValue('orgTypeOther'),
        cybersecurity_dept: getValue('cyberDept'),
        cybersecurity_owner_name: getValue('cyberOwnerName'),
        cybersecurity_owner_title: getValue('cyberOwnerTitle'),
        cybersecurity_owner_phone: getValue('cyberOwnerPhone'),
        cybersecurity_owner_email: getValue('cyberOwnerEmail'),
        data_security_dept: getValue('dataDept'),
        data_security_owner_name: getValue('dataOwnerName'),
        data_security_owner_title: getValue('dataOwnerTitle'),
        data_security_owner_phone: getValue('dataOwnerPhone'),
        data_security_owner_email: getValue('dataOwnerEmail'),
        filing_region: getValue('orgFilingRegion'),
        filing_detail: {
          ...baseOrgDetail,
          table1: {
            ...baseOrgDetail.table1,
            address_parts: { province: getValue('orgProvince'), city: getValue('orgCity'), district: getValue('orgDistrict'), detail: getValue('orgDetailAddress') },
            postal_code: getValue('orgPostalCode'),
            district_code: getValue('orgDistrictCode'),
            unit_internet_addresses: getValue('unitInternetAddresses') || '无',
            responsible_person: { name: getValue('orgLeaderName'), title: getValue('orgLeaderTitle'), office_phone: getValue('orgLeaderPhone'), email: getValue('orgLeaderEmail') },
            affiliation: { code: affiliationCode, label: selectedLabel(AFFILIATION_OPTIONS, affiliationCode), other: getValue('orgAffiliationOther') },
            organization_type_detail: { code: orgTypeCode, label: selectedLabel(ORG_TYPE_OPTIONS, orgTypeCode), other: getValue('orgTypeOther') },
            industry_category: { code: orgIndustryCode, label: selectedLabel(INDUSTRY_OPTIONS, orgIndustryCode), other: getValue('orgIndustryOther') },
            current_filing_counts: { total: numberValue('currentCountTotal'), '2': numberValue('currentCount2'), '3': numberValue('currentCount3'), '4': numberValue('currentCount4'), '5': numberValue('currentCount5') },
            total_filing_counts: { total: numberValue('totalCountTotal'), '1': numberValue('totalCount1'), '2': numberValue('totalCount2'), '3': numberValue('totalCount3'), '4': numberValue('totalCount4'), '5': numberValue('totalCount5') },
          },
        },
      },
      system: {
        id: state.detail.system.id,
        system_name: getValue('systemName'),
        level_basis: state.detail.system.level_basis || '',
        business_description: getValue('businessDescription'),
        filing_detail: {
          ...baseSystemDetail,
          table2: {
            ...baseSystemDetail.table2,
            running_status: getRadioValue('systemRunningStatus'),
            object_types: objectTypes,
            technology_types: technologyTypes,
            technology_other: technologyTypes.includes('其他') ? getValue('technologyOther') : '',
            business_types: businessTypes,
            business_other: businessTypes.includes('其他') ? getValue('businessOther') : '',
            business_description: getValue('businessDescription'),
            network_service: {
              scope_code: serviceScopeCode,
              scope_label: selectedLabel(SERVICE_SCOPE_OPTIONS, serviceScopeCode),
              cross_province_count: serviceScopeCode === '11' ? getValue('crossProvinceCount') : '',
              cross_city_count: serviceScopeCode === '21' ? getValue('crossCityCount') : '',
              other: serviceScopeCode === '99' ? getValue('serviceScopeOther') : '',
              service_targets: [serviceTargetCode].filter(Boolean),
              service_target_other: serviceTargetCode === '其他' ? getValue('serviceTargetOther') : '',
            },
            network_platform: {
              coverage: {
                code: coverageCode,
                label: selectedLabel(COVERAGE_OPTIONS, coverageCode),
                other: coverageCode === '9' ? getValue('coverageOther') : '',
              },
              network_nature: {
                code: networkNatureCode,
                label: selectedLabel(NETWORK_NATURE_OPTIONS, networkNatureCode),
                other: networkNatureCode === '9' ? getValue('networkNatureOther') : '',
                source_ip_range: networkNatureCode === '2' ? getValue('sourceIpRange') : '',
                domain: networkNatureCode === '2' ? getValue('sourceDomain') : '',
                protocol_ports: networkNatureCode === '2' ? getValue('sourceProtocolPorts') : '',
              },
              interconnection: { items: getCheckedValues('interconnectionItems'), other: getValue('interconnectionOther') },
            },
            go_live_date: getValue('systemGoLiveDate'),
            is_sub_system: isSubSystem,
            parent_system_name: isSubSystem ? getValue('parentSystemName') : '',
            parent_organization_name: isSubSystem ? getValue('parentOrganizationName') : '',
          },
          table3: {
            ...prevTable3,
            business_security_damage_items: businessDamageItems,
            business_security_level: businessLevel,
            service_security_damage_items: serviceDamageItems,
            service_security_level: serviceLevel,
            final_level: finalLevel,
            grading_date: getValue('gradingDate'),
            grading_report: gradingReportStatus === 'has'
              ? { ...attachmentRefs(prevTable3.grading_report), has_file: true }
              : { ...attachmentRefs({}, 'file_name'), has_file: false },
            expert_review: expertReviewStatus === 'reviewed'
              ? { ...attachmentRefs(prevTable3.expert_review), status: 'reviewed' }
              : { ...attachmentRefs({}, 'file_name'), status: 'unreviewed' },
            has_supervisor: hasSupervisor,
            supervisor_name: hasSupervisor ? getValue('supervisorName') : '',
            supervisor_review: supervisorReviewStatus === 'reviewed'
              ? { ...attachmentRefs(prevTable3.supervisor_review), status: 'reviewed' }
              : { ...attachmentRefs({}, 'file_name'), status: 'unreviewed' },
            filler_name: getValue('fillerName'),
            filled_date: getValue('filledDate'),
          },
          table4: {
            ...prevTable4,
            cloud: {
              ...attachmentRefs(cloudEnabled && cloudIsCustomer ? prevTable4.cloud : {}, 'record_file_name'),
              enabled: cloudEnabled,
              responsibility_types: cloudResponsibilityTypes,
              service_modes: cloudServiceModes,
              service_mode_other: cloudServiceModes.includes('其他') ? getValue('cloudServiceModeOther') : '',
              deployment_modes: cloudDeploymentModes,
              deployment_mode_other: cloudDeploymentModes.includes('其他') ? getValue('cloudDeploymentOther') : '',
              customer_count: cloudEnabled && cloudIsProvider ? getValue('cloudCustomerCount') : '',
              infra_location: cloudEnabled && cloudIsProvider ? getValue('cloudInfraLocation') : '',
              ops_location: cloudEnabled && cloudIsProvider ? getValue('cloudOpsLocation') : '',
              provider_name: cloudEnabled && cloudIsCustomer ? getValue('cloudProviderName') : '',
              provider_level: cloudEnabled && cloudIsCustomer ? getValue('cloudProviderLevel') : '',
              provider_platform_name: cloudEnabled && cloudIsCustomer ? getValue('cloudProviderPlatformName') : '',
              provider_record_no: cloudEnabled && cloudIsCustomer ? getValue('cloudProviderRecordNo') : '',
              customer_ops_location: cloudEnabled && cloudIsCustomer ? getValue('cloudCustomerOpsLocation') : '',
            },
            mobile: {
              ...(prevTable4.mobile || {}),
              enabled: mobileEnabled,
              app_name: mobileEnabled ? getValue('mobileAppName') : '',
              wireless_channels: mobileEnabled ? getCheckedValues('mobileWirelessChannels') : [],
              terminal_types: mobileEnabled ? getCheckedValues('mobileTerminalTypes') : [],
            },
            iot: {
              ...(prevTable4.iot || {}),
              enabled: iotEnabled,
              perception_layers: iotEnabled ? getCheckedValues('iotPerceptionLayers') : [],
              perception_other: iotEnabled && getCheckedValues('iotPerceptionLayers').includes('其他') ? getValue('iotPerceptionOther') : '',
              transport_layers: iotEnabled ? getCheckedValues('iotTransportLayers') : [],
              transport_other: iotEnabled && getCheckedValues('iotTransportLayers').includes('其他') ? getValue('iotTransportOther') : '',
            },
            industrial_control: {
              ...(prevTable4.industrial_control || {}),
              enabled: industrialEnabled,
              function_layers: industrialEnabled ? getCheckedValues('industrialFunctionLayers') : [],
              components: industrialEnabled ? getCheckedValues('industrialComponents') : [],
              component_other: industrialEnabled && getCheckedValues('industrialComponents').includes('其他') ? getValue('industrialComponentOther') : '',
            },
            big_data: {
              ...attachmentRefs(bigDataEnabled && bigDataHasConsumer ? prevTable4.big_data : {}, 'record_file_name'),
              enabled: bigDataEnabled,
              system_components: bigDataComponents,
              cross_border_status: bigDataEnabled ? getRadioValue('bigDataCrossBorderStatus') : '',
              application_count: bigDataEnabled && bigDataHasPlatform ? getValue('bigDataApplicationCount') : '',
              infra_location: bigDataEnabled && bigDataHasPlatform ? getValue('bigDataInfraLocation') : '',
              ops_location: bigDataEnabled && bigDataHasPlatform ? getValue('bigDataOpsLocation') : '',
              provider_name: bigDataEnabled && bigDataHasConsumer ? getValue('bigDataProviderName') : '',
              provider_level: bigDataEnabled && bigDataHasConsumer ? getValue('bigDataProviderLevel') : '',
              provider_platform_name: bigDataEnabled && bigDataHasConsumer ? getValue('bigDataProviderPlatformName') : '',
              provider_record_no: bigDataEnabled && bigDataHasConsumer ? getValue('bigDataProviderRecordNo') : '',
            },
          },
          table5: MATERIAL_SLOTS.reduce((acc, [key]) => {
            const prevSlot = prevTable5[key] || {};
            const radioStatus = getRadioValue(`table5_status_${key}`);
            const isHas = radioStatus === 'has';
            acc[key] = { ...attachmentRefs(isHas ? prevSlot : {}), status: isHas ? 'has' : 'none' };
            return acc;
          }, {}),
          table6: { items: collectTable6Items() },
        },
      },
    };
  }

  async function loadOverview() {
    if (!$('workspaceList')) return;
    state.includeArchived = Boolean($('workspaceIncludeArchived')?.checked);
    const keyword = getValue('workspaceKeyword');
    const params = new URLSearchParams();
    if (keyword) params.set('keyword', keyword);
    if (state.includeArchived) params.set('include_archived', 'true');
    const res = await fetch(`/api/filing-workspace/overview?${params.toString()}`, { headers: authHeaders() });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      $('workspaceList').innerHTML = '<div class="empty-hint" style="display:block;padding:32px 0;">列表加载失败</div>';
      setListResult(apiErrorText(data));
      return;
    }
    state.overview = data.items || [];
    renderOverview();
  }

  function focusOrganizationBySystemId(systemId) {
    const targetId = Number(systemId) || 0;
    if (!targetId) return false;
    const target = state.overview.find((item) => (item.systems || []).some((system) => Number(system.id) === targetId));
    if (!target || !target.organization) return false;
    state.openOrgIds.clear();
    state.openOrgIds.add(target.organization.id);
    renderOverview();
    return true;
  }

  function renderOverview() {
    if (!$('workspaceList')) return;
    if (!state.overview.length) {
      $('workspaceList').innerHTML = '<div class="workspace-empty">暂无备案对象，可先新建单位。</div>';
      return;
    }
    $('workspaceList').innerHTML = state.overview.map((item) => {
      const org = item.organization || {};
      const open = state.openOrgIds.has(org.id);
      const systems = item.systems || [];
      return `
        <article class="org-card ${open ? 'is-open' : ''}">
          <button class="org-card-head" data-toggle-org="${org.id}">
            <div class="org-card-main"><strong>${esc(org.name || '-')}</strong><span>${esc(org.credit_code || '-')}</span></div>
            <div class="org-card-meta">
              ${statusBadge(Boolean(org.archived))}
              <span class="mini-badge">${systems.length} 个系统</span>
              <span class="org-card-chevron" aria-hidden="true"><i class="fas fa-chevron-${open ? 'up' : 'down'}"></i></span>
            </div>
          </button>
          <div class="org-card-actions">
            <button class="btn-lite btn-sm" data-create-system="${org.id}"><i class="fas fa-plus"></i> 新增系统</button>
            <button class="btn-lite btn-sm" data-archive-org="${org.id}"><i class="fas fa-box-archive"></i> 归档</button>
            <button class="btn-lite btn-sm btn-danger" data-delete-org="${org.id}"><i class="fas fa-trash"></i> 删除申请</button>
          </div>
          <div class="org-card-body" ${open ? '' : 'hidden'}>
            ${(systems.length ? systems : [{}]).map((system) => system.id ? `
              <div class="system-row ${state.currentSystemId === system.id ? 'is-active' : ''}">
                <div class="system-main"><strong>${esc(system.system_name || '-')}</strong><span>${esc(system.system_code || '未编号')} · ${levelBadge(system.proposed_level)}</span></div>
                <div class="system-actions">
                  <button class="btn-lite btn-sm" data-open-system="${system.id}"><i class="fas fa-arrow-up-right-from-square"></i> 完善信息</button>
                  <button class="btn-lite btn-sm" data-export-system="${system.id}">导出 Word</button>
                  <button class="btn-lite btn-sm" data-archive-system="${system.id}">归档</button>
                  <button class="btn-lite btn-sm btn-danger" data-delete-system="${system.id}">删除申请</button>
                </div>
              </div>
            ` : '<div class="system-row-empty">暂无系统，请先新增系统。</div>').join('')}
          </div>
        </article>
      `;
    }).join('');
  }

  async function loadSystemDetail(systemId) {
    const res = await fetch(`/api/filing-workspace/systems/${systemId}`, { headers: authHeaders() });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setDetailResult(`加载失败：${apiErrorText(data)}`);
      return;
    }
    state.currentSystemId = systemId;
    fillWorkspace(await restoreDraftIfNeeded(data));
    renderOverview();
  }

  async function createOrganization() {
    const submitBtn = $('createOrgBtn');
    if (submitBtn.disabled) return;
    const payload = {
      name: getValue('createOrgName'),
      credit_code: getValue('createOrgCreditCode').toUpperCase(),
      filing_region: getValue('createOrgRegion'),
      industry: selectedLabel(INDUSTRY_OPTIONS, getValue('createOrgIndustry')),
      organization_type: selectedLabel(ORG_TYPE_OPTIONS, getValue('createOrgType')),
      legal_representative: getValue('createOrgLegalRepresentative'),
      address: '/',
      mobile_phone: '13800138000',
      email: 'placeholder@example.com',
      created_by: actorName(),
    };
    submitBtn.disabled = true;
    setCreateModalResult('正在保存单位...');
    const res = await fetch('/api/organizations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify(payload),
    });
    const data = await res.json().catch(() => ({}));
    submitBtn.disabled = false;
    if (!res.ok) {
      const detail = apiErrorText(data);
      if (res.status === 409) {
        if (detail.includes('回收站')) {
          setCreateModalResult(`${detail} 请先恢复或清理后再新建。`);
        } else if (detail.includes('统一社会信用代码已存在')) {
          const found = focusOrganizationByCreditCode(payload.credit_code);
          setCreateModalResult(found ? '该统一社会信用代码对应的单位已存在，已帮你展开到列表中。' : '该统一社会信用代码对应的单位已存在，请直接使用已有单位。');
        } else {
          setCreateModalResult(detail);
        }
      } else {
        setCreateModalResult(detail);
      }
      setListResult(`新建单位失败：${apiErrorText(data)}`);
      return;
    }
    state.createOrgId = data.data.id;
    setListResult(`单位已创建：${payload.name}`);
    setCreateModalResult(`单位已创建：${payload.name}`);
    state.openOrgIds.clear();
    state.openOrgIds.add(state.createOrgId);
    closeCreateModal();
    await loadOverview();
  }

  async function createSystem() {
    const submitBtn = $('createSystemBtn');
    if (submitBtn.disabled) return;
    if (!state.createOrgId) {
      setCreateModalResult('请先从单位列表选择“新增系统”，或先保存一个单位。');
      setListResult('请先从单位列表点击“新增系统”，或先保存一个单位。');
      return;
    }
    const payload = {
      organization_id: state.createOrgId,
      system_name: getValue('createSystemName'),
      proposed_level: Number(getValue('createSystemLevel') || 3),
      system_type: getValue('createSystemType'),
      deployment_mode: getValue('createSystemDeployment'),
      created_by: actorName(),
    };
    submitBtn.disabled = true;
    setCreateModalResult('正在保存系统...');
    const res = await fetch('/api/systems', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify(payload),
    });
    const data = await res.json().catch(() => ({}));
    submitBtn.disabled = false;
    if (!res.ok) {
      setCreateModalResult(apiErrorText(data));
      setListResult(`新增系统失败：${apiErrorText(data)}`);
      return;
    }
    setListResult(`系统已创建：${payload.system_name}`);
    setCreateModalResult(`系统已创建：${payload.system_name}`);
    closeCreateModal();
    window.location.href = `/organizations/systems/${data.data.id}`;
  }

  async function saveWorkspace() {
    if (!state.currentSystemId) return;
    const res = await fetch(`/api/filing-workspace/systems/${state.currentSystemId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify(buildSavePayload()),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setDetailResult(`保存失败：${apiErrorText(data)}`);
      return;
    }
    fillWorkspace(data.data);
    clearDraft(state.currentSystemId);
    setDetailResult('备案信息已保存。', { popup: true });
    await loadOverview();
  }

  async function uploadSlot(slotKey, inputId) {
    if (!state.currentSystemId) {
      setDetailResult('请先选择系统。');
      return;
    }
    const input = $(inputId);
    const file = input && input.files ? input.files[0] : null;
    if (!file) {
      setDetailResult('请先选择附件。');
      return;
    }

    const statusEl = $(`${(input.closest('.upload-inline-field')?.querySelector('.attachment-list') || {}).id || ''}Status`);
    if (statusEl) statusEl.textContent = `上传中 0% · ${file.name}`;
    const fd = new FormData();
    fd.append('file', file);
    let responseData;
    try {
      responseData = await new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open('POST', `/api/filing-workspace/systems/${state.currentSystemId}/attachments/${slotKey}`);
        Object.entries(authHeaders()).forEach(([key, value]) => xhr.setRequestHeader(key, value));
        xhr.upload.addEventListener('progress', (event) => {
          if (!statusEl) return;
          if (!event.lengthComputable) {
            statusEl.textContent = `上传中 · ${file.name}`;
            return;
          }
          const percent = Math.min(100, Math.round((event.loaded / event.total) * 100));
          statusEl.textContent = `上传中 ${percent}% · ${file.name}`;
        });
        xhr.addEventListener('load', () => {
          let data = {};
          try {
            data = JSON.parse(xhr.responseText || '{}');
          } catch (_error) {
            data = {};
          }
          if (xhr.status >= 200 && xhr.status < 300) {
            resolve(data);
            return;
          }
          reject({ status: xhr.status, data });
        });
        xhr.addEventListener('error', () => reject({ status: 0, data: { detail: '网络异常，上传失败。' } }));
        xhr.send(fd);
      });
    } catch (error) {
      const message = apiErrorText((error && error.data) || {});
      if (statusEl) statusEl.textContent = `上传失败 · ${file.name}`;
      setDetailResult(`附件上传失败：${message}`);
      return;
    }

    // Only update attachment info locally, do NOT overwrite the entire form
    const serverDetail = responseData.data || {};
    const serverSystem = serverDetail.system || {};
    const serverFiling = serverSystem.filing_detail || {};

    // Update state.detail with new attachment data only
    if (state.detail) {
      const parts = slotKey.split('.');
      if (parts[0] === 'table5' && parts[1]) {
        const t5 = (state.detail.system || {}).filing_detail || {};
        if (!t5.table5) t5.table5 = {};
        t5.table5[parts[1]] = (serverFiling.table5 || {})[parts[1]] || t5.table5[parts[1]];
        const listId = `attachment_${parts[1]}`;
        renderAttachmentList(listId, ((serverFiling.table5 || {})[parts[1]] || {}).attachments);
      } else if (parts[0] === 'table3' && parts[1]) {
        const t3 = ((state.detail.system || {}).filing_detail || {}).table3 || {};
        if (serverFiling.table3 && serverFiling.table3[parts[1]]) {
          t3[parts[1]] = { ...t3[parts[1]], ...serverFiling.table3[parts[1]] };
        }
        renderAttachmentList(`attachmentTable3${parts[1].replace(/(^|_)(\w)/g, (_, _p, c) => c.toUpperCase())}`, ((serverFiling.table3 || {})[parts[1]] || {}).attachments);
      } else if (parts[0] === 'table4' && parts[1]) {
        const t4 = ((state.detail.system || {}).filing_detail || {}).table4 || {};
        if (serverFiling.table4 && serverFiling.table4[parts[1]]) {
          t4[parts[1]] = { ...t4[parts[1]], ...serverFiling.table4[parts[1]] };
        }
        renderAttachmentList(`attachmentTable4${parts[1].replace(/(^|_)(\w)/g, (_, _p, c) => c.toUpperCase())}`, ((serverFiling.table4 || {})[parts[1]] || {}).attachments);
      }
    }

    input.value = '';
    saveDraftSnapshot();
    if (statusEl) statusEl.textContent = `上传完成 · ${file.name}`;
    setDetailResult('附件上传成功。', { popup: false });
  }

  async function archiveEntity(type, id) {
    const res = await fetch(`/api/${type}/${id}/archive?actor=${encodeURIComponent(actorName())}`, { method: 'POST', headers: authHeaders() });
    const data = await res.json().catch(() => ({}));
    setListResult(res.ok ? '归档完成。' : `归档失败：${apiErrorText(data)}`);
    await loadOverview();
  }

  async function requestDelete(type, id) {
    const reason = await window.appDialog.prompt('请输入删除原因，可留空。', '', {
      title: '提交删除申请',
      label: '删除原因',
      placeholder: '例如：重复数据、录入错误',
      confirmText: '提交申请',
    });
    if (reason === null) return;
    const res = await fetch(`/api/${type}/${id}/delete-request?actor=${encodeURIComponent(actorName())}&reason=${encodeURIComponent(reason)}`, { method: 'POST', headers: authHeaders() });
    const data = await res.json().catch(() => ({}));
    setListResult(res.ok ? '删除申请已提交。' : `删除申请失败：${apiErrorText(data)}`);
    refreshAttentionIfAvailable();
    await Promise.all([loadOrgDeleteRequests(), loadSystemDeleteRequests()]);
  }

  async function reviewDeleteRequest(id, action, entityType) {
    let comment = '';
    if (action === 'reject') {
      comment = await window.appDialog.prompt('请输入驳回原因。', '', {
        title: '驳回删除申请',
        label: '驳回原因',
        placeholder: '请填写驳回原因',
        confirmText: '确认驳回',
      });
      if (comment === null) return;
    }
    const res = await fetch(`/api/delete-requests/${id}/review?action=${action}&actor=${encodeURIComponent(actorName())}&comment=${encodeURIComponent(comment || '')}`, { method: 'POST', headers: authHeaders() });
    const data = await res.json().catch(() => ({}));
    setListResult(res.ok ? '删除申请审核完成。' : `审核失败：${apiErrorText(data)}`);
    refreshAttentionIfAvailable();
    await Promise.all([
      entityType === 'organization' ? loadOrgDeleteRequests() : loadSystemDeleteRequests(),
      loadOverview(),
      entityType === 'organization' ? loadRecycleOrgs() : loadRecycleSystems(),
    ]);
  }

  async function restoreEntity(type, id) {
    const res = await fetch(`/api/${type}/${id}/restore?actor=${encodeURIComponent(actorName())}`, { method: 'POST', headers: authHeaders() });
    const data = await res.json().catch(() => ({}));
    setListResult(res.ok ? '恢复成功。' : `恢复失败：${apiErrorText(data)}`);
    refreshAttentionIfAvailable();
    await Promise.all([loadOverview(), type === 'organizations' ? loadRecycleOrgs() : loadRecycleSystems()]);
  }

  async function cleanupRecycleOrgs() {
    const ok = await window.appDialog.confirm('仅会清理超过 30 天且无关联系统的单位。是否继续？', '清理单位回收站', '开始清理');
    if (!ok) return;
    const res = await fetch(`/api/organizations/recycle-bin/cleanup?actor=${encodeURIComponent(actorName())}`, { method: 'POST', headers: authHeaders() });
    const data = await res.json().catch(() => ({}));
    setListResult(res.ok ? `单位回收站已清理 ${data.purged || 0} 条。` : `清理失败：${apiErrorText(data)}`);
    refreshAttentionIfAvailable();
    await loadRecycleOrgs();
  }

  async function cleanupRecycleSystems() {
    const ok = await window.appDialog.confirm('仅会清理超过 30 天且无关联报告的系统。是否继续？', '清理系统回收站', '开始清理');
    if (!ok) return;
    const res = await fetch(`/api/systems/recycle-bin/cleanup?actor=${encodeURIComponent(actorName())}`, { method: 'POST', headers: authHeaders() });
    const data = await res.json().catch(() => ({}));
    setListResult(res.ok ? `系统回收站已清理 ${data.purged || 0} 条。` : `清理失败：${apiErrorText(data)}`);
    refreshAttentionIfAvailable();
    await loadRecycleSystems();
  }

  async function purgeEntity(type, id) {
    const isOrg = type === 'organizations';
    const entityLabel = isOrg ? '单位' : '系统';
    const tip = isOrg
      ? '将永久删除该单位，以及其回收站内关联系统、报告、流程、附件和历史记录。此操作不可恢复。'
      : '将永久删除该系统，以及其关联报告、流程、附件和历史记录。此操作不可恢复。';
    const ok = await window.appDialog.confirm(tip, `永久删除${entityLabel}`, '永久删除');
    if (!ok) return;
    const res = await fetch(`/api/${type}/${id}/purge?actor=${encodeURIComponent(actorName())}`, { method: 'POST', headers: authHeaders() });
    const data = await res.json().catch(() => ({}));
    setListResult(res.ok ? `${entityLabel}已永久删除。` : `永久删除失败：${apiErrorText(data)}`);
    refreshAttentionIfAvailable();
    await Promise.all([loadOverview(), loadOrgDeleteRequests(), loadSystemDeleteRequests(), loadRecycleOrgs(), loadRecycleSystems()]);
  }

  async function loadOrgDeleteRequests() {
    if (!$('orgDeleteReqTable')) return;
    const res = await fetch('/api/delete-requests?entity_type=organization', { headers: authHeaders() });
    const data = await res.json().catch(() => ({}));
    const items = res.ok ? (data.items || []) : [];
    $('orgDeleteReqTable').innerHTML = items.length
      ? items.map((item) => `<tr><td>${esc(item.id)}</td><td>${esc(item.entity_id)}</td><td><div class="table-meta"><strong>申请人：</strong>${esc(item.requested_by || '-')}<br><span>提交：${formatDateTime(item.requested_at)}</span></div></td><td>${reqStatusBadge(item.status)}</td><td>${window.requestReviewMeta(item)}</td><td>${esc(item.reason || '-')}</td><td>${item.status === 'pending' ? `<div class="table-action-group"><button class="btn-lite btn-sm" data-review-delete-request="${item.id}" data-review-action="approve" data-entity-type="organization">通过</button><button class="btn-lite btn-sm btn-danger" data-review-delete-request="${item.id}" data-review-action="reject" data-entity-type="organization">驳回</button></div>` : '<span class="table-meta">已处理</span>'}</td></tr>`).join('')
      : '<tr><td colspan="7">暂无数据</td></tr>';
  }

  async function loadSystemDeleteRequests() {
    if (!$('sysDeleteReqTable')) return;
    const res = await fetch('/api/delete-requests?entity_type=system', { headers: authHeaders() });
    const data = await res.json().catch(() => ({}));
    const items = res.ok ? (data.items || []) : [];
    $('sysDeleteReqTable').innerHTML = items.length
      ? items.map((item) => `<tr><td>${esc(item.id)}</td><td>${esc(item.entity_id)}</td><td><div class="table-meta"><strong>申请人：</strong>${esc(item.requested_by || '-')}<br><span>提交：${formatDateTime(item.requested_at)}</span></div></td><td>${reqStatusBadge(item.status)}</td><td>${window.requestReviewMeta(item)}</td><td>${esc(item.reason || '-')}</td><td>${item.status === 'pending' ? `<div class="table-action-group"><button class="btn-lite btn-sm" data-review-delete-request="${item.id}" data-review-action="approve" data-entity-type="system">通过</button><button class="btn-lite btn-sm btn-danger" data-review-delete-request="${item.id}" data-review-action="reject" data-entity-type="system">驳回</button></div>` : '<span class="table-meta">已处理</span>'}</td></tr>`).join('')
      : '<tr><td colspan="7">暂无数据</td></tr>';
  }

  async function loadRecycleOrgs() {
    if (!$('orgRecycleTable')) return;
    const res = await fetch('/api/organizations/recycle-bin/list', { headers: authHeaders() });
    const data = await res.json().catch(() => ({}));
    const items = res.ok ? (data.items || []) : [];
    $('orgRecycleTable').innerHTML = items.length
      ? items.map((item) => `<tr><td>${esc(item.id)}</td><td>${esc(item.name)}</td><td>${esc(item.deleted_by || '-')}</td><td>${formatDateTime(item.deleted_at)}</td><td>${esc(item.days_left || 0)} 天</td><td><div class="table-action-group"><button class="btn-lite btn-sm" data-restore-org="${item.id}">恢复</button><button class="btn-danger btn-sm" data-purge-org="${item.id}">永久删除</button></div></td></tr>`).join('')
      : '<tr><td colspan="6">暂无数据</td></tr>';
  }

  async function loadRecycleSystems() {
    if (!$('sysRecycleTable')) return;
    const res = await fetch('/api/systems/recycle-bin/list', { headers: authHeaders() });
    const data = await res.json().catch(() => ({}));
    const items = res.ok ? (data.items || []) : [];
    $('sysRecycleTable').innerHTML = items.length
      ? items.map((item) => `<tr><td>${esc(item.id)}</td><td>${esc(item.system_name)}</td><td>${esc(item.deleted_by || '-')}</td><td>${formatDateTime(item.deleted_at)}</td><td>${esc(item.days_left || 0)} 天</td><td><div class="table-action-group"><button class="btn-lite btn-sm" data-restore-system="${item.id}">恢复</button><button class="btn-danger btn-sm" data-purge-system="${item.id}">永久删除</button></div></td></tr>`).join('')
      : '<tr><td colspan="6">暂无数据</td></tr>';
  }

  function bindEvents() {
    if ($('workspaceReloadBtn')) $('workspaceReloadBtn').addEventListener('click', loadOverview);
    if ($('workspaceKeyword')) $('workspaceKeyword').addEventListener('keydown', (event) => { if (event.key === 'Enter') loadOverview(); });
    if ($('workspaceIncludeArchived')) $('workspaceIncludeArchived').addEventListener('change', loadOverview);
    if ($('workspaceToggleCreateBtn')) $('workspaceToggleCreateBtn').addEventListener('click', () => openCreateModal('organization'));
    if ($('workspaceCreateModalClose')) $('workspaceCreateModalClose').addEventListener('click', closeCreateModal);
    if ($('workspaceCreateOrgCancel')) $('workspaceCreateOrgCancel').addEventListener('click', closeCreateModal);
    if ($('workspaceCreateSystemCancel')) $('workspaceCreateSystemCancel').addEventListener('click', closeCreateModal);
    if ($('workspaceCreateModal')) {
      $('workspaceCreateModal').addEventListener('click', (event) => {
        if (event.target === $('workspaceCreateModal')) closeCreateModal();
      });
    }
    if ($('createOrgBtn')) $('createOrgBtn').addEventListener('click', createOrganization);
    if ($('createSystemBtn')) $('createSystemBtn').addEventListener('click', createSystem);
    if ($('copyCyberToDataBtn')) $('copyCyberToDataBtn').addEventListener('click', copyCyberDeptToDataDept);
    if ($('workspaceSaveBtn')) $('workspaceSaveBtn').addEventListener('click', saveWorkspace);
    if ($('workspaceExportBtn')) $('workspaceExportBtn').addEventListener('click', () => { if (state.currentSystemId) window.location.href = `/api/systems/${state.currentSystemId}/export/word`; });
    if ($('addDataItemBtn')) $('addDataItemBtn').addEventListener('click', () => {
      renderTable6Items([...collectTable6Items(), {}]);
      queueDraftSave();
    });
    if ($('loadOrgDeleteRequestsBtn')) $('loadOrgDeleteRequestsBtn').addEventListener('click', loadOrgDeleteRequests);
    if ($('loadSystemDeleteRequestsBtn')) $('loadSystemDeleteRequestsBtn').addEventListener('click', loadSystemDeleteRequests);
    if ($('loadRecycleOrgsBtn')) $('loadRecycleOrgsBtn').addEventListener('click', loadRecycleOrgs);
    if ($('cleanupRecycleOrgsBtn')) $('cleanupRecycleOrgsBtn').addEventListener('click', cleanupRecycleOrgs);
    if ($('loadRecycleSystemsBtn')) $('loadRecycleSystemsBtn').addEventListener('click', loadRecycleSystems);
    if ($('cleanupRecycleSystemsBtn')) $('cleanupRecycleSystemsBtn').addEventListener('click', cleanupRecycleSystems);
    document.querySelectorAll('[data-maintenance-tab]').forEach((btn) => {
      btn.addEventListener('click', () => switchMaintenanceTab(btn.dataset.maintenanceTab));
    });

    if (isDetailPage()) {
      document.addEventListener('change', (event) => {
        if (event.target.matches('input[type="checkbox"], input[type="radio"], select')) {
          syncConditionalFields();
          updateLevelDisplays();
          queueDraftSave();
        }
        if (event.target.matches('#orgProvince, #orgCity, #orgDistrict')) {
          syncAddressPicker(false);
        }
        if (event.target.matches('input[type="file"][data-auto-upload-slot]')) {
          uploadSlot(event.target.dataset.autoUploadSlot, event.target.id);
        }
      });
      document.addEventListener('input', (event) => {
        if (event.target.matches('input:not([type="file"]), textarea, select')) {
          queueDraftSave();
        }
      });
    }

    document.addEventListener('click', async (event) => {
      const btn = event.target.closest('button');
      if (!btn) return;
      if (btn.dataset.toggleOrg) {
        const orgId = Number(btn.dataset.toggleOrg);
        if (state.openOrgIds.has(orgId)) {
          state.openOrgIds.delete(orgId);
        } else {
          state.openOrgIds.clear();
          state.openOrgIds.add(orgId);
        }
        renderOverview();
      } else if (btn.dataset.createSystem) {
        state.createOrgId = Number(btn.dataset.createSystem);
        const org = state.overview.find((item) => item.organization.id === state.createOrgId);
        openCreateModal('system', org ? org.organization : null);
      } else if (btn.dataset.openSystem) {
        window.location.href = `/organizations/systems/${btn.dataset.openSystem}`;
      } else if (btn.dataset.exportSystem) {
        window.location.href = `/api/systems/${btn.dataset.exportSystem}/export/word`;
      } else if (btn.dataset.archiveOrg) {
        await archiveEntity('organizations', Number(btn.dataset.archiveOrg));
      } else if (btn.dataset.archiveSystem) {
        await archiveEntity('systems', Number(btn.dataset.archiveSystem));
      } else if (btn.dataset.deleteOrg) {
        await requestDelete('organizations', Number(btn.dataset.deleteOrg));
      } else if (btn.dataset.deleteSystem) {
        await requestDelete('systems', Number(btn.dataset.deleteSystem));
      } else if (btn.dataset.uploadSlot) {
        await uploadSlot(btn.dataset.uploadSlot, btn.dataset.uploadInput);
      } else if (btn.dataset.removeDataIndex !== undefined) {
        const items = collectTable6Items().filter((_, index) => index !== Number(btn.dataset.removeDataIndex));
        renderTable6Items(items.length ? items : [{}]);
        queueDraftSave();
      } else if (btn.dataset.reviewDeleteRequest) {
        await reviewDeleteRequest(Number(btn.dataset.reviewDeleteRequest), btn.dataset.reviewAction, btn.dataset.entityType);
      } else if (btn.dataset.restoreOrg) {
        await restoreEntity('organizations', Number(btn.dataset.restoreOrg));
      } else if (btn.dataset.restoreSystem) {
        await restoreEntity('systems', Number(btn.dataset.restoreSystem));
      } else if (btn.dataset.purgeOrg) {
        await purgeEntity('organizations', Number(btn.dataset.purgeOrg));
      } else if (btn.dataset.purgeSystem) {
        await purgeEntity('systems', Number(btn.dataset.purgeSystem));
      }
    });
  }

  async function init() {
    renderShell();
    bindEvents();
    if (isDetailPage()) {
      const systemId = initialSystemId();
      if (!systemId) {
        setDetailResult('缺少系统ID，无法加载备案信息。');
        return;
      }
      await loadSystemDetail(systemId);
      syncConditionalFields();
      updateLevelDisplays();
      return;
    }

    const requestedAttentionTab = initialAttentionTab();
    const activeAttentionTab = requestedAttentionTab || 'org-requests';
    switchMaintenanceTab(activeAttentionTab);
    await Promise.all([loadOverview(), loadOrgDeleteRequests(), loadSystemDeleteRequests(), loadRecycleOrgs(), loadRecycleSystems()]);
    const focusSystemId = Number(new URLSearchParams(window.location.search).get('focus_system') || 0);
    if (focusSystemId) focusOrganizationBySystemId(focusSystemId);
    if (requestedAttentionTab) {
      document.getElementById('workspaceMaintenanceSection')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

  init();
})();
