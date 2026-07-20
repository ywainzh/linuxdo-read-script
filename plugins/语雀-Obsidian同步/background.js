import { ObsidianClient, normalizeSettings } from './obsidian-client.js';
import {
  addSourceMetadata,
  expectedNotePath,
  extractSourceMetadata,
  findDocumentMatch,
  getNoteBody,
  joinPath,
  noteLocation,
  safeSegment
} from './sync-core.js';

const SETTINGS_KEY = 'yuqueObsidianSettings';
const REQUEST_GAP = 300;
const MAX_ASSET_BYTES = 15 * 1024 * 1024;
const MAX_ASSETS_PER_DOC = 30;
const YUQUE_REQUEST_TIMEOUT = 20000;
const ASSET_REQUEST_TIMEOUT = 10000;
let lastYuqueRequest = 0;
let importRunning = false;

async function getSettings() {
  const stored = await chrome.storage.local.get(SETTINGS_KEY);
  try { return normalizeSettings(stored[SETTINGS_KEY] || {}); }
  catch { return normalizeSettings({}); }
}

async function saveSettings(value) {
  const settings = normalizeSettings(value);
  await chrome.storage.local.set({ [SETTINGS_KEY]: settings });
  return settings;
}

function sleep(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }

async function waitYuqueGap() {
  const wait = REQUEST_GAP - (Date.now() - lastYuqueRequest);
  if (wait > 0) await sleep(wait);
  lastYuqueRequest = Date.now();
}

async function executeYuque(tabId, action, payload = {}) {
  if (!Number.isInteger(tabId)) throw new Error('找不到语雀页面');
  await waitYuqueGap();
  const execution = chrome.scripting.executeScript({
    target: { tabId },
    world: 'MAIN',
    func: yuqueMainBridge,
    args: [action, payload]
  });
  const results = await Promise.race([
    execution,
    new Promise((_, reject) => setTimeout(() => reject(new Error('语雀请求超时，请检查页面登录状态')), YUQUE_REQUEST_TIMEOUT))
  ]);
  const result = results?.[0]?.result;
  if (result?.ok === false) throw new Error(result.message || '语雀请求失败');
  return result?.data === undefined ? result : result.data;
}

async function executeYuqueWithRetry(tabId, action, payload = {}) {
  let lastError;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try { return await executeYuque(tabId, action, payload); }
    catch (error) {
      lastError = error;
      if (!/429/.test(error.message || '') || attempt === 2) break;
      await sleep(500 * (2 ** attempt));
    }
  }
  throw lastError || new Error('语雀请求失败');
}

