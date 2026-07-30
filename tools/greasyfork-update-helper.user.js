// ==UserScript==
// @name         LinuxDo Greasy Fork 发布助手
// @namespace    https://github.com/ywainzh/linuxdo-read-script
// @version      0.3.2
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

  async function fetchLatestScript(target) {
    const sha = await fetchLatestCommitSha();
    const rawUrl = `${RAW_URL_BASE}/${sha}/${encodeRepoPath(target.path)}`;
    const code = await requestText(rawUrl);
    return { code, sha };
  }

  async function fetchPublishedVersion(target) {
    if (targetIdFromPath() === target.id) {
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

  function setStatus(target, message = '', tone = 'info') {
    document.querySelectorAll(`[data-linuxdo-gf-status="${target.id}"]`).forEach((status) => {
      status.textContent = message;
      status.dataset.tone = tone;
      status.hidden = !message;
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

  function submitPrefillForm(target, code, version) {
    sessionStorage.setItem(STORE_AUTO_PUBLISH, '1');
    sessionStorage.setItem(STORE_TARGET_ID, target.id);
    sessionStorage.setItem(STORE_EXPECTED_VERSION, version);

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
        window.alert(
          `没有检测到新的版本需要发布。\n\nGitHub：v${meta.version}\nGreasy Fork：v${publishedVersion}`
        );
        return;
      }

      setBusy(target, true, '正在发布...');
      submitPrefillForm(target, code, meta.version);
    } catch (error) {
      setBusy(target, false);
      const message = error.message || String(error);
      setStatus(target, message, 'error');
      if (!document.querySelector(`[data-linuxdo-gf-status="${target.id}"]`)) window.alert(message);
      console.error('[LinuxDo Greasy Fork 发布助手]', error);
    }
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
      @media (max-width: 560px) {
        .linuxdo-gf-update-control {
          margin-top: 8px;
          margin-left: 0;
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
    });
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
  resumeAfterLogin();
  autoPublishIfReady();
})();
