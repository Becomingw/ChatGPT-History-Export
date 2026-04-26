// ==UserScript==
// @name         ChatGPT 选择性导出 HTML
// @namespace    https://github.com/Becomingw/ChatGPT-History-Export
// @version      10.0
// @description  选择要导出的对话轮，兼容新版 ChatGPT section 结构；支持保存到默认位置或直接下载；CSS 内联化、图片自包含、离线可用。
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

    /* v10 UI refinement: compact tool panel, stable overlays, no layout shift */
    :root{
      --cgpt-accent:#0f8f73;
      --cgpt-accent-hover:#0b735d;
      --cgpt-accent-soft:rgba(15,143,115,.12);
      --cgpt-accent-softer:rgba(15,143,115,.07);
      --cgpt-panel:rgba(255,255,255,.94);
      --cgpt-panel-strong:rgba(255,255,255,.99);
      --cgpt-line:rgba(15,23,42,.13);
      --cgpt-line-strong:rgba(15,23,42,.22);
      --cgpt-select-outline:rgba(15,143,115,.42);
      --cgpt-select-outline-strong:rgba(15,143,115,.9);
      --cgpt-select-bg:rgba(15,143,115,.075);
      --cgpt-select-hover:rgba(15,143,115,.045);
      --cgpt-radius:14px;
    }
    @media (prefers-color-scheme: dark){
      :root{
        --cgpt-accent:#33c39a;
        --cgpt-accent-hover:#44d2aa;
        --cgpt-accent-soft:rgba(51,195,154,.16);
        --cgpt-accent-softer:rgba(51,195,154,.09);
        --cgpt-panel:rgba(17,24,39,.92);
        --cgpt-panel-strong:rgba(24,32,48,.98);
        --cgpt-line:rgba(255,255,255,.13);
        --cgpt-line-strong:rgba(255,255,255,.24);
        --cgpt-select-outline:rgba(51,195,154,.42);
        --cgpt-select-outline-strong:rgba(51,195,154,.95);
        --cgpt-select-bg:rgba(51,195,154,.105);
        --cgpt-select-hover:rgba(51,195,154,.06);
      }
    }
    #cgpt-sidebar{
      top:16px;right:16px;bottom:16px;height:auto;width:304px;
      color:var(--cgpt-fg);
      font-family:ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;
      transition:transform .28s cubic-bezier(.16,1,.3,1), opacity .18s ease
    }
    #cgpt-sidebar.cgpt-collapsed{
      transform:translateX(calc(100% + 18px))
    }
    #cgpt-sidebar-content{
      min-height:300px;max-height:calc(100vh - 32px);
      background:var(--cgpt-panel);
      border:1px solid var(--cgpt-line);
      border-radius:var(--cgpt-radius);
      padding:14px;
      gap:12px;
      overscroll-behavior:contain
    }
    #cgpt-toggle-btn{
      left:-44px;width:36px;height:44px;
      border-radius:10px 0 0 10px;
      background:var(--cgpt-panel);
      border-color:var(--cgpt-line);
      color:var(--cgpt-muted);
      box-shadow:0 10px 28px rgba(15,23,42,.12);
      transition:background .16s ease,color .16s ease,transform .28s cubic-bezier(.16,1,.3,1)
    }
    #cgpt-toggle-btn:hover{
      background:var(--cgpt-panel-strong);
      color:var(--cgpt-fg)
    }
    #cgpt-toggle-btn svg{width:18px;height:18px}
    .cgpt-panel-head{
      display:flex;align-items:flex-start;justify-content:space-between;gap:12px;
      padding:2px 2px 0
    }
    .cgpt-kicker{
      margin-bottom:3px;color:var(--cgpt-muted);
      font-size:10px;font-weight:700;letter-spacing:.08em;text-transform:uppercase
    }
    .cgpt-title{
      color:var(--cgpt-fg);font-size:16px;font-weight:700;line-height:1.25;letter-spacing:0
    }
    .cgpt-chip{
      flex:0 0 auto;border:1px solid var(--cgpt-line);
      border-radius:999px;padding:5px 8px;
      color:var(--cgpt-muted);background:rgba(127,127,127,.06);
      font-size:11px;font-weight:650;line-height:1
    }
    #cgpt-sidebar.cgpt-active .cgpt-chip{
      color:var(--cgpt-accent);
      border-color:var(--cgpt-select-outline);
      background:var(--cgpt-accent-soft)
    }
    .cgpt-tools{display:flex;flex-direction:column;gap:8px}
    .cgpt-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px}
    .cgpt-hint{
      border:1px solid var(--cgpt-line);
      border-radius:12px;
      padding:10px 11px;
      background:rgba(127,127,127,.055);
      color:var(--cgpt-muted);
      font-size:12px;line-height:1.45
    }
    #cgpt-sidebar-content button{
      border-color:var(--cgpt-line);
      background:rgba(127,127,127,.055);
      border-radius:10px;
      padding:10px 11px;
      min-height:40px;
      font-size:13px;font-weight:650;line-height:1.15;
      transition:background .15s ease,border-color .15s ease,transform .08s ease,opacity .15s ease
    }
    #cgpt-sidebar-content button:hover{
      background:var(--cgpt-accent-softer);
      border-color:var(--cgpt-accent)
    }
    #cgpt-sidebar-content button:disabled{
      border-color:var(--cgpt-line);
      background:rgba(127,127,127,.045)
    }
    #cgpt-sidebar-content button.cgpt-quiet{background:transparent}
    .cgpt-btn-label{min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .cgpt-icon{flex:0 0 auto;width:16px;height:16px}
    #cgpt-sidebar-content .cgpt-pill{
      background:var(--cgpt-accent-softer);
      border-color:var(--cgpt-line);
      color:var(--cgpt-fg);
      justify-content:space-between;
      font-weight:650
    }
    html.cgpt-select-mode .cgpt-turn[data-cgpt-pos]{
      border:0!important;
      border-radius:0!important;
      padding-top:0!important;
      padding-bottom:0!important
    }
    html.cgpt-select-mode .cgpt-turn{
      position:relative!important;
      isolation:isolate;
      transition:background-color .15s ease,filter .15s ease
    }
    html.cgpt-select-mode .cgpt-turn::after{
      content:"";
      position:absolute;
      inset:4px 12px;
      pointer-events:none;
      z-index:2;
      border:2px solid transparent;
      border-radius:14px
    }
    html.cgpt-select-mode .cgpt-turn::before{
      content:attr(data-cgpt-round-index);
      position:absolute;
      top:12px;left:14px;
      width:24px;height:24px;
      border-radius:999px;
      display:flex;align-items:center;justify-content:center;
      pointer-events:none;
      z-index:3;
      color:var(--cgpt-accent);
      background:var(--cgpt-panel-strong);
      border:1px solid var(--cgpt-select-outline);
      box-shadow:0 8px 24px rgba(15,23,42,.14);
      font-size:12px;font-weight:800;line-height:1
    }
    html.cgpt-select-mode .cgpt-turn:not([data-cgpt-pos="first"]):not([data-cgpt-pos="single"])::before{
      display:none
    }
    html.cgpt-select-mode .cgpt-turn:hover{background:var(--cgpt-select-hover)}
    html.cgpt-select-mode .cgpt-turn[data-cgpt-pos="first"]::after{
      border-color:var(--cgpt-select-outline);
      border-bottom-color:transparent;
      border-radius:14px 14px 0 0
    }
    html.cgpt-select-mode .cgpt-turn[data-cgpt-pos="middle"]::after{
      border-left-color:var(--cgpt-select-outline);
      border-right-color:var(--cgpt-select-outline);
      border-radius:0
    }
    html.cgpt-select-mode .cgpt-turn[data-cgpt-pos="last"]::after{
      border-color:var(--cgpt-select-outline);
      border-top-color:transparent;
      border-radius:0 0 14px 14px
    }
    html.cgpt-select-mode .cgpt-turn[data-cgpt-pos="single"]::after{
      border-color:var(--cgpt-select-outline)
    }
    html.cgpt-select-mode .cgpt-turn[data-cgpt-selected="1"]{
      background:var(--cgpt-select-bg)
    }
    html.cgpt-select-mode .cgpt-turn[data-cgpt-selected="1"]::before{
      content:"✓";
      color:#fff;
      background:var(--cgpt-accent);
      border-color:var(--cgpt-accent)
    }
    html.cgpt-select-mode .cgpt-turn[data-cgpt-selected="1"][data-cgpt-pos="first"]::after{
      border-color:var(--cgpt-select-outline-strong);
      border-bottom-color:transparent
    }
    html.cgpt-select-mode .cgpt-turn[data-cgpt-selected="1"][data-cgpt-pos="middle"]::after{
      border-left-color:var(--cgpt-select-outline-strong);
      border-right-color:var(--cgpt-select-outline-strong)
    }
    html.cgpt-select-mode .cgpt-turn[data-cgpt-selected="1"][data-cgpt-pos="last"]::after{
      border-color:var(--cgpt-select-outline-strong);
      border-top-color:transparent
    }
    html.cgpt-select-mode .cgpt-turn[data-cgpt-selected="1"][data-cgpt-pos="single"]::after{
      border-color:var(--cgpt-select-outline-strong)
    }
    @media (max-width:720px){
      #cgpt-sidebar{
        top:12px;right:12px;bottom:auto;
        width:min(316px,calc(100vw - 24px));
        max-height:calc(100vh - 24px)
      }
      #cgpt-sidebar-content{max-height:calc(100vh - 24px)}
      #cgpt-toggle-btn{top:18px;transform:none}
    }
    @media (prefers-reduced-motion: reduce){
      #cgpt-sidebar,#cgpt-toggle-btn,#cgpt-toggle-btn svg,
      #cgpt-sidebar-content button,.cgpt-toast{
        transition:none!important
      }
      #cgpt-sidebar-content .cgpt-pill-dot{animation:none}
      .cgpt-highlight{animation:none}
    }

    .cgpt-range-panel{
      position:fixed;
      top:22px;
      right:336px;
      z-index:10000000;
      width:min(390px,calc(100vw - 32px));
      color:var(--cgpt-fg);
      font-family:ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;
      pointer-events:auto
    }
    .cgpt-range-card{
      background:var(--cgpt-panel);
      border:1px solid var(--cgpt-line);
      border-radius:16px;
      box-shadow:var(--cgpt-shadow);
      backdrop-filter:saturate(180%) blur(20px);
      -webkit-backdrop-filter:saturate(180%) blur(20px);
      padding:14px;
      display:flex;
      flex-direction:column;
      gap:12px
    }
    .cgpt-range-card button{
      appearance:none;border:1px solid var(--cgpt-line);
      background:rgba(127,127,127,.055);color:var(--cgpt-fg);
      border-radius:10px;padding:10px 11px;
      cursor:pointer;
      min-height:40px;
      display:flex;align-items:center;justify-content:center;gap:8px;
      font:inherit;font-size:13px;font-weight:650;line-height:1.15;
      transition:background .15s ease,border-color .15s ease,transform .08s ease,opacity .15s ease
    }
    .cgpt-range-card button:hover{
      background:var(--cgpt-accent-softer);
      border-color:var(--cgpt-accent)
    }
    .cgpt-range-card button:active{transform:scale(.98)}
    .cgpt-range-card button:disabled{
      opacity:.5;cursor:not-allowed;transform:none;
      border-color:var(--cgpt-line);
      background:rgba(127,127,127,.045)
    }
    .cgpt-range-card button.cgpt-primary{
      background:var(--cgpt-accent);
      color:#fff;
      border-color:var(--cgpt-accent)
    }
    .cgpt-range-card button.cgpt-primary:hover{background:var(--cgpt-accent-hover)}
    .cgpt-range-card button.cgpt-quiet{background:transparent}
    .cgpt-range-head{
      display:flex;align-items:flex-start;justify-content:space-between;gap:12px
    }
    .cgpt-range-title{
      font-size:15px;font-weight:750;line-height:1.25
    }
    .cgpt-range-sub{
      margin-top:3px;color:var(--cgpt-muted);font-size:12px;line-height:1.35
    }
    .cgpt-range-close{
      width:30px!important;height:30px!important;min-height:30px!important;
      padding:0!important;justify-content:center!important;border-radius:9px!important
    }
    .cgpt-range-segment{
      display:grid;grid-template-columns:repeat(3,1fr);gap:6px;
      padding:4px;border:1px solid var(--cgpt-line);border-radius:12px;
      background:rgba(127,127,127,.04)
    }
    #cgpt-sidebar-content .cgpt-range-segment button,
    .cgpt-range-segment button{
      min-height:32px;padding:7px 8px;border-radius:9px;
      justify-content:center;font-size:12px;background:transparent
    }
    .cgpt-range-segment button[aria-pressed="true"]{
      color:#fff;background:var(--cgpt-accent);border-color:var(--cgpt-accent)
    }
    .cgpt-range-field{
      display:flex;flex-direction:column;gap:7px
    }
    .cgpt-range-label{
      color:var(--cgpt-muted);font-size:12px;font-weight:650
    }
    .cgpt-range-input{
      width:100%;border:1px solid var(--cgpt-line);border-radius:11px;
      background:rgba(127,127,127,.055);color:var(--cgpt-fg);
      padding:11px 12px;font:inherit;font-size:13px;line-height:1.3;outline:none
    }
    .cgpt-range-input:focus{
      border-color:var(--cgpt-accent);
      box-shadow:0 0 0 3px var(--cgpt-accent-soft)
    }
    .cgpt-range-quick{
      display:flex;flex-wrap:wrap;gap:6px
    }
    .cgpt-range-quick button{
      width:auto!important;min-height:30px!important;padding:6px 9px!important;
      border-radius:999px!important;font-size:12px!important;background:rgba(127,127,127,.055)!important
    }
    .cgpt-range-preview{
      min-height:42px;border:1px solid var(--cgpt-line);border-radius:12px;
      background:rgba(127,127,127,.04);
      padding:9px 10px;color:var(--cgpt-muted);
      font-size:12px;line-height:1.45
    }
    .cgpt-range-preview strong{color:var(--cgpt-accent)}
    .cgpt-range-preview.cgpt-error{
      color:#b42318;border-color:rgba(180,35,24,.35);background:rgba(180,35,24,.07)
    }
    .cgpt-range-actions{
      display:grid;grid-template-columns:1fr 1fr;gap:8px
    }
    @media (prefers-color-scheme: dark){
      .cgpt-range-preview.cgpt-error{
        color:#fca5a5;border-color:rgba(248,113,113,.35);background:rgba(248,113,113,.1)
      }
    }
    @media (max-width:860px){
      .cgpt-range-panel{
        top:14px;right:12px;left:12px;width:auto
      }
    }
  `;
  const styleEl = document.createElement('style');
  styleEl.id = 'cgpt-userscript-style';
  styleEl.textContent = styles;
  document.documentElement.appendChild(styleEl);

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
  const TURN_ROOT_SELECTOR = [
    '[data-testid^="conversation-turn-"][data-turn-id]',
    '[data-testid^="conversation-turn-"]',
    'article[data-turn-id]',
    'section[data-turn-id][data-turn]',
    '[data-turn-id][data-turn]',
  ].join(',');
  const MESSAGE_SELECTOR = '[data-message-author-role]';

  const uniqueElementsInDocOrder = (els) => {
    const seen = new Set();
    return els
      .filter((el) => {
        if (!(el instanceof Element) || seen.has(el)) return false;
        seen.add(el);
        return true;
      })
      .sort((a, b) => {
        if (a === b) return 0;
        return a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_PRECEDING ? 1 : -1;
      });
  };

  /** ========== 1.5) 样式收集与资源处理 ========== */

  // 判断是否为浏览器扩展注入的样式元素
  function isExtensionStyle(el) {
    if (!el) return false;
    const text = [el.id, el.getAttribute?.('data-id'), el.href, el.className,
      (el.textContent || '').slice(0, 300)].filter(Boolean).join(' ').toLowerCase();
    return /cgpt-userscript-style|immersive.?translate|grammarly|dark.?reader|lastpass|bitwarden|1password|extension:\/\/|chrome-extension:\/\/|moz-extension:\/\//.test(text.replace(/\s+/g, ''));
  }

  // 收集所有必要的 CSS 并内联为字符串
  async function collectInlineCSS() {
    const parts = [];
    const seen = new Set();

    for (const el of document.querySelectorAll('style, link[rel="stylesheet"]')) {
      if (isExtensionStyle(el)) continue;

      if (el.tagName === 'STYLE') {
        const text = (el.textContent || '').trim();
        if (text && !seen.has(text.slice(0, 100))) {
          seen.add(text.slice(0, 100));
          parts.push(text);
        }
      } else if (el.tagName === 'LINK' && el.href) {
        // 尝试从 document.styleSheets 读取 cssRules
        let inlined = false;
        try {
          for (const sheet of document.styleSheets) {
            if (sheet.href === el.href && sheet.cssRules) {
              const rules = Array.from(sheet.cssRules).map(r => r.cssText).join('\n');
              if (rules) { parts.push(rules); inlined = true; }
              break;
            }
          }
        } catch {}

        // 降级：通过 fetch 获取 CSS 文件内容
        if (!inlined && (el.href.startsWith(location.origin) || el.href.startsWith('https://chatgpt.com'))) {
          try {
            const resp = await fetch(el.href, { credentials: 'omit' });
            if (resp.ok) {
              const text = await resp.text();
              if (text) parts.push(text);
            }
          } catch {}
        }
      }
    }

    return parts.join('\n');
  }

  // 将 img 元素转为 data URI（带超时保护）
  async function convertImageToDataURI(img) {
    if (!img || !img.src || img.src.startsWith('data:')) return;

    const timeoutMs = 3000;
    const doConvert = async () => {
      // 方式 1：canvas 绘制（同源或已加载的图片）
      try {
        if (img.naturalWidth > 0 && img.complete) {
          const canvas = document.createElement('canvas');
          canvas.width = img.naturalWidth;
          canvas.height = img.naturalHeight;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0);
          img.src = canvas.toDataURL('image/png');
          return;
        }
      } catch {}

      // 方式 2：fetch + blob
      try {
        const resp = await fetch(img.src, { credentials: 'omit' });
        if (!resp.ok) return;
        const blob = await resp.blob();
        const dataURI = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result);
          reader.onerror = reject;
          reader.readAsDataURL(blob);
        });
        img.src = dataURI;
      } catch {}
    };

    // 超时保护
    await Promise.race([
      doConvert(),
      new Promise(resolve => setTimeout(resolve, timeoutMs)),
    ]);
  }

  // 深度清理克隆的元素（移除交互、SVG sprite、无用属性等）
  function deepCleanElement(clone) {
    // 移除 <script> 标签
    clone.querySelectorAll('script').forEach(el => el.remove());

    // 移除交互控件；带媒体内容的 role=button 容器只去交互属性，避免误删图片。
    clone.querySelectorAll(
      'button, textarea, input, select, form, [data-action], [data-trailing-button]'
    ).forEach(el => el.remove());
    clone.querySelectorAll('[role="button"]').forEach(el => {
      const hasContent = !!el.querySelector('img, picture, video, canvas, .markdown, .prose, pre, table, [data-message-author-role]')
        || stripTurnChromeText(el.textContent || '').length > 20;
      if (hasContent) {
        el.removeAttribute('role');
        el.removeAttribute('tabindex');
        el.removeAttribute('aria-label');
      } else {
        el.remove();
      }
    });

    // 移除引用 CDN sprite 的 SVG（离线无法加载）
    clone.querySelectorAll('svg').forEach(svg => {
      const uses = svg.querySelectorAll('use[href*="/cdn/"], use[xlink\\:href*="/cdn/"]');
      if (uses.length > 0) svg.remove();
    });

    // 移除导航/侧边栏相关元素（不应出现在导出中）
    clone.querySelectorAll('nav, [data-sidebar-item], [id*="sidebar"]').forEach(el => el.remove());

    // 清理无用 data 属性
    const cleanAttrs = [
      'data-cgpt-selected', 'data-cgpt-round-key', 'data-cgpt-round-index', 'data-cgpt-pos',
      'data-testid', 'data-state', 'data-discover', 'data-sidebar-item', 'data-revealed',
      'draggable', 'data-trailing-button', 'data-skip-to-content', 'inert',
    ];
    for (const attr of cleanAttrs) {
      clone.querySelectorAll(`[${attr}]`).forEach(el => el.removeAttribute(attr));
      if (clone.hasAttribute?.(attr)) clone.removeAttribute(attr);
    }

    // 移除选择模式相关类
    clone.classList?.remove('cgpt-turn', 'cgpt-highlight');

    // 移除空容器（清理后残留的空 div）
    clone.querySelectorAll('.trailing, .trailing-pair').forEach(el => {
      if (!el.textContent?.trim() && !el.querySelector('img')) el.remove();
    });

    return clone;
  }

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
  function normalizeSnippet(s, maxLen = 120) {
    const t = (s || '').replace(/\s+/g, ' ').trim();
    if (!t) return '';
    return t.length > maxLen ? t.slice(0, maxLen - 1) + '…' : t;
  }

  function stripTurnChromeText(s) {
    return (s || '')
      .replace(/^(你说|ChatGPT 说|You said|ChatGPT said)\s*[:：]?/i, '')
      .replace(/\b(复制消息|复制回复|编辑消息|更多操作|分享此图片|编辑图片)\b/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function getTurnRootFromMessage(messageEl) {
    if (!(messageEl instanceof Element)) return null;
    return messageEl.closest(TURN_ROOT_SELECTOR)
      || messageEl.closest('article, section')
      || messageEl;
  }

  function hasTurnContent(turnEl) {
    if (!(turnEl instanceof Element)) return false;
    if (turnEl.closest('#cgpt-sidebar')) return false;

    const contentSignal = turnEl.querySelector?.([
      MESSAGE_SELECTOR,
      '.markdown',
      '.prose',
      '.whitespace-pre-wrap',
      '[class*="markdown"]',
      'pre',
      'table',
      'img',
      'picture',
      'video',
      'canvas',
      '[data-writing-block]',
    ].join(','));
    if (contentSignal) return true;

    return stripTurnChromeText(turnEl.textContent || '').length > 4;
  }

  function getTurnElements() {
    const candidates = [
      ...Array.from(document.querySelectorAll(TURN_ROOT_SELECTOR)),
      ...Array.from(document.querySelectorAll(MESSAGE_SELECTOR)).map(getTurnRootFromMessage),
    ].filter(Boolean);

    return uniqueElementsInDocOrder(candidates).filter(hasTurnContent);
  }

  function getTurnRole(turnEl) {
    const byTurn = (turnEl.getAttribute && turnEl.getAttribute('data-turn')) || '';
    if (/^(user|assistant|tool|system)$/i.test(byTurn)) return byTurn.toLowerCase();

    const msg = turnEl.matches?.(MESSAGE_SELECTOR) ? turnEl : turnEl.querySelector?.(MESSAGE_SELECTOR);
    const byMessage = msg?.getAttribute?.('data-message-author-role') || '';
    if (byMessage) return byMessage.toLowerCase();

    if (turnEl.querySelector?.('.agent-turn')) return 'assistant';
    if (turnEl.querySelector?.('.user-message-bubble-color')) return 'user';
    return 'unknown';
  }

  function getTurnContentEl(turnEl) {
    const msg = turnEl.matches?.(MESSAGE_SELECTOR) ? turnEl : (turnEl.querySelector?.(MESSAGE_SELECTOR) || turnEl);
    return msg.querySelector?.('.markdown, .prose, .whitespace-pre-wrap, [class*="markdown"], img, picture, video, canvas') || msg;
  }

  function collectRounds() {
    const turnEls = getTurnElements();
    const turns = turnEls.map((el) => {
      const role = getTurnRole(el);
      const contentEl = getTurnContentEl(el);
      const text = normalizeSnippet(stripTurnChromeText(contentEl.textContent || ''), 220);
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

  /** ========== 3) 组装导出 HTML（使用内联样式，离线可用） ========== */
  async function buildHTMLDoc(title, bodyInner, metaLine) {
    toast('正在收集样式…');

    // 收集并内联所有 CSS
    let inlinedCSS = '';
    try {
      inlinedCSS = await collectInlineCSS();
    } catch (e) {
      console.warn('[CSS Collect Error]', e);
    }

    // 提取关键 CSS 变量和基础样式
    const computedStyle = getComputedStyle(document.documentElement);
    const bgColor = computedStyle.getPropertyValue('--bg-primary') || computedStyle.backgroundColor || '#ffffff';
    const textColor = computedStyle.getPropertyValue('--text-primary') || computedStyle.color || '#000000';
    const fontFamily = computedStyle.fontFamily || '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';

    // 获取当前主题类（light/dark）
    const htmlEl = document.documentElement;
    const themeClass = htmlEl.classList.contains('dark') ? 'dark' : 'light';
    const colorScheme = htmlEl.style.colorScheme || themeClass;
    const chatTheme = htmlEl.dataset.chatTheme || '';

    // 降级 CSS：即使原始 CSS 未加载也能保证基本可读性
    const fallbackCSS = `
      /* ===== 导出降级样式 ===== */
      *{box-sizing:border-box}
      body{
        margin:0;padding:0;
        background:${bgColor};color:${textColor};
        font-family:${fontFamily};line-height:1.6
      }
      /* 隐藏不需要的页面结构 */
      [id*="sidebar"],nav,[data-sidebar-item],
      .fixed,[class*="sidebar"],[id="stage-slideover-sidebar"]{
        display:none!important
      }
      /* 导出头部 */
      .export-header{
        max-width:48rem;margin:0 auto 30px;padding:20px;
        border-radius:12px;border:1px solid rgba(128,128,128,.15)
      }
      .export-header h1{margin:0 0 10px;font-size:24px;font-weight:600}
      .export-meta{font-size:13px;opacity:.7;margin-top:8px}
      .export-legend{
        max-width:48rem;margin:0 auto 20px;
        display:flex;align-items:center;gap:16px;
        padding:12px 16px;background:rgba(128,128,128,.06);
        border-radius:8px;font-size:13px
      }
      .export-legend-item{display:flex;align-items:center;gap:8px}
      .export-legend-color{width:20px;height:20px;border-radius:4px;border:1px solid rgba(128,128,128,.15)}
      .export-legend-user .export-legend-color{background:rgba(16,163,127,.12)}
      .export-legend-assistant .export-legend-color{background:rgba(66,133,244,.12)}
      /* 对话轮样式 */
      .cgpt-export-turn[data-message-author-role="user"]{background:rgba(16,163,127,.06);border-radius:12px;padding:16px;margin-bottom:24px}
      .cgpt-export-turn[data-message-author-role="assistant"]{background:rgba(66,133,244,.06);border-radius:12px;padding:16px;margin-bottom:24px}
      .cgpt-export-turn{margin-bottom:24px}
      /* 代码块降级样式 */
      pre{background:rgba(0,0,0,.05);border-radius:8px;padding:16px;overflow-x:auto;font-size:14px;line-height:1.5}
      code{font-family:'Menlo','Monaco','Consolas','Courier New',monospace;font-size:.875em}
      pre code{font-size:inherit;background:none;padding:0}
      :not(pre)>code{background:rgba(0,0,0,.06);padding:2px 6px;border-radius:4px}
      /* Markdown 表格 */
      table{border-collapse:collapse;width:100%;margin:16px 0}
      th,td{border:1px solid rgba(128,128,128,.2);padding:8px 12px;text-align:left}
      th{background:rgba(128,128,128,.06);font-weight:600}
      /* Markdown 引用 */
      blockquote{margin:16px 0;padding:8px 16px;border-left:4px solid rgba(16,163,127,.4);background:rgba(128,128,128,.04)}
      /* 图片 */
      img{max-width:100%;height:auto;border-radius:8px}
      /* 数学公式容器 */
      .katex-display{overflow-x:auto;padding:8px 0}
      /* 打印优化 */
      @media print{
        body{padding:0}
        .cgpt-export-turn{break-inside:avoid}
        pre{white-space:pre-wrap;word-break:break-all}
        .export-legend{break-inside:avoid}
      }
    `;

    const created = nowStr();
    return `<!doctype html>
