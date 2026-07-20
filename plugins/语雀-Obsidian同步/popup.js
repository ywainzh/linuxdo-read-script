const form = document.getElementById('settingsForm');
const apiUrl = document.getElementById('apiUrl');
const apiKey = document.getElementById('apiKey');
const rootFolder = document.getElementById('rootFolder');
const result = document.getElementById('result');
const testButton = document.getElementById('testButton');
const statusDot = document.querySelector('.status-dot');

function send(type, extra = {}) {
  return new Promise(resolve => chrome.runtime.sendMessage({ type, ...extra }, response => {
    if (chrome.runtime.lastError) resolve({ error: chrome.runtime.lastError.message });
    else resolve(response || { error: '扩展没有返回结果' });
  }));
}

function show(message, type = '') {
  result.className = type;
  result.textContent = message;
  statusDot.classList.toggle('ok', type === 'success');
}

async function load() {
  const settings = await send('getSettings');
  if (settings?.error) return show(settings.error, 'error');
  apiUrl.value = settings.apiUrl || 'http://127.0.0.1:27123';
  apiKey.value = settings.apiKey || '';
  rootFolder.value = settings.rootFolder || '';
}

async function persist() {
  return send('saveSettings', { settings: { apiUrl: apiUrl.value, apiKey: apiKey.value, rootFolder: rootFolder.value } });
}

form.addEventListener('submit', async event => {
  event.preventDefault();
  const button = form.querySelector('[type="submit"]'); button.disabled = true;
  const response = await persist();
  button.disabled = false;
  if (response?.error) show(response.error, 'error'); else show('设置已保存', 'success');
});

testButton.addEventListener('click', async () => {
  testButton.disabled = true; show('正在连接…');
  const saved = await persist();
  const response = saved?.error ? saved : await send('testObsidian');
  testButton.disabled = false;
  if (response?.error) show(response.error, 'error'); else show('Obsidian 连接正常', 'success');
});

document.getElementById('toggleKey').addEventListener('click', () => {
  apiKey.type = apiKey.type === 'password' ? 'text' : 'password';
});

load();
