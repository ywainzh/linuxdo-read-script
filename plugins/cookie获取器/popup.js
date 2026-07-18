import {
  mergeCookieLists,
  normalizePartitionKey,
  serializeCookieHeader,
  sortCookiesByName
} from './cookie-utils.js';

const elements = {
  status: document.getElementById('status'),
  container: document.getElementById('cookieContainer'),
  refresh: document.getElementById('refreshBtn'),
  copyAll: document.getElementById('copyBtn'),
  domain: document.getElementById('domainInfo'),
  config: document.getElementById('configBtn'),
  backendIndicator: document.getElementById('backendIndicator'),
  backendStatus: document.getElementById('backendStatus'),
  lastTransfer: document.getElementById('lastTransferStatus'),
  search: document.getElementById('searchInput'),
  searchButton: document.getElementById('searchBtn'),
  clearSearch: document.getElementById('clearSearchBtn')
};

let currentCookies = [];
let currentStoreId = '';

function setStatus(message, type = '') {
  elements.status.textContent = message;
  elements.status.className = `status${type ? ` ${type}` : ''}`;
}

function appendHighlighted(container, value, searchTerm) {
  const text = String(value ?? '');
  if (!searchTerm) {
    container.textContent = text;
    return;
  }

  const index = text.toLowerCase().indexOf(searchTerm.toLowerCase());
  if (index < 0) {
    container.textContent = text;
    return;
  }

  container.append(document.createTextNode(text.slice(0, index)));
  const mark = document.createElement('mark');
  mark.textContent = text.slice(index, index + searchTerm.length);
  container.append(mark, document.createTextNode(text.slice(index + searchTerm.length)));
}

function formatExpiration(cookie) {
  if (cookie.session || cookie.expirationDate == null) {
    return '会话';
  }
  return new Date(cookie.expirationDate * 1000).toLocaleString();
}

function formatPartitionKey(cookie) {
  return cookie.partitionKey ? JSON.stringify(cookie.partitionKey) : '无';
}

async function copyText(value) {
  await navigator.clipboard.writeText(value);
}

function createCookieItem(cookie, searchTerm) {
  const item = document.createElement('li');
  item.className = 'cookie-item';

  const info = document.createElement('div');
  info.className = 'cookie-info';
  const name = document.createElement('span');
  name.className = 'cookie-name';
  appendHighlighted(name, cookie.name, searchTerm);
  const separator = document.createTextNode(' =');

  const valueRow = document.createElement('div');
  valueRow.className = 'cookie-value-row';
  const value = document.createElement('span');
  value.className = 'cookie-value';
  appendHighlighted(value, cookie.value, searchTerm);
  const valueToggle = document.createElement('button');
  valueToggle.type = 'button';
  valueToggle.className = 'value-toggle';
  valueToggle.hidden = true;
  valueToggle.textContent = '▼';
  valueToggle.title = '展开 Cookie 值';
  valueToggle.setAttribute('aria-label', '展开 Cookie 值');
  valueToggle.setAttribute('aria-expanded', 'false');
  valueToggle.addEventListener('click', () => {
    const expanded = value.classList.toggle('expanded');
    valueToggle.textContent = expanded ? '▲' : '▼';
    valueToggle.title = expanded ? '收起 Cookie 值' : '展开 Cookie 值';
    valueToggle.setAttribute('aria-label', valueToggle.title);
    valueToggle.setAttribute('aria-expanded', String(expanded));
  });
  valueRow.append(value, valueToggle);

  const meta = document.createElement('div');
  meta.className = 'cookie-meta';
  const metaLines = [
    `Domain: ${cookie.domain}　Path: ${cookie.path}`,
    `HttpOnly: ${cookie.httpOnly ? '是' : '否'}　Secure: ${cookie.secure ? '是' : '否'}　SameSite: ${cookie.sameSite || 'unspecified'}`,
    `过期时间: ${formatExpiration(cookie)}　Store ID: ${cookie.storeId}`,
    `Partition Key: ${formatPartitionKey(cookie)}`
  ];
  meta.textContent = metaLines.join('\n');
  meta.style.whiteSpace = 'pre-line';
  info.append(name, separator, valueRow, meta);

  const copy = document.createElement('button');
  copy.className = 'copy-one';
  copy.textContent = '复制';
  copy.addEventListener('click', async () => {
    try {
      await copyText(`${cookie.name}=${cookie.value}`);
      copy.textContent = '已复制';
    } catch {
      copy.textContent = '失败';
    }
    setTimeout(() => { copy.textContent = '复制'; }, 1500);
  });

  item.append(info, copy);
  return item;
}

