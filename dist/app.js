const STORAGE_KEY = 'ironcode_repair_demo_v1';

const seedOrders = [
  {
    id: 'WX202611130018',
    device: 'MacBook Pro 14',
    problem: '无法开机，充电指示灯不亮',
    mode: '到店检测',
    time: '2026-11-13 14:30',
    status: '待确认报价',
    stage: 3,
    phone: '138****6088',
    report: {
      cause: '充电管理芯片异常，主板局部轻微腐蚀',
      solution: '更换充电管理芯片，清洁腐蚀区域并做整机稳定性测试',
      engineer: '陈工',
      warranty: '维修项目 90 天质保',
      photos: 3
    },
    quote: [
      { name: '主板芯片级维修', price: 680 },
      { name: '内部清洁与稳定性测试', price: 120 }
    ],
    createdAt: '2026-11-13 10:12'
  },
  {
    id: 'WX202611100092',
    device: 'iPhone 15 Pro',
    problem: '屏幕碎裂，触控偶尔失灵',
    mode: '上门维修',
    time: '2026-11-10 16:00',
    status: '已完成',
    stage: 5,
    phone: '138****6088',
    report: { cause: '外屏破裂，显示及面容组件正常', solution: '更换原品质外屏总成', engineer: '林工', warranty: '配件 180 天质保', photos: 2 },
    quote: [{ name: '原品质屏幕总成', price: 1080 }, { name: '上门服务', price: 0 }],
    createdAt: '2026-11-10 11:20'
  }
];

const state = {
  route: location.hash.replace('#/', '') || 'home',
  role: 'customer',
  bookingMode: '上门维修',
  orderFilter: '全部',
  selectedOrder: null,
  consultType: '售前咨询',
  orders: loadOrders(),
  messages: [
    { from: 'agent', text: '您好，我是在线顾问小铁。请告诉我设备型号和遇到的问题，我可以先帮您做初步判断。' }
  ]
};

function loadOrders() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    return Array.isArray(saved) && saved.length ? saved : seedOrders;
  } catch { return seedOrders; }
}
function saveOrders() { localStorage.setItem(STORAGE_KEY, JSON.stringify(state.orders)); }
function money(n) { return new Intl.NumberFormat('zh-CN', { style: 'currency', currency: 'CNY', maximumFractionDigits: 0 }).format(n); }
function esc(str='') { return String(str).replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c])); }
function toast(text) {
  const el = document.getElementById('toast');
  el.textContent = text; el.classList.add('show');
  clearTimeout(toast.timer); toast.timer = setTimeout(() => el.classList.remove('show'), 2200);
}

const nav = [
  ['home','⌂','首页'], ['booking','⌁','在线预约'], ['orders','▤','我的订单'], ['consult','◌','在线咨询'], ['profile','◎','我的']
];

function shell(content) {
  const title = state.role === 'engineer' ? '工程师工作台' : (nav.find(n => n[0] === state.route)?.[2] || '订单详情');
  return `<div class="app-shell">
    <aside class="sidebar">
      <div class="brand"><div class="brand-mark">铁</div><div><div class="brand-name">铁码维修</div><div class="brand-sub">DIGITAL CARE</div></div></div>
      <nav class="nav-list">${nav.map(([r,i,t]) => `<button class="nav-item ${state.route===r?'active':''}" data-route="${r}"><span class="nav-icon">${i}</span>${t}</button>`).join('')}</nav>
      <div class="side-card"><strong>设备突发故障？</strong><span>在线顾问 5 分钟内响应</span><button class="tiny-btn" data-route="consult">立即咨询</button></div>
    </aside>
    <main class="main">
      <header class="topbar"><div class="breadcrumb">铁码维修 · ${title}</div><div class="top-actions">
        <div class="role-switch"><button data-role="customer" class="${state.role==='customer'?'active':''}">客户视角</button><button data-role="engineer" class="${state.role==='engineer'?'active':''}">工程师视角</button></div>
        <button class="avatar" data-route="profile" aria-label="个人中心">CY</button>
      </div></header>
      <div class="content">${content}</div>
    </main>
    <nav class="mobile-nav">${nav.map(([r,i,t]) => `<button data-route="${r}" class="${state.route===r?'active':''}"><i>${i}</i>${t}</button>`).join('')}</nav>
  </div>`;
}

