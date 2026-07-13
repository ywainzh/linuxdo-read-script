// ==UserScript==
// @name         LinuxDo Greasy Fork 发布助手
// @namespace    https://github.com/ywainzh/linuxdo-read-script
// @version      0.1.1
// @license      MIT
// @description  在 LinuxDo 便捷脚本的 Greasy Fork 页面一键从 GitHub 拉取最新版并发布更新。
// @author       ywainzh
// @match        https://greasyfork.org/*/scripts/586863*
// @match        https://greasyfork.org/*/script_versions/*
// @connect      api.github.com
// @connect      raw.githubusercontent.com
// @grant        GM_xmlhttpRequest
// @run-at       document-idle
// ==/UserScript==

(function () {
  'use strict';

  const SCRIPT_ID = '586863';
  const SCRIPT_NAME = 'LinuxDo 便捷脚本';
  const REPO_OWNER = 'ywainzh';
  const REPO_NAME = 'linuxdo-read-script';
  const REPO_BRANCH = 'main';
  const SCRIPT_PATH = 'LinuxDo%20%E4%BE%BF%E6%8D%B7%E8%84%9A%E6%9C%AC.user.js';
  const COMMIT_API_URL = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/commits/${REPO_BRANCH}`;
  const RAW_URL_BASE = `https://raw.githubusercontent.com/${REPO_OWNER}/${REPO_NAME}`;

  const STORE_PENDING = 'linuxdo.gfUpdate.pending';
  const STORE_AUTO_PUBLISH = 'linuxdo.gfUpdate.autoPublish';
  const STORE_EXPECTED_VERSION = 'linuxdo.gfUpdate.expectedVersion';

  function localePrefix() {
    const first = location.pathname.split('/').filter(Boolean)[0];
    return first ? `/${first}` : '/zh-CN';
  }

  function isTargetScriptPage() {
    return new RegExp(`/scripts/${SCRIPT_ID}(?:-|/|$)`).test(location.pathname);
  }

  function isLoggedIn() {
    return !document.querySelector('a[href*="/users/sign_in"]') && /登出|Sign out/i.test(document.body.innerText);
  }

  function readMeta(code, key) {
    const match = code.match(new RegExp(`^\\s*//\\s*@${key}\\s+(.+?)\\s*$`, 'm'));
    return match ? match[1].trim() : '';
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
    } catch (e) {
      throw new Error('GitHub commit API 返回内容无法解析。');
    }
    if (!data || !/^[0-9a-f]{40}$/i.test(data.sha || '')) {
      throw new Error('未能从 GitHub 读取 main 分支最新 commit。');
    }
    return data.sha;
  }

  async function fetchLatestScript() {
    const sha = await fetchLatestCommitSha();
    const rawUrl = `${RAW_URL_BASE}/${sha}/${SCRIPT_PATH}`;
    const code = await requestText(rawUrl);
    return { code, sha };
  }

  function validateCode(code) {
    if (!code.includes('// ==UserScript==') || !code.includes('// ==/UserScript==')) {
      throw new Error('GitHub 返回的内容不是用户脚本。');
    }
    const name = readMeta(code, 'name');
    const version = readMeta(code, 'version');
    if (name !== SCRIPT_NAME) {
      throw new Error(`脚本名不匹配：${name || '未读取到 @name'}`);
    }
    if (!version) {
      throw new Error('未读取到 @version。请先在主脚本里递增版本号。');
    }
    return { name, version };
  }

  function setStatus(message, tone = 'info') {
    const box = document.querySelector('#linuxdo-gf-update-status');
    if (!box) return;
    box.textContent = message;
    box.dataset.tone = tone;
  }

  function submitPrefillForm(code, version) {
    sessionStorage.setItem(STORE_AUTO_PUBLISH, '1');
    sessionStorage.setItem(STORE_EXPECTED_VERSION, version);

    const form = document.createElement('form');
    form.method = 'POST';
    form.action = `${location.origin}${localePrefix()}/scripts/${SCRIPT_ID}/versions/prefill`;
    form.enctype = 'multipart/form-data';
    form.style.display = 'none';

    const codeField = document.createElement('textarea');
    codeField.name = 'script_version[code]';
    codeField.value = code;
    form.appendChild(codeField);

    document.body.appendChild(form);
    form.submit();
  }

  async function startUpdate() {
    try {
      if (!isLoggedIn()) {
        sessionStorage.setItem(STORE_PENDING, '1');
        const returnTo = `${location.pathname}${location.search}`;
        location.href = `${location.origin}${localePrefix()}/users/sign_in?return_to=${encodeURIComponent(returnTo)}`;
        return;
      }

      setStatus('正在读取 GitHub main 最新 commit...');
      const { code, sha } = await fetchLatestScript();
      const meta = validateCode(code);
      const shortSha = sha.slice(0, 7);

      const ok = window.confirm(
        `将从 GitHub ${shortSha} 拉取并公开发布 ${meta.name} v${meta.version} 到 Greasy Fork。\n\n` +
        '请确认你已经把本地修改推送到 GitHub，并且 @version 已递增。'
      );
      if (!ok) {
        setStatus('已取消。');
        return;
      }

      setStatus(`已从 ${shortSha} 拉取 v${meta.version}，正在打开 Greasy Fork 更新表单...`);
      submitPrefillForm(code, meta.version);
    } catch (error) {
      setStatus(error.message || String(error), 'error');
      console.error('[LinuxDo Greasy Fork 发布助手]', error);
    }
  }

  function autoPublishIfReady() {
    if (sessionStorage.getItem(STORE_AUTO_PUBLISH) !== '1') return;

    const codeArea = document.querySelector('#script_version_code, textarea[name="script_version[code]"]');
    if (!codeArea) return;

    const expectedVersion = sessionStorage.getItem(STORE_EXPECTED_VERSION);
    const actualName = readMeta(codeArea.value, 'name');
    const actualVersion = readMeta(codeArea.value, 'version');
    if (actualName !== SCRIPT_NAME) {
      sessionStorage.removeItem(STORE_AUTO_PUBLISH);
      setStatus(`脚本名校验失败：表单中是 ${actualName || '未知'}。`, 'error');
      return;
    }
    if (expectedVersion && actualVersion !== expectedVersion) {
      sessionStorage.removeItem(STORE_AUTO_PUBLISH);
      setStatus(`版本校验失败：预期 ${expectedVersion}，表单中是 ${actualVersion || '未知'}。`, 'error');
      return;
    }

    const submitButton = [...document.querySelectorAll('button, input[type="submit"]')]
      .find((el) => /发布|提交|更新|Publish|Update/i.test(el.textContent || el.value || ''));

    if (!submitButton) {
      setStatus('已预填更新表单，但没有找到发布按钮。请手动检查并提交。', 'error');
      return;
    }

    sessionStorage.removeItem(STORE_AUTO_PUBLISH);
    sessionStorage.removeItem(STORE_EXPECTED_VERSION);
    setTimeout(() => submitButton.click(), 800);
  }

  function installPanel() {
    if (!isTargetScriptPage() || document.querySelector('#linuxdo-gf-update-panel')) return;

    const panel = document.createElement('div');
    panel.id = 'linuxdo-gf-update-panel';
    panel.innerHTML = `
      <style>
        #linuxdo-gf-update-panel{
          position:fixed;right:18px;bottom:18px;z-index:2147483000;
          width:min(330px,calc(100vw - 36px));padding:12px;
          border:1px solid #8b949e;border-radius:8px;background:#fff;color:#222;
          box-shadow:0 10px 30px rgba(0,0,0,.22);font:14px/1.45 system-ui,sans-serif;
        }
        @media (prefers-color-scheme:dark){
          #linuxdo-gf-update-panel{background:#161b22;color:#e6edf3;border-color:#30363d;}
        }
        #linuxdo-gf-update-panel button{
          width:100%;border:0;border-radius:6px;padding:9px 10px;cursor:pointer;
          background:#238636;color:#fff;font-weight:700;
        }
        #linuxdo-gf-update-panel button:hover{background:#2ea043;}
        #linuxdo-gf-update-status{margin-top:8px;font-size:12px;word-break:break-word;opacity:.86;}
        #linuxdo-gf-update-status[data-tone="error"]{color:#d1242f;opacity:1;}
      </style>
      <button type="button" id="linuxdo-gf-update-button">拉取 GitHub 最新版并发布</button>
      <div id="linuxdo-gf-update-status">来源：GitHub main 最新 commit 的主脚本文件。</div>
    `;
    document.body.appendChild(panel);
    document.querySelector('#linuxdo-gf-update-button').addEventListener('click', startUpdate);
  }

  function resumeAfterLogin() {
    if (!isTargetScriptPage()) return;
    if (sessionStorage.getItem(STORE_PENDING) !== '1') return;
    sessionStorage.removeItem(STORE_PENDING);
    setTimeout(startUpdate, 500);
  }

  installPanel();
  resumeAfterLogin();
  autoPublishIfReady();
})();
