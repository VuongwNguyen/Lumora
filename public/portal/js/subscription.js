// public/portal/js/subscription.js
(function () {
  const token = localStorage.getItem('token');

  const PLANS = {
    plus: { label: 'Plus',  monthly: 10000, yearly: 109000, features: () => [window.t.subFeatureThemes] },
    pro:  { label: 'Pro',   monthly: 29000, yearly: 189000, features: () => [window.t.subFeatureThemes, window.t.subFeatureMusic, window.t.subFeatureCaption] },
  };
  const PLAN_RANK = { plus: 1, pro: 2 };

  let selectedPeriod = 'monthly';

  function fmtVND(amount) {
    return amount.toLocaleString('vi-VN') + 'd';
  }

  function showToast(msg, type) {
    const el = document.getElementById('toast');
    el.textContent = msg;
    el.className = 'toast ' + (type || '');
    el.classList.add('show');
    setTimeout(function () { el.classList.remove('show'); }, 3500);
  }

  // Handle ?payment= query param
  const params = new URLSearchParams(window.location.search);
  if (params.get('payment') === 'success') {
    showToast(window.t.subPaySuccess, 'success');
    history.replaceState({}, '', '/portal/');
  } else if (params.get('payment') === 'cancel') {
    showToast(window.t.subPayCancel, 'error');
    history.replaceState({}, '', '/portal/');
  }

  function el(tag, className) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    return node;
  }

  function renderCurrentPlan(sub) {
    const div = el('div', 'sub-current');
    const label = el('div', 'plan-label');
    const planInfo = PLANS[sub.plan];
    label.textContent = (planInfo ? planInfo.label : sub.plan) + ' Plan';
    const expiry = el('div', 'plan-expiry');
    expiry.textContent = window.t.subExpiry(new Date(sub.expiredAt).toLocaleDateString('vi-VN'));
    div.appendChild(label);
    div.appendChild(expiry);
    return div;
  }

  function renderPeriodToggle(sub) {
    const toggle = el('div', 'period-toggle');
    ['monthly', 'yearly'].forEach(function (p) {
      const btn = el('button', 'period-btn' + (p === selectedPeriod ? ' active' : ''));
      btn.textContent = p === 'monthly' ? window.t.subPeriodMonthly : window.t.subPeriodYearly;
      btn.addEventListener('click', function () {
        selectedPeriod = p;
        render(sub);
      });
      toggle.appendChild(btn);
    });
    return toggle;
  }

  function renderPlanCard(planKey, plan, sub) {
    const card = el('div', 'plan-card');

    const nameEl = el('div', 'plan-name');
    nameEl.textContent = plan.label;

    const featuresEl = el('div', 'plan-features');
    const maxLine = document.createElement('div');
    maxLine.textContent = window.t.subMaxGalaxies(planKey === 'plus' ? '3' : '10');
    maxLine.style.fontWeight = '500';
    featuresEl.appendChild(maxLine);
    plan.features().forEach(function (f) {
      const line = document.createElement('div');
      line.textContent = f;
      featuresEl.appendChild(line);
    });

    const priceEl = el('div', 'plan-price');
    const strong = document.createElement('strong');
    strong.textContent = fmtVND(plan[selectedPeriod]);
    priceEl.appendChild(strong);
    const periodText = document.createTextNode(' ' + window.t.subPeriodSuffix(selectedPeriod));
    priceEl.appendChild(periodText);

    const isCurrent = sub && sub.plan === planKey;
    const currentRank = sub ? (PLAN_RANK[sub.plan] || 0) : 0;
    const cardRank = PLAN_RANK[planKey] || 0;
    const isIncluded = currentRank > cardRank;

    const btn = el('button', 'btn-subscribe');
    if (isIncluded) {
      btn.textContent = window.t.subIncluded;
      btn.disabled = true;
    } else {
      btn.textContent = isCurrent ? window.t.subRenew : window.t.subUpgrade(plan.label);
      btn.addEventListener('click', function () {
        handleSubscribe(btn, planKey, selectedPeriod, plan.label);
      });
    }

    card.appendChild(nameEl);
    card.appendChild(featuresEl);
    card.appendChild(priceEl);
    card.appendChild(btn);
    return card;
  }

  function render(sub) {
    const section = document.getElementById('sub-section');
    while (section.firstChild) section.removeChild(section.firstChild);

    if (sub) {
      section.appendChild(renderCurrentPlan(sub));
    }

    section.appendChild(renderPeriodToggle(sub));

    const grid = el('div', 'sub-plans');
    Object.keys(PLANS).forEach(function (planKey) {
      grid.appendChild(renderPlanCard(planKey, PLANS[planKey], sub));
    });
    section.appendChild(grid);
  }

  function updatePlanBadges(sub) {
    const planLabel = sub ? (PLANS[sub.plan] ? PLANS[sub.plan].label.toUpperCase() : sub.plan.toUpperCase()) : null;
    // admin hiện "ADMIN" thay vì plan name

    // Badge trong header (cạnh email)
    const userInfoEl = document.getElementById('user-email');
    if (userInfoEl) {
      let badge = document.getElementById('plan-badge-header');
      if (!badge) {
        badge = document.createElement('span');
        badge.id = 'plan-badge-header';
        badge.className = 'plan-badge';
        userInfoEl.appendChild(badge);
      }
      badge.textContent = planLabel || '';
      badge.style.display = planLabel ? '' : 'none';
    }

    // Badge trên tab button
    const tabBtn = document.querySelector('.tab-btn[data-tab="subscription"]');
    if (tabBtn) {
      let tabText = tabBtn.querySelector('.tab-text');
      let tabBadge = tabBtn.querySelector('.plan-badge');
      if (!tabText) {
        // Wrap existing text in span
        const text = document.createElement('span');
        text.className = 'tab-text';
        text.textContent = 'Subscription';
        while (tabBtn.firstChild) tabBtn.removeChild(tabBtn.firstChild);
        tabBtn.appendChild(text);
      }
      let badge = tabBtn.querySelector('.plan-badge');
      if (!badge) {
        badge = document.createElement('span');
        badge.className = 'plan-badge';
        tabBtn.appendChild(badge);
      }
      badge.textContent = planLabel ? planLabel + ' ✓' : '';
      badge.style.display = planLabel ? '' : 'none';
    }
  }

  async function loadSubscription() {
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    const isPrivileged = user.role === 'admin' || user.role === 'partner';

    const section = document.getElementById('sub-section');
    while (section.firstChild) section.removeChild(section.firstChild);
    const loading = el('div', 'empty');
    loading.textContent = window.t.subLoading;
    section.appendChild(loading);

    try {
      const res = await fetch('/payment/status', {
        headers: { 'Authorization': 'Bearer ' + token },
      });
      if (res.status === 401) return;
      const data = await res.json();
      const sub = data.meta || null;
      render(sub);
      if (!isPrivileged) updatePlanBadges(sub);
    } catch {
      while (section.firstChild) section.removeChild(section.firstChild);
      const errEl = el('div', 'empty');
      errEl.textContent = window.t.subLoadError;
      section.appendChild(errEl);
    }
  }

  // Fetch status lúc load trang để hiện badge ngay (không cần click tab)
  async function initBadges() {
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    if (user.role === 'admin' || user.role === 'partner') {
      updatePlanBadges({ plan: user.role, expiredAt: null });
      return;
    }
    try {
      const res = await fetch('/payment/status', {
        headers: { 'Authorization': 'Bearer ' + token },
      });
      if (res.status === 401) return;
      const data = await res.json();
      updatePlanBadges(data.meta || null);
    } catch { /* silent */ }
  }

  initBadges();

  async function handleSubscribe(btn, plan, period, planLabel) {
    const originalText = btn.textContent;
    btn.disabled = true;
    btn.textContent = window.t.subProcessing;
    try {
      const res = await fetch('/payment/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + token,
        },
        body: JSON.stringify({ plan: plan, period: period }),
      });
      const data = await res.json();
      if (!res.ok) {
        showToast(data.message || window.t.subErrCreate, 'error');
        btn.disabled = false;
        btn.textContent = originalText;
        return;
      }
      window.location.href = data.meta.checkoutUrl;
    } catch {
      showToast(window.t.subErrConnect, 'error');
      btn.disabled = false;
      btn.textContent = originalText;
    }
  }

  window._loadSubscription = loadSubscription;
})();