<html lang="zh-CN" class="${esc(themeClass)}"${chatTheme ? ` data-chat-theme="${esc(chatTheme)}"` : ''} style="color-scheme:${esc(colorScheme)}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)}</title>
<meta name="generator" content="ChatGPT History Export v10.0">
<meta name="exported-at" content="${created}">
<!-- 原始页面样式（已内联） -->
<style>
${inlinedCSS}
</style>
<!-- 导出降级样式 -->
<style>
${fallbackCSS}
</style>
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
  let cachedDirHandle = null;
  let cachedDirHandleReady = false;

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
    cachedDirHandle = handle || null;
    cachedDirHandleReady = true;
  }
  async function idbGetDirHandle() {
    if (cachedDirHandleReady) return cachedDirHandle;
    const db = await idb();
    const handle = await new Promise((res, rej) => {
      const tx = db.transaction(STORE, 'readonly');
      const req = tx.objectStore(STORE).get(KEY);
      req.onsuccess = () => res(req.result || null);
      req.onerror = () => rej(req.error);
    });
    db.close();
    cachedDirHandle = handle || null;
    cachedDirHandleReady = true;
    return cachedDirHandle;
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
      const selectedKeySet = new Set(rounds.map(r => r.key));
      const body = await buildSelectedBody(rounds, selectedKeySet);
      const metaLine = `当前已渲染 ${rounds.length} 轮`;
      const html = await buildHTMLDoc(title, body, metaLine);
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

  /** ========== 5) 组装选中轮的 HTML（深度清理 + 图片自包含） ========== */
  async function buildSelectedBody(rounds, selectedKeySet) {
    const wrapper = document.createElement('div');

    for (const r of rounds) {
      if (!selectedKeySet.has(r.key)) continue;
      for (const t of r.turns) {
        const el = t.el;
        if (!(el instanceof Element)) continue;

        // 克隆原始元素，保留所有样式和结构
        const clone = el.cloneNode(true);

        // 深度清理：移除交互元素、SVG sprites、无用属性等
        deepCleanElement(clone);

        // 将 role 属性复制到导出根节点上（用于背景色样式）
        clone.classList.add('cgpt-export-turn');
        clone.setAttribute('data-message-author-role', t.role);

        // 移除 ChatGPT 的辅助朗读标签（如“你说：”“ChatGPT 说：”）
        clone.querySelectorAll('h4.sr-only, .sr-only.select-none').forEach((elem) => {
          const text = (elem.textContent || '').trim();
          if (/^(你说|ChatGPT 说|You said|ChatGPT said)\s*[:：]?$/i.test(text)) elem.remove();
        });

        wrapper.appendChild(clone);
      }
    }

    // 将图片转为 data URI，使导出文件完全自包含
    const images = wrapper.querySelectorAll('img');
    if (images.length > 0) {
      toast(`正在处理 ${images.length} 张图片…`);
      await Promise.all(Array.from(images).map(img => convertImageToDataURI(img)));
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

  function parseRangeSpecDetailed(spec, maxIndex) {
    const set = new Set();
    const errors = [];
    const s = (spec || '').trim();
    if (!s) return { set, errors: ['请输入轮次范围'] };

    const tokens = s.split(/[,，\s]+/).map((x) => x.trim()).filter(Boolean);
    for (const tok of tokens) {
      if (/^(all|全部|\*)$/i.test(tok)) {
        for (let i = 1; i <= maxIndex; i += 1) set.add(i);
        continue;
      }
      if (/^(odd|奇数)$/i.test(tok)) {
        for (let i = 1; i <= maxIndex; i += 2) set.add(i);
        continue;
      }
      if (/^(even|偶数)$/i.test(tok)) {
        for (let i = 2; i <= maxIndex; i += 2) set.add(i);
        continue;
      }

      const range = tok.match(/^(\d+)\s*-\s*(\d+)$/);
      if (range) {
        const a = parseInt(range[1], 10);
        const b = parseInt(range[2], 10);
        if (a < 1 || b < 1 || a > maxIndex || b > maxIndex) {
          errors.push(`范围 ${tok} 超出 1-${maxIndex}`);
          continue;
        }
        const from = Math.min(a, b);
        const to = Math.max(a, b);
        for (let i = from; i <= to; i += 1) set.add(i);
        continue;
      }

      const n = parseInt(tok, 10);
      if (String(n) === tok && Number.isFinite(n)) {
        if (n < 1 || n > maxIndex) errors.push(`轮次 ${tok} 超出 1-${maxIndex}`);
        else set.add(n);
        continue;
      }

      errors.push(`无法识别：${tok}`);
    }

    if (!errors.length && !set.size) errors.push('没有匹配到任何轮次');
    return { set, errors };
  }

  function compactIndices(indices, maxItems = 22) {
    const list = Array.from(new Set(indices)).sort((a, b) => a - b);
    if (!list.length) return '无';

    const ranges = [];
    let start = list[0];
    let prev = list[0];
    for (let i = 1; i <= list.length; i += 1) {
      const n = list[i];
      if (n === prev + 1) {
        prev = n;
        continue;
      }
      ranges.push(start === prev ? String(start) : `${start}-${prev}`);
      start = n;
      prev = n;
    }

    const text = ranges.join(', ');
    return ranges.length > maxItems ? ranges.slice(0, maxItems).join(', ') + '…' : text;
  }

  function keysFromIndexSet(indexSet) {
    const keys = new Set();
    for (const r of selection.rounds) {
      if (indexSet.has(r.index)) keys.add(r.key);
    }
    return keys;
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
    return !!el.closest?.('a, button, input, textarea, select, label, details, summary, [contenteditable="true"], [data-action]');
  }

  function hasTextSelection() {
    const sel = window.getSelection?.();
    const text = (sel && typeof sel.toString === 'function') ? sel.toString() : '';
    return !!text && text.trim().length > 0;
  }

  function getTurnElFromTarget(target) {
    return target.closest?.('.cgpt-turn')
      || target.closest?.(TURN_ROOT_SELECTOR)
      || getTurnRootFromMessage(target.closest?.(MESSAGE_SELECTOR));
  }

  function clearTurnMarkers() {
    document.querySelectorAll('.cgpt-turn').forEach((el) => {
      el.classList.remove('cgpt-turn', 'cgpt-highlight');
      el.removeAttribute('data-cgpt-selected');
      el.removeAttribute('data-cgpt-round-key');
      el.removeAttribute('data-cgpt-round-index');
      el.removeAttribute('data-cgpt-pos');
    });
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

    if (!keepSelected) {
      selection.selectedKeys = new Set();
    }
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

  function getExportableSelectedKeys() {
    return new Set([...selection.selectedKeys].filter((key) => selection.roundByKey.has(key)));
  }

  function highlightTurn(turnEl) {
    if (!turnEl) return;
    const roundKey = turnEl.dataset.cgptRoundKey;
    if (!roundKey) return;

    try {
      const els = selection.turnElsByKey.get(roundKey) || [];
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

  const rangePanelState = { mode: 'replace' };

  function ensureRangePanel() {
    let panel = document.getElementById('cgpt-range-panel');
    if (panel) return panel;

    panel = document.createElement('div');
    panel.id = 'cgpt-range-panel';
    panel.className = 'cgpt-range-panel';
    panel.style.display = 'none';
    panel.innerHTML = `
      <div class="cgpt-range-card" role="dialog" aria-modal="false" aria-labelledby="cgpt-range-title">
        <div class="cgpt-range-head">
          <div>
            <div id="cgpt-range-title" class="cgpt-range-title">范围选择</div>
            <div id="cgpt-range-sub" class="cgpt-range-sub">当前可选 0 轮</div>
          </div>
          <button id="cgpt-range-close" class="cgpt-range-close" type="button" title="关闭">${iconSvg('exit')}</button>
        </div>

        <div class="cgpt-range-segment" aria-label="选择模式">
          <button type="button" data-cgpt-range-mode="replace" aria-pressed="true">替换</button>
          <button type="button" data-cgpt-range-mode="add" aria-pressed="false">追加</button>
          <button type="button" data-cgpt-range-mode="remove" aria-pressed="false">移除</button>
        </div>

        <label class="cgpt-range-field">
          <span class="cgpt-range-label">轮次范围</span>
          <input id="cgpt-range-input" class="cgpt-range-input" type="text" inputmode="text" autocomplete="off" placeholder="例如：1-3, 6, 9-12">
        </label>

        <div id="cgpt-range-quick" class="cgpt-range-quick"></div>
        <div id="cgpt-range-preview" class="cgpt-range-preview">输入范围后会显示预览。</div>

        <div class="cgpt-range-actions">
          <button id="cgpt-range-cancel" class="cgpt-quiet" type="button">取消</button>
          <button id="cgpt-range-apply" class="cgpt-primary" type="button">应用范围</button>
        </div>
      </div>
    `;
    document.body.appendChild(panel);

    panel.querySelector('#cgpt-range-close').onclick = closeRangePanel;
    panel.querySelector('#cgpt-range-cancel').onclick = closeRangePanel;
    panel.querySelector('#cgpt-range-apply').onclick = applyRangePanelSelection;
    panel.querySelector('#cgpt-range-input').addEventListener('input', updateRangePanelPreview);
    panel.querySelector('#cgpt-range-input').addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        closeRangePanel();
      } else if (e.key === 'Enter') {
        e.preventDefault();
        applyRangePanelSelection();
      }
    });
    panel.addEventListener('click', (e) => {
      const modeBtn = e.target.closest?.('[data-cgpt-range-mode]');
      if (modeBtn) {
        rangePanelState.mode = modeBtn.dataset.cgptRangeMode || 'replace';
        updateRangePanelPreview();
        return;
      }

      const quickBtn = e.target.closest?.('[data-cgpt-range-spec]');
      if (quickBtn) {
        const input = panel.querySelector('#cgpt-range-input');
        input.value = quickBtn.dataset.cgptRangeSpec || '';
        input.focus();
        updateRangePanelPreview();
      }
    });

    return panel;
  }

  function closeRangePanel() {
    const panel = document.getElementById('cgpt-range-panel');
    if (panel) panel.style.display = 'none';
  }

  function getRangePanelRequest() {
    const panel = ensureRangePanel();
    const input = panel.querySelector('#cgpt-range-input');
    let raw = (input.value || '').trim();
    let mode = rangePanelState.mode;

    if (raw.startsWith('+')) {
      mode = 'add';
      raw = raw.slice(1).trim();
    } else if (raw.startsWith('-')) {
      mode = 'remove';
      raw = raw.slice(1).trim();
    }

    return { mode, raw };
  }

  function updateRangeQuickButtons() {
    const panel = ensureRangePanel();
    const quick = panel.querySelector('#cgpt-range-quick');
    const max = selection.rounds.length;
    if (!max) {
      quick.innerHTML = '';
      return;
    }

    const half = Math.ceil(max / 2);
    const items = [
      ['全部', '全部'],
      ['前半', `1-${half}`],
      ['后半', half < max ? `${half + 1}-${max}` : `${max}`],
      ['奇数', '奇数'],
      ['偶数', '偶数'],
      ['当前已选', compactIndices(getSelectedRoundIndices())],
    ];
    quick.innerHTML = items
      .filter(([, spec]) => spec && spec !== '无')
      .map(([label, spec]) => `<button type="button" data-cgpt-range-spec="${esc(spec)}">${esc(label)}</button>`)
      .join('');
  }

  function updateRangePanelPreview() {
    const panel = ensureRangePanel();
    const max = selection.rounds.length;
    const sub = panel.querySelector('#cgpt-range-sub');
    const preview = panel.querySelector('#cgpt-range-preview');
    const apply = panel.querySelector('#cgpt-range-apply');
    const { mode, raw } = getRangePanelRequest();

    panel.querySelectorAll('[data-cgpt-range-mode]').forEach((btn) => {
      btn.setAttribute('aria-pressed', btn.dataset.cgptRangeMode === mode ? 'true' : 'false');
    });

    sub.textContent = max
      ? `当前可选 1-${max} 轮 · 已选 ${selection.selectedKeys.size} 轮`
      : '当前没有可选择的已渲染轮次';

    if (!max) {
      preview.textContent = '请先滚动加载对话内容。';
      preview.classList.add('cgpt-error');
      apply.disabled = true;
      return;
    }

    const parsed = parseRangeSpecDetailed(raw, max);
    if (parsed.errors.length) {
      preview.textContent = parsed.errors.join('；');
      preview.classList.add('cgpt-error');
      apply.disabled = true;
      return;
    }

    const current = new Set(getSelectedRoundIndices());
    const next = new Set(mode === 'replace' ? [] : current);
    for (const idx of parsed.set) {
      if (mode === 'remove') next.delete(idx);
      else next.add(idx);
    }

    const modeText = mode === 'replace' ? '替换为' : (mode === 'add' ? '追加' : '移除');
    preview.classList.remove('cgpt-error');
    preview.innerHTML = `${modeText} <strong>${parsed.set.size}</strong> 轮：${esc(compactIndices(parsed.set))}<br>应用后当前可见选中 <strong>${next.size}</strong> 轮：${esc(compactIndices(next))}`;
    apply.disabled = false;
  }

  function applyRangePanelSelection() {
    const max = selection.rounds.length;
    if (!max) return;

    const { mode, raw } = getRangePanelRequest();
    const parsed = parseRangeSpecDetailed(raw, max);
    if (parsed.errors.length) {
      updateRangePanelPreview();
      return;
    }

    const keys = keysFromIndexSet(parsed.set);
    const next = mode === 'replace' ? new Set() : new Set(selection.selectedKeys);
    for (const key of keys) {
      if (mode === 'remove') next.delete(key);
      else next.add(key);
    }

    selection.selectedKeys = next;
    applySelectionToDOM();
    syncFab();
    closeRangePanel();
    toast(`已${mode === 'replace' ? '选择' : (mode === 'add' ? '追加' : '移除')} ${keys.size} 轮`);
  }

  function promptRangeSelect() {
    const panel = ensureRangePanel();
    const input = panel.querySelector('#cgpt-range-input');
    rangePanelState.mode = 'replace';
    updateRangeQuickButtons();
    input.value = getSelectedRoundIndices().length ? compactIndices(getSelectedRoundIndices()) : '';
    panel.style.display = '';
    updateRangePanelPreview();
    setTimeout(() => {
      input.focus();
      input.select();
    }, 0);
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
      const exportableKeys = getExportableSelectedKeys();
      if (!selectedIndices.length) {
        toast('⚠️ 选中的对话已不在当前渲染区域，请重新选择');
        return;
      }
      if (exportableKeys.size < selection.selectedKeys.size) {
        toast(`⚠️ 有 ${selection.selectedKeys.size - exportableKeys.size} 轮已被虚拟滚动卸载，本次只导出当前可见的选中轮`, 3500);
      }
      const body = await buildSelectedBody(selection.rounds, exportableKeys);
      const metaLine = `选中 ${selectedIndices.length} 轮：${selectedIndices.join(', ')}`;
      const html = await buildHTMLDoc(title, body, metaLine);
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
    if (selection.rounds.length) {
      toast(`进入选择模式：已识别 ${selection.rounds.length} 轮，可点击对话块选择`);
    } else {
      toast('⚠️ 暂未识别到已渲染的对话内容，请先滚动加载消息');
    }
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

  function iconSvg(name) {
    const paths = {
      cursor: '<path d="m3 3 7.07 16.97 2.51-7.39 7.39-2.51L3 3Z"/><path d="m13 13 6 6"/>',
      exit: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="m16 17 5-5-5-5"/><path d="M21 12H9"/>',
      checkAll: '<path d="m3 17 2 2 4-4"/><path d="m3 7 2 2 4-4"/><path d="M13 6h8"/><path d="M13 12h8"/><path d="M13 18h8"/>',
      range: '<path d="M4 7h16"/><path d="M4 17h16"/><path d="M7 4v6"/><path d="M17 14v6"/>',
      clear: '<path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="m19 6-1 14H6L5 6"/><path d="M10 11v5"/><path d="M14 11v5"/>',
      download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="M7 10l5 5 5-5"/><path d="M12 15V3"/>',
      folder: '<path d="M3 6a2 2 0 0 1 2-2h5l2 3h7a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z"/>',
      fileDown: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z"/><path d="M14 2v6h6"/><path d="M12 18v-6"/><path d="m9 15 3 3 3-3"/>',
      chevron: '<path d="m9 18 6-6-6-6"/>',
    };
    return `<svg class="cgpt-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] || ''}</svg>`;
  }

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
    const stateChip = document.getElementById('cgpt-state-chip');
    const selectionTools = document.getElementById('cgpt-selection-tools');
    const normalTools = document.getElementById('cgpt-normal-tools');
    const hint = document.getElementById('cgpt-hint');

    const selectedCount = selection.selectedKeys.size;
    const exportableCount = getExportableSelectedKeys().size;
    const max = selection.rounds.length || 0;
    const hasDir = await idbGetDirHandle().then(h => !!h).catch(() => false);

    const sidebar = document.getElementById('cgpt-sidebar');
    if (sidebar) {
      if (selection.enabled) sidebar.classList.add('cgpt-active');
      else sidebar.classList.remove('cgpt-active');
    }

    if (btnMode) {
      btnMode.innerHTML = selection.enabled
        ? `${iconSvg('exit')}<span class="cgpt-btn-label">退出选择</span>`
        : `${iconSvg('cursor')}<span class="cgpt-btn-label">选择对话</span>`;
    }

    const show = (el, on) => { if (!el) return; el.style.display = on ? '' : 'none'; };

    show(selectionTools, selection.enabled);
    show(normalTools, !selection.enabled);
    show(dirIndicator, !selection.enabled && hasDir);

    if (stateChip) stateChip.textContent = selection.enabled ? '选择中' : '就绪';
    if (pill) {
      pill.innerHTML = exportableCount === selectedCount
        ? `<span>已选</span><span><span class="cgpt-count">${selectedCount}</span> / ${max} 轮</span>`
        : `<span>已选</span><span><span class="cgpt-count">${selectedCount}</span> 轮 · 当前可导出 ${exportableCount}</span>`;
    }
    if (btnAll) btnAll.disabled = max <= 0;
    if (btnRange) btnRange.disabled = max <= 0;
    if (btnClear) btnClear.disabled = selectedCount <= 0;
    if (btnExport) btnExport.disabled = selectedCount <= 0;
    if (hint) {
      hint.textContent = selection.enabled
        ? (max ? '点击任意对话块可累加多选；范围支持 1,3,5-8；Enter 导出，Esc 退出。' : '当前页面没有已渲染的对话块，请先滚动加载消息。')
        : '选择对话后可只导出关键轮次；全部导出会导出当前已渲染内容。';
    }
    if (dirIndicator) {
      dirIndicator.innerHTML = `${iconSvg('folder')}<span>已设默认位置</span>`;
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
        ${iconSvg('chevron')}
      </button>
      <div id="cgpt-sidebar-content">
        <div class="cgpt-panel-head">
          <div>
            <div class="cgpt-kicker">ChatGPT Export</div>
            <div class="cgpt-title">对话导出</div>
          </div>
          <span id="cgpt-state-chip" class="cgpt-chip">就绪</span>
        </div>

        <button id="cgpt-btn-mode" class="cgpt-primary" type="button" title="进入/退出选择模式">
          ${iconSvg('cursor')}<span class="cgpt-btn-label">选择对话</span>
        </button>

        <div id="cgpt-selection-tools" class="cgpt-tools" style="display:none">
          <span id="cgpt-pill-count" class="cgpt-pill">已选 0 / 0 轮</span>
          <div class="cgpt-grid">
            <button id="cgpt-btn-all" type="button" title="全选 (Ctrl/Cmd+A)">${iconSvg('checkAll')}<span class="cgpt-btn-label">全选</span></button>
            <button id="cgpt-btn-range" type="button" title="范围选择（如 3-8, 12）">${iconSvg('range')}<span class="cgpt-btn-label">范围</span></button>
          </div>
          <button id="cgpt-btn-clear" class="cgpt-quiet" type="button" title="清空选择">${iconSvg('clear')}<span class="cgpt-btn-label">清空选择</span></button>
          <button id="cgpt-btn-export" class="cgpt-primary" type="button" title="下载选中的对话轮" disabled>${iconSvg('download')}<span class="cgpt-btn-label">下载选中</span></button>
        </div>

        <div id="cgpt-normal-tools" class="cgpt-tools">
          <button id="cgpt-btn-export-all" type="button" title="导出当前已渲染的全部对话">${iconSvg('fileDown')}<span class="cgpt-btn-label">全部导出</span></button>
          <button id="cgpt-btn-set-dir" type="button" title="设置默认保存位置">${iconSvg('folder')}<span class="cgpt-btn-label">设置位置</span></button>
          <span id="cgpt-dir-indicator" class="cgpt-pill" style="display:none"></span>
        </div>

        <div id="cgpt-hint" class="cgpt-hint">选择对话后可只导出关键轮次；全部导出会导出当前已渲染内容。</div>
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
