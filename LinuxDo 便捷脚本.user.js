// ==UserScript==
// @name         LinuxDo 便捷脚本
// @namespace    https://linux.do/
// @version      1.1.8
// @license      MIT
// @description  在 LINUX DO 列表页点击标题即可弹窗预览整帖，楼中楼展示、点赞、回复、收藏、原图灯箱一应俱全，并按真实阅读节奏上报已读进度——无需离开列表页，也无需反复返回。
// @author       Fashion
// @match        https://linux.do/*
// @icon         https://cdn3.ldstatic.com/optimized/4X/6/a/6/6a6affc7b1ce8140279e959d32671304db06d5ab_2_180x180.png
// @grant        none
// @run-at       document-idle
// ==/UserScript==

(function () {
  'use strict';

  const BASE = location.origin;
  const PAGE_SIZE = 20;
  const READ_THRESHOLD = 1500;
  const FLUSH_INTERVAL = 5000;
  let ME_USERNAME = null;

  // --- 楼中楼分批加载 & 请求节流 相关配置 ---
  const SUB_REPLY_INITIAL_SIZE = 3;   // 楼中楼默认展示条数
  const SUB_REPLY_PAGE_SIZE = 10;     // 每次点击“展示更多”追加条数
  const REPLIES_FETCH_MIN_INTERVAL = 300; // 楼中楼接口请求最小间隔(ms)
  const REPLIES_HOVER_DELAY = 400;    // 楼层在视口停留超过此时长才触发抓取(ms)
  let lastRepliesFetchTime = 0; // 楼中楼请求节流用的时间戳

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
    .ldp-tl-fill{position:absolute;top:8px;left:50%;width:3px;height:0;
      transform:translateX(-50%);border-radius:999px;background:var(--tertiary,#08c);}
    .ldp-tl-thumb{position:absolute;left:50%;top:8px;width:14px;height:14px;
      transform:translate(-50%,-50%);border-radius:50%;background:var(--tertiary,#08c);
      box-shadow:0 0 0 4px rgba(8,132,255,.14);}
    .ldp-tl-loading .ldp-tl-bottom-date{opacity:.6;pointer-events:none;}
    .ldp-tl-date:focus-visible,.ldp-tl-track:focus-visible{
      outline:2px solid var(--tertiary,#08c);outline-offset:2px;}
    @media (max-width: 760px){
      .ldp-modal{width:96%;height:92vh;}
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
    .ldp-base64-result{position:relative;margin:8px 0;
      border:1px solid var(--primary-low,#ddd);border-radius:7px;
      background:var(--primary-very-low,#f6f6f6);color:var(--primary,#222);}
    .ldp-base64-result pre{max-height:420px;margin:0;padding:38px 12px 12px;
      overflow:auto;border:none;border-radius:inherit;background:transparent;
      color:inherit;white-space:pre-wrap;overflow-wrap:anywhere;}
    .ldp-base64-result code{font-family:ui-monospace,SFMono-Regular,Consolas,
      "Liberation Mono",monospace;}
    .ldp-base64-toolbar{position:absolute;top:5px;right:5px;z-index:1;
      display:flex;gap:4px;}
    .ldp-base64-toolbar button{min-width:30px;height:28px;padding:3px 8px;
      border:1px solid var(--primary-low,#ddd);border-radius:5px;cursor:pointer;
      background:var(--secondary,#fff);color:var(--primary-medium,#666);
      font:inherit;font-size:12px;line-height:1;}
    .ldp-base64-toolbar button:hover{color:var(--tertiary,#08c);
      background:var(--primary-low,#eee);}
    .ldp-base64-toolbar button:disabled{cursor:default;opacity:.7;}
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
    newTab: '<path d="M19 19H5V5h7V3H5c-1.11 0-2 .9-2 2v14c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2v-7h-2v7zM14 3v2h3.59l-9.83 9.83 1.41 1.41L19 6.41V10h2V3h-7z"/>'
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

  async function fetchJSON(url) {
    const res = await fetch(url, {
      credentials: 'include', headers: { 'Accept': 'application/json' },
    });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    return res.json();
  }

  // 专用于楼中楼 replies 接口的节流请求，与其它接口的 fetchJSON 互不影响
  async function fetchRepliesThrottled(url) {
    const now = Date.now();
    const wait = REPLIES_FETCH_MIN_INTERVAL - (now - lastRepliesFetchTime);
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    lastRepliesFetchTime = Date.now();
    return fetchJSON(url);
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

  async function ensureMe() {
    if (ME_USERNAME !== null) return ME_USERNAME;
    try {
      const s = await fetchJSON(`${BASE}/session/current.json`);
      ME_USERNAME = (s.current_user && s.current_user.username) || '';
    } catch (e) { ME_USERNAME = ''; }
    return ME_USERNAME;
  }

  function likeInfo(p) {
    const like = (p.actions_summary || []).find((a) => a.id === 2) || {};
    return { count: like.count || 0, acted: !!like.acted, canAct: !!like.can_act };
  }

  /* ============ 2.5 Boosts 气泡渲染辅助 ============ */
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
    wrapper.className = 'ldp-base64-result';
    wrapper.setAttribute('data-base64-decoded', 'true');

    const pre = document.createElement('pre');
    const code = document.createElement('code');
    code.textContent = decodedText;
    pre.appendChild(code);

    const toolbar = document.createElement('div');
    toolbar.className = 'ldp-base64-toolbar';

    const copyBtn = document.createElement('button');
    copyBtn.type = 'button';
    copyBtn.textContent = '复制';
    copyBtn.title = '复制解码文本';
    copyBtn.setAttribute('aria-label', '复制解码文本');
    copyBtn.addEventListener('click', async (e) => {
      e.preventDefault();
      e.stopPropagation();
      copyBtn.disabled = true;
      try {
        await copyText(decodedText);
        copyBtn.textContent = '已复制';
        setTimeout(() => {
          if (!copyBtn.isConnected) return;
          copyBtn.textContent = '复制';
          copyBtn.disabled = false;
        }, 2000);
      } catch (err) {
        copyBtn.disabled = false;
        alert('复制失败，请手动复制');
      }
    });

    const closeBtn = document.createElement('button');
    closeBtn.type = 'button';
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
  function createLoader(topicId) {
    let stream = [];
    const cache = new Map();
    let cursor = 0;
    let topic = null;
    let failStreak = 0;

    async function init() {
      await ensureMe();
      const res = await fetch(`${BASE}/t/${topicId}.json?track_visit=true&forceLoad=true`, {
        method: 'GET',
        credentials: 'include',
        cache: 'no-store',
        headers: {
          'Accept': 'application/json, text/javascript, */*; q=0.01',
          'X-Requested-With': 'XMLHttpRequest',
          'Discourse-Present': 'true',
          'Discourse-Track-View': 'true',
          'Discourse-Track-View-Topic-Id': String(topicId),
        },
      });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const data = await res.json();
      topic = data;
      stream = data.post_stream.stream || [];
      data.post_stream.posts.forEach((p) => cache.set(p.id, p));
      const op = (topic.details && topic.details.created_by && topic.details.created_by.username)
          || (data.post_stream.posts.find((p) => p.post_number === 1) || {}).username
          || null;
      topic._opUsername = op;
      topic._opPost = data.post_stream.posts.find((p) => p.post_number === 1) || null;
      return topic;
    }

    async function next() {
      if (cursor >= stream.length) return { posts: [], done: true };
      const slice = stream.slice(cursor, cursor + PAGE_SIZE);
      let missing = slice.filter((id) => !cache.has(id));

      for (let attempt = 0; attempt < 2 && missing.length; attempt++) {
        const qs = missing.map((id) => `post_ids[]=${id}`).join('&');
        try {
          const part = await fetchJSON(`${BASE}/t/${topicId}/posts.json?${qs}`);
          part.post_stream.posts.forEach((p) => cache.set(p.id, p));
        } catch (e) {}
        missing = slice.filter((id) => !cache.has(id));
      }

      if (missing.length) {
        failStreak++;
        if (failStreak >= 4) {
          cursor += slice.length;
          failStreak = 0;
          const posts = slice.map((id) => cache.get(id)).filter(Boolean);
          return { posts, done: cursor >= stream.length };
        }
        return { posts: [], done: false, retry: true };
      }

      failStreak = 0;
      cursor += slice.length;
      const posts = slice.map((id) => cache.get(id)).filter(Boolean);
      return { posts, done: cursor >= stream.length };
    }

    return { init, next, get topic() { return topic; } };
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

  /* ============ 7. 渲染单条 ============ */
  function renderPost(p, isReply, ctx) {
    const avatar = resolveAvatar(p.avatar_template, 48);
    const { count, acted, canAct } = likeInfo(p);
    const isOP = ctx.op && p.username === ctx.op;
    const isME = ME_USERNAME && p.username === ME_USERNAME;
    const time = fmtTime(p.created_at);

    // 强制 cooked 里的链接在新标签页打开（图片/灯箱链接除外）
    let cooked = p.cooked || '';
    cooked = (() => {
      const tmp = document.createElement('div');
      tmp.innerHTML = cooked;
      tmp.querySelectorAll('a[href]').forEach(a => {
        if (!isImageAnchor(a)) {
          if (!a.getAttribute('target')) a.setAttribute('target', '_blank');
        }
      });
      return tmp.innerHTML;
    })();

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

    batch.forEach((rp) => {
      if (!rp.reply_to_post_number) rp.reply_to_post_number = postNumber;
      attachPost(rp, ctx);
    });
    state.renderedCount += batch.length;
    reflowPending(ctx);

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

    return new IntersectionObserver((entries) => {
      entries.forEach((en) => {
        const postId = en.target.dataset.postId;
        const postNumber = +en.target.dataset.postNumber;
        if (!postId) return;

        if (en.isIntersecting) {
          if (fetched.has(postId) || hoverTimers.has(postId)) return;
          // 停顿检测：楼层需在视口停留 REPLIES_HOVER_DELAY 才真正发起请求，快速划过则不触发
          const timer = setTimeout(async () => {
            hoverTimers.delete(postId);
            fetched.add(postId);
            const loadingEl = en.target.querySelector(':scope > .ldp-sub-loading');
            if (loadingEl) loadingEl.style.display = 'block';
            try {
              const replies = await fetchRepliesThrottled(`${BASE}/posts/${postId}/replies.json`);
              if (loadingEl) loadingEl.style.display = 'none';
              if (!replies || !replies.length) return;
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
    if (!rail) return () => {};

    const body = ctx.scrollRoot;
    const topDateBtn = rail.querySelector('.ldp-tl-top-date');
    const bottomDateBtn = rail.querySelector('.ldp-tl-bottom-date');
    const currentText = rail.querySelector('.ldp-tl-current-post');
    const currentDate = rail.querySelector('.ldp-tl-current-date');
    const track = rail.querySelector('.ldp-tl-track');
    const fill = rail.querySelector('.ldp-tl-fill');
    const thumb = rail.querySelector('.ldp-tl-thumb');
    const totalPosts = Math.max(1, topic.posts_count || ctx.totalComments + 1);
    let raf = 0;
    let loadingLatest = false;

    topDateBtn.textContent = fmtDate(topic.created_at) || '顶部';
    bottomDateBtn.textContent = fmtDate(topic.last_posted_at || topic.bumped_at) || '底部';

    const posts = () => Array.from(body.querySelectorAll('.ldp-post[data-post-number]'))
      .sort((a, b) => (+a.dataset.postNumber || 0) - (+b.dataset.postNumber || 0));

    const visiblePost = () => {
      const list = posts();
      if (!list.length) return null;
      const bodyRect = body.getBoundingClientRect();
      const probe = bodyRect.top + Math.min(bodyRect.height * 0.35, 180);
      let current = list[0];
      list.forEach((post) => {
        if (post.getBoundingClientRect().top <= probe) current = post;
      });
      return current;
    };

    const setProgress = () => {
      const max = Math.max(1, body.scrollHeight - body.clientHeight);
      const ratio = Math.max(0, Math.min(1, body.scrollTop / max));
      const trackRect = track.getBoundingClientRect();
      const trackHeight = Math.max(1, trackRect.height - 16);
      fill.style.height = `${ratio * trackHeight}px`;
      thumb.style.top = `${8 + ratio * trackHeight}px`;
      track.setAttribute('aria-valuenow', String(Math.round(ratio * 100)));

      const post = visiblePost();
      const postNumber = post ? (+post.dataset.postNumber || 1) : 1;
      currentText.textContent = `${postNumber} / ${totalPosts}`;
      currentDate.textContent = post ? (fmtDate(post.dataset.createdAt) || '当前') : '当前';
      bottomDateBtn.disabled = loadingLatest;
    };

    const schedule = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        setProgress();
      });
    };

    const jumpTop = () => body.scrollTo({ top: 0, behavior: 'smooth' });
    const jumpBottom = async () => {
      if (loadingLatest) return;
      loadingLatest = true;
      rail.classList.add('ldp-tl-loading');
      schedule();
      try {
        await controls.loadAll();
        body.scrollTo({ top: body.scrollHeight, behavior: 'smooth' });
      } finally {
        loadingLatest = false;
        rail.classList.remove('ldp-tl-loading');
        schedule();
      }
    };

    const jumpByRatio = (ratio) => {
      const max = Math.max(0, body.scrollHeight - body.clientHeight);
      body.scrollTo({ top: max * Math.max(0, Math.min(1, ratio)), behavior: 'smooth' });
    };

    topDateBtn.addEventListener('click', jumpTop);
    bottomDateBtn.addEventListener('click', jumpBottom);
    track.addEventListener('click', (e) => {
      const rect = track.getBoundingClientRect();
      jumpByRatio((e.clientY - rect.top) / Math.max(1, rect.height));
    });
    track.addEventListener('keydown', (e) => {
      if (e.key === 'Home') { e.preventDefault(); jumpTop(); }
      else if (e.key === 'End') { e.preventDefault(); jumpBottom(); }
      else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') { e.preventDefault(); body.scrollBy({ top: -160, behavior: 'smooth' }); }
      else if (e.key === 'ArrowDown' || e.key === 'ArrowRight') { e.preventDefault(); body.scrollBy({ top: 160, behavior: 'smooth' }); }
      else if (e.key === 'PageUp') { e.preventDefault(); body.scrollBy({ top: -body.clientHeight * 0.8, behavior: 'smooth' }); }
      else if (e.key === 'PageDown') { e.preventDefault(); body.scrollBy({ top: body.clientHeight * 0.8, behavior: 'smooth' }); }
    });
    body.addEventListener('scroll', schedule, { passive: true });
    schedule();
    return schedule;
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

  /* ============ 13. 弹窗主体 + 循环泵加载 ============ */
  let CURRENT_OVERLAY = null;

  async function openModal(topicId) {
    closeUserCard();
    if (CURRENT_OVERLAY) { CURRENT_OVERLAY.remove(); CURRENT_OVERLAY = null; }
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
            <div class="ldp-comments"><div class="ldp-comments-empty">暂无评论</div></div>
            <div class="ldp-loading-tip"><span class="ldp-tip-icon">⌛</span>正在加载评论…</div>
            <div class="ldp-sentinel"></div>
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
    const sentinel = overlay.querySelector('.ldp-sentinel'), maskEl = overlay.querySelector('.ldp-loadmask');
    const loadingTip = overlay.querySelector('.ldp-loading-tip');
    const footerEl = overlay.querySelector('.ldp-footer');
    const fLikeBtn = overlay.querySelector('.ldp-f-like'), fLikeCountEl = overlay.querySelector('.ldp-f-like-count');
    const fReplyBtn = overlay.querySelector('.ldp-f-reply'), fReplyCountEl = overlay.querySelector('.ldp-f-reply-count');
    const fBoostBtn = overlay.querySelector('.ldp-f-boost'), fBookmarkBtn = overlay.querySelector('.ldp-f-bookmark');
    const fOpenLink = overlay.querySelector('.ldp-f-open');
    const stopBase64Selection = bindModalBase64Selection(modal);

    const loader = createLoader(topicId), tracker = createReadTracker(topicId, body);
    const ctx = {
      topicId, op: null, topicEl, commentsEl, countEl, emptyEl, scrollRoot: body,
      nodeMap: new Map(), pending: [], tracker, totalComments: 0, repliesIO: null,
      subReplyState: new Map(), // 楼中楼原始数据 + 已渲染数量的状态表
      footerReplyCountEl: fReplyCountEl, // 底部悬浮操作栏的评论数展示
      onPostsChanged: null,
    };
    ctx.repliesIO = createRepliesIO(ctx);

    let loading = false, done = false, pendingRetry = false, forcePumpAll = false;
    let loadingPromise = Promise.resolve();

    const close = () => {
      closeUserCard();
      stopBase64Selection();
      tracker.stop();
      ctx.repliesIO.disconnect();
      overlay.remove();
      if (CURRENT_OVERLAY === overlay) CURRENT_OVERLAY = null;
      document.removeEventListener('keydown', onEsc);
    };
    function onEsc(e) {
      if (e.key !== 'Escape') return;
      if (document.querySelector('.ldp-lightbox') || CURRENT_USER_CARD) return;
      close();
    }
    overlay.querySelector('.ldp-close').addEventListener('click', close);
    overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
    document.addEventListener('keydown', onEsc);

    const sentinelVisible = () => { const br = body.getBoundingClientRect(), sr = sentinel.getBoundingClientRect(); return sr.top <= br.bottom + 300; };

    const pump = async (forceAll) => {
      if (forceAll) forcePumpAll = true;
      if (loading) return loadingPromise;
      loading = true;
      loadingPromise = (async () => {
        // 只要还没加载完，进入循环前先亮出底部提示
        if (!done) loadingTip.classList.add('show');
        try {
          while (!done && (forcePumpAll || sentinelVisible() || pendingRetry)) {
            pendingRetry = false;
            const { posts, done: isDone, retry } = await loader.next();
            posts.forEach((p) => attachPost(p, ctx));
            reflowPending(ctx);
            if (ctx.onPostsChanged) ctx.onPostsChanged();
            if (retry) {
              pendingRetry = true;
              await new Promise((r) => setTimeout(r, 400));
              continue;
            }
            done = isDone;
          }
          if (done) forcePumpAll = false;
          if (done && !overlay.querySelector('.ldp-bottom-tip')) {
            const tip = document.createElement('div');
            tip.className = 'ldp-bottom-tip';
            tip.textContent = '已加载全部评论';
            body.insertBefore(tip, sentinel);
          }
        } catch (e) {} finally {
          loading = false;
          // 本轮抓取结束（无论成功、失败或已到底）都收起提示
          loadingTip.classList.remove('show');
        }
      })();
      return loadingPromise;
    };

    try {
      const topic = await loader.init();
      ctx.lastReadPostNumber = Number(topic.last_read_post_number) || 0;
      tracker.setReadWaterline(ctx.lastReadPostNumber);
      ctx.op = topic._opUsername; ctx.totalComments = Math.max(0, (topic.posts_count || 1) - 1);
      overlay.querySelector('.ldp-title').textContent = topic.title;
      overlay.querySelector('.ldp-meta').textContent = `${topic.posts_count} 帖 · ${topic.views || 0} 浏览 · 楼主 @${ctx.op || '?'}`;
      updateCommentsHeader(ctx);

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
      ctx.onPostsChanged = bindTimeline(modal, ctx, topic, {
        loadAll: () => pump(true),
      });

      bindActions(modal, ctx);
      tracker.start();

      const sentinelIO = new IntersectionObserver((entries) => { if (entries.some((en) => en.isIntersecting)) pump(); }, { root: body, rootMargin: '300px' });
      sentinelIO.observe(sentinel);
      body.addEventListener('scroll', () => { if (sentinelVisible()) pump(); }, { passive: true });

      await pump();
      maskEl.classList.add('hide');
      setTimeout(() => maskEl.remove(), 300);
    } catch (err) {
      if (maskEl) maskEl.remove();
      body.innerHTML = `<div class="ldp-error">加载失败：${esc(err.message)}</div>`;
    }
  }

  /* ============ 14. 拦截标题点击 ============ */
  document.addEventListener('click', function (e) {
    const a = e.target.closest('a.title, a.raw-topic-link, a.search-link, a.search-result-topic, a[href*="/t/"]');
    if (!a || a.classList.contains('ldp-link-open') || a.classList.contains('ldp-f-open')) return;
    const inMenu = !!a.closest(MENU_PANEL_SEL), inSearch = !!a.closest(SEARCH_SEL);
    const isTitle = a.classList.contains('title') || a.classList.contains('raw-topic-link') || a.classList.contains('search-link') || a.classList.contains('search-result-topic');
    if (!isTitle && !inMenu && !inSearch) return;
    const m = (a.getAttribute('href') || '').match(/\/t\/(?:[^\/]+\/)?(\d+)/);
    if (!m) return;
    e.preventDefault(); e.stopPropagation();
    openModal(m[1]);
  }, true);

  startBase64MenuObserver();
})();