function homePage() {
  return `<section class="hero">
    <div class="hero-copy"><div class="eyebrow">电脑 · 手机 · 平板 · 智能设备</div><h1>修好设备，<br>也修好你的安心。</h1><p class="lead">透明检测、确认后维修、全程可追踪。上门或到店，由你选择；每一次维修，都有清晰记录和质保凭证。</p>
      <div class="hero-actions"><button class="btn primary" data-route="booking">立即预约维修 →</button><button class="btn" data-route="consult">先问问再决定</button></div>
    </div>
    <div class="repair-visual" aria-hidden="true"><div class="visual-card visual-main"><div class="device-stage"><div class="laptop"></div><div class="phone"></div></div><div class="visual-status"><div><small>当前服务状态</small><br><strong>工程师在线接单中</strong></div><div class="pulse"></div></div></div><div class="float-badge one">✓ 先检测 后报价</div><div class="float-badge two">90 天起维修质保</div></div>
  </section>
  <div class="trust-row"><div class="trust-item"><strong>全品类支持</strong>主流电脑、手机与智能设备</div><div class="trust-item"><strong>价格透明</strong>维修前确认项目和总价</div><div class="trust-item"><strong>隐私保护</strong>数据操作需单独授权</div><div class="trust-item"><strong>售后有据</strong>报告、配件与质保可追溯</div></div>
  <section><div class="section-head"><div><div class="eyebrow">按你的方式维修</div><h2>从故障发生，到重新好用</h2></div><p>不确定是什么问题也没关系。描述现象即可，工程师会先检测，再给出可选择的维修方案。</p></div>
    <div class="service-grid">
      <article class="service-card"><div class="service-icon">⌂</div><h3>预约上门维修</h3><p>适合不便携带的台式机、网络设备，以及可现场解决的手机电脑故障。</p><button class="btn small" data-booking-mode="上门维修">预约上门 →</button></article>
      <article class="service-card"><div class="service-icon">⌖</div><h3>预约到店检测</h3><p>复杂故障和主板维修建议到店，检测设备更齐全，问题判断更准确。</p><button class="btn small" data-booking-mode="到店检测">预约到店 →</button></article>
      <article class="service-card"><div class="service-icon">◌</div><h3>在线预诊断</h3><p>上传故障现象或错误提示，顾问先判断维修方向与大致时效。</p><button class="btn small" data-route="consult">开始咨询 →</button></article>
    </div>
  </section>
  <section class="process"><div class="section-head"><div><div class="eyebrow">清晰的服务闭环</div><h2>每一步，都由你确认</h2></div></div><div class="process-grid">
    <div class="process-step"><strong>提交预约</strong><span>选择设备与服务方式</span></div><div class="process-step"><strong>到店 / 上门</strong><span>双向确认服务开始</span></div><div class="process-step"><strong>检测与报告</strong><span>问题、方案、配件有记录</span></div><div class="process-step"><strong>确认并付款</strong><span>同意报价后再开修</span></div><div class="process-step"><strong>交付与质保</strong><span>保留电子报告与凭证</span></div>
  </div></section>
  <section class="assurance"><div class="assurance-copy"><div class="eyebrow" style="color:#f3b469">我们更在意边界感</div><h2>你的设备、数据和决定权，始终属于你。</h2><p>涉及拆机、数据读写、配件替换或追加维修项目时，都需要独立确认。</p></div><div class="assurance-list"><div class="assurance-item"><b>01</b><div><strong>数据操作单独授权</strong><br><small>不默认查看、备份或重装系统。</small></div></div><div class="assurance-item"><b>02</b><div><strong>旧件可选返还</strong><br><small>更换下来的配件去向清晰可查。</small></div></div><div class="assurance-item"><b>03</b><div><strong>追加费用再次确认</strong><br><small>检测结果变化，不会自动加项。</small></div></div></div></section>`;
}

