// ==UserScript==
// @name         LinuxDo Greasy Fork 发布助手
// @namespace    https://github.com/ywainzh/linuxdo-read-script
// @version      0.2.0
// @license      MIT
// @description  在项目脚本的 Greasy Fork 页面一键从 GitHub 拉取并发布更新。
// @author       ywainzh
// @match        https://greasyfork.org/*/scripts/586863*
// @match        https://greasyfork.org/*/scripts/588940*
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

  function setStatus(message = '', tone = 'info') {
    const status = document.querySelector('#linuxdo-gf-update-status');
    if (!status) return;
    status.textContent = message;
    status.dataset.tone = tone;
    status.hidden = !message;
  }

  function setBusy(busy, label = '拉取并发布') {
    const button = document.querySelector('#linuxdo-gf-update-button');
    if (!button) return;
    button.disabled = busy;
    button.setAttribute('aria-busy', String(busy));
    button.textContent = label;
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
      setStatus();
      setBusy(true, '正在拉取...');

      if (!isLoggedIn()) {
        sessionStorage.setItem(STORE_PENDING_TARGET, target.id);
        const returnTo = `${location.pathname}${location.search}`;
        location.href = `${location.origin}${localePrefix()}/users/sign_in?return_to=${encodeURIComponent(returnTo)}`;
        return;
      }

      const { code, sha } = await fetchLatestScript(target);
      const meta = validateCode(code, target);
      const shortSha = sha.slice(0, 7);
      setBusy(false);

      const ok = window.confirm(
        `将从 GitHub ${shortSha} 拉取并公开发布 ${meta.name} v${meta.version} 到 Greasy Fork。\n\n` +
        '请确认本地修改已经推送到 GitHub，并且 @version 已递增。'
      );
      if (!ok) {
        setStatus('已取消。');
        return;
      }

      setBusy(true, '正在发布...');
      submitPrefillForm(target, code, meta.version);
    } catch (error) {
      setBusy(false);
      setStatus(error.message || String(error), 'error');
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

  function installControl() {
    const target = currentTarget();
    if (!isTargetScriptPage(target) || document.querySelector('#linuxdo-gf-update-control')) return;

    const installArea = document.querySelector('#install-area');
    if (!installArea) return;

    const style = document.createElement('style');
    style.id = 'linuxdo-gf-update-style';
    style.textContent = `
      #linuxdo-gf-update-control {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        margin-left: 8px;
        vertical-align: top;
        font: 14px/1.35 Arial, sans-serif;
      }
      #linuxdo-gf-update-button {
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
      #linuxdo-gf-update-button:hover:not(:disabled) {
        background: #0f5877;
      }
      #linuxdo-gf-update-button:focus-visible {
        outline: 2px solid #166b8f;
        outline-offset: 2px;
      }
      #linuxdo-gf-update-button:disabled {
        cursor: wait;
        opacity: .68;
      }
      #linuxdo-gf-update-status {
        max-width: min(340px, calc(100vw - 32px));
        color: #4b5563;
        font-size: 12px;
        overflow-wrap: anywhere;
      }
      #linuxdo-gf-update-status[data-tone="error"] {
        color: #b42318;
      }
      @media (max-width: 560px) {
        #linuxdo-gf-update-control {
          margin-top: 8px;
          margin-left: 0;
        }
      }
      @media (prefers-reduced-motion: reduce) {
        #linuxdo-gf-update-button {
          transition: none;
        }
      }
    `;
    document.head.appendChild(style);

    const control = document.createElement('span');
    control.id = 'linuxdo-gf-update-control';
    control.innerHTML = `
      <button type="button" id="linuxdo-gf-update-button">拉取并发布</button>
      <span id="linuxdo-gf-update-status" role="status" aria-live="polite" hidden></span>
    `;
    installArea.appendChild(control);
    control.querySelector('#linuxdo-gf-update-button').addEventListener('click', () => startUpdate(target));
  }

  function resumeAfterLogin() {
    const target = currentTarget();
    const pendingTargetId = sessionStorage.getItem(STORE_PENDING_TARGET);
    if (!isTargetScriptPage(target) || pendingTargetId !== target.id) return;
    sessionStorage.removeItem(STORE_PENDING_TARGET);
    setTimeout(() => startUpdate(target), 500);
  }

  installControl();
  resumeAfterLogin();
  autoPublishIfReady();
})();