function renderCookies(searchTerm = '') {
  elements.container.replaceChildren();
  const normalizedSearch = searchTerm.trim().toLowerCase();
  const filtered = normalizedSearch
    ? currentCookies.filter(cookie =>
      cookie.name.toLowerCase().includes(normalizedSearch) ||
      cookie.value.toLowerCase().includes(normalizedSearch)
    )
    : currentCookies;

  if (!filtered.length && normalizedSearch) {
    const empty = document.createElement('p');
    empty.className = 'empty';
    empty.textContent = '没有找到匹配的 Cookie';
    elements.container.append(empty);
    setStatus('没有找到匹配的 Cookie', 'error');
    return;
  }

  const section = document.createElement('section');
  const heading = document.createElement('h2');
  heading.textContent = `Cookie (${filtered.length})`;
  const list = document.createElement('ul');
  list.className = 'cookie-list';
  for (const cookie of filtered) {
    list.append(createCookieItem(cookie, normalizedSearch));
  }
  section.append(heading, list);
  elements.container.append(section);
  requestAnimationFrame(() => {
    for (const value of elements.container.querySelectorAll('.cookie-value')) {
      const toggle = value.parentElement.querySelector('.value-toggle');
      toggle.hidden = value.scrollHeight <= value.clientHeight + 1;
    }
  });
  setStatus(
    normalizedSearch
      ? `找到 ${filtered.length} 个匹配的 Cookie`
      : `已获取 ${currentCookies.length} 个 Cookie（Store ${currentStoreId}）`,
    'success'
  );
}

async function getCurrentTabCookies() {
  currentCookies = [];
  currentStoreId = '';
  elements.search.value = '';
  elements.container.replaceChildren();
  setStatus('正在获取 Cookie…');

  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id || !tab.url) {
      throw new Error('无法获取当前活动标签页');
    }

    const pageUrl = new URL(tab.url);
    if (!['http:', 'https:'].includes(pageUrl.protocol)) {
      throw new Error('当前页面不是可读取 Cookie 的 HTTP(S) 页面');
    }

    const stores = await chrome.cookies.getAllCookieStores();
    const store = stores.find(item => item.tabIds.includes(tab.id));
    if (!store) {
      throw new Error('无法确定当前标签页所属的 Cookie Store');
    }

    const partitionResult = await chrome.cookies.getPartitionKey({ tabId: tab.id, frameId: 0 });
    const partitionKey = normalizePartitionKey(partitionResult?.partitionKey);
    const ordinaryPromise = chrome.cookies.getAll({ url: tab.url, storeId: store.id });
    const partitionedPromise = partitionKey
      ? chrome.cookies.getAll({ url: tab.url, storeId: store.id, partitionKey })
      : Promise.resolve([]);
    const [ordinaryCookies, partitionedCookies] = await Promise.all([
      ordinaryPromise,
      partitionedPromise
    ]);

    currentStoreId = store.id;
    currentCookies = sortCookiesByName(
      mergeCookieLists(ordinaryCookies, partitionedCookies)
    );
    elements.domain.textContent = `当前页面：${pageUrl.hostname}${pageUrl.pathname}　Store: ${store.id}`;
    renderCookies();
  } catch (error) {
    currentCookies = [];
    elements.domain.textContent = '当前页面不可读取';
    const empty = document.createElement('p');
    empty.className = 'empty';
    empty.textContent = error.message || String(error);
    elements.container.replaceChildren(empty);
    setStatus(error.message || String(error), 'error');
  }
}

function formatLastStatus(status) {
  if (!status) {
    return '最近传输：暂无记录';
  }
  const result = status.state === 'success' ? '成功' : '失败';
  const source = status.source === 'test' ? '连接测试' : status.source === 'config' ? '配置检查' : '自动同步';
  const time = status.timestamp ? new Date(status.timestamp).toLocaleString() : '未知时间';
  const target = status.domain ? `，${status.domain} / Store ${status.storeId ?? '-'}` : '';
  const partition = status.partitionKey
    ? `，Partition ${JSON.stringify(status.partitionKey)}`
    : '';
  const http = status.httpStatus ? `，HTTP ${status.httpStatus}` : '';
  return `最近传输：${result}（${source}，${time}${target}${partition}${http}，尝试 ${status.attempts ?? 0} 次）— ${status.message || ''}`;
}

async function loadBackendStatus() {
  const [localResult, sessionResult] = await Promise.all([
    chrome.storage.local.get('backendConfig'),
    chrome.storage.session.get('backendTransferState')
  ]);
  const enabled = Boolean(localResult.backendConfig?.enabled);
  elements.backendIndicator.className = `indicator ${enabled ? 'enabled' : 'disabled'}`;
  elements.backendStatus.textContent = `后台传输：${enabled ? '已启用' : '已禁用'}`;
  elements.lastTransfer.textContent = formatLastStatus(
    sessionResult.backendTransferState?.lastStatus
  );
}

elements.refresh.addEventListener('click', () => {
  void getCurrentTabCookies();
  void loadBackendStatus();
});
elements.copyAll.addEventListener('click', async () => {
  if (!currentCookies.length) {
    setStatus('没有可复制的 Cookie', 'error');
    return;
  }
  try {
    await copyText(serializeCookieHeader(currentCookies));
    setStatus('当前页面的全部 Cookie 已复制', 'success');
  } catch {
    setStatus('复制失败，请检查剪贴板权限', 'error');
  }
});
elements.config.addEventListener('click', () => chrome.runtime.openOptionsPage());
elements.searchButton.addEventListener('click', () => renderCookies(elements.search.value));
elements.search.addEventListener('keydown', event => {
  if (event.key === 'Enter') {
    renderCookies(elements.search.value);
  }
});
elements.clearSearch.addEventListener('click', () => {
  elements.search.value = '';
  renderCookies();
});

chrome.storage.onChanged.addListener((_changes, areaName) => {
  if (areaName === 'local' || areaName === 'session') {
    void loadBackendStatus();
  }
});

void getCurrentTabCookies();
void loadBackendStatus();