function bookingPage() {
  const home = state.bookingMode === '上门维修';
  const earliestDate = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
  return `<div class="page-head"><div><div class="eyebrow">Book a repair</div><h1>预约维修</h1><p>约 2 分钟完成，提交后可随时修改或取消。</p></div></div>
  <div class="split-layout"><form class="card" id="booking-form"><div class="form-grid">
    <div class="field full"><label>服务方式</label><div class="choice-grid"><button type="button" class="choice ${home?'active':''}" data-booking-mode="上门维修"><strong>⌂ 上门维修</strong><span>工程师按预约时间到达</span></button><button type="button" class="choice ${!home?'active':''}" data-booking-mode="到店检测"><strong>⌖ 到店检测</strong><span>复杂故障可使用专业设备</span></button></div></div>
    <div class="field"><label for="deviceType">设备类型</label><select class="select" id="deviceType" name="deviceType" required><option value="">请选择</option><option>笔记本电脑</option><option>台式电脑</option><option>手机</option><option>平板电脑</option><option>游戏机 / 掌机</option><option>其他数码设备</option></select></div>
    <div class="field"><label for="deviceModel">品牌与型号</label><input class="input" id="deviceModel" name="deviceModel" placeholder="如：iPhone 15 Pro" required /></div>
    <div class="field full"><label for="problem">故障现象</label><textarea class="textarea" id="problem" name="problem" placeholder="请描述什么时候发生、有什么提示、是否进水或摔落……" required></textarea></div>
    <div class="field"><label for="date">预约日期</label><input class="input" id="date" name="date" type="date" min="${earliestDate}" required /></div>
    <div class="field"><label for="slot">时间段</label><select class="select" id="slot" name="slot" required><option value="">请选择</option><option>09:00–11:00</option><option>11:00–13:00</option><option>14:00–16:00</option><option>16:00–18:00</option><option>19:00–21:00</option></select></div>
    ${home?'<div class="field full"><label for="address">上门地址</label><input class="input" id="address" name="address" placeholder="小区 / 写字楼、楼栋门牌" required /></div>':'<div class="field full"><label>到店地址</label><div class="report">铁码数码维修 · 城中店<br><small>示例地址：科技路 88 号一层（营业时间 09:00–21:00）</small></div></div>'}
    <div class="field"><label for="name">联系人</label><input class="input" id="name" name="name" placeholder="怎么称呼您" required /></div>
    <div class="field"><label for="phone">手机号</label><input class="input" id="phone" name="phone" inputmode="tel" placeholder="用于接收进度通知" required /></div>
    <div class="field full"><label><input type="checkbox" required /> 我已阅读并同意《维修服务须知》与《隐私说明》</label><small>涉及数据读写、重装系统等操作时，将再次向您单独确认。</small></div>
  </div><div class="form-actions"><button class="btn primary" type="submit">提交预约</button><button class="btn" type="button" data-route="consult">不确定？先咨询</button></div></form>
  <aside class="card booking-summary"><div class="eyebrow">预约摘要</div><h3>${state.bookingMode}</h3><div class="summary-line"><span>基础检测</span><strong>${home?'到场前免费预诊断':'检测后再报价'}</strong></div><div class="summary-line"><span>维修原则</span><strong>确认报价后开修</strong></div><div class="summary-line"><span>取消规则</span><strong>服务开始前可取消</strong></div><div class="summary-note">本页面为交互演示。实际营业地址、服务范围、检测费和取消规则可在正式上线前配置。</div></aside></div>`;
}

