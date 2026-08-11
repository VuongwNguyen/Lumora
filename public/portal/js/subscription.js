(function () {
  'use strict';

  const token = localStorage.getItem('token');
  const FEATURE_LABELS = {
    themes: 'Giao diện màu sắc', music: 'Nhạc nền', text: 'Caption và lời nhắn',
    fall_universe: 'Chuyển vũ trụ Fall Through Memories',
  };
  let plans = {};
  let taxNotice = '';
  let paymentConfig = { enabled: false, configurationComplete: false };
  let selectedPeriod = 'monthly';
  let currentSubscription = null;
  let developmentBypass = false;
  let entitlementAccessMode = 'subscription';
  let historyPage = 1;
  let checkoutState = null;

  function fmtVND(amount) { return Number(amount || 0).toLocaleString('vi-VN') + 'đ'; }
  function fmtDate(value) { return value ? new Date(value).toLocaleString('vi-VN') : '—'; }
  function el(tag, className) { const node = document.createElement(tag); if (className) node.className = className; return node; }
  function showToast(msg, type) {
    const node = document.getElementById('toast');
    node.textContent = msg; node.className = 'toast ' + (type || ''); node.classList.add('show');
    setTimeout(function () { node.classList.remove('show'); }, 4500);
  }

  function benefits(plan) {
    return [`Tối đa ${plan.maxGalaxies} galaxy`]
      .concat((plan.features || []).map(key => FEATURE_LABELS[key] || key))
      .concat(['Upload ảnh không giới hạn', 'Chia sẻ link']);
  }

  async function loadPublicConfig() {
    const response = await fetch('/compliance/public');
    if (!response.ok) throw new Error('Không tải được cấu hình gói');
    const body = await response.json();
    plans = body.meta?.plans || {};
    taxNotice = body.meta?.taxNotice || '';
    paymentConfig = body.meta?.payments || paymentConfig;
  }

  function renderCurrentPlan(sub) {
    const div = el('div', 'sub-current');
    const label = el('div', 'plan-label');
    label.textContent = (plans[sub.plan]?.label || sub.plan) + ' Plan';
    const expiry = el('div', 'plan-expiry');
    expiry.textContent = 'Có hiệu lực đến ' + new Date(sub.expiredAt).toLocaleDateString('vi-VN');
    div.append(label, expiry); return div;
  }

  function renderPeriodToggle() {
    const toggle = el('div', 'period-toggle');
    ['monthly', 'yearly'].forEach(function (period) {
      const button = el('button', 'period-btn' + (period === selectedPeriod ? ' active' : ''));
      button.type = 'button'; button.dataset.trackAction = 'Subscription Period Select';
      button.dataset.trackId = 'period_' + period;
      button.textContent = period === 'monthly' ? 'Theo tháng' : 'Theo năm';
      button.addEventListener('click', function () { selectedPeriod = period; renderPlans(); });
      toggle.appendChild(button);
    });
    return toggle;
  }

  function renderPlanCard(planKey, plan) {
    const card = el('div', 'plan-card');
    const name = el('div', 'plan-name'); name.textContent = plan.label;
    const featureList = el('div', 'plan-features');
    benefits(plan).forEach(function (value) { const line = document.createElement('div'); line.textContent = value; featureList.appendChild(line); });
    const price = el('div', 'plan-price');
    const strong = document.createElement('strong'); strong.textContent = fmtVND(plan[selectedPeriod]);
    price.append(strong, document.createTextNode(selectedPeriod === 'monthly' ? ' / tháng' : ' / năm'));
    const currentRank = currentSubscription ? (plans[currentSubscription.plan]?.rank || 0) : 0;
    const cardRank = plan.rank || 0;
    const button = el('button', 'btn-subscribe'); button.type = 'button'; button.dataset.plan = planKey;
    button.dataset.trackAction = 'Subscription Review Open';
    if (developmentBypass) {
      button.classList.add('dev-action');
      button.textContent = currentSubscription?.plan === planKey ? 'DEV · Gia hạn ' + plan.label : 'DEV · Kích hoạt ' + plan.label;
      button.addEventListener('click', function () { openCheckoutReview(planKey); });
    } else if (currentRank > cardRank) {
      button.textContent = 'Đã bao gồm trong gói hiện tại'; button.disabled = true; button.dataset.blockedReason = 'already_included';
    } else if (!paymentConfig.enabled) {
      button.textContent = 'Thanh toán đang được hoàn thiện'; button.disabled = true; button.dataset.blockedReason = 'payments_disabled';
    } else {
      button.textContent = currentSubscription?.plan === planKey ? 'Gia hạn ' + plan.label : 'Nâng cấp ' + plan.label;
      button.addEventListener('click', function () { openCheckoutReview(planKey); });
    }
    card.append(name, featureList, price, button); return card;
  }

  function renderPlans() {
    const section = document.getElementById('sub-section'); section.replaceChildren();
    if (developmentBypass) {
      const devNotice = el('div', 'dev-bypass-notice');
      devNotice.textContent = 'DEV MODE · Đã mở khóa tính năng. Nút gói bên dưới tạo giao dịch mô phỏng trong local DB và không gọi PayOS.';
      section.appendChild(devNotice);
    } else if (entitlementAccessMode === 'admin' || entitlementAccessMode === 'partner') {
      const privilegedNotice = el('div', 'dev-bypass-notice');
      privilegedNotice.textContent = entitlementAccessMode === 'admin'
        ? 'ADMIN · Backend đã cấp trực tiếp toàn bộ tính năng và không áp dụng giới hạn gói.'
        : 'PARTNER · Backend đã cấp trực tiếp toàn bộ tính năng và không áp dụng giới hạn gói.';
      section.appendChild(privilegedNotice);
    }
    if (currentSubscription) section.appendChild(renderCurrentPlan(currentSubscription));
    if (!paymentConfig.enabled && !developmentBypass) {
      const notice = el('div', 'payment-disabled-notice');
      notice.textContent = 'Tính năng thanh toán đang được hoàn thiện. Bạn vẫn có thể sử dụng gói Free và xem thông tin các gói.';
      section.appendChild(notice);
    }
    const plansSection = el('section', 'subscription-plans-section');
    const plansHeader = el('div', 'subscription-section-header');
    const plansCopy = document.createElement('div');
    const plansTitle = document.createElement('h2'); plansTitle.textContent = 'Gói dịch vụ';
    const plansHint = document.createElement('p'); plansHint.textContent = 'So sánh quyền lợi và chọn chu kỳ phù hợp.';
    plansCopy.append(plansTitle, plansHint);
    plansHeader.append(plansCopy, renderPeriodToggle());
    plansSection.appendChild(plansHeader);
    const grid = el('div', 'sub-plans');
    Object.entries(plans)
      .filter(([key]) => key !== 'free')
      .sort(([, left], [, right]) => (left.rank || 0) - (right.rank || 0))
      .forEach(([key, plan]) => grid.appendChild(renderPlanCard(key, plan)));
    plansSection.appendChild(grid);
    section.appendChild(plansSection);
    const history = el('section', 'history-section'); history.id = 'payment-history'; section.appendChild(history);
    loadHistory(historyPage);
  }

  function expectedDates() {
    const now = new Date();
    const base = currentSubscription?.expiredAt && new Date(currentSubscription.expiredAt) > now ? new Date(currentSubscription.expiredAt) : now;
    const end = new Date(base);
    if (selectedPeriod === 'monthly') end.setMonth(end.getMonth() + 1); else end.setFullYear(end.getFullYear() + 1);
    return { end };
  }

  function ensureCheckoutDialog() {
    let overlay = document.getElementById('checkout-overlay');
    if (overlay) return overlay;
    overlay = el('div', 'checkout-overlay'); overlay.id = 'checkout-overlay'; overlay.hidden = true;
    overlay.innerHTML = '<section class="checkout-dialog" role="dialog" aria-modal="true" aria-labelledby="checkout-title">' +
      '<h2 id="checkout-title">Rà soát đơn hàng</h2><p class="checkout-intro">Kiểm tra thông tin trước khi chuyển sang PayOS.</p>' +
      '<dl class="checkout-summary" id="checkout-summary"></dl><ul class="checkout-benefits" id="checkout-benefits"></ul>' +
      '<div class="checkout-links"><a href="/terms/" target="_blank">Điều khoản</a><a href="/payment-policy/" target="_blank">Chính sách thanh toán</a><a href="/refund-policy/" target="_blank">Chính sách hoàn tiền</a></div>' +
      '<label class="checkout-consent"><input id="checkout-consent" type="checkbox"><span>Tôi đã đọc và đồng ý với Điều khoản sử dụng, Chính sách thanh toán và Chính sách hoàn tiền.</span></label>' +
      '<div class="checkout-error" id="checkout-error" role="alert"></div><div class="checkout-actions"><button type="button" class="checkout-back">Quay lại / sửa lựa chọn</button><button type="button" class="checkout-confirm" disabled></button></div></section>';
    document.body.appendChild(overlay);
    const consent = overlay.querySelector('#checkout-consent');
    consent.addEventListener('change', function () { overlay.querySelector('.checkout-confirm').disabled = !consent.checked; });
    overlay.querySelector('.checkout-back').addEventListener('click', closeCheckoutReview);
    overlay.querySelector('.checkout-confirm').addEventListener('click', confirmCheckout);
    overlay.addEventListener('click', function (event) { if (event.target === overlay) closeCheckoutReview(); });
    document.addEventListener('keydown', function (event) {
      if (overlay.hidden) return;
      if (event.key === 'Escape') { closeCheckoutReview(); return; }
      if (event.key !== 'Tab') return;
      const focusable = Array.from(overlay.querySelectorAll('a[href], button:not([disabled]), input:not([disabled])'));
      if (!focusable.length) return;
      const first = focusable[0]; const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    });
    return overlay;
  }

  function openCheckoutReview(planKey) {
    const plan = plans[planKey]; if (!plan || (!paymentConfig.enabled && !developmentBypass)) return;
    const dates = expectedDates();
    checkoutState = { planKey, period: selectedPeriod, idempotencyKey: crypto.randomUUID ? crypto.randomUUID() : Date.now() + '-' + Math.random().toString(16).slice(2), opener: document.activeElement, processing: false };
    const overlay = ensureCheckoutDialog();
    overlay.querySelector('.checkout-intro').textContent = developmentBypass
      ? 'Mô phỏng kích hoạt gói trong môi trường DEV. Yêu cầu này không gọi PayOS và không thu tiền thật.'
      : 'Kiểm tra thông tin trước khi chuyển sang PayOS.';
    const activation = developmentBypass ? 'Ngay sau khi xác nhận DEV' : 'Ngay sau khi xác nhận thanh toán';
    const tax = developmentBypass ? 'Không áp dụng cho giao dịch mô phỏng DEV' : taxNotice;
    const rows = [['Gói', plan.label], ['Chu kỳ', selectedPeriod === 'monthly' ? '1 tháng' : '1 năm'], ['Số tiền', fmtVND(plan[selectedPeriod])], ['Kích hoạt dự kiến', activation], ['Có hiệu lực đến', dates.end.toLocaleDateString('vi-VN')], ['Gia hạn', 'Không tự động gia hạn'], ['Thuế / phí', tax]];
    const summary = overlay.querySelector('#checkout-summary'); summary.replaceChildren();
    rows.forEach(function (row) { const dt = document.createElement('dt'); const dd = document.createElement('dd'); dt.textContent = row[0]; dd.textContent = row[1]; summary.append(dt, dd); });
    const list = overlay.querySelector('#checkout-benefits'); list.replaceChildren();
    benefits(plan).forEach(function (value) { const item = document.createElement('li'); item.textContent = value; list.appendChild(item); });
    overlay.querySelector('#checkout-consent').checked = false;
    overlay.querySelector('#checkout-error').textContent = '';
    const confirm = overlay.querySelector('.checkout-confirm');
    confirm.textContent = developmentBypass ? 'DEV · Kích hoạt ' + plan.label : 'Thanh toán ' + fmtVND(plan[selectedPeriod]);
    confirm.disabled = true;
    overlay.hidden = false; overlay.querySelector('.checkout-back').focus();
    window.LumoraActivity?.log({ action: 'Payment Order Review Viewed', feature: 'payment', description: { plan: planKey, period: selectedPeriod } });
  }

  function closeCheckoutReview() {
    if (checkoutState?.processing) return;
    const overlay = ensureCheckoutDialog();
    const opener = checkoutState?.opener; overlay.hidden = true; checkoutState = null;
    if (opener && typeof opener.focus === 'function') opener.focus();
    window.LumoraActivity?.log({ action: 'Payment Order Review Closed', feature: 'payment' });
  }

  async function confirmCheckout() {
    if (!checkoutState) return;
    const overlay = ensureCheckoutDialog(); const confirm = overlay.querySelector('.checkout-confirm');
    checkoutState.processing = true;
    const request = { planKey: checkoutState.planKey, period: checkoutState.period, idempotencyKey: checkoutState.idempotencyKey };
    const simulated = developmentBypass;
    confirm.disabled = true; confirm.textContent = simulated ? 'Đang kích hoạt DEV…' : 'Đang tạo thanh toán…'; overlay.querySelector('#checkout-error').textContent = '';
    try {
      const response = await fetch(simulated ? '/payment/dev-activate' : '/payment/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token, 'Idempotency-Key': request.idempotencyKey },
        body: JSON.stringify({ plan: request.planKey, period: request.period }),
      });
      const body = await response.json();
      if (!response.ok) { const error = new Error(body.message || 'Không thể tạo thanh toán'); error.status = response.status; throw error; }
      if (simulated) {
        window.LumoraActivity?.log({ action: 'Development Subscription Activated', feature: 'subscription', status: 1, description: { plan: request.planKey, period: request.period, simulated: true } });
        overlay.hidden = true;
        checkoutState = null;
        historyPage = 1;
        showToast('Đã kích hoạt ' + (plans[request.planKey]?.label || request.planKey) + ' trong DEV. Không có tiền thật được thu.', 'success');
        await loadSubscription();
        return;
      }
      window.LumoraActivity?.log({ action: 'Payment Checkout Redirect', feature: 'payment', status: 1, description: { plan: request.planKey, period: request.period } });
      window.location.assign(body.meta.checkoutUrl);
    } catch (error) {
      if (!checkoutState) return;
      checkoutState.processing = false;
      if (error.status === 502 || (error.status === 409 && /đã được xử lý/.test(error.message))) {
        checkoutState.idempotencyKey = crypto.randomUUID ? crypto.randomUUID() : Date.now() + '-' + Math.random().toString(16).slice(2);
      }
      overlay.querySelector('#checkout-error').textContent = error.message || 'Không thể kết nối. Bạn có thể thử lại an toàn.';
      confirm.disabled = !overlay.querySelector('#checkout-consent').checked;
      const plan = plans[request.planKey];
      confirm.textContent = simulated ? 'Thử lại DEV · ' + plan.label : 'Thử lại · ' + fmtVND(plan[request.period]);
    }
  }

  const STATUS_LABELS = { pending: 'Chờ thanh toán', processing: 'Đang xử lý', paid: 'Đã thanh toán', cancelled: 'Đã hủy', failed: 'Thất bại' };
  function renderHistoryHeader(total) {
    const header = el('div', 'history-heading');
    const copy = document.createElement('div');
    const heading = document.createElement('h3'); heading.textContent = 'Lịch sử thanh toán';
    const hint = document.createElement('p');
    hint.textContent = total == null
      ? 'Theo dõi trạng thái các giao dịch của tài khoản này.'
      : total + ' giao dịch thuộc tài khoản này.';
    copy.append(heading, hint); header.appendChild(copy); return header;
  }
  async function loadHistory(page) {
    const container = document.getElementById('payment-history'); if (!container) return;
    container.replaceChildren(renderHistoryHeader());
    const loading = el('div', 'history-empty'); loading.textContent = 'Đang tải…'; container.appendChild(loading);
    try {
      const response = await fetch('/payment/history?page=' + page + '&limit=10', { headers: { Authorization: 'Bearer ' + token } });
      const body = await response.json(); if (!response.ok) throw new Error(body.message);
      const result = body.meta || { items: [], pagination: { page: 1, totalPages: 1, total: 0 } };
      container.replaceChildren(renderHistoryHeader(result.pagination.total));
      if (!result.items.length) { const empty = el('div', 'history-empty'); empty.textContent = 'Chưa có giao dịch.'; container.appendChild(empty); return; }
      const wrap = el('div', 'history-table-wrap'); const table = el('table', 'payment-history');
      table.innerHTML = '<thead><tr><th>Mã đơn</th><th>Gói / kỳ</th><th>Số tiền</th><th>Trạng thái</th><th>Thời gian</th><th>Hỗ trợ</th></tr></thead>';
      const tbody = document.createElement('tbody');
      result.items.forEach(function (item) {
        const row = document.createElement('tr');
        const values = [String(item.payosOrderCode), (plans[item.plan]?.label || item.plan) + ' · ' + (item.period === 'monthly' ? 'tháng' : 'năm'), fmtVND(item.amount)];
        values.forEach(function (value) { const cell = document.createElement('td'); cell.textContent = value; row.appendChild(cell); });
        const statusCell = document.createElement('td'); const status = el('span', 'payment-status ' + item.status); status.textContent = STATUS_LABELS[item.status] || item.status; statusCell.appendChild(status); row.appendChild(statusCell);
        const date = document.createElement('td'); date.textContent = fmtDate(item.paidAt || item.createdAt); row.appendChild(date);
        const help = document.createElement('td'); const link = document.createElement('a'); link.href = '/support/?type=payment&orderCode=' + encodeURIComponent(item.payosOrderCode); link.textContent = 'Liên hệ'; help.appendChild(link); row.appendChild(help);
        tbody.appendChild(row);
      });
      table.appendChild(tbody); wrap.appendChild(table); container.appendChild(wrap);
      const pager = el('div', 'history-pagination');
      const prev = document.createElement('button'); prev.type = 'button'; prev.textContent = '‹'; prev.disabled = result.pagination.page <= 1;
      const info = document.createElement('span'); info.textContent = 'Trang ' + result.pagination.page + '/' + result.pagination.totalPages + ' · ' + result.pagination.total + ' giao dịch';
      const next = document.createElement('button'); next.type = 'button'; next.textContent = '›'; next.disabled = result.pagination.page >= result.pagination.totalPages;
      prev.addEventListener('click', function () { historyPage -= 1; loadHistory(historyPage); }); next.addEventListener('click', function () { historyPage += 1; loadHistory(historyPage); });
      pager.append(prev, info, next); container.appendChild(pager);
    } catch {
      container.replaceChildren(renderHistoryHeader());
      const failed = el('div', 'history-empty error'); failed.textContent = 'Không tải được lịch sử. Vui lòng thử lại.'; container.appendChild(failed);
    }
  }

  function updatePlanBadges(sub) {
    const planLabel = sub ? (plans[sub.plan]?.label || sub.plan).toUpperCase() : '';
    const userInfo = document.getElementById('user-email');
    if (userInfo) { let badge = document.getElementById('plan-badge-header'); if (!badge) { badge = el('span', 'plan-badge'); badge.id = 'plan-badge-header'; userInfo.appendChild(badge); } badge.textContent = planLabel; badge.hidden = !planLabel; }
  }

  async function loadSubscription() {
    const section = document.getElementById('sub-section'); section.innerHTML = '<div class="empty">Đang tải…</div>';
    try {
      await loadPublicConfig();
      const response = await fetch('/payment/status', { headers: { Authorization: 'Bearer ' + token } });
      if (response.status === 401) return;
      const body = await response.json();
      developmentBypass = Boolean(body.meta?.developmentBypass);
      entitlementAccessMode = body.meta?.accessMode || 'subscription';
      currentSubscription = body.meta?._id ? body.meta : null;
      renderPlans(); updatePlanBadges(currentSubscription);
    } catch { section.innerHTML = '<div class="empty">Không tải được thông tin gói. Vui lòng thử lại.</div>'; }
  }

  const params = new URLSearchParams(location.search);
  if (params.get('payment') === 'success') { showToast('Đã quay lại từ PayOS. Lumora đang xác nhận giao dịch.', 'success'); history.replaceState({}, '', '/portal/'); }
  else if (params.get('payment') === 'cancel') { showToast('Thanh toán đã được hủy.', 'error'); history.replaceState({}, '', '/portal/'); }

  loadSubscription();
  window._loadSubscription = loadSubscription;
})();