async function yuqueMainBridge(action, payload) {
  const csrfToken = (() => {
    const cookies = String(document.cookie || '').split(';').map(item => item.trim());
    const item = cookies.find(value => /^(?:yuque_ctoken|ctoken|csrf_token|_csrf_token)=/i.test(value));
    return item ? decodeURIComponent(item.replace(/^[^=]+=/, '')) : '';
  })();
  const headers = { Accept: 'application/json', 'X-Requested-With': 'XMLHttpRequest' };
  if (csrfToken) headers['x-csrf-token'] = csrfToken;

  async function request(path, options = {}) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), options.timeoutMs || 20000);
    try {
      const response = await fetch(path, {
        credentials: 'include',
        ...options,
        signal: controller.signal,
        headers: { ...headers, ...(options.headers || {}) }
      });
      const text = await response.text();
      let data = text;
      try { data = text ? JSON.parse(text) : null; } catch { /* non-JSON response */ }
      if (!response.ok) {
        const message = data?.message || data?.error || `HTTP ${response.status}`;
        throw new Error(`语雀请求失败：${message}`);
      }
      return data?.data === undefined ? data : data.data;
    } catch (error) {
      if (error?.name === 'AbortError') throw new Error('语雀请求超时');
      throw error;
    } finally {
      clearTimeout(timer);
    }
  }

  function jsonOptions(method, body) {
    return { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) };
  }

  try {
    if (action === 'context') {
      const app = window.appData || {};
      return {
        url: location.href,
        app: { me: app.me || {} },
        book: app.book || {},
        doc: app.doc || {},
        segments: location.pathname.split('/').filter(Boolean)
      };
    }
    if (action === 'doc') {
      const query = new URLSearchParams({
        book_id: String(payload.bookId || ''),
        include_contributors: 'true',
        include_like: 'true',
        include_hits: 'true',
        merge_dynamic_data: 'false'
      });
      return request(`/api/docs/${encodeURIComponent(payload.slug)}?${query}`);
    }
    if (action === 'book') {
      const currentBook = window.appData?.book;
      if (currentBook?.id && String(currentBook.id) === String(payload.bookId) && Array.isArray(currentBook.toc)) {
        return { book: currentBook, toc: currentBook.toc };
      }
      const book = await request(`/api/books/${encodeURIComponent(payload.bookId)}`);
      const toc = await request(`/api/books/${encodeURIComponent(payload.bookId)}/toc?include_docs=true`);
      return { book, toc };
    }
    if (action === 'docs') return request(`/api/docs?book_id=${encodeURIComponent(payload.bookId)}`);
    if (action === 'convert') {
      return request('/api/docs/convert', jsonOptions('POST', {
        from: payload.from,
        to: payload.to,
        content: payload.content,
        body_asl: payload.content
      }));
    }
    if (action === 'lakeToMarkdown') {
      const source = String(payload.content || '');
      if (!source.trim()) return '';
      const root = new DOMParser().parseFromString(source, 'text/html').body;
      const inline = node => Array.from(node.childNodes || []).map(render).join('');
      const render = node => {
        if (node.nodeType === Node.TEXT_NODE) return node.nodeValue || '';
        if (node.nodeType !== Node.ELEMENT_NODE) return '';
        const tag = node.tagName.toLowerCase();
        if (tag === 'br') return '\n';
        if (/^h[1-6]$/.test(tag)) return `${'#'.repeat(Number(tag[1]))} ${inline(node).trim()}\n\n`;
        if (tag === 'p') return `${inline(node).trim()}\n\n`;
        if (tag === 'strong' || tag === 'b') return `**${inline(node).trim()}**`;
        if (tag === 'em' || tag === 'i') return `*${inline(node).trim()}*`;
        if (tag === 'code' && node.parentElement?.tagName.toLowerCase() !== 'pre') return `\`${inline(node).replaceAll('`', '\\`').trim()}\``;
        if (tag === 'pre') return `\n\n${'```'}\n${node.textContent || ''}\n${'```'}\n\n`;
        if (tag === 'a') {
          const href = node.getAttribute('href') || '';
          return href ? `[${inline(node).trim() || href}](${href})` : inline(node);
        }
        if (tag === 'img') {
          const src = node.getAttribute('src') || '';
          return src ? `![${node.getAttribute('alt') || ''}](${src})` : '';
        }
        if (tag === 'blockquote') return `${inline(node).trim().split('\n').map(line => `> ${line}`).join('\n')}\n\n`;
        if (tag === 'li') return `${inline(node).trim()}\n`;
        if (tag === 'ul' || tag === 'ol') {
          const ordered = tag === 'ol';
          let index = 1;
          const lines = Array.from(node.children).filter(child => child.tagName.toLowerCase() === 'li')
            .map(item => `${ordered ? `${index++}.` : '-'} ${inline(item).trim()}`);
          return `${lines.join('\n')}\n\n`;
        }
        if (tag === 'hr') return '\n\n---\n\n';
        if (tag === 'table') {
          const rows = Array.from(node.querySelectorAll('tr')).map(row =>
            Array.from(row.children).map(cell => inline(cell).trim().replaceAll('|', '\\|'))
          );
          if (!rows.length) return '';
          return `\n\n| ${rows[0].join(' | ')} |\n| ${rows[0].map(() => '---').join(' | ')} |\n${rows.slice(1).map(row => `| ${row.join(' | ')} |`).join('\n')}\n\n`;
        }
        if (tag === 'card' && node.getAttribute('name') === 'codeblock') {
          const match = (node.getAttribute('value') || '').match(/^data:(?:[^,]*,)?(.+)$/);
          if (match) {
            try { return `\n\n${'```'}\n${JSON.parse(decodeURIComponent(match[1])).code || ''}\n${'```'}\n\n`; }
            catch { return ''; }
          }
        }
        return inline(node);
      };
      return Array.from(root.childNodes).map(render).join('').replace(/\n{3,}/g, '\n\n').trim();
    }
    if (action === 'createDoc') return request('/api/docs', jsonOptions('POST', payload));
    if (action === 'updateDoc') return request(`/api/docs/${encodeURIComponent(payload.id)}`, jsonOptions('PUT', payload.body));
    if (action === 'updateContent') {
      return request(`/api/docs/${encodeURIComponent(payload.id)}/content`, jsonOptions('PUT', {
        body_asl: payload.body_asl ?? payload.body_draft_asl ?? '',
        format: payload.format || 'lake',
        draft_version: payload.draft_version,
        save_type: payload.save_type || 'auto'
      }));
    }
    if (action === 'publishDoc') {
      return request(`/api/docs/${encodeURIComponent(payload.id)}/publish`, jsonOptions('PUT', {
        draft_version: payload.draft_version,
        format: payload.format || 'lake',
        notify: false,
        force: true
      }));
    }
    if (action === 'deleteDoc') return request(`/api/docs/${encodeURIComponent(payload.id)}`, { method: 'DELETE' });
    if (action === 'catalog') return request('/api/catalog_nodes', jsonOptions('PUT', payload));
    if (action === 'catalogRead') return request(`/api/catalog_nodes?book_id=${encodeURIComponent(payload.bookId)}`);
    if (action === 'catalogMove') return request('/api/catalog_nodes/move', jsonOptions('PUT', payload));
    if (action === 'assetDownload') {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), payload.timeoutMs || 10000);
      try {
        const response = await fetch(payload.url, { credentials: 'include', signal: controller.signal });
        if (!response.ok) throw new Error(`附件下载失败：HTTP ${response.status}`);
        const bytes = new Uint8Array(await response.arrayBuffer());
        if (bytes.byteLength > payload.maxBytes) throw new Error('附件超过单文件大小限制');
        let binary = '';
        for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
        return { base64: btoa(binary), contentType: response.headers.get('content-type') || 'application/octet-stream' };
      } catch (error) {
        if (error?.name === 'AbortError') throw new Error('附件下载超时');
        throw error;
      } finally {
        clearTimeout(timer);
      }
    }
    if (action === 'assetUpload') {
      const binary = atob(payload.base64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
      const form = new FormData();
      form.append('file', new Blob([bytes], { type: payload.contentType || 'application/octet-stream' }), payload.name || 'asset');
      const response = await fetch(`/api/upload/attach?type=${encodeURIComponent(payload.type || 'image')}&attachable_type=Doc&attachable_id=${encodeURIComponent(payload.docId)}&ctoken=${encodeURIComponent(csrfToken)}`, {
        method: 'POST', credentials: 'include', headers, body: form
      });
      const text = await response.text();
      let data = text;
      try { data = text ? JSON.parse(text) : null; } catch { /* non-JSON response */ }
      if (!response.ok) throw new Error(data?.message || `附件上传失败：HTTP ${response.status}`);
      return data?.data === undefined ? data : data.data;
    }
    throw new Error(`未知语雀动作：${action}`);
  } catch (error) {
    return { ok: false, message: error?.message || String(error) };
  }
}

