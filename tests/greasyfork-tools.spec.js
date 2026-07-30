const fs = require('node:fs');
const path = require('node:path');
const { test, expect } = require('@playwright/test');

const HELPER = fs.readFileSync(
  path.join(__dirname, '..', 'tools', 'greasyfork-update-helper.user.js'),
  'utf8',
);
const REDESIGN = fs.readFileSync(
  path.join(__dirname, '..', 'plugins', 'GreasyFork美化增强版', 'greasyfork-github-redesign.user.js'),
  'utf8',
);
const SHA = 'a'.repeat(40);
const targets = {
  '586863': { name: 'LinuxDo 便捷脚本', path: 'LinuxDo 便捷脚本.user.js', github: '2.0.12', published: '2.0.12' },
  '588940': { name: 'Linux DO 登录助手', path: 'plugins/LinuxDO登录助手/linuxdo-auto-login.user.js', github: '1.3.0', published: '1.3.0' },
  '588943': { name: 'LinuxDo Greasy Fork 发布助手', path: 'tools/greasyfork-update-helper.user.js', github: '0.3.3', published: '0.3.2' },
  '589199': { name: 'GreasyFork 美化增强版 | GitHub Redesign', path: 'plugins/GreasyFork美化增强版/greasyfork-github-redesign.user.js', github: '1.2.5', published: '1.2.4' },
};

function userscript(name, version) {
  return `// ==UserScript==\n// @name         ${name}\n// @version      ${version}\n// ==/UserScript==\n`;
}

function profileHtml() {
  return `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"></head><body>
    <a href="/users/sign_out">登出</a>
    <section id="control-panel"><header><h3>控制台</h3></header><ul id="user-control-panel"></ul></section>
  </body></html>`;
}

test('batch update publishes in place, preserves CSRF, and updates the helper last', async ({ page }) => {
  const published = Object.fromEntries(Object.entries(targets).map(([id, target]) => [id, target.published]));
  const postOrder = [];
  const postBodies = [];

  await page.addInitScript(({ definitions, sha }) => {
    window.__gmCalls = [];
    window.GM_xmlhttpRequest = (options) => {
      window.__gmCalls.push(options.url);
      const decodedUrl = decodeURIComponent(options.url);
      let body = '';
      if (options.url.includes('/commits/main')) {
        body = JSON.stringify({ sha });
      } else {
        const target = Object.values(definitions).find((item) => decodedUrl.includes(item.path));
        body = target ? `// ==UserScript==\n// @name         ${target.name}\n// @version      ${target.github}\n// ==/UserScript==\n` : '';
      }
      queueMicrotask(() => options.onload({ status: body ? 200 : 404, responseText: body }));
    };
  }, { definitions: targets, sha: SHA });

  await page.route('https://greasyfork.org/**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.pathname === '/zh-CN/users/1622808-ywainzh') {
      await route.fulfill({ contentType: 'text/html', body: profileHtml() });
      return;
    }

    const id = url.pathname.match(/\/scripts\/(\d+)/)?.[1];
    if (!id || !targets[id]) {
      await route.fulfill({ status: 404, body: 'not found' });
      return;
    }
    if (request.method() === 'GET' && /\/versions\/new$/.test(url.pathname)) {
      await route.fulfill({
        contentType: 'text/html',
        body: `<form action="/zh-CN/scripts/${id}-test/versions" method="post">
          <input type="hidden" name="authenticity_token" value="csrf-${id}">
          <input type="hidden" name="script_version[additional_info][0][attribute_value]" value="zh-CN">
          <textarea name="script_version[code]"></textarea>
          <input type="submit" name="commit" value="发布新版本">
        </form>`,
      });
      return;
    }
    if (request.method() === 'POST' && /\/versions$/.test(url.pathname)) {
      postOrder.push(id);
      postBodies.push(request.postData() || '');
      published[id] = targets[id].github;
      await route.fulfill({ contentType: 'text/html', body: '<p>published</p>' });
      return;
    }
    await route.fulfill({
      contentType: 'text/html',
      body: `<div id="install-area"><a class="install-link" data-script-version="${published[id]}"></a></div>`,
    });
  });

  await page.goto('https://greasyfork.org/zh-CN/users/1622808-ywainzh');
  await page.addScriptTag({ content: HELPER });
  await page.getByRole('button', { name: '一键更新脚本' }).click();
  await expect(page.locator('.linuxdo-gf-batch-summary')).toContainText('已发布 2 个脚本');

  expect(page.url()).toBe('https://greasyfork.org/zh-CN/users/1622808-ywainzh');
  expect(postOrder).toEqual(['589199', '588943']);
  expect(postBodies[0]).toContain('csrf-589199');
  expect(postBodies[1]).toContain('csrf-588943');
  expect(await page.evaluate(() => window.__gmCalls.filter((url) => url.includes('/commits/main')).length)).toBe(1);
});

test('dashboard puts scripts second and navigation state has a cancellation fallback', async ({ page }) => {
  const sections = [
    ['control-panel', '控制台'],
    ['user-discussions-on-scripts-written', '相关讨论'],
    ['user-discussions', '最近留言'],
    ['user-conversations', '近期私信'],
    ['user-script-sets-section', '脚本集'],
    ['user-script-list-section', '脚本'],
  ].map(([id, label]) => `<section id="${id}"><header><h3>${label}</h3></header></section>`).join('');

  await page.addInitScript({ content: REDESIGN });
  await page.route('https://greasyfork.org/**', (route) => route.fulfill({
    contentType: 'text/html',
    body: `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"></head><body>
      <main class="width-constraint"><section id="about-user"><h2>ywainzh</h2></section>${sections}</main>
    </body></html>`,
  }));
  await page.goto('https://greasyfork.org/zh-CN/users/1622808-ywainzh');

  await expect(page.locator('.gf-dashboard-tab')).toHaveCount(6);
  const labels = await page.locator('.gf-dashboard-tab').allTextContents();
  expect(labels.slice(0, 2).map((label) => label.trim())).toEqual(['控制台', '脚本']);

  await page.evaluate(() => window.dispatchEvent(new Event('beforeunload')));
  await expect(page.locator('html')).toHaveAttribute('data-gf-leaving', '');
  await expect(page.locator('html')).not.toHaveAttribute('data-gf-leaving', { timeout: 2200 });
});
