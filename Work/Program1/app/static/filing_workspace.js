(function () {
  const state = {
    overview: [],
    openOrgIds: new Set(),
    currentSystemId: null,
    detail: null,
    includeArchived: false,
    createMode: false,
    createOrgId: null,
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
    { label: '仅对公民、法人和其他组织的合法权益造成一般损害', level: 1 },
    { label: '对公民、法人和其他组织的合法权益造成严重损害 / 对公民、法人和其他组织的合法权益造成特别严重损害 / 对社会秩序和公共利益造成一般损害', level: 2 },
    { label: '对社会秩序和公共利益造成严重损害', level: 3 },
    { label: '对社会秩序和公共利益造成特别严重损害 / 对国家安全或地区安全、国计民生造成一般损害', level: 4 },
    { label: '对国家安全或地区安全、国计民生造成严重损害 / 对国家安全或地区安全、国计民生造成特别严重损害', level: 5 },
  ];
  const CLOUD_RESPONSIBILITY_OPTIONS = [['云服务商', '云服务商'], ['云服务客户', '云服务客户']];
  const CLOUD_SERVICE_MODE_OPTIONS = [['基础设施即服务IaaS', '基础设施即服务IaaS'], ['平台即服务PaaS', '平台即服务PaaS'], ['软件即服务SaaS', '软件即服务SaaS'], ['其他', '其他']];
  const CLOUD_DEPLOYMENT_OPTIONS = [['私有云', '私有云'], ['公有云', '公有云'], ['混合云', '混合云'], ['政务云', '政务云'], ['其他', '其他']];
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

  const $ = (id) => document.getElementById(id);

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

  function setListResult(text) {
    $('workspaceListResult').textContent = text;
  }

  function setDetailResult(text) {
    $('workspaceDetailResult').textContent = text;
  }

  function setCreateModalResult(text) {
    const el = $('workspaceCreateModalResult');
    if (el) el.textContent = text;
  }

  function boolSelect(id, trueLabel, falseLabel) {
    return `<select id="${id}"><option value="false">${falseLabel}</option><option value="true">${trueLabel}</option></select>`;
  }

  function optionsHtml(items) {
    return items.map(([code, label]) => `<option value="${esc(code)}">${esc(label)}</option>`).join('');
  }

  function checkboxGroupHtml(name, items) {
    return `<div class="choice-grid">${items.map(([value, label]) => `<label class="choice-chip"><input type="checkbox" name="${name}" value="${esc(value)}"><span>${esc(label)}</span></label>`).join('')}</div>`;
  }

  function radioGroupHtml(name, items) {
    return `<div class="choice-grid compact-check-grid">${items.map(([value, label]) => `<label class="choice-chip"><input type="radio" name="${name}" value="${esc(value)}"><span>${esc(label)}</span></label>`).join('')}</div>`;
  }

  function sectionBlock(title, hint, body, extraClass) {
    return `<details class="workspace-collapsible ${extraClass || ''}" open><summary><span>${esc(title)}</span><small>${esc(hint || '')}</small></summary><div class="workspace-collapsible-body">${body}</div></details>`;
  }

  function renderShell() {
    $('createOrgIndustry').innerHTML = `<option value="">请选择</option>${optionsHtml(INDUSTRY_OPTIONS)}`;
    $('createOrgType').innerHTML = `<option value="">请选择</option>${optionsHtml(ORG_TYPE_OPTIONS)}`;

    $('workspaceTable1').innerHTML = renderTable1();
    $('workspaceTable2').innerHTML = renderTable2();
    $('workspaceTable3').innerHTML = renderTable3();
    $('workspaceTable4').innerHTML = renderTable4();
    $('workspaceTable5').innerHTML = renderTable5();
    $('workspaceTable6').innerHTML = renderTable6();
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
      <div class="form-grid form-grid-4">
        <div><label>单位名称</label><input id="orgName"></div>
        <div><label>统一社会信用代码</label><input id="orgCreditCode"></div>
        <div><label>备案地区</label><input id="orgFilingRegion"></div>
        <div><label>单位使用互联网地址</label><input id="unitInternetAddresses" placeholder="没有请填写无"></div>
        <div><label>省(自治区、直辖市)</label><input id="orgProvince"></div>
        <div><label>地(区、市、州、盟)</label><input id="orgCity"></div>
        <div><label>县(区、市、旗)</label><input id="orgDistrict"></div>
        <div><label>详细地址</label><input id="orgDetailAddress"></div>
        <div><label>邮政编码</label><input id="orgPostalCode"></div>
        <div><label>行政区划代码</label><input id="orgDistrictCode"></div>
        <div><label>隶属关系</label><select id="orgAffiliationCode"><option value="">请选择</option>${optionsHtml(AFFILIATION_OPTIONS)}</select></div>
        <div id="orgAffiliationOtherWrap" hidden><label>隶属关系-其他</label><input id="orgAffiliationOther"></div>
        <div><label>单位类型</label><select id="orgTypeCode"><option value="">请选择</option>${optionsHtml(ORG_TYPE_OPTIONS)}</select></div>
        <div id="orgTypeOtherWrap" hidden><label>单位类型-其他</label><input id="orgTypeOther"></div>
        <div><label>行业类别</label><select id="orgIndustryCode"><option value="">请选择</option>${optionsHtml(INDUSTRY_OPTIONS)}</select></div>
        <div id="orgIndustryOtherWrap" hidden><label>行业类别-其他</label><input id="orgIndustryOther"></div>
      </div>

      <div class="workspace-subsection">
        <h3>单位负责人</h3>
        <div class="form-grid form-grid-4">
          <div><label>姓名</label><input id="orgLeaderName"></div>
          <div><label>职务/职称</label><input id="orgLeaderTitle"></div>
          <div><label>办公电话</label><input id="orgLeaderPhone"></div>
          <div><label>电子邮件</label><input id="orgLeaderEmail"></div>
        </div>
      </div>

      <div class="workspace-subsection">
        <h3>网络安全责任部门</h3>
        <div class="form-grid form-grid-5">
          <div><label>责任部门</label><input id="cyberDept"></div>
          <div><label>联系人姓名</label><input id="cyberOwnerName"></div>
          <div><label>职务/职称</label><input id="cyberOwnerTitle"></div>
          <div><label>办公电话</label><input id="cyberOwnerPhone"></div>
          <div><label>移动电话</label><input id="cyberOwnerMobile"></div>
          <div class="grid-span-full"><label>电子邮件</label><input id="cyberOwnerEmail"></div>
        </div>
      </div>

      <div class="workspace-subsection">
        <h3>数据安全管理部门</h3>
        <div class="form-grid form-grid-5">
          <div><label>管理部门</label><input id="dataDept"></div>
          <div><label>联系人姓名</label><input id="dataOwnerName"></div>
          <div><label>职务/职称</label><input id="dataOwnerTitle"></div>
          <div><label>办公电话</label><input id="dataOwnerPhone"></div>
          <div><label>移动电话</label><input id="dataOwnerMobile"></div>
          <div class="grid-span-full"><label>电子邮件</label><input id="dataOwnerEmail"></div>
        </div>
      </div>

      <div class="workspace-subsection">
        <h3>备案数量</h3>
        <div class="count-grid">
          <div><label>本次备案二级</label><input id="currentCount2" type="number" min="0" value="0"></div>
          <div><label>本次备案三级</label><input id="currentCount3" type="number" min="0" value="0"></div>
          <div><label>本次备案四级</label><input id="currentCount4" type="number" min="0" value="0"></div>
          <div><label>本次备案五级</label><input id="currentCount5" type="number" min="0" value="0"></div>
          <div><label>总数一级</label><input id="totalCount1" type="number" min="0" value="0"></div>
          <div><label>总数二级</label><input id="totalCount2" type="number" min="0" value="0"></div>
          <div><label>总数三级</label><input id="totalCount3" type="number" min="0" value="0"></div>
          <div><label>总数四级</label><input id="totalCount4" type="number" min="0" value="0"></div>
          <div><label>总数五级</label><input id="totalCount5" type="number" min="0" value="0"></div>
        </div>
      </div>
    `);
  }

  function renderTable2() {
    return sectionBlock('表二 定级对象情况', '表二不展示“定级对象编号”', `
      <div class="form-grid form-grid-4">
        <div><label>系统名称</label><input id="systemName"></div>
        <div><label>系统类型</label><input id="systemType"></div>
        <div><label>部署方式</label><input id="systemDeploymentMode"></div>
        <div><label>投入运行时间</label><input id="systemGoLiveDate" type="date"></div>
      </div>
      <div class="workspace-subsection"><h3>定级对象类型</h3>${checkboxGroupHtml('objectTypes', OBJECT_TYPE_OPTIONS)}</div>
      <div class="workspace-subsection"><h3>采用技术类型</h3>${checkboxGroupHtml('technologyTypes', TECHNOLOGY_OPTIONS)}<div id="technologyOtherWrap" class="inline-field" hidden><label>其他技术</label><input id="technologyOther"></div></div>
      <div class="workspace-subsection"><h3>业务类型</h3>${checkboxGroupHtml('businessTypes', BUSINESS_TYPE_OPTIONS)}<div id="businessOtherWrap" class="inline-field" hidden><label>其他业务类型</label><input id="businessOther"></div><label>业务描述</label><textarea id="businessDescription"></textarea></div>
      <div class="workspace-subsection">
        <h3>05 网络服务情况</h3>
        <div class="form-grid form-grid-4">
          <div><label>服务范围</label><select id="serviceScopeCode"><option value="">请选择</option>${optionsHtml(SERVICE_SCOPE_OPTIONS)}</select></div>
          <div id="crossProvinceWrap" hidden><label>跨省数量</label><input id="crossProvinceCount" type="number" min="0"></div>
          <div id="crossCityWrap" hidden><label>跨地(市、区)数量</label><input id="crossCityCount" type="number" min="0"></div>
          <div id="serviceScopeOtherWrap" hidden><label>服务范围-其他</label><input id="serviceScopeOther"></div>
        </div>
        ${checkboxGroupHtml('serviceTargets', SERVICE_TARGET_OPTIONS)}
        <div id="serviceTargetOtherWrap" class="inline-field" hidden><label>服务对象-其他</label><input id="serviceTargetOther"></div>
      </div>
      <div class="workspace-subsection">
        <h3>06 网络平台</h3>
        <div class="form-grid form-grid-4">
          <div><label>部署范围</label><select id="coverageCode"><option value="">请选择</option>${optionsHtml(COVERAGE_OPTIONS)}</select></div>
          <div id="coverageOtherWrap" hidden><label>部署范围-其他</label><input id="coverageOther"></div>
          <div><label>网络性质</label><select id="networkNatureCode"><option value="">请选择</option>${optionsHtml(NETWORK_NATURE_OPTIONS)}</select></div>
          <div id="networkNatureOtherWrap" hidden><label>网络性质-其他</label><input id="networkNatureOther"></div>
        </div>
        <div class="form-grid form-grid-3" id="internetFieldsWrap" hidden>
          <div><label>源站 IP 地址范围</label><input id="sourceIpRange"></div>
          <div><label>域名</label><input id="sourceDomain"></div>
          <div><label>主要协议/端口</label><input id="sourceProtocolPorts"></div>
        </div>
        <h4>网络互联情况</h4>
        ${checkboxGroupHtml('interconnectionItems', INTERCONNECTION_OPTIONS)}
        <div id="interconnectionOtherWrap" class="inline-field" hidden><label>网络互联-其他</label><input id="interconnectionOther"></div>
      </div>
      <div class="workspace-subsection">
        <h3>分系统情况</h3>
        <div class="form-grid form-grid-4">
          <div><label>是否为分系统</label>${boolSelect('isSubSystem', '是', '否')}</div>
          <div id="parentSystemWrap" hidden><label>上级系统名称</label><input id="parentSystemName"></div>
          <div id="parentOrgWrap" hidden><label>上级系统所属单位名称</label><input id="parentOrganizationName"></div>
          <div><label>定级依据补充</label><input id="systemLevelBasis"></div>
        </div>
      </div>
    `);
  }

  function renderTable3() {
    return sectionBlock('表三 定级情况', '左侧多选，右侧级别自动同步', `
      <div class="level-layout">
        <section class="level-card">
          <h3>业务信息安全保护等级</h3>
          <div id="businessDamageOptions">${checkboxGroupHtml('businessDamageItems', DAMAGE_LEVEL_OPTIONS.map(item => [item.label, item.label]))}</div>
          <div class="level-display">同步级别：<strong id="businessLevelDisplay">未计算</strong></div>
        </section>
        <section class="level-card">
          <h3>系统服务安全保护等级</h3>
          <div id="serviceDamageOptions">${checkboxGroupHtml('serviceDamageItems', DAMAGE_LEVEL_OPTIONS.map(item => [item.label, item.label]))}</div>
          <div class="level-display">同步级别：<strong id="serviceLevelDisplay">未计算</strong></div>
        </section>
      </div>
      <div class="final-level-box">信息系统安全保护等级：<strong id="finalLevelDisplay">未计算</strong></div>
      <div class="form-grid form-grid-4">
        <div><label>定级时间</label><input id="gradingDate" type="date"></div>
        <div><label>填表人</label><input id="fillerName"></div>
        <div><label>填表日期</label><input id="filledDate" type="date"></div>
        <div><label>是否有上级行业主管部门</label>${boolSelect('hasSupervisor', '有', '无')}</div>
        <div id="supervisorNameWrap" hidden><label>上级行业主管部门名称</label><input id="supervisorName"></div>
        <div><label>定级报告</label>${radioGroupHtml('gradingReportStatus', [['has', '有'], ['none', '无']])}</div>
        <div><label>专家评审情况</label>${radioGroupHtml('expertReviewStatus', [['reviewed', '已评审'], ['unreviewed', '未评审']])}</div>
        <div id="supervisorReviewWrap" hidden><label>主管部门审核情况</label>${radioGroupHtml('supervisorReviewStatus', [['reviewed', '已审核'], ['unreviewed', '未审核']])}</div>
      </div>
      <div class="upload-grid">
        <div class="material-slot"><label>定级报告附件</label><input id="uploadTable3GradingReport" type="file" accept=".doc,.docx,.pdf"><button class="btn-lite btn-sm" data-upload-slot="table3.grading_report" data-upload-input="uploadTable3GradingReport">上传</button><div class="attachment-list" id="attachmentTable3GradingReport"></div></div>
        <div class="material-slot" id="expertReviewUploadWrap" hidden><label>专家评审附件</label><input id="uploadTable3ExpertReview" type="file" accept=".doc,.docx,.pdf"><button class="btn-lite btn-sm" data-upload-slot="table3.expert_review" data-upload-input="uploadTable3ExpertReview">上传</button><div class="attachment-list" id="attachmentTable3ExpertReview"></div></div>
        <div class="material-slot" id="supervisorReviewUploadWrap" hidden><label>主管部门审核附件</label><input id="uploadTable3SupervisorReview" type="file" accept=".doc,.docx,.pdf"><button class="btn-lite btn-sm" data-upload-slot="table3.supervisor_review" data-upload-input="uploadTable3SupervisorReview">上传</button><div class="attachment-list" id="attachmentTable3SupervisorReview"></div></div>
      </div>
    `);
  }

  function sceneBlock(key, title, enabledHtml, body) {
    return `<details class="workspace-collapsible workspace-scene" open><summary><span>${esc(title)}</span><small>支持展开/折叠</small></summary><div class="workspace-collapsible-body"><div class="inline-field">${enabledHtml}</div><div id="${key}DetailWrap">${body}</div></div></details>`;
  }

  function renderTable4() {
    return sectionBlock('表四 新技术新应用场景', '按实际采用情况填写，选否时直接隐藏下方字段', `
      ${sceneBlock('cloudScene', '云计算应用场景补充信息', `<label>是否采用云计算技术</label>${boolSelect('cloudEnabled', '是', '否')}`, `
        <div class="workspace-subsection"><h4>责任主体类型</h4>${checkboxGroupHtml('cloudResponsibilityTypes', CLOUD_RESPONSIBILITY_OPTIONS)}</div>
        <div class="workspace-subsection"><h4>云计算服务模式</h4>${checkboxGroupHtml('cloudServiceModes', CLOUD_SERVICE_MODE_OPTIONS)}<div id="cloudServiceModeOtherWrap" class="inline-field" hidden><label>其他服务模式</label><input id="cloudServiceModeOther"></div></div>
        <div class="workspace-subsection"><h4>云计算部署模式</h4>${checkboxGroupHtml('cloudDeploymentModes', CLOUD_DEPLOYMENT_OPTIONS)}<div id="cloudDeploymentOtherWrap" class="inline-field" hidden><label>其他部署模式</label><input id="cloudDeploymentOther"></div></div>
        <div class="form-grid form-grid-4">
          <div><label>云服务客户数量</label><input id="cloudCustomerCount"></div>
          <div><label>云平台基础设施地点</label><input id="cloudInfraLocation"></div>
          <div><label>云平台运维地点</label><input id="cloudOpsLocation"></div>
          <div><label>云服务客户运维地点</label><input id="cloudCustomerOpsLocation"></div>
          <div><label>云服务商</label><input id="cloudProviderName"></div>
          <div><label>平台安全等级</label><input id="cloudProviderLevel"></div>
          <div><label>平台名称</label><input id="cloudProviderPlatformName"></div>
          <div><label>平台备案编号</label><input id="cloudProviderRecordNo"></div>
        </div>
        <div class="material-slot"><label>云平台备案证明</label><input id="uploadTable4Cloud" type="file" accept=".doc,.docx,.pdf"><button class="btn-lite btn-sm" data-upload-slot="table4.cloud" data-upload-input="uploadTable4Cloud">上传</button><div class="attachment-list" id="attachmentTable4Cloud"></div></div>
      `)}
      ${sceneBlock('mobileScene', '移动互联应用场景补充信息', `<label>是否采用移动互联技术</label>${boolSelect('mobileEnabled', '是', '否')}`, `
        <div class="form-grid form-grid-3">
          <div><label>移动应用软件名称/小程序名称</label><input id="mobileAppName"></div>
        </div>
        <div class="workspace-subsection"><h4>无线通道情况</h4>${checkboxGroupHtml('mobileWirelessChannels', MOBILE_CHANNEL_OPTIONS)}</div>
        <div class="workspace-subsection"><h4>移动终端情况</h4>${checkboxGroupHtml('mobileTerminalTypes', MOBILE_TERMINAL_OPTIONS)}</div>
      `)}
      ${sceneBlock('iotScene', '物联网应用场景补充信息', `<label>是否为物联网系统</label>${boolSelect('iotEnabled', '是', '否')}`, `
        <div class="workspace-subsection"><h4>系统感知层</h4>${checkboxGroupHtml('iotPerceptionLayers', IOT_PERCEPTION_OPTIONS)}<div id="iotPerceptionOtherWrap" class="inline-field" hidden><label>感知层-其他</label><input id="iotPerceptionOther"></div></div>
        <div class="workspace-subsection"><h4>系统网络传输层</h4>${checkboxGroupHtml('iotTransportLayers', IOT_TRANSPORT_OPTIONS)}<div id="iotTransportOtherWrap" class="inline-field" hidden><label>传输层-其他</label><input id="iotTransportOther"></div></div>
      `)}
      ${sceneBlock('industrialScene', '工业控制系统应用场景补充信息', `<label>是否为工业控制系统</label>${boolSelect('industrialEnabled', '是', '否')}`, `
        <div class="workspace-subsection"><h4>系统功能层次</h4>${checkboxGroupHtml('industrialFunctionLayers', INDUSTRIAL_LAYER_OPTIONS)}</div>
        <div class="workspace-subsection"><h4>工业控制系统组成</h4>${checkboxGroupHtml('industrialComponents', INDUSTRIAL_COMPONENT_OPTIONS)}<div id="industrialComponentOtherWrap" class="inline-field" hidden><label>系统组成-其他</label><input id="industrialComponentOther"></div></div>
      `)}
      ${sceneBlock('bigDataScene', '大数据应用场景补充信息', `<label>是否采用大数据技术</label>${boolSelect('bigDataEnabled', '是', '否')}`, `
        <div class="workspace-subsection"><h4>大数据系统组成</h4>${checkboxGroupHtml('bigDataComponents', BIG_DATA_COMPONENT_OPTIONS)}</div>
        <div class="form-grid form-grid-4">
          <div><label>大数据出境情况</label><input id="bigDataCrossBorderStatus" placeholder="无出境需求/有出境需求"></div>
          <div><label>大数据应用数量</label><input id="bigDataApplicationCount"></div>
          <div><label>大数据平台基础设施地点</label><input id="bigDataInfraLocation"></div>
          <div><label>大数据平台运维地点</label><input id="bigDataOpsLocation"></div>
          <div><label>平台服务商</label><input id="bigDataProviderName"></div>
          <div><label>平台安全等级</label><input id="bigDataProviderLevel"></div>
          <div><label>平台名称</label><input id="bigDataProviderPlatformName"></div>
          <div><label>平台备案编号</label><input id="bigDataProviderRecordNo"></div>
        </div>
        <div class="material-slot"><label>大数据平台备案证明</label><input id="uploadTable4BigData" type="file" accept=".doc,.docx,.pdf"><button class="btn-lite btn-sm" data-upload-slot="table4.big_data" data-upload-input="uploadTable4BigData">上传</button><div class="attachment-list" id="attachmentTable4BigData"></div></div>
      `)}
    `);
  }

  function renderTable5() {
    return sectionBlock('表五 提交材料情况', '材料状态与附件名称一并维护', `
      <div class="materials-stack">
        ${MATERIAL_SLOTS.map(([key, label]) => `
          <div class="material-slot material-slot-row">
            <div class="material-slot-head"><strong>${esc(label)}</strong></div>
            <div class="material-slot-controls">
              <select id="materialStatus_${key}">
                <option value="none">无</option>
                <option value="has">有</option>
              </select>
              <input id="upload_${key}" type="file" accept=".doc,.docx,.pdf,.jpg,.jpeg,.png,.vsd,.vsdx">
              <button class="btn-lite btn-sm" data-upload-slot="table5.${key}" data-upload-input="upload_${key}">上传</button>
            </div>
            <div class="attachment-list" id="attachment_${key}"></div>
          </div>
        `).join('')}
      </div>
    `);
  }

  function renderTable6() {
    return sectionBlock('表六 数据摸底调查表', '支持添加多条数据项，导出 Word 先取第一条', `
      <div class="panel-actions">
        <button class="btn-lite btn-sm" id="addDataItemBtn"><i class="fas fa-plus"></i> 新增数据项</button>
      </div>
      <div id="table6Items" class="data-item-stack"></div>
    `);
  }

  function dataItemCard(item, index) {
    const value = (key) => esc(item && item[key] ? item[key] : '');
    const checked = (key, target) => Array.isArray(item && item[key]) && item[key].includes(target) ? 'checked' : '';
    return `
      <article class="data-item-card" data-index="${index}">
        <div class="card-head">
          <strong>数据项 ${index + 1}</strong>
          <button type="button" class="btn-lite btn-sm btn-danger" data-remove-data-index="${index}">删除</button>
        </div>
        <div class="form-grid form-grid-4">
          <div><label>数据名称</label><input data-field="data_name" value="${value('data_name')}"></div>
          <div><label>拟定数据级别</label><input data-field="data_level" value="${value('data_level')}" placeholder="一般数据/重要及以上数据"></div>
          <div><label>数据类别</label><input data-field="data_category" value="${value('data_category')}"></div>
          <div><label>数据安全责任部门</label><input data-field="data_security_dept" value="${value('data_security_dept')}"></div>
          <div><label>数据安全负责人</label><input data-field="data_security_owner" value="${value('data_security_owner')}"></div>
          <div><label>数据总量</label><input data-field="data_total" value="${value('data_total')}" placeholder="如：3.35GB / 0.5万条"></div>
          <div><label>数据月增长量</label><input data-field="monthly_growth" value="${value('monthly_growth')}" placeholder="如：0.6GB"></div>
          <div><label>与其他数据处理者的交互情况</label><input data-field="interaction" value="${value('interaction')}"></div>
          <div class="grid-span-full"><label>来源单位</label><textarea data-field="source_units">${value('source_units')}</textarea></div>
          <div class="grid-span-full"><label>流出单位</label><textarea data-field="target_units">${value('target_units')}</textarea></div>
          <div><label>数据存储位置（云平台/名称）</label><input data-field="storage_platform" value="${value('storage_platform')}"></div>
          <div><label>数据存储机房</label><input data-field="storage_machine_room" value="${value('storage_machine_room')}"></div>
          <div><label>数据存储地域</label><input data-field="storage_location" value="${value('storage_location')}"></div>
          <div><label>数据来源-其他</label><input data-field="data_source_other" value="${value('data_source_other')}"></div>
        </div>
        <div class="workspace-subsection"><h4>个人信息涉及情况</h4><div class="choice-grid">${PERSONAL_INFO_OPTIONS.map(([val, label]) => `<label class="choice-chip"><input type="checkbox" data-array-field="personal_info_flags" value="${esc(val)}" ${checked('personal_info_flags', val)}><span>${esc(label)}</span></label>`).join('')}</div></div>
        <div class="workspace-subsection"><h4>数据来源</h4><div class="choice-grid">${DATA_SOURCE_OPTIONS.map(([val, label]) => `<label class="choice-chip"><input type="checkbox" data-array-field="data_sources" value="${esc(val)}" ${checked('data_sources', val)}><span>${esc(label)}</span></label>`).join('')}</div></div>
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

  function computeLevelFromItems(items) {
    let level = 0;
    (Array.isArray(items) ? items : []).forEach((item) => {
      const found = DAMAGE_LEVEL_OPTIONS.find((option) => option.label === item);
      if (found && found.level > level) level = found.level;
    });
    return level;
  }

  function updateLevelDisplays() {
    const businessLevel = computeLevelFromItems(getCheckedValues('businessDamageItems'));
    const serviceLevel = computeLevelFromItems(getCheckedValues('serviceDamageItems'));
    const finalLevel = Math.max(businessLevel, serviceLevel, 0);
    $('businessLevelDisplay').textContent = businessLevel ? `第${businessLevel}级` : '未计算';
    $('serviceLevelDisplay').textContent = serviceLevel ? `第${serviceLevel}级` : '未计算';
    $('finalLevelDisplay').textContent = finalLevel ? `第${finalLevel}级` : '未计算';
  }

  function syncConditionalFields() {
    const serviceScope = getValue('serviceScopeCode');
    show('crossProvinceWrap', serviceScope === '11');
    show('crossCityWrap', serviceScope === '21');
    show('serviceScopeOtherWrap', serviceScope === '99');
    show('serviceTargetOtherWrap', getCheckedValues('serviceTargets').includes('其他'));
    show('technologyOtherWrap', getCheckedValues('technologyTypes').includes('其他'));
    show('businessOtherWrap', getCheckedValues('businessTypes').includes('其他'));
    show('coverageOtherWrap', getValue('coverageCode') === '9');
    show('networkNatureOtherWrap', getValue('networkNatureCode') === '9');
    show('internetFieldsWrap', getValue('networkNatureCode') === '2');
    show('interconnectionOtherWrap', getCheckedValues('interconnectionItems').includes('其他'));
    show('parentSystemWrap', getValue('isSubSystem') === 'true');
    show('parentOrgWrap', getValue('isSubSystem') === 'true');
    show('orgAffiliationOtherWrap', getValue('orgAffiliationCode') === '9');
    show('orgTypeOtherWrap', getValue('orgTypeCode') === '9');
    show('orgIndustryOtherWrap', getValue('orgIndustryCode') === '99');
    show('expertReviewUploadWrap', getRadioValue('expertReviewStatus') === 'reviewed');
    show('supervisorNameWrap', getValue('hasSupervisor') === 'true');
    show('supervisorReviewWrap', getValue('hasSupervisor') === 'true');
    show('supervisorReviewUploadWrap', getValue('hasSupervisor') === 'true' && getRadioValue('supervisorReviewStatus') === 'reviewed');
    show('cloudServiceModeOtherWrap', getCheckedValues('cloudServiceModes').includes('其他'));
    show('cloudDeploymentOtherWrap', getCheckedValues('cloudDeploymentModes').includes('其他'));
    show('iotPerceptionOtherWrap', getCheckedValues('iotPerceptionLayers').includes('其他'));
    show('iotTransportOtherWrap', getCheckedValues('iotTransportLayers').includes('其他'));
    show('industrialComponentOtherWrap', getCheckedValues('industrialComponents').includes('其他'));
    show('cloudSceneDetailWrap', getValue('cloudEnabled') === 'true');
    show('mobileSceneDetailWrap', getValue('mobileEnabled') === 'true');
    show('iotSceneDetailWrap', getValue('iotEnabled') === 'true');
    show('industrialSceneDetailWrap', getValue('industrialEnabled') === 'true');
    show('bigDataSceneDetailWrap', getValue('bigDataEnabled') === 'true');
  }

  function renderTable6Items(items) {
    $('table6Items').innerHTML = ensureDataItems(items).map((item, index) => dataItemCard(item, index)).join('');
  }

  function renderAttachmentList(elementId, attachments) {
    const el = $(elementId);
    if (!el) return;
    const items = Array.isArray(attachments) ? attachments : [];
    el.innerHTML = items.length
      ? items.map((item) => `<a href="/api/attachment-files/${item.id}/download" target="_blank">${esc(item.file_name || `附件${item.id}`)}</a>`).join('')
      : '<span class="table-meta">未上传</span>';
  }

  function fillWorkspace(detail) {
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

    $('workspaceDetailPanel').hidden = false;
    $('workspaceDetailHead').innerHTML = `
      <div class="workspace-detail-summary">
        <div><span>单位</span><strong>${esc(org.name || '-')}</strong></div>
        <div><span>系统</span><strong>${esc(system.system_name || '-')}</strong></div>
        <div><span>当前等级</span><strong>${levelBadge(system.proposed_level)}</strong></div>
        <div><span>状态</span><strong>${statusBadge(Boolean(system.archived))}</strong></div>
      </div>
    `;
    $('workspaceDetailHint').textContent = `${org.name || '-'} / ${system.system_name || '-'} 正在编辑`;

    setValue('orgName', org.name);
    setValue('orgCreditCode', org.credit_code);
    setValue('orgFilingRegion', org.filing_region);
    setValue('unitInternetAddresses', table1.unit_internet_addresses || '无');
    setValue('orgProvince', address.province);
    setValue('orgCity', address.city);
    setValue('orgDistrict', address.district);
    setValue('orgDetailAddress', address.detail);
    setValue('orgPostalCode', table1.postal_code);
    setValue('orgDistrictCode', table1.district_code);
    setValue('orgAffiliationCode', affiliation.code);
    setValue('orgAffiliationOther', affiliation.other);
    setValue('orgTypeCode', orgType.code);
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
    ['2', '3', '4', '5'].forEach((key) => setValue(`currentCount${key}`, (table1.current_filing_counts || {})[key] || 0));
    ['1', '2', '3', '4', '5'].forEach((key) => setValue(`totalCount${key}`, (table1.total_filing_counts || {})[key] || 0));

    setValue('systemName', system.system_name);
    setValue('systemType', system.system_type);
    setValue('systemDeploymentMode', system.deployment_mode);
    setValue('systemGoLiveDate', table2.go_live_date);
    setCheckedValues('objectTypes', table2.object_types);
    setCheckedValues('technologyTypes', table2.technology_types);
    setValue('technologyOther', table2.technology_other);
    setCheckedValues('businessTypes', table2.business_types);
    setValue('businessOther', table2.business_other);
    setValue('businessDescription', table2.business_description || system.business_description);
    setValue('serviceScopeCode', (table2.network_service || {}).scope_code);
    setValue('crossProvinceCount', (table2.network_service || {}).cross_province_count);
    setValue('crossCityCount', (table2.network_service || {}).cross_city_count);
    setValue('serviceScopeOther', (table2.network_service || {}).other);
    setCheckedValues('serviceTargets', (table2.network_service || {}).service_targets);
    setValue('serviceTargetOther', (table2.network_service || {}).service_target_other);
    setValue('coverageCode', ((table2.network_platform || {}).coverage || {}).code);
    setValue('coverageOther', ((table2.network_platform || {}).coverage || {}).other);
    setValue('networkNatureCode', ((table2.network_platform || {}).network_nature || {}).code);
    setValue('networkNatureOther', ((table2.network_platform || {}).network_nature || {}).other);
    setValue('sourceIpRange', ((table2.network_platform || {}).network_nature || {}).source_ip_range);
    setValue('sourceDomain', ((table2.network_platform || {}).network_nature || {}).domain);
    setValue('sourceProtocolPorts', ((table2.network_platform || {}).network_nature || {}).protocol_ports);
    setCheckedValues('interconnectionItems', ((table2.network_platform || {}).interconnection || {}).items);
    setValue('interconnectionOther', ((table2.network_platform || {}).interconnection || {}).other);
    setValue('isSubSystem', table2.is_sub_system ? 'true' : 'false');
    setValue('parentSystemName', table2.parent_system_name);
    setValue('parentOrganizationName', table2.parent_organization_name);
    setValue('systemLevelBasis', system.level_basis);

    setCheckedValues('businessDamageItems', table3.business_security_damage_items);
    setCheckedValues('serviceDamageItems', table3.service_security_damage_items);
    setValue('gradingDate', table3.grading_date);
    setValue('fillerName', table3.filler_name);
    setValue('filledDate', table3.filled_date);
    setValue('hasSupervisor', table3.has_supervisor ? 'true' : 'false');
    setValue('supervisorName', table3.supervisor_name);
    setRadioValue('gradingReportStatus', (table3.grading_report || {}).has_file ? 'has' : 'none');
    setRadioValue('expertReviewStatus', (table3.expert_review || {}).status || 'unreviewed');
    setRadioValue('supervisorReviewStatus', (table3.supervisor_review || {}).status || 'unreviewed');
    renderAttachmentList('attachmentTable3GradingReport', (table3.grading_report || {}).attachments);
    renderAttachmentList('attachmentTable3ExpertReview', (table3.expert_review || {}).attachments);
    renderAttachmentList('attachmentTable3SupervisorReview', (table3.supervisor_review || {}).attachments);

    setValue('cloudEnabled', table4.cloud && table4.cloud.enabled ? 'true' : 'false');
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
    setValue('mobileEnabled', table4.mobile && table4.mobile.enabled ? 'true' : 'false');
    setValue('mobileAppName', (table4.mobile || {}).app_name);
    setCheckedValues('mobileWirelessChannels', (table4.mobile || {}).wireless_channels);
    setCheckedValues('mobileTerminalTypes', (table4.mobile || {}).terminal_types);
    setValue('iotEnabled', table4.iot && table4.iot.enabled ? 'true' : 'false');
    setCheckedValues('iotPerceptionLayers', (table4.iot || {}).perception_layers);
    setValue('iotPerceptionOther', (table4.iot || {}).perception_other);
    setCheckedValues('iotTransportLayers', (table4.iot || {}).transport_layers);
    setValue('iotTransportOther', (table4.iot || {}).transport_other);
    setValue('industrialEnabled', table4.industrial_control && table4.industrial_control.enabled ? 'true' : 'false');
    setCheckedValues('industrialFunctionLayers', (table4.industrial_control || {}).function_layers);
    setCheckedValues('industrialComponents', (table4.industrial_control || {}).components);
    setValue('industrialComponentOther', (table4.industrial_control || {}).component_other);
    setValue('bigDataEnabled', table4.big_data && table4.big_data.enabled ? 'true' : 'false');
    setCheckedValues('bigDataComponents', (table4.big_data || {}).system_components);
    setValue('bigDataCrossBorderStatus', (table4.big_data || {}).cross_border_status);
    setValue('bigDataApplicationCount', (table4.big_data || {}).application_count);
    setValue('bigDataInfraLocation', (table4.big_data || {}).infra_location);
    setValue('bigDataOpsLocation', (table4.big_data || {}).ops_location);
    setValue('bigDataProviderName', (table4.big_data || {}).provider_name);
    setValue('bigDataProviderLevel', (table4.big_data || {}).provider_level);
    setValue('bigDataProviderPlatformName', (table4.big_data || {}).provider_platform_name);
    setValue('bigDataProviderRecordNo', (table4.big_data || {}).provider_record_no);
    renderAttachmentList('attachmentTable4BigData', (table4.big_data || {}).attachments);

    MATERIAL_SLOTS.forEach(([key]) => {
      setValue(`materialStatus_${key}`, (table5[key] || {}).status || 'none');
      renderAttachmentList(`attachment_${key}`, (table5[key] || {}).attachments);
    });

    renderTable6Items(table6.items);
    updateLevelDisplays();
    syncConditionalFields();
  }

  function collectTable6Items() {
    return Array.from(document.querySelectorAll('.data-item-card')).map((card) => {
      const item = {};
      card.querySelectorAll('[data-field]').forEach((field) => {
        item[field.dataset.field] = String(field.value || '').trim();
      });
      const arrays = {};
      card.querySelectorAll('[data-array-field]:checked').forEach((field) => {
        const key = field.dataset.arrayField;
        arrays[key] = arrays[key] || [];
        arrays[key].push(field.value);
      });
      Object.assign(item, arrays);
      return item;
    });
  }

  function buildSavePayload() {
    const orgIndustryCode = getValue('orgIndustryCode');
    const orgTypeCode = getValue('orgTypeCode');
    const affiliationCode = getValue('orgAffiliationCode');
    const businessLevel = computeLevelFromItems(getCheckedValues('businessDamageItems'));
    const serviceLevel = computeLevelFromItems(getCheckedValues('serviceDamageItems'));
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
            current_filing_counts: { '2': numberValue('currentCount2'), '3': numberValue('currentCount3'), '4': numberValue('currentCount4'), '5': numberValue('currentCount5') },
            total_filing_counts: { '1': numberValue('totalCount1'), '2': numberValue('totalCount2'), '3': numberValue('totalCount3'), '4': numberValue('totalCount4'), '5': numberValue('totalCount5') },
          },
        },
      },
      system: {
        id: state.detail.system.id,
        system_name: getValue('systemName'),
        system_type: getValue('systemType'),
        deployment_mode: getValue('systemDeploymentMode'),
        level_basis: getValue('systemLevelBasis'),
        business_description: getValue('businessDescription'),
        filing_detail: {
          ...baseSystemDetail,
          table2: {
            ...baseSystemDetail.table2,
            object_types: getCheckedValues('objectTypes'),
            technology_types: getCheckedValues('technologyTypes'),
            technology_other: getValue('technologyOther'),
            business_types: getCheckedValues('businessTypes'),
            business_other: getValue('businessOther'),
            business_description: getValue('businessDescription'),
            network_service: {
              scope_code: selectedLabel(SERVICE_SCOPE_OPTIONS, getValue('serviceScopeCode')) || getValue('serviceScopeCode'),
              cross_province_count: getValue('crossProvinceCount'),
              cross_city_count: getValue('crossCityCount'),
              other: getValue('serviceScopeOther'),
              service_targets: getCheckedValues('serviceTargets'),
              service_target_other: getValue('serviceTargetOther'),
            },
            network_platform: {
              coverage: { code: getValue('coverageCode'), label: selectedLabel(COVERAGE_OPTIONS, getValue('coverageCode')), other: getValue('coverageOther') },
              network_nature: {
                code: getValue('networkNatureCode'),
                label: selectedLabel(NETWORK_NATURE_OPTIONS, getValue('networkNatureCode')),
                other: getValue('networkNatureOther'),
                source_ip_range: getValue('sourceIpRange'),
                domain: getValue('sourceDomain'),
                protocol_ports: getValue('sourceProtocolPorts'),
              },
              interconnection: { items: getCheckedValues('interconnectionItems'), other: getValue('interconnectionOther') },
            },
            go_live_date: getValue('systemGoLiveDate'),
            is_sub_system: getValue('isSubSystem') === 'true',
            parent_system_name: getValue('parentSystemName'),
            parent_organization_name: getValue('parentOrganizationName'),
          },
          table3: {
            ...prevTable3,
            business_security_damage_items: getCheckedValues('businessDamageItems'),
            business_security_level: businessLevel,
            service_security_damage_items: getCheckedValues('serviceDamageItems'),
            service_security_level: serviceLevel,
            final_level: finalLevel,
            grading_date: getValue('gradingDate'),
            grading_report: { ...(prevTable3.grading_report || {}), has_file: getRadioValue('gradingReportStatus') === 'has' },
            expert_review: { ...(prevTable3.expert_review || {}), status: getRadioValue('expertReviewStatus') || 'unreviewed' },
            has_supervisor: getValue('hasSupervisor') === 'true',
            supervisor_name: getValue('supervisorName'),
            supervisor_review: { ...(prevTable3.supervisor_review || {}), status: getRadioValue('supervisorReviewStatus') || 'unreviewed' },
            filler_name: getValue('fillerName'),
            filled_date: getValue('filledDate'),
          },
          table4: {
            ...prevTable4,
            cloud: { ...(prevTable4.cloud || {}), enabled: getValue('cloudEnabled') === 'true', responsibility_types: getCheckedValues('cloudResponsibilityTypes'), service_modes: getCheckedValues('cloudServiceModes'), service_mode_other: getValue('cloudServiceModeOther'), deployment_modes: getCheckedValues('cloudDeploymentModes'), deployment_mode_other: getValue('cloudDeploymentOther'), customer_count: getValue('cloudCustomerCount'), infra_location: getValue('cloudInfraLocation'), ops_location: getValue('cloudOpsLocation'), provider_name: getValue('cloudProviderName'), provider_level: getValue('cloudProviderLevel'), provider_platform_name: getValue('cloudProviderPlatformName'), provider_record_no: getValue('cloudProviderRecordNo'), customer_ops_location: getValue('cloudCustomerOpsLocation') },
            mobile: { ...(prevTable4.mobile || {}), enabled: getValue('mobileEnabled') === 'true', app_name: getValue('mobileAppName'), wireless_channels: getCheckedValues('mobileWirelessChannels'), terminal_types: getCheckedValues('mobileTerminalTypes') },
            iot: { ...(prevTable4.iot || {}), enabled: getValue('iotEnabled') === 'true', perception_layers: getCheckedValues('iotPerceptionLayers'), perception_other: getValue('iotPerceptionOther'), transport_layers: getCheckedValues('iotTransportLayers'), transport_other: getValue('iotTransportOther') },
            industrial_control: { ...(prevTable4.industrial_control || {}), enabled: getValue('industrialEnabled') === 'true', function_layers: getCheckedValues('industrialFunctionLayers'), components: getCheckedValues('industrialComponents'), component_other: getValue('industrialComponentOther') },
            big_data: { ...(prevTable4.big_data || {}), enabled: getValue('bigDataEnabled') === 'true', system_components: getCheckedValues('bigDataComponents'), cross_border_status: getValue('bigDataCrossBorderStatus'), application_count: getValue('bigDataApplicationCount'), infra_location: getValue('bigDataInfraLocation'), ops_location: getValue('bigDataOpsLocation'), provider_name: getValue('bigDataProviderName'), provider_level: getValue('bigDataProviderLevel'), provider_platform_name: getValue('bigDataProviderPlatformName'), provider_record_no: getValue('bigDataProviderRecordNo') },
          },
          table5: MATERIAL_SLOTS.reduce((acc, [key]) => {
            acc[key] = { ...((prevTable5[key]) || {}), status: getValue(`materialStatus_${key}`) || 'none' };
            return acc;
          }, {}),
          table6: { items: collectTable6Items() },
        },
      },
    };
  }

  async function loadOverview() {
    state.includeArchived = $('workspaceIncludeArchived').checked;
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

  function renderOverview() {
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
            <div class="org-card-meta">${statusBadge(Boolean(org.archived))}<span class="mini-badge">${systems.length} 个系统</span></div>
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
                  <button class="btn-lite btn-sm" data-open-system="${system.id}">完善信息</button>
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
    fillWorkspace(data);
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
    await loadOverview();
    await loadSystemDetail(data.data.id);
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
    setDetailResult('备案信息已保存。');
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
    const fd = new FormData();
    fd.append('file', file);
    const res = await fetch(`/api/filing-workspace/systems/${state.currentSystemId}/attachments/${slotKey}`, {
      method: 'POST',
      headers: authHeaders(),
      body: fd,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setDetailResult(`附件上传失败：${apiErrorText(data)}`);
      return;
    }
    fillWorkspace(data.data);
    input.value = '';
    setDetailResult('附件上传成功。');
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
    const res = await fetch('/api/delete-requests?entity_type=organization', { headers: authHeaders() });
    const data = await res.json().catch(() => ({}));
    const items = res.ok ? (data.items || []) : [];
    $('orgDeleteReqTable').innerHTML = items.length
      ? items.map((item) => `<tr><td>${esc(item.id)}</td><td>${esc(item.entity_id)}</td><td><div class="table-meta"><strong>申请人：</strong>${esc(item.requested_by || '-')}<br><span>提交：${formatDateTime(item.requested_at)}</span></div></td><td>${reqStatusBadge(item.status)}</td><td>${window.requestReviewMeta(item)}</td><td>${esc(item.reason || '-')}</td><td>${item.status === 'pending' ? `<div class="table-action-group"><button class="btn-lite btn-sm" data-review-delete-request="${item.id}" data-review-action="approve" data-entity-type="organization">通过</button><button class="btn-lite btn-sm btn-danger" data-review-delete-request="${item.id}" data-review-action="reject" data-entity-type="organization">驳回</button></div>` : '<span class="table-meta">已处理</span>'}</td></tr>`).join('')
      : '<tr><td colspan="7">暂无数据</td></tr>';
  }

  async function loadSystemDeleteRequests() {
    const res = await fetch('/api/delete-requests?entity_type=system', { headers: authHeaders() });
    const data = await res.json().catch(() => ({}));
    const items = res.ok ? (data.items || []) : [];
    $('sysDeleteReqTable').innerHTML = items.length
      ? items.map((item) => `<tr><td>${esc(item.id)}</td><td>${esc(item.entity_id)}</td><td><div class="table-meta"><strong>申请人：</strong>${esc(item.requested_by || '-')}<br><span>提交：${formatDateTime(item.requested_at)}</span></div></td><td>${reqStatusBadge(item.status)}</td><td>${window.requestReviewMeta(item)}</td><td>${esc(item.reason || '-')}</td><td>${item.status === 'pending' ? `<div class="table-action-group"><button class="btn-lite btn-sm" data-review-delete-request="${item.id}" data-review-action="approve" data-entity-type="system">通过</button><button class="btn-lite btn-sm btn-danger" data-review-delete-request="${item.id}" data-review-action="reject" data-entity-type="system">驳回</button></div>` : '<span class="table-meta">已处理</span>'}</td></tr>`).join('')
      : '<tr><td colspan="7">暂无数据</td></tr>';
  }

  async function loadRecycleOrgs() {
    const res = await fetch('/api/organizations/recycle-bin/list', { headers: authHeaders() });
    const data = await res.json().catch(() => ({}));
    const items = res.ok ? (data.items || []) : [];
    $('orgRecycleTable').innerHTML = items.length
      ? items.map((item) => `<tr><td>${esc(item.id)}</td><td>${esc(item.name)}</td><td>${esc(item.deleted_by || '-')}</td><td>${formatDateTime(item.deleted_at)}</td><td>${esc(item.days_left || 0)} 天</td><td><div class="table-action-group"><button class="btn-lite btn-sm" data-restore-org="${item.id}">恢复</button><button class="btn-danger btn-sm" data-purge-org="${item.id}">永久删除</button></div></td></tr>`).join('')
      : '<tr><td colspan="6">暂无数据</td></tr>';
  }

  async function loadRecycleSystems() {
    const res = await fetch('/api/systems/recycle-bin/list', { headers: authHeaders() });
    const data = await res.json().catch(() => ({}));
    const items = res.ok ? (data.items || []) : [];
    $('sysRecycleTable').innerHTML = items.length
      ? items.map((item) => `<tr><td>${esc(item.id)}</td><td>${esc(item.system_name)}</td><td>${esc(item.deleted_by || '-')}</td><td>${formatDateTime(item.deleted_at)}</td><td>${esc(item.days_left || 0)} 天</td><td><div class="table-action-group"><button class="btn-lite btn-sm" data-restore-system="${item.id}">恢复</button><button class="btn-danger btn-sm" data-purge-system="${item.id}">永久删除</button></div></td></tr>`).join('')
      : '<tr><td colspan="6">暂无数据</td></tr>';
  }

  function bindEvents() {
    $('workspaceReloadBtn').addEventListener('click', loadOverview);
    $('workspaceKeyword').addEventListener('keydown', (event) => { if (event.key === 'Enter') loadOverview(); });
    $('workspaceIncludeArchived').addEventListener('change', loadOverview);
    $('workspaceToggleCreateBtn').addEventListener('click', () => openCreateModal('organization'));
    $('workspaceCreateModalClose').addEventListener('click', closeCreateModal);
    $('workspaceCreateOrgCancel').addEventListener('click', closeCreateModal);
    $('workspaceCreateSystemCancel').addEventListener('click', closeCreateModal);
    $('workspaceCreateModal').addEventListener('click', (event) => {
      if (event.target === $('workspaceCreateModal')) closeCreateModal();
    });
    $('createOrgBtn').addEventListener('click', createOrganization);
    $('createSystemBtn').addEventListener('click', createSystem);
    $('workspaceSaveBtn').addEventListener('click', saveWorkspace);
    $('workspaceExportBtn').addEventListener('click', () => { if (state.currentSystemId) window.location.href = `/api/systems/${state.currentSystemId}/export/word`; });
    $('addDataItemBtn').addEventListener('click', () => renderTable6Items([...collectTable6Items(), {}]));
    $('loadOrgDeleteRequestsBtn').addEventListener('click', loadOrgDeleteRequests);
    $('loadSystemDeleteRequestsBtn').addEventListener('click', loadSystemDeleteRequests);
    $('loadRecycleOrgsBtn').addEventListener('click', loadRecycleOrgs);
    $('cleanupRecycleOrgsBtn').addEventListener('click', cleanupRecycleOrgs);
    $('loadRecycleSystemsBtn').addEventListener('click', loadRecycleSystems);
    $('cleanupRecycleSystemsBtn').addEventListener('click', cleanupRecycleSystems);
    document.querySelectorAll('[data-maintenance-tab]').forEach((btn) => {
      btn.addEventListener('click', () => switchMaintenanceTab(btn.dataset.maintenanceTab));
    });

    document.addEventListener('change', (event) => {
      if (event.target.matches('input[type="checkbox"], input[type="radio"], select')) {
        syncConditionalFields();
        updateLevelDisplays();
      }
    });

    document.addEventListener('click', async (event) => {
      const btn = event.target.closest('button');
      if (!btn) return;
      if (btn.dataset.toggleOrg) {
        const orgId = Number(btn.dataset.toggleOrg);
        state.openOrgIds.has(orgId) ? state.openOrgIds.delete(orgId) : state.openOrgIds.add(orgId);
        renderOverview();
      } else if (btn.dataset.createSystem) {
        state.createOrgId = Number(btn.dataset.createSystem);
        const org = state.overview.find((item) => item.organization.id === state.createOrgId);
        openCreateModal('system', org ? org.organization : null);
      } else if (btn.dataset.openSystem) {
        await loadSystemDetail(Number(btn.dataset.openSystem));
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
    const requestedAttentionTab = initialAttentionTab();
    const activeAttentionTab = requestedAttentionTab || 'org-requests';
    switchMaintenanceTab(activeAttentionTab);
    await Promise.all([loadOverview(), loadOrgDeleteRequests(), loadSystemDeleteRequests(), loadRecycleOrgs(), loadRecycleSystems()]);
    if (requestedAttentionTab) {
      document.getElementById('workspaceMaintenanceSection')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
    syncConditionalFields();
    updateLevelDisplays();
  }

  init();
})();