function ordersPage() {
  const filters = ['全部','进行中','待确认报价','已完成','已取消'];
  const filtered = state.orders.filter(o => state.orderFilter==='全部' ? true : state.orderFilter==='进行中' ? !['已完成','已取消'].includes(o.status) : o.status===state.orderFilter);
  return `<div class="page-head"><div><div class="eyebrow">Repair orders</div><h1>维修订单</h1><p>查看预约、检测、报价、付款和质保记录。</p></div><button class="btn primary" data-route="booking">＋ 新建预约</button></div>
  <div class="filter-row">${filters.map(f=>`<button class="filter-chip ${state.orderFilter===f?'active':''}" data-filter="${f}">${f}</button>`).join('')}</div>
  <div class="order-list">${filtered.length ? filtered.map(orderCard).join('') : '<div class="card empty">这里暂时没有订单</div>'}</div>`;
}
function orderCard(o) {
  return `<article class="card order-card"><div><div class="order-top"><h3 style="margin:0">${esc(o.device)}</h3><span class="status">${esc(o.status)}</span><span class="order-id">${o.id}</span></div><div class="order-meta"><span>故障：${esc(o.problem)}</span><span>${esc(o.mode)}</span><span>${esc(o.time)}</span></div></div><div class="order-actions"><button class="btn small" data-order="${o.id}">查看详情</button>${o.status==='待确认预约'?`<button class="btn small danger" data-cancel="${o.id}">取消</button>`:''}</div></article>`;
}

function orderDetailPage() {
  const o = state.orders.find(x => x.id === state.selectedOrder) || state.orders[0];
  const stages = ['预约已提交','设备已接收','检测进行中','确认维修方案','维修与测试','交付完成'];
  const total = (o.quote||[]).reduce((s,i)=>s+i.price,0);
  return `<div class="page-head"><div><button class="btn small" data-route="orders">← 返回订单</button><h1 style="margin-top:18px">${esc(o.device)}</h1><p>${o.id} · ${esc(o.mode)} · ${esc(o.status)}</p></div><div class="form-actions">${o.stage<2?`<button class="btn" data-edit="${o.id}">修改预约</button><button class="btn danger" data-cancel="${o.id}">取消订单</button>`:''}</div></div>
  <div class="detail-grid"><section class="card"><div class="eyebrow">服务进度</div><div class="timeline">${stages.map((s,i)=>`<div class="timeline-item ${i<o.stage?'done':i===o.stage?'current':''}"><div class="timeline-dot"></div><strong>${s}</strong><span>${i===o.stage?'当前进度':i<o.stage?'已完成':'等待处理中'}</span></div>`).join('')}</div></section>
  <aside><div class="card"><div class="eyebrow">设备与预约</div><div class="summary-line"><span>故障现象</span><strong>${esc(o.problem)}</strong></div><div class="summary-line"><span>预约时间</span><strong>${esc(o.time)}</strong></div><div class="summary-line"><span>联系方式</span><strong>${esc(o.phone)}</strong></div>${o.stage===1?'<button class="btn primary" style="width:100%;margin-top:18px" data-arrival="'+o.id+'">确认已到店 / 已上门</button>':''}</div>
  ${o.report?`<div class="card" style="margin-top:18px"><div class="eyebrow">检测报告</div><div class="report"><div class="report-grid"><div class="report-cell"><span>故障原因</span><strong>${esc(o.report.cause)}</strong></div><div class="report-cell"><span>建议方案</span><strong>${esc(o.report.solution)}</strong></div><div class="report-cell"><span>检测工程师</span><strong>${esc(o.report.engineer)}</strong></div><div class="report-cell"><span>质保说明</span><strong>${esc(o.report.warranty)}</strong></div></div></div></div>`:''}
  ${o.quote?`<div class="card" style="margin-top:18px"><div class="eyebrow">维修报价</div>${o.quote.map(i=>`<div class="quote-line"><span>${esc(i.name)}</span><strong>${money(i.price)}</strong></div>`).join('')}<div class="quote-total"><span>合计</span><span>${money(total)}</span></div>${o.status==='待确认报价'?'<div class="form-actions"><button class="btn primary" data-pay="'+o.id+'">确认项目并付款</button><button class="btn" data-consult-order="'+o.id+'">咨询工程师</button></div>':''}</div>`:''}</aside></div>`;
}

