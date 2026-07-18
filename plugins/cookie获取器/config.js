import {
  createDefaultConfig,
  createExampleContext,
  normalizeBackendConfig,
  renderDataFormat,
  validateBackendConfig,
  validateDataFormat,
  validateHeaders,
  validateRegexFilters
} from './cookie-utils.js';

const elements = {
  enabled: document.getElementById('enableBackend'),
  url: document.getElementById('backendUrl'),
  method: document.getElementById('requestMethod'),
  headers: document.getElementById('customHeaders'),
  dataFormat: document.getElementById('dataFormat'),
  save: document.getElementById('saveBtn'),
  test: document.getElementById('testBtn'),
  reset: document.getElementById('resetBtn'),
  status: document.getElementById('status'),
  lastStatus: document.getElementById('lastTransferStatus'),
  testResult: document.getElementById('testResult'),
  domainFilterInput: document.getElementById('urlFilterInput'),
  addDomainFilter: document.getElementById('addUrlFilter'),
  domainFilterList: document.getElementById('urlFilterList'),
  domainRegex: document.getElementById('urlFilterType'),
  cookieFilterInput: document.getElementById('cookieKeyFilterInput'),
  addCookieFilter: document.getElementById('addCookieKeyFilter'),
  cookieFilterList: document.getElementById('cookieKeyFilterList'),
  cookieExclude: document.getElementById('cookieFilterType')
};

let domainFilters = [];
let cookieFilters = [];
let statusTimer;

function showStatus(message, type) {
  clearTimeout(statusTimer);
  elements.status.textContent = message;
  elements.status.className = `status ${type}`;
  statusTimer = setTimeout(() => {
    elements.status.className = 'status';
  }, 4000);
}

function renderFilterList(container, values, onRemove) {
  container.replaceChildren();
  for (const [index, value] of values.entries()) {
    const tag = document.createElement('span');
    tag.className = 'filter-tag';
    const text = document.createElement('span');
    text.textContent = value;
    const remove = document.createElement('button');
    remove.type = 'button';
    remove.setAttribute('aria-label', `删除 ${value}`);
    remove.textContent = '×';
    remove.addEventListener('click', () => onRemove(index));
    tag.append(text, remove);
    container.append(tag);
  }
}

function renderFilters() {
  renderFilterList(elements.domainFilterList, domainFilters, index => {
    domainFilters.splice(index, 1);
    renderFilters();
  });
  renderFilterList(elements.cookieFilterList, cookieFilters, index => {
    cookieFilters.splice(index, 1);
    renderFilters();
  });
}

function addFilter(input, values, label) {
  const value = input.value.trim();
  if (!value) {
    return;
  }
  if (values.includes(value)) {
    showStatus(`${label}已存在`, 'error');
    return;
  }
  values.push(value);
  input.value = '';
  renderFilters();
}

function applyConfig(configValue) {
  const config = normalizeBackendConfig(configValue);
  elements.enabled.checked = Boolean(config.enabled);
  elements.url.value = config.url || '';
  elements.method.value = config.method || 'POST';
  elements.headers.value = JSON.stringify(config.headers, null, 2);
  elements.dataFormat.value = config.dataFormat;
  domainFilters = [...config.urlFilters];
  cookieFilters = [...config.cookieKeyFilters];
  elements.domainRegex.checked = Boolean(config.urlFilterUseRegex);
  elements.cookieExclude.checked = Boolean(config.cookieFilterExcludeMode);
  renderFilters();
}

function readHeaders() {
  let headers;
  try {
    headers = JSON.parse(elements.headers.value || '{}');
  } catch (error) {
    throw new Error(`自定义请求头格式无效：${error.message}`);
  }
  return validateHeaders(headers);
}

function readConfig({ requireUrl = false } = {}) {
  const config = {
    enabled: elements.enabled.checked,
    url: elements.url.value.trim(),
    method: elements.method.value,
    headers: readHeaders(),
    dataFormat: elements.dataFormat.value,
    urlFilters: [...domainFilters],
    urlFilterUseRegex: elements.domainRegex.checked,
    cookieKeyFilters: [...cookieFilters],
    cookieFilterExcludeMode: elements.cookieExclude.checked
  };

  validateDataFormat(config.dataFormat);
  if (config.urlFilterUseRegex) {
    validateRegexFilters(config.urlFilters);
  }
  return validateBackendConfig(config, { requireUrl });
}

