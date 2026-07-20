(() => {
  'use strict';

  const ACTIONS_ID = 'yuque-obsidian-actions';
  let scheduled = false;
  let refreshing = false;
  let refreshQueued = false;
  let context = null;
  let contextRoute = '';
  let activeProgress = null;

  function send(type, extra = {}) {
    return new Promise(resolve => {
      chrome.runtime.sendMessage({ type, ...extra }, response => {
        if (chrome.runtime.lastError) resolve({ error: chrome.runtime.lastError.message });
        else resolve(response || { error: '扩展没有返回结果' });
      });
    });
  }

  function button(text, className, handler, accessibleLabel = text) {
    const element = document.createElement('button');
    element.type = 'button';
    element.className = `yo-button ${className || ''}`;
    element.textContent = text;
    element.dataset.label = text;
    element.title = accessibleLabel;
    element.setAttribute('aria-label', accessibleLabel);
    element.addEventListener('click', handler);
    return element;
  }

  function findBookPlacement() {
    const share = [...document.querySelectorAll('button')]
      .find(node => /^(分享|Share)$/.test(node.textContent.trim())
        && /BookOverview-module_bookActionItem_/.test(node.className));
    const host = share?.parentElement;
    if (!host || !/BookOverview-module_bookAction_/.test(host.className)) return null;
    const before = [...host.children].find(node => node !== share
      && (/more-actions/i.test(node.getAttribute('data-testid') || '')
        || /index-module_more_/.test(node.className)));
    return { host, before: before || null, className: 'yo-native-book' };
  }

  function findDocumentPlacement() {
    const host = document.querySelector('.header-action');
    if (!host) return null;
    const before = [...host.children].find(node => /^(编辑|Edit)$/.test(node.textContent.trim())
      && node.classList.contains('header-action-item'));
    if (!before) return null;
    return { host, before, className: 'yo-native-doc' };
  }

  function placeGroup(group, placement) {
    group.className = placement.className;
    if (group.parentElement !== placement.host || group.nextElementSibling !== placement.before) {
      placement.host.insertBefore(group, placement.before);
    }
  }

  function createActionGroup(route, hasDocument) {
    const group = document.createElement('div');
    group.id = ACTIONS_ID;
    group.dataset.route = route;
    if (hasDocument) {
      group.appendChild(button('导出', 'export-action', () => exportCurrent(group), '导出到 Obsidian'));
    } else {
      group.appendChild(button('导入', 'import-action', openImportModal, '从 Obsidian 导入'));
    }
    return group;
  }

  function isDocumentPage() {
    const parts = location.pathname.split('/').filter(Boolean);
    return parts.length >= 3 && !/^(login|settings|search|help)$/i.test(parts[0]);
  }

  async function refresh() {
    scheduled = false;
    if (refreshing) {
      refreshQueued = true;
      return;
    }
    refreshing = true;
    try {
      const route = location.href;
      let existing = document.getElementById(ACTIONS_ID);
      if (!context || contextRoute !== route) {
        const next = await send('getPageContext');
        if (!next || next.error || !next.book?.id) return;
        context = next;
        contextRoute = route;
      }
      const hasDocument = Boolean(context.doc?.id || isDocumentPage());
      const hasBook = Boolean(context.book?.id && !hasDocument);
      if (!hasDocument && !hasBook) return;

      if (existing?.dataset.route !== route) {
        document.querySelectorAll(`#${ACTIONS_ID}`).forEach(node => node.remove());
        existing = null;
      }
      const group = existing || createActionGroup(route, hasDocument);
      const placement = hasBook ? findBookPlacement() : findDocumentPlacement();
      const useMobileFallback = window.matchMedia('(max-width: 640px)').matches;

      if (placement && !useMobileFallback) {
        placeGroup(group, placement);
      } else if (useMobileFallback) {
        group.className = 'yo-floating-mobile';
        if (group.parentElement !== document.body) document.body.appendChild(group);
      } else if (group.isConnected) {
        group.remove();
      }
    } finally {
      refreshing = false;
      if (refreshQueued) {
        refreshQueued = false;
        schedule();
      }
    }
  }

  function schedule() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(refresh);
  }

  async function exportCurrent(group) {
    const action = group.querySelector('button');
    if (action) {
      action.disabled = true;
      action.textContent = '导出中…';
    }
    const result = await send('exportCurrent');
    if (result?.error) showToast(result.error, 'error');
    else {
      const warning = result.warnings?.length ? `；${result.warnings.length} 个图片保留远程地址` : '';
      showToast(`已导出：${result.path || 'Obsidian 笔记'}${warning}`, result.warnings?.length ? 'warning' : 'success');
    }
    if (action) {
      action.disabled = false;
      action.textContent = action.dataset.label || '导出';
    }
  }

  function showToast(message, type = 'info') {
    document.querySelectorAll('.yo-toast').forEach(node => node.remove());
    const toast = document.createElement('div');
    toast.className = `yo-toast ${type}`;
    toast.textContent = message;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 6000);
  }

  function reloadAfterImport(message, type = 'success') {
    showToast(message, type);
    setTimeout(() => location.reload(), 700);
  }

  function modalShell(title, subtitle) {
    const backdrop = document.createElement('div');
    backdrop.className = 'yo-modal-backdrop';
    const modal = document.createElement('section');
    modal.className = 'yo-modal';
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    const head = document.createElement('div');
    head.className = 'yo-modal-head';
    const copy = document.createElement('div');
    const heading = document.createElement('h2');
    heading.id = 'yo-modal-title';
    heading.textContent = title;
    modal.setAttribute('aria-labelledby', heading.id);
    const description = document.createElement('p');
    description.textContent = subtitle;
    copy.append(heading, description);
    const closeButton = document.createElement('button');
    closeButton.className = 'yo-close';
    closeButton.type = 'button';
    closeButton.setAttribute('aria-label', '关闭');
    closeButton.textContent = '×';
    head.append(copy, closeButton);
    modal.appendChild(head);
    backdrop.appendChild(modal);
    document.body.appendChild(backdrop);
    const onKeydown = event => {
      if (event.key === 'Escape') close();
    };
    const close = () => {
      if (activeProgress?.modal === modal) activeProgress = null;
      document.removeEventListener('keydown', onKeydown);
      backdrop.remove();
    };
    closeButton.addEventListener('click', close);
    backdrop.addEventListener('click', event => { if (event.target === backdrop) close(); });
    document.addEventListener('keydown', onKeydown);
    closeButton.focus();
    return { modal, close };
  }

  function tabButton(label, id, active = false) {
    const tab = document.createElement('button');
    tab.className = `yo-tab${active ? ' active' : ''}`;
    tab.dataset.tab = id;
    tab.type = 'button';
    tab.textContent = label;
    return tab;
  }

  async function openImportModal() {
    const shell = modalShell('从 Obsidian 导入', `${context.book.name || '当前知识库'} · 本地内容将直接覆盖语雀对应文档`);
    const { modal, close } = shell;
    const tabs = document.createElement('div');
    tabs.className = 'yo-tabs';
    tabs.append(tabButton('导入单篇', 'single', true), tabButton('导入整个知识库', 'book'));

    const singlePanel = document.createElement('div');
    singlePanel.className = 'yo-panel';
    singlePanel.dataset.panel = 'single';
    singlePanel.innerHTML = `
      <div class="yo-field">
        <label for="yo-note-search">选择本地 Markdown</label>
        <input id="yo-note-search" type="search" placeholder="搜索标题或路径">
      </div>
      <div class="yo-note-list"><p class="yo-result">正在读取 Obsidian…</p></div>
      <div class="yo-actions">
        <button class="yo-button" data-close type="button">取消</button>
        <button class="yo-button primary" data-import-single type="button" disabled>导入选中文档</button>
      </div>`;

    const bookPanel = document.createElement('div');
    bookPanel.className = 'yo-panel';
    bookPanel.dataset.panel = 'book';
    bookPanel.hidden = true;
    bookPanel.innerHTML = `
      <p class="yo-result">读取同名 Obsidian 知识库后，将逐篇新建或覆盖语雀文档，不会删除语雀中的其他内容。</p>
      <div class="yo-summary"></div>
      <div class="yo-note-list yo-operation-list"><p class="yo-result">点击“检查本地知识库”查看导入内容。</p></div>
      <div class="yo-import-progress" role="status" aria-live="polite"></div>
      <div class="yo-actions">
        <button class="yo-button" data-close type="button">取消</button>
        <button class="yo-button" data-preview type="button">检查本地知识库</button>
        <button class="yo-button primary" data-import-book type="button" disabled>导入整个知识库</button>
      </div>`;

    modal.append(tabs, singlePanel, bookPanel);
    modal.querySelectorAll('[data-close]').forEach(node => node.addEventListener('click', close));
    modal.querySelectorAll('.yo-tab').forEach(tab => tab.addEventListener('click', () => {
      modal.querySelectorAll('.yo-tab').forEach(item => item.classList.toggle('active', item === tab));
      modal.querySelectorAll('[data-panel]').forEach(panel => { panel.hidden = panel.dataset.panel !== tab.dataset.tab; });
    }));

    let selectedPath = '';
    const notesResult = await send('listBookNotes');
    const list = singlePanel.querySelector('.yo-note-list');
    const notes = Array.isArray(notesResult?.notes) ? notesResult.notes : [];
    const renderNotes = (query = '') => {
      list.textContent = '';
      const normalized = query.trim().toLowerCase();
      const filtered = notes.filter(note => !normalized || note.path.toLowerCase().includes(normalized));
      if (!filtered.length) {
        const empty = document.createElement('p');
        empty.className = 'yo-result';
        empty.textContent = notesResult?.error || `没有找到 ${context.book.name || '当前知识库'} 文件夹下的 Markdown。`;
        list.appendChild(empty);
        return;
      }
      for (const note of filtered) {
        const item = document.createElement('label');
        item.className = 'yo-note';
        const input = document.createElement('input');
        input.type = 'radio';
        input.name = 'yo-note';
        input.value = note.path;
        input.checked = selectedPath === note.path;
        const copy = document.createElement('span');
        const name = document.createElement('strong');
        name.textContent = note.title || note.path.split('/').pop();
        const path = document.createElement('small');
        path.textContent = note.path;
        copy.append(name, path);
        item.append(input, copy);
        input.addEventListener('change', () => {
          selectedPath = note.path;
          singlePanel.querySelector('[data-import-single]').disabled = false;
        });
        list.appendChild(item);
      }
    };
    renderNotes();
    singlePanel.querySelector('#yo-note-search').addEventListener('input', event => renderNotes(event.target.value));
    singlePanel.querySelector('[data-import-single]').addEventListener('click', async event => {
      if (!selectedPath) return;
      event.target.disabled = true;
      event.target.textContent = '导入中…';
      const result = await send('importSingle', { path: selectedPath });
      if (result?.error) {
        showToast(result.error, 'error');
        event.target.disabled = false;
        event.target.textContent = '导入选中文档';
      } else {
        reloadAfterImport(`已导入：${result.title || selectedPath}`);
        close();
      }
    });

    let preview = null;
    bookPanel.querySelector('[data-preview]').addEventListener('click', async event => {
      event.target.disabled = true;
      event.target.textContent = '检查中…';
      const result = await send('previewBookImport');
      if (result?.error) {
        bookPanel.querySelector('.yo-operation-list').textContent = result.error;
        preview = null;
      } else {
        preview = result;
        renderImportPreview(bookPanel, result);
        bookPanel.querySelector('[data-import-book]').disabled = result.total === 0;
      }
      event.target.disabled = false;
      event.target.textContent = '重新检查';
    });
    bookPanel.querySelector('[data-import-book]').addEventListener('click', async event => {
      if (!preview?.total) return;
      if (!window.confirm(`将 ${preview.total} 篇本地 Markdown 导入“${preview.bookName}”，已有文档会被覆盖。继续吗？`)) return;
      event.target.disabled = true;
      event.target.textContent = '导入中…';
      bookPanel.querySelector('[data-preview]').disabled = true;
      const progress = bookPanel.querySelector('.yo-import-progress');
      progress.classList.remove('error');
      progress.textContent = `准备导入 ${preview.total} 篇文档…`;
      activeProgress = { modal, element: progress };
      const result = await send('importBook');
      activeProgress = null;
      if (result?.error) {
        progress.textContent = result.error;
        progress.classList.add('error');
        showToast(result.error, 'error');
      } else {
        renderImportResult(bookPanel, result);
        const message = `导入完成：成功 ${result.succeeded} 篇，失败 ${result.failed} 篇`;
        if (result.succeeded > 0) reloadAfterImport(message, result.failed ? 'warning' : 'success');
        else showToast(message, 'error');
      }
      event.target.disabled = false;
      event.target.textContent = '再次导入';
      bookPanel.querySelector('[data-preview]').disabled = false;
    });
  }

  function renderImportPreview(panel, result) {
    const stats = [
      [result.total, '本地文档'],
      [result.create, '将新建'],
      [result.overwrite, '将覆盖'],
      [result.ambiguous, '需人工处理']
    ];
    panel.querySelector('.yo-summary').innerHTML = stats
      .map(([value, label]) => `<div class="yo-stat"><strong>${value || 0}</strong><span>${label}</span></div>`).join('');
    const list = panel.querySelector('.yo-operation-list');
    list.textContent = '';
    for (const item of result.items || []) {
      const row = document.createElement('div');
      row.className = `yo-note yo-operation ${item.action}`;
      const action = item.action === 'create' ? '新建' : item.action === 'overwrite' ? '覆盖' : '同名冲突';
      row.textContent = `${action} · ${item.path}`;
      list.appendChild(row);
    }
    if (!result.items?.length) list.innerHTML = '<p class="yo-result">同名知识库下没有 Markdown。</p>';
  }

  function renderImportResult(panel, result) {
    const progress = panel.querySelector('.yo-import-progress');
    progress.classList.toggle('error', result.failed > 0);
    progress.textContent = `导入完成：成功 ${result.succeeded} 篇，失败 ${result.failed} 篇。`;
    const list = panel.querySelector('.yo-operation-list');
    list.textContent = '';
    for (const item of result.results || []) {
      const row = document.createElement('div');
      row.className = `yo-note yo-operation ${item.ok ? 'success' : 'failed'}`;
      row.textContent = item.ok ? `成功 · ${item.path}` : `失败 · ${item.path} · ${item.error}`;
      list.appendChild(row);
    }
  }

  chrome.runtime.onMessage.addListener(message => {
    if (message?.type !== 'bookImportProgress' || !activeProgress?.element) return;
    activeProgress.element.textContent = `${message.current}/${message.total} · ${message.failed ? '失败' : '已完成'} · ${message.path}`;
  });

  new MutationObserver(schedule).observe(document.documentElement, { childList: true, subtree: true });
  addEventListener('popstate', schedule);
  addEventListener('hashchange', schedule);
  addEventListener('resize', schedule);
  schedule();
})();