function consultPage() {
  const types = [['售前咨询','故障判断、费用与时效'],['售后咨询','质保、返修与使用问题'],['订单咨询','了解当前维修进度']];
  return `<div class="page-head"><div><div class="eyebrow">Online support</div><h1>在线咨询</h1><p>先把问题说清楚，再决定下一步。</p></div></div><div class="consult-layout"><aside class="consult-side">${types.map(([t,d])=>`<button class="topic ${state.consultType===t?'active':''}" data-topic="${t}"><strong>${t}</strong><span>${d}</span></button>`).join('')}<div class="card"><strong>紧急提醒</strong><p style="font-size:12px;color:var(--muted);margin:8px 0 0">设备进水、冒烟或电池鼓包时，请立即断电并停止充电。</p></div></aside>
  <section class="card chat"><div class="chat-head"><div><strong>${state.consultType}</strong><div class="online">● 顾问在线 · 通常 5 分钟内回复</div></div><span>工单可留档</span></div><div class="messages" id="messages">${state.messages.map(m=>`<div class="message ${m.from}">${esc(m.text)}</div>`).join('')}</div><div class="quick-replies"><button class="quick-reply" data-quick="设备无法开机">设备无法开机</button><button class="quick-reply" data-quick="想了解大致费用">想了解大致费用</button><button class="quick-reply" data-quick="查询维修进度">查询维修进度</button></div><form class="chat-input" id="chat-form"><input class="input" name="message" autocomplete="off" placeholder="输入设备型号和故障现象……" required><button class="btn primary" type="submit">发送</button></form></section></div>`;
}

function profilePage() {
  return `<div class="page-head"><div><div class="eyebrow">Account & service</div><h1>我的服务</h1><p>管理设备、地址、发票和维修保障。</p></div></div><div class="service-grid">
    <article class="service-card"><div class="service-icon">▣</div><h3>我的设备</h3><p>保存设备型号、购买日期和历史维修记录，下次报修更快。</p><button class="btn small" data-demo>管理设备</button></article>
    <article class="service-card"><div class="service-icon">⌖</div><h3>地址与联系人</h3><p>维护常用上门地址和取送联系人。</p><button class="btn small" data-demo>管理地址</button></article>
    <article class="service-card"><div class="service-icon">◫</div><h3>发票与支付</h3><p>申请电子发票，查看支付记录和退款进度。</p><button class="btn small" data-demo>查看记录</button></article>
    <article class="service-card"><div class="service-icon">◇</div><h3>电子质保卡</h3><p>维修项目、配件批次和质保截止日期集中管理。</p><button class="btn small" data-demo>查看质保</button></article>
    <article class="service-card"><div class="service-icon">⇅</div><h3>旧件处置</h3><p>选择返还、环保回收，并留存处理记录。</p><button class="btn small" data-demo>查看记录</button></article>
    <article class="service-card"><div class="service-icon">⚙</div><h3>通知偏好</h3><p>选择短信、微信或站内消息接收维修节点提醒。</p><button class="btn small" data-demo>设置通知</button></article>
  </div><div class="card" style="margin-top:20px"><div class="section-head"><div><div class="eyebrow">演示入口</div><h3>切换到工程师工作台</h3></div><button class="btn dark" data-role="engineer">进入工程师视角 →</button></div></div>`;
}