function unwrapBridgeError(error) {
  return error instanceof Error ? error : new Error(String(error || '未知错误'));
}

function getBookId(context) {
  return context?.book?.id || context?.doc?.book_id;
}

function getBookName(context) {
  return context?.book?.name || context?.book?.title || '语雀知识库';
}

function getPageSlugs(context) {
  const segments = context?.segments || [];
  return { groupSlug: segments[0] || '', bookSlug: segments[1] || '', docSlug: segments[2] || '' };
}

function convertedContent(value, label) {
  if (typeof value === 'string') return value;
  if (value && typeof value === 'object') {
    for (const key of ['content', 'markdown', 'body', 'body_asl', 'body_draft_asl']) {
      if (typeof value[key] === 'string') return value[key];
    }
  }
  throw new Error(`${label}接口未返回正文内容`);
}

function yuqueDocument(value) {
  let current = value;
  for (let depth = 0; depth < 4; depth += 1) {
    if (!current || typeof current !== 'object') return current;
    if (current.id) return current;
    if (current.doc && typeof current.doc === 'object') current = current.doc;
    else if (current.data && typeof current.data === 'object') current = current.data;
    else return current;
  }
  return current;
}

function arrayFrom(value) {
  if (Array.isArray(value)) return value;
  for (const key of ['data', 'toc', 'docs', 'items']) {
    if (Array.isArray(value?.[key])) return value[key];
  }
  return [];
}

function nodeType(node) {
  return String(node?.type || '').toUpperCase();
}

function nodeId(node) {
  return String(node?.uuid || node?.id || '');
}

function nodeDocId(node) {
  return String(node?.doc_id || (nodeType(node) === 'DOC' ? node?.id || '' : ''));
}

