(function () {
  'use strict';

  var storedLang = localStorage.getItem('lang');
  var lang = storedLang === 'en' || storedLang === 'vi'
    ? storedLang
    : (navigator.languages && navigator.languages.some(function (value) { return value.indexOf('vi') === 0; }) ? 'vi' : 'en');
  var messages = {
    vi: {
      legalAria: 'Thông tin pháp lý', moit: 'Xác nhận Bộ Công Thương',
      month: 'tháng', year: 'năm', configUnavailable: 'Không tải được cấu hình công khai.',
      supportSending: 'Đang gửi yêu cầu…', supportFailed: 'Không thể gửi yêu cầu',
      supportSuccess: 'Đã tiếp nhận. Mã yêu cầu của bạn: ',
      supportRetry: 'Không thể gửi yêu cầu. Vui lòng thử lại hoặc liên hệ email hỗ trợ.',
    },
    en: {
      legalAria: 'Legal information', moit: 'Ministry of Industry and Trade confirmation',
      month: 'month', year: 'year', configUnavailable: 'Public configuration is unavailable.',
      supportSending: 'Sending request…', supportFailed: 'Unable to send request',
      supportSuccess: 'Received. Your request reference is: ',
      supportRetry: 'Unable to send the request. Please try again or contact support by email.',
    },
  };
  var text = messages[lang];
  var links = [
    ['/owner-info/', 'Thông tin chủ quản', 'Owner information'],
    ['/terms/', 'Điều khoản sử dụng', 'Terms of service'],
    ['/privacy/', 'Chính sách bảo mật', 'Privacy policy'],
    ['/payment-policy/', 'Chính sách thanh toán', 'Payment policy'],
    ['/refund-policy/', 'Hủy và hoàn tiền', 'Cancellation and refunds'],
    ['/support/', 'Liên hệ / khiếu nại', 'Support / complaints'],
  ];

  function applyTranslations() {
    document.documentElement.lang = lang;
    document.querySelectorAll('[data-vi][data-en]').forEach(function (node) {
      node.textContent = lang === 'en' ? node.dataset.en : node.dataset.vi;
    });
    var titleNode = document.querySelector('[data-title-vi][data-title-en]');
    if (titleNode) document.title = lang === 'en' ? titleNode.dataset.titleEn : titleNode.dataset.titleVi;
  }

  function ensureStyles() {
    if (document.querySelector('link[data-lumora-legal-style]')) return;
    var style = document.createElement('link');
    style.rel = 'stylesheet';
    style.href = '/shared/css/legal.css';
    style.dataset.lumoraLegalStyle = 'true';
    document.head.appendChild(style);
  }

  function createFooter() {
    if (document.querySelector('.lumora-legal-footer') || document.body.dataset.noLegalFooter === 'true') return;
    var footer = document.createElement('footer');
    footer.className = 'lumora-legal-footer';
    footer.setAttribute('aria-label', text.legalAria);
    var inner = document.createElement('div');
    inner.className = 'legal-footer-inner';
    var linkWrap = document.createElement('div');
    linkWrap.className = 'legal-footer-links';
    links.forEach(function (item) {
      var anchor = document.createElement('a');
      anchor.href = item[0];
      anchor.textContent = lang === 'en' ? item[2] : item[1];
      linkWrap.appendChild(anchor);
    });
    var owner = document.createElement('div');
    owner.className = 'legal-footer-owner';
    owner.hidden = true;
    owner.dataset.footerOwner = 'true';
    var copy = document.createElement('div');
    copy.className = 'legal-footer-copy';
    copy.textContent = '© ' + new Date().getFullYear() + ' Lumora · lumora.nguyenvuongw.id.vn';
    inner.appendChild(linkWrap);
    inner.appendChild(owner);
    inner.appendChild(copy);
    footer.appendChild(inner);
    document.body.appendChild(footer);
  }

  function setText(selector, value) {
    document.querySelectorAll(selector).forEach(function (node) {
      var row = node.closest('[data-config-row]');
      var group = row && row.dataset.configGroup;
      if (!value) {
        if (group) document.querySelectorAll('[data-config-group="' + group + '"]').forEach(function (item) { item.hidden = true; });
        else if (row) row.hidden = true;
        return;
      }
      node.textContent = value;
      if (group) document.querySelectorAll('[data-config-group="' + group + '"]').forEach(function (item) { item.hidden = false; });
      else if (row) row.hidden = false;
    });
  }

  function applyConfig(config) {
    var owner = config.owner || {};
    var translated = lang === 'en' && config.translations && config.translations.en
      ? config.translations.en
      : config;
    var legalNotices = translated.legalNotices || {};
    setText('[data-owner-name]', owner.name);
    setText('[data-owner-tax-id]', owner.taxId);
    setText('[data-owner-address]', owner.address);
    setText('[data-tax-notice]', translated.taxNotice);
    setText('[data-support-response-notice]', legalNotices.supportResponseNotice);
    setText('[data-refund-timeline-notice]', legalNotices.refundTimelineNotice);
    setText('[data-refund-method-notice]', legalNotices.refundMethodNotice);
    document.querySelectorAll('[data-missing-notice]').forEach(function (node) {
      var value = node.dataset.missingNotice === 'taxNotice'
        ? translated.taxNotice
        : legalNotices[node.dataset.missingNotice];
      node.hidden = Boolean(value);
    });
    document.querySelectorAll('[data-support-email]').forEach(function (node) {
      var row = node.closest('[data-config-row]');
      var group = row && row.dataset.configGroup;
      if (!owner.supportEmail) {
        if (group) document.querySelectorAll('[data-config-group="' + group + '"]').forEach(function (item) { item.hidden = true; });
        else if (row) row.hidden = true;
        return;
      }
      node.textContent = owner.supportEmail;
      if (node.tagName === 'A') node.href = 'mailto:' + owner.supportEmail;
      if (group) document.querySelectorAll('[data-config-group="' + group + '"]').forEach(function (item) { item.hidden = false; });
      else if (row) row.hidden = false;
    });
    document.querySelectorAll('[data-support-phone]').forEach(function (node) {
      var row = node.closest('[data-config-row]');
      var group = row && row.dataset.configGroup;
      if (!owner.supportPhone) {
        if (group) document.querySelectorAll('[data-config-group="' + group + '"]').forEach(function (item) { item.hidden = true; });
        else if (row) row.hidden = true;
        return;
      }
      node.textContent = owner.supportPhone;
      if (node.tagName === 'A') node.href = 'tel:' + owner.supportPhone.replace(/[^+\d]/g, '');
      if (group) document.querySelectorAll('[data-config-group="' + group + '"]').forEach(function (item) { item.hidden = false; });
      else if (row) row.hidden = false;
    });
    document.querySelectorAll('[data-footer-owner]').forEach(function (node) {
      if (!owner.name && !owner.address) return;
      node.textContent = [owner.name, owner.address].filter(Boolean).join(' · ');
      node.hidden = false;
    });
    document.querySelectorAll('footer').forEach(function (footer) {
      var wrap = footer.querySelector('.links, .legal-footer-links');
      if (!wrap || wrap.querySelector('[data-moit-link]')) return;
      var link = document.createElement('a');
      link.dataset.moitLink = 'true'; link.hidden = true;
      link.rel = 'noopener noreferrer'; link.target = '_blank';
      link.textContent = text.moit; wrap.appendChild(link);
    });
    document.querySelectorAll('[data-moit-link]').forEach(function (node) {
      if (!config.moitNotificationUrl) { node.hidden = true; return; }
      node.href = config.moitNotificationUrl;
      node.hidden = false;
    });
    document.querySelectorAll('[data-public-plan-list]').forEach(function (node) {
      node.replaceChildren();
      Object.entries(config.plans || {})
        .filter(function (entry) { return entry[0] !== 'free'; })
        .sort(function (left, right) { return (left[1].rank || 0) - (right[1].rank || 0); })
        .forEach(function (entry) {
        var plan = entry[1];
        var card = document.createElement('div'); card.className = 'legal-card';
        var title = document.createElement('strong'); title.textContent = plan.label;
        var price = document.createElement('p');
        price.textContent = Number(plan.monthly).toLocaleString(lang === 'en' ? 'en-US' : 'vi-VN') + 'đ / ' + text.month
          + ' · ' + Number(plan.yearly).toLocaleString(lang === 'en' ? 'en-US' : 'vi-VN') + 'đ / ' + text.year;
        card.append(title, price); node.appendChild(card);
      });
    });
    document.dispatchEvent(new CustomEvent('lumora:compliance-ready', { detail: config }));
  }

  window.LumoraPublicI18n = { lang: lang, text: text };
  applyTranslations();
  ensureStyles();
  createFooter();
  window.LumoraPublicConfig = fetch('/compliance/public', { headers: { 'X-Activity-Opt-Out': 'true' } })
    .then(function (response) { if (!response.ok) throw new Error('config unavailable'); return response.json(); })
    .then(function (body) { applyConfig(body.meta || {}); return body.meta || {}; })
    .catch(function () { return { owner: {}, payments: { enabled: false }, plans: {} }; });
})();
