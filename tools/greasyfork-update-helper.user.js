// ==UserScript==
// @name         LinuxDo Greasy Fork 发布助手
// @namespace    https://github.com/ywainzh/linuxdo-read-script
// @version      0.3.3
// @license      MIT
// @description  在项目脚本的 Greasy Fork 页面一键从 GitHub 拉取并发布更新。
// @author       ywainzh
// @match        https://greasyfork.org/*/scripts/586863*
// @match        https://greasyfork.org/*/scripts/588940*
// @match        https://greasyfork.org/*/scripts/588943*
// @match        https://greasyfork.org/*/scripts/589199*
// @match        https://greasyfork.org/*/users/1622808-ywainzh*
// @match        https://greasyfork.org/*/script_versions/*
// @match        https://greasyfork.org/*/scripts/*/versions/*
// @connect      api.github.com
// @connect      raw.githubusercontent.com
// @grant        GM_xmlhttpRequest
// @run-at       document-idle
// ==/UserScript==

(function () {
  'use strict';

  const TARGETS = Object.freeze({
    '586863': Object.freeze({
      id: '586863',
      name: 'LinuxDo 便捷脚本',
      path: 'LinuxDo 便捷脚本.user.js',
    }),
    '588940': Object.freeze({
      id: '588940',
      name: 'Linux DO 登录助手',
      path: 'plugins/LinuxDO登录助手/linuxdo-auto-login.user.js',
    }),
    '588943': Object.freeze({
      id: '588943',
      name: 'LinuxDo Greasy Fork 发布助手',
      path: 'tools/greasyfork-update-helper.user.js',
    }),
    '589199': Object.freeze({
      id: '589199',
      name: 'GreasyFork 美化增强版 | GitHub Redesign',
      path: 'plugins/GreasyFork美化增强版/greasyfork-github-redesign.user.js',
    }),
  });

  const REPO_OWNER = 'ywainzh';
  const REPO_NAME = 'linuxdo-read-script';
  const REPO_BRANCH = 'main';
  const COMMIT_API_URL = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/commits/${REPO_BRANCH}`;
  const RAW_URL_BASE = `https://raw.githubusercontent.com/${REPO_OWNER}/${REPO_NAME}`;

  const STORE_PENDING_TARGET = 'linuxdo.gfUpdate.pendingTarget';
  const STORE_AUTO_PUBLISH = 'linuxdo.gfUpdate.autoPublish';
  const STORE_TARGET_ID = 'linuxdo.gfUpdate.targetId';
  const STORE_EXPECTED_VERSION = 'linuxdo.gfUpdate.expectedVersion';
  const HELPER_TARGET_ID = '588943';
  const PUBLISH_VERIFY_ATTEMPTS = 4;
  const PUBLISH_VERIFY_DELAY = 350;

  class ManualConfirmationError extends Error {
    constructor(message, target, code, version) {
      super(message);
      this.name = 'ManualConfirmationError';
      this.requiresConfirmation = true;
      this.target = target;
      this.code = code;
      this.version = version;
    }
  }

  function localePrefix() {
    const first = location.pathname.split('/').filter(Boolean)[0];
    return first ? `/${first}` : '/zh-CN';
  }

  function targetIdFromPath() {
    return location.pathname.match(/\/scripts\/(\d+)(?:-|\/|$)/)?.[1] || '';
  }

  function currentTarget() {
    const pathTarget = TARGETS[targetIdFromPath()];
    if (pathTarget) return pathTarget;
    return TARGETS[sessionStorage.getItem(STORE_TARGET_ID)] || null;
  }

  function isTargetScriptPage(target) {
    return Boolean(target && TARGETS[targetIdFromPath()]);
  }

  function isLoggedIn() {
    return !document.querySelector('a[href*="/users/sign_in"]') && /登出|Sign out/i.test(document.body.innerText);
  }

  function readMeta(code, key) {
    const match = code.match(new RegExp(`^\\s*//\\s*@${key}\\s+(.+?)\\s*$`, 'm'));
    return match ? match[1].trim() : '';
  }

  function encodeRepoPath(path) {
    return path.split('/').map((segment) => encodeURIComponent(segment)).join('/');
  }

  function requestText(url) {
    const cacheBustedUrl = `${url}${url.includes('?') ? '&' : '?'}t=${Date.now()}`;
    if (typeof GM_xmlhttpRequest === 'function') {
      return new Promise((resolve, reject) => {
        GM_xmlhttpRequest({
          method: 'GET',
          url: cacheBustedUrl,
          onload: (response) => {
            if (response.status >= 200 && response.status < 300) {
              resolve(response.responseText);
            } else {
              reject(new Error(`GitHub 返回 HTTP ${response.status}`));
            }
          },
          onerror: () => reject(new Error('无法连接 GitHub raw 地址')),
        });
      });
    }
    return fetch(cacheBustedUrl, { cache: 'no-store' }).then((response) => {
      if (!response.ok) throw new Error(`GitHub 返回 HTTP ${response.status}`);
      return response.text();
    });
  }

  async function fetchLatestCommitSha() {
    const responseText = await requestText(COMMIT_API_URL);
    let data;
    try {
      data = JSON.parse(responseText);
    } catch (error) {
      throw new Error('GitHub commit API 返回内容无法解析。');
    }
    if (!data || !/^[0-9a-f]{40}$/i.test(data.sha || '')) {
      throw new Error('未能从 GitHub 读取 main 分支最新 commit。');
    }
    return data.sha;
  }

  async function fetchLatestScriptAtSha(target, sha) {
    const rawUrl = `${RAW_URL_BASE}/${sha}/${encodeRepoPath(target.path)}`;
    const code = await requestText(rawUrl);
    return { code, sha };
  }

  async function fetchLatestScript(target) {
    const sha = await fetchLatestCommitSha();
    return fetchLatestScriptAtSha(target, sha);
  }

  async function fetchPublishedVersion(target, forceNetwork = false) {
    if (!forceNetwork && targetIdFromPath() === target.id) {
      const localVersion = document.querySelector('#install-area .install-link[data-script-version]')?.dataset.scriptVersion;
      if (localVersion) return localVersion.trim();
    }

    const response = await fetch(`${location.origin}${localePrefix()}/scripts/${target.id}?t=${Date.now()}`, {
      cache: 'no-store',
      credentials: 'same-origin',
    });
    if (!response.ok) throw new Error(`Greasy Fork 返回 HTTP ${response.status}`);
    const html = await response.text();
    const page = new DOMParser().parseFromString(html, 'text/html');
    const version = page.querySelector('#install-area .install-link[data-script-version]')?.dataset.scriptVersion;
    if (!version) throw new Error('未能读取 Greasy Fork 当前发布版本。');
    return version.trim();
  }

  function delay(milliseconds) {
    return new Promise((resolve) => window.setTimeout(resolve, milliseconds));
  }

  function parseVersion(version) {
    const match = String(version || '').trim().match(/^v?(\d+(?:\.\d+)*)(?:-([0-9A-Za-z.-]+))?$/);
    if (!match) return null;
    return {
      core: match[1].split('.').map(Number),
      prerelease: match[2] ? match[2].split('.') : [],
    };
  }

  function compareVersions(left, right) {
    const a = parseVersion(left);
    const b = parseVersion(right);
    if (!a || !b) {
      if (String(left).trim() === String(right).trim()) return 0;
      throw new Error(`无法比较版本：GitHub ${left || '未知'} / Greasy Fork ${right || '未知'}`);
    }

    const coreLength = Math.max(a.core.length, b.core.length);
    for (let index = 0; index < coreLength; index += 1) {
      const difference = (a.core[index] || 0) - (b.core[index] || 0);
      if (difference) return difference > 0 ? 1 : -1;
    }

    if (!a.prerelease.length && !b.prerelease.length) return 0;
    if (!a.prerelease.length) return 1;
    if (!b.prerelease.length) return -1;
    const prereleaseLength = Math.max(a.prerelease.length, b.prerelease.length);
    for (let index = 0; index < prereleaseLength; index += 1) {
      const aPart = a.prerelease[index];
      const bPart = b.prerelease[index];
      if (aPart === undefined) return -1;
      if (bPart === undefined) return 1;
      if (aPart === bPart) continue;
      const aNumber = /^\d+$/.test(aPart) ? Number(aPart) : null;
      const bNumber = /^\d+$/.test(bPart) ? Number(bPart) : null;
      if (aNumber !== null && bNumber !== null) return aNumber > bNumber ? 1 : -1;
      if (aNumber !== null) return -1;
      if (bNumber !== null) return 1;
      return aPart > bPart ? 1 : -1;
    }
    return 0;
  }

  function validateCode(code, target) {
    if (!code.includes('// ==UserScript==') || !code.includes('// ==/UserScript==')) {
      throw new Error('GitHub 返回的内容不是用户脚本。');
    }
    const name = readMeta(code, 'name');
    const version = readMeta(code, 'version');
    if (name !== target.name) {
      throw new Error(`脚本名不匹配：${name || '未读取到 @name'}`);
    }
    if (!version) {
      throw new Error('未读取到 @version。请先在脚本里递增版本号。');
    }
    return { name, version };
  }

  function setStatus(target, message = '', tone = 'info', action = null) {
    document.querySelectorAll(`[data-linuxdo-gf-status="${target.id}"]`).forEach((status) => {
      status.textContent = message;
      status.dataset.tone = tone;
      status.hidden = !message;
      if (action && message) {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'linuxdo-gf-status-action';
        button.textContent = action.label;
        button.addEventListener('click', action.onClick);
        status.append(' ', button);
      }
    });
  }

  function setBusy(target, busy, label = '') {
    document.querySelectorAll(`[data-linuxdo-gf-target="${target.id}"]`).forEach((button) => {
      button.disabled = busy;
      button.setAttribute('aria-busy', String(busy));
      button.textContent = label || button.dataset.defaultLabel;
    });
  }

  function clearPublishSession() {
    sessionStorage.removeItem(STORE_AUTO_PUBLISH);
    sessionStorage.removeItem(STORE_TARGET_ID);
    sessionStorage.removeItem(STORE_EXPECTED_VERSION);
  }

  function submitPrefillForm(target, code, version, options = {}) {
    clearPublishSession();
    if (options.autoPublish !== false) {
      sessionStorage.setItem(STORE_AUTO_PUBLISH, '1');
      sessionStorage.setItem(STORE_TARGET_ID, target.id);
      sessionStorage.setItem(STORE_EXPECTED_VERSION, version);
    }

    const form = document.createElement('form');
    form.method = 'POST';
    form.action = `${location.origin}${localePrefix()}/scripts/${target.id}/versions/prefill`;
    form.enctype = 'multipart/form-data';
    form.style.display = 'none';

    const codeField = document.createElement('textarea');
    codeField.name = 'script_version[code]';
    codeField.value = code;
    form.appendChild(codeField);

    document.body.appendChild(form);
    form.submit();
  }

  async function fetchUpdateForm(target) {
    const response = await fetch(
      `${location.origin}${localePrefix()}/scripts/${target.id}/versions/new?t=${Date.now()}`,
      {
        cache: 'no-store',
        credentials: 'same-origin',
        headers: { Accept: 'text/html' },
      }
    );
    if (!response.ok) throw new Error(`更新表单返回 HTTP ${response.status}`);

    const html = await response.text();
    const page = new DOMParser().parseFromString(html, 'text/html');
    const codeField = page.querySelector('textarea[name="script_version[code]"]');
    const form = codeField?.closest('form');
    if (!form || !form.querySelector('input[name="authenticity_token"]')) {
      throw new Error('未找到可用的更新表单，请确认登录状态。');
    }

    const action = new URL(form.getAttribute('action') || response.url, response.url || location.href);
    if (action.origin !== location.origin) throw new Error('更新表单地址不是当前 Greasy Fork 站点。');
    return { form, action: action.href };
  }

  function buildUpdateFormData(form, code) {
    const data = new FormData(form);
    data.set('script_version[code]', code);

    const submit = [...form.querySelectorAll('button[type="submit"], input[type="submit"]')]
      .find((element) => /发布|提交|更新|Publish|Update/i.test(element.textContent || element.value || ''));
    if (submit?.name) data.set(submit.name, submit.value || submit.textContent.trim());
    else if (!data.has('commit')) data.set('commit', '发布新版本');
    return data;
  }

  function responseNeedsConfirmation(page) {
    const form = page.querySelector('textarea[name="script_version[code]"]')?.closest('form');
    if (!form) return false;
    return Boolean(
      form.querySelector(
        '.validation-errors, .field_with_errors, .alert-danger, .error, [data-sitekey], iframe[src*="captcha"], input[name*="confirm"], input[name*="minified"]'
      )
    ) || /验证码|captcha|压缩代码|最小化代码|仍要发布|仍要保存|人工确认/i.test(form.textContent);
  }

  async function verifyPublishedVersion(target, expectedVersion) {
    let actualVersion = '';
    for (let attempt = 0; attempt < PUBLISH_VERIFY_ATTEMPTS; attempt += 1) {
      if (attempt) await delay(PUBLISH_VERIFY_DELAY * attempt);
      try {
        actualVersion = await fetchPublishedVersion(target, true);
      } catch (error) {
        if (attempt === PUBLISH_VERIFY_ATTEMPTS - 1) throw error;
        continue;
      }
      if (compareVersions(actualVersion, expectedVersion) >= 0) return actualVersion;
    }
    return actualVersion;
  }

  async function publishInBackground(target, code, version) {
    const { form, action } = await fetchUpdateForm(target);
    const response = await fetch(action, {
      method: 'POST',
      body: buildUpdateFormData(form, code),
      credentials: 'same-origin',
      redirect: 'follow',
      headers: { Accept: 'text/html' },
    });
    if (!response.ok) throw new Error(`发布请求返回 HTTP ${response.status}`);

    const html = await response.text();
    const page = new DOMParser().parseFromString(html, 'text/html');
    const publishedVersion = await verifyPublishedVersion(target, version);
    if (compareVersions(publishedVersion, version) >= 0) return { version: publishedVersion };

    if (responseNeedsConfirmation(page) || page.querySelector('textarea[name="script_version[code]"]')) {
      throw new ManualConfirmationError('Greasy Fork 需要人工确认后才能发布。', target, code, version);
    }
    throw new Error(`发布后版本仍为 v${publishedVersion || '未知'}，请稍后重试。`);
  }

  function manualConfirmationAction(target, code, version) {
    return {
      label: '打开确认页',
      onClick: () => submitPrefillForm(target, code, version, { autoPublish: false }),
    };
  }

  async function startUpdate(target) {
    try {
      setStatus(target);
      setBusy(target, true, '正在检查...');

      if (!isLoggedIn()) {
        sessionStorage.setItem(STORE_PENDING_TARGET, target.id);
        const returnTo = `${location.pathname}${location.search}`;
        location.href = `${location.origin}${localePrefix()}/users/sign_in?return_to=${encodeURIComponent(returnTo)}`;
        return;
      }

      const [{ code }, publishedVersion] = await Promise.all([
        fetchLatestScript(target),
        fetchPublishedVersion(target),
      ]);
      const meta = validateCode(code, target);
      if (compareVersions(meta.version, publishedVersion) <= 0) {
        setBusy(target, false);
        setStatus(target, `当前已是最新版本 v${publishedVersion}`, 'success');
        return;
      }

      setBusy(target, true, '正在发布...');
      await publishInBackground(target, code, meta.version);
      setStatus(target, `已发布 v${meta.version}`, 'success');
    } catch (error) {
      setBusy(target, false);
      const message = error.message || String(error);
      if (error.requiresConfirmation) {
        setStatus(
          target,
          message,
          'warning',
          manualConfirmationAction(error.target, error.code, error.version)
        );
      } else {
        setStatus(target, message, 'error');
      }
      if (!document.querySelector(`[data-linuxdo-gf-status="${target.id}"]`)) window.alert(message);
      console.error('[LinuxDo Greasy Fork 发布助手]', error);
      return;
    }
    setBusy(target, false);
  }

  function showFormError(message) {
    clearPublishSession();
    console.error('[LinuxDo Greasy Fork 发布助手]', message);
    window.alert(message);
  }

  function autoPublishIfReady() {
    if (sessionStorage.getItem(STORE_AUTO_PUBLISH) !== '1') return;

    const target = currentTarget();
    const codeArea = document.querySelector('#script_version_code, textarea[name="script_version[code]"]');
    if (!target || !codeArea) return;

    const expectedVersion = sessionStorage.getItem(STORE_EXPECTED_VERSION);
    const actualName = readMeta(codeArea.value, 'name');
    const actualVersion = readMeta(codeArea.value, 'version');
    if (actualName !== target.name) {
      showFormError(`脚本名校验失败：表单中是 ${actualName || '未知'}。`);
      return;
    }
    if (expectedVersion && actualVersion !== expectedVersion) {
      showFormError(`版本校验失败：预期 ${expectedVersion}，表单中是 ${actualVersion || '未知'}。`);
      return;
    }

    const submitButton = [...document.querySelectorAll('button, input[type="submit"]')]
      .find((element) => /发布|提交|更新|Publish|Update/i.test(element.textContent || element.value || ''));

    if (!submitButton) {
      showFormError('已预填更新表单，但没有找到发布按钮。请手动检查并提交。');
      return;
    }

    clearPublishSession();
    setTimeout(() => submitButton.click(), 800);
  }

  function ensureStyles() {
    if (document.querySelector('#linuxdo-gf-update-style')) return;
    const style = document.createElement('style');
    style.id = 'linuxdo-gf-update-style';
    style.textContent = `
      .linuxdo-gf-update-control {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        margin-left: 8px;
        vertical-align: top;
        font: 14px/1.35 Arial, sans-serif;
      }
      .linuxdo-gf-update-button {
        min-width: 126px;
        min-height: 38px;
        padding: 8px 16px;
        border: 0;
        border-radius: 4px;
        color: #fff;
        background: #166b8f;
        font-size: 16px;
        line-height: 22px;
        cursor: pointer;
        transition: background-color 140ms ease, box-shadow 140ms ease;
      }
      .linuxdo-gf-update-button:hover:not(:disabled),
      .linuxdo-gf-card-publish:hover:not(:disabled) {
        background: #0f5877;
      }
      .linuxdo-gf-update-button:focus-visible,
      .linuxdo-gf-card-publish:focus-visible {
        outline: 2px solid #166b8f;
        outline-offset: 2px;
      }
      .linuxdo-gf-update-button:disabled,
      .linuxdo-gf-card-publish:disabled {
        cursor: wait;
        opacity: .68;
      }
      .linuxdo-gf-update-status {
        max-width: min(340px, calc(100vw - 32px));
        color: #4b5563;
        font-size: 12px;
        overflow-wrap: anywhere;
      }
      .linuxdo-gf-update-status[data-tone="error"] {
        color: #b42318;
      }
      .linuxdo-gf-update-status[data-tone="success"] {
        color: #1a7f37;
      }
      .linuxdo-gf-update-status[data-tone="warning"] {
        color: #9a6700;
      }
      .linuxdo-gf-status-action,
      .linuxdo-gf-batch-action {
        padding: 0;
        border: 0;
        color: var(--gf-accent, #166b8f);
        background: transparent;
        font: inherit;
        font-weight: 700;
        text-decoration: underline;
        cursor: pointer;
      }
      .linuxdo-gf-card-publish {
        min-width: 72px;
        height: 26px;
        margin-left: 9px;
        padding: 0 11px;
        border: 0;
        border-radius: 4px;
        color: #fff;
        background: #166b8f;
        font: 700 12px/26px Arial, sans-serif;
        vertical-align: 2px;
        cursor: pointer;
        transition: background-color 140ms ease;
      }
      .linuxdo-gf-card-status {
        display: inline-block;
        margin-left: 8px;
        vertical-align: 2px;
      }
      .linuxdo-gf-batch {
        margin: 0 0 18px;
        padding: 14px 16px;
        border: 1px solid var(--gf-border, #d0d7de);
        border-radius: 8px;
        background: var(--gf-inset, #f6f8fa);
        color: var(--gf-text, #1f2328);
        font: 14px/1.45 var(--gf-font, Arial, sans-serif);
      }
      .linuxdo-gf-batch-toolbar {
        display: flex;
        align-items: center;
        gap: 12px;
        flex-wrap: wrap;
      }
      .linuxdo-gf-batch-button {
        min-height: 36px;
        padding: 7px 15px;
        border: 1px solid rgba(31, 136, 61, .35);
        border-radius: 6px;
        color: #fff;
        background: var(--gf-success, #1f883d);
        font: 700 14px/20px var(--gf-font, Arial, sans-serif);
        cursor: pointer;
      }
      .linuxdo-gf-batch-button:hover:not(:disabled) {
        filter: brightness(1.08);
      }
      .linuxdo-gf-batch-button:disabled {
        cursor: wait;
        opacity: .68;
      }
      .linuxdo-gf-batch-summary {
        color: var(--gf-muted, #59636e);
        font-size: 13px;
      }
      .linuxdo-gf-batch-results {
        display: grid;
        gap: 7px;
        margin: 12px 0 0;
        padding: 0;
        list-style: none;
      }
      .linuxdo-gf-batch-row {
        display: grid;
        grid-template-columns: minmax(170px, 1fr) auto;
        align-items: center;
        gap: 12px;
        padding-top: 7px;
        border-top: 1px solid var(--gf-border-muted, #d8dee4);
      }
      .linuxdo-gf-batch-name {
        min-width: 0;
        overflow-wrap: anywhere;
      }
      .linuxdo-gf-batch-result {
        color: var(--gf-muted, #59636e);
        font-size: 13px;
        text-align: right;
      }
      .linuxdo-gf-batch-result[data-tone="success"] {
        color: var(--gf-accent, #1a7f37);
      }
      .linuxdo-gf-batch-result[data-tone="error"] {
        color: #b42318;
      }
      .linuxdo-gf-batch-result[data-tone="warning"] {
        color: #9a6700;
      }
      @media (max-width: 560px) {
        .linuxdo-gf-update-control {
          margin-top: 8px;
          margin-left: 0;
        }
        .linuxdo-gf-batch-row {
          grid-template-columns: 1fr;
          gap: 2px;
        }
        .linuxdo-gf-batch-result {
          text-align: left;
        }
      }
      @media (prefers-reduced-motion: reduce) {
        .linuxdo-gf-update-button,
        .linuxdo-gf-card-publish {
          transition: none;
        }
      }
    `;
    document.head.appendChild(style);
  }

  function installDetailControl() {
    const target = currentTarget();
    if (!isTargetScriptPage(target) || document.querySelector('.linuxdo-gf-update-control')) return;

    const installArea = document.querySelector('#install-area');
    if (!installArea) return;
    ensureStyles();

    const control = document.createElement('span');
    control.className = 'linuxdo-gf-update-control';
    control.innerHTML = `
      <button type="button" class="linuxdo-gf-update-button" data-linuxdo-gf-target="${target.id}" data-default-label="拉取并发布">拉取并发布</button>
      <span class="linuxdo-gf-update-status" data-linuxdo-gf-status="${target.id}" role="status" aria-live="polite" hidden></span>
    `;
    installArea.appendChild(control);
    control.querySelector('.linuxdo-gf-update-button').addEventListener('click', () => startUpdate(target));
  }

  function isProfilePage() {
    return /\/users\/1622808-ywainzh(?:\/|$)/.test(location.pathname);
  }

  function installProfileControls() {
    if (!isProfilePage()) return;
    ensureStyles();

    document.querySelectorAll('article .script-link').forEach((link) => {
      const targetId = link.getAttribute('href')?.match(/\/scripts\/(\d+)(?:-|\/|$)/)?.[1];
      const target = TARGETS[targetId];
      const heading = link.closest('h2');
      if (!target || !heading || heading.querySelector(`[data-linuxdo-gf-target="${target.id}"]`)) return;

      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'linuxdo-gf-card-publish';
      button.dataset.linuxdoGfTarget = target.id;
      button.dataset.defaultLabel = '一键发布';
      button.textContent = '一键发布';
      button.addEventListener('click', () => startUpdate(target));

      const badge = heading.querySelector('.badge-js');
      if (badge) badge.insertAdjacentElement('afterend', button);
      else link.insertAdjacentElement('afterend', button);

      const status = document.createElement('span');
      status.className = 'linuxdo-gf-update-status linuxdo-gf-card-status';
      status.dataset.linuxdoGfStatus = target.id;
      status.setAttribute('role', 'status');
      status.setAttribute('aria-live', 'polite');
      status.hidden = true;
      button.insertAdjacentElement('afterend', status);
    });
  }

  function setBatchRow(row, message, tone = 'info', action = null) {
    const result = row.querySelector('.linuxdo-gf-batch-result');
    result.textContent = message;
    result.dataset.tone = tone;
    if (action) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'linuxdo-gf-batch-action';
      button.textContent = action.label;
      button.addEventListener('click', action.onClick);
      result.append(' ', button);
    }
  }

  function createBatchRow(target, results) {
    const row = document.createElement('li');
    row.className = 'linuxdo-gf-batch-row';
    row.dataset.targetId = target.id;

    const name = document.createElement('span');
    name.className = 'linuxdo-gf-batch-name';
    name.textContent = target.name;

    const result = document.createElement('span');
    result.className = 'linuxdo-gf-batch-result';
    result.textContent = '等待检查';
    row.append(name, result);
    results.appendChild(row);
    return row;
  }

  async function checkBatchTarget(target, sha) {
    const [{ code }, publishedVersion] = await Promise.all([
      fetchLatestScriptAtSha(target, sha),
      fetchPublishedVersion(target, true),
    ]);
    const meta = validateCode(code, target);
    return {
      target,
      code,
      version: meta.version,
      publishedVersion,
      needsUpdate: compareVersions(meta.version, publishedVersion) > 0,
    };
  }

  function batchRetryAction(item, row) {
    return {
      label: '重试',
      onClick: async () => {
        setBatchRow(row, '正在重试...');
        try {
          const sha = await fetchLatestCommitSha();
          const checked = await checkBatchTarget(item.target, sha);
          if (!checked.needsUpdate) {
            setBatchRow(row, `已是最新 v${checked.publishedVersion}`, 'success');
            return;
          }
          setBatchRow(row, `正在发布 v${checked.version}...`);
          await publishInBackground(checked.target, checked.code, checked.version);
          setBatchRow(row, `已发布 v${checked.version}`, 'success');
        } catch (error) {
          if (error.requiresConfirmation) {
            setBatchRow(
              row,
              error.message,
              'warning',
              manualConfirmationAction(error.target, error.code, error.version)
            );
          } else {
            setBatchRow(row, error.message || String(error), 'error', batchRetryAction(item, row));
          }
        }
      },
    };
  }

  async function runBatchUpdate(widget) {
    const button = widget.querySelector('.linuxdo-gf-batch-button');
    const summary = widget.querySelector('.linuxdo-gf-batch-summary');
    const results = widget.querySelector('.linuxdo-gf-batch-results');
    const targets = Object.values(TARGETS).sort((left, right) => {
      if (left.id === HELPER_TARGET_ID) return 1;
      if (right.id === HELPER_TARGET_ID) return -1;
      return 0;
    });

    button.disabled = true;
    button.setAttribute('aria-busy', 'true');
    results.replaceChildren();
    summary.textContent = '正在检查 GitHub 与 Greasy Fork 版本...';

    if (!isLoggedIn()) {
      summary.textContent = '请先登录 Greasy Fork 后再更新脚本。';
      button.disabled = false;
      button.setAttribute('aria-busy', 'false');
      return;
    }

    const rows = new Map(targets.map((target) => [target.id, createBatchRow(target, results)]));
    try {
      const sha = await fetchLatestCommitSha();
      const checkedItems = await Promise.all(targets.map(async (target) => {
        const row = rows.get(target.id);
        setBatchRow(row, '正在比较版本...');
        try {
          const item = await checkBatchTarget(target, sha);
          setBatchRow(
            row,
            item.needsUpdate
              ? `待更新 v${item.publishedVersion} → v${item.version}`
              : `已是最新 v${item.publishedVersion}`,
            item.needsUpdate ? 'info' : 'success'
          );
          return item;
        } catch (error) {
          const failed = { target, error };
          setBatchRow(row, error.message || String(error), 'error', batchRetryAction(failed, row));
          return failed;
        }
      }));

      const updates = checkedItems.filter((item) => item.needsUpdate);
      const checkFailures = checkedItems.filter((item) => item.error).length;
      if (!updates.length) {
        summary.textContent = checkFailures
          ? `检查完成，${checkFailures} 个脚本检查失败。`
          : '所有脚本均为最新。';
        return;
      }

      let successCount = 0;
      let failureCount = checkFailures;
      for (const item of updates) {
        const row = rows.get(item.target.id);
        setBatchRow(row, `正在发布 v${item.version}...`);
        try {
          await publishInBackground(item.target, item.code, item.version);
          successCount += 1;
          setBatchRow(row, `已发布 v${item.version}`, 'success');
        } catch (error) {
          failureCount += 1;
          if (error.requiresConfirmation) {
            setBatchRow(
              row,
              error.message,
              'warning',
              manualConfirmationAction(error.target, error.code, error.version)
            );
          } else {
            setBatchRow(row, error.message || String(error), 'error', batchRetryAction(item, row));
          }
        }
      }
      summary.textContent = failureCount
        ? `更新完成：成功 ${successCount} 个，需处理 ${failureCount} 个。`
        : `更新完成：已发布 ${successCount} 个脚本。`;
    } catch (error) {
      summary.textContent = error.message || String(error);
      console.error('[LinuxDo Greasy Fork 发布助手]', error);
    } finally {
      button.disabled = false;
      button.setAttribute('aria-busy', 'false');
    }
  }

  function installBatchControl() {
    if (!isProfilePage() || document.querySelector('.linuxdo-gf-batch')) return;
    const header = document.querySelector('#control-panel > header');
    if (!header) return;
    ensureStyles();

    const widget = document.createElement('section');
    widget.className = 'linuxdo-gf-batch';
    widget.setAttribute('aria-label', '批量更新脚本');
    widget.innerHTML = `
      <div class="linuxdo-gf-batch-toolbar">
        <button type="button" class="linuxdo-gf-batch-button">一键更新脚本</button>
        <span class="linuxdo-gf-batch-summary" role="status" aria-live="polite">检查并后台发布所有新版本</span>
      </div>
      <ul class="linuxdo-gf-batch-results"></ul>
    `;
    header.insertAdjacentElement('afterend', widget);
    widget.querySelector('.linuxdo-gf-batch-button').addEventListener('click', () => runBatchUpdate(widget));
  }

  function resumeAfterLogin() {
    const pendingTargetId = sessionStorage.getItem(STORE_PENDING_TARGET);
    const target = TARGETS[pendingTargetId];
    if (!target || (!isTargetScriptPage(target) && !isProfilePage())) return;
    sessionStorage.removeItem(STORE_PENDING_TARGET);
    setTimeout(() => startUpdate(target), 500);
  }

  installDetailControl();
  installProfileControls();
  installBatchControl();
  resumeAfterLogin();
  autoPublishIfReady();
})();