function buildCatalog(nodes) {
  const byUuid = new Map(nodes.map(node => [nodeId(node), node]).filter(([id]) => id));
  const pathFor = node => {
    const path = [];
    const seen = new Set();
    let current = byUuid.get(String(node?.parent_uuid || node?.parent_id || ''));
    while (current && !seen.has(nodeId(current))) {
      seen.add(nodeId(current));
      if (nodeType(current) !== 'DOC') path.unshift(current.title || current.name || '未命名');
      current = byUuid.get(String(current.parent_uuid || current.parent_id || ''));
    }
    return path.filter(Boolean);
  };
  return { nodes, byUuid, pathFor };
}

async function getCurrentContext(tabId) {
  const context = await executeYuque(tabId, 'context');
  if (!getBookId(context)) throw new Error('无法识别当前语雀知识库，请刷新页面后重试');
  return context;
}

async function convertLakeToMarkdown(tabId, source) {
  if (!String(source || '').trim()) return '';
  try {
    const result = await executeYuqueWithRetry(tabId, 'convert', { from: 'lake', to: 'markdown', content: source });
    return convertedContent(result, '语雀转换');
  } catch (error) {
    if (!/未返回正文|HTTP 4|HTTP 5|语雀请求/.test(error.message || '')) throw error;
  }
  return convertedContent(await executeYuqueWithRetry(tabId, 'lakeToMarkdown', { content: source }), '本地转换');
}

async function loadBookIndex(tabId, context) {
  const bookId = getBookId(context);
  const bookData = await executeYuqueWithRetry(tabId, 'book', { bookId });
  const docsData = await executeYuqueWithRetry(tabId, 'docs', { bookId });
  const catalogData = await executeYuqueWithRetry(tabId, 'catalogRead', { bookId });
  const bookToc = arrayFrom(bookData?.toc);
  const catalogNodes = arrayFrom(catalogData);
  const nodes = catalogNodes.length ? catalogNodes : bookToc;
  const catalog = buildCatalog(nodes);
  const remoteDocs = arrayFrom(docsData);
  const documents = remoteDocs.map(doc => {
    const catalogNode = nodes.find(node =>
      nodeType(node) === 'DOC' && (nodeDocId(node) === String(doc.id) || String(node.slug || node.url || '') === String(doc.slug || ''))
    );
    return {
      ...doc,
      id: doc.id || catalogNode?.doc_id,
      title: doc.title || catalogNode?.title,
      slug: doc.slug || catalogNode?.slug || catalogNode?.url,
      path: catalogNode ? catalog.pathFor(catalogNode) : [],
      catalog_uuid: catalogNode ? nodeId(catalogNode) : '',
      parent_uuid: catalogNode?.parent_uuid || ''
    };
  });
  for (const node of nodes.filter(item => nodeType(item) === 'DOC')) {
    if (documents.some(doc => String(doc.id) === nodeDocId(node))) continue;
    documents.push({
      id: node.doc_id || node.id,
      title: node.title,
      slug: node.slug || node.url,
      path: catalog.pathFor(node),
      catalog_uuid: nodeId(node),
      parent_uuid: node.parent_uuid || ''
    });
  }
  return { ...catalog, documents, book: bookData?.book || bookData };
}

async function refreshCatalog(tabId, bookId, state) {
  const nodes = arrayFrom(await executeYuqueWithRetry(tabId, 'catalogRead', { bookId }));
  const next = buildCatalog(nodes);
  state.nodes = next.nodes;
  state.byUuid = next.byUuid;
  state.pathFor = next.pathFor;
  return state;
}

async function loadCurrentDoc(tabId, context) {
  const { docSlug } = getPageSlugs(context);
  const doc = yuqueDocument(await executeYuqueWithRetry(tabId, 'doc', { slug: docSlug, bookId: getBookId(context) }));
  if (!doc?.id) throw new Error('语雀文档接口没有返回文档内容，请刷新页面后重试');
  const source = doc.content || doc.body || doc.body_asl || doc.body_draft_asl || '';
  const markdown = doc.format === 'markdown' ? source : await convertLakeToMarkdown(tabId, source);
  const index = await loadBookIndex(tabId, context);
  const indexed = index.documents.find(item => String(item.id) === String(doc.id) || String(item.slug) === String(doc.slug));
  return {
    ...doc,
    markdown,
    book_id: getBookId(context),
    path: indexed?.path || [],
    source_url: context.url
  };
}

