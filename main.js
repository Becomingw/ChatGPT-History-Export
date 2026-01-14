// ==UserScript==
// @name         ChatGPT 选择性导出 HTML
// @namespace    https://github.com/Becomingw/ChatGPT-History-Export
// @version      8.0
// @description  选择要导出的对话轮，支持保存到默认位置或直接下载；自愈挂载；自动使用<head><title>作为文件标题。
// @match        https://chat.openai.com/*
// @match        https://chatgpt.com/*
// @run-at       document-idle
// @grant        none
// ==/UserScript==

(function () {
  'use strict';

  /** ========== UI 样式（侧边栏可收起） ========== */
  const styles = `
    :root{
      --cgpt-accent:#10a37f;
      --cgpt-accent-hover:#0d8c6c;
      --cgpt-bg:rgba(255,255,255,.92);
      --cgpt-bg-hover:rgba(255,255,255,.98);
      --cgpt-fg:#0b1220;
      --cgpt-muted:#6b7280;
      --cgpt-border:rgba(0,0,0,.12);
      --cgpt-shadow:0 8px 32px rgba(0,0,0,.12);
    }
    @media (prefers-color-scheme: dark){
      :root{
        --cgpt-bg:rgba(18,24,38,.92);
        --cgpt-bg-hover:rgba(24,32,48,.98);
        --cgpt-fg:#e5e7eb;
        --cgpt-muted:#9ca3af;
        --cgpt-border:rgba(255,255,255,.12);
        --cgpt-shadow:0 8px 32px rgba(0,0,0,.45);
      }
    }

    /* 侧边栏容器 */
    #cgpt-sidebar{
      position:fixed;top:0;right:0;height:100vh;
      width:280px;
      z-index:9999999;
      display:flex;flex-direction:column;
      pointer-events:none;
      transition:transform .3s cubic-bezier(.16,1,.3,1)
    }
    #cgpt-sidebar.cgpt-collapsed{
      transform:translateX(280px)
    }

    /* 侧边栏内容区 */
    #cgpt-sidebar-content{
      flex:1;
      background:var(--cgpt-bg);
      backdrop-filter:saturate(180%) blur(20px);
      -webkit-backdrop-filter:saturate(180%) blur(20px);
      border-left:1px solid var(--cgpt-border);
      box-shadow:var(--cgpt-shadow);
      padding:16px;
      display:flex;flex-direction:column;gap:10px;
      pointer-events:auto;
      overflow-y:auto;
      max-height:100vh
    }

    /* 收起/展开按钮 */
    #cgpt-toggle-btn{
      position:absolute;top:50%;left:-48px;
      transform:translateY(-50%);
      width:40px;height:40px;
      border-radius:8px 0 0 8px;
      background:var(--cgpt-bg);
      backdrop-filter:saturate(180%) blur(20px);
      -webkit-backdrop-filter:saturate(180%) blur(20px);
      border:1px solid var(--cgpt-border);
      border-right:none;
      cursor:pointer;
      display:flex;align-items:center;justify-content:center;
      pointer-events:auto;
      transition:all .2s ease
    }
    #cgpt-toggle-btn:hover{
      background:var(--cgpt-bg-hover)
    }
    #cgpt-toggle-btn svg{
      width:20px;height:20px;
      transition:transform .3s ease
    }
    #cgpt-sidebar.cgpt-collapsed #cgpt-toggle-btn svg{
      transform:rotate(180deg)
    }

    /* 按钮样式 */
    #cgpt-sidebar-content button{
      appearance:none;border:1px solid var(--cgpt-border);
      background:rgba(16,163,127,.08);color:var(--cgpt-fg);
      border-radius:10px;padding:11px 14px;
      cursor:pointer;
      font-size:13px;font-weight:500;line-height:1;
      display:flex;align-items:center;gap:8px;
      width:100%;
      transition:all .15s ease;
      font-family:ui-sans-serif,system-ui,-apple-system,sans-serif
    }
    #cgpt-sidebar-content button:hover{
      background:rgba(16,163,127,.15);
      border-color:var(--cgpt-accent)
    }
    #cgpt-sidebar-content button:active{transform:scale(.98)}
    #cgpt-sidebar-content button:disabled{
      opacity:.5;cursor:not-allowed;transform:none
    }

    #cgpt-sidebar-content button.cgpt-primary{
      background:var(--cgpt-accent);
      color:#fff;
      border-color:var(--cgpt-accent)
    }
    #cgpt-sidebar-content button.cgpt-primary:hover{
      background:var(--cgpt-accent-hover)
    }

    /* 状态指示点 */
    #cgpt-sidebar-content .cgpt-pill-dot{
      width:8px;height:8px;border-radius:999px;
      background:var(--cgpt-accent);
      box-shadow:0 0 0 2.5px rgba(16,163,127,.2);
      animation:cgpt-pulse 2s ease-in-out infinite
    }
    @keyframes cgpt-pulse{
      0%,100%{opacity:1}
      50%{opacity:.5}
    }
    #cgpt-sidebar.cgpt-active .cgpt-pill-dot{animation:none}

    /* 状态计数器 */
    #cgpt-sidebar-content .cgpt-pill{
      background:rgba(16,163,127,.08);
      border:1px solid var(--cgpt-border);
      border-radius:10px;padding:10px 12px;
      font-size:12px;font-weight:500;
      display:flex;align-items:center;gap:6px;
      text-align:center
    }
    #cgpt-sidebar-content .cgpt-pill .cgpt-count{
      font-weight:600;color:var(--cgpt-accent);font-size:14px
    }

    /* 分隔线 */
    .cgpt-divider{
      height:1px;
      background:var(--cgpt-border);
      margin:4px 0
    }

    /* 提示消息 */
    .cgpt-toast{
      position:fixed;bottom:24px;left:50%;
      transform:translateX(-50%) translateY(8px);
      background:rgba(15,23,42,.92);color:#fff;
      padding:10px 16px;border-radius:11px;
      z-index:9999999;font-size:13px;font-weight:500;
      max-width:min(90vw,400px);
      box-shadow:0 12px 40px rgba(0,0,0,.3);
      backdrop-filter:blur(12px);
      -webkit-backdrop-filter:blur(12px);
      opacity:0;pointer-events:none;
      transition:opacity .25s ease,transform .25s cubic-bezier(.16,1,.3,1)
    }
    .cgpt-toast.cgpt-show{
      opacity:1;pointer-events:auto;
      transform:translateX(-50%) translateY(0)
    }

    /* 选择模式样式 - 按轮对话分组 */
    html.cgpt-select-mode .cgpt-turn{
      cursor:pointer;
      transition:all .15s ease;
      position:relative
    }
    /* 整轮 hover 效果 */
    html.cgpt-select-mode .cgpt-turn:hover{
      background:rgba(16,163,127,.05)
    }
    html.cgpt-select-mode .cgpt-turn[data-cgpt-pos="first"]{
      border-top:2px solid rgba(16,163,127,.3);
      border-radius:13px 13px 0 0;
      padding-top:2px
    }
    html.cgpt-select-mode .cgpt-turn[data-cgpt-pos="first"]:hover{
      border-top-color:rgba(16,163,127,.5)
    }
    html.cgpt-select-mode .cgpt-turn[data-cgpt-pos="last"]{
      border-bottom:2px solid rgba(16,163,127,.3);
      border-radius:0 0 13px 13px;
      padding-bottom:2px
    }
    html.cgpt-select-mode .cgpt-turn[data-cgpt-pos="last"]:hover{
      border-bottom-color:rgba(16,163,127,.5)
    }
    html.cgpt-select-mode .cgpt-turn[data-cgpt-pos="middle"]{
      border-left:2px solid rgba(16,163,127,.3);
      border-right:2px solid rgba(16,163,127,.3)
    }
    html.cgpt-select-mode .cgpt-turn[data-cgpt-pos="single"]{
      border:2px solid rgba(16,163,127,.3);
      border-radius:13px
    }

    /* 选中状态 */
    html.cgpt-select-mode .cgpt-turn[data-cgpt-selected="1"]{
      background:rgba(16,163,127,.08)
    }
    html.cgpt-select-mode .cgpt-turn[data-cgpt-selected="1"][data-cgpt-pos="first"]{
      border-top-color:rgba(16,163,127,.7)
    }
    html.cgpt-select-mode .cgpt-turn[data-cgpt-selected="1"][data-cgpt-pos="last"]{
      border-bottom-color:rgba(16,163,127,.7)
    }
    html.cgpt-select-mode .cgpt-turn[data-cgpt-selected="1"][data-cgpt-pos="middle"]{
      border-left-color:rgba(16,163,127,.7);
      border-right-color:rgba(16,163,127,.7)
    }
    html.cgpt-select-mode .cgpt-turn[data-cgpt-selected="1"][data-cgpt-pos="single"]{
      border-color:rgba(16,163,127,.7)
    }

    .cgpt-highlight{
      animation:cgpt-highlight-pulse .6s ease-out
    }
    .cgpt-highlight[data-cgpt-pos="single"],
    .cgpt-highlight[data-cgpt-pos="first"]{
      border-top-color:rgba(16,163,127,1)!important
    }
    .cgpt-highlight[data-cgpt-pos="single"],
    .cgpt-highlight[data-cgpt-pos="last"]{
      border-bottom-color:rgba(16,163,127,1)!important
    }
    .cgpt-highlight[data-cgpt-pos="middle"]{
      border-left-color:rgba(16,163,127,1)!important;
      border-right-color:rgba(16,163,127,1)!important
    }
    @keyframes cgpt-highlight-pulse{
      0%{filter:brightness(1.1)}
      100%{filter:brightness(1)}
    }
  `;
  const styleEl = document.createElement('style'); styleEl.textContent = styles; document.documentElement.appendChild(styleEl);

  /** ========== 小工具 ========== */
  const sleep = (ms) => new Promise(r => setTimeout(r, ms));
  const esc = (s) => (s||'').replace(/[&<>"']/g,c=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;' }[c]));

  let toastEl = null;
  let toastTimer = null;
  const toast = (msg, duration = 2000) => {
    if (toastEl) {
      toastEl.classList.remove('cgpt-show');
      clearTimeout(toastTimer);
    }
    if (!toastEl) {
      toastEl = document.createElement('div');
      toastEl.className = 'cgpt-toast';
      document.body.appendChild(toastEl);
    }
    toastEl.textContent = msg;
    requestAnimationFrame(() => {
      toastEl.classList.add('cgpt-show');
    });
    toastTimer = setTimeout(() => {
      toastEl.classList.remove('cgpt-show');
    }, duration);
  };

  const pad2 = n => n<10 ? '0'+n : ''+n;
  const nowStr = () => { const d=new Date(); return `${d.getFullYear()}-${pad2(d.getMonth()+1)}-${pad2(d.getDate())} ${pad2(d.getHours())}:${pad2(d.getMinutes())}`; };
  const fileTimeStr = () => { const d=new Date(); return `${d.getFullYear()}${pad2(d.getMonth()+1)}${pad2(d.getDate())}-${pad2(d.getHours())}${pad2(d.getMinutes())}`; };
  const safeFile = (s) => (s||'ChatGPT 对话').replace(/[\\/:*?"<>|]+/g,'_').trim() || 'ChatGPT_对话';
  const clampInt = (n, min, max) => Math.max(min, Math.min(max, n));

  /** ========== 1) 稳定获取真实 <title>（最多等 10s） ========== */
  async function waitForRealTitle() {
    const good = t => t && t !== 'ChatGPT' && !/^New chat$/i.test(t);
    let t = (document.title||'').trim();
    if (good(t)) return t;

    const titleEl = document.querySelector('title');
    if (!titleEl) return 'ChatGPT 对话';

    let resolved = false;
    const obs = new MutationObserver(() => {
      const v = (document.title||'').trim();
      if (good(v)) { resolved = true; obs.disconnect(); }
    });
    obs.observe(titleEl, { childList: true });

    const deadline = Date.now() + 10000;
    while (!resolved && Date.now() < deadline) await sleep(200);

    obs.disconnect();
    t = (document.title||'').trim();
    return good(t) ? t : 'ChatGPT 对话';
  }

  /** ========== 2) 采集对话轮（按 conversation-turn 分组） ========== */
  function getTurnElements() {
    const els = Array.from(document.querySelectorAll('article[data-testid^="conversation-turn-"], article[data-turn-id]'));
    if (els.length) return els;
    return Array.from(document.querySelectorAll('div[data-message-author-role]')).map((n) => n.closest('article') || n);
  }

  function getTurnRole(turnEl) {
    const byTurn = (turnEl.getAttribute && turnEl.getAttribute('data-turn')) || '';
    if (byTurn) return byTurn;
    const msg = turnEl.querySelector?.('[data-message-author-role]');
    return (msg && msg.getAttribute('data-message-author-role')) || 'unknown';
  }

  function getTurnContentEl(turnEl) {
    const msg = turnEl.querySelector?.('[data-message-author-role]') || turnEl;
    return msg.querySelector?.('.markdown, .prose, .whitespace-pre-wrap, [class*="markdown"]') || msg;
  }

  function normalizeSnippet(s, maxLen = 120) {
    const t = (s || '').replace(/\s+/g, ' ').trim();
    if (!t) return '';
    return t.length > maxLen ? t.slice(0, maxLen - 1) + '…' : t;
  }

  function collectRounds() {
    const turnEls = getTurnElements();
    const turns = turnEls.map((el) => {
      const role = getTurnRole(el);
      const contentEl = getTurnContentEl(el);
      const text = normalizeSnippet(contentEl.textContent || '', 220);
      const turnId = el.getAttribute?.('data-turn-id') || el.querySelector?.('[data-message-id]')?.getAttribute?.('data-message-id') || '';
      return { el, role, contentEl, text, turnId };
    });

    const rounds = [];
    let current = null;
    let idx = 0;
    for (const t of turns) {
      if (t.role === 'user') {
        if (current) rounds.push(current);
        idx += 1;
        current = { index: idx, key: t.turnId || `round-${idx}`, turns: [t], userText: t.text, assistantText: '' };
        continue;
      }
      if (!current) {
        idx += 1;
        current = { index: idx, key: t.turnId || `round-${idx}`, turns: [], userText: '', assistantText: '' };
      }
      current.turns.push(t);
      if (!current.assistantText && t.text) current.assistantText = t.text;
    }
    if (current) rounds.push(current);

    // 兜底：若没有 user turn，则将每条 turn 视为一“轮”
    const hasUser = turns.some((t) => t.role === 'user');
    if (!hasUser) {
      return turns.map((t, i) => ({
        index: i + 1,
        key: t.turnId || `turn-${i + 1}`,
        turns: [t],
        userText: t.role === 'user' ? t.text : '',
        assistantText: t.role === 'assistant' ? t.text : t.text,
      }));
    }

    return rounds;
  }

  /** ========== 3) 组装导出 HTML（使用原始页面样式） ========== */
  function buildHTMLDoc(title, bodyInner, metaLine) {
    // 提取页面原有样式
    const originalStyles = Array.from(document.querySelectorAll('style, link[rel="stylesheet"]'))
      .map(el => el.outerHTML)
      .join('\n');

    // 提取关键 CSS 变量和基础样式
    const computedStyle = getComputedStyle(document.documentElement);
    const bgColor = computedStyle.getPropertyValue('--bg-primary') || computedStyle.backgroundColor || '#ffffff';
    const textColor = computedStyle.getPropertyValue('--text-primary') || computedStyle.color || '#000000';
    const fontFamily = computedStyle.fontFamily || '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';

    const css = `
      *{box-sizing:border-box}
      body{
        margin:0;
        padding:20px;
        background:${bgColor};
        color:${textColor};
        font-family:${fontFamily};
        line-height:1.6
      }
      .export-header{
        max-width:800px;
        margin:0 auto 30px;
        padding:20px;
        background:${bgColor};
        border-radius:12px;
        border:1px solid rgba(0,0,0,.1)
      }
      .export-header h1{
        margin:0 0 10px;
        font-size:24px;
        font-weight:600
      }
      .export-meta{
        font-size:13px;
        opacity:.7;
        margin-top:8px
      }
      /* 保留原始对话块样式 */
      .export-legend{
        display:flex;
        align-items:center;
        gap:16px;
        padding:12px 16px;
        background:rgba(0,0,0,.05);
        border-radius:8px;
        margin-bottom:20px;
        font-size:13px
      }
      .export-legend-item{
        display:flex;
        align-items:center;
        gap:8px
      }
      .export-legend-color{
        width:20px;
        height:20px;
        border-radius:4px;
        border:1px solid rgba(0,0,0,.1)
      }
      .export-legend-user .export-legend-color{
        background:rgba(16,163,127,.08)
      }
      .export-legend-assistant .export-legend-color{
        background:rgba(66,133,244,.08)
      }
      article[data-testid^="conversation-turn-"][data-message-author-role="user"]{
        background:rgba(16,163,127,.08);
        border-radius:12px;
        padding:16px;
        margin-bottom:24px
      }
      article[data-testid^="conversation-turn-"][data-message-author-role="assistant"]{
        background:rgba(66,133,244,.08);
        border-radius:12px;
        padding:16px;
        margin-bottom:24px
      }
      article[data-testid^="conversation-turn-"]{
        margin-bottom:24px
      }
      @media print{
        .export-legend{display:block}
      }
    `;

    const created = nowStr();
    return `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)}</title>
<!-- 原始页面样式 -->
${originalStyles}
<!-- 导出特定样式 -->
<style>${css}</style>
</head>
<body>
<div class="export-header">
  <h1>${esc(title)}</h1>
  <div class="export-meta">
    导出时间：${created} · 源站：<a href="${location.href}" target="_blank">${location.hostname}</a>${metaLine ? ' · ' + esc(metaLine) : ''}
  </div>
</div>
<div class="export-legend">
  <div class="export-legend-item export-legend-user">
    <div class="export-legend-color"></div>
    <span>用户提问</span>
  </div>
  <div class="export-legend-item export-legend-assistant">
    <div class="export-legend-color"></div>
    <span>ChatGPT 回答</span>
  </div>
</div>
${bodyInner}
</body>
</html>`;
  }

  /** ========== 4) 下载（Blob → a[download]） ========== */
  function downloadFile(filename, content, mime = 'text/html') {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1500);
  }

  /** ========== 4.1) IndexedDB 存/取目录句柄（可跨会话） ========== */
  const DB_NAME = 'cgpt-export-db';
  const STORE = 'handles';
  const KEY = 'dir';

  function idb() {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => req.result.createObjectStore(STORE);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }
  async function idbSetDirHandle(handle) {
    const db = await idb();
    await new Promise((res, rej) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).put(handle, KEY);
      tx.oncomplete = () => res();
      tx.onerror = () => rej(tx.error);
    });
    db.close();
  }
  async function idbGetDirHandle() {
    const db = await idb();
    const handle = await new Promise((res, rej) => {
      const tx = db.transaction(STORE, 'readonly');
      const req = tx.objectStore(STORE).get(KEY);
      req.onsuccess = () => res(req.result || null);
      req.onerror = () => rej(req.error);
    });
    db.close();
    return handle;
  }

  async function requestRWPermission(dirHandle) {
    if (!dirHandle) return false;
    let p = await dirHandle.queryPermission({ mode: 'readwrite' });
    if (p === 'granted') return true;
    p = await dirHandle.requestPermission({ mode: 'readwrite' });
    return p === 'granted';
  }

  async function pickAndSaveDefaultDir() {
    if (!('showDirectoryPicker' in window)) {
      toast('⚠️ 当前浏览器不支持文件夹选择（需要 Chromium 系浏览器）');
      return false;
    }
    try {
      const handle = await window.showDirectoryPicker({ mode: 'readwrite' });
      await idbSetDirHandle(handle);
      toast('✅ 默认保存位置已设置：' + handle.name);
      syncFab();
      return true;
    } catch (e) {
      if (e.name === 'AbortError') {
        toast('已取消选择文件夹');
      } else {
        console.error('[DirPicker Error]', e);
        toast('❌ 设置失败：' + e.message);
      }
      return false;
    }
  }

  async function saveToDefaultDir(filename, content) {
    const dirHandle = await idbGetDirHandle();
    if (!dirHandle) {
      toast('⚠️ 请先设置默认保存位置');
      return false;
    }
    const ok = await requestRWPermission(dirHandle);
    if (!ok) {
      toast('⚠️ 无写入权限，请重新设置默认位置');
      await idbSetDirHandle(null);
      syncFab();
      return false;
    }

    // 避免覆盖：若重名则自动加时间戳
    let finalName = filename;
    const baseName = filename.replace(/\.html$/, '');
    const timestamp = fileTimeStr();
    finalName = `${baseName} ${timestamp}.html`;

    try {
      const fileHandle = await dirHandle.getFileHandle(finalName, { create: true });
      const w = await fileHandle.createWritable();
      await w.write(new Blob([content], { type: 'text/html' }));
      await w.close();
      toast('✅ 已保存：' + finalName);
      return true;
    } catch (e) {
      console.error('[Save Error]', e);
      toast('❌ 保存失败：' + e.message);
      return false;
    }
  }

  async function exportAllRounds() {
    try {
      const title = await waitForRealTitle();
      const rounds = collectRounds();
      if (!rounds.length) {
        toast('⚠️ 未找到对话内容');
        return;
      }
      const selectedSet = new Set(rounds.map(r => r.index));
      const body = buildSelectedBody(rounds, selectedSet);
      const metaLine = `全部 ${rounds.length} 轮`;
      const html = buildHTMLDoc(title, body, metaLine);
      const filename = safeFile(title) + '.html';

      const dirHandle = await idbGetDirHandle();
      if (dirHandle) {
        const saved = await saveToDefaultDir(filename.replace('.html', ''), html);
        if (!saved) {
          downloadFile(filename, html);
        }
      } else {
        downloadFile(filename, html);
        toast('✅ 已触发下载：' + filename);
      }
    } catch (e) {
      console.error('[Export Error]', e);
      toast('❌ 导出失败：' + (e?.message || e));
    }
  }

  /** ========== 5) 组装选中轮的 HTML（保留原始 HTML 结构） ========== */
  function buildSelectedBody(rounds, selectedSet) {
    const wrapper = document.createElement('div');

    for (const r of rounds) {
      if (!selectedSet.has(r.index)) continue;
      for (const t of r.turns) {
        const el = t.el;
        if (!(el instanceof Element)) continue;

        // 克隆原始元素，保留所有样式和结构
        const clone = el.cloneNode(true);

        // 移除交互相关的属性和类
        clone.classList.remove('cgpt-turn');
        clone.removeAttribute('data-cgpt-selected');
        clone.removeAttribute('data-cgpt-round-key');
        clone.removeAttribute('data-cgpt-round-index');

        // 将 role 属性复制到 article 元素上（用于背景色样式）
        clone.setAttribute('data-message-author-role', t.role);

        // 移除可能的按钮、输入框等交互元素
        const interactiveSelectors = 'button, textarea, input, [role="button"], [data-action]';
        clone.querySelectorAll(interactiveSelectors).forEach(btn => btn.remove());

        // 移除角色标签（如 "你说："、"ChatGPT 说："）
        // 遍历所有元素，找到包含这些文本的元素并删除
        const allElements = clone.querySelectorAll('*');
        const labelPatterns = ['你说', 'ChatGPT 说', 'You', 'ChatGPT'];
        for (const elem of Array.from(allElements)) {
          const text = (elem.textContent || '').trim();
          // 检查是否是只包含标签文本的元素
          const isLabel = labelPatterns.some(pattern => text === pattern || text.startsWith(pattern + '：') || text.startsWith(pattern + ':'));
          if (isLabel && elem.children.length === 0) {
            elem.remove();
            continue;
          }
          // 检查元素的第一个子节点是否是文本标签
          if (elem.firstChild && elem.firstChild.nodeType === Node.TEXT_NODE) {
            const firstText = elem.firstChild.textContent.trim();
            const isFirstChildLabel = labelPatterns.some(pattern => firstText === pattern || firstText.startsWith(pattern + '：') || firstText.startsWith(pattern + ':'));
            if (isFirstChildLabel) {
              elem.firstChild.remove();
            }
          }
        }

        wrapper.appendChild(clone);
      }
    }

    return wrapper.innerHTML;
  }

  function parseSelectionSpec(spec, maxIndex) {
    const set = new Set();
    const s = (spec || '').trim();
    if (!s) return set;

    const tokens = s.split(/[,，\s]+/).map((x) => x.trim()).filter(Boolean);
    for (const tok of tokens) {
      const m = tok.match(/^(\d+)\s*-\s*(\d+)$/);
      if (m) {
        const a = clampInt(parseInt(m[1], 10), 1, maxIndex);
        const b = clampInt(parseInt(m[2], 10), 1, maxIndex);
        const from = Math.min(a, b);
        const to = Math.max(a, b);
        for (let i = from; i <= to; i += 1) set.add(i);
        continue;
      }
      const n = parseInt(tok, 10);
      if (Number.isFinite(n)) set.add(clampInt(n, 1, maxIndex));
    }
    return set;
  }

  /** ========== 6) 方案 C：点击高亮选择（选择模式） ========== */
  const selection = {
    enabled: false,
    rounds: [],
    roundByKey: new Map(),
    turnElsByKey: new Map(),
    selectedKeys: new Set(),
  };

  function isInteractiveTarget(el) {
    return !!el.closest?.('a, button, input, textarea, select, label, details, summary, img, video, audio, [role="button"], [contenteditable="true"], [data-action]');
  }

  function hasTextSelection() {
    const sel = window.getSelection?.();
    const text = (sel && typeof sel.toString === 'function') ? sel.toString() : '';
    return !!text && text.trim().length > 0;
  }

  function getTurnElFromTarget(target) {
    return target.closest?.('article[data-testid^="conversation-turn-"], article[data-turn-id]') || null;
  }

  function clearTurnMarkers() {
    document.querySelectorAll('.cgpt-turn[data-cgpt-selected]').forEach((el) => el.removeAttribute('data-cgpt-selected'));
  }

  function reindexRounds({ keepSelected = true } = {}) {
    selection.rounds = collectRounds();
    selection.roundByKey = new Map(selection.rounds.map((r) => [r.key, r]));
    selection.turnElsByKey = new Map();

    clearTurnMarkers();

    for (const r of selection.rounds) {
      const turnCount = r.turns.length;
      for (let i = 0; i < turnCount; i++) {
        const t = r.turns[i];
        const el = t.el;
        if (!(el instanceof Element)) continue;

        el.classList.add('cgpt-turn');
        el.dataset.cgptRoundKey = r.key;
        el.dataset.cgptRoundIndex = String(r.index);

        // 设置位置标记：first, middle, last, single
        let pos = 'middle';
        if (turnCount === 1) {
          pos = 'single';
        } else if (i === 0) {
          pos = 'first';
        } else if (i === turnCount - 1) {
          pos = 'last';
        }
        el.dataset.cgptPos = pos;

        const arr = selection.turnElsByKey.get(r.key) || [];
        arr.push(el);
        selection.turnElsByKey.set(r.key, arr);
      }
    }

    if (!keepSelected) selection.selectedKeys = new Set();
    applySelectionToDOM();
    syncFab();
  }

  let reindexTimer = null;
  function scheduleReindex() {
    if (!selection.enabled) return;
    if (reindexTimer) return;
    reindexTimer = setTimeout(() => {
      reindexTimer = null;
      reindexRounds({ keepSelected: true });
    }, 250);
  }

  function setRoundSelected(key, selected) {
    const els = selection.turnElsByKey.get(key) || [];
    for (const el of els) {
      if (selected) el.dataset.cgptSelected = '1';
      else el.removeAttribute('data-cgpt-selected');
    }
  }

  function applySelectionToDOM() {
    for (const [key] of selection.turnElsByKey) {
      setRoundSelected(key, selection.selectedKeys.has(key));
    }
  }

  function getSelectedRoundIndices() {
    const indices = [];
    for (const key of selection.selectedKeys) {
      const r = selection.roundByKey.get(key);
      if (r?.index) indices.push(r.index);
    }
    indices.sort((a, b) => a - b);
    return indices;
  }

  function highlightTurn(turnEl) {
    if (!turnEl) return;
    const roundKey = turnEl.dataset.cgptRoundKey;
    if (!roundKey) return;

    try {
      // 滚动到第一个 turn
      const els = selection.turnElsByKey.get(roundKey) || [];
      if (els[0]) els[0].scrollIntoView({ behavior: 'smooth', block: 'center' });

      // 高亮该轮的所有 turn
      els.forEach(el => el.classList.add('cgpt-highlight'));
      setTimeout(() => {
        els.forEach(el => el.classList.remove('cgpt-highlight'));
      }, 900);
    } catch {}
  }

  function toggleRoundByKey(key) {
    if (!key) return;
    if (selection.selectedKeys.has(key)) selection.selectedKeys.delete(key);
    else selection.selectedKeys.add(key);
    setRoundSelected(key, selection.selectedKeys.has(key));
    syncFab();
  }

  function clearSelection() {
    selection.selectedKeys = new Set();
    applySelectionToDOM();
    syncFab();
  }

  function selectAllRounds() {
    selection.selectedKeys = new Set(selection.rounds.map((r) => r.key));
    applySelectionToDOM();
    syncFab();
  }

  function promptRangeSelect() {
    const max = selection.rounds.length || 1;
    const current = getSelectedRoundIndices();
    const hint = current.length ? current.slice(0, 10).join(',') + (current.length > 10 ? '…' : '') : '';
    const spec = prompt(`输入要选择的轮次（最大 ${max}）：\n例如：3-8, 12, 15\n当前选中：${hint || '无'}`, '');
    if (spec == null) return;
    const idxSet = parseSelectionSpec(spec, max);
    const next = new Set();
    for (const r of selection.rounds) if (idxSet.has(r.index)) next.add(r.key);
    selection.selectedKeys = next;
    applySelectionToDOM();
    syncFab();
  }

  async function exportSelected() {
    if (!selection.rounds.length) reindexRounds({ keepSelected: true });
    if (!selection.selectedKeys.size) {
      toast('⚠️ 请先点击对话块进行选择');
      return;
    }

    try {
      const title = await waitForRealTitle();
      const selectedIndices = getSelectedRoundIndices();
      const selectedSet = new Set(selectedIndices);
      const body = buildSelectedBody(selection.rounds, selectedSet);
      const metaLine = `选中 ${selectedIndices.length} 轮：${selectedIndices.join(', ')}`;
      const html = buildHTMLDoc(title, body, metaLine);
      const baseFilename = safeFile(title);

      const dirHandle = await idbGetDirHandle();
      if (dirHandle) {
        const saved = await saveToDefaultDir(baseFilename, html);
        if (!saved) {
          downloadFile(baseFilename + '.html', html);
        }
      } else {
        downloadFile(baseFilename + '.html', html);
        toast('✅ 已触发下载：' + baseFilename);
      }
    } catch (e) {
      console.error('[Export Error]', e);
      toast('❌ 导出失败：' + (e?.message || e));
    }
  }

  function enableSelectMode() {
    selection.enabled = true;
    document.documentElement.classList.add('cgpt-select-mode');
    reindexRounds({ keepSelected: false });
    toast('进入选择模式：点击对话块选中/取消，点“下载选中”导出（Esc 退出）');
  }

  function disableSelectMode() {
    selection.enabled = false;
    document.documentElement.classList.remove('cgpt-select-mode');
    clearTurnMarkers();
    selection.selectedKeys = new Set();
    syncFab();
    toast('已退出选择模式');
  }

  function toggleSelectMode() {
    if (selection.enabled) disableSelectMode();
    else enableSelectMode();
  }

  document.addEventListener('click', (e) => {
    if (!selection.enabled) return;
    const target = e.target;
    if (!(target instanceof Element)) return;
    if (isInteractiveTarget(target)) return;
    if (hasTextSelection()) return;

    const turnEl = getTurnElFromTarget(target);
    if (!turnEl) return;
    const key = turnEl.dataset.cgptRoundKey || '';
    if (!key) {
      reindexRounds({ keepSelected: true });
      return;
    }
    toggleRoundByKey(key);
    highlightTurn(turnEl);
    e.preventDefault();
    e.stopPropagation();
  }, true);

  document.addEventListener('keydown', (e) => {
    if (!selection.enabled) return;
    const ae = document.activeElement;
    const isTyping = !!ae && (
      ae.tagName === 'TEXTAREA' ||
      ae.tagName === 'INPUT' ||
      ae.isContentEditable
    );
    if (isTyping) return;
    if (e.key === 'Escape') return disableSelectMode();
    if (e.key === 'Enter') return void exportSelected();
    if ((e.key === 'a' || e.key === 'A') && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      return selectAllRounds();
    }
  }, true);

  async function syncFab() {
    const btnMode = document.getElementById('cgpt-btn-mode');
    const pill = document.getElementById('cgpt-pill-count');
    const btnAll = document.getElementById('cgpt-btn-all');
    const btnClear = document.getElementById('cgpt-btn-clear');
    const btnRange = document.getElementById('cgpt-btn-range');
    const btnExport = document.getElementById('cgpt-btn-export');
    const btnExportAll = document.getElementById('cgpt-btn-export-all');
    const btnSetDir = document.getElementById('cgpt-btn-set-dir');
    const dirIndicator = document.getElementById('cgpt-dir-indicator');

    const selectedCount = selection.selectedKeys.size;
    const max = selection.rounds.length || 0;
    const hasDir = await idbGetDirHandle().then(h => !!h);

    const sidebar = document.getElementById('cgpt-sidebar');
    if (sidebar) {
      if (selection.enabled) sidebar.classList.add('cgpt-active');
      else sidebar.classList.remove('cgpt-active');
    }

    if (btnMode) {
      btnMode.innerHTML = selection.enabled
        ? '<span class="cgpt-pill-dot"></span> 退出选择'
        : '<span class="cgpt-pill-dot"></span> 选择模式';
    }

    const show = (el, on) => { if (!el) return; el.style.display = on ? '' : 'none'; };

    show(pill, selection.enabled);
    show(btnAll, selection.enabled);
    show(btnClear, selection.enabled);
    show(btnRange, selection.enabled);
    show(btnExport, selection.enabled);
    show(btnExportAll, !selection.enabled);
    show(btnSetDir, !selection.enabled);
    show(dirIndicator, !selection.enabled && hasDir);

    if (pill) pill.innerHTML = `已选 <span class="cgpt-count">${selectedCount}</span> / ${max} 轮`;
    if (btnExport) btnExport.disabled = selectedCount <= 0;
    if (dirIndicator) {
      const folderIcon = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>`;
      dirIndicator.innerHTML = `${folderIcon} 已设默认位置`;
    }
  }

  function toggleSidebar() {
    const sidebar = document.getElementById('cgpt-sidebar');
    if (sidebar) {
      sidebar.classList.toggle('cgpt-collapsed');
    }
  }

  /** ========== 7) 侧边栏入口（自愈挂载） ========== */
  function mountFab() {
    let sidebar = document.getElementById('cgpt-sidebar');
    if (sidebar && document.body.contains(sidebar)) return;

    sidebar = document.createElement('div');
    sidebar.id = 'cgpt-sidebar';
    sidebar.innerHTML = `
      <button id="cgpt-toggle-btn" type="button" title="收起/展开">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
      </button>
      <div id="cgpt-sidebar-content">
        <button id="cgpt-btn-mode" type="button" title="进入/退出选择模式">
          <span class="cgpt-pill-dot"></span>
          <span>选择模式</span>
        </button>

        <span id="cgpt-pill-count" class="cgpt-pill" style="display:none">已选 0 / 0 轮</span>
        <button id="cgpt-btn-all" type="button" title="全选 (Ctrl/Cmd+A)" style="display:none">全选</button>
        <button id="cgpt-btn-range" type="button" title="范围选择（如 3-8, 12）" style="display:none">范围…</button>
        <button id="cgpt-btn-clear" type="button" title="清空选择" style="display:none">清空</button>
        <button id="cgpt-btn-export" class="cgpt-primary" type="button" title="下载选中的对话轮" style="display:none" disabled>下载选中</button>

        <div class="cgpt-divider" style="display:none"></div>

        <button id="cgpt-btn-export-all" type="button" title="导出全部对话" style="display:none">全部导出</button>
        <button id="cgpt-btn-set-dir" type="button" title="设置默认保存位置" style="display:none"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg> 设置位置</button>
        <span id="cgpt-dir-indicator" class="cgpt-pill" style="display:none"></span>
      </div>
    `;
    document.body.appendChild(sidebar);

    document.getElementById('cgpt-toggle-btn').onclick = toggleSidebar;
    document.getElementById('cgpt-btn-mode').onclick = toggleSelectMode;
    document.getElementById('cgpt-btn-all').onclick = () => { if (!selection.enabled) return; selectAllRounds(); };
    document.getElementById('cgpt-btn-range').onclick = () => { if (!selection.enabled) return; promptRangeSelect(); };
    document.getElementById('cgpt-btn-clear').onclick = () => { if (!selection.enabled) return; clearSelection(); };
    document.getElementById('cgpt-btn-export').onclick = () => { if (!selection.enabled) return; void exportSelected(); };
    document.getElementById('cgpt-btn-export-all').onclick = () => { if (selection.enabled) return; void exportAllRounds(); };
    document.getElementById('cgpt-btn-set-dir').onclick = () => { if (selection.enabled) return; void pickAndSaveDefaultDir(); };

    syncFab();
  }

  const mo = new MutationObserver(() => {
    mountFab();
    scheduleReindex();
  });
  mo.observe(document.documentElement, { childList: true, subtree: true });
  mountFab();
})();
