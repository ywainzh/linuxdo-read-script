import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeSettings, validateApiUrl } from '../obsidian-client.js';

test('Obsidian 地址只允许本机', () => {
  assert.equal(validateApiUrl('http://127.0.0.1:27123/path'), 'http://127.0.0.1:27123');
  assert.throws(() => validateApiUrl('https://example.com'), /只能使用/);
});

test('知识库根目录会规范化', () => {
  const settings = normalizeSettings({ apiUrl: 'http://localhost:27123', rootFolder: '/语雀笔记//', apiKey: ' key ' });
  assert.equal(settings.rootFolder, '语雀笔记');
  assert.equal(settings.apiKey, 'key');
});