async function loadConfig() {
  const result = await chrome.storage.local.get('backendConfig');
  applyConfig(result.backendConfig || createDefaultConfig());
}

async function saveConfig() {
  try {
    const config = readConfig();
    await chrome.storage.local.set({ backendConfig: config });
    showStatus('配置已保存并立即生效', 'success');
  } catch (error) {
    showStatus(error.message || String(error), 'error');
  }
}

function addTestLine(label, value, preformatted = false) {
  const wrapper = document.createElement(preformatted ? 'pre' : 'p');
  const strong = document.createElement('strong');
  strong.textContent = `${label}：`;
  wrapper.append(strong, document.createTextNode(String(value)));
  elements.testResult.append(wrapper);
}

async function testConnection() {
  elements.testResult.replaceChildren();
  elements.testResult.className = 'test-result visible';

  try {
    const config = readConfig({ requireUrl: true });
    const rendered = renderDataFormat(config.dataFormat, createExampleContext());
    addTestLine('URL', config.url);
    addTestLine('方法', config.method);
    addTestLine('请求头', JSON.stringify(config.headers, null, 2), true);
    addTestLine('数据', rendered, true);
    addTestLine('状态', '正在发送…');

    const result = await chrome.runtime.sendMessage({
      action: 'testBackendConfig',
      config
    });
    if (!result?.success) {
      throw new Error(result?.error || '后台脚本未返回测试结果');
    }

    addTestLine('结果', `成功，HTTP ${result.httpStatus}，尝试 ${result.attempts} 次`);
    addTestLine(
      '响应',
      `${result.responseText}${result.responseTruncated ? '…（已截断）' : ''}`,
      true
    );
    showStatus('测试连接成功', 'success');
  } catch (error) {
    addTestLine('结果', `失败：${error.message || String(error)}`);
    showStatus(`测试连接失败：${error.message || String(error)}`, 'error');
  }
}

async function resetConfig() {
  if (!confirm('确定要重置所有后台配置吗？')) {
    return;
  }
  const config = createDefaultConfig();
  applyConfig(config);
  await chrome.storage.local.set({ backendConfig: config });
  showStatus('配置已重置为 1.1.0 默认值', 'success');
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

async function loadLastStatus() {
  const result = await chrome.storage.session.get('backendTransferState');
  elements.lastStatus.textContent = formatLastStatus(
    result.backendTransferState?.lastStatus
  );
}

for (const button of document.querySelectorAll('.tab-button')) {
  button.addEventListener('click', () => {
    for (const item of document.querySelectorAll('.tab-button')) {
      item.classList.toggle('active', item === button);
      item.classList.toggle('secondary', item !== button);
    }
    for (const content of document.querySelectorAll('.tab-content')) {
      content.classList.toggle('active', content.id === `${button.dataset.tab}-tab`);
    }
  });
}

elements.addDomainFilter.addEventListener('click', () =>
  addFilter(elements.domainFilterInput, domainFilters, '该域名过滤器')
);
elements.addCookieFilter.addEventListener('click', () =>
  addFilter(elements.cookieFilterInput, cookieFilters, '该 Cookie 键')
);
elements.domainFilterInput.addEventListener('keydown', event => {
  if (event.key === 'Enter') {
    addFilter(elements.domainFilterInput, domainFilters, '该域名过滤器');
  }
});
elements.cookieFilterInput.addEventListener('keydown', event => {
  if (event.key === 'Enter') {
    addFilter(elements.cookieFilterInput, cookieFilters, '该 Cookie 键');
  }
});
elements.save.addEventListener('click', () => void saveConfig());
elements.test.addEventListener('click', () => void testConnection());
elements.reset.addEventListener('click', () => void resetConfig());

chrome.storage.onChanged.addListener((_changes, areaName) => {
  if (areaName === 'session') {
    void loadLastStatus();
  }
});

await Promise.all([loadConfig(), loadLastStatus()]);
