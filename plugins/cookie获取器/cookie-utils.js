export const DEFAULT_DATA_FORMAT = '{"domain":"{domain}","storeId":"{storeId}","partitionKey":{partitionKey},"event":{event},"cookies":{cookies}}';

export function createDefaultConfig() {
  return {
    enabled: false,
    url: '',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    dataFormat: DEFAULT_DATA_FORMAT,
    urlFilters: [],
    urlFilterUseRegex: false,
    cookieKeyFilters: [],
    cookieFilterExcludeMode: false
  };
}

export function normalizeBackendConfig(config) {
  const normalized = { ...createDefaultConfig(), ...(config || {}) };
  normalized.headers = config?.headers ?? { 'Content-Type': 'application/json' };
  normalized.urlFilters = Array.isArray(config?.urlFilters) ? [...config.urlFilters] : [];
  normalized.cookieKeyFilters = Array.isArray(config?.cookieKeyFilters)
    ? [...config.cookieKeyFilters]
    : [];
  return normalized;
}

export function normalizeCookieDomain(domain = '') {
  return String(domain).replace(/^\./, '').toLowerCase();
}

export function normalizePartitionKey(partitionKey) {
  if (!partitionKey?.topLevelSite) {
    return null;
  }

  return {
    topLevelSite: partitionKey.topLevelSite,
    ...(typeof partitionKey.hasCrossSiteAncestor === 'boolean'
      ? { hasCrossSiteAncestor: partitionKey.hasCrossSiteAncestor }
      : {})
  };
}

export function partitionKeyId(partitionKey) {
  const normalized = normalizePartitionKey(partitionKey);
  return normalized ? JSON.stringify(normalized) : 'unpartitioned';
}

export function cookieIdentity(cookie) {
  return [
    cookie.storeId || '',
    String(cookie.domain || ''),
    cookie.path || '/',
    cookie.name || '',
    partitionKeyId(cookie.partitionKey)
  ].join('\u0000');
}

export function mergeCookieLists(...lists) {
  const seen = new Set();
  const merged = [];

  for (const list of lists) {
    for (const cookie of list || []) {
      const identity = cookieIdentity(cookie);
      if (!seen.has(identity)) {
        seen.add(identity);
        merged.push(cookie);
      }
    }
  }

  return merged;
}

export function splitCookiesByPartition(cookies) {
  return (cookies || []).reduce(
    (groups, cookie) => {
      const group = normalizePartitionKey(cookie.partitionKey)
        ? groups.partitioned
        : groups.unpartitioned;
      group.push(cookie);
      return groups;
    },
    { unpartitioned: [], partitioned: [] }
  );
}

export function serializeCookieHeader(cookies) {
  return (cookies || []).map(cookie => `${cookie.name}=${cookie.value}`).join('; ');
}

export function sortCookiesByName(cookies) {
  return [...(cookies || [])].sort((left, right) =>
    String(left.name || '').localeCompare(String(right.name || ''))
  );
}

export function matchesDomain(domain, filters = [], useRegex = false) {
  if (!filters.length) {
    return true;
  }

  const normalizedDomain = normalizeCookieDomain(domain);
  return filters.some(pattern => {
    if (useRegex) {
      return new RegExp(pattern).test(normalizedDomain);
    }
    return normalizedDomain.includes(String(pattern).toLowerCase());
  });
}

export function filterCookies(cookies, keyFilters = [], excludeMode = false) {
  if (!keyFilters.length) {
    return [...(cookies || [])];
  }

  const names = new Set(keyFilters);
  return (cookies || []).filter(cookie =>
    excludeMode ? !names.has(cookie.name) : names.has(cookie.name)
  );
}

export function shouldProcessCookieName(name, keyFilters = [], excludeMode = false) {
  if (!keyFilters.length) {
    return true;
  }
  return excludeMode ? !keyFilters.includes(name) : keyFilters.includes(name);
}

export function snapshotKey(domain, storeId, partitionKey) {
  return [storeId || '', normalizeCookieDomain(domain), partitionKeyId(partitionKey)].join('\u0000');
}

export function snapshotFingerprint(cookies) {
  return JSON.stringify((cookies || []).map(cookie => ({
    identity: cookieIdentity(cookie),
    value: cookie.value,
    expirationDate: cookie.expirationDate ?? null,
    hostOnly: Boolean(cookie.hostOnly),
    httpOnly: Boolean(cookie.httpOnly),
    secure: Boolean(cookie.secure),
    session: Boolean(cookie.session),
    sameSite: cookie.sameSite || 'unspecified'
  })));
}

export async function sha256(value) {
  const bytes = new TextEncoder().encode(String(value));
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)]
    .map(byte => byte.toString(16).padStart(2, '0'))
    .join('');
}

export function createExampleContext() {
  const cookie = {
    name: 'test_cookie',
    value: 'test_value',
    domain: 'example.com',
    path: '/',
    storeId: '0',
    secure: true,
    httpOnly: false,
    sameSite: 'lax',
    session: true
  };
  return {
    domain: 'example.com',
    storeId: '0',
    partitionKey: null,
    event: { removed: false, cause: 'explicit', cookie },
    cookies: [cookie]
  };
}

export function renderDataFormat(format, context) {
  const replacements = {
    domain: normalizeCookieDomain(context.domain),
    storeId: context.storeId || '',
    partitionKey: JSON.stringify(normalizePartitionKey(context.partitionKey)),
    event: JSON.stringify(context.event ?? null),
    cookies: JSON.stringify(context.cookies || [])
  };

  return String(format).replace(
    /\{(domain|storeId|partitionKey|event|cookies)\}/g,
    (_placeholder, name) => replacements[name]
  );
}

export function validateDataFormat(format, context = createExampleContext()) {
  if (!String(format || '').trim()) {
    throw new Error('数据格式不能为空');
  }

  const rendered = renderDataFormat(format, context);
  JSON.parse(rendered);
  return rendered;
}

export function validateRegexFilters(filters = []) {
  for (const pattern of filters) {
    try {
      new RegExp(pattern);
    } catch (error) {
      throw new Error(`无效的域名正则表达式“${pattern}”：${error.message}`);
    }
  }
}

export function validateHeaders(headers) {
  if (!headers || typeof headers !== 'object' || Array.isArray(headers)) {
    throw new Error('请求头必须是 JSON 对象');
  }
  return headers;
}

export function validateBackendUrl(value) {
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new Error('后台接口地址格式无效');
  }

  const isLocalHttp = url.protocol === 'http:' &&
    ['localhost', '127.0.0.1'].includes(url.hostname);
  if (url.protocol !== 'https:' && !isLocalHttp) {
    throw new Error('后台接口必须使用 HTTPS；本地开发仅允许 localhost 或 127.0.0.1 使用 HTTP');
  }

  return url.toString();
}

export function validateBackendConfig(config, { requireUrl = false } = {}) {
  const normalized = normalizeBackendConfig(config);
  if (!['POST', 'PUT'].includes(normalized.method)) {
    throw new Error('请求方法仅支持 POST 或 PUT');
  }
  validateHeaders(normalized.headers);
  validateDataFormat(normalized.dataFormat);
  if (normalized.urlFilterUseRegex) {
    validateRegexFilters(normalized.urlFilters);
  }
  if (normalized.url) {
    normalized.url = validateBackendUrl(normalized.url);
  } else if (requireUrl || normalized.enabled) {
    throw new Error('请输入后台接口地址');
  }
  return normalized;
}
