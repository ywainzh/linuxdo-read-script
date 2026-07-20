const DEFAULT_SETTINGS = Object.freeze({
  apiUrl: 'http://127.0.0.1:27123',
  apiKey: '',
  rootFolder: ''
});

export function normalizeSettings(value = {}) {
  const settings = { ...DEFAULT_SETTINGS, ...(value && typeof value === 'object' ? value : {}) };
  settings.apiUrl = validateApiUrl(settings.apiUrl);
  settings.apiKey = String(settings.apiKey || '').trim();
  settings.rootFolder = normalizePath(settings.rootFolder);
  return settings;
}

export function validateApiUrl(value) {
  let url;
  try {
    url = new URL(String(value || '').trim());
  } catch {
    throw new Error('Obsidian API 地址格式不正确');
  }
  if (!['http:', 'https:'].includes(url.protocol)) {
    throw new Error('Obsidian API 只支持 HTTP 或 HTTPS');
  }
  if (!['127.0.0.1', 'localhost'].includes(url.hostname)) {
    throw new Error('为保护 API Key，地址只能使用 localhost 或 127.0.0.1');
  }
  if (url.username || url.password || url.search || url.hash) {
    throw new Error('Obsidian API 地址不能包含账号、查询参数或锚点');
  }
  return url.origin;
}

export function normalizePath(value) {
  const stack = [];
  for (const part of String(value || '').replace(/\\/g, '/').split('/')) {
    if (!part || part === '.') continue;
    if (part === '..') { stack.pop(); continue; }
    stack.push(part);
  }
  return stack.join('/');
}

function encodePath(path) {
  const normalized = normalizePath(path);
  return normalized ? normalized.split('/').map(encodeURIComponent).join('/') : '';
}

export class ObsidianClient {
  constructor(settings, fetchImpl = (...args) => globalThis.fetch(...args)) {
    this.settings = normalizeSettings(settings);
    this.fetch = (...args) => fetchImpl(...args);
  }

  async request(path, options = {}) {
    if (!this.settings.apiKey) throw new Error('尚未配置 Obsidian API Key');
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), options.timeoutMs || 20000);
    const headers = new Headers(options.headers || {});
    headers.set('Authorization', `Bearer ${this.settings.apiKey}`);
    try {
      const response = await this.fetch(`${this.settings.apiUrl}${path}`, {
        ...options,
        headers,
        signal: controller.signal
      });
      if (!response.ok) {
        throw new Error(`Obsidian API 返回 HTTP ${response.status}`);
      }
      return response;
    } catch (error) {
      if (error?.name === 'AbortError') throw new Error('Obsidian API 请求超时');
      throw error;
    } finally {
      clearTimeout(timeout);
    }
  }

  async testConnection() {
    const response = await this.request('/');
    const data = await response.json().catch(() => ({}));
    if (data.authenticated === false) throw new Error('Obsidian API Key 无效');
    return data;
  }

  async list(directory = '') {
    const suffix = encodePath(directory);
    const response = await this.request(`/vault/${suffix}${suffix ? '/' : ''}`, {
      headers: { Accept: 'application/json' }
    });
    const data = await response.json();
    return Array.isArray(data.files) ? data.files : [];
  }

  async read(path, metadata = false) {
    const encoded = encodePath(path);
    const response = await this.request(`/vault/${encoded}`, {
      headers: {
        Accept: metadata ? 'application/vnd.olrapi.note+json' : 'text/markdown'
      }
    });
    return metadata ? response.json() : response.text();
  }

  async readBinary(path) {
    const response = await this.request(`/vault/${encodePath(path)}`, {
      headers: { Accept: 'application/octet-stream' }
    });
    return new Uint8Array(await response.arrayBuffer());
  }

  async write(path, content, contentType = 'text/markdown') {
    await this.request(`/vault/${encodePath(path)}`, {
      method: 'PUT',
      headers: { 'Content-Type': `${contentType}; charset=utf-8` },
      body: content
    });
  }

  async writeBinary(path, bytes, contentType = 'application/octet-stream') {
    await this.request(`/vault/${encodePath(path)}`, {
      method: 'PUT',
      headers: { 'Content-Type': contentType },
      body: bytes
    });
  }

  async move(source, destination) {
    await this.request(`/vault/${encodePath(source)}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Vault-Move': encodePath(destination)
      },
      body: JSON.stringify({ destination: normalizePath(destination) })
    });
  }

  async delete(path) {
    await this.request(`/vault/${encodePath(path)}`, { method: 'DELETE' });
  }
}

export { DEFAULT_SETTINGS };
