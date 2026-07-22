// ==UserScript==
// @name         LinuxDo 便捷脚本
// @namespace    https://linux.do/
// @version      1.1.21
// @license      MIT
// @description  在 LINUX DO 与 IDC Flare 弹窗预览整帖，支持楼中楼、互动、原图灯箱、已读上报和 Obsidian 首帖快照。
// @author       Fashion
// @match        https://linux.do/*
// @match        https://idcflare.com/*
// @icon         https://cdn3.ldstatic.com/optimized/4X/6/a/6/6a6affc7b1ce8140279e959d32671304db06d5ab_2_180x180.png
// @grant        GM.getValue
// @grant        GM.setValue
// @grant        GM.setClipboard
// @grant        GM.xmlHttpRequest
// @connect      127.0.0.1
// @connect      localhost
// @run-at       document-idle
// ==/UserScript==

(function () {
  'use strict';

  const BASE = location.origin;
  const PAGE_SIZE = 20;
  const MAX_RENDERED_POSTS = 80;
  const READ_THRESHOLD = 1500;
  const FLUSH_INTERVAL = 5000;
  let ME_USERNAME = null;

  // --- 楼中楼分批加载配置 ---
  const SUB_REPLY_INITIAL_SIZE = 3;   // 楼中楼默认展示条数
  const SUB_REPLY_PAGE_SIZE = 10;     // 每次点击“展示更多”追加条数
  const REPLIES_HOVER_DELAY = 400;    // 楼层在视口停留超过此时长才触发抓取(ms)

  // --- 全局只读请求队列 & HTTP 429 退避重试 ---
  const REQUEST_MIN_INTERVAL = 300;   // 相邻 GET 请求最小间隔(ms)
  const RETRY_MAX_ATTEMPTS = 3;       // 429 最多重试次数（不含首次请求）
  const RETRY_BASE_DELAY = 500;       // 无 Retry-After 时的指数退避基础延迟(ms)
  const SLICE_RADIUS = 20;            // 定位楼层前后各预加载的窗口半径
  let lastRequestTime = 0;
  let requestQueueTail = Promise.resolve();

  const MENU_PANEL_SEL = '.menu-panel, .user-menu, .quick-access-panel, .notifications';
  const SEARCH_SEL = '.search-results, .fps-result, .search-menu, .search-menu-container, .search-result-topic';
  const USER_CARD_CACHE = new Map();
  let CURRENT_USER_CARD = null;

  /* ============ 1. 样式 ============ */
  const style = document.createElement('style');
  style.textContent = `
    .ldp-overlay{position:fixed;inset:0;z-index:2147483000;display:flex;
      align-items:center;justify-content:center;background:rgba(0,0,0,.55);}
    .ldp-modal{display:flex;flex-direction:column;
      width: 90%;max-width: 1080px;height:90vh;
      border-radius:12px;overflow:hidden;font-size:16px;
      line-height:1.65;background:var(--secondary,#fff);color:var(--primary,#222);
      box-shadow:0 16px 50px rgba(0,0,0,.4);}
    .ldp-header{display:flex;align-items:flex-start;gap:10px;padding:16px 20px;
      border-bottom:1px solid var(--primary-low,#e5e5e5);}
    .ldp-title{margin:0;font-size:18px;font-weight:700;}
    .ldp-meta{font-size:12px;opacity:.7;margin-top:4px;}
    .ldp-head-btns{display:flex;gap:8px;align-items:center;}
    .ldp-close{cursor:pointer;border:none;background:transparent;font-size:22px;
      line-height:1;color:inherit;padding:0 4px;}
    /* Obsidian 快照操作沿用论坛主题，保持工具按钮视觉一致 */
    .ldp-obsidian-actions{display:inline-flex;align-items:center;gap:6px;flex:none;}
    .ldp-obsidian-save,.ldp-obsidian-copy,.ldp-obsidian-settings{display:inline-flex;align-items:center;
      justify-content:center;border:1px solid transparent;border-radius:7px;cursor:pointer;
      font:600 13px/1.2 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;
      transition:background-color .16s ease,border-color .16s ease,color .16s ease,opacity .16s ease;}
    .ldp-obsidian-save svg,.ldp-obsidian-copy svg,.ldp-obsidian-settings svg{width:16px;height:16px;fill:currentColor;flex:none;}
    .ldp-obsidian-label{display:none;}
    .ldp-obsidian-save,.ldp-obsidian-copy,.ldp-obsidian-settings{width:32px;height:32px;padding:0;color:var(--primary-medium,#667085);
      background:var(--primary-very-low,#f7f7f8);border-color:var(--primary-low,#e5e7eb);}
    .ldp-obsidian-save:hover,.ldp-obsidian-copy:hover,.ldp-obsidian-settings:hover{color:var(--primary,#1f2937);
      border-color:var(--primary-medium,#9ca3af);background:var(--primary-low,#e9e9e9);}
    .ldp-obsidian-save:disabled,.ldp-obsidian-copy:disabled,.ldp-obsidian-settings:disabled{cursor:wait;opacity:.62;}
    .ldp-obsidian-save:focus-visible,.ldp-obsidian-copy:focus-visible,.ldp-obsidian-settings:focus-visible,
    .ldp-obsidian-dialog button:focus-visible,.ldp-obsidian-dialog input:focus-visible,
    .ldp-obsidian-dialog select:focus-visible{outline:2px solid #8b5cf6;outline-offset:2px;}
    .ldp-obsidian-page-actions{width:max-content;margin:8px 0 8px auto;}
    .ldp-obsidian-dialog-overlay{position:fixed;inset:0;z-index:2147483640;display:grid;
      place-items:center;padding:20px;background:rgba(10,12,18,.58);backdrop-filter:blur(3px);}
    .ldp-obsidian-dialog{width:min(540px,100%);max-height:calc(100vh - 40px);overflow:auto;
      box-sizing:border-box;padding:22px;border:1px solid var(--primary-low,#e5e7eb);
      border-radius:13px;color:var(--primary,#1f2937);background:var(--secondary,#fff);
      box-shadow:0 22px 70px rgba(0,0,0,.34);font:14px/1.5 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;}
    .ldp-obsidian-dialog-head{display:flex;align-items:flex-start;justify-content:space-between;
      gap:16px;margin-bottom:16px;}
    .ldp-obsidian-dialog h2{margin:0;font-size:20px;line-height:1.3;}
    .ldp-obsidian-dialog-subtitle{margin:4px 0 0;color:var(--primary-medium,#667085);font-size:12px;}
    .ldp-obsidian-dialog-close{border:0;background:transparent;color:inherit;cursor:pointer;
      padding:0 4px;font-size:24px;line-height:1;}
    .ldp-obsidian-dialog label{display:block;margin:13px 0 5px;font-weight:650;}
    .ldp-obsidian-dialog input,.ldp-obsidian-dialog select{width:100%;box-sizing:border-box;
      padding:9px 10px;border:1px solid var(--primary-low-mid,#cfd4dc);border-radius:7px;
      color:var(--primary,#1f2937);background:var(--secondary,#fff);font:inherit;}
    .ldp-obsidian-dialog-help{margin:5px 0 0;color:var(--primary-medium,#667085);font-size:12px;}
    .ldp-obsidian-dialog-note{margin:0 0 14px;padding:10px 12px;border-left:3px solid #8b5cf6;
      border-radius:0 7px 7px 0;background:rgba(124,58,237,.08);font-size:12px;}
    .ldp-obsidian-dialog-status{min-height:21px;margin-top:12px;color:var(--primary-medium,#667085);
      font-size:13px;}
    .ldp-obsidian-dialog-status[data-type="error"]{color:var(--danger,#b42318);}
    .ldp-obsidian-dialog-status[data-type="success"]{color:#15803d;}
    .ldp-obsidian-confirm-icon{display:grid;width:42px;height:42px;margin-bottom:14px;
      place-items:center;border-radius:11px;color:#7c3aed;background:rgba(124,58,237,.11);
      font-size:24px;font-weight:700;}
    .ldp-obsidian-confirm-copy{margin:8px 0 0;color:var(--primary-medium,#667085);}
    .ldp-obsidian-confirm-path{display:block;margin-top:14px;padding:9px 10px;overflow-wrap:anywhere;
      border:1px solid var(--primary-low,#e5e7eb);border-radius:7px;
      color:var(--primary,#1f2937);background:var(--primary-very-low,#f7f7f8);font-size:12px;}
    .ldp-obsidian-dialog-actions{display:flex;justify-content:flex-end;gap:8px;margin-top:18px;}
    .ldp-obsidian-dialog-actions button,.ldp-obsidian-test{border:0;border-radius:7px;
      padding:8px 12px;cursor:pointer;font:inherit;font-size:13px;font-weight:600;line-height:1.2;}
    .ldp-obsidian-dialog button:disabled{cursor:wait;opacity:.62;}
    .ldp-obsidian-primary{color:#fff;background:#7c3aed;}
    .ldp-obsidian-primary:hover{background:#6d28d9;}
    .ldp-obsidian-secondary,.ldp-obsidian-test{color:var(--primary,#1f2937);
      background:var(--primary-low,#e9eaec);}
    .ldp-obsidian-test{margin-top:10px;}
    .ldp-obsidian-toast{position:fixed;right:20px;bottom:20px;z-index:2147483641;
      max-width:min(460px,calc(100vw - 40px));padding:11px 14px;border-radius:9px;
      color:#fff;background:#24262d;box-shadow:0 10px 32px rgba(0,0,0,.28);
      font:14px/1.45 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;}
    .ldp-obsidian-toast[data-type="success"]{background:#166534;}
    .ldp-obsidian-toast[data-type="error"]{background:#b42318;}
    @media (prefers-reduced-motion:reduce){
      .ldp-obsidian-save,.ldp-obsidian-copy,.ldp-obsidian-settings{transition:none;}
    }
    .ldp-shell{flex:1;min-height:0;position:relative;display:flex;}
    .ldp-body{flex:1;min-width:0;min-height:0;position:relative;
      padding:8px 20px 20px;overflow-y:auto;overscroll-behavior:contain;
      scrollbar-width:none;}
    .ldp-body::-webkit-scrollbar{width:0;height:0;}

    /* 右侧时间轴 */
    .ldp-timeline{flex:0 0 96px;display:flex;flex-direction:column;align-items:center;
      gap:8px;padding:12px 10px;
      background:var(--secondary,#fff);color:var(--primary-medium,#666);}
    .ldp-tl-date,.ldp-tl-current{border:none;
      background:transparent;color:inherit;font:inherit;}
    .ldp-tl-date{cursor:pointer;}
    .ldp-tl-date{width:100%;min-height:36px;padding:4px 2px;border-radius:6px;
      font-size:13px;line-height:1.25;text-align:center;}
    .ldp-tl-date:hover{
      background:var(--primary-low,#f0f0f0);color:var(--tertiary,#08c);}
    .ldp-tl-current{width:100%;min-height:58px;padding:5px 2px;border-radius:6px;
      line-height:1.25;text-align:center;}
    .ldp-tl-current strong{display:block;font-size:17px;color:var(--primary,#222);}
    .ldp-tl-current span{display:block;margin-top:3px;font-size:12px;opacity:.7;}
    .ldp-tl-track{position:relative;flex:1;width:44px;min-height:130px;border:none;
      padding:0;background:transparent;cursor:pointer;}
    .ldp-tl-track::before{content:"";position:absolute;top:8px;bottom:8px;left:50%;
      width:2px;transform:translateX(-50%);background:var(--primary-low,#e6e6e6);}
    .ldp-tl-fill{position:absolute;top:8px;bottom:8px;left:50%;width:3px;
      transform:translateX(-50%) scaleY(0);transform-origin:center top;
      will-change:transform;border-radius:999px;background:var(--tertiary,#08c);}
    .ldp-tl-thumb{position:absolute;left:50%;top:8px;width:14px;height:14px;
      transform:translate(-50%,-50%) translateY(0);will-change:transform;
      border-radius:50%;background:var(--tertiary,#08c);
      box-shadow:0 0 0 4px rgba(8,132,255,.14);}
    .ldp-tl-loading .ldp-tl-date,.ldp-tl-loading .ldp-tl-track{opacity:.6;cursor:progress;}
    .ldp-tl-date:focus-visible,.ldp-tl-track:focus-visible{
      outline:2px solid var(--tertiary,#08c);outline-offset:2px;}
    @media (max-width: 760px){
      .ldp-modal{width:96%;height:92vh;}
      .ldp-obsidian-label{display:none;}
      .ldp-obsidian-save{width:32px;padding:0;}
      .ldp-obsidian-page-actions{margin-top:6px;}
      .ldp-obsidian-dialog-overlay{padding:10px;}
      .ldp-obsidian-dialog{max-height:calc(100vh - 20px);padding:18px;}
      .ldp-body{padding-right:76px;}
      .ldp-timeline{position:absolute;right:8px;top:8px;bottom:8px;z-index:4;
        width:58px;flex-basis:auto;padding:8px 6px;border:1px solid var(--primary-low,#eee);
        border-radius:8px;box-shadow:0 8px 30px rgba(0,0,0,.14);}
      .ldp-tl-date{font-size:11px;}
      .ldp-tl-current strong{font-size:13px;}
      .ldp-tl-current span{display:none;}
    }

    /* 底部悬浮操作栏 */
    .ldp-footer{flex:none;display:flex;align-items:center;justify-content:space-around;
      padding:12px 24px;border-top:1px solid var(--primary-low,#eee);
      background:var(--secondary,#fff);}
    .ldp-fbtn{background:transparent;border:none;cursor:pointer;display:flex;
      align-items:center;gap:8px;font-size:.95rem;color:var(--primary-medium,#666);
      padding:8px 16px;border-radius:6px;transition:all .2s ease;font-weight:600;
      white-space:nowrap;text-decoration:none;}
    .ldp-fbtn:hover{background:var(--primary-low,#f0f0f0);color:var(--tertiary,#3b82f6);}
    .ldp-fbtn svg{width:18px;height:18px;fill:currentColor;flex:none;}
    .ldp-fbtn:disabled{cursor:default;opacity:.5;pointer-events:none;}
    .ldp-fbtn.loading{opacity:.6;pointer-events:none;}
    .ldp-fbtn.liked{color:#e74c3c;}
    .ldp-fbtn.liked svg{fill:#e74c3c;}
    .ldp-fbtn.bookmarked{color:var(--tertiary,#3b82f6);}
    .ldp-fbtn.bookmarked svg{fill:var(--tertiary,#3b82f6);}

    /* 楼主帖自身的点赞/回复按钮已挪到底部操作栏，这里隐藏原位置 */
    .ldp-topic > .ldp-post > .ldp-actions{display:none;}

    /* 骨架屏 */
    .ldp-loadmask{position:absolute;inset:0;z-index:5;
      padding:8px 20px 20px;overflow:hidden;
      background:var(--secondary,#fff);color:inherit;}
    .ldp-loadmask.hide{opacity:0;pointer-events:none;transition:opacity .25s ease;}
    .ldp-sk{position:relative;overflow:hidden;border-radius:6px;
      background:var(--primary-low,#e9e9e9);}
    .ldp-sk::after{content:"";position:absolute;inset:0;
      transform:translateX(-100%);
      background:linear-gradient(90deg,transparent,rgba(255,255,255,.55),transparent);
      animation:ldp-shimmer 1.2s infinite;}
    @keyframes ldp-shimmer{100%{transform:translateX(100%);}}
    .ldp-sk-title{height:18px;width:55%;border-radius:6px;
      display:inline-block;vertical-align:middle;}
    .ldp-sk-meta{height:11px;width:35%;border-radius:5px;
      display:inline-block;}
    .ldp-sk-head{display:flex;align-items:center;gap:10px;margin:12px 0 10px;}
    .ldp-sk-avatar{width:32px;height:32px;border-radius:50%;flex:none;}
    .ldp-sk-line{height:12px;}
    .ldp-sk-w30{width:30%;} .ldp-sk-w40{width:40%;} .ldp-sk-w60{width:60%;}
    .ldp-sk-w80{width:80%;} .ldp-sk-w90{width:90%;} .ldp-sk-w100{width:100%;}
    .ldp-sk-para .ldp-sk-line{margin-bottom:8px;}
    .ldp-sk-divider{height:1px;background:var(--primary-low,#e0e0e0);margin:16px 0 12px;}
    .ldp-sk-comment{display:flex;gap:10px;margin-bottom:18px;}
    .ldp-sk-comment .ldp-sk-avatar{width:28px;height:28px;}
    .ldp-sk-cbody{flex:1;}

    /* 楼主帖区块 */
    .ldp-topic{padding:4px 0 14px;}
    .ldp-topic .ldp-post{border-bottom:none;}

    /* 评论区分隔 + 左上角“评论”标题 */
    .ldp-comments-header{display:flex;align-items:center;gap:8px;
      margin:6px 0 2px;padding-top:14px;border-top:2px solid var(--primary-low,#e0e0e0);
      font-size:16px;font-weight:700;letter-spacing:.5px;}
    .ldp-comments-header::before{content:"💬";font-size:14px;}
    .ldp-comments-count{font-size:12px;font-weight:500;opacity:.6;}
    .ldp-comments{padding-top:4px;}
    .ldp-comments-empty{padding:18px 0;text-align:center;opacity:.5;font-size:13px;}

    .ldp-post{padding:12px 0 12px 12px;border-bottom:1px solid var(--primary-low,#eee);}
    .ldp-topic > .ldp-post,.ldp-comments > .ldp-post{
      content-visibility:auto;contain-intrinsic-size:auto 180px;}
    .ldp-post.ldp-flash{animation:ldp-flash-bg 1.6s ease;}
    @keyframes ldp-flash-bg{
      0%{background:rgba(8,132,255,.16);}
      100%{background:transparent;}
    }
    .ldp-post-head{display:flex;align-items:center;gap:8px;margin-bottom:6px;}
    .ldp-avatar-btn{flex:none;width:28px;height:28px;padding:0;border:none;border-radius:50%;
      background:transparent;color:inherit;cursor:pointer;position:relative;}
    .ldp-avatar{width:28px;height:28px;border-radius:50%;display:block;}
    .ldp-avatar-btn:hover .ldp-avatar{box-shadow:0 0 0 3px rgba(8,132,255,.18);}
    .ldp-avatar-btn:focus-visible{outline:2px solid var(--tertiary,#08c);outline-offset:2px;}
    .ldp-user-card{position:fixed;z-index:2147483300;width:min(390px,calc(100vw - 24px));
      max-height:calc(100vh - 24px);overflow-y:auto;overscroll-behavior:contain;
      border:1px solid var(--primary-low,#e5e5e5);border-radius:10px;
      background:var(--secondary,#fff);color:var(--primary,#222);
      box-shadow:0 18px 50px rgba(0,0,0,.24);font-size:14px;line-height:1.45;}
    .ldp-user-card-cover{height:82px;background:
      linear-gradient(135deg,rgba(8,132,255,.18),rgba(128,128,128,.08));background-size:cover;background-position:center;}
    .ldp-user-card-body{padding:0 14px 14px;}
    .ldp-user-card-main{display:flex;gap:12px;align-items:flex-end;margin-top:-34px;}
    .ldp-user-card-avatar{width:76px;height:76px;padding:0;border:3px solid var(--secondary,#fff);
      border-radius:50%;background:var(--secondary,#fff);cursor:pointer;flex:none;}
    .ldp-user-card-avatar img{width:100%;height:100%;display:block;border-radius:50%;}
    .ldp-user-card-avatar:hover{box-shadow:0 0 0 4px rgba(8,132,255,.18);}
    .ldp-user-card-avatar:focus-visible{outline:2px solid var(--tertiary,#08c);outline-offset:2px;}
    .ldp-user-card-name{min-width:0;padding-bottom:4px;}
    .ldp-user-card-name strong{display:block;font-size:22px;line-height:1.1;}
    .ldp-user-card-name span{display:block;opacity:.68;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
    .ldp-user-card-loading,.ldp-user-card-error{padding:16px;opacity:.72;}
    .ldp-user-card-bio{margin:12px 0 0;color:var(--primary,#222);}
    .ldp-user-card-meta{display:grid;gap:5px;margin:12px 0 0;font-size:13px;opacity:.82;}
    .ldp-user-card-meta a{color:var(--tertiary,#08c);text-decoration:none;}
    .ldp-user-card-meta a:hover{text-decoration:underline;}
    .ldp-user-card-stats{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-top:12px;}
    .ldp-user-card-stat{padding:8px;border-radius:8px;background:var(--primary-very-low,#f6f6f6);text-align:center;}
    .ldp-user-card-stat strong{display:block;font-size:16px;line-height:1.2;}
    .ldp-user-card-stat span{display:block;margin-top:2px;font-size:12px;opacity:.65;}
    .ldp-author{font-weight:600;}
    .ldp-op{font-size:11px;font-weight:700;color:#fff;background:var(--tertiary,#08c);
      border-radius:4px;padding:1px 6px;letter-spacing:.5px;}
    .ldp-me{font-size:11px;font-weight:700;color:#fff;background:#3ea66b;
      border-radius:4px;padding:1px 6px;letter-spacing:.5px;}
    .ldp-user{font-size:12px;opacity:.6;}
    .ldp-time{font-size:12px;opacity:.55;}
    .ldp-floor{font-size:12px;opacity:.5;margin-left:auto;
      padding-left:8px;white-space:nowrap;}
    .ldp-unread-dot{display:inline-block;visibility:hidden;flex:none;width:8px;height:8px;border-radius:50%;
      background:#55c7f7;box-shadow:0 0 0 3px rgba(85,199,247,.18);
      margin-left:2px;}
    .ldp-post.ldp-unread > .ldp-post-head .ldp-unread-dot{visibility:visible;}
    .ldp-content img{max-width:100%;height:auto;cursor:zoom-in;border-radius:4px;}
    .ldp-content pre{overflow:auto;background:var(--primary-very-low,#f6f6f6);
      padding:10px;border-radius:6px;}

    /* Base64 解码 */
    .ldp-base64-selection-menu{position:fixed;z-index:2147483550;display:block;
      padding:4px;border:1px solid var(--primary-low,#ddd);border-radius:7px;
      background:var(--secondary,#fff);color:var(--primary,#222);
      box-shadow:0 8px 24px rgba(0,0,0,.2);}
    .ldp-base64-selection-menu[hidden]{display:none;}
    .ldp-base64-selection-menu button{display:flex;align-items:center;gap:6px;
      min-height:32px;padding:5px 10px;border:none;border-radius:5px;cursor:pointer;
      background:transparent;color:inherit;font:inherit;font-size:13px;white-space:nowrap;}
    .ldp-base64-selection-menu button:hover{background:var(--primary-low,#eee);}
    .ldp-base64-result{position:relative;margin:8px 0;min-height:42px;
      overflow:hidden;border:none;border-radius:4px;
      background:var(--primary-very-low,#f6f6f6);color:var(--primary,#222);}
    .ldp-base64-result pre{box-sizing:border-box;max-height:420px;min-height:42px;
      margin:0;padding:11px 78px 11px 14px;overflow:auto;border:none;
      border-radius:inherit;background:transparent;color:inherit;
      font-size:13px;line-height:20px;white-space:pre-wrap;overflow-wrap:anywhere;}
    .ldp-base64-result code{font-family:ui-monospace,SFMono-Regular,Consolas,
      "Liberation Mono",monospace;}
    .ldp-base64-toolbar{position:absolute;top:50%;right:7px;z-index:1;
      display:flex;gap:2px;transform:translateY(-50%);}
    .ldp-base64-toolbar button{display:grid;min-width:28px;width:28px;height:28px;
      place-items:center;padding:5px;border:none;border-radius:4px;cursor:pointer;
      background:transparent;color:var(--primary-medium,#777);
      font:inherit;font-size:18px;line-height:1;box-shadow:none;}
    .ldp-base64-toolbar button:hover{color:var(--primary,#222);
      background:var(--primary-low,#e9e9e9);}
    .ldp-base64-toolbar button:focus-visible{outline:2px solid var(--tertiary,#08c);
      outline-offset:1px;}
    .ldp-base64-toolbar button:disabled{cursor:default;opacity:.65;}
    .ldp-base64-toolbar button.ldp-base64-copy.copied{width:auto;padding-inline:7px;
      font-size:12px;white-space:nowrap;}
    .ldp-base64-toolbar svg{display:block;width:16px;height:16px;fill:currentColor;}

    /* 弹窗正文代码块工具栏（原站会运行组件补按钮，弹窗需自行补齐） */
    .ldp-codeblock-host{position:relative;}
    .ldp-codeblock-host > pre{padding-right:48px;}
    .ldp-codeblock-toolbar{position:absolute;top:6px;right:10px;z-index:2;
      display:flex;gap:2px;}
    .ldp-codeblock-toolbar button{display:grid;width:28px;height:28px;place-items:center;
      padding:5px;border:none;border-radius:4px;cursor:pointer;box-shadow:none;
      background:transparent;color:var(--primary-medium,#888);}
    .ldp-codeblock-toolbar button:hover{background:var(--primary-low,#e8e8e8);
      color:var(--primary,#222);}
    .ldp-codeblock-toolbar button:focus-visible{outline:2px solid var(--tertiary,#08c);
      outline-offset:1px;}
    .ldp-codeblock-toolbar button:disabled{cursor:default;opacity:.65;}
    .ldp-codeblock-toolbar svg{display:block;width:16px;height:16px;fill:currentColor;}
    .ldp-children{margin-left:22px;
      border-left:1px solid var(--tertiary,#08c);}
    .ldp-actions{display:flex;gap:14px;margin-top:8px;font-size:12px;align-items:center;}
    .ldp-btn{cursor:pointer;border:none;background:transparent;color:inherit;
      opacity:.7;display:inline-flex;align-items:center;gap:4px;padding:2px 4px;}
    .ldp-btn:hover{opacity:1;}
    .ldp-btn:disabled{cursor:default;opacity:.4;}
    .ldp-like.liked{color:var(--love,#e25822);opacity:1;font-weight:600;}
    
    .ldp-replybox{margin-top:8px;display:none;position:relative;}
    .ldp-replybox.open{display:block;}
    .ldp-replybox textarea{width:100%;min-height:90px;box-sizing:border-box;
      border:1px solid var(--primary-low,#ccc);border-radius:6px;padding:8px;
      font:inherit;background:var(--secondary,#fff);color:inherit;resize:vertical;}
    .ldp-replybox textarea.uploading{opacity:0.6;pointer-events:none;}
    .ldp-send{margin-top:6px;background:var(--tertiary,#08c);color:#fff;border:none;
      border-radius:6px;padding:6px 14px;cursor:pointer;}
    .ldp-reply-tip{margin-left:10px;font-size:12px;color:#3ea66b;opacity:0;
      transition:opacity .25s ease;}
    .ldp-reply-tip.show{opacity:1;}
    
    .ldp-loading-tip{padding:14px 0;text-align:center;font-size:13px;
      color:var(--primary-medium,#888);display:none;user-select:none;}
    .ldp-loading-tip.show{display:block;}
    .ldp-loading-tip .ldp-tip-icon{display:inline-block;margin-right:6px;
      animation:ldp-spin .9s linear infinite;}
    @keyframes ldp-spin{from{transform:rotate(0deg);}to{transform:rotate(360deg);}}

    .ldp-load-up-tip,.ldp-load-down-tip{display:none;padding:9px 0;text-align:center;
      font-size:12px;color:var(--primary-medium,#888);user-select:none;}
    .ldp-load-up-tip.show,.ldp-load-down-tip.show{display:block;}
    .ldp-load-up-tip .ldp-tip-icon,.ldp-load-down-tip .ldp-tip-icon{
      display:inline-block;margin-right:5px;animation:ldp-spin .9s linear infinite;}
    .ldp-top-tip{padding:10px 0;text-align:center;font-size:12px;
      color:var(--primary-medium,#888);user-select:none;}

    .ldp-bottom-tip{padding:16px 0;text-align:center;font-size:13px;
      color:var(--primary-medium,#888);user-select:none;}

    /* 灯箱 */
    .ldp-lightbox{position:fixed;inset:0;z-index:2147483600;display:flex;
      flex-direction:column;background:rgba(0,0,0,.9);}
    .ldp-lb-stage{flex:1;overflow:auto;display:flex;align-items:center;
      justify-content:center;padding:20px;}
    .ldp-lb-stage img{display:block;max-width:94vw;max-height:88vh;
      width:auto;height:auto;border-radius:4px;cursor:zoom-out;
      box-shadow:0 10px 40px rgba(0,0,0,.6);}
    .ldp-lb-x{position:fixed;top:12px;right:12px;z-index:1;display:grid;
      width:44px;height:44px;place-items:center;cursor:pointer;
      border:1px solid rgba(255,255,255,.45);border-radius:4px;
      background:rgba(0,0,0,.35);color:#fff;font-size:30px;line-height:1;}
    .ldp-lb-x:hover{background:rgba(255,255,255,.14);}
    .ldp-lb-x:focus-visible{outline:3px solid #fff;outline-offset:2px;}

    /* 楼中楼“展示更多回复”按钮 */
    .ldp-sub-actions{margin-left:22px;padding-left:14px;margin-top:2px;display:none;}
    .ldp-load-more-replies{font-size:12px;color:var(--tertiary,#08c);font-weight:600;
      opacity:.9;padding:4px 0;}
    .ldp-load-more-replies:hover{opacity:1;text-decoration:underline;}
    .ldp-sub-loading{font-size:12px;opacity:.5;margin-left:22px;padding-left:14px;
      margin-top:2px;display:none;}

    /* ============ Boost样式（仿官方 discourse-boosts 插件，独立实现） ============ */
    /* 气泡列表 */
    .ldp-boosts-list{display:flex;flex-wrap:wrap;gap:4px;align-items:center;margin-top:6px;min-height:0;}
    /* 单个气泡：胶囊形，与官方 bubble 对齐 */
    .ldp-boost-bubble{display:inline-flex;align-items:center;gap:4px;
      padding:3px 8px 3px 4px;border:none;
      background:rgba(128,128,128,.1);border-radius:50px;
      font-size:14px;line-height:1.4;cursor:default;position:relative;
      transition:background .15s;}
    .ldp-boost-bubble:hover{background:rgba(128,128,128,.18);}
    /* 气泡内头像 */
    .ldp-b-avatar{width:18px;height:18px;border-radius:50%;flex:none;display:block;}
    /* 气泡内文字/表情段落 */
    .ldp-boost-bubble p{margin:0;display:inline-flex;gap:2px;align-items:center;flex-wrap:wrap;}
    .ldp-boost-bubble p img.emoji{width:14px;height:14px;margin:0;vertical-align:middle;}
    /* 删除按钮：hover 气泡时才显示 */
    .ldp-boost-del{cursor:pointer;margin-left:2px;opacity:0;font-size:13px;
      color:var(--danger,#cc4b4b);line-height:1;border:none;background:transparent;
      padding:0 2px;transition:opacity .15s;flex:none;}
    .ldp-boost-bubble:hover .ldp-boost-del{opacity:.65;}
    .ldp-boost-del:hover{opacity:1!important;}
    /* 发射输入框容器：默认隐藏，.open 时展开 */
    .ldp-boost-input-wrap{display:none;align-items:center;gap:5px;margin-top:6px;
      padding:4px 6px;border-radius:8px;
      border:1px solid var(--primary-low,#ddd);
      background:var(--secondary,#fff);}
    .ldp-boost-input-wrap.open{display:flex;}
    /* 输入框本身 */
    .ldp-boost-input{flex:1;border:none;background:transparent;outline:none;
      font-size:13px;padding:2px 4px;color:inherit;min-width:0;}
    .ldp-boost-input::placeholder{color:var(--primary-medium,#999);font-size:12px;}
    /* 发射确认按钮（绿色圆形） */
    .ldp-boost-submit{width:22px;height:22px;padding:0;display:flex;flex:none;
      align-items:center;justify-content:center;border-radius:50%;
      border:1px solid #3ea66b;background:transparent;color:#3ea66b;
      cursor:pointer;font-size:14px;line-height:1;transition:all .15s;}
    .ldp-boost-submit:hover{background:#3ea66b;color:#fff;}
    .ldp-boost-submit:disabled{opacity:.5;cursor:default;pointer-events:none;}
    /* 取消按钮（红色圆形） */
    .ldp-boost-cancel{width:22px;height:22px;padding:0;display:flex;flex:none;
      align-items:center;justify-content:center;border-radius:50%;
      border:1px solid var(--danger,#cc4b4b);background:transparent;
      color:var(--danger,#cc4b4b);cursor:pointer;font-size:16px;line-height:1;
      transition:all .15s;}
    .ldp-boost-cancel:hover{background:var(--danger,#cc4b4b);color:#fff;}
    /* 操作栏里的火箭按钮 */
    .ldp-btn.ldp-boost-btn{font-size:12px;}
    .ldp-btn.ldp-boost-btn:disabled{opacity:.35;cursor:default;pointer-events:none;}
  `;
  document.head.appendChild(style);

  /* 图标 */
  const ICONS = {
    // 点赞
    like: '<path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>',
    // 回复
    reply: '<path d="M1024 640q0 94.857143-72.571429 257.714286-1.714286 4-6 13.714286t-7.714286 17.142857-7.428571 12.571429q-6.857143 9.714286-16 9.714286-8.571429 0-13.428571-5.714286t-4.857143-14.285714q0-5.142857 1.428571-15.142857t1.428571-13.428571q2.857143-38.857143 2.857143-70.285714 0-57.714286-10-103.428571t-27.714286-79.142857-45.714286-57.714286-60.285714-39.714286-76-24.285714-88-12.285714-100.285714-3.428571l-128 0 0 146.285714q0 14.857143-10.857143 25.714286t-25.714286 10.857143-25.714286-10.857143l-292.571429-292.571429q-10.857143-10.857143-10.857143-25.714286t10.857143-25.714286l292.571429-292.571429q10.857143-10.857143 25.714286-10.857143t25.714286 10.857143 10.857143 25.714286l0 146.285714 128 0q407.428571 0 500 230.285714 30.285714 76.571429 30.285714 190.285714z"/>',
    // boost
    boost: '<path d="M1010.092957 38.19946a31.779551 31.779551 0 0 0-24.399655-24.399655C921.294212 0 870.914925 0 820.715635 0c-206.397081 0-330.195331 110.398439-422.574025 255.99638H189.744557A95.998643 95.998643 0 0 0 104.005769 308.975631l-98.838602 197.597206A47.999321 47.999321 0 0 0 48.146559 575.991855h207.537065l-44.939364 44.939365a63.999095 63.999095 0 0 0 0 90.49872l101.79856 101.81856a63.999095 63.999095 0 0 0 90.51872 0L448.000905 768.309136V975.986199a47.999321 47.999321 0 0 0 69.399019 42.979392l197.397208-98.778603a95.818645 95.818645 0 0 0 52.999251-85.798787V625.571154c145.177947-92.598691 255.99638-216.796934 255.99638-422.17403 0.199997-50.399287 0.199997-100.798575-13.699806-165.197664zM767.99638 335.995249a79.998869 79.998869 0 1 1 79.998869-79.998869 79.998869 79.998869 0 0 1-79.998869 79.998869z"/>',
    // 书签
    bookmark: '<path d="M17 3H7c-1.1 0-1.99.9-1.99 2L5 21l7-3 7 3V5c0-1.1-.9-2-2-2z"/>',
    // 新标签页打开
    newTab: '<path d="M19 19H5V5h7V3H5c-1.11 0-2 .9-2 2v14c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2v-7h-2v7zM14 3v2h3.59l-9.83 9.83 1.41 1.41L19 6.41V10h2V3h-7z"/>',
    // 下载到托盘
    download: '<path d="M11 3h2v10.17l3.59-3.58L18 11l-6 6-6-6 1.41-1.41L11 13.17V3ZM5 19h14v2H5v-2Z"/>',
    // Obsidian 水晶与设置
    obsidian: '<path d="M12 1.8 19.2 7l-1.8 11.1L12 22l-5.4-3.9L4.8 7 12 1.8Zm0 3L8 7.7l1.3 8.8 2.7 2 2.7-2L16 7.7 12 4.8Z"/>',
    settings: '<path d="M19.4 13a7.8 7.8 0 0 0 .1-1 7.8 7.8 0 0 0-.1-1l2.1-1.6-2-3.4-2.5 1a7.7 7.7 0 0 0-1.7-1L15 3.3h-4L10.6 6a7.7 7.7 0 0 0-1.7 1L6.4 6l-2 3.4L6.5 11a7.8 7.8 0 0 0-.1 1 7.8 7.8 0 0 0 .1 1l-2.1 1.6 2 3.4 2.5-1a7.7 7.7 0 0 0 1.7 1l.4 2.7h4l.4-2.7a7.7 7.7 0 0 0 1.7-1l2.5 1 2-3.4L19.4 13ZM13 15.5A3.5 3.5 0 1 1 13 8a3.5 3.5 0 0 1 0 7.5Z"/>',
    // 复制
    copy: '<path d="M16 1H4a2 2 0 0 0-2 2v12h2V3h12V1Zm3 4H8a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2Zm0 16H8V7h11v14Z"/>'
  };

  /* ============ 2. 工具 ============ */
  const esc = (s) => (s || '').replace(/[<>&]/g, (c) =>
      ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c]));
  const escAttr = (s) => esc(s).replace(/"/g, '&quot;').replace(/'/g, '&#39;');

  function stripHtml(html) {
    if (!html) return '';
    const tmp = document.createElement('div');
    tmp.innerHTML = html;
    return (tmp.textContent || '').trim();
  }

  function resolveAvatar(template, size) {
    return template ? absoluteUrl(template.replace('{size}', String(size || 96))) : '';
  }

  function fmtTime(iso) {
    if (!iso) return '';
    const t = new Date(iso).getTime();
    if (isNaN(t)) return '';
    const diff = Date.now() - t;
    const min = 60000, hour = 60 * min, day = 24 * hour;
    if (diff < min) return '刚刚';
    if (diff < hour) return Math.floor(diff / min) + ' 分钟前';
    if (diff < day) return Math.floor(diff / hour) + ' 小时前';
    if (diff < 30 * day) return Math.floor(diff / day) + ' 天前';
    const d = new Date(t);
    const p = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
  }

  const csrfToken = () =>
      (document.querySelector('meta[name="csrf-token"]') || {}).content || '';

  function abortError() {
    return new DOMException('The operation was aborted.', 'AbortError');
  }

  function throwIfAborted(signal) {
    if (signal && signal.aborted) throw abortError();
  }

  function sleep(ms, signal) {
    if (!(ms > 0)) {
      throwIfAborted(signal);
      return Promise.resolve();
    }
    return new Promise((resolve, reject) => {
      throwIfAborted(signal);
      const timer = setTimeout(done, ms);
      function cleanup() {
        clearTimeout(timer);
        if (signal) signal.removeEventListener('abort', onAbort);
      }
      function done() { cleanup(); resolve(); }
      function onAbort() { cleanup(); reject(abortError()); }
      if (signal) signal.addEventListener('abort', onAbort, { once: true });
    });
  }

  function parseRetryAfter(value) {
    if (!value) return null;
    const seconds = Number(value);
    if (Number.isFinite(seconds) && seconds >= 0) return seconds * 1000;
    const date = Date.parse(value);
    return Number.isFinite(date) ? Math.max(0, date - Date.now()) : null;
  }

  async function waitForRequestSlot(signal) {
    const wait = REQUEST_MIN_INTERVAL - (Date.now() - lastRequestTime);
    if (wait > 0) await sleep(wait, signal);
    throwIfAborted(signal);
    lastRequestTime = Date.now();
  }

  function queueRequest(task, signal) {
    const queued = requestQueueTail.then(async () => {
      throwIfAborted(signal);
      return task();
    });
    requestQueueTail = queued.catch(() => {});
    if (!signal) return queued;

    return new Promise((resolve, reject) => {
      if (signal.aborted) { reject(abortError()); return; }
      const onAbort = () => reject(abortError());
      signal.addEventListener('abort', onAbort, { once: true });
      queued.then(resolve, reject).finally(() => signal.removeEventListener('abort', onAbort));
    });
  }

  async function fetchWithRetry(url, options) {
    const opts = options || {};
    const signal = opts.signal;
    const headers = Object.assign({ 'Accept': 'application/json' }, opts.headers || {});
    const fetchOptions = Object.assign({}, opts, {
      method: 'GET', credentials: 'include', headers,
    });

    for (let attempt = 0; ; attempt++) {
      await waitForRequestSlot(signal);
      const res = await fetch(url, fetchOptions);
      if (res.ok) return res.json();
      if (res.status !== 429 || attempt >= RETRY_MAX_ATTEMPTS) {
        throw new Error('HTTP ' + res.status);
      }
      const retryAfter = parseRetryAfter(res.headers.get('Retry-After'));
      const delay = retryAfter === null ? RETRY_BASE_DELAY * Math.pow(2, attempt) : retryAfter;
      await sleep(delay, signal);
    }
  }

  function fetchJSON(url, options) {
    const opts = options || {};
    return queueRequest(() => fetchWithRetry(url, opts), opts.signal);
  }

  async function apiSend(url, method, params, extraHeaders) {
    const opt = {
      method,
      credentials: 'include',
      headers: Object.assign({
        'Accept': 'application/json',
        'X-CSRF-Token': csrfToken(),
        'X-Requested-With': 'XMLHttpRequest',
      }, extraHeaders || {}),
    };
    if (params instanceof FormData) {
      opt.body = params;
    } else if (params) {
      opt.headers['Content-Type'] = 'application/x-www-form-urlencoded; charset=UTF-8';
      opt.body = new URLSearchParams(params).toString();
    }
    const res = await fetch(url, opt);
    if (!res.ok) throw new Error('HTTP ' + res.status);
    return res.json().catch(() => ({}));
  }

  async function ensureMe(signal) {
    if (ME_USERNAME !== null) return ME_USERNAME;
    try {
      const s = await fetchJSON(`${BASE}/session/current.json`, { signal });
      ME_USERNAME = (s.current_user && s.current_user.username) || '';
    } catch (e) {
      if (e && e.name === 'AbortError') throw e;
      ME_USERNAME = '';
    }
    return ME_USERNAME;
  }

  function likeInfo(p) {
    const like = (p.actions_summary || []).find((a) => a.id === 2) || {};
    return { count: like.count || 0, acted: !!like.acted, canAct: !!like.can_act };
  }

  function parseTopicHref(href) {
    if (!href) return null;
    let pathname;
    try { pathname = new URL(href, location.origin).pathname; }
    catch (err) { return null; }
    const parts = pathname.split('/').filter(Boolean);
    if (parts[0] !== 't' || !parts[1]) return null;
    const hasSlug = !/^\d+$/.test(parts[1]);
    const topicPart = hasSlug ? parts[2] : parts[1];
    const postPart = hasSlug ? parts[3] : parts[2];
    if (!topicPart || !/^\d+$/.test(topicPart)) return null;
    return {
      topicId: topicPart,
      targetPostNumber: postPart && /^\d+$/.test(postPart) ? Number(postPart) : null,
    };
  }

  function resolveInitialTarget(topic, requestedTarget) {
    const requested = Number(requestedTarget) || 0;
    if (requested > 0) return requested;
    const lastRead = Number(topic && topic.last_read_post_number) || 0;
    const highest = Number(topic && topic.highest_post_number)
        || Number(topic && topic.posts_count)
        || 1;
    return lastRead > 0 && lastRead < highest ? lastRead + 1 : 1;
  }

  /* ============ 2.5 保存首帖快照到 Obsidian ============ */
  // Markdown 转换与写入流程移植并改编自 zsq 的 MIT 脚本：
  // https://greasyfork.org/zh-CN/scripts/587200-linux-do-%E5%B8%96%E5%AD%90%E4%BF%9D%E5%AD%98%E5%88%B0-obsidian
  const OBSIDIAN_SETTINGS_KEY = 'ldp-obsidian-settings-v1';
  const OBSIDIAN_TOPIC_PATHS_KEY = 'ldp-obsidian-topic-paths-v2';
  const OBSIDIAN_DEFAULT_SETTINGS = {
    mode: 'rest',
    apiUrl: 'http://127.0.0.1:27123',
    apiKey: '',
    vaultName: '',
    baseFolder: '论坛收藏',
  };
  let OBSIDIAN_SAVING = false;
  let OBSIDIAN_SAVE_TEXT = '保存到 Obsidian';
  let CURRENT_OBSIDIAN_DIALOG_CLOSE = null;
  let OBSIDIAN_PAGE_ACTIONS_RAF = 0;
  let OBSIDIAN_CATEGORY_SITE = null;

  function getGMMethod(name) {
    if (typeof GM !== 'undefined' && GM && typeof GM[name] === 'function') {
      return GM[name].bind(GM);
    }
    throw new Error('当前脚本管理器不支持所需的 GM.' + name + ' 接口');
  }

  async function loadObsidianSettings() {
    const stored = await getGMMethod('getValue')(OBSIDIAN_SETTINGS_KEY, {});
    const value = stored && typeof stored === 'object' ? stored : {};
    const settings = Object.assign({}, OBSIDIAN_DEFAULT_SETTINGS, value);
    if (settings.mode !== 'rest' && settings.mode !== 'uri') settings.mode = 'rest';
    return settings;
  }

  async function persistObsidianSettings(settings) {
    await getGMMethod('setValue')(OBSIDIAN_SETTINGS_KEY, settings);
  }

  function obsidianErrorMessage(error) {
    if (error && error.name === 'AbortError') return '操作已取消';
    return error instanceof Error ? error.message : String(error || '未知错误');
  }

  function showObsidianToast(message, type, duration) {
    document.querySelectorAll('.ldp-obsidian-toast').forEach((node) => node.remove());
    const toast = document.createElement('div');
    toast.className = 'ldp-obsidian-toast';
    toast.dataset.type = type || 'info';
    toast.setAttribute('role', type === 'error' ? 'alert' : 'status');
    toast.textContent = message;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), duration || (type === 'error' ? 8000 : 5500));
  }

  function setObsidianSaveState(text, busy) {
    OBSIDIAN_SAVE_TEXT = text;
    OBSIDIAN_SAVING = !!busy;
    document.querySelectorAll('[data-ldp-obsidian-save]').forEach((button) => {
      const label = button.querySelector('.ldp-obsidian-label');
      if (label) label.textContent = text;
      button.disabled = !!busy;
      button.setAttribute('aria-busy', busy ? 'true' : 'false');
    });
    document.querySelectorAll('[data-ldp-obsidian-settings]').forEach((button) => {
      button.disabled = !!busy;
    });
  }

  async function copyTopicUrl(topicId) {
    const topicUrl = `${BASE}/t/${encodeURIComponent(String(topicId))}`;
    try {
      await copyText(topicUrl);
      showObsidianToast('帖子链接已复制', 'success');
    } catch (error) {
      showObsidianToast('复制失败，请检查浏览器剪贴板权限', 'error');
    }
  }

  function createObsidianActionGroup(topicId, topicProvider, extraClass) {
    const group = document.createElement('div');
    group.className = 'ldp-obsidian-actions' + (extraClass ? ` ${extraClass}` : '');
    group.dataset.topicId = String(topicId);
    group.innerHTML = `
      <button type="button" class="ldp-obsidian-save" data-ldp-obsidian-save
        title="将楼主首帖保存为新的 Obsidian 快照" aria-label="保存到 Obsidian">
        <svg viewBox="0 0 24 24" aria-hidden="true">${ICONS.download}</svg>
        <span class="ldp-obsidian-label"></span>
      </button>
      <button type="button" class="ldp-obsidian-copy" data-ldp-obsidian-copy
        title="复制帖子链接" aria-label="复制帖子链接">
        <svg viewBox="0 0 24 24" aria-hidden="true">${ICONS.copy}</svg>
      </button>
      <button type="button" class="ldp-obsidian-settings" data-ldp-obsidian-settings
        title="设置 Obsidian 连接" aria-label="设置 Obsidian 连接">
        <svg viewBox="0 0 24 24" aria-hidden="true">${ICONS.settings}</svg>
      </button>`;
    const saveButton = group.querySelector('[data-ldp-obsidian-save]');
    const copyButton = group.querySelector('[data-ldp-obsidian-copy]');
    const settingsButton = group.querySelector('[data-ldp-obsidian-settings]');
    saveButton.querySelector('.ldp-obsidian-label').textContent = OBSIDIAN_SAVE_TEXT;
    saveButton.disabled = OBSIDIAN_SAVING;
    saveButton.setAttribute('aria-busy', OBSIDIAN_SAVING ? 'true' : 'false');
    settingsButton.disabled = OBSIDIAN_SAVING;
    saveButton.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      const suppliedTopic = typeof topicProvider === 'function' ? topicProvider() : null;
      saveTopicToObsidian(topicId, suppliedTopic);
    });
    copyButton.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      copyTopicUrl(topicId);
    });
    settingsButton.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      showObsidianSettings();
    });
    return group;
  }

  function validateObsidianApiUrl(value) {
    let url;
    try { url = new URL(String(value || '').trim()); }
    catch (error) { throw new Error('REST API 地址格式不正确'); }
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      throw new Error('REST API 只支持 HTTP 或 HTTPS');
    }
    if (url.hostname !== '127.0.0.1' && url.hostname !== 'localhost') {
      throw new Error('为保护 API Key，REST API 地址只允许 localhost 或 127.0.0.1');
    }
    if (url.username || url.password || url.search || url.hash) {
      throw new Error('REST API 地址不能包含账号、查询参数或锚点');
    }
    return url.origin;
  }

  function obsidianGMRequest(options) {
    return new Promise((resolve, reject) => {
      let settled = false;
      const finish = (handler) => (value) => {
        if (settled) return;
        settled = true;
        handler(value);
      };
      const onResolve = finish(resolve);
      const onReject = finish(reject);
      const requestOptions = Object.assign({}, options, {
        timeout: 20000,
        onload: onResolve,
        onerror: () => onReject(new Error('无法连接 Obsidian Local REST API')),
        ontimeout: () => onReject(new Error('连接 Obsidian Local REST API 超时')),
        onabort: () => onReject(new Error('Obsidian 请求已取消')),
      });
      try {
        const request = getGMMethod('xmlHttpRequest')(requestOptions);
        if (request && typeof request.then === 'function') request.then(onResolve, onReject);
      } catch (error) {
        onReject(error);
      }
    });
  }

  async function testObsidianRest(apiUrl, apiKey) {
    const origin = validateObsidianApiUrl(apiUrl);
    if (!String(apiKey || '').trim()) throw new Error('请先填写 Local REST API Key');
    const response = await obsidianGMRequest({
      method: 'GET',
      url: origin + '/',
      headers: { Authorization: `Bearer ${String(apiKey).trim()}` },
    });
    if (response.status < 200 || response.status >= 300) {
      throw new Error('服务响应异常：HTTP ' + response.status);
    }
  }

  async function saveObsidianWithRest(markdown, vaultPath, settings) {
    const origin = validateObsidianApiUrl(settings.apiUrl);
    const apiKey = String(settings.apiKey || '').trim();
    if (!apiKey) throw new Error('请先填写 Local REST API Key');
    const encodedPath = vaultPath.split('/').map(encodeURIComponent).join('/');
    const response = await obsidianGMRequest({
      method: 'PUT',
      url: `${origin}/vault/${encodedPath}`,
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'text/markdown; charset=utf-8',
      },
      data: markdown,
    });
    if (response.status < 200 || response.status >= 300) {
      throw new Error('Obsidian 写入失败：HTTP ' + response.status);
    }
  }

  async function inspectObsidianRestPath(settings, vaultPath, topicId) {
    const origin = validateObsidianApiUrl(settings.apiUrl);
    const apiKey = String(settings.apiKey || '').trim();
    if (!apiKey) throw new Error('请先填写 Local REST API Key');
    const encodedPath = vaultPath.split('/').map(encodeURIComponent).join('/');
    const response = await obsidianGMRequest({
      method: 'GET',
      url: `${origin}/vault/${encodedPath}`,
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    if (response.status === 404) return 'available';
    if (response.status < 200 || response.status >= 300) {
      throw new Error('检查 Obsidian 笔记失败：HTTP ' + response.status);
    }
    const content = String(response.responseText || '');
    const escapedTopicId = String(topicId).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const isSameTopic = new RegExp(`(?:\\*\\*帖子 ID\\*\\*：|topic_id:\\s*)${escapedTopicId}(?:\\s|$)`).test(content);
    return isSameTopic ? 'same-topic' : 'occupied';
  }

  async function saveObsidianWithUri(markdown, vaultPath, settings, overwrite) {
    await getGMMethod('setClipboard')(markdown, 'text');
    const params = new URLSearchParams();
    const vaultName = String(settings.vaultName || '').trim();
    if (vaultName) params.set('vault', vaultName);
    params.set('file', vaultPath);
    params.set('clipboard', 'true');
    if (overwrite) params.set('overwrite', 'true');
    const link = document.createElement('a');
    link.href = `obsidian://new?${params.toString()}`;
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    link.remove();
  }

  async function showObsidianSettings() {
    if (CURRENT_OBSIDIAN_DIALOG_CLOSE) CURRENT_OBSIDIAN_DIALOG_CLOSE(false);
    const settings = await loadObsidianSettings();
    const returnFocus = document.activeElement;
    return new Promise((resolve) => {
      let closed = false;
      const overlay = document.createElement('div');
      overlay.className = 'ldp-obsidian-dialog-overlay';
      overlay.innerHTML = `
        <form class="ldp-obsidian-dialog" role="dialog" aria-modal="true" aria-labelledby="ldp-obsidian-dialog-title">
          <div class="ldp-obsidian-dialog-head">
            <div>
              <h2 id="ldp-obsidian-dialog-title">保存到 Obsidian</h2>
              <p class="ldp-obsidian-dialog-subtitle">同一帖子再次保存时更新原笔记，不创建重复文件</p>
            </div>
            <button type="button" class="ldp-obsidian-dialog-close" title="关闭" aria-label="关闭设置">×</button>
          </div>
          <p class="ldp-obsidian-dialog-note">REST 模式不会切换窗口，但需要 Obsidian 正在运行并启用 Local REST API；URI 模式无需插件，会打开 Obsidian 并使用剪贴板。</p>
          <label for="ldp-obsidian-mode">写入方式</label>
          <select id="ldp-obsidian-mode">
            <option value="rest">直接写入 Vault（推荐）</option>
            <option value="uri">Obsidian URI（会打开 Obsidian）</option>
          </select>
          <div data-ldp-rest-fields>
            <label for="ldp-obsidian-api-url">Local REST API 地址</label>
            <input id="ldp-obsidian-api-url" type="url" inputmode="url" autocomplete="off">
            <label for="ldp-obsidian-api-key">API Key</label>
            <input id="ldp-obsidian-api-key" type="password" autocomplete="off">
            <p class="ldp-obsidian-dialog-help">Key 只保存在油猴私有存储，并且只能发送到本机地址。</p>
            <button type="button" class="ldp-obsidian-test">测试连接</button>
          </div>
          <div data-ldp-uri-fields>
            <label for="ldp-obsidian-vault">Vault 名称</label>
            <input id="ldp-obsidian-vault" type="text" placeholder="留空则使用当前 Vault">
            <p class="ldp-obsidian-dialog-help">保存时会复制 Markdown，并调用 obsidian://new。</p>
          </div>
          <label for="ldp-obsidian-folder">基础目录</label>
          <input id="ldp-obsidian-folder" type="text" placeholder="论坛收藏">
          <p class="ldp-obsidian-dialog-help">实际路径会自动追加站点和帖子标题；同一帖子始终复用原路径。</p>
          <div class="ldp-obsidian-dialog-status" aria-live="polite"></div>
          <div class="ldp-obsidian-dialog-actions">
            <button type="button" class="ldp-obsidian-secondary" data-action="cancel">取消</button>
            <button type="submit" class="ldp-obsidian-primary">保存设置</button>
          </div>
        </form>`;
      document.body.appendChild(overlay);
      const form = overlay.querySelector('form');
      const modeInput = overlay.querySelector('#ldp-obsidian-mode');
      const apiUrlInput = overlay.querySelector('#ldp-obsidian-api-url');
      const apiKeyInput = overlay.querySelector('#ldp-obsidian-api-key');
      const vaultInput = overlay.querySelector('#ldp-obsidian-vault');
      const folderInput = overlay.querySelector('#ldp-obsidian-folder');
      const restFields = overlay.querySelector('[data-ldp-rest-fields]');
      const uriFields = overlay.querySelector('[data-ldp-uri-fields]');
      const status = overlay.querySelector('.ldp-obsidian-dialog-status');
      const testButton = overlay.querySelector('.ldp-obsidian-test');
      modeInput.value = settings.mode;
      apiUrlInput.value = settings.apiUrl;
      apiKeyInput.value = settings.apiKey;
      vaultInput.value = settings.vaultName;
      folderInput.value = settings.baseFolder;

      function updateModeFields() {
        restFields.hidden = modeInput.value !== 'rest';
        uriFields.hidden = modeInput.value !== 'uri';
      }
      function setStatus(message, type) {
        status.textContent = message || '';
        status.dataset.type = type || 'info';
      }
      function close(result) {
        if (closed) return;
        closed = true;
        overlay.remove();
        document.removeEventListener('keydown', onKeyDown, true);
        if (CURRENT_OBSIDIAN_DIALOG_CLOSE === close) CURRENT_OBSIDIAN_DIALOG_CLOSE = null;
        if (returnFocus && returnFocus.isConnected && typeof returnFocus.focus === 'function') {
          returnFocus.focus({ preventScroll: true });
        }
        resolve(result);
      }
      function onKeyDown(event) {
        if (event.key !== 'Escape') return;
        event.preventDefault();
        event.stopImmediatePropagation();
        close(false);
      }
      CURRENT_OBSIDIAN_DIALOG_CLOSE = close;
      modeInput.addEventListener('change', updateModeFields);
      updateModeFields();
      overlay.querySelector('.ldp-obsidian-dialog-close').addEventListener('click', () => close(false));
      overlay.querySelector('[data-action="cancel"]').addEventListener('click', () => close(false));
      overlay.addEventListener('click', (event) => { if (event.target === overlay) close(false); });
      document.addEventListener('keydown', onKeyDown, true);
      testButton.addEventListener('click', async () => {
        testButton.disabled = true;
        setStatus('正在测试连接…');
        try {
          await testObsidianRest(apiUrlInput.value, apiKeyInput.value);
          setStatus('服务连接成功。', 'success');
        } catch (error) {
          setStatus(obsidianErrorMessage(error), 'error');
        } finally {
          testButton.disabled = false;
        }
      });
      form.addEventListener('submit', async (event) => {
        event.preventDefault();
        try {
          const nextSettings = {
            mode: modeInput.value,
            apiUrl: apiUrlInput.value.trim(),
            apiKey: apiKeyInput.value.trim(),
            vaultName: vaultInput.value.trim(),
            baseFolder: folderInput.value.trim() || OBSIDIAN_DEFAULT_SETTINGS.baseFolder,
          };
          if (nextSettings.mode === 'rest') {
            nextSettings.apiUrl = validateObsidianApiUrl(nextSettings.apiUrl);
            if (!nextSettings.apiKey) throw new Error('请填写 Local REST API Key');
          }
          await persistObsidianSettings(nextSettings);
          close(true);
        } catch (error) {
          setStatus(obsidianErrorMessage(error), 'error');
        }
      });
      modeInput.focus({ preventScroll: true });
    });
  }

  function confirmObsidianUpdate(vaultPath) {
    if (CURRENT_OBSIDIAN_DIALOG_CLOSE) CURRENT_OBSIDIAN_DIALOG_CLOSE(false);
    const returnFocus = document.activeElement;
    return new Promise((resolve) => {
      let closed = false;
      const overlay = document.createElement('div');
      overlay.className = 'ldp-obsidian-dialog-overlay';
      overlay.innerHTML = `
        <div class="ldp-obsidian-dialog ldp-obsidian-confirm" role="dialog" aria-modal="true"
          aria-labelledby="ldp-obsidian-confirm-title">
          <div class="ldp-obsidian-confirm-icon" aria-hidden="true">↻</div>
          <h2 id="ldp-obsidian-confirm-title">检测到已保存的帖子</h2>
          <p class="ldp-obsidian-confirm-copy">此帖子已经保存到 Obsidian。继续后会更新原笔记，不会创建重复文件。</p>
          <code class="ldp-obsidian-confirm-path"></code>
          <div class="ldp-obsidian-dialog-actions">
            <button type="button" class="ldp-obsidian-secondary" data-action="cancel">取消</button>
            <button type="button" class="ldp-obsidian-primary" data-action="update">更新原笔记</button>
          </div>
        </div>`;
      document.body.appendChild(overlay);
      overlay.querySelector('.ldp-obsidian-confirm-path').textContent = vaultPath;
      const updateButton = overlay.querySelector('[data-action="update"]');

      function close(result) {
        if (closed) return;
        closed = true;
        overlay.remove();
        document.removeEventListener('keydown', onKeyDown, true);
        if (CURRENT_OBSIDIAN_DIALOG_CLOSE === close) CURRENT_OBSIDIAN_DIALOG_CLOSE = null;
        if (returnFocus && returnFocus.isConnected && typeof returnFocus.focus === 'function') {
          returnFocus.focus({ preventScroll: true });
        }
        resolve(result);
      }
      function onKeyDown(event) {
        if (event.key !== 'Escape') return;
        event.preventDefault();
        event.stopImmediatePropagation();
        close(false);
      }
      CURRENT_OBSIDIAN_DIALOG_CLOSE = close;
      overlay.querySelector('[data-action="cancel"]').addEventListener('click', () => close(false));
      updateButton.addEventListener('click', () => close(true));
      overlay.addEventListener('click', (event) => { if (event.target === overlay) close(false); });
      document.addEventListener('keydown', onKeyDown, true);
      updateButton.focus({ preventScroll: true });
    });
  }

  function makeObsidianAbsoluteUrl(value) {
    if (!value || /^(?:#|data:|mailto:|obsidian:)/i.test(value)) return value;
    try { return new URL(value, BASE + '/').href; }
    catch (error) { return value; }
  }

  function normalizeObsidianCodeLanguage(language, value) {
    const normalized = String(language || '').toLowerCase();
    if (normalized && normalized !== 'auto') return normalized;
    if (/\b(?:irm|invoke-restmethod)\b|\|\s*iex\b|\$env:/i.test(value)) return 'powershell';
    if (/^\s*(?:#!.*\b(?:bash|sh)|(?:sudo\s+)?(?:bash|sh|curl|wget)\b)/im.test(value)) return 'bash';
    const trimmed = String(value || '').trim();
    if (trimmed && /^[\[{]/.test(trimmed)) {
      try { JSON.parse(trimmed); return 'json'; }
      catch (error) { /* 继续按纯文本处理 */ }
    }
    return 'text';
  }

  function quoteObsidianMarkdown(markdown, prefix) {
    const actualPrefix = prefix || '> ';
    return String(markdown || '').split('\n')
        .map((line) => line ? actualPrefix + line : actualPrefix.trimEnd()).join('\n');
  }

  function cookedHtmlToObsidianMarkdown(cooked) {
    const container = document.createElement('div');
    container.innerHTML = cooked || '';
    container.querySelectorAll('script,style,iframe,object,embed,form,button,.lightbox-wrapper .meta')
        .forEach((node) => node.remove());
    container.querySelectorAll('img.emoji').forEach((image) => {
      image.replaceWith(document.createTextNode(image.getAttribute('alt') || ''));
    });
    container.querySelectorAll('a.anchor').forEach((anchor) => anchor.remove());
    const codeBlocks = new Map();
    let codeBlockIndex = 0;

    function renderChildren(element) {
      return Array.from(element.childNodes).map((node) => renderNode(node)).join('');
    }
    function renderList(element, ordered) {
      const items = Array.from(element.children).filter((child) => child.tagName === 'LI');
      return items.map((item, index) => {
        const nestedLists = Array.from(item.children).filter((child) => child.tagName === 'UL' || child.tagName === 'OL');
        const body = Array.from(item.childNodes).filter((node) => !nestedLists.includes(node))
            .map((node) => renderNode(node)).join('').trim().replace(/\n{2,}/g, '\n');
        const marker = ordered ? `${index + 1}. ` : '- ';
        const renderedBody = body.split('\n')
            .map((line, lineIndex) => lineIndex === 0 ? marker + line : '  ' + line).join('\n');
        const renderedNested = nestedLists.map((nested) => renderNode(nested).trim()).filter(Boolean)
            .map((nested) => nested.split('\n').map((line) => '  ' + line).join('\n')).join('\n');
        return [renderedBody, renderedNested].filter(Boolean).join('\n');
      }).join('\n') + '\n\n';
    }
    function renderTable(element) {
      const rows = Array.from(element.rows || []);
      if (!rows.length) return '';
      const values = rows.map((row) => Array.from(row.cells).map((cell) => renderChildren(cell)
          .trim().replace(/\|/g, '\\|').replace(/\s*\n+\s*/g, ' / ')));
      const width = Math.max(...values.map((row) => row.length));
      const normalized = values.map((row) => row.concat(Array.from({ length: width - row.length }, () => '')));
      return [
        `| ${normalized[0].join(' | ')} |`,
        `| ${Array.from({ length: width }, () => '---').join(' | ')} |`,
        ...normalized.slice(1).map((row) => `| ${row.join(' | ')} |`),
        '',
      ].join('\n');
    }
    function renderNode(node) {
      if (node.nodeType === Node.TEXT_NODE) return String(node.nodeValue || '').replace(/[\t\r\n ]+/g, ' ');
      if (node.nodeType !== Node.ELEMENT_NODE) return '';
      const element = node;
      const tag = element.tagName;
      const body = () => renderChildren(element).trim();
      if (tag === 'BR') return '\n';
      if (/^H[1-6]$/.test(tag)) return `${'#'.repeat(Math.min(Number(tag.slice(1)) + 2, 6))} ${body()}\n\n`;
      if (['P', 'DIV', 'SECTION', 'ARTICLE', 'FIGURE', 'FIGCAPTION'].includes(tag)) {
        const content = body();
        return content ? content + '\n\n' : '';
      }
      if (tag === 'STRONG' || tag === 'B') return `**${body()}**`;
      if (tag === 'EM' || tag === 'I') return `*${body()}*`;
      if (tag === 'DEL' || tag === 'S' || tag === 'STRIKE') return `~~${body()}~~`;
      if (tag === 'MARK') return `==${body()}==`;
      if (tag === 'A') {
        const href = makeObsidianAbsoluteUrl(element.getAttribute('href') || '');
        const label = body() || href;
        return href ? `[${label}](${href})` : label;
      }
      if (tag === 'IMG') {
        const source = element.getAttribute('data-orig-src') || element.getAttribute('data-large-uri')
            || element.getAttribute('data-src') || element.getAttribute('src');
        if (!source) return element.getAttribute('alt') || '';
        const alt = String(element.getAttribute('alt') || '图片').replace(/[\[\]]/g, '');
        return `![${alt}](<${makeObsidianAbsoluteUrl(source)}>)`;
      }
      if (tag === 'PRE') {
        const code = element.querySelector('code');
        const value = String((code && code.textContent) || element.textContent || '').replace(/^\n|\n$/g, '');
        const className = (code && code.className) || element.className || '';
        const match = className.match(/(?:lang(?:uage)?-)([\w+-]+)/i);
        const language = match && match[1];
        const runs = Array.from(value.matchAll(/`+/g), (item) => item[0].length + 1);
        const fence = '`'.repeat(Math.max(3, ...runs));
        const token = `LDP_OBSIDIAN_CODE_${codeBlockIndex}_PLACEHOLDER`;
        codeBlockIndex += 1;
        codeBlocks.set(token, `${fence}${normalizeObsidianCodeLanguage(language, value)}\n${value}\n${fence}`);
        return `\n\n${token}\n\n`;
      }
      if (tag === 'CODE') {
        const value = element.textContent || '';
        const runs = Array.from(value.matchAll(/`+/g), (item) => item[0].length + 1);
        const fence = '`'.repeat(Math.max(1, ...runs));
        return `${fence}${value}${fence}`;
      }
      if (tag === 'ASIDE' && element.classList.contains('quote')) {
        const titleElement = element.querySelector('.quote-title__text-content a')
            || element.querySelector('.title a') || element.querySelector('.title');
        const title = String((titleElement && titleElement.textContent) || '引用').replace(/\s+/g, ' ').trim();
        const quoted = element.querySelector('blockquote');
        const content = quoted ? renderChildren(quoted).trim() : body();
        return [`> [!quote] ${title}`, quoteObsidianMarkdown(content), ''].join('\n') + '\n';
      }
      if (tag === 'BLOCKQUOTE') return quoteObsidianMarkdown(body()) + '\n\n';
      if (tag === 'UL') return renderList(element, false);
      if (tag === 'OL') return renderList(element, true);
      if (tag === 'TABLE') return renderTable(element);
      if (tag === 'HR') return '\n---\n\n';
      if (tag === 'KBD') return `\`${element.textContent || ''}\``;
      return renderChildren(element);
    }

    let markdown = renderChildren(container).replace(/\u00a0/g, ' ').replace(/[ \t]+\n/g, '\n')
        .replace(/\n[ \t]+/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
    for (const [token, codeBlock] of codeBlocks) markdown = markdown.replace(token, codeBlock);
    return markdown;
  }

  function formatObsidianDateTime(value) {
    const date = new Date(value);
    if (!Number.isFinite(date.getTime())) return String(value || '');
    return new Intl.DateTimeFormat('zh-CN', {
      year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
      second: '2-digit', hour12: false,
    }).format(date).replaceAll('/', '-');
  }

  function sanitizeObsidianPathSegment(value, fallback) {
    const sanitized = String(value || '').replace(/[<>:"/\\|?*\u0000-\u001f]/g, '-')
        .replace(/\.{2,}/g, '.').replace(/\s+/g, ' ').replace(/[. ]+$/g, '').trim();
    return (sanitized || fallback || '').slice(0, 90);
  }

  function obsidianSiteInfo() {
    if (location.hostname === 'idcflare.com') {
      return { directory: 'IDC Flare', source: 'idcflare.com', tag: 'idc-flare' };
    }
    return { directory: 'LINUX DO', source: 'linux.do', tag: 'linux-do' };
  }

  async function getObsidianCategoryName(topic) {
    const direct = String((topic.category && topic.category.name) || topic.category_name || '').trim();
    if (direct) return direct;
    if (!topic.category_id) return '未分类';
    try {
      if (!OBSIDIAN_CATEGORY_SITE) {
        OBSIDIAN_CATEGORY_SITE = await fetchJSON(`${BASE}/site.json`, { cache: 'force-cache' });
      }
      const categories = OBSIDIAN_CATEGORY_SITE.categories || [];
      const category = categories.find((item) => Number(item.id) === Number(topic.category_id));
      return String((category && category.name) || '').trim() || '未分类';
    } catch (error) {
      return '未分类';
    }
  }

  async function loadObsidianTopic(topicId, suppliedTopic) {
    let topic = suppliedTopic && String(suppliedTopic.id) === String(topicId) ? suppliedTopic : null;
    if (!topic) topic = await fetchJSON(`${BASE}/t/${topicId}.json`, { cache: 'no-store' });
    let firstPost = topic._opPost || ((topic.post_stream && topic.post_stream.posts) || [])
        .find((post) => Number(post.post_number) === 1);
    if (!firstPost) {
      const anchor = await fetchJSON(`${BASE}/t/${topicId}.json?post_number=1`, { cache: 'no-store' });
      firstPost = ((anchor.post_stream && anchor.post_stream.posts) || [])
          .find((post) => Number(post.post_number) === 1);
    }
    if (!firstPost || !firstPost.cooked) throw new Error('没有读取到楼主首帖，可能是帖子权限不足');
    topic._obsidianFirstPost = firstPost;
    topic._obsidianCategoryName = await getObsidianCategoryName(topic);
    return topic;
  }

  function buildObsidianVaultPath(settings, topic, duplicateIndex) {
    const baseSegments = String(settings.baseFolder || OBSIDIAN_DEFAULT_SETTINGS.baseFolder).split('/')
        .map((segment) => sanitizeObsidianPathSegment(segment, '')).filter(Boolean);
    const site = obsidianSiteInfo();
    const title = sanitizeObsidianPathSegment(topic.title, '未命名主题');
    const suffix = duplicateIndex > 1 ? `-${duplicateIndex}` : '';
    const filename = `${title}${suffix}.md`;
    return baseSegments.concat(site.directory, filename).join('/');
  }

  async function resolveObsidianVaultTarget(settings, topic) {
    const stored = await getGMMethod('getValue')(OBSIDIAN_TOPIC_PATHS_KEY, {});
    const topicPaths = stored && typeof stored === 'object' ? stored : {};
    const baseFolderKey = String(settings.baseFolder || OBSIDIAN_DEFAULT_SETTINGS.baseFolder).split('/')
        .map((segment) => sanitizeObsidianPathSegment(segment, '')).filter(Boolean).join('/');
    const site = obsidianSiteInfo();
    const key = `${site.source}|${baseFolderKey}|${topic.id}`;
    if (typeof topicPaths[key] === 'string' && topicPaths[key]) {
      return { key, path: topicPaths[key], topicPaths, isUpdate: true, shouldRemember: false };
    }

    const occupiedPaths = new Set(Object.values(topicPaths).filter((value) => typeof value === 'string'));
    let duplicateIndex = 1;
    let path = buildObsidianVaultPath(settings, topic, duplicateIndex);
    while (true) {
      if (!occupiedPaths.has(path) && settings.mode === 'rest') {
        const pathState = await inspectObsidianRestPath(settings, path, topic.id);
        if (pathState === 'same-topic') {
          return { key, path, topicPaths, isUpdate: true, shouldRemember: true };
        }
        if (pathState === 'available') break;
      } else if (!occupiedPaths.has(path)) {
        break;
      }
      duplicateIndex += 1;
      path = buildObsidianVaultPath(settings, topic, duplicateIndex);
    }
    return { key, path, topicPaths, isUpdate: false, shouldRemember: true };
  }

  async function rememberObsidianVaultTarget(target) {
    if (!target.shouldRemember) return;
    target.topicPaths[target.key] = target.path;
    await getGMMethod('setValue')(OBSIDIAN_TOPIC_PATHS_KEY, target.topicPaths);
  }

  function buildObsidianMarkdown(topic, snapshotDate) {
    const firstPost = topic._obsidianFirstPost;
    const site = obsidianSiteInfo();
    const sourceUrl = `${BASE}/t/${topic.slug || 'topic'}/${topic.id}`;
    const sourceTags = Array.isArray(topic.tags)
      ? topic.tags.map((tag) => typeof tag === 'string' ? tag : tag && tag.name).filter(Boolean)
      : [];
    const tags = Array.from(new Set([site.tag].concat(sourceTags)));
    const author = firstPost.username || firstPost.display_username || 'unknown';
    const tagLine = tags.map((tag) => {
      const normalized = String(tag || '').trim().replace(/^#+/, '').replace(/\s+/g, '-');
      return normalized ? `#${normalized}` : '';
    }).filter(Boolean).join(' ');
    const body = cookedHtmlToObsidianMarkdown(firstPost.cooked);
    const information = [
      '> [!info] 帖子信息',
      `> - **原帖链接**：[打开原帖](${sourceUrl})`,
      `> - **站点**：${site.directory}`,
      `> - **帖子 ID**：${topic.id}`,
      `> - **分类**：${topic._obsidianCategoryName || '未分类'}`,
      `> - **楼主**：@${author}`,
      `> - **发布时间**：${formatObsidianDateTime(firstPost.created_at || topic.created_at)}`,
      `> - **更新时间**：${formatObsidianDateTime(firstPost.updated_at || firstPost.created_at)}`,
      `> - **保存时间**：${formatObsidianDateTime(snapshotDate.toISOString())}`,
    ].join('\n');
    return [information, '', `**标签**： ${tagLine}`, '', '## 主帖', '', body, '',
      `— [返回原帖](${sourceUrl})`, ''].join('\n');
  }

  async function saveTopicToObsidian(topicId, suppliedTopic) {
    if (OBSIDIAN_SAVING) return;
    setObsidianSaveState('准备中…', true);
    try {
      let settings = await loadObsidianSettings();
      if (settings.mode === 'rest' && !String(settings.apiKey || '').trim()) {
        setObsidianSaveState('等待配置…', true);
        const configured = await showObsidianSettings();
        if (!configured) return;
        settings = await loadObsidianSettings();
      }
      setObsidianSaveState('读取首帖…', true);
      const topic = await loadObsidianTopic(topicId, suppliedTopic);
      setObsidianSaveState('转换 Markdown…', true);
      const snapshotDate = new Date();
      const markdown = buildObsidianMarkdown(topic, snapshotDate);
      const vaultTarget = await resolveObsidianVaultTarget(settings, topic);
      const vaultPath = vaultTarget.path;
      if (vaultTarget.isUpdate) {
        setObsidianSaveState('等待确认…', true);
        const shouldUpdate = await confirmObsidianUpdate(vaultPath);
        if (!shouldUpdate) {
          showObsidianToast('已取消更新 Obsidian 笔记', 'info');
          return;
        }
      }
      if (settings.mode === 'rest') {
        setObsidianSaveState('写入 Obsidian…', true);
        await saveObsidianWithRest(markdown, vaultPath, settings);
        await rememberObsidianVaultTarget(vaultTarget);
        showObsidianToast(`${vaultTarget.isUpdate ? '已更新' : '已保存'} Obsidian 笔记：${vaultPath}`, 'success');
      } else {
        setObsidianSaveState('打开 Obsidian…', true);
        await saveObsidianWithUri(markdown, vaultPath, settings, vaultTarget.isUpdate);
        await rememberObsidianVaultTarget(vaultTarget);
        showObsidianToast(`Markdown 已复制，正在${vaultTarget.isUpdate ? '更新' : '创建'} Obsidian 笔记：${vaultPath}`, 'success');
      }
    } catch (error) {
      showObsidianToast(obsidianErrorMessage(error), 'error');
    } finally {
      setObsidianSaveState('保存到 Obsidian', false);
    }
  }

  function syncObsidianPageActions() {
    const parsed = parseTopicHref(location.href);
    const existing = document.querySelector('.ldp-obsidian-page-actions');
    if (!parsed) {
      if (existing) existing.remove();
      return;
    }
    const title = document.querySelector('#topic-title h1, #topic-title .fancy-title, .topic-title h1');
    if (!title) return;
    const host = title.closest('.title-wrapper') || title.parentElement;
    if (!host) return;
    if (existing && existing.parentElement === host && existing.dataset.topicId === String(parsed.topicId)) return;
    if (existing) existing.remove();
    host.appendChild(createObsidianActionGroup(parsed.topicId, null, 'ldp-obsidian-page-actions'));
  }

  function scheduleObsidianPageActions() {
    if (OBSIDIAN_PAGE_ACTIONS_RAF) return;
    OBSIDIAN_PAGE_ACTIONS_RAF = requestAnimationFrame(() => {
      OBSIDIAN_PAGE_ACTIONS_RAF = 0;
      syncObsidianPageActions();
    });
  }

  function startObsidianPageActions() {
    scheduleObsidianPageActions();
    const observer = new MutationObserver(scheduleObsidianPageActions);
    observer.observe(document.documentElement, { childList: true, subtree: true });
    window.addEventListener('popstate', scheduleObsidianPageActions);
    window.addEventListener('hashchange', scheduleObsidianPageActions);
  }

  /* ============ 2.6 Boosts 气泡渲染辅助 ============ */
  function renderBoosts(boosts) {
    if (!boosts || !boosts.length) return '';
    return boosts.map((b) => {
      const bAvatar = b.user && resolveAvatar(b.user.avatar_template, 36);
      const canDel = !!b.can_delete;
      return `<div class="ldp-boost-bubble" data-boost-id="${b.id}">` +
          (bAvatar ? `<img class="ldp-b-avatar" src="${escAttr(bAvatar)}" alt="">` : '') +
          `<p>${b.cooked || ''}</p>` +
          (canDel ? `<button class="ldp-boost-del" title="删除此Boost">×</button>` : '') +
          `</div>`;
    }).join('');
  }

  /* ============ 3. 单图灯箱 ============ */
  function openLightbox(src) {
    if (!src) return;
    const returnFocus = document.activeElement;
    const lb = document.createElement('div');
    lb.className = 'ldp-lightbox';
    lb.setAttribute('role', 'dialog');
    lb.setAttribute('aria-modal', 'true');
    lb.setAttribute('aria-label', '图片预览');
    lb.innerHTML = `
      <button type="button" class="ldp-lb-x" title="关闭（Esc）" aria-label="关闭图片预览">×</button>
      <div class="ldp-lb-stage"><img alt=""></div>`;
    const stage = lb.querySelector('.ldp-lb-stage');
    const img = lb.querySelector('.ldp-lb-stage img');
    const closeBtn = lb.querySelector('.ldp-lb-x');
    img.src = src;
    const close = () => {
      lb.remove();
      document.removeEventListener('keydown', onKey);
      if (returnFocus && returnFocus.isConnected && typeof returnFocus.focus === 'function') {
        returnFocus.focus({ preventScroll: true });
      }
    };
    function onKey(e) { if (e.key === 'Escape') close(); }
    closeBtn.addEventListener('click', close);
    img.addEventListener('click', (e) => { e.stopPropagation(); close(); });
    stage.addEventListener('click', (e) => { if (e.target === stage) close(); });
    document.addEventListener('keydown', onKey);
    document.body.appendChild(lb);
    closeBtn.focus({ preventScroll: true });
  }

  function absoluteUrl(url) {
    if (!url) return '';
    if (/^https?:\/\//i.test(url)) return url;
    if (url.startsWith('//')) return `${location.protocol}${url}`;
    return BASE + (url.startsWith('/') ? url : `/${url}`);
  }

  function userProfileUrl(username) {
    return `${BASE}/u/${encodeURIComponent(username || '')}`;
  }

  function openUserProfile(username) {
    if (!username) return;
    window.open(userProfileUrl(username), '_blank', 'noopener');
  }

  function closeUserCard() {
    if (!CURRENT_USER_CARD) return;
    const { el, cleanup } = CURRENT_USER_CARD;
    CURRENT_USER_CARD = null;
    if (typeof cleanup === 'function') cleanup();
    el.remove();
  }

  function positionUserCard(card, anchor) {
    if (!card || !anchor) return;
    if (!anchor.isConnected) {
      closeUserCard();
      return;
    }
    const rect = anchor.getBoundingClientRect();
    const gap = 8;
    const margin = 12;
    const width = card.offsetWidth || 390;
    const height = card.offsetHeight || 280;
    let left = rect.left;
    let top = rect.bottom + gap;
    if (left + width > window.innerWidth - margin) left = window.innerWidth - width - margin;
    if (top + height > window.innerHeight - margin) top = rect.top - height - gap;
    card.style.left = `${Math.max(margin, left)}px`;
    card.style.top = `${Math.max(margin, top)}px`;
  }

  function formatCount(n) {
    const num = Number(n);
    if (!Number.isFinite(num)) return '';
    if (num >= 10000) return `${(num / 1000).toFixed(num >= 100000 ? 0 : 1)}k`;
    return String(num);
  }

  function userCardStat(label, value) {
    const text = formatCount(value);
    return text ? `<div class="ldp-user-card-stat"><strong>${esc(text)}</strong><span>${esc(label)}</span></div>` : '';
  }

  function renderUserCard(user, username) {
    const profileUsername = user.username || username;
    const avatar = resolveAvatar(user.avatar_template, 160);
    const cover = absoluteUrl(user.card_background_upload_url || user.profile_background_upload_url || '');
    const name = user.name || profileUsername;
    const title = user.title || user.primary_group_name || '';
    const bio = stripHtml(user.bio_excerpt || user.bio_cooked || user.bio_raw || '');
    const website = user.website || user.website_name || '';
    const websiteUrl = website && (/^https?:\/\//i.test(website) ? website : `https://${website}`);
    const locationText = user.location || (user.custom_fields && user.custom_fields.location) || '';
    const summary = user.summary || {};
    const statsHtml = [
      userCardStat('帖子', user.post_count ?? summary.post_count),
      userCardStat('主题', user.topic_count ?? summary.topic_count),
      userCardStat('获赞', user.likes_received ?? summary.likes_received),
    ].filter(Boolean).join('');
    const meta = [
      title ? `<div>头衔：${esc(title)}</div>` : '',
      locationText ? `<div>位置：${esc(locationText)}</div>` : '',
      website ? `<div>网站：<a href="${escAttr(websiteUrl)}" target="_blank" rel="noopener">${esc(website.replace(/^https?:\/\//i, ''))}</a></div>` : '',
      user.created_at ? `<div>加入：${esc(fmtTime(user.created_at))}</div>` : '',
    ].filter(Boolean).join('');

    return `
      <div class="ldp-user-card-cover"${cover ? ` style="background-image:linear-gradient(135deg,rgba(255,255,255,.55),rgba(255,255,255,.82)),url('${escAttr(cover)}')"` : ''}></div>
      <div class="ldp-user-card-body">
        <div class="ldp-user-card-main">
          <button type="button" class="ldp-user-card-avatar" title="打开用户主页" aria-label="打开 ${escAttr(profileUsername)} 的用户主页" data-profile-username="${escAttr(profileUsername)}">
            ${avatar ? `<img src="${escAttr(avatar)}" alt="">` : ''}
          </button>
          <div class="ldp-user-card-name">
            <strong>${esc(name)}</strong>
            <span>@${esc(profileUsername)}</span>
          </div>
        </div>
        ${bio ? `<div class="ldp-user-card-bio">${esc(bio.slice(0, 140))}${bio.length > 140 ? '…' : ''}</div>` : ''}
        ${meta ? `<div class="ldp-user-card-meta">${meta}</div>` : ''}
        ${statsHtml ? `<div class="ldp-user-card-stats">${statsHtml}</div>` : ''}
      </div>`;
  }

  async function openUserCard(username, anchor) {
    if (!username || !anchor) return;
    closeUserCard();
    const card = document.createElement('div');
    card.className = 'ldp-user-card';
    card.setAttribute('role', 'dialog');
    card.setAttribute('aria-label', `${username} 的个人详情`);
    card.innerHTML = `<div class="ldp-user-card-loading">正在加载 @${esc(username)} 的个人详情…</div>`;
    document.body.appendChild(card);
    positionUserCard(card, anchor);

    const closeOnOutside = (e) => {
      if (card.contains(e.target) || anchor.contains(e.target)) return;
      closeUserCard();
    };
    const closeOnEsc = (e) => { if (e.key === 'Escape') closeUserCard(); };
    const reposition = () => positionUserCard(card, anchor);
    const cleanup = () => {
      document.removeEventListener('click', closeOnOutside, true);
      document.removeEventListener('keydown', closeOnEsc);
      window.removeEventListener('resize', reposition);
      window.removeEventListener('scroll', reposition, true);
    };
    CURRENT_USER_CARD = { el: card, cleanup };
    setTimeout(() => {
      if (CURRENT_USER_CARD && CURRENT_USER_CARD.el === card) {
        document.addEventListener('click', closeOnOutside, true);
      }
    }, 0);
    document.addEventListener('keydown', closeOnEsc);
    window.addEventListener('resize', reposition);
    window.addEventListener('scroll', reposition, true);

    card.addEventListener('click', (e) => {
      const avatarBtn = e.target.closest('.ldp-user-card-avatar');
      if (!avatarBtn) return;
      e.preventDefault();
      e.stopPropagation();
      openUserProfile(avatarBtn.dataset.profileUsername || username);
      closeUserCard();
    });

    try {
      let data = USER_CARD_CACHE.get(username);
      if (!data) {
        data = await fetchJSON(`${BASE}/u/${encodeURIComponent(username)}/card.json`);
        USER_CARD_CACHE.set(username, data);
      }
      if (!CURRENT_USER_CARD || CURRENT_USER_CARD.el !== card) return;
      const user = data.user || data;
      card.innerHTML = renderUserCard(user, username);
      positionUserCard(card, anchor);
    } catch (err) {
      if (!CURRENT_USER_CARD || CURRENT_USER_CARD.el !== card) return;
      card.innerHTML = `<div class="ldp-user-card-error">个人详情加载失败：${esc(err.message)}</div>`;
      positionUserCard(card, anchor);
    }
  }

  function isElement(node) {
    return node && node.nodeType === Node.ELEMENT_NODE;
  }

  function fmtDate(iso) {
    if (!iso) return '';
    const d = new Date(iso);
    if (isNaN(d.getTime())) return '';
    return `${d.getMonth() + 1}月 ${d.getDate()}日`;
  }

  function closestElement(node, selector) {
    const el = isElement(node) ? node : node && node.parentElement;
    return el ? el.closest(selector) : null;
  }

  function isImageAnchor(anchor) {
    if (!anchor) return false;
    const href = anchor.getAttribute('href') || anchor.getAttribute('data-download-href') || '';
    return anchor.classList.contains('lightbox') ||
      anchor.hasAttribute('data-download-href') ||
      /\.(png|jpe?g|gif|webp|bmp|avif)(\?|#|$)/i.test(href);
  }

  function resolveOriginalSrc(sourceEl) {
    const anchorSelector = 'a[href], a[data-download-href]';
    const anchor = sourceEl.matches(anchorSelector) ? sourceEl : sourceEl.closest(anchorSelector);
    const imgEl = sourceEl.matches('img') ? sourceEl :
      (anchor && anchor.querySelector('img'));
    if (isImageAnchor(anchor)) {
      const href = anchor.getAttribute('href') || anchor.getAttribute('data-download-href');
      if (href) return href;
    }
    return imgEl && (imgEl.getAttribute('data-large-src') || imgEl.currentSrc || imgEl.src);
  }

  function findImagePreviewSource(target, root) {
    const content = closestElement(target, '.ldp-content');
    if (!content || !root.contains(content)) return null;

    const anchor = closestElement(target, 'a[href], a[data-download-href]');
    if (anchor && content.contains(anchor) && isImageAnchor(anchor)) return anchor;

    const img = closestElement(target, 'img');
    if (img && content.contains(img)) return img;

    const wrapper = closestElement(target, '.lightbox-wrapper, .image-wrapper, .image-container, .lazyYT-container');
    if (!wrapper || !content.contains(wrapper)) return null;

    const wrapperAnchor = wrapper.querySelector('a.lightbox, a[data-download-href], a[href]');
    if (isImageAnchor(wrapperAnchor)) return wrapperAnchor;

    return wrapper.querySelector('img');
  }

  function interceptImagePreviewClick(e, root) {
    const source = findImagePreviewSource(e.target, root);
    if (!source) return false;
    const src = resolveOriginalSrc(source);
    if (!src) return false;

    e.preventDefault();
    e.stopPropagation();
    if (typeof e.stopImmediatePropagation === 'function') e.stopImmediatePropagation();
    openLightbox(src);
    return true;
  }

  /* ============ 3.5 Base64 解码 ============ */
  function decodeBase64ToUnicode(raw) {
    const normalized = String(raw || '').trim().replace(/\s+/g, '');
    if (!normalized) return null;
    try {
      const binary = atob(normalized);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      return new TextDecoder('utf-8').decode(bytes);
    } catch (e) {
      return null;
    }
  }

  function copyText(text) {
    if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
      return navigator.clipboard.writeText(text);
    }
    return new Promise((resolve, reject) => {
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.setAttribute('readonly', '');
      Object.assign(textarea.style, {
        position: 'fixed', left: '-9999px', top: '0', opacity: '0',
      });
      document.body.appendChild(textarea);
      textarea.select();
      try {
        if (!document.execCommand('copy')) throw new Error('copy failed');
        resolve();
      } catch (e) {
        reject(e);
      } finally {
        textarea.remove();
      }
    });
  }

  function createDecodedBlock(decodedText) {
    const wrapper = document.createElement('div');
    wrapper.className = 'md-codeblock ldp-base64-result';
    wrapper.setAttribute('data-base64-decoded', 'true');

    const pre = document.createElement('pre');
    const code = document.createElement('code');
    code.textContent = decodedText;
    pre.appendChild(code);

    const toolbar = document.createElement('div');
    toolbar.className = 'codeblock-button-wrapper ldp-base64-toolbar';

    const copyBtn = document.createElement('button');
    copyBtn.type = 'button';
    copyBtn.className = 'btn nohighlight btn-flat ldp-base64-copy';
    const copyIcon = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M16 1H4a2 2 0 0 0-2 2v12h2V3h12V1Zm3 4H8a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2Zm0 16H8V7h11v14Z"/></svg>';
    copyBtn.innerHTML = copyIcon;
    copyBtn.title = '复制解码文本';
    copyBtn.setAttribute('aria-label', '复制解码文本');
    copyBtn.addEventListener('click', async (e) => {
      e.preventDefault();
      e.stopPropagation();
      copyBtn.disabled = true;
      try {
        await copyText(decodedText);
        copyBtn.textContent = '已复制';
        copyBtn.classList.add('copied');
        copyBtn.title = '已复制';
        setTimeout(() => {
          if (!copyBtn.isConnected) return;
          copyBtn.innerHTML = copyIcon;
          copyBtn.classList.remove('copied');
          copyBtn.title = '复制解码文本';
          copyBtn.disabled = false;
        }, 2000);
      } catch (err) {
        copyBtn.disabled = false;
        alert('复制失败，请手动复制');
      }
    });

    const closeBtn = document.createElement('button');
    closeBtn.type = 'button';
    closeBtn.className = 'btn nohighlight btn-flat ldp-base64-close';
    closeBtn.textContent = '×';
    closeBtn.title = '关闭';
    closeBtn.setAttribute('aria-label', '关闭解码结果');
    closeBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      wrapper.remove();
    });

    toolbar.append(copyBtn, closeBtn);
    wrapper.append(pre, toolbar);
    return wrapper;
  }

  function enhanceCodeBlocks(root) {
    if (!root) return;
    root.querySelectorAll('.ldp-content pre').forEach((pre) => {
      if (pre.closest('.ldp-base64-result')) return;
      if (pre.parentElement && pre.parentElement.querySelector(':scope > .codeblock-button-wrapper')) return;

      const code = pre.querySelector('code');
      const codeText = (code || pre).textContent || '';
      let host = pre.parentElement;
      if (!host || (!host.classList.contains('md-codeblock') && !host.classList.contains('highlight'))) {
        host = document.createElement('div');
        pre.insertAdjacentElement('beforebegin', host);
        host.appendChild(pre);
      }
      host.classList.add('ldp-codeblock-host');

      const toolbar = document.createElement('div');
      toolbar.className = 'codeblock-button-wrapper ldp-codeblock-toolbar';
      const copyBtn = document.createElement('button');
      copyBtn.type = 'button';
      copyBtn.className = 'btn nohighlight btn-flat ldp-code-copy';
      copyBtn.title = '复制代码';
      copyBtn.setAttribute('aria-label', '复制代码');
      const copyIcon = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M16 1H4a2 2 0 0 0-2 2v12h2V3h12V1Zm3 4H8a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2Zm0 16H8V7h11v14Z"/></svg>';
      const copiedIcon = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 16.2-3.5-3.5-1.4 1.4L9 19 20.3 7.7l-1.4-1.4L9 16.2Z"/></svg>';
      copyBtn.innerHTML = copyIcon;
      copyBtn.addEventListener('click', async (e) => {
        e.preventDefault();
        e.stopPropagation();
        copyBtn.disabled = true;
        try {
          await copyText(codeText);
          copyBtn.innerHTML = copiedIcon;
          copyBtn.title = '已复制';
          setTimeout(() => {
            if (!copyBtn.isConnected) return;
            copyBtn.innerHTML = copyIcon;
            copyBtn.title = '复制代码';
            copyBtn.disabled = false;
          }, 2000);
        } catch (err) {
          copyBtn.disabled = false;
          alert('复制失败，请手动复制');
        }
      });

      toolbar.appendChild(copyBtn);
      host.appendChild(toolbar);
    });
  }

  function insertDecodedBlock(decodedText, range) {
    if (!range || !range.commonAncestorContainer || !range.commonAncestorContainer.isConnected) return null;
    const wrapper = createDecodedBlock(decodedText);
    const endEl = isElement(range.endContainer) ? range.endContainer : range.endContainer.parentElement;
    const contentRoot = endEl && endEl.closest('.ldp-content, .topic-post .cooked, article .cooked');
    const block = endEl && endEl.closest('p, pre, blockquote');

    if (contentRoot && block && contentRoot.contains(block)) {
      block.insertAdjacentElement('afterend', wrapper);
    } else if (contentRoot) {
      let anchor = endEl;
      while (anchor && anchor.parentElement && anchor.parentElement !== contentRoot) {
        anchor = anchor.parentElement;
      }
      if (anchor && anchor.parentElement === contentRoot) {
        if (anchor.tagName === 'LI') anchor.appendChild(wrapper);
        else anchor.insertAdjacentElement('afterend', wrapper);
      } else {
        contentRoot.appendChild(wrapper);
      }
    } else {
      const insertionRange = range.cloneRange();
      insertionRange.collapse(false);
      insertionRange.insertNode(wrapper);
    }

    const selection = window.getSelection();
    if (selection) selection.removeAllRanges();
    wrapper.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    return wrapper;
  }

  function getSelectionSnapshot(requiredRoot) {
    const selection = window.getSelection();
    if (!selection || !selection.rangeCount || selection.isCollapsed) return null;
    const raw = selection.toString().trim();
    if (!raw) return null;
    const range = selection.getRangeAt(0);
    if (requiredRoot) {
      const startEl = isElement(range.startContainer) ? range.startContainer : range.startContainer.parentElement;
      const endEl = isElement(range.endContainer) ? range.endContainer : range.endContainer.parentElement;
      const startContent = startEl && startEl.closest('.ldp-content');
      const endContent = endEl && endEl.closest('.ldp-content');
      if (!startContent || startContent !== endContent || !requiredRoot.contains(startContent)) return null;
    }
    return { raw, range: range.cloneRange() };
  }

  function decodeSelectionSnapshot(snapshot) {
    if (!snapshot) {
      alert('请先选中一段 Base64 文本');
      return false;
    }
    const decoded = decodeBase64ToUnicode(snapshot.raw);
    if (decoded === null) {
      alert('解码失败，请确认内容是有效的 Base64 编码');
      return false;
    }
    return !!insertDecodedBlock(decoded, snapshot.range);
  }

  function addBase64DecodeButton(menu) {
    if (!menu) return;
    const existingButton = Array.from(menu.querySelectorAll('button')).find((button) =>
      button.classList.contains('ldp-base64-decode-btn') ||
      button.title === 'Base64 解码' ||
      (button.querySelector('.d-button-label') || {}).textContent === 'Base64解码'
    );
    if (existingButton) {
      menu.dataset.base64DecodeAdded = 'true';
      return;
    }
    const buttons = menu.querySelector('.quote-button .buttons') || menu.querySelector('.buttons');
    if (!buttons) return;

    menu.dataset.base64DecodeAdded = 'true';
    const decodeBtn = document.createElement('button');
    decodeBtn.type = 'button';
    decodeBtn.className = 'btn btn-icon-text btn-flat ldp-base64-decode-btn';
    decodeBtn.title = 'Base64 解码';
    decodeBtn.innerHTML = '<span class="fa d-icon" aria-hidden="true">🔓</span><span class="d-button-label">Base64解码</span>';

    let snapshot = null;
    decodeBtn.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      snapshot = getSelectionSnapshot();
    });
    decodeBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      decodeSelectionSnapshot(snapshot || getSelectionSnapshot());
      snapshot = null;
    });
    buttons.appendChild(decodeBtn);
  }

  function startBase64MenuObserver() {
    const portal = document.getElementById('d-menu-portals');
    if (!portal) {
      setTimeout(startBase64MenuObserver, 500);
      return;
    }

    portal.querySelectorAll('div.fk-d-menu').forEach(addBase64DecodeButton);
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        mutation.addedNodes.forEach((node) => {
          if (!isElement(node)) return;
          const parentMenu = node.matches('div.fk-d-menu') ? node : node.closest('div.fk-d-menu');
          if (parentMenu) addBase64DecodeButton(parentMenu);
          node.querySelectorAll('div.fk-d-menu').forEach(addBase64DecodeButton);
        });
      });
    });
    observer.observe(portal, { childList: true, subtree: true });
  }

  function bindModalBase64Selection(modal) {
    const menu = document.createElement('div');
    menu.className = 'ldp-base64-selection-menu';
    menu.hidden = true;
    menu.innerHTML = '<button type="button" title="Base64 解码"><span aria-hidden="true">🔓</span><span>Base64解码</span></button>';
    document.body.appendChild(menu);

    const button = menu.querySelector('button');
    const scrollRoot = modal.querySelector('.ldp-body');
    let snapshot = null;
    let frame = 0;

    const hide = () => {
      menu.hidden = true;
      snapshot = null;
    };
    const show = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const current = getSelectionSnapshot(modal);
        if (!current) {
          hide();
          return;
        }
        snapshot = current;
        const rect = current.range.getBoundingClientRect();
        if (!rect || (!rect.width && !rect.height)) {
          hide();
          return;
        }
        menu.hidden = false;
        const width = menu.offsetWidth;
        const height = menu.offsetHeight;
        const left = Math.max(8, Math.min(window.innerWidth - width - 8,
          rect.left + (rect.width / 2) - (width / 2)));
        let top = rect.top - height - 8;
        if (top < 8) top = Math.min(window.innerHeight - height - 8, rect.bottom + 8);
        menu.style.left = `${left}px`;
        menu.style.top = `${Math.max(8, top)}px`;
      });
    };
    const onPointerDown = (e) => {
      if (menu.contains(e.target)) return;
      hide();
    };
    const onKeyDown = (e) => {
      if (e.key !== 'Escape' || menu.hidden) return;
      e.preventDefault();
      e.stopPropagation();
      hide();
    };
    const onKeyUp = (e) => {
      if (e.shiftKey || e.key.startsWith('Arrow') || e.key === 'Home' || e.key === 'End') show();
    };

    button.addEventListener('pointerdown', (e) => e.preventDefault());
    button.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const current = snapshot;
      hide();
      decodeSelectionSnapshot(current);
    });
    modal.addEventListener('mouseup', show);
    modal.addEventListener('keyup', onKeyUp);
    document.addEventListener('pointerdown', onPointerDown, true);
    document.addEventListener('keydown', onKeyDown, true);
    window.addEventListener('resize', hide);
    if (scrollRoot) scrollRoot.addEventListener('scroll', hide, { passive: true });

    return () => {
      cancelAnimationFrame(frame);
      menu.remove();
      modal.removeEventListener('mouseup', show);
      modal.removeEventListener('keyup', onKeyUp);
      document.removeEventListener('pointerdown', onPointerDown, true);
      document.removeEventListener('keydown', onKeyDown, true);
      window.removeEventListener('resize', hide);
      if (scrollRoot) scrollRoot.removeEventListener('scroll', hide);
    };
  }

  /* ============ 4. 已读追踪器 ============ */
  function createReadTracker(topicId, scrollRoot) {
    const dwell = new Map();
    const reported = new Map();
    const visible = new Set();
    let readWaterline = 1;
    let lastTick = Date.now();
    let tickTimer = null, flushTimer = null;

    const io = new IntersectionObserver((entries) => {
      entries.forEach((en) => {
        const pn = +en.target.dataset.postNumber;
        if (!pn) return;
        if (en.isIntersecting && en.intersectionRatio >= 0.5) visible.add(pn);
        else visible.delete(pn);
      });
    }, { root: scrollRoot, threshold: [0, 0.5, 1] });

    const tick = () => {
      const now = Date.now();
      const delta = now - lastTick;
      lastTick = now;
      if (document.visibilityState === 'visible') {
        visible.forEach((pn) => dwell.set(pn, (dwell.get(pn) || 0) + delta));
      }
    };

    const markReadThrough = (pn) => {
      readWaterline = Math.max(readWaterline, Number(pn) || 1);
      scrollRoot.querySelectorAll('.ldp-post[data-post-number]').forEach((node) => {
        const nodePn = +node.dataset.postNumber;
        if (!nodePn || nodePn > readWaterline) return;
        node.classList.add('ldp-read');
        node.classList.remove('ldp-unread');
      });
    };

    const flush = async () => {
      const params = { topic_id: topicId };
      let total = 0, any = false;
      dwell.forEach((ms, pn) => {
        if (ms < READ_THRESHOLD) return;
        const inc = ms - (reported.get(pn) || 0);
        if (inc <= 0) return;
        params[`timings[${pn}]`] = inc;
        total += inc;
        reported.set(pn, ms);
        any = true;
      });
      if (!any) return;
      params.topic_time = total;
      try {
        await apiSend(`${BASE}/topics/timings`, 'POST', params, { 'X-SILENCE-LOGGER': 'true' });
        let maxReadPostNumber = 0;
        Object.keys(params).forEach((k) => {
          const m = k.match(/^timings\[(\d+)\]$/);
          if (m) maxReadPostNumber = Math.max(maxReadPostNumber, +m[1]);
        });
        if (maxReadPostNumber) markReadThrough(maxReadPostNumber);
      } catch (e) {
        Object.keys(params).forEach((k) => {
          const m = k.match(/^timings\[(\d+)\]$/);
          if (m) reported.set(+m[1], (reported.get(+m[1]) || 0) - params[k]);
        });
      }
    };

    return {
      getReadWaterline() { return readWaterline; },
      setReadWaterline(pn) { readWaterline = Math.max(1, Number(pn) || 0); },
      observe(node) { if (node) io.observe(node); },
      unobserve(node) { if (node) { io.unobserve(node); visible.delete(+node.dataset.postNumber); } },
      start() {
        lastTick = Date.now();
        tickTimer = setInterval(tick, 1000);
        flushTimer = setInterval(flush, FLUSH_INTERVAL);
      },
      stop() {
        clearInterval(tickTimer);
        clearInterval(flushTimer);
        io.disconnect();
        tick();
        flush();
      },
    };
  }

  /* ============ 5. 加载器 ============ */
  function createLoader(topicId, signal) {
    let stream = [];
    let streamIndex = new Map();
    const cache = new Map();
    let topic = null;
    let upCursor = 0;
    let downCursor = 0;
    let topReached = false;
    let bottomReached = false;

    async function fetchSlice(ids, requestSignal) {
      const missing = ids.filter((id) => !cache.has(id));
      if (!missing.length) return;
      const qs = missing.map((id) => `post_ids[]=${id}`).join('&');
      const part = await fetchJSON(`${BASE}/t/${topicId}/posts.json?${qs}`, {
        signal: requestSignal || signal,
      });
      ((part.post_stream && part.post_stream.posts) || []).forEach((p) => cache.set(p.id, p));
    }

    async function init() {
      const topicPromise = fetchJSON(`${BASE}/t/${topicId}.json?track_visit=true&forceLoad=true`, {
        cache: 'no-store',
        headers: {
          'Accept': 'application/json, text/javascript, */*; q=0.01',
          'X-Requested-With': 'XMLHttpRequest',
          'Discourse-Present': 'true',
          'Discourse-Track-View': 'true',
          'Discourse-Track-View-Topic-Id': String(topicId),
        },
        signal,
      });
      const mePromise = ensureMe(signal).catch(() => {});
      const data = await topicPromise;
      await mePromise;
      topic = data;
      const initialPosts = (data.post_stream && data.post_stream.posts) || [];
      initialPosts.forEach((p) => cache.set(p.id, p));
      stream = ((data.post_stream && data.post_stream.stream) || []).filter((id) => {
        const post = cache.get(id);
        return !(post && post.post_number === 1);
      });
      streamIndex = new Map(stream.map((id, index) => [String(id), index]));
      const op = (topic.details && topic.details.created_by && topic.details.created_by.username)
          || (initialPosts.find((p) => p.post_number === 1) || {}).username
          || null;
      topic._opUsername = op;
      topic._opPost = initialPosts.find((p) => p.post_number === 1) || null;
      return topic;
    }

    function nearestPost(posts, requestedPostNumber) {
      const sorted = posts.slice().sort((a, b) => a.post_number - b.post_number);
      return sorted.find((p) => p.post_number === requestedPostNumber)
          || sorted.find((p) => p.post_number > requestedPostNumber)
          || sorted[sorted.length - 1]
          || null;
    }

    function windowBounds(targetIndex) {
      if (!stream.length) return { start: 0, end: 0, targetIndex: -1 };
      const safeIndex = Math.max(0, Math.min(stream.length - 1, Number(targetIndex) || 0));
      return {
        start: Math.max(0, safeIndex - SLICE_RADIUS),
        end: Math.min(stream.length, safeIndex + SLICE_RADIUS + 1),
        targetIndex: safeIndex,
      };
    }

    async function prepareWindowByIndex(targetIndex, requestSignal) {
      const bounds = windowBounds(targetIndex);
      const ids = stream.slice(bounds.start, bounds.end);
      await fetchSlice(ids, requestSignal);
      const target = bounds.targetIndex >= 0 ? cache.get(stream[bounds.targetIndex]) : null;
      return Object.assign(bounds, {
        posts: ids.map((id) => cache.get(id)).filter(Boolean),
        targetPostNumber: target ? target.post_number : 1,
      });
    }

    async function prepareWindowByPostNumber(targetPostNumber, requestSignal) {
      if (!targetPostNumber || targetPostNumber <= 1 || !stream.length) {
        const result = await prepareWindowByIndex(0, requestSignal);
        result.targetPostNumber = 1;
        return result;
      }

      let safeIdx = null;
      let resolvedTarget = Number(targetPostNumber);
      try {
        const anchor = await fetchJSON(`${BASE}/t/${topicId}.json?post_number=${resolvedTarget}`, {
          signal: requestSignal || signal,
        });
        const anchorPosts = (anchor.post_stream && anchor.post_stream.posts) || [];
        anchorPosts.forEach((p) => cache.set(p.id, p));
        const nearest = nearestPost(anchorPosts, resolvedTarget);
        if (nearest) {
          resolvedTarget = nearest.post_number;
          const idx = streamIndex.get(String(nearest.id));
          if (idx !== undefined) safeIdx = idx;
        }
      } catch (err) {
        if (err && err.name === 'AbortError') throw err;
      }

      if (safeIdx === null) {
        safeIdx = Math.min(Math.max(0, resolvedTarget - 2), Math.max(0, stream.length - 1));
      }

      const result = await prepareWindowByIndex(safeIdx, requestSignal);
      const nearest = nearestPost(result.posts, resolvedTarget);
      result.targetPostNumber = nearest ? nearest.post_number : resolvedTarget;
      return result;
    }

    async function prepareDown(requestSignal) {
      if (bottomReached) return { posts: [], done: true };
      const start = downCursor;
      const end = Math.min(stream.length, downCursor + PAGE_SIZE);
      const ids = stream.slice(start, end);
      await fetchSlice(ids, requestSignal);
      return {
        posts: ids.map((id) => cache.get(id)).filter(Boolean),
        start,
        end,
        done: end >= stream.length,
      };
    }

    async function prepareUp(requestSignal) {
      if (topReached) return { posts: [], done: true };
      const start = Math.max(0, upCursor - PAGE_SIZE);
      const ids = stream.slice(start, upCursor);
      await fetchSlice(ids, requestSignal);
      return {
        posts: ids.map((id) => cache.get(id)).filter(Boolean),
        start,
        end: upCursor,
        done: start === 0,
      };
    }

    function activateWindow(result) {
      upCursor = result.start || 0;
      downCursor = result.end || 0;
      topReached = upCursor === 0;
      bottomReached = downCursor >= stream.length;
    }

    function activateDown(result) {
      downCursor = result.end;
      bottomReached = !!result.done;
    }

    function activateUp(result) {
      upCursor = result.start;
      topReached = !!result.done;
    }

    function activateRange(start, end) {
      upCursor = Math.max(0, Number(start) || 0);
      downCursor = Math.max(upCursor, Math.min(stream.length, Number(end) || 0));
      topReached = upCursor === 0;
      bottomReached = downCursor >= stream.length;
    }

    return {
      init, prepareWindowByIndex, prepareWindowByPostNumber, prepareDown, prepareUp,
      activateWindow, activateDown, activateUp, activateRange,
      get streamLength() { return stream.length; },
      getStreamId(index) { return stream[index]; },
      getStreamIndex(postId) {
        const index = streamIndex.get(String(postId));
        return index === undefined ? -1 : index;
      },
      getCachedByIndex(index) { return cache.get(stream[index]) || null; },
      get topic() { return topic; },
      get topReached() { return topReached; },
      get bottomReached() { return bottomReached; },
    };
  }

  /* ============ 6. 楼层归位 ============ */
  function attachPost(p, ctx) {
    if (p.post_number === 1) {
      const node = renderPost(p, false, ctx);
      ctx.topicEl.appendChild(node);
      ctx.tracker.observe(node);
      if (ctx.onPostsChanged) ctx.onPostsChanged();
      return;
    }
    if (ctx.nodeMap.has(p.post_number)) return;

    const parentNum = p.reply_to_post_number;
    const node = renderPost(p, !!(parentNum && parentNum !== 1), ctx);
    ctx.nodeMap.set(p.post_number, node);

    const parentNode = parentNum && parentNum !== 1 ? ctx.nodeMap.get(parentNum) : null;
    if (parentNum && parentNum !== 1 && !parentNode) {
      ctx.pending.push({ num: p.post_number, parent: parentNum });
      ctx.commentsEl.appendChild(node);
    } else if (parentNode) {
      parentNode.querySelector(':scope > .ldp-children').appendChild(node);
    } else {
      ctx.commentsEl.appendChild(node);
    }
    ctx.tracker.observe(node);
    // 仅当该楼层确实存在回复时才纳入楼中楼观察队列（减少无意义的 IO 开销）
    if (p.reply_count > 0) ctx.repliesIO.observe(node);
    if (ctx.onPostsChanged) ctx.onPostsChanged();
  }

  function reflowPending(ctx) {
    if (!ctx.pending.length) return;
    const rest = [];
    ctx.pending.forEach((it) => {
      const child = ctx.nodeMap.get(it.num);
      const parent = ctx.nodeMap.get(it.parent);
      if (child && parent) {
        parent.querySelector(':scope > .ldp-children').appendChild(child);
      } else {
        rest.push(it);
      }
    });
    ctx.pending = rest;
  }

  function insertPostsBatch(posts, ctx, position) {
    if (!posts || !posts.length) return 0;
    const fragment = document.createDocumentFragment();
    const tempCtx = Object.assign({}, ctx, { commentsEl: fragment, onPostsChanged: null });
    posts.forEach((post) => attachPost(post, tempCtx));
    reflowPending(tempCtx);
    ctx.pending = tempCtx.pending;
    if (position === 'prepend') ctx.commentsEl.prepend(fragment);
    else ctx.commentsEl.appendChild(fragment);
    return posts.length;
  }

  function reflowRenderedPosts(ctx) {
    const nodes = Array.from(ctx.nodeMap.values())
      .filter((node) => node && node.isConnected)
      .sort((a, b) => (+a.dataset.postNumber || 0) - (+b.dataset.postNumber || 0));
    const rootFragment = document.createDocumentFragment();
    nodes.forEach((node) => {
      const parentNumber = +node.dataset.replyToPostNumber || 0;
      const parent = parentNumber > 1 ? ctx.nodeMap.get(parentNumber) : null;
      if (parent && parent.isConnected) {
        const children = parent.querySelector(':scope > .ldp-children');
        if (children) children.appendChild(node);
      } else {
        rootFragment.appendChild(node);
      }
    });
    ctx.commentsEl.appendChild(rootFragment);
  }

  function cleanupPostNode(node, ctx) {
    if (!node) return;
    const nodes = [node, ...node.querySelectorAll('.ldp-post[data-post-number]')];
    nodes.forEach((item) => {
      ctx.tracker.unobserve(item);
      if (ctx.repliesIO && ctx.repliesIO.clearNode) ctx.repliesIO.clearNode(item);
      ctx.subReplyState.delete(+item.dataset.postNumber);
    });
    node.remove();
  }

  function clearCommentsWindow(ctx) {
    Array.from(ctx.commentsEl.querySelectorAll('.ldp-post[data-post-number]'))
      .forEach((node) => {
        ctx.tracker.unobserve(node);
        if (ctx.repliesIO && ctx.repliesIO.clearNode) ctx.repliesIO.clearNode(node);
      });
    ctx.nodeMap.clear();
    ctx.pending = [];
    ctx.subReplyState.clear();
    ctx.commentsEl.innerHTML = '<div class="ldp-comments-empty">暂无评论</div>';
    ctx.emptyEl = ctx.commentsEl.querySelector('.ldp-comments-empty');
    updateCommentsHeader(ctx);
  }

  function trimRenderedRange(ctx, loader, keepStart, keepEnd) {
    const removed = [];
    ctx.nodeMap.forEach((node, postNumber) => {
      const index = loader.getStreamIndex(node.dataset.postId);
      if (index >= keepStart && index < keepEnd) return;
      ctx.nodeMap.delete(postNumber);
      removed.push(node);
    });
    // 先把仍需保留的嵌套回复移出将删除的父节点，再清理旧节点。
    reflowRenderedPosts(ctx);
    removed.forEach((node) => cleanupPostNode(node, ctx));
    ctx.pending = ctx.pending.filter((item) => ctx.nodeMap.has(item.num));
    loader.activateRange(keepStart, keepEnd);
  }

  function captureScrollAnchor(scrollRoot) {
    const rootRect = scrollRoot.getBoundingClientRect();
    const posts = Array.from(scrollRoot.querySelectorAll('.ldp-post[data-post-number]'));
    const node = posts.find((post) => post.getBoundingClientRect().bottom > rootRect.top + 1);
    return node ? { node, offset: node.getBoundingClientRect().top - rootRect.top } : null;
  }

  async function restoreScrollAnchor(scrollRoot, anchor) {
    await new Promise((resolve) => requestAnimationFrame(resolve));
    if (!anchor || !anchor.node.isConnected) return;
    const rootTop = scrollRoot.getBoundingClientRect().top;
    scrollRoot.scrollTop += anchor.node.getBoundingClientRect().top - rootTop - anchor.offset;
  }

  /* ============ 7. 渲染单条 ============ */
  function renderPost(p, isReply, ctx) {
    const avatar = resolveAvatar(p.avatar_template, 48);
    const { count, acted, canAct } = likeInfo(p);
    const isOP = ctx.op && p.username === ctx.op;
    const isME = ME_USERNAME && p.username === ME_USERNAME;
    const time = fmtTime(p.created_at);

    const cooked = p.cooked || '';

    // Boosts 数据
    const boostsHtml = renderBoosts(p.boosts || []);
    const canBoost = p.can_boost === true;

    const lastReadPostNumber = Math.max(1, Number(
      ctx.tracker && ctx.tracker.getReadWaterline ? ctx.tracker.getReadWaterline() : ctx.lastReadPostNumber
    ) || 0);
    const isUnread = !p._ldpSkipUnread && p.post_number > lastReadPostNumber;

    const node = document.createElement('div');
    node.className = 'ldp-post' + (isReply ? ' ldp-reply' : '') + (isUnread ? ' ldp-unread' : '');
    node.dataset.postId = p.id;
    node.dataset.postNumber = p.post_number;
    node.dataset.createdAt = p.created_at || '';
    node.dataset.replyToPostNumber = p.reply_to_post_number || 0;
    node.dataset.windowEpoch = String(ctx.windowEpoch || 0);
    node.innerHTML = `
      <div class="ldp-post-head">
        ${avatar ? `<button type="button" class="ldp-avatar-btn" title="查看 ${escAttr(p.username)} 的个人详情" aria-label="查看 ${escAttr(p.username)} 的个人详情" data-username="${escAttr(p.username)}"><img class="ldp-avatar" src="${escAttr(avatar)}" alt="" loading="lazy" decoding="async"></button>` : ''}
        <span class="ldp-author">${esc(p.name || p.username)}</span>
        <span class="ldp-user">@${esc(p.username)}</span>
        ${isOP ? '<span class="ldp-op">OP</span>' : ''}
        ${isME ? '<span class="ldp-me">ME</span>' : ''}
        ${time ? `<span class="ldp-time">· ${esc(time)}</span>` : ''}
        <span class="ldp-floor">#${p.post_number}</span>
        <span class="ldp-unread-dot" title="未读" aria-label="未读"></span>
      </div>
      <div class="ldp-content">${cooked}</div>
      <div class="ldp-boosts-list">${boostsHtml}</div>
      <div class="ldp-boost-input-wrap">
        <input type="text" class="ldp-boost-input" maxlength="50"
          placeholder="Boost ${esc(p.username)}… (最多16字符)">
        <button class="ldp-boost-submit" title="发送">✓</button>
        <button class="ldp-boost-cancel" title="取消">×</button>
      </div>
      <div class="ldp-actions">
        <button class="ldp-btn ldp-like ${acted ? 'liked' : ''}"
          data-acted="${acted ? '1' : '0'}" ${canAct || acted ? '' : 'disabled'} title="点赞">
            <svg viewBox="0 0 24 24" style="width:14px;height:14px;fill:currentColor;vertical-align:middle;">${ICONS.like}</svg>
          <span class="ldp-like-count">${count}</span>
        </button>
        <button class="ldp-btn ldp-replybtn" title="回复">
            <svg viewBox="0 0 1024 1024" style="width:12px;height:12px;fill:currentColor;vertical-align:middle;">${ICONS.reply}</svg>
        </button>
        <button class="ldp-btn ldp-boost-btn" ${canBoost ? '' : 'disabled'} title="Boost">
          <svg viewBox="0 0 1024 1024" style="width:12px;height:12px;fill:currentColor;vertical-align:middle;">${ICONS.boost}</svg>
        </button>
      </div>
      <div class="ldp-children"></div>
      <div class="ldp-sub-loading">加载楼中楼中…</div>
      <div class="ldp-sub-actions"><button class="ldp-btn ldp-load-more-replies">展示更多回复 ↓</button></div>
    `;
    const content = node.querySelector('.ldp-content');
    content.querySelectorAll('a[href]').forEach((anchor) => {
      if (!isImageAnchor(anchor) && !anchor.getAttribute('target')) anchor.setAttribute('target', '_blank');
    });
    content.querySelectorAll('img').forEach((img) => {
      if (!img.hasAttribute('loading')) img.setAttribute('loading', 'lazy');
      if (!img.hasAttribute('decoding')) img.setAttribute('decoding', 'async');
    });
    content.querySelectorAll('iframe').forEach((iframe) => {
      if (!iframe.hasAttribute('loading')) iframe.setAttribute('loading', 'lazy');
    });
    enhanceCodeBlocks(node);
    return node;
  }

  /* ============ 8. 回复框 ============ */
  function ensureReplyBox(post) {
    let box = post.querySelector(':scope > .ldp-replybox');
    if (box) return box;
    const username = (post.querySelector(':scope > .ldp-post-head .ldp-user')?.textContent || '').replace(/^@/, '');
    box = document.createElement('div');
    box.className = 'ldp-replybox';
    box.innerHTML = `<textarea placeholder="回复 @${esc(username)} … (最少16个字符)"></textarea><button class="ldp-send">发送</button><span class="ldp-reply-tip">✓ 已发送</span>`;

    const textarea = box.querySelector('textarea');
    bindPasteEvent(textarea); // 绑定粘贴事件

    const actions = post.querySelector(':scope > .ldp-actions');
    if (actions) actions.after(box);
    else post.appendChild(box);
    return box;
  }

  /* ============ 图片粘贴上传逻辑 ============ */
  async function uploadImage(file) {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('type', 'composer');
    formData.append('synchronous', 'true');
    return apiSend(`${BASE}/uploads.json`, 'POST', formData);
  }

  function insertAtCursor(textarea, text) {
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const val = textarea.value;
    textarea.value = val.substring(0, start) + text + val.substring(end);
    textarea.selectionStart = textarea.selectionEnd = start + text.length;
    textarea.focus();
  }

  function bindPasteEvent(textarea) {
    textarea.addEventListener('paste', async (e) => {
      const items = (e.clipboardData || e.originalEvent.clipboardData).items;
      for (const item of items) {
        if (item.type.indexOf('image') !== -1) {
          e.preventDefault();
          const file = item.getAsFile();
          if (!file) continue;

          const originalPlaceholder = `\n[正在上传图片 ${file.name} ...]\n`;
          insertAtCursor(textarea, originalPlaceholder);
          textarea.classList.add('uploading');

          try {
            const res = await uploadImage(file);
            if (res && res.short_url) {
              // Discourse 返回的 short_url 通常是 upload://xxx 格式
              // 构造 Markdown 引用
              const markdown = `\n![${res.original_filename}|${res.width}x${res.height}](${res.short_url})\n`;
              textarea.value = textarea.value.replace(originalPlaceholder, markdown);
            } else {
              throw new Error('上传返回数据异常');
            }
          } catch (err) {
            textarea.value = textarea.value.replace(originalPlaceholder, `\n[图片上传失败: ${err.message}]\n`);
          } finally {
            textarea.classList.remove('uploading');
          }
        }
      }
    });
  }

  /* ============ 9. 楼中楼分批渲染 ============ */
  function renderSubReplyBatch(postNumber, ctx) {
    const state = ctx.subReplyState.get(postNumber);
    const parentNode = ctx.nodeMap.get(postNumber) || (ctx.topicEl.querySelector(`.ldp-post[data-post-number="${postNumber}"]`));
    if (!state || !parentNode) return;

    const start = state.renderedCount;
    const limit = start === 0 ? SUB_REPLY_INITIAL_SIZE : SUB_REPLY_PAGE_SIZE;
    const batch = state.all.slice(start, start + limit);

    const batchCtx = Object.assign({}, ctx, { onPostsChanged: null });
    batch.forEach((rp) => {
      if (!rp.reply_to_post_number) rp.reply_to_post_number = postNumber;
      attachPost(rp, batchCtx);
    });
    state.renderedCount += batch.length;
    reflowPending(batchCtx);
    ctx.pending = batchCtx.pending;
    if (ctx.onPostsChanged) ctx.onPostsChanged();

    const actionEl = parentNode.querySelector(':scope > .ldp-sub-actions');
    const btnEl = actionEl && actionEl.querySelector('.ldp-load-more-replies');
    const remaining = state.all.length - state.renderedCount;
    if (remaining > 0) {
      if (actionEl) actionEl.style.display = 'block';
      if (btnEl) btnEl.textContent = `展示更多回复（还剩 ${remaining} 条） ↓`;
    } else if (actionEl) {
      actionEl.style.display = 'none';
    }
  }

  /* ============ 10. 事件委托 ============ */
  function bindActions(modal, ctx) {
    // 先于站点和浏览器默认链接行为接管 Discourse 图片、黑色信息条和右下角放大控件。
    modal.addEventListener('click', (e) => {
      interceptImagePreviewClick(e, modal);
    }, true);

    modal.addEventListener('click', async (e) => {
      // 图片本体及其文件名/尺寸/右下角放大控件统一使用脚本灯箱，避免跳转到 CDN 原图页
      if (interceptImagePreviewClick(e, modal)) return;

      // 允许内容区 <a target="_blank"> 正常跳转
      const anchor = e.target.closest('a');
      if (anchor && anchor.target === '_blank') return;

      const avatarBtn = e.target.closest('.ldp-avatar-btn');
      if (avatarBtn) {
        e.preventDefault();
        e.stopPropagation();
        openUserCard(avatarBtn.dataset.username, avatarBtn);
        return;
      }

      // 楼中楼“展示更多回复”按钮
      const moreBtn = e.target.closest('.ldp-load-more-replies');
      if (moreBtn) {
        const post = moreBtn.closest('.ldp-post');
        renderSubReplyBatch(+post.dataset.postNumber, ctx);
        return;
      }

      const postNode = e.target.closest('.ldp-post');
      if (!postNode) return;
      const postId = postNode.dataset.postId, postNumber = +postNode.dataset.postNumber;

      const likeBtn = e.target.closest('.ldp-like');
      if (likeBtn && !likeBtn.disabled) {
        const countEl = likeBtn.querySelector('.ldp-like-count'), acted = likeBtn.dataset.acted === '1';
        likeBtn.disabled = true;
        try {
          if (!acted) {
            await apiSend(`${BASE}/post_actions`, 'POST', { id: postId, post_action_type_id: 2, flag_topic: false });
            likeBtn.classList.add('liked'); likeBtn.dataset.acted = '1';
            countEl.textContent = (+countEl.textContent) + 1;
          } else {
            await apiSend(`${BASE}/post_actions/${postId}?post_action_type_id=2`, 'DELETE');
            likeBtn.classList.remove('liked'); likeBtn.dataset.acted = '0';
            countEl.textContent = Math.max(0, (+countEl.textContent) - 1);
          }
        } catch (err) { alert('操作失败：' + err.message); } finally { likeBtn.disabled = false; }
        return;
      }

      const replyBtn = e.target.closest('.ldp-replybtn');
      if (replyBtn) {
        const box = ensureReplyBox(postNode);
        box.classList.toggle('open');
        if (box.classList.contains('open')) box.querySelector('textarea').focus();
        return;
      }

      // Boost按钮：展开/收起输入框
      const boostBtn = e.target.closest('.ldp-boost-btn');
      if (boostBtn && !boostBtn.disabled) {
        const wrap = postNode.querySelector(':scope > .ldp-boost-input-wrap');
        if (!wrap) return;
        const opening = !wrap.classList.contains('open');
        wrap.classList.toggle('open', opening);
        if (opening) wrap.querySelector('.ldp-boost-input').focus();
        return;
      }

      // 🚀 取消发射
      const boostCancel = e.target.closest('.ldp-boost-cancel');
      if (boostCancel) {
        const wrap = boostCancel.closest('.ldp-boost-input-wrap');
        if (wrap) { wrap.classList.remove('open'); wrap.querySelector('.ldp-boost-input').value = ''; }
        return;
      }

      // 🚀 确认发射
      const boostSubmit = e.target.closest('.ldp-boost-submit');
      if (boostSubmit && !boostSubmit.disabled) {
        const wrap = boostSubmit.closest('.ldp-boost-input-wrap');
        const input = wrap && wrap.querySelector('.ldp-boost-input');
        const raw = input ? input.value.trim() : '';
        if (!raw) { input && input.focus(); return; }
        if (raw.length > 16) { alert('Boost内容不能超过16个字符'); return; }
        boostSubmit.disabled = true;
        try {
          const res = await apiSend(`${BASE}/discourse-boosts/posts/${postId}/boosts`, 'POST', { raw });
          if (res && res.id) {
            // 追加新气泡
            const listEl = postNode.querySelector(':scope > .ldp-boosts-list');
            if (listEl) {
              const bAvatar = res.user && resolveAvatar(res.user.avatar_template, 36);
              const newBubble = document.createElement('div');
              newBubble.className = 'ldp-boost-bubble ldp-flash';
              newBubble.dataset.boostId = res.id;
              newBubble.innerHTML =
                  (bAvatar ? `<img class="ldp-b-avatar" src="${escAttr(bAvatar)}" alt="">` : '') +
                  `<p>${res.cooked || ''}</p>` +
                  `<button class="ldp-boost-del" title="删除此Boost">×</button>`;
              listEl.appendChild(newBubble);
            }
            input.value = '';
            wrap.classList.remove('open');

            const btn = postNode.querySelector(':scope > .ldp-actions > .ldp-boost-btn');
            if (btn) btn.disabled = true;

            if (postNumber === 1) {
              const fBoost = ctx.scrollRoot.closest('.ldp-modal').querySelector('.ldp-f-boost');
              if (fBoost) {
                fBoost.disabled = true;
                fBoost.style.opacity = '0.4';
              }
            }
          }
        } catch (err) { alert('发射失败：' + err.message); }
        finally { boostSubmit.disabled = false; }
        return;
      }

      // 删除 Boost 气泡
      const boostDel = e.target.closest('.ldp-boost-del');
      if (boostDel) {
        const bubble = boostDel.closest('.ldp-boost-bubble');
        const boostId = bubble && bubble.dataset.boostId;
        if (!boostId) return;
        try {
          await apiSend(`${BASE}/discourse-boosts/boosts/${boostId}`, 'DELETE');
          bubble.remove();

          const btn = postNode.querySelector(':scope > .ldp-actions > .ldp-boost-btn');
          if (btn) btn.disabled = false;

          if (postNumber === 1) {
            const fBoost = ctx.scrollRoot.closest('.ldp-modal').querySelector('.ldp-f-boost');
            if (fBoost) {
              fBoost.disabled = false;
              fBoost.style.opacity = '1';
            }
          }
        } catch (err) { alert('删除失败：' + err.message); }
        return;
      }

      // 发送回复
      const sendBtn = e.target.closest('.ldp-send');
      if (sendBtn) {
        const box = sendBtn.closest('.ldp-replybox'),
            textarea = box.querySelector('textarea'),
            raw = textarea.value.trim();
        if (!raw) return;
        if (raw.length < 16) { alert('帖子必须至少为16个字符'); return; }

        sendBtn.disabled = true;
        sendBtn.textContent = '发送中…';

        try {
          const data = await apiSend(`${BASE}/posts`, 'POST', {
            raw,
            topic_id: ctx.topicId,
            reply_to_post_number: postNumber,
            nested_post: true,
          });

          // 拿到回复数据
          const postData = data && data.post ? data.post : data;

          if (postData && postData.cooked) {
            const isTopLevel = postNumber === 1; // 回复楼主帖时按普通顶级评论处理，而非楼中楼
            const newNode = renderPost({
              id: postData.id,
              post_number: postData.post_number,
              username: postData.username || ME_USERNAME,
              name: postData.name,
              avatar_template: postData.avatar_template,
              cooked: postData.cooked,
              created_at: postData.created_at || new Date().toISOString(),
              reply_to_post_number: postNumber,
              actions_summary: [],
              boosts: [],
              can_boost: true,
              _ldpSkipUnread: true,
            }, !isTopLevel, ctx);

            newNode.classList.add('ldp-flash');

            if (isTopLevel) {
              ctx.commentsEl.prepend(newNode);
              newNode.scrollIntoView({ behavior: 'smooth', block: 'center' });
            } else {
              const childrenContainer = postNode.querySelector(':scope > .ldp-children');
              childrenContainer.prepend(newNode);
            }

            ctx.nodeMap.set(postData.post_number, newNode);
            ctx.tracker.observe(newNode);
            ctx.totalComments = (ctx.totalComments || 0) + 1;
            updateCommentsHeader(ctx);
            if (ctx.onPostsChanged) ctx.onPostsChanged();

            const tip = box.querySelector('.ldp-reply-tip');
            if (tip) {
              tip.classList.add('show');
              setTimeout(() => tip.classList.remove('show'), 1500);
            }

            box.classList.remove('open');
            textarea.value = '';
          }
        } catch (err) {
          alert('回复失败：' + err.message);
        } finally {
          sendBtn.disabled = false;
          sendBtn.textContent = '发送';
        }
        return;
      }
    });
  }

  /* ============ 11. 楼中楼补全（分批渲染 + 节流 + 停顿检测） ============ */
  function createRepliesIO(ctx) {
    const fetched = new Set();
    const hoverTimers = new Map();

    const observer = new IntersectionObserver((entries) => {
      entries.forEach((en) => {
        const postId = en.target.dataset.postId;
        const postNumber = +en.target.dataset.postNumber;
        if (!postId) return;

        if (en.isIntersecting) {
          const cachedReplies = ctx.subReplyCache.get(postId);
          if (cachedReplies && !ctx.subReplyState.has(postNumber)) {
            ctx.subReplyState.set(postNumber, { all: cachedReplies, renderedCount: 0 });
            renderSubReplyBatch(postNumber, ctx);
            return;
          }
          if (fetched.has(postId) || hoverTimers.has(postId)) return;
          // 停顿检测：楼层需在视口停留 REPLIES_HOVER_DELAY 才真正发起请求，快速划过则不触发
          const timer = setTimeout(async () => {
            hoverTimers.delete(postId);
            if (!en.target.isConnected || ctx.windowEpoch !== Number(en.target.dataset.windowEpoch)) return;
            fetched.add(postId);
            const loadingEl = en.target.querySelector(':scope > .ldp-sub-loading');
            if (loadingEl) loadingEl.style.display = 'block';
            try {
              const replies = await fetchJSON(`${BASE}/posts/${postId}/replies.json`, { signal: ctx.signal });
              if (!en.target.isConnected || ctx.windowEpoch !== Number(en.target.dataset.windowEpoch)) return;
              if (loadingEl) loadingEl.style.display = 'none';
              if (!replies || !replies.length) return;
              ctx.subReplyCache.set(postId, replies);
              ctx.subReplyState.set(postNumber, { all: replies, renderedCount: 0 });
              renderSubReplyBatch(postNumber, ctx); // 首批只渲染 SUB_REPLY_INITIAL_SIZE 条
            } catch (e) {
              if (loadingEl) loadingEl.style.display = 'none';
              fetched.delete(postId); // 失败允许下次进入视口重试
            }
          }, REPLIES_HOVER_DELAY);
          hoverTimers.set(postId, timer);
        } else {
          // 离开视口时若尚未真正发起请求，则取消该次触发
          if (hoverTimers.has(postId)) {
            clearTimeout(hoverTimers.get(postId));
            hoverTimers.delete(postId);
          }
        }
      });
    }, { root: ctx.scrollRoot, rootMargin: '120px', threshold: 0.1 });

    const clearNode = (node) => {
      if (!node) return;
      observer.unobserve(node);
      const postId = node.dataset.postId;
      if (postId && hoverTimers.has(postId)) {
        clearTimeout(hoverTimers.get(postId));
        hoverTimers.delete(postId);
      }
    };
    const nativeDisconnect = observer.disconnect.bind(observer);
    observer.clearNode = clearNode;
    observer.disconnect = () => {
      hoverTimers.forEach((timer) => clearTimeout(timer));
      hoverTimers.clear();
      nativeDisconnect();
    };
    return observer;
  }

  /* ============ 12. 收藏 ============ */
  function bindBookmark(btn, topic) {
    let bookmarked = !!topic.bookmarked, bookmarkId = topic.bookmark_id || null;
    const textEl = btn.querySelector('.ldp-f-bookmark-text') || btn;
    const sync = () => { btn.classList.toggle('bookmarked', bookmarked); };
    sync();
    btn.addEventListener('click', async () => {
      btn.disabled = true;
      try {
        if (!bookmarked) {
          const data = await apiSend(`${BASE}/bookmarks`, 'POST', { bookmarkable_id: topic.id, bookmarkable_type: 'Topic' });
          bookmarkId = data && data.id ? data.id : bookmarkId; bookmarked = true;
        } else if (bookmarkId) {
          await apiSend(`${BASE}/bookmarks/${bookmarkId}`, 'DELETE'); bookmarked = false; bookmarkId = null;
        } else { await apiSend(`${BASE}/t/${topic.id}/remove_bookmarks`, 'PUT'); bookmarked = false; }
        sync();
      } catch (err) { alert('收藏操作失败：' + err.message); } finally { btn.disabled = false; }
    });
  }

  /* 底部悬浮操作栏的点赞按钮：对楼主帖（1 楼）执行点赞/取消点赞 */
  function bindFooterLike(btn, countEl, opPost) {
    if (!opPost) { btn.disabled = true; return; }
    const { count, acted, canAct } = likeInfo(opPost);
    let liked = acted;
    countEl.textContent = count;
    btn.classList.toggle('liked', liked);
    btn.disabled = !(canAct || acted);
    btn.addEventListener('click', async () => {
      if (btn.disabled) return;
      btn.disabled = true;
      try {
        if (!liked) {
          await apiSend(`${BASE}/post_actions`, 'POST', { id: opPost.id, post_action_type_id: 2, flag_topic: false });
          liked = true; btn.classList.add('liked');
          countEl.textContent = (+countEl.textContent) + 1;
        } else {
          await apiSend(`${BASE}/post_actions/${opPost.id}?post_action_type_id=2`, 'DELETE');
          liked = false; btn.classList.remove('liked');
          countEl.textContent = Math.max(0, (+countEl.textContent) - 1);
        }
      } catch (err) { alert('操作失败：' + err.message); } finally { btn.disabled = false; }
    });
  }

  function updateCommentsHeader(ctx) {
    if (ctx.countEl) ctx.countEl.textContent = ctx.totalComments ? `（${ctx.totalComments}）` : '';
    if (ctx.emptyEl) ctx.emptyEl.style.display = ctx.totalComments ? 'none' : '';
    if (ctx.footerReplyCountEl) ctx.footerReplyCountEl.textContent = ctx.totalComments || 0;
  }

  function bindTimeline(modal, ctx, topic, controls) {
    const rail = modal.querySelector('.ldp-timeline');
    if (!rail) return { refresh() {}, destroy() {} };

    const body = ctx.scrollRoot;
    const topDateBtn = rail.querySelector('.ldp-tl-top-date');
    const bottomDateBtn = rail.querySelector('.ldp-tl-bottom-date');
    const currentText = rail.querySelector('.ldp-tl-current-post');
    const currentDate = rail.querySelector('.ldp-tl-current-date');
    const track = rail.querySelector('.ldp-tl-track');
    const fill = rail.querySelector('.ldp-tl-fill');
    const thumb = rail.querySelector('.ldp-tl-thumb');
    const totalPosts = Math.max(1, topic.highest_post_number || topic.posts_count || ctx.totalComments + 1);
    const streamLength = controls.getStreamLength();
    let raf = 0;
    let seeking = false;
    let cachedPosts = [];
    let currentPost = null;
    let trackHeight = Math.max(1, track.clientHeight - 16);
    let lastRatio = -1;
    let lastPercent = -1;
    let lastPostNumber = -1;
    let lastDate = null;
    let lastSeeking = null;
    let seekToken = 0;
    let destroyed = false;

    topDateBtn.textContent = fmtDate(topic.created_at) || '顶部';
    bottomDateBtn.textContent = fmtDate(topic.last_posted_at || topic.bumped_at) || '底部';
    track.setAttribute('aria-valuemin', '1');
    track.setAttribute('aria-valuemax', String(totalPosts));

    const visiblePost = () => {
      if (!cachedPosts.length) return null;
      const bodyRect = body.getBoundingClientRect();
      const probeX = bodyRect.left + Math.max(1, bodyRect.width * 0.5);
      const probeY = bodyRect.top + Math.min(bodyRect.height * 0.35, 180);
      const hit = document.elementFromPoint(probeX, probeY);
      const hitPost = hit && hit.closest ? hit.closest('.ldp-post[data-post-number]') : null;
      if (hitPost && body.contains(hitPost)) currentPost = hitPost;
      if (!currentPost || !currentPost.isConnected) {
        currentPost = body.scrollTop <= 1 ? cachedPosts[0] : cachedPosts[cachedPosts.length - 1];
      }
      return currentPost;
    };

    const setProgress = () => {
      const post = visiblePost();
      const postNumber = post ? (+post.dataset.postNumber || 1) : 1;
      const streamIndex = postNumber <= 1 ? -1 : controls.getStreamIndex(post.dataset.postId);
      const ratio = streamLength
        ? Math.max(0, Math.min(1, (streamIndex + 1) / streamLength))
        : 0;
      if (Math.abs(ratio - lastRatio) >= 0.0005) {
        fill.style.transform = `translateX(-50%) scaleY(${ratio})`;
        thumb.style.transform = `translate(-50%,-50%) translateY(${ratio * trackHeight}px)`;
        lastRatio = ratio;
      }
      const percent = Math.round(ratio * 100);
      if (percent !== lastPercent) {
        track.setAttribute('aria-valuenow', String(postNumber));
        lastPercent = percent;
      }

      if (postNumber !== lastPostNumber) {
        currentText.textContent = `${postNumber} / ${totalPosts}`;
        lastPostNumber = postNumber;
      }
      const date = seeking ? '正在定位…' : (post ? (fmtDate(post.dataset.createdAt) || '当前') : '当前');
      if (date !== lastDate) {
        currentDate.textContent = date;
        lastDate = date;
      }
      if (seeking !== lastSeeking) {
        rail.setAttribute('aria-busy', seeking ? 'true' : 'false');
        track.setAttribute('aria-busy', seeking ? 'true' : 'false');
        lastSeeking = seeking;
      }
    };

    const schedule = () => {
      if (destroyed || raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        setProgress();
      });
    };

    const seek = async (index, targetPostNumber) => {
      const token = ++seekToken;
      seeking = true;
      rail.classList.add('ldp-tl-loading');
      currentDate.textContent = '正在定位…';
      schedule();
      try {
        await controls.seekToIndex(index, targetPostNumber);
      } catch (err) {
        if (!(err && err.name === 'AbortError')) throw err;
      } finally {
        if (token !== seekToken) return;
        seeking = false;
        rail.classList.remove('ldp-tl-loading');
        lastDate = null;
        schedule();
      }
    };

    const jumpTop = () => seek(0, 1);
    const jumpBottom = () => seek(Math.max(0, streamLength - 1));
    const jumpByRatio = (ratio) => {
      const safeRatio = Math.max(0, Math.min(1, ratio));
      if (!streamLength || safeRatio <= 0) return jumpTop();
      const index = Math.max(0, Math.min(streamLength - 1, Math.round(safeRatio * streamLength) - 1));
      return seek(index);
    };

    const onTrackClick = (e) => {
      const rect = track.getBoundingClientRect();
      jumpByRatio((e.clientY - rect.top) / Math.max(1, rect.height));
    };

    const onTrackKeydown = (e) => {
      if (e.key === 'Home') { e.preventDefault(); jumpTop(); }
      else if (e.key === 'End') { e.preventDefault(); jumpBottom(); }
      else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') { e.preventDefault(); jumpByRatio((lastRatio < 0 ? 0 : lastRatio) - 1 / Math.max(1, streamLength)); }
      else if (e.key === 'ArrowDown' || e.key === 'ArrowRight') { e.preventDefault(); jumpByRatio((lastRatio < 0 ? 0 : lastRatio) + 1 / Math.max(1, streamLength)); }
      else if (e.key === 'PageUp') { e.preventDefault(); body.scrollBy({ top: -body.clientHeight * 0.8, behavior: 'smooth' }); }
      else if (e.key === 'PageDown') { e.preventDefault(); body.scrollBy({ top: body.clientHeight * 0.8, behavior: 'smooth' }); }
    };

    const refresh = () => {
      cachedPosts = Array.from(body.querySelectorAll('.ldp-post[data-post-number]'))
        .sort((a, b) => (+a.dataset.postNumber || 0) - (+b.dataset.postNumber || 0));
      if (!currentPost || !currentPost.isConnected) currentPost = cachedPosts[0] || null;
      schedule();
    };

    const resizeObserver = new ResizeObserver(() => {
      trackHeight = Math.max(1, track.clientHeight - 16);
      lastRatio = -1;
      schedule();
    });

    topDateBtn.addEventListener('click', jumpTop);
    bottomDateBtn.addEventListener('click', jumpBottom);
    track.addEventListener('click', onTrackClick);
    track.addEventListener('keydown', onTrackKeydown);
    body.addEventListener('scroll', schedule, { passive: true });
    resizeObserver.observe(track);
    resizeObserver.observe(ctx.topicEl);
    resizeObserver.observe(ctx.commentsEl);
    refresh();

    return {
      refresh,
      destroy() {
        destroyed = true;
        cancelAnimationFrame(raf);
        resizeObserver.disconnect();
        topDateBtn.removeEventListener('click', jumpTop);
        bottomDateBtn.removeEventListener('click', jumpBottom);
        track.removeEventListener('click', onTrackClick);
        track.removeEventListener('keydown', onTrackKeydown);
        body.removeEventListener('scroll', schedule);
      },
    };
  }

  /* 骨架屏 HTML */
  const SKELETON_HTML = `
    <div class="ldp-sk-head">
      <div class="ldp-sk ldp-sk-avatar"></div>
      <div class="ldp-sk ldp-sk-line ldp-sk-w40"></div>
    </div>
    <div class="ldp-sk-para">
      <div class="ldp-sk ldp-sk-line ldp-sk-w100"></div>
      <div class="ldp-sk ldp-sk-line ldp-sk-w90"></div>
      <div class="ldp-sk ldp-sk-line ldp-sk-w80"></div>
      <div class="ldp-sk ldp-sk-line ldp-sk-w60"></div>
    </div>
    <div class="ldp-sk-divider"></div>
    <div class="ldp-sk-comment">
      <div class="ldp-sk ldp-sk-avatar"></div>
      <div class="ldp-sk-cbody ldp-sk-para">
        <div class="ldp-sk ldp-sk-line ldp-sk-w30"></div>
        <div class="ldp-sk ldp-sk-line ldp-sk-w90"></div>
        <div class="ldp-sk ldp-sk-line ldp-sk-w60"></div>
      </div>
    </div>`;

  function waitForScrollEnd(el, timeoutMs) {
    const limit = timeoutMs || 1200;
    return new Promise((resolve) => {
      let lastTop = el.scrollTop;
      let stableSince = Date.now();
      const started = Date.now();
      const check = () => {
        const current = el.scrollTop;
        if (Math.abs(current - lastTop) < 1) {
          if (Date.now() - stableSince >= 120 || Date.now() - started >= limit) {
            resolve();
            return;
          }
        } else {
          lastTop = current;
          stableSince = Date.now();
        }
        requestAnimationFrame(check);
      };
      requestAnimationFrame(check);
    });
  }

  async function locatePost(targetPostNumber, ctx, options) {
    const behavior = options && options.behavior === 'smooth' ? 'smooth' : 'auto';
    if (!targetPostNumber || targetPostNumber <= 1) {
      if (behavior === 'smooth') {
        ctx.scrollRoot.scrollTo({ top: 0, behavior });
        await waitForScrollEnd(ctx.scrollRoot);
      } else {
        ctx.scrollRoot.scrollTop = 0;
      }
      return true;
    }
    await new Promise((resolve) => requestAnimationFrame(resolve));
    const node = ctx.nodeMap.get(Number(targetPostNumber));
    if (!node) return false;
    node.scrollIntoView({ behavior, block: 'center' });
    if (behavior === 'smooth') await waitForScrollEnd(ctx.scrollRoot);
    node.classList.remove('ldp-flash');
    void node.offsetWidth;
    node.classList.add('ldp-flash');
    setTimeout(() => node.classList.remove('ldp-flash'), 1700);
    return true;
  }

  /* ============ 13. 弹窗主体 + 双向分片加载 ============ */
  let CURRENT_OVERLAY = null;
  let CURRENT_MODAL_CLOSE = null;

  async function openModal(topicId, targetPostNumber) {
    closeUserCard();
    if (CURRENT_MODAL_CLOSE) CURRENT_MODAL_CLOSE();
    else if (CURRENT_OVERLAY) { CURRENT_OVERLAY.remove(); CURRENT_OVERLAY = null; }
    const abortController = new AbortController();
    const overlay = document.createElement('div');
    overlay.className = 'ldp-overlay';
    overlay.innerHTML = `
      <div class="ldp-modal">
        <div class="ldp-header">
          <div style="flex:1">
            <h2 class="ldp-title"><span class="ldp-sk ldp-sk-title"></span></h2>
            <div class="ldp-meta"><span class="ldp-sk ldp-sk-meta"></span></div>
          </div>
          <div class="ldp-head-btns">
            <button class="ldp-close" title="关闭">×</button>
          </div>
        </div>
        <div class="ldp-shell">
          <div class="ldp-body">
            <div class="ldp-topic"></div>
            <div class="ldp-comments-header">评论<span class="ldp-comments-count"></span></div>
            <div class="ldp-load-up-tip"><span class="ldp-tip-icon">⌛</span>正在向上加载…</div>
            <div class="ldp-up-sentinel"></div>
            <div class="ldp-comments"><div class="ldp-comments-empty">暂无评论</div></div>
            <div class="ldp-loading-tip"><span class="ldp-tip-icon">⌛</span>正在加载评论…</div>
            <div class="ldp-down-sentinel"></div>
            <div class="ldp-load-down-tip"><span class="ldp-tip-icon">⌛</span>正在向下加载…</div>
            <div class="ldp-loadmask">${SKELETON_HTML}</div>
          </div>
          <aside class="ldp-timeline" aria-label="帖子时间轴">
            <button type="button" class="ldp-tl-date ldp-tl-top-date" title="跳到顶部">顶部</button>
            <div class="ldp-tl-current" aria-label="当前楼层">
              <strong class="ldp-tl-current-post">1 / 1</strong>
              <span class="ldp-tl-current-date">当前</span>
            </div>
            <button type="button" class="ldp-tl-track" role="slider" aria-label="滚动位置"
              aria-valuemin="0" aria-valuemax="100" aria-valuenow="0">
              <span class="ldp-tl-fill"></span>
              <span class="ldp-tl-thumb"></span>
            </button>
            <button type="button" class="ldp-tl-date ldp-tl-bottom-date" title="加载并跳到最新回复">底部</button>
          </aside>
        </div>
        <div class="ldp-footer" hidden>
          <button class="ldp-fbtn ldp-f-like" disabled title="点赞">
            <svg viewBox="0 0 24 24" fill="currentColor">${ICONS.like}</svg>
            <span class="ldp-f-like-count">0</span>
          </button>
          <button class="ldp-fbtn ldp-f-reply" title="回复帖子">
            <svg viewBox="0 0 1024 1024" fill="currentColor">${ICONS.reply}</svg>
            <span class="ldp-f-reply-count">0</span>
          </button>
          <button class="ldp-fbtn ldp-f-boost" title="给楼主发送Boost">
            <svg viewBox="0 0 1024 1024" style="width:16px;height:16px;">${ICONS.boost}</svg>
          </button>
          <button class="ldp-fbtn ldp-f-bookmark" title="加入书签">
            <svg viewBox="0 0 24 24" fill="currentColor">${ICONS.bookmark}</svg>
          </button>
          <a class="ldp-fbtn ldp-f-open" href="#" target="_blank" rel="noopener" title="打开原贴">
            <svg viewBox="0 0 24 24" fill="currentColor">${ICONS.newTab}</svg>
          </a>
        </div>
      </div>`;
    document.body.appendChild(overlay);
    CURRENT_OVERLAY = overlay;

    const modal = overlay.querySelector('.ldp-modal'), body = overlay.querySelector('.ldp-body');
    const topicEl = overlay.querySelector('.ldp-topic'), commentsEl = overlay.querySelector('.ldp-comments');
    const countEl = overlay.querySelector('.ldp-comments-count'), emptyEl = overlay.querySelector('.ldp-comments-empty');
    const upSentinel = overlay.querySelector('.ldp-up-sentinel');
    const downSentinel = overlay.querySelector('.ldp-down-sentinel');
    const maskEl = overlay.querySelector('.ldp-loadmask');
    const loadUpTip = overlay.querySelector('.ldp-load-up-tip');
    const loadDownTip = overlay.querySelector('.ldp-load-down-tip');
    const footerEl = overlay.querySelector('.ldp-footer');
    const fLikeBtn = overlay.querySelector('.ldp-f-like'), fLikeCountEl = overlay.querySelector('.ldp-f-like-count');
    const fReplyBtn = overlay.querySelector('.ldp-f-reply'), fReplyCountEl = overlay.querySelector('.ldp-f-reply-count');
    const fBoostBtn = overlay.querySelector('.ldp-f-boost'), fBookmarkBtn = overlay.querySelector('.ldp-f-bookmark');
    const fOpenLink = overlay.querySelector('.ldp-f-open');
    const stopBase64Selection = bindModalBase64Selection(modal);

    const loader = createLoader(topicId, abortController.signal);
    const modalObsidianActions = createObsidianActionGroup(topicId, () => loader.topic);
    overlay.querySelector('.ldp-head-btns').insertBefore(
      modalObsidianActions,
      overlay.querySelector('.ldp-close'),
    );
    const tracker = createReadTracker(topicId, body);
    const ctx = {
      topicId, op: null, topicEl, commentsEl, countEl, emptyEl, scrollRoot: body,
      nodeMap: new Map(), pending: [], tracker, totalComments: 0, repliesIO: null,
      subReplyState: new Map(), // 楼中楼原始数据 + 已渲染数量的状态表
      subReplyCache: new Map(), // 按 postId 缓存楼中楼响应，窗口切换后可直接复用
      windowEpoch: 0,
      footerReplyCountEl: fReplyCountEl, // 底部悬浮操作栏的评论数展示
      onPostsChanged: null,
      signal: abortController.signal,
    };
    ctx.repliesIO = createRepliesIO(ctx);

    let closed = false;
    let isAnchoring = true;
    let loadingUp = false, loadingDown = false;
    let upDone = false, downDone = false;
    let upPromise = Promise.resolve(false), downPromise = Promise.resolve(false);
    let upIO = null, downIO = null;
    let timelineController = null;
    let renderedRangeStart = 0, renderedRangeEnd = 0;
    let activeUpRequest = null, activeDownRequest = null, activeSeekRequest = null;

    const close = () => {
      if (closed) return;
      closed = true;
      closeUserCard();
      abortController.abort();
      stopBase64Selection();
      tracker.stop();
      ctx.repliesIO.disconnect();
      if (upIO) upIO.disconnect();
      if (downIO) downIO.disconnect();
      if (timelineController) timelineController.destroy();
      overlay.remove();
      if (CURRENT_OVERLAY === overlay) CURRENT_OVERLAY = null;
      if (CURRENT_MODAL_CLOSE === close) CURRENT_MODAL_CLOSE = null;
      document.removeEventListener('keydown', onEsc);
    };
    CURRENT_MODAL_CLOSE = close;
    function onEsc(e) {
      if (e.key !== 'Escape') return;
      if (document.querySelector('.ldp-lightbox') || CURRENT_USER_CARD) return;
      close();
    }
    overlay.querySelector('.ldp-close').addEventListener('click', close);
    overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
    document.addEventListener('keydown', onEsc);

    const sentinelVisible = (sentinel) => {
      const bodyRect = body.getBoundingClientRect();
      const sentinelRect = sentinel.getBoundingClientRect();
      return sentinelRect.top <= bodyRect.bottom + 300 && sentinelRect.bottom >= bodyRect.top - 300;
    };

    const updateBoundaryTips = () => {
      let topTip = body.querySelector('.ldp-top-tip');
      if (upDone && !topTip) {
        topTip = document.createElement('div');
        topTip.className = 'ldp-top-tip';
        topTip.textContent = '已是最早的评论';
        loadUpTip.insertAdjacentElement('beforebegin', topTip);
      } else if (!upDone && topTip) {
        topTip.remove();
      }

      let bottomTip = body.querySelector('.ldp-bottom-tip');
      if (downDone) {
        if (!bottomTip) {
          bottomTip = document.createElement('div');
          bottomTip.className = 'ldp-bottom-tip';
          loadDownTip.insertAdjacentElement('afterend', bottomTip);
        }
        bottomTip.textContent = upDone ? '已加载全部评论' : '已加载到最新回复';
      } else if (bottomTip) {
        bottomTip.remove();
      }
    };

    const notifyPostsChanged = () => {
      reflowPending(ctx);
      if (ctx.onPostsChanged) ctx.onPostsChanged();
      updateBoundaryTips();
    };

    const createRequestHandle = () => {
      const controller = new AbortController();
      if (abortController.signal.aborted) {
        controller.abort();
        return { controller, signal: controller.signal, dispose() {} };
      }
      const relayAbort = () => controller.abort();
      abortController.signal.addEventListener('abort', relayAbort, { once: true });
      return {
        controller,
        signal: controller.signal,
        dispose() {
          abortController.signal.removeEventListener('abort', relayAbort);
        },
      };
    };

    const syncWindowState = () => {
      upDone = loader.topReached;
      downDone = loader.bottomReached;
    };

    const setRenderedRange = (start, end) => {
      renderedRangeStart = Math.max(0, Number(start) || 0);
      renderedRangeEnd = Math.max(renderedRangeStart, Math.min(loader.streamLength, Number(end) || 0));
      syncWindowState();
    };

    const trimOverflow = async (direction) => {
      const span = renderedRangeEnd - renderedRangeStart;
      if (span <= MAX_RENDERED_POSTS) return;
      if (direction === 'append') {
        const keepStart = Math.max(renderedRangeStart, renderedRangeEnd - MAX_RENDERED_POSTS);
        const anchor = captureScrollAnchor(body);
        trimRenderedRange(ctx, loader, keepStart, renderedRangeEnd);
        renderedRangeStart = keepStart;
        await restoreScrollAnchor(body, anchor);
      } else {
        const keepEnd = Math.min(renderedRangeEnd, renderedRangeStart + MAX_RENDERED_POSTS);
        trimRenderedRange(ctx, loader, renderedRangeStart, keepEnd);
        renderedRangeEnd = keepEnd;
      }
      syncWindowState();
    };

    const abortIncrementalLoads = () => {
      if (activeUpRequest) activeUpRequest.controller.abort();
      if (activeDownRequest) activeDownRequest.controller.abort();
    };

    const commitPreparedWindow = async (result, locateOptions) => {
      clearCommentsWindow(ctx);
      insertPostsBatch(result.posts, ctx, 'append');
      loader.activateWindow(result);
      setRenderedRange(result.start, result.end);
      notifyPostsChanged();
      await locatePost(result.targetPostNumber, ctx, locateOptions || { behavior: 'auto' });
    };

    const pumpDown = () => {
      if (isAnchoring || loadingDown || downDone || closed) return downPromise;
      loadingDown = true;
      loadDownTip.classList.add('show');
      const request = createRequestHandle();
      activeDownRequest = request;
      downPromise = (async () => {
        try {
          const result = await loader.prepareDown(request.signal);
          if (closed || request.signal.aborted) return false;
          insertPostsBatch(result.posts, ctx, 'append');
          loader.activateDown(result);
          renderedRangeEnd = result.end;
          await trimOverflow('append');
          syncWindowState();
          notifyPostsChanged();
          return result.posts.length > 0 || result.done;
        } catch (err) {
          if (err && err.name === 'AbortError') return false;
          return false;
        } finally {
          if (activeDownRequest === request) activeDownRequest = null;
          request.dispose();
          loadingDown = false;
          loadDownTip.classList.remove('show');
        }
      })();
      return downPromise;
    };

    const pumpUp = () => {
      if (isAnchoring || loadingUp || upDone || closed || body.scrollTop <= 1) return upPromise;
      loadingUp = true;
      loadUpTip.classList.add('show');
      const request = createRequestHandle();
      activeUpRequest = request;
      upPromise = (async () => {
        try {
          const oldHeight = body.scrollHeight;
          const oldTop = body.scrollTop;
          const result = await loader.prepareUp(request.signal);
          const loadedPosts = result.posts;
          if (closed || request.signal.aborted) return false;

          if (loadedPosts.length) {
            insertPostsBatch(loadedPosts, ctx, 'prepend');
            await new Promise((resolve) => requestAnimationFrame(() => {
              body.scrollTop = oldTop + (body.scrollHeight - oldHeight);
              resolve();
            }));
          }

          loader.activateUp(result);
          renderedRangeStart = result.start;
          await trimOverflow('prepend');
          syncWindowState();
          notifyPostsChanged();
          return loadedPosts.length > 0 || result.done;
        } catch (err) {
          if (err && err.name === 'AbortError') return false;
          return false;
        } finally {
          if (activeUpRequest === request) activeUpRequest = null;
          request.dispose();
          loadingUp = false;
          loadUpTip.classList.remove('show');
        }
      })();
      return upPromise;
    };

    try {
      const topic = await loader.init();
      if (closed) return;
      ctx.lastReadPostNumber = Number(topic.last_read_post_number) || 0;
      tracker.setReadWaterline(ctx.lastReadPostNumber);
      ctx.op = topic._opUsername; ctx.totalComments = Math.max(0, (topic.posts_count || 1) - 1);
      overlay.querySelector('.ldp-title').textContent = topic.title;
      overlay.querySelector('.ldp-meta').textContent = `${topic.posts_count} 帖 · ${topic.views || 0} 浏览 · 楼主 @${ctx.op || '?'}`;
      updateCommentsHeader(ctx);

      if (topic._opPost) attachPost(topic._opPost, ctx);

      fOpenLink.href = `${BASE}/t/${topic.id}`;
      bindBookmark(fBookmarkBtn, topic);
      bindFooterLike(fLikeBtn, fLikeCountEl, topic._opPost);

      const hasOpPost = !!topic._opPost;
      const canBoostOp = hasOpPost && topic._opPost.can_boost === true;
      if (!canBoostOp) {
        fBoostBtn.disabled = true;
        fBoostBtn.style.opacity = '0.4';
      }
      fBoostBtn.addEventListener('click', () => {
        if (fBoostBtn.disabled) return;
        const opNode = ctx.topicEl.querySelector('.ldp-post');
        if (!opNode) return;
        const wrap = opNode.querySelector(':scope > .ldp-boost-input-wrap');
        if (!wrap) return;
        const opening = !wrap.classList.contains('open');
        wrap.classList.toggle('open', opening);
        if (opening) {
          wrap.querySelector('.ldp-boost-input').focus();
          wrap.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      });
      fBookmarkBtn.before(fBoostBtn);

      fReplyBtn.addEventListener('click', () => {
        const opNode = ctx.topicEl.querySelector('.ldp-post');
        if (!opNode) return;
        const box = ensureReplyBox(opNode);
        box.classList.toggle('open');
        if (box.classList.contains('open')) {
          box.querySelector('textarea').focus();
          box.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      });
      footerEl.hidden = false;

      const resolvedTarget = resolveInitialTarget(topic, targetPostNumber);

      const initial = await loader.prepareWindowByPostNumber(resolvedTarget, abortController.signal);
      if (closed) return;
      insertPostsBatch(initial.posts, ctx, 'append');
      loader.activateWindow(initial);
      setRenderedRange(initial.start, initial.end);

      const controls = {
        getStreamLength() {
          return loader.streamLength;
        },
        getStreamIndex(postId) {
          return loader.getStreamIndex(postId);
        },
        async seekToIndex(index, desiredPostNumber) {
          if (closed) return false;
          if (activeSeekRequest) activeSeekRequest.controller.abort();

          const maxIndex = Math.max(0, loader.streamLength - 1);
          const safeIndex = Math.max(0, Math.min(maxIndex, Number(index) || 0));
          const cachedTarget = loader.getCachedByIndex(safeIndex);
          const localTargetPostNumber = Number(desiredPostNumber)
            || (cachedTarget && cachedTarget.post_number)
            || 1;
          const smoothBehavior = (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches)
            ? 'auto'
            : 'smooth';

          if (
            !activeSeekRequest
            && localTargetPostNumber <= 1
            && renderedRangeStart === 0
            && body.scrollTop <= body.clientHeight
          ) {
            return locatePost(1, ctx, { behavior: smoothBehavior });
          }

          if (
            !activeSeekRequest
            && safeIndex >= renderedRangeStart
            && safeIndex < renderedRangeEnd
            && await locatePost(localTargetPostNumber, ctx, { behavior: smoothBehavior })
          ) {
            return true;
          }

          abortIncrementalLoads();
          const request = createRequestHandle();
          activeSeekRequest = request;
          ctx.windowEpoch += 1;
          const requestEpoch = ctx.windowEpoch;
          isAnchoring = true;
          try {
            const result = desiredPostNumber
              ? await loader.prepareWindowByPostNumber(desiredPostNumber, request.signal)
              : await loader.prepareWindowByIndex(safeIndex, request.signal);
            if (closed || request.signal.aborted || ctx.windowEpoch !== requestEpoch) return false;
            await commitPreparedWindow(result, { behavior: 'auto' });
            return true;
          } catch (err) {
            if (err && err.name === 'AbortError') return false;
            throw err;
          } finally {
            if (activeSeekRequest === request) {
              activeSeekRequest = null;
              isAnchoring = false;
            }
            request.dispose();
          }
        },
      };

      timelineController = bindTimeline(modal, ctx, topic, controls);
      ctx.onPostsChanged = timelineController.refresh;

      bindActions(modal, ctx);
      tracker.start();

      upIO = new IntersectionObserver((entries) => {
        if (entries.some((entry) => entry.isIntersecting)) pumpUp();
      }, { root: body, rootMargin: '300px 0px' });
      downIO = new IntersectionObserver((entries) => {
        if (entries.some((entry) => entry.isIntersecting)) pumpDown();
      }, { root: body, rootMargin: '300px 0px' });
      upIO.observe(upSentinel);
      downIO.observe(downSentinel);

      maskEl.classList.add('hide');
      setTimeout(() => maskEl.remove(), 300);

      await locatePost(initial.targetPostNumber, ctx, { behavior: 'auto' });
      isAnchoring = false;
      updateBoundaryTips();

      if (sentinelVisible(upSentinel)) pumpUp();
      if (sentinelVisible(downSentinel)) pumpDown();
    } catch (err) {
      if (err && err.name === 'AbortError') return;
      if (maskEl) maskEl.remove();
      body.innerHTML = `<div class="ldp-error">加载失败：${esc(err.message)}</div>`;
    }
  }

  /* ============ 14. 拦截标题 / 通知点击 ============ */
  document.addEventListener('click', function (e) {
    const a = e.target.closest('a.title, a.raw-topic-link, a.search-link, a.search-result-topic, a[href*="/t/"]');
    if (!a || a.classList.contains('ldp-link-open') || a.classList.contains('ldp-f-open')) return;
    const inMenu = !!a.closest(MENU_PANEL_SEL), inSearch = !!a.closest(SEARCH_SEL);
    const isTitle = a.classList.contains('title') || a.classList.contains('raw-topic-link') || a.classList.contains('search-link') || a.classList.contains('search-result-topic');
    if (!isTitle && !inMenu && !inSearch) return;
    const parsed = parseTopicHref(a.getAttribute('href') || '');
    if (!parsed) return;
    e.preventDefault(); e.stopPropagation();
    const directTarget = inMenu && parsed.targetPostNumber ? parsed.targetPostNumber : 0;
    openModal(parsed.topicId, directTarget);
  }, true);

  startBase64MenuObserver();
  startObsidianPageActions();
})();