async function listMarkdown(client, directory, output = []) {
  let entries;
  try { entries = await client.list(directory); }
  catch (error) {
    if (/HTTP 404/.test(error.message || '')) return output;
    throw error;
  }
  for (const entry of entries) {
    if (entry.startsWith('.yuque-sync/') || entry === '.yuque-sync/' || entry.startsWith('_assets/')) continue;
    const relative = joinPath(directory, entry.replace(/\/$/, ''));
    if (entry.endsWith('/')) await listMarkdown(client, relative, output);
    else if (/\.md$/i.test(entry)) {
      let content;
      try { content = (await client.read(relative, true)).content || ''; }
      catch { content = await client.read(relative); }
      output.push({ path: relative, content, source: extractSourceMetadata(content) });
    }
  }
  return output.sort((left, right) => left.path.localeCompare(right.path, 'zh-CN'));
}

function markdownAssets(markdown, includeLinks = false) {
  const assets = [];
  const pattern = /(!?)\[([^\]]*)\]\(<?([^)>\s]+)>?(?:\s+"[^"]*")?\)/g;
  let match;
  while ((match = pattern.exec(markdown))) {
    const image = match[1] === '!';
    if (image || includeLinks) assets.push({ image, label: match[2], url: match[3] });
  }
  return assets.filter((asset, index, list) => list.findIndex(item => item.url === asset.url) === index);
}

function fileNameFromUrl(url, fallback = 'asset') {
  try {
    const name = decodeURIComponent(new URL(url).pathname.split('/').pop() || '');
    return safeSegment(name || fallback, fallback);
  } catch {
    const name = String(url || '').split('/').pop() || fallback;
    try { return safeSegment(decodeURIComponent(name), fallback); }
    catch { return safeSegment(name, fallback); }
  }
}

