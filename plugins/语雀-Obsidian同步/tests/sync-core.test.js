import test from 'node:test';
import assert from 'node:assert/strict';
import {
  addSourceMetadata,
  expectedNotePath,
  extractSourceMetadata,
  findDocumentMatch,
  getNoteBody,
  noteLocation,
  safeSegment
} from '../sync-core.js';

test('来源只显示为可点击的语雀链接且不会进入正文', () => {
  const note = addSourceMetadata('# 标题\n\n正文', {
    book_id: 1,
    doc_id: 2,
    slug: 'slug',
    source_url: 'https://www.yuque.com/a/b/c',
    original_title: '标题',
    path: ['目录一', '目录二']
  });
  assert.match(note, /语雀链接: "https:\/\/www\.yuque\.com\/a\/b\/c"/);
  assert.doesNotMatch(note, /yuque_source:/);
  assert.deepEqual(extractSourceMetadata(note), {
    source_url: 'https://www.yuque.com/a/b/c',
    slug: 'c'
  });
  assert.equal(getNoteBody(note), '# 标题\n\n正文');
});

test('导出时将旧来源块替换成链接并保留用户自己的 YAML 属性', () => {
  const original = `---\ntags:\n  - 笔记\nyuque_source:\n  doc_id: "1"\n---\n\n正文`;
  const note = addSourceMetadata(original, {
    book_id: 7,
    doc_id: 2,
    slug: 'new',
    source_url: 'https://www.yuque.com/a/b/new',
    original_title: '新标题',
    path: ['目录']
  });
  assert.match(note, /tags:\n  - 笔记/);
  assert.doesNotMatch(note, /yuque_source:/);
  assert.match(note, /语雀链接: "https:\/\/www\.yuque\.com\/a\/b\/new"/);
  assert.equal(extractSourceMetadata(note).slug, 'new');
  assert.equal(getNoteBody(note), '---\ntags:\n  - 笔记\n---\n\n正文');
});

test('兼容旧 yuque_sync 元数据并在导入正文时剥离', () => {
  const legacy = `---\ntags:\n  - 测试\nyuque_sync:\n  book_id: "7"\n  doc_id: "9"\n  title: "旧标题"\n  content_hash: "abc"\n---\n\n正文`;
  assert.equal(extractSourceMetadata(legacy).doc_id, '9');
  assert.equal(getNoteBody(legacy), '---\ntags:\n  - 测试\n---\n\n正文');
});

test('导出路径保留知识库和语雀目录层级', () => {
  assert.equal(
    expectedNotePath('AI 知识库', { title: '教程', path: ['ChatGPT', '入门'] }, '语雀笔记'),
    '语雀笔记/AI 知识库/ChatGPT/入门/教程.md'
  );
  assert.equal(safeSegment('a:b/c?'), 'a b c');
});

test('本地位置使用相对目录和来源标题', () => {
  assert.deepEqual(noteLocation('根目录/知识库/目录/文件名.md', '根目录/知识库', { original_title: '原始标题' }), {
    path: ['目录'],
    title: '原始标题'
  });
});

test('匹配优先使用当前知识库 doc_id', () => {
  const documents = [
    { id: 10, title: '旧标题', path: ['旧目录'] },
    { id: 11, title: '笔记', path: ['目录'] }
  ];
  const note = {
    path: '根/知识库/目录/笔记.md',
    content: '',
    source: { book_id: '7', doc_id: '10' }
  };
  const match = findDocumentMatch(documents, note, 7, '根/知识库');
  assert.equal(match.document.id, 10);
  assert.equal(match.matchedBy, 'doc_id');
});

test('新格式按语雀链接中的 slug 匹配原文档', () => {
  const documents = [
    { id: 10, slug: 'original-note', title: '旧标题', path: ['旧目录'] },
    { id: 11, slug: 'another-note', title: '笔记', path: ['目录'] }
  ];
  const note = {
    path: '根/知识库/新目录/新标题.md',
    content: '---\n语雀链接: "https://www.yuque.com/user/book/original-note"\n---\n\n正文'
  };
  const match = findDocumentMatch(documents, note, 7, '根/知识库');
  assert.equal(match.document.id, 10);
  assert.equal(match.matchedBy, 'slug');
  assert.deepEqual(match.location, { path: ['新目录'], title: '新标题' });
});

test('其他知识库 doc_id 会被忽略并按目录标题匹配', () => {
  const documents = [{ id: 11, title: '笔记', path: ['目录'] }];
  const note = {
    path: '根/知识库/目录/笔记.md',
    content: '',
    source: { book_id: '8', doc_id: '10' }
  };
  const match = findDocumentMatch(documents, note, 7, '根/知识库');
  assert.equal(match.document.id, 11);
  assert.equal(match.matchedBy, 'path-title');
});

test('同一路径多个同名文档会标记为歧义', () => {
  const documents = [
    { id: 1, title: '笔记', path: ['目录'] },
    { id: 2, title: '笔记', path: ['目录'] }
  ];
  const match = findDocumentMatch(documents, { path: '知识库/目录/笔记.md', content: '' }, 7, '知识库');
  assert.equal(match.ambiguous, true);
  assert.equal(match.candidates.length, 2);
});
