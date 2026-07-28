// ==UserScript==
// @name         Linux DO 登录助手
// @namespace    https://linux.do/
// @version      1.3.1
// @description  自动优先使用 Linux DO 登录，并在 Linux DO Connect 页面自动执行授权。
// @author       Codex
// @license      MIT
// @match        http://*/*
// @match        https://*/*
// @run-at       document-start
// @grant        GM_getValue
// @grant        GM_setValue
// ==/UserScript==

(() => {
  'use strict';

  if (window.top !== window.self) return;

  const SCRIPT_ID = 'linuxdo-auto-login-assistant';
  const STORAGE_KEY = `${SCRIPT_ID}:settings:v1`;
  const LOGO_DATA = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAPAAAADwCAMAAAAJixmgAAAACXBIWXMAAAAAAAAAAQCEeRdzAAADAFBMVEUAAAAcHB4cHB4cHB4cHB4cHB4cHB4cHB4cHB4cHB7w8PAcHB4cHB4cHB4cHB4cHB4cHB4cHB4cHB4cHB7w8PDw8PAcHB4cHB4cHB7w8PAcHB7w8PDw8PAcHB4cHB7w8PAcHB4cHB4cHB4cHB4cHB4cHB4cHB4cHB7w8PDw8PAcHB7w8PDw8PDw8PAcHB7w8PAcHB7w8PDw8PAcHB4cHB4cHB4cHB4cHB7w8PAcHB4cHB4cHB4cHB4cHB4cHB4cHB4cHB4cHB7w8PAcHB4cHB7w8PDw8PAcHB7w8PDw8PDw8PDw8PDw8PDw8PDw8PDw8PAcHB7w8PAcHB7w8PDw8PDw8PDw8PDw8PDw8PDw8PDw8PDw8PDw8PDw8PDw8PDw8PDw8PDw8PDw8PDw8PDw8PDw8PDw8PDw8PDw8PAcHB7/sANNTU/8vzrw7+weHiD/sQbv7+/s7Oz04bcmJij/tA7h4eHx7ODy6NC7u7tQUFH7wkb8wD39vC7m5ubx7eXy6tlvb3DT09Tz5MPBwcP22ZqOjo/304NlZWZXV1lCQkQgICL+txr+tRSVlZb40Hf5ymH6yFr7xVAuLjDc3Nza2trLy8upqaqkpKX126GCgoN6env5zGxbW10yMjQqKiygoKH21Yz21IlEREbV1dXU1NSIiIkAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAACY8YXIAAABAHRSTlMAXDgggEBkeKBo9kzEqZNg6PfL+1AyEPHRuRUS5QoF84oNBuGFGkMz/NrV0pmKLyokIxrs27pUpe46sJh8R1grtXG/v5ySfnVqZFc8IAkE6m3oW/ji4c7JsKylooVlXh0XBwYF3Hbddf//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////yZJmJwAAEABJREFUeJzlnftTW8fZx7/AqpEEGKFIgBB3G946xoAxbuvXYWx3nMy4BfuHujOdSaM46fiP6mRsx0o67UzdHwpKmEkytT2Y19MYMGA5TjA2FyPJQipIgI/JKwEdod2jo/sFSZzL9wdzjo600sdnz+6zzz77bAmKpMHl+t2dnV3jnf7HnUHXTBOWukzEfnz0vKektLTE2TBcpN9BCv4Nl5Zf7pq8Zwzm8OllnAVqe8InZ3EZh0IHjbgyZnCVNDYMSRvYXFM7/a3lF5m81XA59K/V1O1ecUgT+JPh2heDQEtWH7KEPmBtcw/ekBiwWb/2Nwveze3DFsDaUL3qkAywoWt2YJ9FWADYOma8ED+w4T3OhI58lDSADpf2G6+ogX+7WNGDqiQX1Yd9r5u5utfOt2D0+lFl8OCn+vJX2sVy3fOtxB8x4crUZvOXIgXurV1qbEx0QX1kzVC6WrryPTCDudArSwB8iwDcoTO/U9u6o9/xVs8l4O4BjjW5J8UH3N050dwc96r6yFppmecJnKk/zC2E/g+c2pbtnQTU/Zj/wD4tKuA/jf+yFOdiXtSQMrX2STbFcIuAs5Xb2g6+ib5wDqdPPey7Lhpgw7cX414783zjp4A/h8LmAZWq7vBYzMvk9IjBKw7gDzdrY17RtG8Y/28fJQYCnPsXnspn0ff5ImznP8eBA19cKC+PekHT4a95iIX9lvsQOLVSNRvFPICjLSMHC/ybxZiWSldV+xCh9jcPCjG7/T7hS2dxrPmrgwM2kqYm4XnnT8EFf6jLyZseAq3kLbvglX6Ygp6DAe59+3DU+XFPVk1yploA6oyPBS9cxvP/TBYf+JLudsjgZdIc+V54H/Irt7vsnTnB03x4zOIbKjKwuUQr4FW3vygcbkg7du3xZxGLxAK/2VFU4D++MQrOzPXjKLQ4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';
  const SCAN_DEBOUNCE = 250;
  const STABLE_WINDOW = 2000;
  const BUBBLE_SIZE = 30;
  const BUBBLE_HALF = BUBBLE_SIZE / 2;
  const BUBBLE_VISIBLE = 16;
  const CANDIDATE_SELECTOR = 'button, a[href], input[type="button"], input[type="submit"], [role="button"]';
  const DEFAULTS = Object.freeze({
    autoLogin: {
      enabled: true,
      delay: 3,
      policy: 'all',
      domains: [],
    },
    autoAuthorize: {
      enabled: true,
      delay: 3,
      policy: 'all',
      domains: [],
    },
    bubble: {
      side: 'right',
      y: 0.72,
    },
  });

  const FEATURE_META = Object.freeze({
    autoLogin: {
      title: '自动优先使用 L 站登录',
      shortTitle: 'L 站登录',
      countdown: '即将使用 Linux DO 登录',
    },
    autoAuthorize: {
      title: '自动执行授权',
      shortTitle: '自动授权',
      countdown: '即将允许 Linux DO 授权',
    },
  });

  const state = {
    settings: loadSettings(),
    rootHost: null,
    shadow: null,
    bubble: null,
    panel: null,
    toast: null,
    countdown: null,
    scanTimer: 0,
    observer: null,
    observing: false,
    observationTimer: 0,
    ignoredTargets: new WeakSet(),
    processedTargets: new WeakSet(),
    lastUrl: location.href,
    drag: null,
    editorFeature: null,
  };

  function cloneDefaults() {
    return JSON.parse(JSON.stringify(DEFAULTS));
  }

  function loadSettings() {
    let saved = null;
    try {
      if (typeof GM_getValue === 'function') saved = GM_getValue(STORAGE_KEY, null);
      else saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
    } catch (_) {
      saved = null;
    }

    const base = cloneDefaults();
    if (!saved || typeof saved !== 'object') return base;
    for (const key of ['autoLogin', 'autoAuthorize']) {
      const incoming = saved[key];
      if (!incoming || typeof incoming !== 'object') continue;
      base[key].enabled = typeof incoming.enabled === 'boolean' ? incoming.enabled : base[key].enabled;
      base[key].delay = clampDelay(incoming.delay);
      base[key].policy = ['all', 'blacklist', 'whitelist'].includes(incoming.policy)
        ? incoming.policy
        : base[key].policy;
      base[key].domains = normalizeDomainList(incoming.domains);
    }
    if (saved.bubble && typeof saved.bubble === 'object') {
      base.bubble.side = saved.bubble.side === 'left' ? 'left' : 'right';
      const y = Number(saved.bubble.y);
      base.bubble.y = Number.isFinite(y) ? Math.min(0.94, Math.max(0.06, y)) : base.bubble.y;
    }
    return base;
  }

  function saveSettings() {
    try {
      if (typeof GM_setValue === 'function') GM_setValue(STORAGE_KEY, state.settings);
      else localStorage.setItem(STORAGE_KEY, JSON.stringify(state.settings));
    } catch (_) {
      // Some pages disallow storage. The current session still remains functional.
    }
  }

  function clampDelay(value) {
    const number = Number(value);
    if (!Number.isFinite(number)) return 3;
    return Math.min(60, Math.max(0.5, Math.round(number * 10) / 10));
  }

  function normalizeHostname(value) {
    let input = String(value || '').trim().toLowerCase();
    if (!input) return '';
    const wildcard = input.startsWith('*.');
    if (wildcard) input = input.slice(2);
    try {
      if (/^[a-z][a-z\d+.-]*:\/\//i.test(input)) input = new URL(input).hostname;
    } catch (_) {
      return '';
    }
    input = input.split('/')[0].split(':')[0].replace(/^\.+|\.+$/g, '');
    if (!input || !/^[\p{L}\d.-]+$/u.test(input) || input.includes('..')) return '';
    return wildcard ? `*.${input}` : input;
  }

  function normalizeDomainList(value) {
    const raw = Array.isArray(value) ? value : String(value || '').split(/[\n,，]+/);
    return [...new Set(raw.map(normalizeHostname).filter(Boolean))];
  }

  function domainMatches(hostname, rule) {
    const host = String(hostname || '').toLowerCase();
    const normalized = normalizeHostname(rule);
    if (!host || !normalized) return false;
    const base = normalized.startsWith('*.') ? normalized.slice(2) : normalized;
    return host === base || host.endsWith(`.${base}`);
  }

  function domainAllowed(featureKey, hostname = location.hostname) {
    const config = state.settings[featureKey];
    if (!config?.enabled) return false;
    if (config.policy === 'all') return true;
    const listed = config.domains.some((rule) => domainMatches(hostname, rule));
    return config.policy === 'blacklist' ? !listed : listed;
  }

  function normalizedText(element) {
    const values = [
      element.textContent,
      element.getAttribute?.('aria-label'),
      element.getAttribute?.('title'),
      element.getAttribute?.('value'),
    ];
    return values
      .filter(Boolean)
      .join(' ')
      .toLowerCase()
      .replace(/[\s\u00a0_-]+/g, '');
  }

  function isVisibleAndEnabled(element) {
    if (!(element instanceof Element) || !element.isConnected) return false;
    if (element.matches(':disabled,[disabled],[aria-disabled="true"]')) return false;
    return !element.hidden && element.getClientRects().length > 0;
  }

  function collectCandidates() {
    return document.querySelectorAll(CANDIDATE_SELECTOR);
  }

  function findCandidate(candidates, predicate) {
    for (const element of candidates) {
      if (predicate(element)) return element;
    }
    return null;
  }

  function isOAuthPage() {
    return location.protocol === 'https:'
      && location.hostname === 'connect.linux.do'
      && location.pathname.startsWith('/oauth2/');
  }

  function findTarget() {
    const authorizeActive = isOAuthPage() && domainAllowed('autoAuthorize');
    const loginActive = domainAllowed('autoLogin');
    if (!authorizeActive && !loginActive) return null;
    const candidates = collectCandidates();
    if (authorizeActive) {
      const authorize = findCandidate(candidates, (element) => {
        const href = element instanceof HTMLAnchorElement ? element.getAttribute('href') || '' : '';
        const text = normalizedText(element);
        const matches = text === '允许' || text === '允许allow' || /\/oauth2\/approve\//i.test(href);
        return matches && isVisibleAndEnabled(element);
      });
      if (authorize) return { featureKey: 'autoAuthorize', element: authorize };
    }

    if (loginActive) {
      const login = findCandidate(candidates, (element) => {
        const text = normalizedText(element);
        const mentionsLinuxDo = text.includes('linuxdo');
        const expressesContinue = text.includes('继续') || text.includes('continue');
        const expressesUse = text.includes('使用') || text.includes('with');
        return mentionsLinuxDo && expressesContinue && expressesUse && isVisibleAndEnabled(element);
      });
      if (login) return { featureKey: 'autoLogin', element: login };
    }
    return null;
  }

  function scheduleScan() {
    if (state.scanTimer) return;
    state.scanTimer = window.setTimeout(() => {
      state.scanTimer = 0;
      scan();
    }, SCAN_DEBOUNCE);
  }

  function stopObservation() {
    state.observing = false;
    if (state.scanTimer) {
      window.clearTimeout(state.scanTimer);
      state.scanTimer = 0;
    }
    if (state.observer) {
      state.observer.disconnect();
      state.observer = null;
    }
    if (state.observationTimer) {
      window.clearTimeout(state.observationTimer);
      state.observationTimer = 0;
    }
  }

  function armObservationStop() {
    if (state.observationTimer) window.clearTimeout(state.observationTimer);
    state.observationTimer = window.setTimeout(stopObservation, STABLE_WINDOW);
  }

  function scan() {
    if (!document.documentElement) return;
    if (location.href !== state.lastUrl) {
      state.lastUrl = location.href;
      state.ignoredTargets = new WeakSet();
      state.processedTargets = new WeakSet();
      cancelCountdown(false);
    }
    if (state.countdown) return;
    const target = findTarget();
    if (!target) return;
    if (state.ignoredTargets.has(target.element) || state.processedTargets.has(target.element)) return;
    stopObservation();
    startCountdown(target.featureKey, target.element);
  }

  function startCountdown(featureKey, element) {
    cancelCountdown(false);
    const delay = clampDelay(state.settings[featureKey].delay);
    const countdown = {
      featureKey,
      element,
      startedAt: Date.now(),
      duration: delay * 1000,
      pageUrl: location.href,
      timer: null,
    };
    state.countdown = countdown;
    renderCountdown();
    requestAnimationFrame(() => positionCountdown(element));
    window.addEventListener('scroll', repositionCountdown, { passive: true, capture: true });
    countdown.timer = window.setInterval(renderCountdown, 100);
  }

  function renderCountdown() {
    const countdown = state.countdown;
    if (!countdown) return;
    const remaining = Math.max(0, countdown.duration - (Date.now() - countdown.startedAt));
    const progress = countdown.duration ? Math.max(0, remaining / countdown.duration) : 0;
    const seconds = Math.max(0, Math.ceil(remaining / 1000));
    ensureUi();
    state.toast.hidden = false;
    state.toast.querySelector('[data-role="count-title"]').textContent = FEATURE_META[countdown.featureKey].countdown;
    state.toast.querySelector('[data-role="count-number"]').textContent = String(seconds);
    state.toast.querySelector('[data-role="count-progress"]').style.transform = `scaleX(${progress})`;
    if (remaining > 0) return;
    window.clearInterval(countdown.timer);
    window.removeEventListener('scroll', repositionCountdown, true);
    state.countdown = null;
    hideCountdownToast();

    const stillAllowed = domainAllowed(countdown.featureKey)
      && countdown.pageUrl === location.href
      && isVisibleAndEnabled(countdown.element)
      && !state.ignoredTargets.has(countdown.element);
    if (!stillAllowed) {
      scheduleScan();
      return;
    }

    state.processedTargets.add(countdown.element);
    try {
      countdown.element.click();
    } catch (_) {
      state.processedTargets.delete(countdown.element);
    }
  }

  function cancelCountdown(ignoreTarget = true) {
    const countdown = state.countdown;
    if (!countdown) {
      hideCountdownToast();
      return;
    }
    if (countdown.timer) window.clearInterval(countdown.timer);
    window.removeEventListener('scroll', repositionCountdown, true);
    if (ignoreTarget && countdown.element) state.ignoredTargets.add(countdown.element);
    state.countdown = null;
    hideCountdownToast();
  }

  function hideCountdownToast() {
    if (state.toast) state.toast.hidden = true;
  }

  function repositionCountdown() {
    if (state.countdown) positionCountdown(state.countdown.element);
  }

  function positionCountdown(target) {
    if (!state.toast || state.toast.hidden || !target?.isConnected) return;
    const targetRect = target.getBoundingClientRect();
    const toastRect = state.toast.getBoundingClientRect();
    const gap = 10;
    const margin = 10;
    const width = Math.min(Math.max(300, Math.min(360, targetRect.width)), innerWidth - margin * 2);
    const height = toastRect.height;
    const fitsRight = targetRect.right + gap + width <= innerWidth - margin;
    const fitsLeft = targetRect.left - gap - width >= margin;
    let placement = 'below';
    let left;
    let top;

    if (fitsRight) {
      placement = 'right';
      left = targetRect.right + gap;
      top = Math.min(innerHeight - height - margin, Math.max(margin, targetRect.top + targetRect.height / 2 - height / 2));
    } else if (fitsLeft) {
      placement = 'left';
      left = targetRect.left - width - gap;
      top = Math.min(innerHeight - height - margin, Math.max(margin, targetRect.top + targetRect.height / 2 - height / 2));
    } else {
      const fitsBelow = targetRect.bottom + gap + height <= innerHeight - margin;
      placement = fitsBelow ? 'below' : 'above';
      left = Math.min(
        innerWidth - width - margin,
        Math.max(margin, targetRect.left + targetRect.width / 2 - width / 2),
      );
      top = fitsBelow
        ? Math.max(margin, targetRect.bottom + gap)
        : Math.max(margin, targetRect.top - height - gap);
    }
    state.toast.dataset.placement = placement;
    state.toast.style.width = `${width}px`;
    state.toast.style.left = `${left}px`;
    state.toast.style.top = `${top}px`;
  }

  function ensureUi() {
    if (state.rootHost?.isConnected) return;
    if (!document.documentElement) return;

    const host = document.createElement('div');
    host.id = SCRIPT_ID;
    host.setAttribute('data-linuxdo-helper', '');
    const shadow = host.attachShadow({ mode: 'open' });
    shadow.innerHTML = `${styles()}${shellMarkup()}`;
    document.documentElement.appendChild(host);

    state.rootHost = host;
    state.shadow = shadow;
    state.bubble = shadow.querySelector('[data-role="bubble"]');
    state.toast = shadow.querySelector('[data-role="countdown"]');

    bindUiEvents();
    positionBubble();
  }

  function shellMarkup() {
    return `
      <button class="bubble" data-role="bubble" type="button" aria-label="打开 Linux DO 登录助手设置" title="Linux DO 登录助手">
        <img class="bubble-logo" src="${LOGO_DATA}" alt="" aria-hidden="true">
      </button>
      <aside class="countdown" data-role="countdown" aria-live="polite" hidden>
        <div class="count-copy">
          <span class="count-icon" data-role="count-number">3</span>
          <span><strong data-role="count-title">即将自动操作</strong><small>点击取消可跳过本次操作</small></span>
        </div>
        <button type="button" data-action="cancel-countdown">取消本次</button>
        <i class="count-progress" data-role="count-progress"></i>
      </aside>`;
  }

  function ensurePanel() {
    ensureUi();
    if (state.panel) return;
    state.toast.insertAdjacentHTML('beforebegin', panelMarkup());
    state.panel = state.shadow.querySelector('[data-role="panel"]');
    renderSettings();
  }

  function panelMarkup() {
    return `<section class="panel" data-role="panel" aria-label="Linux DO 登录助手设置" hidden>
      <header class="panel-header">
        <div class="brand-mark" aria-hidden="true"><i></i></div>
        <div class="heading-copy">
          <strong>Linux DO 登录助手</strong>
          <span>更快，但始终由你掌控</span>
        </div>
        <button class="icon-button" data-action="close" type="button" aria-label="关闭设置">×</button>
      </header>
      <div class="panel-body">
        ${featureCard('autoLogin')}
        ${featureCard('autoAuthorize')}
        <p class="privacy-note"><span aria-hidden="true">●</span> 所有设置仅保存在本机，域名规则支持子域名。</p>
      </div>
      ${domainEditorMarkup()}
    </section>`;
  }

  function domainEditorMarkup() {
    return `<section class="domain-page" data-role="domain-page" aria-label="域名规则管理" hidden>
      <header class="domain-page-header">
        <button class="back-button" data-action="close-domain-editor" type="button" aria-label="返回设置">‹</button>
        <div><strong data-role="domain-page-title">域名规则管理</strong><span data-role="domain-page-subtitle"></span></div>
      </header>
      <div class="domain-page-body">
        <div class="rule-add-row"><input data-role="domain-input" type="text" autocomplete="off" placeholder="example.com 或 *.service.example"><button data-action="add-domain" type="button">添加</button></div>
        <div class="rule-actions"><span data-role="domain-count">0 条规则</span><button data-action="clear-domains" type="button">清空全部</button></div>
        <div class="rule-list" data-role="rule-list"></div>
        <label class="bulk-label" for="domain-bulk">批量编辑</label>
        <textarea id="domain-bulk" data-role="domain-bulk" rows="4" spellcheck="false" placeholder="每行一个域名，也支持逗号分隔"></textarea>
        <button class="domain-save" data-action="save-domain-editor" type="button">保存并返回</button>
      </div>
    </section>`;
  }

  function featureCard(featureKey) {
    const meta = FEATURE_META[featureKey];
    return `
      <article class="feature" data-feature="${featureKey}">
        <div class="feature-top">
          <div>
            <strong>${meta.title}</strong>
            <span>${featureKey === 'autoLogin' ? '发现“使用 LinuxDO 继续”后自动点击' : '在 Linux DO OAuth 页面自动点击“允许”'}</span>
          </div>
          <label class="switch" aria-label="${meta.title}">
            <input type="checkbox" data-field="enabled">
            <i></i>
          </label>
        </div>
        <div class="control-row">
          <label>等待时间</label>
          <div class="number-field"><input type="number" min="0.5" max="60" step="0.5" data-field="delay"><span>秒</span></div>
        </div>
        <div class="control-row">
          <label>域名范围</label>
          <select data-field="policy" aria-label="${meta.shortTitle}域名范围">
            <option value="all">所有域名</option>
            <option value="blacklist">黑名单以外</option>
            <option value="whitelist">仅白名单</option>
          </select>
        </div>
        <div class="domain-editor" data-role="domain-editor">
          <div class="domain-toolbar">
            <span data-role="policy-hint">每行填写一个域名</span>
            <span class="domain-actions"><button type="button" data-action="add-current">＋ 当前域名</button><button type="button" data-action="open-domain-editor">管理规则</button></span>
          </div>
          <textarea rows="2" spellcheck="false" data-field="domains" placeholder="example.com\n*.service.example"></textarea>
        </div>
      </article>`;
  }

  function bindUiEvents() {
    const { shadow, bubble, toast } = state;
    bubble.addEventListener('pointerdown', onBubblePointerDown);
    bubble.addEventListener('pointermove', onBubblePointerMove);
    bubble.addEventListener('pointerup', onBubblePointerUp);
    bubble.addEventListener('pointercancel', onBubblePointerUp);

    shadow.addEventListener('click', (event) => {
      const action = event.target.closest?.('[data-action]')?.dataset.action;
      if (action === 'close') closePanel();
      if (action === 'cancel-countdown') cancelCountdown(true);
      if (action === 'add-current') addCurrentDomain(event.target.closest('[data-feature]'));
      if (action === 'open-domain-editor') openDomainEditor(event.target.closest('[data-feature]')?.dataset.feature);
      if (action === 'close-domain-editor') closeDomainEditor();
      if (action === 'add-domain') addEditorDomain();
      if (action === 'clear-domains') clearEditorDomains();
      if (action === 'remove-domain') removeEditorDomain(event.target.closest('[data-domain]')?.dataset.domain);
      if (action === 'save-domain-editor') saveDomainEditor();
    });
    shadow.addEventListener('change', onSettingInput);
    toast.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') cancelCountdown(true);
    });
    shadow.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' && event.target.matches('[data-role="domain-input"]')) {
        event.preventDefault();
        addEditorDomain();
      }
    });

    document.addEventListener('pointerdown', (event) => {
      if (state.panel && !state.panel.hidden && !event.composedPath().includes(state.rootHost)) closePanel();
    }, true);
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && state.panel && !state.panel.hidden) closePanel();
    });
    window.addEventListener('resize', () => {
      positionBubble();
      positionPanel();
      if (state.countdown) positionCountdown(state.countdown.element);
    }, { passive: true });
  }

  function onBubblePointerDown(event) {
    if (event.button !== 0 && event.pointerType !== 'touch') return;
    event.preventDefault();
    const rect = state.bubble.getBoundingClientRect();
    state.drag = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      offsetX: event.clientX - rect.left,
      offsetY: event.clientY - rect.top,
      moved: false,
    };
    state.bubble.setPointerCapture(event.pointerId);
    state.bubble.classList.add('dragging');
  }

  function onBubblePointerMove(event) {
    const drag = state.drag;
    if (!drag || drag.pointerId !== event.pointerId) return;
    if (Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY) > 7) drag.moved = true;
    if (!drag.moved) return;
    const x = Math.min(innerWidth - BUBBLE_VISIBLE, Math.max(-(BUBBLE_SIZE - BUBBLE_VISIBLE), event.clientX - drag.offsetX));
    const y = Math.min(innerHeight - BUBBLE_SIZE - 10, Math.max(10, event.clientY - drag.offsetY));
    state.bubble.style.left = `${x}px`;
    state.bubble.style.top = `${y}px`;
    state.bubble.dataset.side = x + 22 < innerWidth / 2 ? 'left' : 'right';
  }

  function onBubblePointerUp(event) {
    const drag = state.drag;
    if (!drag || drag.pointerId !== event.pointerId) return;
    state.bubble.classList.remove('dragging');
    try { state.bubble.releasePointerCapture(event.pointerId); } catch (_) { /* already released */ }
    state.drag = null;

    const moved = drag.moved || Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY) > 3;
    if (!moved) {
      togglePanel();
      return;
    }
    const rect = state.bubble.getBoundingClientRect();
    state.settings.bubble.side = rect.left + rect.width / 2 < innerWidth / 2 ? 'left' : 'right';
    state.settings.bubble.y = Math.min(0.94, Math.max(0.06, (rect.top + rect.height / 2) / innerHeight));
    saveSettings();
    positionBubble();
    positionPanel();
  }

  function positionBubble() {
    if (!state.bubble) return;
    const side = state.settings.bubble.side;
    const y = Math.min(innerHeight - BUBBLE_SIZE - 10, Math.max(10, state.settings.bubble.y * innerHeight - BUBBLE_HALF));
    const x = side === 'left' ? -(BUBBLE_SIZE - BUBBLE_VISIBLE) : innerWidth - BUBBLE_VISIBLE;
    state.bubble.dataset.side = side;
    state.bubble.style.left = `${x}px`;
    state.bubble.style.top = `${y}px`;
  }

  function togglePanel() {
    if (!state.panel || state.panel.hidden) openPanel();
    else closePanel();
  }

  function openPanel() {
    ensurePanel();
    renderSettings();
    positionPanel();
    state.panel.hidden = false;
    state.panel.dataset.open = 'true';
    state.bubble.setAttribute('aria-expanded', 'true');
    requestAnimationFrame(() => state.panel.querySelector('[data-action="close"]')?.focus({ preventScroll: true }));
  }

  function closePanel() {
    if (!state.panel || state.panel.hidden) return;
    state.panel.dataset.open = 'false';
    state.panel.hidden = true;
    closeDomainEditor();
    state.bubble.setAttribute('aria-expanded', 'false');
  }

  function positionPanel() {
    if (!state.panel || !state.bubble) return;
    const width = Math.min(390, innerWidth - 24);
    const ball = state.bubble.getBoundingClientRect();
    const side = state.bubble.dataset.side || state.settings.bubble.side;
    const left = side === 'left' ? 12 : innerWidth - width - 12;
    const preferredTop = ball.top + ball.height / 2 - 250;
    const top = Math.min(innerHeight - 84, Math.max(12, preferredTop));
    state.panel.style.width = `${width}px`;
    state.panel.style.left = `${left}px`;
    state.panel.style.top = `${top}px`;
    state.panel.dataset.side = side;
  }

  function renderSettings() {
    if (!state.panel) return;
    for (const featureKey of ['autoLogin', 'autoAuthorize']) {
      const card = state.panel.querySelector(`[data-feature="${featureKey}"]`);
      const config = state.settings[featureKey];
      card.querySelector('[data-field="enabled"]').checked = config.enabled;
      card.querySelector('[data-field="delay"]').value = String(config.delay);
      card.querySelector('[data-field="policy"]').value = config.policy;
      card.querySelector('[data-field="domains"]').value = config.domains.join('\n');
      updatePolicyUi(card, config.policy);
    }
    if (state.editorFeature) renderDomainEditor();
  }

  function openDomainEditor(featureKey) {
    if (!featureKey || !state.panel) return;
    state.editorFeature = featureKey;
    state.panel.querySelector('.panel-body').hidden = true;
    state.panel.querySelector('.privacy-note').hidden = true;
    const page = state.panel.querySelector('[data-role="domain-page"]');
    page.hidden = false;
    page.querySelector('[data-role="domain-page-title"]').textContent = `${FEATURE_META[featureKey].shortTitle}域名规则`;
    page.querySelector('[data-role="domain-page-subtitle"]').textContent = state.settings[featureKey].policy === 'blacklist' ? '命中规则的域名不执行' : '仅对命中规则的域名执行';
    renderDomainEditor();
    page.querySelector('[data-role="domain-input"]').focus({ preventScroll: true });
  }

  function closeDomainEditor() {
    if (!state.panel || !state.editorFeature) return;
    state.editorFeature = null;
    state.panel.querySelector('[data-role="domain-page"]').hidden = true;
    state.panel.querySelector('.panel-body').hidden = false;
    state.panel.querySelector('.privacy-note').hidden = false;
  }

  function renderDomainEditor() {
    const page = state.panel?.querySelector('[data-role="domain-page"]');
    const featureKey = state.editorFeature;
    if (!page || !featureKey) return;
    const domains = state.settings[featureKey].domains;
    page.querySelector('[data-role="domain-count"]').textContent = `${domains.length} 条规则`;
    page.querySelector('[data-role="domain-bulk"]').value = domains.join('\n');
    page.querySelector('[data-role="rule-list"]').innerHTML = domains.length
      ? domains.map((domain) => `<div class="rule-item" data-domain="${escapeHtml(domain)}"><code>${escapeHtml(domain)}</code><button data-action="remove-domain" type="button" aria-label="删除 ${escapeHtml(domain)}">×</button></div>`).join('')
      : '<p class="empty-rules">暂未添加域名规则</p>';
  }

  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
  }

  function addEditorDomain() {
    const page = state.panel?.querySelector('[data-role="domain-page"]');
    if (!page || !state.editorFeature) return;
    const input = page.querySelector('[data-role="domain-input"]');
    const domains = normalizeDomainList(input.value);
    if (!domains.length) return;
    state.settings[state.editorFeature].domains = normalizeDomainList([...state.settings[state.editorFeature].domains, ...domains]);
    input.value = '';
    saveSettings();
    renderDomainEditor();
  }

  function removeEditorDomain(domain) {
    if (!state.editorFeature || !domain) return;
    const config = state.settings[state.editorFeature];
    config.domains = config.domains.filter((item) => item !== domain);
    saveSettings();
    renderDomainEditor();
  }

  function clearEditorDomains() {
    if (!state.editorFeature) return;
    state.settings[state.editorFeature].domains = [];
    saveSettings();
    renderDomainEditor();
  }

  function saveDomainEditor() {
    const page = state.panel?.querySelector('[data-role="domain-page"]');
    if (!page || !state.editorFeature) return;
    state.settings[state.editorFeature].domains = normalizeDomainList(page.querySelector('[data-role="domain-bulk"]').value);
    saveSettings();
    renderSettings();
    closeDomainEditor();
    scheduleScan();
  }

  function updatePolicyUi(card, policy) {
    const editor = card.querySelector('[data-role="domain-editor"]');
    const hint = card.querySelector('[data-role="policy-hint"]');
    editor.hidden = policy === 'all';
    hint.textContent = policy === 'blacklist' ? '这些域名不执行' : '仅在这些域名执行';
  }

  function onSettingInput(event) {
    const field = event.target.dataset.field;
    const card = event.target.closest('[data-feature]');
    if (!field || !card) return;
    const featureKey = card.dataset.feature;
    const config = state.settings[featureKey];
    if (field === 'enabled') config.enabled = event.target.checked;
    if (field === 'delay') config.delay = clampDelay(event.target.value);
    if (field === 'policy' && ['all', 'blacklist', 'whitelist'].includes(event.target.value)) {
      config.policy = event.target.value;
      updatePolicyUi(card, config.policy);
    }
    if (field === 'domains') config.domains = normalizeDomainList(event.target.value);
    saveSettings();

    if (state.countdown && !domainAllowed(state.countdown.featureKey)) cancelCountdown(false);
    scheduleScan();
  }

  function addCurrentDomain(card) {
    if (!card) return;
    const featureKey = card.dataset.feature;
    const hostname = normalizeHostname(location.hostname);
    if (!hostname) return;
    const domains = state.settings[featureKey].domains;
    if (!domains.includes(hostname)) domains.push(hostname);
    saveSettings();
    renderSettings();
  }

  function styles() {
    return `<style>
      :host {
        all: initial;
        --bg: rgba(12, 12, 12, .96);
        --surface: #1c1c1c;
        --surface-2: #242424;
        --border: rgba(255, 255, 255, .12);
        --border-strong: rgba(255, 255, 255, .2);
        --text: #f2f2f2;
        --muted: #9b9b9b;
        --accent: #40a9ff;
        --success: #57d08a;
        --ease-out: cubic-bezier(.23, 1, .32, 1);
        color-scheme: dark;
        font: 14px/1.45 ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI", "Microsoft YaHei", sans-serif;
      }
      *, *::before, *::after { box-sizing: border-box; }
      button, input, select, textarea { font: inherit; }
      button { color: inherit; }
      [hidden] { display: none !important; }

      .bubble {
        position: fixed;
        z-index: 2147483645;
        width: 30px;
        height: 30px;
        padding: 0;
        border: 1px solid var(--border-strong);
        border-radius: 50%;
        background: rgba(22, 22, 22, .92);
        backdrop-filter: blur(16px) saturate(130%);
        cursor: grab;
        touch-action: none;
        user-select: none;
        transition: transform 180ms var(--ease-out), background-color 180ms ease;
      }
      .bubble[data-side="left"] { transform: translateX(0); }
      .bubble[data-side="right"] { transform: translateX(0); }
      @media (hover: hover) and (pointer: fine) {
        .bubble[data-side="left"]:hover, .bubble[data-side="left"]:focus-visible { transform: translateX(14px); }
        .bubble[data-side="right"]:hover, .bubble[data-side="right"]:focus-visible { transform: translateX(-14px); }
      }
      .bubble:active { cursor: grabbing; }
      .bubble.dragging { transition: none; transform: none !important; cursor: grabbing; }
      .bubble:focus-visible { outline: 2px solid var(--accent); outline-offset: 3px; }
      .bubble-mark { position: relative; display: grid; place-items: center; width: 100%; height: 100%; }
      .bubble-mark i, .brand-mark i {
        position: absolute;
        width: 19px;
        height: 19px;
        border: 2px solid rgba(255,255,255,.88);
        border-radius: 50%;
      }
      .bubble-mark b { position: relative; z-index: 1; margin-top: -1px; font-size: 10px; color: #111; font-weight: 900; }
      .bubble-logo { display: block; width: 100%; height: 100%; border-radius: 50%; object-fit: cover; }

      .panel {
        position: fixed;
        z-index: 2147483646;
        max-height: calc(100vh - 24px);
        overflow: hidden;
        color: var(--text);
        border: 1px solid var(--border);
        border-radius: 20px;
        background-color: var(--bg);
        background-image: linear-gradient(rgba(255,255,255,.025) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.025) 1px, transparent 1px);
        background-size: 22px 22px;
        backdrop-filter: blur(24px) saturate(135%);
        transform-origin: right center;
      }
      .panel[data-side="left"] { transform-origin: left center; }
      .panel[data-open="true"] { animation: panel-in 210ms var(--ease-out) both; }
      @keyframes panel-in { from { opacity: 0; transform: scale(.96) translateX(8px); } to { opacity: 1; transform: scale(1) translateX(0); } }
      .panel-header {
        display: flex;
        align-items: center;
        gap: 11px;
        min-height: 72px;
        padding: 15px 16px;
        border-bottom: 1px solid var(--border);
        background: rgba(18,18,18,.72);
      }
      .brand-mark { position: relative; flex: 0 0 36px; height: 36px; display: grid; place-items: center; border-radius: 11px; background: var(--surface-2); border: 1px solid var(--border); }
      .brand-mark i { width: 17px; height: 17px; }
      .heading-copy { min-width: 0; display: flex; flex: 1; flex-direction: column; }
      .heading-copy strong { font-size: 15px; font-weight: 720; letter-spacing: -.01em; }
      .heading-copy span { margin-top: 2px; color: var(--muted); font-size: 12px; }
      .icon-button {
        flex: 0 0 32px;
        height: 32px;
        border: 1px solid transparent;
        border-radius: 50%;
        background: transparent;
        color: var(--muted);
        font-size: 22px;
        line-height: 1;
        cursor: pointer;
        transition: transform 140ms var(--ease-out), background-color 140ms ease, color 140ms ease;
      }
      .icon-button:hover { color: var(--text); background: var(--surface-2); }
      .icon-button:active { transform: scale(.94); }
      .panel-body { max-height: calc(100vh - 98px); overflow: auto; padding: 12px; scrollbar-width: thin; scrollbar-color: #444 transparent; }

      .feature { padding: 14px; border: 1px solid var(--border); border-radius: 15px; background: rgba(28,28,28,.94); }
      .feature + .feature { margin-top: 10px; }
      .feature-top { display: flex; align-items: flex-start; gap: 12px; padding-bottom: 12px; }
      .feature-top > div { min-width: 0; flex: 1; display: flex; flex-direction: column; }
      .feature-top strong { font-size: 14px; font-weight: 680; }
      .feature-top span { margin-top: 3px; color: var(--muted); font-size: 11.5px; line-height: 1.4; }
      .switch { position: relative; flex: 0 0 42px; height: 24px; cursor: pointer; }
      .switch input { position: absolute; opacity: 0; pointer-events: none; }
      .switch i { display: block; width: 100%; height: 100%; border: 1px solid var(--border-strong); border-radius: 99px; background: #303030; transition: background-color 160ms ease, border-color 160ms ease; }
      .switch i::after { content: ""; position: absolute; top: 3px; left: 3px; width: 18px; height: 18px; border-radius: 50%; background: #bdbdbd; transition: transform 180ms var(--ease-out), background-color 160ms ease; }
      .switch input:checked + i { border-color: rgba(64,169,255,.6); background: #1687df; }
      .switch input:checked + i::after { transform: translateX(18px); background: #fff; }
      .switch input:focus-visible + i { outline: 2px solid var(--accent); outline-offset: 2px; }

      .control-row { display: flex; align-items: center; justify-content: space-between; min-height: 38px; border-top: 1px solid rgba(255,255,255,.065); }
      .control-row > label { color: #cfcfcf; font-size: 12px; }
      .number-field { display: flex; align-items: center; height: 30px; overflow: hidden; border: 1px solid var(--border); border-radius: 9px; background: #151515; }
      .number-field input { width: 58px; height: 100%; padding: 0 5px 0 10px; border: 0; outline: 0; color: var(--text); background: transparent; text-align: right; }
      .number-field span { padding-right: 9px; color: var(--muted); font-size: 11px; }
      select { min-width: 116px; height: 30px; padding: 0 27px 0 10px; border: 1px solid var(--border); border-radius: 9px; outline: 0; color: var(--text); background: #151515; cursor: pointer; }
      select:focus-visible, textarea:focus-visible, .number-field:focus-within { border-color: var(--accent); outline: 1px solid var(--accent); outline-offset: 1px; }
      .domain-editor { padding-top: 9px; border-top: 1px solid rgba(255,255,255,.065); }
      .domain-toolbar { display: flex; align-items: center; justify-content: space-between; margin-bottom: 7px; }
      .domain-toolbar span { color: var(--muted); font-size: 11px; }
      .domain-actions { display: flex; gap: 5px; align-items: center; }
      .domain-toolbar button {
        padding: 4px 8px;
        border: 1px solid var(--border);
        border-radius: 8px;
        color: #d8d8d8;
        background: #252525;
        font-size: 11px;
        cursor: pointer;
        transition: transform 140ms var(--ease-out), background-color 140ms ease;
      }
      .domain-toolbar button:hover { background: #303030; }
      .domain-toolbar button:active { transform: scale(.96); }
      textarea { width: 100%; min-height: 55px; resize: vertical; padding: 8px 9px; border: 1px solid var(--border); border-radius: 10px; outline: 0; color: var(--text); background: #111; font: 11.5px/1.45 ui-monospace, SFMono-Regular, Consolas, monospace; }
      textarea::placeholder { color: #606060; }
      .domain-page { max-height: calc(100vh - 24px); overflow: auto; }
      .domain-page-header { display: flex; align-items: center; gap: 8px; min-height: 72px; padding: 15px 16px; border-bottom: 1px solid var(--border); background: rgba(18,18,18,.72); }
      .back-button { width: 32px; height: 32px; padding: 0; border: 1px solid var(--border); border-radius: 50%; color: var(--text); background: var(--surface-2); font-size: 23px; line-height: 25px; cursor: pointer; }
      .back-button:hover { background: #303030; }
      .domain-page-header > div { display: flex; flex-direction: column; min-width: 0; }
      .domain-page-header strong { font-size: 15px; font-weight: 720; }
      .domain-page-header span { margin-top: 2px; color: var(--muted); font-size: 11px; }
      .domain-page-body { padding: 14px; }
      .rule-add-row { display: flex; gap: 7px; }
      .rule-add-row input { min-width: 0; flex: 1; height: 34px; padding: 0 10px; border: 1px solid var(--border); border-radius: 9px; outline: 0; color: var(--text); background: #111; font: 11.5px ui-monospace, SFMono-Regular, Consolas, monospace; }
      .rule-add-row input:focus { border-color: var(--accent); outline: 1px solid var(--accent); outline-offset: 1px; }
      .rule-add-row button, .domain-save { height: 34px; padding: 0 13px; border: 1px solid var(--border-strong); border-radius: 9px; color: #171717; background: #f1f1f1; font-size: 11.5px; font-weight: 650; cursor: pointer; }
      .rule-actions { display: flex; align-items: center; justify-content: space-between; margin: 12px 1px 7px; color: var(--muted); font-size: 11px; }
      .rule-actions button { padding: 3px 7px; border: 1px solid var(--border); border-radius: 7px; color: #d8d8d8; background: #252525; font-size: 10.5px; cursor: pointer; }
      .rule-list { display: flex; flex-direction: column; gap: 5px; max-height: 180px; overflow: auto; }
      .rule-item { display: flex; align-items: center; gap: 8px; min-height: 32px; padding: 4px 7px 4px 10px; border: 1px solid var(--border); border-radius: 8px; background: rgba(17,17,17,.76); }
      .rule-item code { min-width: 0; flex: 1; overflow: hidden; color: #ddd; font: 11px ui-monospace, SFMono-Regular, Consolas, monospace; text-overflow: ellipsis; white-space: nowrap; }
      .rule-item button { width: 23px; height: 23px; padding: 0; border: 0; border-radius: 50%; color: var(--muted); background: transparent; font-size: 18px; line-height: 1; cursor: pointer; }
      .rule-item button:hover { color: #ff7b7b; background: rgba(255,90,90,.12); }
      .empty-rules { margin: 17px 0; color: #777; text-align: center; font-size: 11px; }
      .bulk-label { display: block; margin: 15px 0 6px; color: #cfcfcf; font-size: 11px; }
      .domain-save { width: 100%; margin-top: 12px; }
      .privacy-note { display: flex; align-items: center; gap: 7px; margin: 11px 3px 1px; color: #777; font-size: 10.5px; }
      .privacy-note span { color: var(--success); font-size: 7px; }

      .countdown {
        position: fixed;
        z-index: 2147483647;
        display: flex;
        align-items: center;
        gap: 14px;
        max-width: calc(100vw - 24px);
        overflow: hidden;
        padding: 11px 11px 11px 13px;
        border: 1px solid var(--border-strong);
        border-radius: 15px;
        color: var(--text);
        background: rgba(22,22,22,.96);
        backdrop-filter: blur(20px);
        animation: toast-in 180ms var(--ease-out) both;
      }
      .countdown::before {
        content: "";
        position: absolute;
        left: 50%;
        width: 10px;
        height: 10px;
        border-left: 1px solid var(--border-strong);
        border-top: 1px solid var(--border-strong);
        background: rgba(22,22,22,.96);
        transform: translateX(-50%) rotate(45deg);
      }
      .countdown[data-placement="below"]::before { top: -6px; }
      .countdown[data-placement="above"]::before { bottom: -6px; transform: translateX(-50%) rotate(225deg); }
      .countdown[data-placement="right"]::before { left: -6px; top: 50%; transform: translateY(-50%) rotate(-45deg); }
      .countdown[data-placement="left"]::before { left: auto; right: -6px; top: 50%; transform: translateY(-50%) rotate(135deg); }
      @keyframes toast-in { from { opacity: 0; transform: translateY(6px) scale(.98); } to { opacity: 1; transform: translateY(0) scale(1); } }
      .count-copy { min-width: 0; flex: 1; display: flex; align-items: center; gap: 10px; }
      .count-copy > span:last-child { min-width: 0; display: flex; flex-direction: column; }
      .count-copy strong { overflow: hidden; font-size: 12.5px; font-weight: 650; white-space: nowrap; text-overflow: ellipsis; }
      .count-copy small { margin-top: 1px; color: var(--muted); font-size: 10.5px; }
      .count-icon { flex: 0 0 31px; height: 31px; display: grid; place-items: center; border: 1px solid var(--border-strong); border-radius: 9px; background: #292929; font-weight: 750; font-variant-numeric: tabular-nums; }
      .countdown button { flex: 0 0 auto; padding: 7px 13px; border: 1px solid var(--border-strong); border-radius: 99px; color: #171717; background: #f1f1f1; font-size: 11.5px; font-weight: 650; cursor: pointer; transition: transform 140ms var(--ease-out), background-color 140ms ease; }
      .countdown button:hover { background: #fff; }
      .countdown button:active { transform: scale(.96); }
      .count-progress { position: absolute; left: 0; right: 0; bottom: 0; height: 2px; background: var(--accent); transform-origin: left; }

      @media (max-width: 520px) {
        .panel { border-radius: 17px; }
        .count-copy small { display: none; }
      }
      @media (prefers-reduced-motion: reduce) {
        .panel[data-open="true"], .countdown { animation: none; }
        .bubble, .icon-button, .switch i, .switch i::after, .domain-toolbar button, .countdown button { transition-duration: 0ms; }
      }
      @media (prefers-reduced-transparency: reduce) {
        .bubble, .panel, .countdown { backdrop-filter: none; background-color: #151515; }
      }
      @media (prefers-contrast: more) {
        :host { --border: rgba(255,255,255,.32); --border-strong: rgba(255,255,255,.58); }
      }
    </style>`;
  }

  function start() {
    state.observing = true;
    state.observer = new MutationObserver(() => {
      if (state.observing) scheduleScan();
    });
    state.observer.observe(document.documentElement, { childList: true, subtree: true });

    const onDomReady = () => {
      ensureUi();
      scheduleScan();
      armObservationStop();
    };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', onDomReady, { once: true });
    else onDomReady();
    scan();

    if (window.__LDO_AUTO_TEST_MODE__) {
      window.__LDO_AUTO_DEBUG__ = Object.freeze({
        getSettings: () => JSON.parse(JSON.stringify(state.settings)),
        setFeature: (key, value) => {
          if (!state.settings[key]) return;
          Object.assign(state.settings[key], value);
          state.settings[key].delay = clampDelay(state.settings[key].delay);
          state.settings[key].domains = normalizeDomainList(state.settings[key].domains);
          saveSettings();
          renderSettings();
          scheduleScan();
        },
        domainMatches,
        domainAllowed,
        findTarget,
        scan,
        cancelCountdown,
      });
    }
  }

  if (document.documentElement) start();
  else document.addEventListener('DOMContentLoaded', start, { once: true });
})();