function engineerPage() {
  return `<div class="page-head"><div><div class="eyebrow">Engineer workspace</div><h1>今日维修工作台</h1><p>接单、到场确认、上传检测报告与提交报价。</p></div><button class="btn" data-role="customer">切回客户视角</button></div>
  <div class="engineer-grid"><div class="card metric"><strong>6</strong><span>今日待处理</span></div><div class="card metric"><strong>3</strong><span>正在检测</span></div><div class="card metric"><strong>92%</strong><span>按时完成率</span></div></div>
  <div class="detail-grid"><section class="card"><div class="section-head"><div><div class="eyebrow">任务队列</div><h3>待处理工单</h3></div></div>
    <div class="task-row"><div><strong>MacBook Pro 14 · 无法开机</strong><div class="order-meta"><span>到店检测</span><span>14:30</span><span>客户已到店</span></div></div><button class="btn small primary" data-engineer-report>填写检测</button></div>
    <div class="task-row"><div><strong>联想拯救者 Y9000P · 自动重启</strong><div class="order-meta"><span>上门维修</span><span>16:00</span><span>距客户 3.2 km</span></div></div><button class="btn small" data-demo>开始服务</button></div>
    <div class="task-row"><div><strong>iPad Pro 11 · 充电缓慢</strong><div class="order-meta"><span>到店检测</span><span>17:30</span><span>待接收</span></div></div><button class="btn small" data-demo>查看工单</button></div>
  </section><aside class="card"><div class="eyebrow">服务规范提醒</div><h3>检测前请确认</h3><div class="assurance-item"><b>01</b><div>核对设备外观并拍照</div></div><div class="assurance-item"><b>02</b><div>记录序列号与随机配件</div></div><div class="assurance-item"><b>03</b><div>涉及数据操作需客户授权</div></div><div class="assurance-item"><b>04</b><div>追加维修项目必须重新报价</div></div></aside></div>`;
}

function render() {
  if (state.role === 'engineer') return document.getElementById('app').innerHTML = shell(engineerPage());
  const pages = { home:homePage, booking:bookingPage, orders:ordersPage, order:orderDetailPage, consult:consultPage, profile:profilePage };
  document.getElementById('app').innerHTML = shell((pages[state.route] || homePage)());
  if (state.route === 'consult') requestAnimationFrame(()=>{ const m=document.getElementById('messages'); if(m)m.scrollTop=m.scrollHeight; });
}

function go(route) { state.route = route; location.hash = '#/' + route; window.scrollTo({top:0,behavior:'smooth'}); render(); }
function openModal(title, body) {
  document.body.insertAdjacentHTML('beforeend', `<div class="modal-backdrop" id="modal"><div class="modal"><div class="modal-head"><h3 style="margin:0">${title}</h3><button class="icon-btn" data-close>×</button></div>${body}</div></div>`);
}

