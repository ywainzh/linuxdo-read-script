const INVALID_SEGMENT = /[\\/:*?"<>|\u0000-\u001f]/g;
const SOURCE_BLOCK_KEYS = new Set(['yuque_source', 'yuque_sync']);
const SOURCE_LINK_KEYS = new Set(['语雀链接', 'yuque_url']);

export function safeSegment(value, fallback = '未命名') {
  const cleaned = String(value || '').replace(INVALID_SEGMENT, ' ').replace(/[. ]+$/g, '').trim();
  return cleaned || fallback;
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

export function joinPath(...parts) {
  return normalizePath(parts.filter(Boolean).join('/'));
}

function splitFrontmatter(markdown) {
  const source = String(markdown || '').replace(/^\uFEFF/, '');
  const lines = source.split(/\r?\n/);
  if (lines[0]?.trim() !== '---') return { frontmatter: [], body: source };
  const end = lines.indexOf('---', 1);
  if (end < 0) return { frontmatter: [], body: source };
  return {
    frontmatter: lines.slice(1, end),
    body: lines.slice(end + 1).join('\n').replace(/^\n+/, '')
  };
}

function withoutSourceBlocks(lines) {
  const output = [];
  let skipping = false;
  for (const line of lines) {
    const item = line.match(/^([^\s][^:]*)\s*:\s*(.*)$/);
    const key = item?.[1]?.trim();
    if (key && SOURCE_BLOCK_KEYS.has(key) && !item[2].trim()) {
      skipping = true;
      continue;
    }
    if (skipping && /^\S/.test(line)) skipping = false;
    if (!skipping && key && SOURCE_LINK_KEYS.has(key)) continue;
    if (!skipping) output.push(line);
  }
  return output;
}

function parseYamlScalar(value) {
  const trimmed = String(value || '').trim();
  if (!trimmed || trimmed === 'null') return '';
  if (trimmed.startsWith('"') && trimmed.endsWith('"')) {
    try { return JSON.parse(trimmed); } catch { return trimmed.slice(1, -1); }
  }
  if (trimmed.startsWith("'") && trimmed.endsWith("'")) return trimmed.slice(1, -1).replace(/''/g, "'");
  return trimmed;
}

function yamlScalar(value) {
  return JSON.stringify(String(value ?? ''));
}

function extractBlock(lines, name) {
  const result = {};
  let inBlock = false;
  for (const line of lines) {
    if (new RegExp(`^${name}\\s*:\\s*$`).test(line)) {
      inBlock = true;
      continue;
    }
    if (inBlock && /^\S/.test(line)) break;
    if (!inBlock) continue;
    const item = line.match(/^\s{2}([A-Za-z0-9_]+):\s*(.*)$/);
    if (item) result[item[1]] = parseYamlScalar(item[2]);
  }
  return result;
}

function extractScalar(lines, names) {
  for (const line of lines) {
    const item = line.match(/^([^\s][^:]*)\s*:\s*(.*)$/);
    if (item && names.has(item[1].trim())) return parseYamlScalar(item[2]);
  }
  return '';
}

function metadataFromUrl(sourceUrl) {
  if (!sourceUrl) return {};
  try {
    const url = new URL(sourceUrl);
    const segments = url.pathname.split('/').filter(Boolean);
    return { source_url: url.href, slug: segments.at(-1) || '' };
  } catch {
    return { source_url: sourceUrl };
  }
}

export function extractSourceMetadata(markdown) {
  const { frontmatter } = splitFrontmatter(markdown);
  const current = extractBlock(frontmatter, 'yuque_source');
  if (Object.keys(current).length) return current;
  const legacy = extractBlock(frontmatter, 'yuque_sync');
  if (Object.keys(legacy).length) return legacy;
  return metadataFromUrl(extractScalar(frontmatter, SOURCE_LINK_KEYS));
}

export function stripSourceMetadata(markdown) {
  const source = String(markdown || '').replace(/^\uFEFF/, '');
  const parsed = splitFrontmatter(source);
  if (!parsed.frontmatter.length && parsed.body === source) return source;
  const frontmatter = withoutSourceBlocks(parsed.frontmatter);
  return frontmatter.some(line => line.trim())
    ? ['---', ...frontmatter, '---', '', parsed.body].join('\n')
    : parsed.body;
}

export function addSourceMetadata(markdown, metadata) {
  const stripped = stripSourceMetadata(markdown).replace(/^\n+/, '');
  const parsed = splitFrontmatter(stripped);
  const block = [`语雀链接: ${yamlScalar(metadata.source_url)}`];
  if (parsed.frontmatter.length || stripped.startsWith('---\n')) {
    return ['---', ...parsed.frontmatter, ...block, '---', '', parsed.body].join('\n');
  }
  return ['---', ...block, '---', '', stripped].join('\n');
}

export function getNoteBody(markdown) {
  return stripSourceMetadata(markdown).trim();
}

export function expectedNotePath(bookName, doc, rootFolder = '') {
  const parts = [rootFolder, safeSegment(bookName, '语雀')];
  if (Array.isArray(doc.path)) parts.push(...doc.path.map(item => safeSegment(item)));
  parts.push(`${safeSegment(doc.title)}.md`);
  return joinPath(...parts);
}

export function noteLocation(notePath, bookRoot, metadata = {}) {
  const normalizedPath = normalizePath(notePath);
  const normalizedRoot = normalizePath(bookRoot);
  const relative = normalizedPath.startsWith(`${normalizedRoot}/`)
    ? normalizedPath.slice(normalizedRoot.length + 1)
    : normalizedPath;
  const segments = relative.split('/').filter(Boolean);
  const fileName = segments.pop() || '未命名.md';
  return {
    path: segments,
    title: safeSegment(metadata.original_title || fileName.replace(/\.md$/i, ''), '未命名')
  };
}

export function findDocumentMatch(documents, note, bookId, bookRoot) {
  const metadata = note.source || extractSourceMetadata(note.content || '');
  const location = noteLocation(note.path, bookRoot, metadata);
  const currentBookId = String(bookId || '');
  if (metadata.doc_id && (!metadata.book_id || String(metadata.book_id) === currentBookId)) {
    const byId = documents.filter(doc => String(doc.id) === String(metadata.doc_id));
    if (byId.length === 1) return { document: byId[0], location, matchedBy: 'doc_id' };
  }
  if (metadata.slug) {
    const bySlug = documents.filter(doc => String(doc.slug || '') === String(metadata.slug));
    if (bySlug.length === 1) return { document: bySlug[0], location, matchedBy: 'slug' };
  }
  const samePath = documents.filter(doc =>
    String(doc.title || '') === location.title &&
    normalizePath(Array.isArray(doc.path) ? doc.path.join('/') : doc.path || '') === normalizePath(location.path.join('/'))
  );
  if (samePath.length > 1) return { ambiguous: true, location, candidates: samePath };
  return { document: samePath[0] || null, location, matchedBy: samePath.length ? 'path-title' : 'new' };
}
