// ==UserScript==
// @name         ChatGPT 导出 HTML
// @namespace    https://github.com/Becomingw/ChatGPT-History-Export
// @version      6.0
// @description  顶部两按钮：保存到默认位置 / 设置默认位置；自动使用<head><title>作为文件标题；自愈挂载。
// @match        https://chat.openai.com/*
// @match        https://chatgpt.com/*
// @run-at       document-idle
// @grant        none
// ==/UserScript==

(function () {
  'use strict';

  /** ========== UI 样式 ========== */
  const styles = `
    #cgpt-bar{position:fixed;top:12px;right:12px;z-index:999999;display:flex;gap:8px;font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto}
    #cgpt-bar button{background:#10a37f;color:#fff;border:none;border-radius:8px;padding:8px 12px;cursor:pointer;box-shadow:0 2px 6px rgba(0,0,0,.2);font-size:14px}
    #cgpt-btn-settings{background:#374151}
    .cgpt-toast{position:fixed;bottom:16px;left:50%;transform:translateX(-50%);background:rgba(0,0,0,.8);color:#fff;padding:8px 12px;border-radius:8px;z-index:999999;font-size:13px}
  `;
  const styleEl = document.createElement('style'); styleEl.textContent = styles; document.documentElement.appendChild(styleEl);

  /** ========== 小工具 ========== */
  const sleep = (ms) => new Promise(r => setTimeout(r, ms));
  const esc = (s) => (s||'').replace(/[&<>"']/g,c=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;' }[c]));
  const toast = (msg) => { const el=document.createElement('div'); el.className='cgpt-toast'; el.textContent=msg; document.body.appendChild(el); setTimeout(()=>el.remove(),1600); };
  const pad2 = n => n<10 ? '0'+n : ''+n;
  const nowStr = () => { const d=new Date(); return `${d.getFullYear()}-${pad2(d.getMonth()+1)}-${pad2(d.getDate())} ${pad2(d.getHours())}:${pad2(d.getMinutes())}`; };
  const safeFile = (s) => (s||'ChatGPT 对话').replace(/[\\/:*?"<>|]+/g,'_').trim() || 'ChatGPT_对话';

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

  /** ========== 2) 采集消息（保留页面 HTML） ========== */
  function collectMessagesHTML() {
    const nodes = document.querySelectorAll('div[data-message-author-role]');
    const parts = [];
    nodes.forEach((n,i)=>{
      const role = n.getAttribute('data-message-author-role');
      const body = n.querySelector('.markdown, .prose, .whitespace-pre-wrap, [class*="markdown"]');
      if (!body) return;
      parts.push(`
        <section class="${role}">
          <h2>${i+1}. ${role==='user'?'👤 用户':(role==='assistant'?'🤖 ChatGPT':role)}</h2>
          <div class="msg-body">${body.innerHTML}</div>
        </section>`);
    });
    return parts.join('\n');
  }

  /** ========== 3) 组装导出 HTML（无脚本） ========== */
  function buildHTMLDoc(title, bodyInner) {
    const css = `
      :root{--fg:#0b1220;--muted:#6b7280;--bg:#fff;--card:#fafafa;--border:#e5e7eb}
      @media (prefers-color-scheme: dark){:root{--fg:#e5e7eb;--muted:#9ca3af;--bg:#0b0f19;--card:#121826;--border:#1f2937}}
      *{box-sizing:border-box} html,body{margin:0;padding:0;background:var(--bg);color:var(--fg);font:14px/1.6 system-ui}
      main{max-width:900px;margin:32px auto;padding:0 20px}
      h1{margin:0 0 8px} .meta{color:var(--muted);margin-bottom:16px} hr{border:0;border-top:1px solid var(--border);margin:16px 0}
      section{background:var(--card);border:1px solid var(--border);border-radius:12px;padding:16px;margin:14px 0}
      .user{border-left:4px solid #10a37f55} .assistant{border-left:4px solid #3b82f655}
      pre{background:#0b1220;color:#e5e7eb;padding:12px;border-radius:8px;overflow:auto}
      code{font-family:ui-monospace,Menlo,Consolas,monospace;font-size:.95em}
      table{border-collapse:collapse;width:100%;margin:10px 0}
      th,td{border:1px solid var(--border);padding:6px 8px;text-align:left}
      img{max-width:100%;height:auto;border-radius:6px}
    `;
    const created = nowStr();
    return `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>${esc(title)}</title>
<style>${css}</style>
</head>
<body>
<main>
  <header>
    <h1>${esc(title)}</h1>
    <div class="meta">导出时间：${created} · 源站：${location.hostname}</div>
    <hr/>
  </header>
  ${bodyInner}
</main>
</body>
</html>`;
  }

  /** ========== 4) IndexedDB 存/取 目录句柄（可跨会话） ========== */
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

  /** ========== 5) 设置默认目录 / 保存到默认目录 ========== */
  async function pickAndSaveDefaultDir() {
    if (!('showDirectoryPicker' in window)) {
      alert('当前浏览器不支持选择文件夹（需要 Chromium 内核新版本）。');
      return;
    }
    try {
      const handle = await window.showDirectoryPicker({ mode: 'readwrite' });
      await idbSetDirHandle(handle);
      toast(`✅ 默认位置已设置：${handle.name}`);
    } catch (e) {
      if (e.name === 'AbortError') toast('已取消选择文件夹'); else alert('设置失败：' + e.message);
    }
  }

  async function saveToDefaultDir(filename, content) {
    const dirHandle = await idbGetDirHandle();
    if (!dirHandle) { toast('请先点击“设置默认位置”'); return false; }
    const ok = await requestRWPermission(dirHandle);
    if (!ok) { toast('无写入权限，请重新设置默认位置'); return false; }

    // 避免覆盖：若重名则自动加 (1) (2) …
    let finalName = filename, idx = 1;
    async function exists(name) {
      try { await dirHandle.getFileHandle(name, { create: false }); return true; }
      catch { return false; }
    }
    while (await exists(finalName) && idx < 100) {
      const dot = filename.lastIndexOf('.');
      if (dot > 0) finalName = filename.slice(0, dot) + ` (${idx})` + filename.slice(dot);
      else finalName = filename + ` (${idx})`;
      idx++;
    }

    const fileHandle = await dirHandle.getFileHandle(finalName, { create: true });
    const w = await fileHandle.createWritable();
    await w.write(new Blob([content], { type: 'text/html' }));
    await w.close();
    toast(`✅ 已保存到默认位置：${finalName}`);
    return true;
  }

  /** ========== 6) 导出流程（保存按钮点击） ========== */
  async function handleSaveClick() {
    try {
      const title = await waitForRealTitle();
      const body = collectMessagesHTML();
      const html = buildHTMLDoc(title, body);
      const filename = safeFile(title) + '.html';
      const ok = await saveToDefaultDir(filename, html);
      if (!ok) return; // 未设置或无权限
    } catch (e) {
      console.error('[Export Error]', e);
      alert('❌ 导出失败：' + (e?.message || e));
    }
  }

  /** ========== 7) 顶部“保存 / 设置”双按钮（自愈挂载） ========== */
  function mountBar() {
    let bar = document.getElementById('cgpt-bar');
    if (bar && document.body.contains(bar)) return;

    bar = document.createElement('div');
    bar.id = 'cgpt-bar';
    bar.innerHTML = `
      <button id="cgpt-btn-save" title="一键导出到默认位置">💾 保存到默认位置</button>
      <button id="cgpt-btn-settings" title="选择/更改默认保存文件夹">⚙️ 设置默认位置</button>
    `;
    document.body.appendChild(bar);

    document.getElementById('cgpt-btn-save').onclick = handleSaveClick;
    document.getElementById('cgpt-btn-settings').onclick = pickAndSaveDefaultDir;
  }

  const mo = new MutationObserver(() => mountBar());
  mo.observe(document.documentElement, { childList: true, subtree: true });
  mountBar();
})();