document.addEventListener('click', e => {
  const route = e.target.closest('[data-route]')?.dataset.route; if (route) return go(route);
  const role = e.target.closest('[data-role]')?.dataset.role; if (role) { state.role=role; if(role==='customer') state.route='home'; render(); return; }
  const mode = e.target.closest('[data-booking-mode]')?.dataset.bookingMode; if (mode) { state.bookingMode=mode; go('booking'); return; }
  const filter = e.target.closest('[data-filter]')?.dataset.filter; if (filter) { state.orderFilter=filter; render(); return; }
  const oid = e.target.closest('[data-order]')?.dataset.order; if (oid) { state.selectedOrder=oid; go('order'); return; }
  const topic = e.target.closest('[data-topic]')?.dataset.topic; if (topic) { state.consultType=topic; render(); return; }
  const quick = e.target.closest('[data-quick]')?.dataset.quick; if (quick) { state.messages.push({from:'user',text:quick},{from:'agent',text:'收到。请再告诉我具体品牌型号，以及故障发生前是否有摔落、进水或系统更新。'}); render(); return; }
  const cancel = e.target.closest('[data-cancel]')?.dataset.cancel; if (cancel) return openModal('确认取消订单？', `<p>取消后，已预约的时间将被释放。本次演示不会产生任何费用。</p><div class="form-actions"><button class="btn danger" data-confirm-cancel="${cancel}">确认取消</button><button class="btn" data-close>暂不取消</button></div>`);
  const pay = e.target.closest('[data-pay]')?.dataset.pay; if (pay) return openModal('确认维修项目并付款', `<div class="report"><strong>演示支付</strong><p style="color:var(--muted);margin:8px 0 0">正式上线时可接入微信支付、支付宝或到店支付。此处不会发起真实扣款。</p></div><div class="form-actions"><button class="btn primary" data-confirm-pay="${pay}">模拟支付成功</button><button class="btn" data-close>返回</button></div>`);
  const arrival = e.target.closest('[data-arrival]')?.dataset.arrival; if (arrival) { const o=state.orders.find(x=>x.id===arrival); o.stage=2;o.status='检测中';saveOrders();toast('服务开始已确认');render();return; }
  if (e.target.closest('[data-edit]')) return openModal('修改预约', '<p>正式版本中可修改时间、地址和联系人；设备与故障描述的变化会保留修改记录。</p><div class="form-actions"><button class="btn primary" data-close>知道了</button></div>');
  if (e.target.closest('[data-consult-order]')) { state.consultType='订单咨询'; go('consult'); return; }
  if (e.target.closest('[data-engineer-report]')) return openModal('上传检测信息', `<form id="report-form"><div class="field"><label>故障原因</label><textarea class="textarea" name="cause" required placeholder="检测现象、测量结果与故障定位"></textarea></div><div class="field" style="margin-top:14px"><label>维修建议</label><textarea class="textarea" name="solution" required placeholder="维修项目、配件方案和预计时效"></textarea></div><div class="field" style="margin-top:14px"><label>预计报价</label><input class="input" name="price" type="number" min="0" required placeholder="金额（元）"></div><div class="upload-zone" style="margin-top:14px">＋ 上传检测照片（演示）</div><div class="form-actions"><button class="btn primary" type="submit">提交报告与报价</button></div></form>`);
  const cc = e.target.closest('[data-confirm-cancel]')?.dataset.confirmCancel; if (cc) { const o=state.orders.find(x=>x.id===cc);o.status='已取消';saveOrders();document.getElementById('modal')?.remove();toast('订单已取消');go('orders');return; }
  const cp = e.target.closest('[data-confirm-pay]')?.dataset.confirmPay; if (cp) { const o=state.orders.find(x=>x.id===cp);o.status='维修中';o.stage=4;saveOrders();document.getElementById('modal')?.remove();toast('支付成功，维修已开始');render();return; }
  if (e.target.closest('[data-close]')) { e.target.closest('.modal-backdrop')?.remove(); return; }
  if (e.target.closest('[data-demo]')) toast('此功能已纳入正式版规划');
});

document.addEventListener('submit', e => {
  if (e.target.id === 'booking-form') {
    e.preventDefault(); const f = new FormData(e.target);
    const order = { id:'WX'+new Date().toISOString().slice(0,10).replaceAll('-','')+String(Math.floor(Math.random()*900+100)), device:f.get('deviceModel'), problem:f.get('problem'), mode:state.bookingMode, time:f.get('date')+' '+f.get('slot'), status:'待确认预约', stage:0, phone:String(f.get('phone')).replace(/(\d{3})\d{4}(\d+)/,'$1****$2'), createdAt:new Date().toLocaleString('zh-CN') };
    state.orders.unshift(order); saveOrders(); state.selectedOrder=order.id; toast('预约提交成功'); go('order');
  }
  if (e.target.id === 'chat-form') {
    e.preventDefault(); const f=new FormData(e.target); const msg=f.get('message').trim(); if(!msg)return;
    state.messages.push({from:'user',text:msg},{from:'agent',text:'已记录您的问题。为了判断更准确，您可以补充设备型号、故障发生时间，以及是否还能正常开机。'}); render();
  }
  if (e.target.id === 'report-form') {
    e.preventDefault(); const f=new FormData(e.target); const o=state.orders[0]; o.report={cause:f.get('cause'),solution:f.get('solution'),engineer:'当前工程师',warranty:'维修项目 90 天质保',photos:1};o.quote=[{name:f.get('solution'),price:Number(f.get('price'))}];o.status='待确认报价';o.stage=3;saveOrders();document.getElementById('modal')?.remove();toast('检测报告已提交给客户');state.role='customer';state.selectedOrder=o.id;go('order');
  }
});

window.addEventListener('hashchange', () => { state.route=location.hash.replace('#/','')||'home'; render(); });
render();