async function materializeRemoteAssets(tabId, client, markdown, notePath, bookRoot, docId) {
  let result = markdown;
  const warnings = [];
  let count = 0;
  for (const asset of markdownAssets(markdown).filter(item => /^https?:\/\//i.test(item.url))) {
    if (count >= MAX_ASSETS_PER_DOC) {
      warnings.push(`超过 ${MAX_ASSETS_PER_DOC} 个图片，其余保留远程地址`);
      break;
    }
    try {
      const downloaded = await executeYuqueWithRetry(tabId, 'assetDownload', {
        url: asset.url, maxBytes: MAX_ASSET_BYTES, timeoutMs: ASSET_REQUEST_TIMEOUT
      });
      const assetPath = joinPath(bookRoot, '_assets', String(docId), fileNameFromUrl(asset.url, `asset-${count + 1}`));
      const bytes = Uint8Array.from(atob(downloaded.base64), char => char.charCodeAt(0));
      await client.writeBinary(assetPath, bytes, downloaded.contentType);
      const noteDirectory = notePath.split('/').slice(0, -1);
      const assetSegments = assetPath.split('/').slice(0, -1);
      let common = 0;
      while (common < noteDirectory.length && common < assetSegments.length && noteDirectory[common] === assetSegments[common]) common += 1;
      const relative = [...noteDirectory.slice(common).map(() => '..'), ...assetPath.split('/').slice(common)].join('/');
      result = result.replaceAll(asset.url, relative);
      count += 1;
    } catch (error) {
      warnings.push(`${fileNameFromUrl(asset.url)} 下载失败：${error.message}`);
    }
  }
  return { markdown: result, warnings };
}

function resolveLocalAssetPath(notePath, url) {
  let decoded = String(url || '');
  try { decoded = decodeURIComponent(decoded); } catch { /* keep original */ }
  return joinPath(notePath.split('/').slice(0, -1).join('/'), decoded);
}

async function uploadLocalAssets(tabId, client, markdown, notePath, docId) {
  let result = markdown;
  const candidates = markdownAssets(markdown, true).filter(asset => {
    if (/^(?:https?:|data:|#|mailto:|obsidian:)/i.test(asset.url)) return false;
    return asset.image || !/\.md(?:#.*)?$/i.test(asset.url);
  });
  for (const asset of candidates.slice(0, MAX_ASSETS_PER_DOC)) {
    const localPath = resolveLocalAssetPath(notePath, asset.url);
    let bytes;
    try { bytes = await client.readBinary(localPath); }
    catch (error) { throw new Error(`无法读取本地附件 ${asset.url}：${error.message}`); }
    if (bytes.byteLength > MAX_ASSET_BYTES) throw new Error(`本地附件超过 15MB：${asset.url}`);
    let binary = '';
    for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
    const uploaded = await executeYuqueWithRetry(tabId, 'assetUpload', {
      docId,
      name: fileNameFromUrl(localPath, 'asset'),
      type: asset.image ? 'image' : 'file',
      contentType: 'application/octet-stream',
      base64: btoa(binary)
    });
    const remoteUrl = uploaded?.url || uploaded?.src || uploaded?.file || uploaded?.data?.url;
    if (!remoteUrl) throw new Error(`语雀没有返回附件地址：${asset.url}`);
    result = result.replaceAll(asset.url, remoteUrl);
  }
  return result;
}

async function writeNote(client, tabId, doc, bookName, rootFolder) {
  const path = expectedNotePath(bookName, doc, rootFolder);
  const bookRoot = joinPath(rootFolder, safeSegment(bookName, '语雀'));
  const downloaded = await materializeRemoteAssets(tabId, client, doc.markdown || '', path, bookRoot, doc.id);
  const content = addSourceMetadata(downloaded.markdown, {
    book_id: doc.book_id,
    doc_id: doc.id,
    slug: doc.slug,
    source_url: doc.source_url,
    original_title: doc.title,
    path: doc.path
  });
  await client.write(path, content);
  return { path, warnings: downloaded.warnings };
}

function folderNode(state, title, parentUuid) {
  return state.nodes.find(node =>
    nodeType(node) === 'TITLE' &&
    String(node.title || node.name || '') === String(title) &&
    String(node.parent_uuid || '') === String(parentUuid || '')
  );
}

async function ensureCatalogPath(tabId, bookId, state, path) {
  let parentUuid = '';
  for (let index = 0; index < path.length; index += 1) {
    const title = path[index];
    let node = folderNode(state, title, parentUuid);
    if (!node) {
      await executeYuqueWithRetry(tabId, 'catalog', {
        book_id: bookId,
        action: 'insert',
        type: 'TITLE',
        title,
        target_uuid: parentUuid || null
      });
      await refreshCatalog(tabId, bookId, state);
      node = folderNode(state, title, parentUuid);
      if (!node) throw new Error(`语雀目录创建失败：${path.slice(0, index + 1).join('/')}`);
    }
    parentUuid = nodeId(node);
  }
  return parentUuid;
}

function makeSlug(title) {
  const base = safeSegment(title, 'note').normalize('NFKD')
    .replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-+|-+$/g, '').toLowerCase();
  return `${base || 'note'}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

function fullDocContent(doc) {
  return String(doc?.content || doc?.body || doc?.body_asl || doc?.body_draft_asl || '');
}

async function findFullDocument(tabId, bookId, document) {
  const identifier = document?.slug || document?.id;
  if (!identifier) return null;
  return yuqueDocument(await executeYuqueWithRetry(tabId, 'doc', { slug: identifier, bookId }));
}

async function convertMarkdownToLake(tabId, markdown) {
  if (!String(markdown || '').trim()) return '';
  return convertedContent(await executeYuqueWithRetry(tabId, 'convert', {
    from: 'markdown',
    to: 'lake',
    content: markdown
  }), '语雀转换');
}

async function ensureDocumentCatalogNode(tabId, bookId, state, target, title, parentUuid) {
  await refreshCatalog(tabId, bookId, state);
  let node = state.nodes.find(item => nodeType(item) === 'DOC' && nodeDocId(item) === String(target.id));
  const correct = node && String(node.parent_uuid || '') === String(parentUuid || '') && String(node.title || '') === String(title);
  if (!correct) {
    const payload = {
      book_id: bookId,
      action: parentUuid ? 'prependChild' : 'insert',
      target_uuid: parentUuid || null,
      uuid: node ? nodeId(node) : undefined,
      doc_id: target.id,
      type: 'DOC',
      title,
      url: target.slug || ''
    };
    await executeYuqueWithRetry(tabId, 'catalog', payload);
    await refreshCatalog(tabId, bookId, state);
    node = state.nodes.find(item => nodeType(item) === 'DOC' && nodeDocId(item) === String(target.id));
  }
  if (!node) throw new Error('语雀正文已写入，但文档没有加入当前知识库目录');
  if (String(node.parent_uuid || '') !== String(parentUuid || '')) throw new Error('语雀文档没有移动到预期目录');
  if (String(node.title || '') !== String(title)) throw new Error('语雀目录中的文档标题没有更新成功');
  return node;
}

async function verifyImportedDocument(tabId, bookId, state, target, title, parentUuid, localBody) {
  const verified = await findFullDocument(tabId, bookId, target);
  if (!verified?.id) throw new Error('语雀无法重新读取已导入文档');
  if (localBody.trim() && !fullDocContent(verified).trim()) throw new Error('语雀文档已创建，但正文没有写入成功');
  if (String(verified.title || '') !== String(title)) throw new Error('语雀文档标题没有更新成功');
  await ensureDocumentCatalogNode(tabId, bookId, state, verified, title, parentUuid);
  return verified;
}

async function importNote(tabId, client, context, state, note, bookRoot) {
  const bookId = getBookId(context);
  const match = findDocumentMatch(state.documents, note, bookId, bookRoot);
  if (match.ambiguous) throw new Error(`同一目录存在多个同名语雀文档：${match.location.path.join('/')}/${match.location.title}`);
  const parentUuid = await ensureCatalogPath(tabId, bookId, state, match.location.path);
  const localBody = getNoteBody(note.content || '');
  const initialLake = await convertMarkdownToLake(tabId, localBody);
  let target = match.document ? await findFullDocument(tabId, bookId, match.document) : null;
  let created = false;
  try {
    if (!target?.id) {
      const slug = makeSlug(match.location.title);
      target = yuqueDocument(await executeYuqueWithRetry(tabId, 'createDoc', {
        book_id: bookId,
        slug,
        title: match.location.title,
        body_asl: initialLake,
        body_draft_asl: initialLake,
        format: 'lake',
        type: 'Doc',
        status: 0,
        insert_to_catalog: true,
        action: 'prependChild',
        target_uuid: parentUuid
      }));
      if (!target?.id) target = await findFullDocument(tabId, bookId, { slug });
      if (!target?.id) throw new Error('语雀创建接口未返回文档 ID，且无法按 slug 找到新文档');
      created = true;
    }
    target = await findFullDocument(tabId, bookId, target);
    const bodyWithAssets = await uploadLocalAssets(tabId, client, localBody, note.path, target.id);
    const lake = bodyWithAssets === localBody ? initialLake : await convertMarkdownToLake(tabId, bodyWithAssets);
    if (String(target.title || '') !== String(match.location.title)) {
      await executeYuqueWithRetry(tabId, 'updateDoc', { id: target.id, body: { title: match.location.title } });
    }
    const updated = await executeYuqueWithRetry(tabId, 'updateContent', {
      id: target.id,
      body_asl: lake,
      format: 'lake',
      draft_version: target.draft_version,
      save_type: 'auto'
    });
    await executeYuqueWithRetry(tabId, 'publishDoc', {
      id: target.id,
      draft_version: updated?.draft_version || target.draft_version,
      format: 'lake'
    });
    const verified = await verifyImportedDocument(tabId, bookId, state, target, match.location.title, parentUuid, localBody);
    const catalogNode = state.nodes.find(item => nodeType(item) === 'DOC' && nodeDocId(item) === String(verified.id));
    const nextDoc = {
      ...verified,
      path: match.location.path,
      catalog_uuid: catalogNode ? nodeId(catalogNode) : '',
      parent_uuid: parentUuid
    };
    const existingIndex = state.documents.findIndex(item => String(item.id) === String(nextDoc.id));
    if (existingIndex >= 0) state.documents[existingIndex] = nextDoc;
    else state.documents.push(nextDoc);
    return { docId: verified.id, title: verified.title, created, matchedBy: match.matchedBy };
  } catch (error) {
    if (created && target?.id) {
      try { await executeYuqueWithRetry(tabId, 'deleteDoc', { id: target.id }); }
      catch { throw new Error(`${error.message}；清理未完成文档失败，文档 ID：${target.id}`); }
    }
    throw error;
  }
}

function isFatalImportError(error) {
  return /(?:HTTP\s*(?:401|403)|登录|权限|未授权|forbidden|csrf|ctoken)/i.test(error?.message || '');
}

async function prepareTransfer(tabId) {
  const settings = await getSettings();
  const client = new ObsidianClient(settings);
  await client.testConnection();
  const context = await getCurrentContext(tabId);
  const bookName = getBookName(context);
  const bookRoot = joinPath(settings.rootFolder, safeSegment(bookName, '语雀'));
  const state = await loadBookIndex(tabId, context);
  return { settings, client, context, bookName, bookRoot, state };
}

async function prepareLocalBook(tabId) {
  const settings = await getSettings();
  const client = new ObsidianClient(settings);
  await client.testConnection();
  const context = await getCurrentContext(tabId);
  const bookName = getBookName(context);
  const bookRoot = joinPath(settings.rootFolder, safeSegment(bookName, '语雀'));
  return { settings, client, context, bookName, bookRoot };
}

async function readNote(client, notePath, bookRoot) {
  const normalizedPath = joinPath(notePath);
  if (!normalizedPath.startsWith(`${bookRoot}/`)) throw new Error('只能导入当前同名 Obsidian 知识库中的 Markdown');
  let content;
  try { content = (await client.read(normalizedPath, true)).content || ''; }
  catch { content = await client.read(normalizedPath); }
  return { path: normalizedPath, content, source: extractSourceMetadata(content) };
}

async function runExport(tabId) {
  const settings = await getSettings();
  const client = new ObsidianClient(settings);
  await client.testConnection();
  const context = await getCurrentContext(tabId);
  const doc = await loadCurrentDoc(tabId, context);
  const written = await writeNote(client, tabId, doc, getBookName(context), settings.rootFolder);
  return { completed: true, ...written };
}

async function listBookNotes(tabId) {
  const transfer = await prepareLocalBook(tabId);
  const notes = await listMarkdown(transfer.client, transfer.bookRoot);
  return {
    bookName: transfer.bookName,
    bookRoot: transfer.bookRoot,
    notes: notes.map(note => ({ path: note.path, title: noteLocation(note.path, transfer.bookRoot, note.source).title }))
  };
}

async function runSingleImport(tabId, notePath) {
  if (importRunning) throw new Error('已有导入任务正在运行');
  importRunning = true;
  try {
    const transfer = await prepareTransfer(tabId);
    const note = await readNote(transfer.client, notePath, transfer.bookRoot);
    const result = await importNote(tabId, transfer.client, transfer.context, transfer.state, note, transfer.bookRoot);
    return { completed: true, ...result };
  } finally {
    importRunning = false;
  }
}

async function previewBookImport(tabId) {
  const transfer = await prepareTransfer(tabId);
  const notes = await listMarkdown(transfer.client, transfer.bookRoot);
  const items = notes.map(note => {
    const match = findDocumentMatch(transfer.state.documents, note, getBookId(transfer.context), transfer.bookRoot);
    return {
      path: note.path,
      title: match.location.title,
      action: match.ambiguous ? 'ambiguous' : match.document ? 'overwrite' : 'create'
    };
  });
  return {
    bookName: transfer.bookName,
    bookRoot: transfer.bookRoot,
    total: items.length,
    create: items.filter(item => item.action === 'create').length,
    overwrite: items.filter(item => item.action === 'overwrite').length,
    ambiguous: items.filter(item => item.action === 'ambiguous').length,
    items
  };
}

async function runBookImport(tabId) {
  if (importRunning) throw new Error('已有导入任务正在运行');
  importRunning = true;
  try {
    const transfer = await prepareTransfer(tabId);
    const notes = await listMarkdown(transfer.client, transfer.bookRoot);
    const results = [];
    for (let index = 0; index < notes.length; index += 1) {
      const note = notes[index];
      try {
        const result = await importNote(tabId, transfer.client, transfer.context, transfer.state, note, transfer.bookRoot);
        results.push({ path: note.path, ok: true, title: result.title, created: result.created });
      } catch (error) {
        results.push({ path: note.path, ok: false, error: error.message });
        if (isFatalImportError(error)) {
          await chrome.tabs.sendMessage(tabId, { type: 'bookImportProgress', current: index + 1, total: notes.length, path: note.path, failed: true }).catch(() => {});
          throw new Error(`${error.message}；整库导入已停止`);
        }
      }
      await chrome.tabs.sendMessage(tabId, {
        type: 'bookImportProgress',
        current: index + 1,
        total: notes.length,
        path: note.path,
        failed: !results.at(-1).ok
      }).catch(() => {});
    }
    return {
      completed: true,
      total: notes.length,
      succeeded: results.filter(item => item.ok).length,
      failed: results.filter(item => !item.ok).length,
      results
    };
  } finally {
    importRunning = false;
  }
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  const tabId = sender.tab?.id;
  (async () => {
    switch (message?.type) {
      case 'getSettings': return getSettings();
      case 'saveSettings': return saveSettings(message.settings);
      case 'testObsidian': return new ObsidianClient(await getSettings()).testConnection();
      case 'getPageContext': return getCurrentContext(tabId);
      case 'listBookNotes': return listBookNotes(tabId);
      case 'exportCurrent': return runExport(tabId);
      case 'importSingle': return runSingleImport(tabId, message.path);
      case 'previewBookImport': return previewBookImport(tabId);
      case 'importBook': return runBookImport(tabId);
      default: throw new Error('未知扩展消息');
    }
  })().then(sendResponse).catch(error => sendResponse({ error: unwrapBridgeError(error).message }));
  return true;
});
