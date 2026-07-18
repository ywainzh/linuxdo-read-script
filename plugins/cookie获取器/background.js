import { requestWithRetry } from './backend-client.js';
import {
  createDefaultConfig,
  createExampleContext,
  filterCookies,
  matchesDomain,
  normalizeBackendConfig,
  normalizeCookieDomain,
  normalizePartitionKey,
  partitionKeyId,
  renderDataFormat,
  sha256,
  shouldProcessCookieName,
  snapshotFingerprint,
  snapshotKey,
  validateBackendConfig
} from './cookie-utils.js';

const SESSION_STATE_KEY = 'backendTransferState';
const LEGACY_COOKIE_KEYS = [
  'current_domain',
  'current_cookies',
  'first_party_cookies',
  'third_party_cookies'
];
const DEBOUNCE_MS = 500;

let backendConfig = createDefaultConfig();
let configRevision = 0;
let successfulFingerprints = {};
let lastStatus = null;
let sessionWrite = Promise.resolve();
const groups = new Map();

const ready = initialize().catch(async error => {
  console.error('Cookie 获取器后台初始化失败：', error);
  await recordStatus({
    state: 'error',
    source: 'config',
    attempts: 0,
    message: `后台初始化失败：${error.message || String(error)}`
  });
});

async function initialize() {
  const revisionAtStart = configRevision;
  const [localResult, sessionResult] = await Promise.all([
    chrome.storage.local.get('backendConfig'),
    chrome.storage.session.get(SESSION_STATE_KEY)
  ]);

  if (configRevision === revisionAtStart) {
    backendConfig = normalizeBackendConfig(localResult.backendConfig);
  }
  const storedState = sessionResult[SESSION_STATE_KEY];
  if (storedState && typeof storedState === 'object' && configRevision === revisionAtStart) {
    successfulFingerprints = storedState.lastSuccessfulFingerprints || {};
    lastStatus = storedState.lastStatus || null;
  }

  await chrome.storage.local.remove(LEGACY_COOKIE_KEYS);

  if (backendConfig.enabled) {
    try {
      validateBackendConfig(backendConfig, { requireUrl: true });
    } catch (error) {
      await recordStatus({
        state: 'error',
        source: 'config',
        attempts: 0,
        message: error.message
      });
      console.error('Cookie 获取器后台配置无效：', error.message);
    }
  }
}

function persistSessionState() {
  const value = {
    lastStatus,
    lastSuccessfulFingerprints: { ...successfulFingerprints }
  };
  sessionWrite = sessionWrite
    .catch(() => {})
    .then(() => chrome.storage.session.set({ [SESSION_STATE_KEY]: value }));
  return sessionWrite;
}

async function recordStatus(status) {
  lastStatus = {
    timestamp: new Date().toISOString(),
    domain: null,
    storeId: null,
    partitionKey: null,
    httpStatus: null,
    ...status
  };
  try {
    await persistSessionState();
  } catch (error) {
    console.error('Cookie 获取器无法保存临时传输状态：', error);
  }
}

function fullEvent(changeInfo) {
  return {
    removed: Boolean(changeInfo.removed),
    cause: changeInfo.cause,
    cookie: changeInfo.cookie
  };
}

async function handleCookieChange(changeInfo) {
  await ready;

  let config;
  try {
    config = validateBackendConfig(backendConfig, { requireUrl: true });
  } catch (error) {
    if (backendConfig.enabled) {
      await recordStatus({ state: 'error', source: 'config', attempts: 0, message: error.message });
      console.error('Cookie 获取器后台配置无效：', error.message);
    }
    return;
  }

  if (!config.enabled) {
    return;
  }

  const cookie = changeInfo.cookie;
  const domain = normalizeCookieDomain(cookie.domain);
  if (!domain || !matchesDomain(domain, config.urlFilters, config.urlFilterUseRegex)) {
    return;
  }
  if (!shouldProcessCookieName(
    cookie.name,
    config.cookieKeyFilters,
    config.cookieFilterExcludeMode
  )) {
    return;
  }

  const partitionKey = normalizePartitionKey(cookie.partitionKey);
  const key = snapshotKey(domain, cookie.storeId, partitionKey);
  scheduleGroup(key, {
    domain,
    storeId: cookie.storeId,
    partitionKey,
    event: fullEvent(changeInfo)
  });
}

function scheduleGroup(key, context) {
  const state = groups.get(key) || {
    timer: null,
    debouncedContext: null,
    pendingContext: null,
    running: false
  };

  state.debouncedContext = context;
  if (state.timer) {
    clearTimeout(state.timer);
  }
  state.timer = setTimeout(() => {
    state.timer = null;
    state.pendingContext = state.debouncedContext;
    state.debouncedContext = null;
    void drainGroup(key, state);
  }, DEBOUNCE_MS);
  groups.set(key, state);
}

async function drainGroup(key, state) {
  if (state.running) {
    return;
  }

  state.running = true;
  try {
    while (state.pendingContext) {
      const context = state.pendingContext;
      state.pendingContext = null;
      await processSnapshot(key, context);
    }
  } finally {
    state.running = false;
    if (!state.timer && !state.pendingContext && !state.debouncedContext) {
      groups.delete(key);
    }
  }
}

async function getExactDomainSnapshot({ domain, storeId, partitionKey }, config) {
  const query = { domain, storeId };
  if (partitionKey) {
    query.partitionKey = partitionKey;
  }

  const cookies = await chrome.cookies.getAll(query);
  const expectedPartition = partitionKeyId(partitionKey);
  const exactDomainCookies = cookies.filter(cookie =>
    normalizeCookieDomain(cookie.domain) === domain &&
    partitionKeyId(cookie.partitionKey) === expectedPartition
  );
  return filterCookies(
    exactDomainCookies,
    config.cookieKeyFilters,
    config.cookieFilterExcludeMode
  );
}

async function processSnapshot(key, context) {
  let config;
  try {
    const revision = configRevision;
    config = validateBackendConfig(backendConfig, { requireUrl: true });
    if (!config.enabled ||
        !matchesDomain(context.domain, config.urlFilters, config.urlFilterUseRegex) ||
        !shouldProcessCookieName(
          context.event.cookie.name,
          config.cookieKeyFilters,
          config.cookieFilterExcludeMode
        )) {
      return;
    }

    const cookies = await getExactDomainSnapshot(context, config);
    const fingerprint = await sha256(snapshotFingerprint(cookies));
    if (successfulFingerprints[key] === fingerprint) {
      return;
    }

    const transferContext = { ...context, cookies };
    const result = await send(config, transferContext);
    if (revision === configRevision) {
      successfulFingerprints[key] = fingerprint;
    }
    await recordStatus({
      state: 'success',
      source: 'automatic',
      domain: context.domain,
      storeId: context.storeId,
      partitionKey: context.partitionKey,
      attempts: result.attempts,
      httpStatus: result.status,
      message: 'Cookie 快照已发送'
    });
  } catch (error) {
    await recordStatus({
      state: 'error',
      source: 'automatic',
      domain: context.domain,
      storeId: context.storeId,
      partitionKey: context.partitionKey,
      attempts: error.attempts || 0,
      httpStatus: error.status || null,
      message: error.message || String(error)
    });
    console.error('Cookie 快照发送失败：', error);
  }
}

async function send(config, context) {
  const body = renderDataFormat(config.dataFormat, context);
  JSON.parse(body);
  return requestWithRetry({
    url: config.url,
    method: config.method,
    headers: config.headers,
    body
  });
}

async function testBackendConfig(configValue) {
  await ready;
  const context = createExampleContext();

  try {
    const config = validateBackendConfig(configValue, { requireUrl: true });
    const result = await send(config, context);
    await recordStatus({
      state: 'success',
      source: 'test',
      domain: context.domain,
      storeId: context.storeId,
      partitionKey: context.partitionKey,
      attempts: result.attempts,
      httpStatus: result.status,
      message: '测试连接成功'
    });
    return {
      success: true,
      responseText: result.responseText.slice(0, 200),
      responseTruncated: result.responseText.length > 200,
      attempts: result.attempts,
      httpStatus: result.status
    };
  } catch (error) {
    await recordStatus({
      state: 'error',
      source: 'test',
      domain: context.domain,
      storeId: context.storeId,
      partitionKey: context.partitionKey,
      attempts: error.attempts || 0,
      httpStatus: error.status || null,
      message: error.message || String(error)
    });
    console.error('Cookie 获取器测试连接失败：', error);
    return {
      success: false,
      error: error.message || String(error),
      attempts: error.attempts || 0,
      httpStatus: error.status || null
    };
  }
}

chrome.cookies.onChanged.addListener(changeInfo => {
  void handleCookieChange(changeInfo);
});

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName !== 'local' || !changes.backendConfig) {
    return;
  }

  backendConfig = normalizeBackendConfig(changes.backendConfig.newValue);
  configRevision += 1;
  successfulFingerprints = {};
  void persistSessionState().catch(error => {
    console.error('Cookie 获取器无法清除旧快照指纹：', error);
  });
});

chrome.runtime.onMessage.addListener((request, _sender, sendResponse) => {
  if (request?.action !== 'testBackendConfig') {
    return false;
  }

  void testBackendConfig(request.config).then(sendResponse);
  return true;
});
