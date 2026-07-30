// ==UserScript==
// @name         GreasyFork 美化增强版 | GitHub Redesign
// @namespace    https://github.com/ywainzh/linuxdo-read-script
// @version      1.2.5
// @description  将 Greasy Fork 全量美化为 GitHub 风格，并修复页面跳转时原生界面闪现的问题。
// @author       咸鱼真人（原作），ywainzh（修复维护）
// @match        https://greasyfork.org/*
// @match        https://sleazyfork.org/*
// @grant        GM_addStyle
// @run-at       document-start
// @license      MIT
// ==/UserScript==

const GF_BOOT_THEME_STORAGE_KEY = 'greasyfork-beautifier-theme';
const GF_BOOT_ATTRIBUTE = 'data-gf-booting';
const GF_LEAVING_ATTRIBUTE = 'data-gf-leaving';
const GF_BOOT_TIMEOUT_MS = 2500;
const GF_LEAVING_TIMEOUT_MS = 1500;
let gfBootReleaseTimer = 0;
let gfLeavingReleaseTimer = 0;

const releaseGreasyForkBoot = () => {
    if (gfBootReleaseTimer) {
        clearTimeout(gfBootReleaseTimer);
        gfBootReleaseTimer = 0;
    }
    document.documentElement?.removeAttribute(GF_BOOT_ATTRIBUTE);
};

const releaseGreasyForkBootAfterPaint = () => {
    if (typeof requestAnimationFrame === 'function') {
        requestAnimationFrame(releaseGreasyForkBoot);
    } else {
        releaseGreasyForkBoot();
    }
};

const clearGreasyForkLeaving = () => {
    if (gfLeavingReleaseTimer) {
        clearTimeout(gfLeavingReleaseTimer);
        gfLeavingReleaseTimer = 0;
    }
    document.documentElement?.removeAttribute(GF_LEAVING_ATTRIBUTE);
};

const beginGreasyForkLeaving = () => {
    const root = document.documentElement;
    if (!root) return;
    root.setAttribute(GF_LEAVING_ATTRIBUTE, '');
    if (gfLeavingReleaseTimer) clearTimeout(gfLeavingReleaseTimer);
    gfLeavingReleaseTimer = window.setTimeout(clearGreasyForkLeaving, GF_LEAVING_TIMEOUT_MS);
};

// Hide the native Greasy Fork shell before its first paint. A watchdog restores
// the original page if later initialization fails for any reason.
(function beginGreasyForkBoot() {
    const criticalStyle = document.createElement('style');
    criticalStyle.id = 'gf-boot-style';
    criticalStyle.textContent = `
        html[data-gf-booting],
        html[data-gf-leaving] {
            background: #0d1117 !important;
            color-scheme: dark;
        }
        html[data-gf-theme="light"][data-gf-booting],
        html[data-gf-theme="light"][data-gf-leaving] {
            background: #ffffff !important;
            color-scheme: light;
        }
        html[data-gf-booting] body,
        html[data-gf-leaving] body {
            visibility: hidden !important;
        }
    `;

    const activate = () => {
        const root = document.documentElement;
        if (!root) return false;
        let theme = 'dark';
        try {
            const storedTheme = localStorage.getItem(GF_BOOT_THEME_STORAGE_KEY);
            if (storedTheme === 'light' || storedTheme === 'dark') theme = storedTheme;
        } catch {
            // Storage can be unavailable in hardened browser contexts.
        }
        root.dataset.gfTheme = theme;
        root.style.colorScheme = theme;
        root.setAttribute(GF_BOOT_ATTRIBUTE, '');
        if (!document.getElementById(criticalStyle.id)) {
            (document.head || root).appendChild(criticalStyle);
        }
        return true;
    };

    if (!activate()) {
        const observer = new MutationObserver(() => {
            if (!activate()) return;
            observer.disconnect();
        });
        observer.observe(document, { childList: true });
    }

    gfBootReleaseTimer = window.setTimeout(releaseGreasyForkBoot, GF_BOOT_TIMEOUT_MS);
    window.addEventListener('pageshow', (event) => {
        clearGreasyForkLeaving();
        if (event.persisted) releaseGreasyForkBoot();
    });
})();

// Keep the themed shell in place while a same-origin navigation replaces the
// document. The timeout restores the current page if navigation is cancelled.
(function installGreasyForkNavigationGuard() {
    const isPlainSameOriginLink = (event, link) => {
        if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return false;
        if (link.hasAttribute('download') || (link.target && link.target.toLowerCase() !== '_self')) return false;
        const rawHref = link.getAttribute('href') || '';
        if (!rawHref || rawHref.startsWith('#') || /^javascript:/i.test(rawHref)) return false;
        const url = new URL(link.href, location.href);
        if (url.origin !== location.origin) return false;
        return url.pathname !== location.pathname || url.search !== location.search || !url.hash;
    };

    document.addEventListener('click', (event) => {
        const link = event.target instanceof Element ? event.target.closest('a[href]') : null;
        if (!link || !isPlainSameOriginLink(event, link)) return;
        queueMicrotask(() => {
            if (!event.defaultPrevented) beginGreasyForkLeaving();
        });
    }, true);

    document.addEventListener('submit', (event) => {
        const form = event.target;
        if (!(form instanceof HTMLFormElement) || form.target === '_blank') return;
        const action = new URL(form.action || location.href, location.href);
        if (action.origin !== location.origin) return;
        queueMicrotask(() => {
            if (!event.defaultPrevented) beginGreasyForkLeaving();
        });
    }, true);

    window.addEventListener('beforeunload', beginGreasyForkLeaving);
    window.addEventListener('pagehide', beginGreasyForkLeaving);
})();

// Inject styles as early as possible
(function() {
    const cssContent = "/* Greasy Fork GitHub-style redesign. */\r\n:root{--gf-canvas:#0d1117;--gf-subtle:#161b22;--gf-inset:#010409;--gf-header:#010409;--gf-control:#21262d;--gf-border:#30363d;--gf-border-muted:#21262d;--gf-strong:#484f58;--gf-text:#e6edf3;--gf-secondary:#c9d1d9;--gf-muted:#8b949e;--gf-accent:#3fb950;--gf-soft:rgba(46,160,67,.14);--gf-ring:rgba(63,185,80,.28);--gf-success:#238636;--gf-shadow:rgba(1,4,9,.4);--gf-header-alpha:rgba(1,4,9,.94);--gf-hero-start:rgba(13,17,23,.84);--gf-hero-end:rgba(13,17,23,.97);--gf-hero-glow:rgba(46,160,67,.42);--gf-header-height:64px;--gf-font:-apple-system,BlinkMacSystemFont,\"Segoe UI\",\"Noto Sans\",Helvetica,Arial,sans-serif}\r\nhtml[data-gf-theme=light]{--gf-canvas:#fff;--gf-subtle:#f6f8fa;--gf-inset:#f6f8fa;--gf-header:#fff;--gf-control:#f6f8fa;--gf-border:#d0d7de;--gf-border-muted:#d8dee4;--gf-strong:#afb8c1;--gf-text:#1f2328;--gf-secondary:#25292e;--gf-muted:#59636e;--gf-accent:#1a7f37;--gf-soft:rgba(26,127,55,.1);--gf-ring:rgba(26,127,55,.22);--gf-success:#1f883d;--gf-shadow:rgba(31,35,40,.12);--gf-header-alpha:rgba(255,255,255,.94);--gf-hero-start:rgba(255,255,255,.84);--gf-hero-end:rgba(246,248,250,.97);--gf-hero-glow:rgba(31,136,61,.22)}\r\n/* Theme switches animate compositor snapshots, not individual DOM nodes. */\r\n::view-transition-old(root),\r\n::view-transition-new(root) { animation-duration: 180ms; animation-timing-function: ease-out; }\r\n::view-transition-old(root) { animation-name: gf-theme-fade-out; }\r\n::view-transition-new(root) { animation-name: gf-theme-fade-in; }\r\n@keyframes gf-theme-fade-out { to { opacity: 0; } }\r\n@keyframes gf-theme-fade-in { from { opacity: 0; } }\r\n@media (prefers-reduced-motion: reduce) {\r\n    ::view-transition-old(root),\r\n    ::view-transition-new(root) { animation: none; }\r\n}\r\nhtml[data-gf-theme=dark] body.gf-enhanced,html:not([data-gf-theme=light]) body.gf-enhanced,body.gf-enhanced{margin:0;background:var(--gf-canvas)!important;color:var(--gf-text)!important;font-family:var(--gf-font)!important;line-height:1.55!important}html[data-gf-theme=light] body.gf-enhanced{background:var(--gf-canvas)!important;color:var(--gf-text)!important}\r\nbody.gf-enhanced a{color:var(--gf-accent)!important;text-decoration:none!important}body.gf-enhanced a:hover{text-decoration:underline!important}\r\n/* Header */\r\nbody.gf-enhanced #main-header{position:relative;z-index:100;box-sizing:border-box;min-height:var(--gf-header-height);border-bottom:1px solid var(--gf-border)!important;background:var(--gf-header)!important;color:var(--gf-text)!important}\r\nbody.gf-enhanced #main-header>.width-constraint{box-sizing:border-box;display:flex!important;align-items:center;gap:24px;width:100%;max-width:none;min-height:var(--gf-header-height);margin:0;padding:8px 24px}\r\nbody.gf-enhanced #site-name{display:flex!important;flex:0 0 auto;align-items:center;gap:10px;min-width:max-content}body.gf-enhanced #site-name img{display:block!important;width:40px!important;height:40px!important;max-width:none!important;object-fit:contain!important;filter:invert(1) brightness(1.15)!important}html[data-gf-theme=light] body.gf-enhanced #site-name img{filter:none!important}\r\nbody.gf-enhanced #site-name-text h1{margin:0!important;color:var(--gf-text)!important;font-size:18px!important;font-weight:600!important;line-height:1.25!important}\r\nbody.gf-enhanced #site-nav{display:flex!important;flex:1;align-items:center;justify-content:flex-end;gap:16px;min-width:0}body.gf-enhanced #site-nav>nav:first-of-type,body.gf-enhanced #nav-user-info,body.gf-enhanced .gf-account-group,body.gf-enhanced .gf-header-tools{display:flex!important;align-items:center;margin:0;padding:0}body.gf-enhanced #site-nav>nav:first-of-type{gap:4px}body.gf-enhanced #nav-user-info{order:2;gap:14px;font-size:13px}body.gf-enhanced .gf-account-group{gap:6px;padding-right:14px;border-right:1px solid var(--gf-border)}body.gf-enhanced .gf-header-tools{gap:6px;flex:0 0 auto}\r\nbody.gf-enhanced #main-header nav li{display:block!important;margin:0!important;list-style:none!important}body.gf-enhanced #main-header nav a{display:block!important;padding:6px 9px!important;border-radius:6px;color:var(--gf-text)!important;font-size:14px!important;font-weight:500;white-space:nowrap}body.gf-enhanced #main-header nav a:hover{background:var(--gf-control)!important;text-decoration:none!important}\r\nbody.gf-enhanced .gf-account-group a{color:var(--gf-text)!important;font-size:13px!important;white-space:nowrap}body.gf-enhanced #main-header #nav-user-info .gf-account-group .user-profile-link a{color:var(--gf-accent)!important;font-weight:600!important}body.gf-enhanced .gf-account-group a:hover{color:var(--gf-accent)!important;text-decoration:none!important}body.gf-enhanced .gf-account-group .sign-out-link{font-size:0;color:transparent}body.gf-enhanced .gf-account-group .sign-out-link a{color:var(--gf-muted)!important;font-size:12px!important}body.gf-enhanced .gf-account-group .notification-widget{display:inline-flex!important;align-items:center;gap:5px;min-width:22px;height:22px;padding:0 5px!important;border-radius:11px!important;background:#388bfd!important;color:#fff!important;font-size:11px!important;text-decoration:none!important}html[data-gf-theme=light] body.gf-enhanced .gf-account-group .notification-widget{background:#0969da!important}body.gf-enhanced .gf-account-group .notification-widget svg{width:13px;height:13px;fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}body.gf-enhanced .gf-account-group .notification-widget:hover{background:#2f7ed6!important;color:#fff!important;text-decoration:none!important}html[data-gf-theme=light] body.gf-enhanced .gf-account-group .notification-widget:hover{background:#0859bf!important}\r\nbody.gf-enhanced .language-selector{display:flex!important;align-items:center;margin:0!important}body.gf-enhanced .language-selector-locale{box-sizing:border-box;height:22px;padding:0 22px 0 8px;border:1px solid var(--gf-border)!important;border-radius:11px;background:var(--gf-control)!important;color:var(--gf-text)!important;font:inherit;font-size:11px!important;cursor:pointer;-moz-appearance:none;-webkit-appearance:none;appearance:none;background-image:url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpolyline points='6 9 12 15 18 9' fill='none' stroke='%238b949e' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E\");background-repeat:no-repeat;background-position:right 6px center;background-size:10px}html[data-gf-theme=light] body.gf-enhanced .language-selector-locale{background-image:url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpolyline points='6 9 12 15 18 9' fill='none' stroke='%2359636e' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E\")}body.gf-enhanced .language-selector-locale:hover{background-color:var(--gf-subtle)!important;border-color:var(--gf-strong)!important}.language-selector-submit{display:none!important}\r\nbody.gf-enhanced .gf-theme-toggle{display:grid;flex:0 0 22px;width:22px;height:22px;padding:0;border:1px solid var(--gf-border);border-radius:11px;background:var(--gf-control);color:var(--gf-text);font-size:12px;line-height:1;place-items:center;cursor:pointer}body.gf-enhanced .gf-theme-toggle:hover{border-color:var(--gf-strong);background:var(--gf-subtle)}body.gf-enhanced .gf-theme-toggle:focus-visible{outline:2px solid var(--gf-accent);outline-offset:2px}\r\n/* Submenu dropdown */\r\nbody.gf-enhanced #site-nav .with-submenu nav,body.gf-enhanced .with-submenu nav{position:absolute!important;top:100%!important;right:0!important;z-index:200!important;min-width:max-content!important;display:none!important;flex-direction:column!important;padding:4px!important;border:1px solid var(--gf-border)!important;border-radius:6px!important;background:var(--gf-subtle)!important;box-shadow:0 8px 24px var(--gf-shadow)!important}\r\nbody.gf-enhanced #site-nav .with-submenu:hover nav,body.gf-enhanced #site-nav .with-submenu nav:hover,body.gf-enhanced .with-submenu:hover nav,body.gf-enhanced .with-submenu nav:hover{display:flex!important;flex-direction:column!important}\r\nbody.gf-enhanced .with-submenu nav li{margin:0!important;display:block!important}\r\nbody.gf-enhanced .with-submenu nav a{display:block!important;padding:6px 10px!important;border-radius:4px;color:var(--gf-text)!important;font-size:13px!important;white-space:nowrap;text-decoration:none!important}\r\nbody.gf-enhanced .with-submenu nav a:hover{background:var(--gf-control)!important;color:var(--gf-accent)!important;text-decoration:none!important}\r\nbody.gf-enhanced #mobile-nav{display:none!important}\r\nbody.gf-enhanced>.width-constraint{box-sizing:border-box;width:min(100%,1200px);margin:28px auto;padding:0 24px}body.gf-enhanced .rightAD,body.gf-enhanced .ad,body.gf-enhanced .ad-ga,body.gf-enhanced [id*=google_ads],body.gf-enhanced ins.adsbygoogle{display:none!important}\r\n/* Profile dashboard */\r\nbody.gf-enhanced:has(.gf-user-dashboard)>.width-constraint{width:min(100%,1240px)!important;margin:28px auto!important;padding:0 24px!important}body.gf-enhanced .gf-user-dashboard{display:grid;grid-template-columns:220px minmax(0,1fr);gap:24px;align-items:start}body.gf-enhanced .gf-dashboard-sidebar-column{position:sticky;top:24px;display:flex;min-width:0;flex-direction:column;gap:12px}\r\nbody.gf-enhanced .gf-dashboard-sidebar{display:flex;flex-direction:column;gap:2px;padding:8px;border:1px solid var(--gf-border);border-radius:6px;background:var(--gf-subtle);box-shadow:0 12px 28px var(--gf-shadow)}body.gf-enhanced .gf-dashboard-tab{display:flex;width:100%;min-height:40px;align-items:center;gap:10px;padding:8px 10px;border:0;border-left:2px solid transparent;border-radius:4px;background:transparent;color:var(--gf-text);font:inherit;font-size:13px;text-align:left}body.gf-enhanced .gf-dashboard-tab:hover{background:var(--gf-control);color:var(--gf-text)}body.gf-enhanced .gf-dashboard-tab.is-active{border-left-color:var(--gf-accent);background:var(--gf-soft);color:var(--gf-accent);font-weight:600}body.gf-enhanced .gf-dashboard-tab svg{width:17px;height:17px;fill:none;stroke:var(--gf-muted);stroke-width:1.8}body.gf-enhanced .gf-dashboard-tab.is-active svg{stroke:var(--gf-accent)}\r\nbody.gf-enhanced .gf-dashboard-content{min-width:0}body.gf-enhanced .gf-dashboard-content>section{box-sizing:border-box;margin:0!important;padding:28px!important;border:1px solid var(--gf-border)!important;border-radius:6px;background:var(--gf-subtle)!important;box-shadow:0 12px 28px var(--gf-shadow)}body.gf-enhanced .gf-dashboard-content>section[hidden]{display:none!important}body.gf-enhanced .gf-dashboard-content>section>header{margin-bottom:20px;padding-bottom:14px;border-bottom:1px solid var(--gf-border-muted)}body.gf-enhanced .gf-dashboard-content>section>header h3{margin:0!important;color:var(--gf-text)!important;font-size:20px!important}\r\nbody.gf-enhanced #about-user.gf-profile-card{position:relative;margin:0!important;padding:28px 18px 22px!important;border:1px solid var(--gf-border)!important;border-radius:8px;background:var(--gf-subtle)!important;box-shadow:0 12px 28px var(--gf-shadow)}body.gf-enhanced .gf-profile-avatar{display:grid;width:48px;height:48px;margin-bottom:14px;border-radius:50%;background:var(--gf-soft);color:var(--gf-accent);font-size:18px;font-weight:650;place-items:center}body.gf-enhanced #about-user.gf-profile-card h2{margin:0 0 2px!important;color:var(--gf-text)!important;font-size:18px!important;line-height:1.3!important}body.gf-enhanced .gf-profile-meta{display:block;margin-bottom:12px;color:var(--gf-muted)!important;font-size:12px!important}body.gf-enhanced #about-user.gf-profile-card .report-link{position:absolute;top:8px;right:8px;padding:3px 8px;color:var(--gf-muted)!important;font-size:11px!important}body.gf-enhanced #user-profile{margin:0!important;padding:0!important;border:0!important;background:transparent!important;color:var(--gf-secondary)!important}body.gf-enhanced #user-profile p{margin:0!important;color:var(--gf-secondary)!important;font-size:13px!important;line-height:1.55!important}\r\nbody.gf-enhanced .gf-dashboard-legacy-filters{display:none!important}\r\n/* Discussion list (global - profile + full page) */\r\nbody.gf-enhanced .discussion-list-main-content h2{color:var(--gf-text)!important;font-size:28px!important;margin:0!important}\r\nbody.gf-enhanced .discussion-list-header{display:flex;align-items:center;justify-content:space-between;margin-bottom:20px}\r\nbody.gf-enhanced .discussion-actions a{color:var(--gf-muted)!important;font-size:13px!important}\r\nbody.gf-enhanced .discussion-actions a:hover{color:var(--gf-accent)!important}\r\nbody.gf-enhanced .discussion-list{box-sizing:border-box;margin:14px 0;padding:0 16px;border:1px solid var(--gf-border)!important;border-radius:6px!important;background:var(--gf-subtle)!important;box-shadow:0 12px 28px var(--gf-shadow)!important;overflow:visible!important}\r\nbody.gf-enhanced .discussion-list-container{margin:0 -16px;padding:0 16px 16px;border:0!important;border-bottom:1px solid var(--gf-border-muted)!important;border-radius:0!important;background:transparent!important}\r\nbody.gf-enhanced .gf-dashboard-content .text-content{background:transparent!important;border:0!important;padding:0!important;box-shadow:none!important;margin:0!important;max-width:none!important;border-radius:0!important}\r\nbody.gf-enhanced .script-list{list-style:none!important;margin:0!important;padding:0!important;background:var(--gf-subtle)!important;border:1px solid var(--gf-border)!important;border-radius:6px!important;box-shadow:0 4px 12px var(--gf-shadow)!important;overflow:hidden!important}\r\nbody.gf-enhanced .script-list li{background:var(--gf-canvas)!important;border:0!important;border-bottom:1px solid var(--gf-border)!important;padding:20px 24px!important;margin:0!important;transition:background-color 0.15s ease}\r\nbody.gf-enhanced .script-list li:hover{background-color:var(--gf-subtle)!important}\r\nbody.gf-enhanced .script-list li:last-child{border-bottom:0!important}\r\nbody.gf-enhanced .script-list article{padding:0;border:0;background:transparent}\r\nbody.gf-enhanced .script-list h2{display:flex;align-items:center;flex-wrap:wrap;gap:6px;margin:0 0 8px!important;padding:0;border:0!important;background:transparent!important;font-size:16px!important;font-weight:600!important}\r\nbody.gf-enhanced .script-list .script-link{color:var(--gf-accent)!important;font-size:16px!important;font-weight:600!important}\r\nbody.gf-enhanced .script-list .script-description{display:block!important;color:var(--gf-muted)!important;font-size:13px!important;font-weight:400!important;line-height:1.55!important;margin:4px 0 8px!important;-webkit-box-orient:vertical;-webkit-line-clamp:2}\r\nbody.gf-enhanced .script-list .badge-js{display:inline-flex;align-items:center;padding:2px 6px;border-radius:4px;background:#e3b341!important;color:#000!important;font-size:11px!important;font-weight:600!important;line-height:1.3!important}\r\nbody.gf-enhanced .script-list .script-meta-block{margin:8px 0 0!important;padding:0!important;border-top:0!important}\r\nbody.gf-enhanced .script-list .inline-script-stats{display:flex!important;flex-wrap:wrap;gap:4px 16px;align-items:center;margin:0!important;padding:0!important}\r\nbody.gf-enhanced .script-list .inline-script-stats dt{color:var(--gf-muted)!important;font-size:12px!important;font-weight:400!important;display:inline-block!important;margin-right:4px!important}\r\nbody.gf-enhanced .script-list .inline-script-stats dd{margin:0!important;color:var(--gf-secondary)!important;font-size:12px!important;display:inline-block!important}\r\nbody.gf-enhanced .script-list relative-time{color:var(--gf-muted)!important}\r\n\r\n/* Reset script list inside user dashboard content */\r\nbody.gf-enhanced .gf-dashboard-content .script-list{border:0!important;background:transparent!important;box-shadow:none!important;border-radius:0!important}\r\nbody.gf-enhanced .gf-dashboard-content .script-list li{background:transparent!important;border-bottom:1px solid var(--gf-border-muted)!important;padding:16px 0!important}\r\nbody.gf-enhanced .gf-dashboard-content .script-list li:hover{background-color:transparent!important}\r\nbody.gf-enhanced .gf-dashboard-content .script-list li:last-child{border-bottom:0!important}\r\nbody.gf-enhanced .good-rating-count{color:var(--gf-accent)!important;font-weight:600}body.gf-enhanced .ok-rating-count{color:var(--gf-muted)!important}body.gf-enhanced .bad-rating-count{color:#f85149!important}\r\nbody.gf-enhanced .discussion-list-item{display:grid;gap:6px;border:0!important}\r\nbody.gf-enhanced .discussion-meta{display:flex;flex-wrap:wrap;align-items:center;gap:4px 12px}\r\nbody.gf-enhanced .discussion-meta-item:not(.discussion-meta-item-script-name){display:flex;align-items:center;gap:4px;color:var(--gf-muted);font-size:12px;white-space:nowrap}\r\nbody.gf-enhanced .discussion-meta-item-script-name{flex:1;min-width:0}\r\nbody.gf-enhanced .discussion-meta-item-script-name .script-link{color:var(--gf-text)!important;font-size:14px!important;font-weight:600!important}\r\nbody.gf-enhanced .discussion-meta-item-script-name .script-link:hover{color:var(--gf-accent)!important}\r\nbody.gf-enhanced .discussion-meta .user-link{color:var(--gf-muted)!important;font-size:12px!important}\r\nbody.gf-enhanced .discussion-meta .user-link:hover{color:var(--gf-accent)!important}\r\nbody.gf-enhanced .discussion-meta relative-time{color:var(--gf-muted);font-size:11px!important}\r\nbody.gf-enhanced .discussion-read,body.gf-enhanced .discussion-not-read{border-left:0!important;border-radius:0!important;background:transparent!important}\r\nbody.gf-enhanced a.discussion-title{color:var(--gf-text-secondary)!important}body.gf-enhanced a.discussion-title:hover{color:var(--gf-text)!important}\r\nbody.gf-enhanced .discussion-snippet{overflow:hidden;display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:2;word-break:break-word}\r\nbody.gf-enhanced .badge-author{display:inline-flex;align-items:center;padding:1px 6px;border-radius:3px;background:var(--gf-accent-soft)!important;color:var(--gf-accent)!important;font-size:10px!important;font-weight:600;line-height:1.4;margin-left:2px}\r\nbody.gf-enhanced .rating-icon{display:inline-flex;align-items:center;justify-content:center;padding:1px 6px;border-radius:3px;font-size:10px!important;font-weight:600;min-width:0;width:auto}body.gf-enhanced .rating-icon-good{background:#2da44e;color:#fff!important}body.gf-enhanced .rating-icon-ok{background:#bf8700;color:#fff!important}body.gf-enhanced .rating-icon-bad{background:#cf222e;color:#fff!important}\r\n/* Discussion right sidebar filter panel */\r\nbody.gf-enhanced .sidebarred .sidebar{box-sizing:border-box;background:var(--gf-subtle);border:1px solid var(--gf-border);border-radius:6px;padding:16px;box-shadow:0 12px 28px var(--gf-shadow);position:sticky!important;top:24px!important;align-self:start!important;max-height:calc(100vh - 48px)!important;overflow-y:auto!important;height:fit-content!important}\r\nbody.gf-enhanced .sidebarred .list-option-groups{box-sizing:border-box;width:100%}\r\nbody.gf-enhanced .sidebar-search{display:flex;align-items:center;gap:6px;margin:0 0 16px;padding:6px 12px;border:1px solid var(--gf-border)!important;border-radius:6px!important;background:var(--gf-inset)!important}\r\nbody.gf-enhanced .sidebar-search input[type=search]{box-sizing:border-box;min-width:0;flex:1;height:22px;padding:0;border:0!important;outline:0;background:transparent!important;color:var(--gf-text)!important;font:inherit;font-size:13px!important}\r\nbody.gf-enhanced .sidebar-search input[type=search]::placeholder{color:var(--gf-muted)}\r\nbody.gf-enhanced .sidebar-search .search-submit{display:grid;width:22px;min-width:22px;height:22px;padding:0;border:0;background:transparent;color:var(--gf-muted);place-items:center}\r\nbody.gf-enhanced .sidebar-search .search-submit svg{width:14px;height:14px;fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}\r\nbody.gf-enhanced .sidebar-search .search-submit:hover{color:var(--gf-text)}\r\nbody.gf-enhanced .sidebarred .close-sidebar{display:none!important}\r\nbody.gf-enhanced .sidebarred .list-option-groups{display:flex;flex-direction:column;gap:12px!important}\r\nbody.gf-enhanced .sidebarred .list-option-group{display:flex;flex-direction:column;gap:4px;padding-bottom:8px!important;border-bottom:1px solid var(--gf-border-muted);background:transparent!important;font-size:11px!important;font-weight:600;color:var(--gf-muted);text-transform:uppercase;letter-spacing:.03em}\r\nbody.gf-enhanced .sidebarred .list-option-group:last-child{border-bottom:0;padding-bottom:0}\r\nbody.gf-enhanced .sidebarred .list-option-group ul,body.gf-enhanced .sidebarred .list-option-group li{padding:0;margin:0;list-style:none!important;background:transparent!important;border:0!important;box-shadow:none!important}\r\nbody.gf-enhanced .sidebarred .list-option-group ul{display:flex;flex-direction:column;gap:2px}\r\nbody.gf-enhanced .sidebarred .gf-discussion-language-group .list-option{display:inline-block!important;width:auto!important;margin:2px 2px 0 0!important;padding:4px 8px!important;border:1px solid var(--gf-border)!important;border-radius:11px!important;background:var(--gf-control)!important;font-size:11px!important;color:var(--gf-text)!important;white-space:nowrap;line-height:1.3}\r\nbody.gf-enhanced .sidebarred .gf-discussion-language-group .list-current{background:var(--gf-soft)!important;border-color:var(--gf-accent)!important;color:var(--gf-accent)!important}\r\nbody.gf-enhanced .sidebarred #discussion-locale{box-sizing:border-box;width:100%;height:22px;padding:0 22px 0 6px;border:1px solid var(--gf-border);border-radius:11px;background:var(--gf-control);color:var(--gf-text);font:inherit;font-size:11px;cursor:pointer;-moz-appearance:none;-webkit-appearance:none;appearance:none;background-image:url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpolyline points='6 9 12 15 18 9' fill='none' stroke='%238b949e' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E\");background-repeat:no-repeat;background-position:right 6px center;background-size:10px}html[data-gf-theme=light] body.gf-enhanced .sidebarred #discussion-locale{background-image:url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpolyline points='6 9 12 15 18 9' fill='none' stroke='%2359636e' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E\")}\r\nbody.gf-enhanced .sidebarred #discussion-locale:hover{border-color:var(--gf-strong)}\r\nbody.gf-enhanced .sidebarred .list-option{padding:0!important;margin:0!important}\r\nbody.gf-enhanced .sidebarred .list-option a{display:block!important;padding:8px 12px!important;border-radius:6px!important;color:var(--gf-text)!important;font-size:13px!important;font-weight:400!important;text-decoration:none!important;border:0!important;box-shadow:none!important;transition:background-color 0.2s,color 0.2s}\r\nbody.gf-enhanced .sidebarred .list-option a:hover{background:var(--gf-control)!important;color:var(--gf-text)!important}\r\nbody.gf-enhanced .sidebarred .list-current{box-sizing:border-box;width:100%;margin:0!important;padding:8px 12px 8px 9px!important;font-weight:600!important;color:var(--gf-text)!important;background:var(--gf-control)!important;border:0!important;border-left:3px solid var(--gf-accent)!important;border-radius:0 6px 6px 0!important;box-shadow:none!important;font-size:13px!important}\r\nbody.gf-enhanced .sidebarred .sidebar p{margin:0}\r\nbody.gf-enhanced .sidebarred .list-option-button{display:block;padding:7px 16px!important;margin:0!important;border:1px solid var(--gf-border)!important;border-radius:6px;background:var(--gf-control);color:var(--gf-text)!important;font-size:14px!important;font-weight:600;text-align:center;text-decoration:none!important;transition:background-color 120ms}\r\nbody.gf-enhanced .sidebarred .list-option-button:hover{background:var(--gf-subtle);border-color:var(--gf-strong);text-decoration:none!important}\r\nbody.gf-enhanced .open-sidebar{display:none!important}\r\nbody.gf-enhanced #user-control-panel{display:flex!important;flex-direction:column!important;margin:-8px!important;padding:0!important;list-style:none!important}body.gf-enhanced #user-control-panel li{margin:0!important}body.gf-enhanced #user-control-panel li.gf-danger-separator{margin-top:12px!important;padding-top:12px!important;border-top:1px solid var(--gf-border-muted)}body.gf-enhanced #user-control-panel a{display:grid!important;grid-auto-flow:column;grid-template-columns:32px minmax(0,1fr);align-items:center!important;gap:10px;padding:9px 8px!important;border-radius:4px;color:var(--gf-text)!important;font-size:14px!important;font-weight:500;text-decoration:none!important}body.gf-enhanced #user-control-panel a:hover{background:var(--gf-control)!important;text-decoration:none!important}body.gf-enhanced .gf-ctrl-label{display:flex;min-width:0;align-items:center;gap:4px;white-space:nowrap}body.gf-enhanced .gf-ctrl-label::after{width:16px;height:16px;flex:0 0 16px;margin-left:auto;content:\"\";opacity:.35;background:var(--gf-muted);mask:url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpolyline points='9 18 15 12 9 6' fill='none' stroke='%23000' stroke-width='2'/%3E%3C/svg%3E\") center/contain no-repeat}body.gf-enhanced .gf-ctrl-icon{display:grid;width:32px;height:32px;border-radius:6px;background:var(--gf-canvas);place-items:center}body.gf-enhanced .gf-ctrl-icon svg{width:16px;height:16px;fill:none;stroke:var(--gf-muted);stroke-width:1.8}body.gf-enhanced .gf-ctrl-label .notification-widget{display:inline-flex;min-width:20px;height:20px;align-items:center;justify-content:center;margin-left:4px;padding:0 5px;border-radius:10px;background:var(--gf-soft)!important;color:var(--gf-accent)!important;font-size:11px;line-height:1}body.gf-enhanced #user-control-panel a[href*=delete],body.gf-enhanced #user-control-panel a[href*=sign_out]{color:#f85149!important;font-weight:400}body.gf-enhanced #user-control-panel a[href*=delete] .gf-ctrl-label::after,body.gf-enhanced #user-control-panel a[href*=sign_out] .gf-ctrl-label::after{display:none}body.gf-enhanced #user-control-panel a[href*=delete]:hover,body.gf-enhanced #user-control-panel a[href*=sign_out]:hover{background:rgba(248,81,73,.12)!important;color:#f85149!important}\r\n/* Homepage */\r\nhtml:has(body.gf-homepage-redesign),body.gf-homepage-redesign{overflow:hidden!important}body.gf-homepage-redesign #main-header{position:fixed!important;inset:0 0 auto;background:var(--gf-header-alpha)!important;backdrop-filter:blur(12px)}body.gf-homepage-redesign>.width-constraint{width:100%!important;max-width:none!important;margin:0!important;padding:0!important}.gf-scroll-container{height:100vh;overflow:auto;scroll-behavior:auto;scrollbar-width:none;-ms-overflow-style:none;background:var(--gf-canvas)!important}.gf-scroll-container::-webkit-scrollbar{display:none}.gf-scroll-page{box-sizing:border-box;display:grid;min-height:100vh;padding:calc(var(--gf-header-height) + 40px) clamp(20px,5vw,72px) 40px;place-items:center}.gf-scroll-page:nth-child(even){background:var(--gf-inset)}.gf-page-card{box-sizing:border-box;width:min(100%,1100px);padding:clamp(24px,4vw,48px);border:1px solid var(--gf-border);border-radius:8px;background:var(--gf-subtle);box-shadow:0 16px 40px var(--gf-shadow);opacity:.82}.gf-scroll-page.is-active .gf-page-card{border-color:var(--gf-strong);opacity:1}.gf-page-card h2,.gf-page-card h3{margin-top:0!important;color:var(--gf-text)!important}.gf-page-card{color:var(--gf-secondary)!important}.gf-page-card p,.gf-page-card li{color:var(--gf-secondary)!important}.gf-hero-page{background:linear-gradient(var(--gf-hero-start),var(--gf-hero-end)),radial-gradient(circle at 50% 18%,var(--gf-hero-glow) 0,transparent 42%)}.gf-hero-page .gf-page-card{border:0;background:transparent;box-shadow:none;text-align:center}.gf-hero-content{display:flex;flex-direction:column;align-items:center}.gf-hero-content .super-title{max-width:820px;margin:0 0 28px!important;color:var(--gf-text)!important;font-size:clamp(30px,5vw,52px)!important}.gf-hero-content #home-script-nav{display:flex;width:min(100%,720px);flex-direction:column;align-items:center;gap:16px}.gf-hero-content .home-search{display:flex;width:min(100%,620px)!important;min-height:48px;align-items:center;padding:4px 8px;border:1px solid var(--gf-strong)!important;border-radius:6px;background:var(--gf-inset)!important}.gf-hero-content .home-search input[type=search]{flex:1;min-width:0;padding:8px 10px;border:0;outline:0;background:transparent;color:var(--gf-text);font:inherit}.gf-hero-content .search-submit{display:grid;width:36px;min-width:36px;height:36px;padding:0;border:0;background:transparent;place-items:center}.gf-hero-content .search-submit svg{width:18px;height:18px;fill:none;stroke:var(--gf-muted);stroke-width:2}\r\n/* Content pages */\r\n.gf-intro-page .gf-page-card{max-width:840px}\r\n.gf-step-page .gf-page-card>section{display:grid;grid-template-columns:minmax(220px,.7fr) minmax(0,1.3fr);gap:18px 40px;align-items:start}\r\n.gf-step-page .gf-page-card h3{grid-column:1/-1}\r\n.gf-step-page figure{grid-column:1;grid-row:2/span 3;margin:0!important}\r\n.gf-step-page figure img{display:block;box-sizing:border-box;width:100%!important;max-width:360px!important;height:auto!important;border:1px solid var(--gf-border)!important;border-radius:6px!important;background:var(--gf-inset)}\r\n.gf-step-page figcaption{margin-top:8px!important;color:var(--gf-muted)!important;font-size:12px!important}\r\n.gf-step-page .browser-list-selector{display:inline-block!important;margin:2px 4px 2px 0;padding:6px 12px;border:1px solid transparent;border-radius:6px;color:var(--gf-muted)!important;font-size:13px!important;font-weight:600!important;cursor:pointer}\r\n.gf-step-page .browser-list-selector:hover{background:var(--gf-control)!important;color:var(--gf-text)!important}\r\n.gf-step-page .browser-list-selector-active{border-color:var(--gf-border)!important;background:var(--gf-inset)!important;color:var(--gf-text)!important}\r\n.gf-step-page .browser-list{box-sizing:border-box;padding:14px 18px;overflow:visible;border:1px solid var(--gf-border);border-radius:6px;background:var(--gf-canvas)!important}\r\n.gf-step-page .browser-list ul{margin:0!important;padding-left:20px}.gf-step-page .browser-list li{margin:6px 0;font-size:14px!important}\r\n.gf-step-2-page .gf-page-card>section>ul{grid-column:1/-1;display:grid!important;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;margin:0!important;padding:0;list-style:none!important}\r\n.gf-step-2-page .gf-page-card>section>ul>li{min-width:0;padding:14px 16px!important;border:1px solid var(--gf-border-muted)!important;border-radius:6px;background:var(--gf-canvas)!important}\r\n.gf-step-2-page .script-link{display:block!important;margin-bottom:6px;overflow-wrap:anywhere;font-size:15px!important;font-weight:600!important}\r\n.gf-step-2-page .script-description{display:-webkit-box;overflow:hidden;color:var(--gf-muted)!important;font-size:12px;-webkit-box-orient:vertical;-webkit-line-clamp:3}\r\n.gf-step-3-page .gf-page-card{max-width:800px}\r\n/* Page indicator */\r\n.gf-page-nav{position:fixed;z-index:120;top:50%;right:12px;display:flex;width:24px;flex-direction:column;align-items:center;gap:6px;transform:translateY(-50%)}\r\n.gf-page-nav-button{position:relative;width:24px;height:24px;padding:0;border:0;border-radius:50%;outline:0;background:transparent;cursor:pointer}\r\n.gf-page-nav-button::before{position:absolute;top:8px;left:8px;width:8px;height:8px;border:1px solid var(--gf-muted);border-radius:50%;background:var(--gf-subtle);content:\"\";transition:background-color 160ms ease,transform 160ms ease}\r\n.gf-page-nav-button:hover::before,.gf-page-nav-button.is-active::before{border-color:var(--gf-accent);background:var(--gf-accent);transform:scale(1.35)}\r\n.gf-page-nav-button:focus-visible{outline:2px solid var(--gf-accent);outline-offset:0}\r\n\r\n/* Document / Text Content pages (e.g., Help) */\r\nbody.gf-enhanced .text-content {\r\n    box-sizing: border-box!important;\r\n    max-width: min(100%, 960px)!important;\r\n    margin: 24px auto!important;\r\n    padding: 32px!important;\r\n    border: 1px solid var(--gf-border)!important;\r\n    border-radius: 6px!important;\r\n    background: var(--gf-subtle)!important;\r\n    color: var(--gf-text)!important;\r\n    box-shadow: 0 12px 28px var(--gf-shadow)!important;\r\n}\r\nbody.gf-enhanced .text-content h1,\r\nbody.gf-enhanced .text-content h2,\r\nbody.gf-enhanced .text-content h3,\r\nbody.gf-enhanced .text-content h4 {\r\n    margin-top: 24px!important;\r\n    margin-bottom: 16px!important;\r\n    font-weight: 600!important;\r\n    line-height: 1.25!important;\r\n    color: var(--gf-text)!important;\r\n    border: 0!important;\r\n}\r\nbody.gf-enhanced .text-content h1 {\r\n    font-size: 2em!important;\r\n    padding-bottom: 0.3em!important;\r\n    border-bottom: 1px solid var(--gf-border-muted)!important;\r\n}\r\nbody.gf-enhanced .text-content h2 {\r\n    font-size: 1.5em!important;\r\n    padding-bottom: 0.3em!important;\r\n    border-bottom: 1px solid var(--gf-border-muted)!important;\r\n}\r\nbody.gf-enhanced .text-content h3 {\r\n    font-size: 1.25em!important;\r\n}\r\nbody.gf-enhanced .text-content p,\r\nbody.gf-enhanced .text-content ul,\r\nbody.gf-enhanced .text-content ol {\r\n    margin-top: 0!important;\r\n    margin-bottom: 16px!important;\r\n    color: var(--gf-secondary)!important;\r\n    font-size: 14px!important;\r\n    line-height: 1.6!important;\r\n}\r\nbody.gf-enhanced .text-content ul,\r\nbody.gf-enhanced .text-content ol {\r\n    padding-left: 2em!important;\r\n}\r\nbody.gf-enhanced .text-content li {\r\n    margin-top: 0.25em!important;\r\n    margin-bottom: 0.25em!important;\r\n    list-style: disc!important;\r\n}\r\nbody.gf-enhanced .text-content ol li {\r\n    list-style: decimal!important;\r\n}\r\nbody.gf-enhanced .text-content a {\r\n    color: var(--gf-accent)!important;\r\n    text-decoration: none!important;\r\n}\r\nbody.gf-enhanced .text-content a:hover {\r\n    text-decoration: underline!important;\r\n}\r\nbody.gf-enhanced .text-content code {\r\n    padding: 0.2em 0.4em!important;\r\n    margin: 0!important;\r\n    font-size: 85%!important;\r\n    white-space: break-spaces!important;\r\n    background-color: var(--gf-control)!important;\r\n    border-radius: 6px!important;\r\n    font-family: ui-monospace, SFMono-Regular, SF Mono, Menlo, Consolas, Liberation Mono, monospace!important;\r\n}\r\nbody.gf-enhanced .text-content pre {\r\n    padding: 16px!important;\r\n    overflow: auto!important;\r\n    font-size: 85%!important;\r\n    line-height: 1.45!important;\r\n    background-color: var(--gf-inset)!important;\r\n    border: 1px solid var(--gf-border)!important;\r\n    border-radius: 6px!important;\r\n}\r\nbody.gf-enhanced .text-content pre code {\r\n    padding: 0!important;\r\n    margin: 0!important;\r\n    background-color: transparent!important;\r\n    border-radius: 0!important;\r\n}\r\n\r\n/* Source code page: preserve the original source, enhance only its shell. */\r\nbody.gf-code-page .gf-script-main-column { max-width:none!important; }\r\nbody.gf-code-page .gf-script-body-layout { grid-template-columns:minmax(0, 1fr)!important; }\r\nbody.gf-code-page .gf-script-sidebar-column { display:none!important; }\r\nbody.gf-code-page .code-container.gf-code-card {\r\n    position: relative!important;\r\n    box-sizing: border-box!important;\r\n    width:min(100%, 1480px)!important;\r\n    max-width:100%!important;\r\n    margin:18px auto 28px!important;\r\n    padding: 0!important;\r\n    overflow: hidden!important;\r\n    border: 1px solid var(--gf-border)!important;\r\n    border-radius: 10px!important;\r\n    background: var(--gf-inset)!important;\r\n    box-shadow: 0 12px 28px var(--gf-shadow)!important;\r\n    contain: layout paint style;\r\n}\r\nbody.gf-code-page .gf-code-toolbar {\r\n    display: flex!important;\r\n    align-items: center!important;\r\n    justify-content: space-between!important;\r\n    gap: 12px!important;\r\n    min-height: 42px!important;\r\n    padding: 0 12px 0 16px!important;\r\n    border-bottom: 1px solid var(--gf-border)!important;\r\n    background: var(--gf-subtle)!important;\r\n    color: var(--gf-muted)!important;\r\n    font-size: 12px!important;\r\n}\r\nbody.gf-code-page .gf-code-meta,\r\nbody.gf-code-page .gf-code-actions {\r\n    display: flex!important;\r\n    align-items: center!important;\r\n    gap: 2px!important;\r\n}\r\nbody.gf-code-page .gf-code-actions { margin-left:auto!important; }\r\nbody.gf-code-page .gf-code-language {\r\n    color: var(--gf-text)!important;\r\n    font-weight: 700!important;\r\n    letter-spacing: .06em!important;\r\n}\r\nbody.gf-code-page .gf-code-separator { color: var(--gf-border-strong,var(--gf-muted))!important; }\r\nbody.gf-code-page .gf-code-action {\r\n    display:inline-flex!important;\r\n    align-items:center!important;\r\n    gap:6px!important;\r\n    min-height:30px!important;\r\n    padding:5px 8px!important;\r\n    border:0!important;\r\n    border-radius:4px!important;\r\n    background:transparent!important;\r\n    color:var(--gf-secondary)!important;\r\n    font:inherit!important;\r\n    font-size:12px!important;\r\n    font-weight:600!important;\r\n    cursor:pointer!important;\r\n}\r\nbody.gf-code-page .gf-code-action svg { width:15px!important;height:15px!important;fill:none!important;stroke:currentColor!important;stroke-width:1.8!important;stroke-linecap:round!important;stroke-linejoin:round!important; }\r\nbody.gf-code-page .gf-code-action:hover,\r\nbody.gf-code-page .gf-code-action[aria-pressed=\"true\"] { background:var(--gf-control)!important;color:var(--gf-accent)!important; }\r\nbody.gf-code-page .gf-code-fullscreen { margin-left:4px!important;border-left:1px solid var(--gf-border)!important;border-radius:0!important; }\r\nbody.gf-code-page .gf-code-viewport {\r\n    display: flex!important;\r\n    align-items: stretch!important;\r\n    max-height: min(76vh, 1040px)!important;\r\n    overflow: auto!important;\r\n    overscroll-behavior: contain!important;\r\n    scrollbar-gutter: stable!important;\r\n}\r\nbody.gf-code-page .gf-code-viewport.is-wrapped {\r\n    overflow-x: hidden!important;\r\n}\r\nbody.gf-code-page .gf-code-viewport.is-unwrapped {\r\n    overflow-x: auto!important;\r\n}\r\nbody.gf-code-page .gf-code-viewport.is-unwrapped pre.gf-source-pre {\r\n    flex: 0 0 auto!important;\r\n    width: auto!important;\r\n    min-width: 100%!important;\r\n    max-width: none!important;\r\n}\r\nbody.gf-code-page pre.gf-source-pre {\r\n    box-sizing: border-box!important;\r\n    flex: 1 1 0!important;\r\n    width: 100%!important;\r\n    max-width: none!important;\r\n    min-width: 0!important;\r\n    margin: 0!important;\r\n    padding: 18px 20px!important;\r\n    overflow: visible!important;\r\n    overscroll-behavior: contain!important;\r\n    tab-size: 4!important;\r\n    font-size: 13px!important;\r\n    line-height: 1.55!important;\r\n    font-variant-ligatures: none!important;\r\n    color: var(--gf-text)!important;\r\n    background: var(--gf-inset)!important;\r\n}\r\nbody.gf-code-page .gf-code-viewport.is-wrapped pre.gf-source-pre,\r\nbody.gf-code-page .gf-code-viewport.is-wrapped pre.gf-source-pre code {\r\n    width: 100%!important;\r\n    max-width: 100%!important;\r\n    white-space: pre-wrap!important;\r\n    overflow-wrap: anywhere!important;\r\n    word-break: break-word!important;\r\n}\r\nbody.gf-code-page .gf-code-viewport.is-unwrapped pre.gf-source-pre,\r\nbody.gf-code-page .gf-code-viewport.is-unwrapped pre.gf-source-pre code {\r\n    white-space: pre!important;\r\n    overflow-wrap: normal!important;\r\n    word-break: normal!important;\r\n}\r\nbody.gf-code-page pre.gf-source-pre.line-numbers {\r\n    position: relative!important;\r\n    padding-left: 68px!important;\r\n    counter-reset: linenumber!important;\r\n}\r\nbody.gf-code-page pre.gf-source-pre.line-numbers > code {\r\n    position: relative!important;\r\n    white-space: inherit!important;\r\n}\r\nbody.gf-code-page pre.gf-source-pre.line-numbers .line-numbers-rows {\r\n    position: absolute!important;\r\n    top: 0!important;\r\n    bottom: auto!important;\r\n    left: -68px!important;\r\n    width: 52px!important;\r\n    border-right: 1px solid var(--gf-border)!important;\r\n    color: var(--gf-muted)!important;\r\n    font: 13px/1.55 ui-monospace, SFMono-Regular, SF Mono, Menlo, Consolas, monospace!important;\r\n    letter-spacing: 0!important;\r\n    text-align: right!important;\r\n    user-select: none!important;\r\n    pointer-events: none!important;\r\n}\r\nbody.gf-code-page pre.gf-source-pre.line-numbers .line-numbers-rows > span { display: block!important; counter-increment: linenumber!important; }\r\nbody.gf-code-page pre.gf-source-pre.line-numbers .line-numbers-rows > span::before { content: counter(linenumber)!important; display: block!important; padding-right: 12px!important; }\r\nbody.gf-code-page pre.gf-source-pre code {\r\n    display: block!important;\r\n    min-width: 0!important;\r\n    color: inherit!important;\r\n    background: transparent!important;\r\n    font: inherit!important;\r\n}\r\nbody.gf-code-page pre.gf-source-pre.gf-raw-source,\r\nbody.gf-code-page pre.gf-source-pre.gf-raw-source code {\r\n    background: var(--gf-inset)!important;\r\n    background-image: none!important;\r\n    color: var(--gf-text)!important;\r\n    text-shadow: none!important;\r\n}\r\nbody.gf-code-page pre.gf-source-pre.gf-raw-source::before,\r\nbody.gf-code-page pre.gf-source-pre.gf-raw-source::after,\r\nbody.gf-code-page pre.gf-source-pre.gf-raw-source code::before,\r\nbody.gf-code-page pre.gf-source-pre.gf-raw-source code::after {\r\n    display: none!important;\r\n    content: none!important;\r\n}\r\nbody.gf-code-page .prettyprint .linenums { list-style: none!important; }\r\nbody.gf-code-page .gf-raw-source,\r\nbody.gf-code-page .gf-raw-source * {\r\n    background: var(--gf-inset)!important;\r\n    background-image: none!important;\r\n}\r\nbody.gf-code-page .gf-source-pre .token.comment,\r\nbody.gf-code-page .gf-source-pre .token.prolog,\r\nbody.gf-code-page .gf-source-pre .token.doctype { color: var(--gf-muted)!important; }\r\nbody.gf-code-page .gf-source-pre .token.keyword,\r\nbody.gf-code-page .gf-source-pre .token.boolean,\r\nbody.gf-code-page .gf-source-pre .token.constant { color: #c678dd!important; }\r\nbody.gf-code-page .gf-source-pre .token.string,\r\nbody.gf-code-page .gf-source-pre .token.char,\r\nbody.gf-code-page .gf-source-pre .token.regex { color: #98c379!important; }\r\nbody.gf-code-page .gf-source-pre .token.function,\r\nbody.gf-code-page .gf-source-pre .token.function-variable { color: #61afef!important; }\r\nbody.gf-code-page .gf-source-pre .token.number { color: #d19a66!important; }\r\nbody.gf-code-page .gf-source-pre .token.operator,\r\nbody.gf-code-page .gf-source-pre .token.punctuation { color: #abb2bf!important; }\r\nhtml[data-gf-theme=\"light\"] body.gf-code-page .gf-source-pre .token.keyword,\r\nhtml[data-gf-theme=\"light\"] body.gf-code-page .gf-source-pre .token.boolean,\r\nhtml[data-gf-theme=\"light\"] body.gf-code-page .gf-source-pre .token.constant { color: #a626a4!important; }\r\nhtml[data-gf-theme=\"light\"] body.gf-code-page .gf-source-pre .token.string,\r\nhtml[data-gf-theme=\"light\"] body.gf-code-page .gf-source-pre .token.char,\r\nhtml[data-gf-theme=\"light\"] body.gf-code-page .gf-source-pre .token.regex { color: #50a14f!important; }\r\nhtml[data-gf-theme=\"light\"] body.gf-code-page .gf-source-pre .token.function,\r\nhtml[data-gf-theme=\"light\"] body.gf-code-page .gf-source-pre .token.function-variable { color: #4078f2!important; }\r\n\r\nbody.gf-code-page .gf-wrap-control { display:inline-flex!important;align-items:center!important;margin:0 2px 0 0!important; }\r\nbody.gf-code-page .gf-wrap-toggle-input {\r\n    position: absolute!important;\r\n    width: 1px!important;\r\n    height: 1px!important;\r\n    opacity: 0!important;\r\n    pointer-events: none!important;\r\n}\r\nbody.gf-code-page .gf-wrap-toggle-label {\r\n    display: inline-flex!important;\r\n    position: relative!important;\r\n    align-items: center!important;\r\n    gap: 6px!important;\r\n    min-height: 30px!important;\r\n    padding: 5px 8px 5px 31px!important;\r\n    border:0!important;\r\n    border-radius:4px!important;\r\n    background:transparent!important;\r\n    color: var(--gf-secondary)!important;\r\n    font-size: 12px!important;\r\n    font-weight: 600!important;\r\n    cursor: pointer!important;\r\n    user-select: none!important;\r\n}\r\nbody.gf-code-page .gf-wrap-toggle-label::before {\r\n    content: \"\";\r\n    position: absolute;\r\n    left: 10px;\r\n    width: 18px;\r\n    height: 10px;\r\n    border-radius: 999px;\r\n    background: var(--gf-border-strong,var(--gf-muted));\r\n    transition: background .16s ease;\r\n}\r\nbody.gf-code-page .gf-wrap-toggle-label::after {\r\n    content: \"\";\r\n    position: absolute;\r\n    left: 11px;\r\n    width: 8px;\r\n    height: 8px;\r\n    border-radius: 50%;\r\n    background: var(--gf-canvas);\r\n    box-shadow: 0 1px 2px var(--gf-shadow);\r\n    transition: transform .16s ease;\r\n}\r\nbody.gf-code-page .gf-wrap-toggle-label[data-state=\"on\"] {\r\n    border-color: var(--gf-accent)!important;\r\n    color: var(--gf-accent)!important;\r\n}\r\nbody.gf-code-page .gf-wrap-toggle-label:hover { background:var(--gf-control)!important;color:var(--gf-accent)!important; }\r\nbody.gf-code-page .gf-wrap-toggle-label[data-state=\"on\"]::before { background: var(--gf-accent); }\r\nbody.gf-code-page .gf-wrap-toggle-label[data-state=\"on\"]::after { transform: translateX(8px); }\r\nbody.gf-code-reader-open { overflow:hidden!important; }\r\nbody.gf-code-page .code-container.gf-code-card.is-fullscreen-reader {\r\n    position:fixed!important;\r\n    inset:18px!important;\r\n    z-index:10000!important;\r\n    display:flex!important;\r\n    flex-direction:column!important;\r\n    width:auto!important;\r\n    max-width:none!important;\r\n    height:auto!important;\r\n    margin:0!important;\r\n    border-radius:12px!important;\r\n    box-shadow:0 24px 80px rgba(0,0,0,.52)!important;\r\n    contain:layout paint style!important;\r\n}\r\nbody.gf-code-page .code-container.gf-code-card.is-fullscreen-reader .gf-code-toolbar { flex:0 0 auto!important; }\r\nbody.gf-code-page .code-container.gf-code-card.is-fullscreen-reader .gf-code-viewport { flex:1 1 auto!important;max-height:none!important;min-height:0!important; }\r\n@media(max-width:760px){body.gf-code-page .gf-code-toolbar{align-items:flex-start!important;flex-wrap:wrap!important;padding:8px 10px!important}body.gf-code-page .gf-code-actions{margin-left:0!important;flex-wrap:wrap!important}body.gf-code-page .gf-code-action span{display:none!important}body.gf-code-page .gf-code-action{padding:6px!important}.gf-code-page .code-container.gf-code-card.is-fullscreen-reader{inset:8px!important}}\r\n\r\nbody.gf-enhanced .text-content table {\r\n    display: block!important;\r\n    width: 100%!important;\r\n    width: max-content!important;\r\n    max-width: 100%!important;\r\n    overflow: auto!important;\r\n    margin-top: 0!important;\r\n    margin-bottom: 16px!important;\r\n    border-spacing: 0!important;\r\n    border-collapse: collapse!important;\r\n}\r\nbody.gf-enhanced .text-content table th {\r\n    font-weight: 600!important;\r\n    background-color: var(--gf-control)!important;\r\n}\r\nbody.gf-enhanced .text-content table th,\r\nbody.gf-enhanced .text-content table td {\r\n    padding: 6px 13px!important;\r\n    border: 1px solid var(--gf-border)!important;\r\n    color: var(--gf-text)!important;\r\n}\r\nbody.gf-enhanced .text-content table tr {\r\n    background-color: var(--gf-subtle)!important;\r\n    border-top: 1px solid var(--gf-border-muted)!important;\r\n}\r\nbody.gf-enhanced .text-content table tr:nth-child(2n) {\r\n    background-color: var(--gf-inset)!important;\r\n}\r\n\r\n/* Help Page Restructuring Styles */\r\nbody.gf-enhanced .gf-help-page {\r\n    background: transparent!important;\r\n    border: 0!important;\r\n    box-shadow: none!important;\r\n    padding: 0!important;\r\n    margin: 28px auto!important;\r\n}\r\nbody.gf-enhanced .gf-help-header {\r\n    text-align: center;\r\n    margin-bottom: 32px;\r\n}\r\nbody.gf-enhanced .gf-help-header h1 {\r\n    font-size: 32px!important;\r\n    font-weight: 700!important;\r\n    color: var(--gf-text)!important;\r\n    margin-bottom: 8px!important;\r\n    border-bottom: 0!important;\r\n}\r\nbody.gf-enhanced .gf-help-header .subtitle {\r\n    font-size: 15px!important;\r\n    color: var(--gf-muted)!important;\r\n    margin-bottom: 0!important;\r\n}\r\nbody.gf-enhanced .gf-help-grid {\r\n    display: grid;\r\n    grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));\r\n    gap: 24px;\r\n    margin-bottom: 32px;\r\n}\r\nbody.gf-enhanced .gf-help-card {\r\n    background: var(--gf-subtle)!important;\r\n    border: 1px solid var(--gf-border)!important;\r\n    border-radius: 8px!important;\r\n    box-shadow: 0 4px 12px var(--gf-shadow)!important;\r\n    overflow: hidden;\r\n    transition: border-color 0.2s, box-shadow 0.2s, transform 0.2s;\r\n}\r\nbody.gf-enhanced .gf-help-card:hover {\r\n    border-color: var(--gf-strong)!important;\r\n    box-shadow: 0 8px 24px var(--gf-shadow)!important;\r\n    transform: translateY(-2px);\r\n}\r\nbody.gf-enhanced .gf-help-card h3 {\r\n    margin: 0!important;\r\n    padding: 16px 20px!important;\r\n    background: var(--gf-control)!important;\r\n    border-bottom: 1px solid var(--gf-border)!important;\r\n    color: var(--gf-text)!important;\r\n    font-size: 15px!important;\r\n    font-weight: 600!important;\r\n}\r\nbody.gf-enhanced .gf-help-card ul {\r\n    list-style: none!important;\r\n    margin: 0!important;\r\n    padding: 0!important;\r\n}\r\nbody.gf-enhanced .gf-help-card li {\r\n    margin: 0!important;\r\n    padding: 0!important;\r\n    border-bottom: 1px solid var(--gf-border-muted)!important;\r\n    transition: background-color 0.2s;\r\n}\r\nbody.gf-enhanced .gf-help-card li:hover {\r\n    background-color: var(--gf-control)!important;\r\n}\r\nbody.gf-enhanced .gf-help-card li:last-child {\r\n    border-bottom: 0!important;\r\n}\r\nbody.gf-enhanced .gf-help-card li a {\r\n    display: flex!important;\r\n    align-items: center;\r\n    justify-content: space-between;\r\n    padding: 12px 20px!important;\r\n    color: var(--gf-text)!important;\r\n    font-size: 13.5px!important;\r\n    font-weight: 500!important;\r\n    text-decoration: none!important;\r\n    transition: color 0.2s;\r\n}\r\nbody.gf-enhanced .gf-help-card li a:hover {\r\n    color: var(--gf-accent)!important;\r\n    text-decoration: none!important;\r\n}\r\nbody.gf-enhanced .gf-help-card li a::after {\r\n    width: 14px;\r\n    height: 14px;\r\n    flex: 0 0 14px;\r\n    content: \"\";\r\n    opacity: 0.4;\r\n    background-color: var(--gf-muted);\r\n    mask: url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpolyline points='9 18 15 12 9 6' fill='none' stroke='%23000' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E\") center/contain no-repeat;\r\n    -webkit-mask: url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpolyline points='9 18 15 12 9 6' fill='none' stroke='%23000' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E\") center/contain no-repeat;\r\n    transition: opacity 0.2s, transform 0.2s, background-color 0.2s;\r\n}\r\nbody.gf-enhanced .gf-help-card li a:hover::after {\r\n    opacity: 1;\r\n    background-color: var(--gf-accent);\r\n    transform: translateX(3px);\r\n}\r\nbody.gf-enhanced .gf-help-footer {\r\n    margin-top: 32px;\r\n    padding: 20px 24px!important;\r\n    background: var(--gf-subtle)!important;\r\n    border: 1px solid var(--gf-border)!important;\r\n    border-radius: 6px!important;\r\n    box-shadow: 0 4px 12px var(--gf-shadow)!important;\r\n    text-align: center;\r\n}\r\nbody.gf-enhanced .gf-help-footer p {\r\n    margin: 0!important;\r\n    color: var(--gf-secondary)!important;\r\n    font-size: 13px!important;\r\n}\r\nbody.gf-enhanced .gf-help-footer a {\r\n    color: var(--gf-accent)!important;\r\n    font-weight: 500;\r\n}\r\nbody.gf-enhanced .gf-back-link {\r\n    margin-bottom: 20px!important;\r\n    padding-bottom: 12px!important;\r\n    border-bottom: 1px solid var(--gf-border-muted)!important;\r\n    font-size: 13px!important;\r\n    font-weight: 500!important;\r\n}\r\nbody.gf-enhanced .gf-back-link a {\r\n    color: var(--gf-muted)!important;\r\n    text-decoration: none!important;\r\n    transition: color 0.2s;\r\n}\r\nbody.gf-enhanced .gf-back-link a:hover {\r\n    color: var(--gf-accent)!important;\r\n    text-decoration: none!important;\r\n}\r\n\r\n/* Pagination styling and centering */\r\nbody.gf-enhanced nav.pagy {\r\n    display: flex!important;\r\n    justify-content: center!important;\r\n    align-items: center!important;\r\n    gap: 4px!important;\r\n    margin: 32px 0!important;\r\n    width: 100%!important;\r\n}\r\nbody.gf-enhanced nav.pagy a {\r\n    display: inline-flex!important;\r\n    align-items: center!important;\r\n    justify-content: center!important;\r\n    height: 32px!important;\r\n    min-width: 32px!important;\r\n    padding: 0 10px!important;\r\n    border: 1px solid var(--gf-border)!important;\r\n    border-radius: 6px!important;\r\n    background: var(--gf-subtle)!important;\r\n    color: var(--gf-text)!important;\r\n    font-size: 14px!important;\r\n    font-weight: 500!important;\r\n    text-decoration: none!important;\r\n    transition: background-color 0.2s, border-color 0.2s, color 0.2s;\r\n    box-shadow: 0 1px 0 var(--gf-shadow)!important;\r\n}\r\nbody.gf-enhanced nav.pagy a:hover {\r\n    background: var(--gf-control)!important;\r\n    border-color: var(--gf-strong)!important;\r\n    color: var(--gf-accent)!important;\r\n}\r\nbody.gf-enhanced nav.pagy a[aria-current=\"page\"] {\r\n    background: var(--gf-accent)!important;\r\n    border-color: var(--gf-accent)!important;\r\n    color: #fff!important;\r\n    font-weight: 600!important;\r\n    cursor: default!important;\r\n}\r\nbody.gf-enhanced nav.pagy a[aria-disabled=\"true\"],\r\nbody.gf-enhanced nav.pagy a[role=\"separator\"] {\r\n    color: var(--gf-muted)!important;\r\n    background: transparent!important;\r\n    border-color: transparent!important;\r\n    opacity: 0.6!important;\r\n    cursor: not-allowed!important;\r\n    box-shadow: none!important;\r\n}\r\n\r\n/* Script Detail Page Layout Restructuring */\r\nbody.gf-script-detail-page #script-info {\r\n    background: transparent!important;\r\n    border: 0!important;\r\n    box-shadow: none!important;\r\n    padding: 0!important;\r\n    margin: 24px 0!important;\r\n}\r\n\r\n/* GitHub Sub-Header */\r\nbody.gf-enhanced .gf-script-header {\r\n    width: 100%!important;\r\n    background: var(--gf-subtle)!important;\r\n    border-bottom: 1px solid var(--gf-border)!important;\r\n    padding: 24px 0 0!important;\r\n    margin-bottom: 24px!important;\r\n    box-sizing: border-box!important;\r\n}\r\nbody.gf-enhanced .gf-script-header .width-constraint {\r\n    max-width: 100%!important;\r\n    padding: 0 32px!important;\r\n    margin: 0!important;\r\n    box-sizing: border-box!important;\r\n}\r\nbody.gf-enhanced .gf-script-breadcrumb {\r\n    display: flex!important;\r\n    justify-content: space-between!important;\r\n    align-items: center!important;\r\n    width: 100%!important;\r\n    margin-bottom: 20px!important;\r\n    font-size: 20px!important;\r\n    font-weight: 400!important;\r\n    line-height: 1.25!important;\r\n}\r\nbody.gf-enhanced .gf-breadcrumb-left {\r\n    display: flex!important;\r\n    align-items: center!important;\r\n    gap: 8px!important;\r\n}\r\nbody.gf-enhanced .gf-repo-icon {\r\n    color: var(--gf-muted);\r\n}\r\nbody.gf-enhanced .gf-repo-owner {\r\n    color: var(--gf-accent)!important;\r\n    text-decoration: none!important;\r\n}\r\nbody.gf-enhanced .gf-repo-owner:hover {\r\n    text-decoration: underline!important;\r\n}\r\nbody.gf-enhanced .gf-repo-divider {\r\n    color: var(--gf-muted);\r\n}\r\nbody.gf-enhanced .gf-repo-name {\r\n    color: var(--gf-text)!important;\r\n    font-weight: 600!important;\r\n}\r\nbody.gf-enhanced .gf-repo-badge {\r\n    font-size: 12px!important;\r\n    font-weight: 500!important;\r\n    padding: 2px 7px!important;\r\n    border: 1px solid var(--gf-border)!important;\r\n    border-radius: 2em!important;\r\n    color: var(--gf-muted)!important;\r\n    background: transparent!important;\r\n    margin-left: 4px!important;\r\n}\r\n\r\n/* GitHub Repo Actions */\r\nbody.gf-enhanced .gf-repo-actions {\r\n    display: flex!important;\r\n    align-items: center!important;\r\n    gap: 8px!important;\r\n}\r\nbody.gf-enhanced .gf-repo-action-btn {\r\n    display: inline-flex!important;\r\n    align-items: center!important;\r\n    gap: 4px!important;\r\n    padding: 3px 10px!important;\r\n    background-color: var(--gf-control)!important;\r\n    border: 1px solid var(--gf-border)!important;\r\n    border-radius: 6px!important;\r\n    font-size: 12px!important;\r\n    font-weight: 500!important;\r\n    color: var(--gf-text)!important;\r\n    box-shadow: 0 1px 0 var(--gf-shadow)!important;\r\n    cursor: default;\r\n}\r\nbody.gf-enhanced .gf-repo-action-btn:hover {\r\n    background-color: var(--gf-subtle)!important;\r\n    border-color: var(--gf-strong)!important;\r\n}\r\nbody.gf-enhanced .gf-action-icon {\r\n    color: var(--gf-muted)!important;\r\n}\r\nbody.gf-enhanced .gf-action-counter {\r\n    background-color: var(--gf-canvas)!important;\r\n    border: 1px solid var(--gf-border)!important;\r\n    border-radius: 2em!important;\r\n    padding: 0 6px!important;\r\n    font-size: 11px!important;\r\n    font-weight: 600!important;\r\n    color: var(--gf-text)!important;\r\n    margin-left: 2px!important;\r\n}\r\n\r\n/* GitHub subpage tabs */\r\nbody.gf-enhanced .gf-script-tabs-container {\r\n    display: flex!important;\r\n    overflow: visible!important;\r\n}\r\nbody.gf-enhanced .gf-script-tabs {\r\n    display: flex;\r\n    list-style: none!important;\r\n    margin: 0!important;\r\n    padding: 0!important;\r\n    gap: 4px!important;\r\n}\r\nbody.gf-enhanced .gf-script-tabs li {\r\n    display: flex;\r\n    margin: 0!important;\r\n    padding: 0!important;\r\n    list-style: none!important;\r\n}\r\nbody.gf-enhanced .gf-script-header .gf-script-tabs li > a,\r\nbody.gf-enhanced .gf-script-header .gf-script-tabs li > span {\r\n    display: flex!important;\r\n    align-items: center!important;\r\n    gap: 8px!important;\r\n    padding: 8px 16px!important;\r\n    font-size: 14px!important;\r\n    color: var(--gf-secondary)!important;\r\n    text-decoration: none!important;\r\n    border-bottom: 2px solid transparent!important;\r\n    transition: border-color 0.12s, color 0.12s;\r\n    background: transparent!important;\r\n    cursor: pointer;\r\n    margin-bottom: -1px!important;\r\n}\r\nbody.gf-enhanced .gf-script-header .gf-script-tabs li > a:hover {\r\n    color: var(--gf-text)!important;\r\n    border-bottom: 2px solid var(--gf-border-strong, #8c959f)!important;\r\n    background: transparent!important;\r\n    text-decoration: none!important;\r\n}\r\nbody.gf-enhanced .gf-script-header .gf-script-tabs li.current > span,\r\nbody.gf-enhanced .gf-script-header .gf-script-tabs li.current > a {\r\n    display: flex!important;\r\n    align-items: center!important;\r\n    gap: 8px!important;\r\n    padding: 8px 16px!important;\r\n    font-weight: 600!important;\r\n    color: var(--gf-text)!important;\r\n    border-bottom: 2px solid #fd8c73!important; /* GitHub coral underline */\r\n    background: transparent!important;\r\n    text-decoration: none!important;\r\n    box-sizing: border-box!important;\r\n}\r\nbody.gf-enhanced .gf-script-header .gf-script-tabs li a span,\r\nbody.gf-enhanced .gf-script-header .gf-script-tabs li span span {\r\n    border: 0!important;\r\n    border-bottom: 0!important;\r\n    text-decoration: none!important;\r\n    padding: 0!important;\r\n    margin: 0!important;\r\n    background: transparent!important;\r\n}\r\nbody.gf-enhanced .gf-tab-icon {\r\n    opacity: 0.7;\r\n    width: 16px;\r\n    height: 16px;\r\n    stroke: currentColor;\r\n    fill: none;\r\n}\r\n\r\n/* Two-column Layout */\r\nbody.gf-enhanced .gf-script-body-layout {\r\n    display: grid!important;\r\n    grid-template-columns: 3fr 1fr;\r\n    gap: 24px;\r\n    align-items: start;\r\n}\r\nbody.gf-enhanced .gf-script-main-column {\r\n    display: flex;\r\n    flex-direction: column;\r\n    gap: 20px;\r\n    min-width: 0;\r\n}\r\nbody.gf-enhanced .gf-script-sidebar-column {\r\n    display: flex;\r\n    flex-direction: column;\r\n    gap: 20px;\r\n    min-width: 0;\r\n}\r\n\r\n/* Main column items */\r\nbody.gf-enhanced #install-area {\r\n    margin: 0 0 20px 0!important;\r\n    padding: 0!important;\r\n    background: transparent!important;\r\n    border: 0!important;\r\n}\r\nbody.gf-enhanced #install-area a.install-link,\r\nbody.gf-enhanced #install-area a.install-help-link {\r\n    display: inline-flex!important;\r\n    align-items: center!important;\r\n    justify-content: center!important;\r\n    height: 32px!important;\r\n    padding: 0 16px!important;\r\n    font-size: 14px!important;\r\n    font-weight: 600!important;\r\n    border-radius: 6px!important;\r\n    text-decoration: none!important;\r\n    box-shadow: 0 1px 0 var(--gf-shadow)!important;\r\n}\r\nbody.gf-enhanced #install-area a.install-link {\r\n    background-color: #238636!important; /* GitHub green */\r\n    color: #fff!important;\r\n    border: 1px solid rgba(240,246,252,0.1)!important;\r\n}\r\nbody.gf-enhanced #install-area a.install-link:hover {\r\n    background-color: #2ea043!important;\r\n}\r\nbody.gf-enhanced #install-area a.install-help-link {\r\n    background-color: var(--gf-control)!important;\r\n    color: var(--gf-text)!important;\r\n    border: 1px solid var(--gf-border)!important;\r\n    margin-left: 8px!important;\r\n}\r\nbody.gf-enhanced #install-area a.install-help-link:hover {\r\n    background-color: var(--gf-subtle)!important;\r\n    border-color: var(--gf-strong)!important;\r\n}\r\n\r\n/* README MD box styling */\r\nbody.gf-enhanced .gf-readme-box {\r\n    border: 1px solid var(--gf-border)!important;\r\n    border-radius: 6px!important;\r\n    background: var(--gf-canvas)!important;\r\n    box-shadow: 0 4px 12px var(--gf-shadow)!important;\r\n    overflow: hidden!important;\r\n}\r\nbody.gf-enhanced .gf-readme-header {\r\n    background: var(--gf-subtle)!important;\r\n    border-bottom: 1px solid var(--gf-border)!important;\r\n    padding: 12px 16px!important;\r\n    font-size: 13px!important;\r\n    font-weight: 600!important;\r\n    color: var(--gf-text)!important;\r\n    display: flex;\r\n    align-items: center;\r\n    gap: 8px;\r\n}\r\nbody.gf-enhanced .gf-readme-icon {\r\n    color: var(--gf-muted);\r\n}\r\nbody.gf-enhanced .gf-readme-content {\r\n    padding: 24px 32px!important;\r\n}\r\nbody.gf-enhanced .gf-readme-content .user-content {\r\n    background: transparent!important;\r\n    background-color: transparent!important;\r\n    border: none!important;\r\n    padding: 0!important;\r\n    margin: 0!important;\r\n    box-shadow: none!important;\r\n}\r\nbody.gf-enhanced .gf-readme-summary {\r\n    font-size: 15px!important;\r\n    line-height: 1.6!important;\r\n    color: var(--gf-text)!important;\r\n    margin-bottom: 20px!important;\r\n    padding-bottom: 20px!important;\r\n    border-bottom: 1px solid var(--gf-border-muted)!important;\r\n}\r\n\r\n/* Sidebar stats */\r\nbody.gf-enhanced .gf-script-sidebar-column .script-meta-block {\r\n    background: transparent!important;\r\n    border: 0!important;\r\n    padding: 0!important;\r\n    box-shadow: none!important;\r\n    margin: 0!important;\r\n    display: block!important;\r\n    column-count: auto!important;\r\n    column-width: auto!important;\r\n    grid-template-columns: none!important;\r\n}\r\nbody.gf-script-detail-page .gf-script-sidebar-column #script-stats,\r\nbody.gf-script-detail-page .gf-sidebar-groups {\r\n    display: block!important;\r\n    column-count: auto!important;\r\n    column-width: auto!important;\r\n    grid-template-columns: none!important;\r\n}\r\nbody.gf-script-detail-page .gf-sidebar-section {\r\n    border-bottom: 1px solid var(--gf-border)!important;\r\n    padding-bottom: 16px!important;\r\n    margin-bottom: 16px!important;\r\n    display: block!important;\r\n}\r\nbody.gf-script-detail-page .gf-sidebar-section:last-of-type {\r\n    border-bottom: 0!important;\r\n    padding-bottom: 0!important;\r\n    margin-bottom: 0!important;\r\n}\r\nbody.gf-script-detail-page .gf-sidebar-section h3 {\r\n    font-size: 14px!important;\r\n    font-weight: 600!important;\r\n    color: var(--gf-text)!important;\r\n    margin: 0 0 12px 0!important;\r\n    border: 0!important;\r\n    padding: 0!important;\r\n}\r\nbody.gf-script-detail-page .gf-sidebar-row {\r\n    display: flex!important;\r\n    align-items: center!important;\r\n    gap: 8px!important;\r\n    font-size: 13.5px!important;\r\n    color: var(--gf-secondary)!important;\r\n    margin-bottom: 8px!important;\r\n    line-height: 1.4!important;\r\n}\r\nbody.gf-script-detail-page .gf-sidebar-row:last-of-type {\r\n    margin-bottom: 0!important;\r\n}\r\nbody.gf-script-detail-page .gf-sidebar-icon {\r\n    color: var(--gf-muted)!important;\r\n    flex: 0 0 16px!important;\r\n    width: 16px!important;\r\n    height: 16px!important;\r\n}\r\nbody.gf-script-detail-page .gf-sidebar-label {\r\n    color: var(--gf-muted)!important;\r\n    font-weight: 400!important;\r\n    white-space: nowrap!important;\r\n}\r\nbody.gf-script-detail-page .gf-sidebar-value {\r\n    color: var(--gf-text)!important;\r\n}\r\nbody.gf-script-detail-page .gf-sidebar-subtext {\r\n    color: var(--gf-muted)!important;\r\n    font-size: 12px!important;\r\n}\r\nbody.gf-script-detail-page .gf-sidebar-value a {\r\n    color: var(--gf-accent)!important;\r\n    text-decoration: none!important;\r\n}\r\nbody.gf-script-detail-page .gf-sidebar-value a:hover {\r\n    text-decoration: underline!important;\r\n}\r\n\r\nbody.gf-script-detail-page .gf-release-link {\r\n    font-weight: 600!important;\r\n    color: var(--gf-accent)!important;\r\n    text-decoration: none!important;\r\n    cursor: pointer!important;\r\n}\r\nbody.gf-script-detail-page .gf-release-link:hover {\r\n    text-decoration: underline!important;\r\n}\r\nbody.gf-script-detail-page .gf-release-latest {\r\n    display: inline-block!important;\r\n    border: 1px solid var(--gf-border)!important;\r\n    color: #2ea043!important; /* GitHub green badge color */\r\n    font-size: 11px!important;\r\n    font-weight: 600!important;\r\n    padding: 1px 6px!important;\r\n    border-radius: 2em!important;\r\n    margin-left: 6px!important;\r\n    background-color: var(--gf-control)!important;\r\n}\r\nbody.gf-script-detail-page .gf-release-subtext {\r\n    font-size: 12px!important;\r\n    color: var(--gf-muted)!important;\r\n    margin-left: 24px!important;\r\n    margin-top: 4px!important;\r\n}\r\n\r\n/* Contributors section styling */\r\nbody.gf-script-detail-page .gf-contributors-list {\r\n    display: flex!important;\r\n    flex-direction: column!important;\r\n    gap: 8px!important;\r\n}\r\nbody.gf-script-detail-page .gf-contributor-item {\r\n    display: block!important;\r\n}\r\nbody.gf-script-detail-page .gf-contributor-link {\r\n    display: inline-flex!important;\r\n    align-items: center!important;\r\n    gap: 8px!important;\r\n    text-decoration: none!important;\r\n    color: var(--gf-text)!important;\r\n    font-weight: 500!important;\r\n}\r\nbody.gf-script-detail-page .gf-contributor-link:hover .gf-contributor-name {\r\n    color: var(--gf-accent)!important;\r\n    text-decoration: underline!important;\r\n}\r\n\r\n/* Responsive adjustment for detail columns */\r\n@media(max-width:900px) {\r\n    body.gf-enhanced .gf-script-body-layout {\r\n        grid-template-columns: 1fr!important;\r\n    }\r\n}\r\n\r\n/* GitHub Releases page reconstruction */\r\nbody.gf-versions-page form:not(.language-selector) {\r\n    position: relative;\r\n    width: 100%!important;\r\n    max-width: 100%!important;\r\n}\r\nbody.gf-versions-page ul.history_versions {\r\n    --gf-timeline-gutter: 96px;\r\n    position: relative;\r\n    list-style: none!important;\r\n    margin: 24px 0!important;\r\n    padding: 0!important;\r\n}\r\nbody.gf-versions-page ul.history_versions::before {\r\n    content: \"\";\r\n    position: absolute;\r\n    top: 0;\r\n    bottom: 0;\r\n    left: var(--gf-timeline-gutter);\r\n    width: 2px;\r\n    background-color: var(--gf-border);\r\n}\r\nbody.gf-versions-page ul.history_versions li {\r\n    display: flex!important;\r\n    gap: 16px;\r\n    margin-bottom: 40px!important;\r\n    position: relative;\r\n    list-style: none!important;\r\n    padding: 0!important;\r\n}\r\nbody.gf-versions-page .gf-release-sidebar {\r\n    flex: 0 0 var(--gf-timeline-gutter);\r\n    display: flex;\r\n    justify-content: flex-end;\r\n    align-items: flex-start;\r\n    position: relative;\r\n    padding-right: 16px;\r\n    padding-top: 12px;\r\n    box-sizing: border-box;\r\n}\r\nbody.gf-versions-page .gf-release-date {\r\n    font-size: 13px;\r\n    color: var(--gf-muted);\r\n    text-align: right;\r\n    font-weight: 500;\r\n}\r\nbody.gf-versions-page .gf-release-timeline-node {\r\n    position: absolute;\r\n    right: -17px;\r\n    top: 10px;\r\n    width: 32px;\r\n    height: 32px;\r\n    border-radius: 50%;\r\n    background-color: var(--gf-control);\r\n    border: 2px solid var(--gf-border);\r\n    display: flex;\r\n    align-items: center;\r\n    justify-content: center;\r\n    color: var(--gf-muted);\r\n    z-index: 2;\r\n    box-shadow: 0 1px 0 var(--gf-shadow);\r\n}\r\nbody.gf-versions-page .gf-release-main-card {\r\n    flex: 1;\r\n    min-width: 0;\r\n    background-color: var(--gf-canvas);\r\n    border: 1px solid var(--gf-border);\r\n    border-radius: 6px;\r\n    box-shadow: 0 4px 12px var(--gf-shadow);\r\n    display: flex;\r\n    flex-direction: column;\r\n    overflow: hidden;\r\n}\r\nbody.gf-versions-page .gf-release-card-header {\r\n    background-color: var(--gf-subtle);\r\n    border-bottom: 1px solid var(--gf-border);\r\n    padding: 12px 16px;\r\n    display: flex;\r\n    justify-content: space-between;\r\n    align-items: center;\r\n    flex-wrap: wrap;\r\n    gap: 12px;\r\n}\r\nbody.gf-versions-page .gf-release-header-left {\r\n    display: flex;\r\n    align-items: center;\r\n    gap: 8px;\r\n}\r\nbody.gf-versions-page .gf-release-version-title {\r\n    font-size: 16px!important;\r\n    font-weight: 600!important;\r\n    color: var(--gf-text)!important;\r\n    text-decoration: none!important;\r\n}\r\nbody.gf-versions-page .gf-release-version-title:hover {\r\n    color: var(--gf-accent)!important;\r\n    text-decoration: underline!important;\r\n}\r\nbody.gf-versions-page .gf-release-header-right {\r\n    display: flex;\r\n    align-items: center;\r\n    gap: 16px;\r\n    font-size: 13px;\r\n    color: var(--gf-secondary);\r\n}\r\nbody.gf-versions-page .gf-release-diff-select {\r\n    display: inline-flex;\r\n    align-items: center;\r\n    gap: 6px;\r\n}\r\nbody.gf-versions-page .gf-diff-select-label {\r\n    font-weight: 500;\r\n    color: var(--gf-muted);\r\n}\r\nbody.gf-versions-page .gf-release-card-body {\r\n    padding: 16px 20px;\r\n    font-size: 14px;\r\n    color: var(--gf-text);\r\n    line-height: 1.6;\r\n}\r\nbody.gf-versions-page .gf-no-changelog {\r\n    color: var(--gf-muted);\r\n    font-style: italic;\r\n    margin: 0!important;\r\n}\r\nbody.gf-versions-page .gf-release-card-footer {\r\n    border-top: 1px solid var(--gf-border-muted);\r\n    padding: 12px 16px;\r\n    background-color: var(--gf-canvas);\r\n}\r\nbody.gf-versions-page .gf-assets-title {\r\n    font-size: 13px!important;\r\n    font-weight: 600!important;\r\n    color: var(--gf-text)!important;\r\n    margin: 0 0 8px 0!important;\r\n    border: 0!important;\r\n    padding: 0!important;\r\n}\r\nbody.gf-versions-page .gf-assets-list {\r\n    display: flex;\r\n    flex-direction: column;\r\n    gap: 6px;\r\n}\r\nbody.gf-versions-page .gf-asset-item {\r\n    display: inline-flex;\r\n    align-items: center;\r\n    gap: 8px;\r\n    font-size: 13px!important;\r\n    color: var(--gf-accent)!important;\r\n    text-decoration: none!important;\r\n    font-weight: 500!important;\r\n    width: max-content;\r\n}\r\nbody.gf-versions-page .gf-asset-item:hover {\r\n    text-decoration: underline!important;\r\n}\r\nbody.gf-versions-page .gf-asset-icon {\r\n    color: var(--gf-muted);\r\n}\r\nbody.gf-versions-page .gf-release-delete-btn a {\r\n    color: #cf222e!important;\r\n    font-weight: 500!important;\r\n    text-decoration: none!important;\r\n}\r\nbody.gf-versions-page .gf-release-delete-btn a:hover {\r\n    text-decoration: underline!important;\r\n}\r\n\r\n/* Compare versions submit buttons */\r\nbody.gf-versions-page form:not(.language-selector) input[type=\"submit\"] {\r\n    display: inline-flex!important;\r\n    align-items: center!important;\r\n    justify-content: center!important;\r\n    padding: 5px 16px!important;\r\n    font-size: 13px!important;\r\n    font-weight: 500!important;\r\n    line-height: 20px!important;\r\n    white-space: nowrap!important;\r\n    vertical-align: middle!important;\r\n    cursor: pointer!important;\r\n    user-select: none!important;\r\n    background-color: var(--gf-control)!important;\r\n    border: 1px solid var(--gf-border)!important;\r\n    border-radius: 6px!important;\r\n    color: var(--gf-text)!important;\r\n    box-shadow: 0 1px 0 var(--gf-shadow), inset 0 1px 0 rgba(255, 255, 255, 0.05)!important;\r\n    transition: background-color 0.12s, border-color 0.12s!important;\r\n    margin: 12px 0!important;\r\n    outline: none!important;\r\n}\r\nbody.gf-versions-page form input[type=\"submit\"]:hover {\r\n    background-color: var(--gf-border)!important;\r\n    border-color: var(--gf-strong)!important;\r\n    text-decoration: none!important;\r\n}\r\nbody.gf-versions-page form input[type=\"submit\"]:active {\r\n    background-color: var(--gf-subtle)!important;\r\n    border-color: var(--gf-border)!important;\r\n}\r\n\r\n@media(max-width:1180px){body.gf-enhanced #site-nav{display:none!important}body.gf-enhanced #mobile-nav{display:block!important}body.gf-enhanced #main-header>.width-constraint{padding-inline:16px}body.gf-enhanced #main-header>.width-constraint>.gf-theme-toggle{margin-left:auto}}\r\n@media(max-width:760px){body.gf-enhanced:has(.gf-user-dashboard)>.width-constraint{padding:0 14px!important}.gf-user-dashboard{display:block!important}.gf-dashboard-sidebar-column{position:static!important}.gf-dashboard-sidebar{flex-direction:row!important;overflow:auto}.gf-dashboard-tab{width:auto!important;min-width:max-content!important;border-left:0!important;border-bottom:2px solid transparent!important}.gf-dashboard-tab.is-active{border-bottom-color:var(--gf-accent)!important}.gf-dashboard-content>section{padding:20px!important}body.gf-enhanced .text-content{padding:20px 16px!important;margin:16px 8px!important;border-radius:4px!important}body.gf-versions-page ul.history_versions::before {display: none!important;}body.gf-versions-page ul.history_versions li {flex-direction: column!important; gap: 12px!important;}body.gf-versions-page .gf-release-sidebar {flex: none!important; justify-content: flex-start!important; padding: 0!important; padding-top: 0!important;}body.gf-versions-page .gf-release-timeline-node {display: none!important;}body.gf-versions-page .gf-release-date {text-align: left!important; font-weight: 600!important;}}\r\n@media(max-width:640px){body.gf-homepage-redesign{overflow:auto!important}body.gf-homepage-redesign #main-header{position:sticky!important}.gf-scroll-container{height:auto;overflow:visible}.gf-scroll-page{min-height:auto;padding:24px 16px}.gf-page-nav{display:none}}\r\n\r\n/* Statistics dashboard */\r\nbody.gf-statistics-page #script-content{max-width:100%!important}\r\nbody.gf-statistics-page .gf-statistics-shell{display:flex;flex-direction:column;gap:18px}\r\nbody.gf-statistics-page .gf-statistics-filter{display:flex!important;justify-content:flex-end!important;margin:0!important;padding:0!important}\r\nbody.gf-statistics-page .gf-statistics-controls{display:flex;align-items:center;justify-content:flex-end;gap:8px}\r\nbody.gf-statistics-page .gf-entertainment-toggle{display:inline-flex;align-items:center;padding:8px 14px;border:1px solid var(--gf-border);border-radius:8px;background:var(--gf-control);color:var(--gf-secondary);font:inherit;font-size:13px;font-weight:600;cursor:pointer;box-shadow:0 1px 2px var(--gf-shadow)}\r\nbody.gf-statistics-page .gf-entertainment-toggle:hover,body.gf-statistics-page .gf-entertainment-toggle.is-active{border-color:var(--gf-accent);background:var(--gf-accent);color:#fff}\r\nbody.gf-statistics-page .gf-period-switcher{display:inline-flex;overflow:hidden;border:1px solid var(--gf-border);border-radius:8px;background:var(--gf-control);box-shadow:0 1px 2px var(--gf-shadow)}\r\nbody.gf-statistics-page .gf-period-button{display:inline-flex!important;align-items:center;padding:8px 14px!important;border:0!important;border-right:1px solid var(--gf-border)!important;background:transparent!important;color:var(--gf-secondary)!important;font-size:13px!important;text-decoration:none!important;white-space:nowrap}\r\nbody.gf-statistics-page .gf-period-button:last-child{border-right:0!important}\r\nbody.gf-statistics-page .gf-period-button:hover{background:var(--gf-subtle)!important;color:var(--gf-text)!important}\r\nbody.gf-statistics-page .gf-period-button.is-active{background:var(--gf-accent)!important;color:#fff!important;font-weight:600!important}\r\nbody.gf-statistics-page .gf-statistics-shell>h3,body.gf-statistics-page .gf-data-title{margin:12px 0 -8px!important;color:var(--gf-text)!important;font-size:16px!important}\r\nbody.gf-statistics-page .gf-market-chart{display:none;min-height:150px;padding:14px 14px 10px!important;border:1px solid var(--gf-border)!important;border-radius:10px!important;background:linear-gradient(180deg,var(--gf-subtle),var(--gf-canvas))!important;box-shadow:0 8px 20px var(--gf-shadow)!important}\r\nbody.gf-statistics-page.gf-entertainment-mode .gf-market-chart{display:block!important}\r\nbody.gf-statistics-page .gf-market-chart-viewport{overflow-x:auto!important;overflow-y:hidden!important;cursor:grab;scrollbar-width:thin;touch-action:pan-y}\r\nbody.gf-statistics-page .gf-market-chart-viewport.is-dragging{cursor:grabbing;user-select:none}\r\nbody.gf-statistics-page .gf-market-bars{--candle-width:7px;position:relative;display:flex;align-items:stretch;gap:0;width:max-content;min-width:100%;height:168px;padding:0 3px;background:repeating-linear-gradient(to bottom,transparent 0,transparent 33px,var(--gf-border-muted) 34px)}\r\nbody.gf-statistics-page .gf-market-bars::before{content:\"\";position:absolute;left:0;right:0;top:0;z-index:2;height:1px;background:var(--gf-border-muted)}\r\nbody.gf-statistics-page .gf-market-slot{position:relative;z-index:1;display:flex;flex:0 0 var(--candle-width);width:var(--candle-width);height:100%;align-items:center;justify-content:center;cursor:crosshair}\r\nbody.gf-statistics-page .gf-market-slot::after{content:\"\";position:absolute;top:0;bottom:0;left:50%;width:1px;background:transparent;transition:background .15s}\r\nbody.gf-statistics-page .gf-market-slot:hover::after{background:var(--gf-border-muted)}\r\nbody.gf-statistics-page .gf-market-wick{position:absolute;left:50%;top:var(--wick-top);z-index:2;display:block;width:1px;height:var(--wick-height);transform:translateX(-50%);opacity:.8}\r\nbody.gf-statistics-page .gf-market-bar{position:absolute;left:50%;top:var(--candle-top);z-index:3;display:block;width:min(100%,10px);height:var(--candle-height);border-radius:1px;opacity:.96;transform:translateX(-50%);transition:width .15s,opacity .15s,filter .15s}\r\nbody.gf-statistics-page .gf-market-slot.is-up .gf-market-wick{background:#da3633}\r\nbody.gf-statistics-page .gf-market-slot.is-down .gf-market-wick{background:#238636}\r\nbody.gf-statistics-page .gf-market-slot.is-flat .gf-market-wick{background:var(--gf-muted)}\r\nbody.gf-statistics-page .gf-market-slot.is-up .gf-market-bar{background:linear-gradient(180deg,#ff766d,#d1242f);box-shadow:0 0 0 1px rgba(248,81,73,.24)}\r\nbody.gf-statistics-page .gf-market-slot.is-down .gf-market-bar{background:linear-gradient(180deg,#42c65a,#238636);box-shadow:0 0 0 1px rgba(46,160,67,.24)}\r\nbody.gf-statistics-page .gf-market-slot.is-flat .gf-market-bar{top:calc(var(--point-position) - 1.5px);width:7px;height:3px;background:var(--gf-muted)}\r\nbody.gf-statistics-page .gf-market-slot:hover .gf-market-bar{width:min(100%,14px);opacity:1;filter:saturate(1.25)}\r\nbody.gf-statistics-page .gf-native-stats-chart-hidden,body.gf-statistics-page .gf-native-stats-title-hidden{display:none!important;visibility:hidden!important;height:0!important;min-height:0!important;margin:0!important;padding:0!important;border:0!important}\r\nbody.gf-statistics-page .gf-market-slot:hover .gf-market-wick{width:2px;opacity:1}\r\nbody.gf-statistics-page .gf-data-table{display:none!important}\r\nbody.gf-statistics-page .gf-statistics-data-panel{margin:8px 0 0!important;border:1px solid var(--gf-border)!important;border-radius:10px!important;background:var(--gf-canvas)!important;box-shadow:0 8px 20px var(--gf-shadow)!important;overflow:hidden!important}\r\nbody.gf-statistics-page .gf-statistics-data-header{display:flex!important;align-items:center!important;justify-content:space-between!important;padding:14px 16px!important;border-bottom:1px solid var(--gf-border)!important;background:var(--gf-subtle)!important}\r\nbody.gf-statistics-page .gf-statistics-data-header h3{margin:0!important;color:var(--gf-text)!important;font-size:15px!important}\r\nbody.gf-statistics-page .gf-statistics-data-count{padding:3px 8px!important;border-radius:999px!important;background:var(--gf-control)!important;color:var(--gf-muted)!important;font-size:12px!important;font-weight:600!important}\r\nbody.gf-statistics-page .gf-statistics-data-grid{display:grid!important;grid-template-columns:repeat(auto-fill,minmax(180px,1fr))!important;gap:1px!important;background:var(--gf-border)!important}\r\nbody.gf-statistics-page .gf-statistics-data-card{min-width:0!important;padding:13px 14px!important;background:var(--gf-canvas)!important}\r\nbody.gf-statistics-page .gf-statistics-data-card:hover{background:var(--gf-subtle)!important}\r\nbody.gf-statistics-page .gf-statistics-data-card time{display:block!important;margin-bottom:11px!important;color:var(--gf-text)!important;font:600 13px ui-monospace,SFMono-Regular,Consolas,monospace!important}\r\nbody.gf-statistics-page .gf-statistics-data-metrics{display:grid!important;grid-template-columns:1fr 1fr!important;gap:10px!important}\r\nbody.gf-statistics-page .gf-statistics-metric{display:flex!important;min-width:0!important;flex-direction:column!important;gap:2px!important}\r\nbody.gf-statistics-page .gf-statistics-metric span{color:var(--gf-muted)!important;font-size:11px!important}\r\nbody.gf-statistics-page .gf-statistics-metric strong{color:var(--gf-text)!important;font-size:17px!important;line-height:1.2!important}\r\nbody.gf-statistics-page .gf-statistics-metric:first-child strong{color:var(--gf-accent)!important}\r\nbody.gf-statistics-page .gf-data-table thead,body.gf-statistics-page .gf-data-table tbody{display:table!important;width:100%!important;min-width:560px!important;border-collapse:collapse!important}\r\nbody.gf-statistics-page .gf-data-table th,body.gf-statistics-page .gf-data-table td{padding:11px 16px!important;border-bottom:1px solid var(--gf-border-muted)!important;color:var(--gf-secondary)!important;background:transparent!important}\r\nbody.gf-statistics-page .gf-data-table thead th{background:var(--gf-subtle)!important;color:var(--gf-text)!important;font-size:12px!important;text-transform:uppercase;letter-spacing:.04em}\r\nbody.gf-statistics-page .gf-data-table tbody tr:hover{background:var(--gf-inset)!important}\r\nbody.gf-statistics-page .gf-data-table tbody tr:last-child th,body.gf-statistics-page .gf-data-table tbody tr:last-child td{border-bottom:0!important}\r\nbody.gf-statistics-page .gf-download-panel{display:flex;align-items:center;justify-content:flex-end;gap:8px;margin:0!important;padding:12px 16px!important;border-top:1px solid var(--gf-border)!important;background:var(--gf-subtle)!important;color:var(--gf-muted)!important;font-size:13px!important}\r\nbody.gf-statistics-page .gf-download-panel>a.gf-download-button{display:inline-flex!important;align-items:center;padding:8px 14px!important;border:1px solid var(--gf-border)!important;border-radius:7px!important;background:var(--gf-control)!important;color:var(--gf-text)!important;font-weight:600!important;text-decoration:none!important;box-shadow:0 1px 2px var(--gf-shadow)!important}\r\nbody.gf-statistics-page .gf-download-panel>a.gf-download-button:hover{border-color:var(--gf-accent)!important;background:var(--gf-subtle)!important;color:var(--gf-accent)!important}\r\n@media(max-width:640px){body.gf-statistics-page .gf-statistics-filter{justify-content:flex-start!important}body.gf-statistics-page .gf-statistics-controls{justify-content:flex-start;flex-wrap:wrap}body.gf-statistics-page .gf-period-button{padding-inline:10px!important}body.gf-statistics-page .gf-download-panel{justify-content:flex-start;flex-wrap:wrap}}\r\n\r\n/* New script version / Update page */\nbody.gf-new-version-page .gf-script-main-column{max-width:none!important}\nbody.gf-new-version-page .gf-script-body-layout{grid-template-columns:minmax(0,1fr)!important}\nbody.gf-new-version-page .gf-script-sidebar-column{display:none!important}\n\n/* Page heading */\nbody.gf-new-version-page h2 {\n    font-size: 20px!important;\n    font-weight: 600!important;\n    color: var(--gf-text)!important;\n    margin: 12px 0 20px 0!important;\n    padding-bottom: 8px!important;\n    border-bottom: 1px solid var(--gf-border-muted)!important;\n}\n\n/* Notice Banner */\nbody.gf-new-version-page .gf-notice-banner {\n    display: flex!important;\n    align-items: flex-start!important;\n    gap: 10px!important;\n    padding: 12px 16px!important;\n    background-color: rgba(56, 139, 253, 0.1)!important;\n    border: 1px solid rgba(56, 139, 253, 0.4)!important;\n    border-radius: 6px!important;\n    color: var(--gf-secondary)!important;\n    font-size: 13px!important;\n    line-height: 1.5!important;\n    margin: 0 auto 20px auto!important;\n    width: min(100%, 1180px)!important;\n    box-sizing: border-box!important;\n}\nhtml[data-gf-theme=light] body.gf-new-version-page .gf-notice-banner {\n    background-color: rgba(9, 105, 218, 0.08)!important;\n    border-color: rgba(9, 105, 218, 0.3)!important;\n}\nbody.gf-new-version-page .gf-notice-banner svg {\n    flex-shrink: 0!important;\n    color: #388bfd!important;\n    margin-top: 2px!important;\n}\nhtml[data-gf-theme=light] body.gf-new-version-page .gf-notice-banner svg {\n    color: #0969da!important;\n}\nbody.gf-new-version-page .gf-notice-banner a {\n    color: var(--gf-accent)!important;\n    font-weight: 500!important;\n    text-decoration: none!important;\n}\nbody.gf-new-version-page .gf-notice-banner a:hover {\n    text-decoration: underline!important;\n}\n\n/* Form structure */\nbody.gf-new-version-page form.new_script_version{display:flex!important;flex-direction:column!important;gap:20px!important;width:min(100%, 1180px)!important;margin:0 auto!important}\nbody.gf-new-version-page form.new_script_version .form-section{box-sizing:border-box!important;margin:0!important;padding:0!important;border:1px solid var(--gf-border)!important;border-radius:8px!important;background:var(--gf-subtle)!important;box-shadow:0 6px 16px var(--gf-shadow)!important;overflow:hidden!important}\nbody.gf-new-version-page form.new_script_version .form-control{padding:20px 24px!important}\n\n/* Card Header */\nbody.gf-new-version-page .gf-card-header {\n    display: flex;\n    flex-wrap: wrap;\n    align-items: center;\n    justify-content: space-between;\n    gap: 8px 16px;\n    padding: 14px 24px;\n    background-color: var(--gf-inset);\n    border-bottom: 1px solid var(--gf-border);\n}\nbody.gf-new-version-page .gf-card-title {\n    font-size: 14px!important;\n    font-weight: 600!important;\n    color: var(--gf-text)!important;\n    margin: 0!important;\n}\nbody.gf-new-version-page .gf-card-subtitle {\n    font-size: 12px!important;\n    color: var(--gf-muted)!important;\n    font-weight: 400!important;\n}\nbody.gf-new-version-page .gf-header-toggle-wrapper {\n    display: flex;\n    align-items: center;\n    gap: 8px;\n    font-size: 12px;\n    color: var(--gf-secondary);\n}\nbody.gf-new-version-page .gf-header-toggle-wrapper input[type=\"checkbox\"] {\n    width: auto!important;\n    margin: 0!important;\n    cursor: pointer;\n}\nbody.gf-new-version-page .gf-header-toggle-wrapper label {\n    font-weight: 500!important;\n    font-size: 12px!important;\n    color: var(--gf-muted)!important;\n    cursor: pointer;\n}\n\n/* Fields & inputs */\nbody.gf-new-version-page form.new_script_version textarea,\nbody.gf-new-version-page form.new_script_version input[type=\"text\"],\nbody.gf-new-version-page form.new_script_version select{box-sizing:border-box!important;width:100%!important;max-width:100%!important;border:1px solid var(--gf-border)!important;border-radius:6px!important;background:var(--gf-canvas)!important;color:var(--gf-text)!important;font:inherit!important;transition:border-color 0.15s, box-shadow 0.15s!important}\nbody.gf-new-version-page form.new_script_version textarea:focus,\nbody.gf-new-version-page form.new_script_version input[type=\"text\"]:focus,\nbody.gf-new-version-page form.new_script_version select:focus {\n    outline: 0!important;\n    border-color: var(--gf-accent)!important;\n    box-shadow: 0 0 0 3px var(--gf-ring)!important;\n}\nbody.gf-new-version-page form.new_script_version textarea{min-height:150px!important;padding:12px 14px!important;line-height:1.55!important;resize:vertical!important}\nbody.gf-new-version-page form.new_script_version #script_version_code{min-height:560px!important;padding:18px!important;border:0!important;border-radius:0!important;background:var(--gf-inset)!important;font:13px/1.55 ui-monospace,SFMono-Regular,Consolas,monospace!important;tab-size:4!important}\nbody.gf-new-version-page form.new_script_version #script-version-additional-info-0{min-height:220px!important}\nbody.gf-new-version-page form.new_script_version #script_version_changelog{min-height:140px!important}\n\n/* Local upload row in code editor section */\nbody.gf-new-version-page .gf-file-upload-row {\n    margin-top: 16px;\n    padding: 12px 16px;\n    background-color: var(--gf-inset);\n    border: 1px dashed var(--gf-border);\n    border-radius: 6px;\n    display: flex;\n    align-items: center;\n    gap: 12px;\n    font-size: 13px;\n    color: var(--gf-secondary);\n}\nbody.gf-new-version-page .gf-upload-btn {\n    display: inline-flex;\n    align-items: center;\n    justify-content: center;\n    padding: 5px 12px;\n    font-size: 12px;\n    font-weight: 500;\n    line-height: 18px;\n    white-space: nowrap;\n    cursor: pointer;\n    background-color: var(--gf-control);\n    border: 1px solid var(--gf-border);\n    border-radius: 6px;\n    color: var(--gf-text);\n    transition: background-color 0.12s, border-color 0.12s;\n}\nbody.gf-new-version-page .gf-upload-btn:hover {\n    background-color: var(--gf-border);\n    border-color: var(--gf-strong);\n}\nbody.gf-new-version-page .gf-upload-status {\n    font-size: 12px;\n    color: var(--gf-muted);\n}\nbody.gf-new-version-page .gf-upload-status.has-file {\n    color: var(--gf-accent);\n    font-weight: 500;\n}\n\n/* Secondary Actions / Add Localization Button */\nbody.gf-new-version-page #add-additional-info {\n    display: inline-flex!important;\n    align-items: center!important;\n    justify-content: center!important;\n    padding: 6px 14px!important;\n    font-size: 13px!important;\n    font-weight: 500!important;\n    line-height: 20px!important;\n    white-space: nowrap!important;\n    cursor: pointer!important;\n    background-color: var(--gf-control)!important;\n    border: 1px solid var(--gf-border)!important;\n    border-radius: 6px!important;\n    color: var(--gf-text)!important;\n    transition: background-color 0.12s, border-color 0.12s!important;\n    box-shadow: 0 1px 0 var(--gf-shadow)!important;\n    margin-top: 12px!important;\n}\nbody.gf-new-version-page #add-additional-info:hover {\n    background-color: var(--gf-border)!important;\n    border-color: var(--gf-strong);\n}\n\n/* Markdown Editor Wrapper */\nbody.gf-new-version-page .gf-markdown-editor {\n    border: 1px solid var(--gf-border)!important;\n    border-radius: 6px!important;\n    background-color: var(--gf-canvas)!important;\n    overflow: hidden!important;\n    margin-top: 0!important;\n    display: flex!important;\n    flex-direction: column!important;\n}\n\n/* Editor Header (Tabs) */\nbody.gf-new-version-page .gf-markdown-editor .tabs {\n    display: flex!important;\n    align-items: flex-end!important;\n    background-color: var(--gf-inset)!important;\n    border-bottom: 1px solid var(--gf-border)!important;\n    padding: 8px 12px 0 12px!important;\n    margin: 0!important;\n    min-height: 40px!important;\n    box-sizing: border-box!important;\n}\n\n/* Individual tab items */\nbody.gf-new-version-page .gf-markdown-editor .tabs > span {\n    display: inline-block!important;\n    margin-bottom: -1px!important;\n    border: 1px solid transparent!important;\n    border-radius: 6px 6px 0 0!important;\n    background-color: transparent!important;\n}\nbody.gf-new-version-page .gf-markdown-editor .tabs > span a {\n    display: block!important;\n    padding: 8px 16px!important;\n    color: var(--gf-muted)!important;\n    font-size: 13px!important;\n    font-weight: 500!important;\n    text-decoration: none!important;\n    cursor: pointer!important;\n}\nbody.gf-new-version-page .gf-markdown-editor .tabs > span.current {\n    background-color: var(--gf-canvas)!important;\n    border-color: var(--gf-border) var(--gf-border) transparent var(--gf-border)!important;\n}\nbody.gf-new-version-page .gf-markdown-editor .tabs > span.current a {\n    color: var(--gf-text)!important;\n    font-weight: 600!important;\n}\nbody.gf-new-version-page .gf-markdown-editor .tabs > span:not(.current) a:hover {\n    color: var(--gf-text)!important;\n}\n\n/* Formatting options in markdown tabs header */\nbody.gf-new-version-page .gf-markdown-editor .tabs .gf-editor-markup-options {\n    margin-left: auto!important;\n    display: inline-flex!important;\n    align-items: center!important;\n    gap: 8px!important;\n    padding-bottom: 6px!important;\n    font-size: 12px!important;\n}\n\nbody.gf-new-version-page .gf-markup-help {\n    color: var(--gf-muted)!important;\n    font-size: 11px!important;\n    text-decoration: none!important;\n    font-weight: 500!important;\n}\nbody.gf-new-version-page .gf-markup-help:hover {\n    color: var(--gf-accent)!important;\n    text-decoration: underline!important;\n}\n\nbody.gf-new-version-page .gf-markup-pills {\n    display: inline-flex!important;\n    background-color: var(--gf-canvas)!important;\n    border: 1px solid var(--gf-border)!important;\n    border-radius: 6px!important;\n    overflow: hidden!important;\n    padding: 2px!important;\n    box-sizing: border-box!important;\n}\n\nbody.gf-new-version-page .gf-markup-pill {\n    display: inline-flex!important;\n    align-items: center!important;\n    justify-content: center!important;\n    padding: 2px 8px!important;\n    font-size: 11px!important;\n    font-weight: 500!important;\n    color: var(--gf-muted)!important;\n    cursor: pointer!important;\n    border-radius: 4px!important;\n    transition: background-color 0.12s, color 0.12s!important;\n    user-select: none!important;\n}\nbody.gf-new-version-page .gf-markup-pill:hover {\n    color: var(--gf-text)!important;\n}\nbody.gf-new-version-page .gf-markup-pill.is-active {\n    background-color: var(--gf-control)!important;\n    color: var(--gf-text)!important;\n    font-weight: 600!important;\n    box-shadow: 0 1px 2px rgba(0,0,0,0.06)!important;\n}\nbody.gf-new-version-page .gf-markup-pill input[type=\"radio\"] {\n    position: absolute!important;\n    opacity: 0!important;\n    width: 0!important;\n    height: 0!important;\n    margin: 0!important;\n}\n\n/* Textarea inside editor */\nbody.gf-new-version-page .gf-markdown-editor textarea {\n    border: 0!important;\n    border-radius: 0!important;\n    background-color: var(--gf-canvas)!important;\n    min-height: 200px!important;\n    padding: 16px!important;\n    margin: 0!important;\n    box-shadow: none!important;\n    font-family: var(--gf-font)!important;\n    font-size: 14px!important;\n    outline: none!important;\n    box-sizing: border-box!important;\n}\nbody.gf-new-version-page .gf-markdown-editor textarea:focus {\n    box-shadow: none!important;\n    border-color: transparent!important;\n}\n\n/* Preview area inside editor */\nbody.gf-new-version-page .gf-markdown-editor .preview-results {\n    padding: 20px 24px!important;\n    min-height: 200px!important;\n    box-sizing: border-box!important;\n    background-color: var(--gf-canvas)!important;\n    color: var(--gf-text)!important;\n    font-size: 14px!important;\n    line-height: 1.6!important;\n    overflow-y: auto!important;\n    border: 0!important;\n}\n\n/* Screenshots Drag and Drop Zone */\nbody.gf-new-version-page .gf-screenshot-dropzone {\n    margin: 16px 0 0 0!important;\n    padding: 0!important;\n    position: relative;\n    border: 1px dashed var(--gf-border);\n    border-radius: 6px;\n    background-color: var(--gf-inset);\n    transition: border-color 0.15s, background-color 0.15s;\n}\nbody.gf-new-version-page .gf-screenshot-dropzone:hover {\n    border-color: var(--gf-strong);\n    background-color: var(--gf-canvas);\n}\n\n/* Embedded screenshot attachment bar */\nbody.gf-new-version-page .gf-markdown-editor .gf-screenshot-dropzone {\n    margin: 0!important;\n    border: 0!important;\n    border-top: 1px solid var(--gf-border)!important;\n    border-radius: 0 0 6px 6px!important;\n    background-color: var(--gf-inset)!important;\n    transition: background-color 0.15s;\n    position: relative;\n    width: 100%!important;\n    box-sizing: border-box!important;\n}\nbody.gf-new-version-page .gf-markdown-editor .gf-screenshot-dropzone:hover {\n    background-color: var(--gf-subtle)!important;\n}\n\nbody.gf-new-version-page .gf-screenshot-dropzone .gf-dropzone-inner {\n    padding: 24px 20px;\n    display: flex;\n    flex-direction: column;\n    align-items: center;\n    text-align: center;\n    pointer-events: none;\n}\nbody.gf-new-version-page .gf-markdown-editor .gf-screenshot-dropzone .gf-dropzone-inner {\n    padding: 10px 18px!important;\n    display: flex!important;\n    flex-direction: row!important;\n    align-items: center!important;\n    justify-content: flex-start!important;\n    gap: 8px!important;\n    text-align: left!important;\n}\n\nbody.gf-new-version-page .gf-screenshot-dropzone .gf-upload-icon {\n    color: var(--gf-muted);\n    margin-bottom: 8px;\n}\nbody.gf-new-version-page .gf-markdown-editor .gf-screenshot-dropzone .gf-upload-icon {\n    width: 16px!important;\n    height: 16px!important;\n    margin-bottom: 0!important;\n}\n\nbody.gf-new-version-page .gf-screenshot-dropzone .gf-dropzone-text {\n    font-size: 13px;\n    color: var(--gf-secondary);\n    margin-bottom: 4px;\n}\nbody.gf-new-version-page .gf-markdown-editor .gf-screenshot-dropzone .gf-dropzone-text {\n    font-size: 12px!important;\n    color: var(--gf-muted)!important;\n    margin-bottom: 0!important;\n}\n\nbody.gf-new-version-page .gf-screenshot-dropzone .gf-dropzone-action {\n    color: var(--gf-accent);\n    font-weight: 600;\n}\nbody.gf-new-version-page .gf-markdown-editor .gf-screenshot-dropzone .gf-dropzone-action {\n    color: var(--gf-accent)!important;\n    font-weight: 500!important;\n}\n\nbody.gf-new-version-page .gf-screenshot-dropzone .gf-dropzone-info {\n    font-size: 11px;\n    color: var(--gf-muted);\n}\nbody.gf-new-version-page .gf-markdown-editor .gf-screenshot-dropzone .gf-dropzone-info {\n    font-size: 11px!important;\n    color: var(--gf-muted)!important;\n    margin-left: auto!important;\n}\n\nbody.gf-new-version-page .gf-screenshot-dropzone .gf-dropzone-input {\n    position: absolute!important;\n    top: 0;\n    left: 0;\n    width: 100%!important;\n    height: 100%!important;\n    opacity: 0!important;\n    cursor: pointer!important;\n    z-index: 10;\n}\nbody.gf-new-version-page .gf-screenshot-dropzone .gf-dropzone-files {\n    display: flex;\n    flex-wrap: wrap;\n    gap: 6px;\n    margin-top: 12px;\n    pointer-events: auto;\n}\nbody.gf-new-version-page .gf-markdown-editor .gf-screenshot-dropzone .gf-dropzone-files {\n    margin-top: 0!important;\n    display: inline-flex!important;\n    flex-wrap: wrap!important;\n    gap: 4px!important;\n    margin-left: 8px!important;\n}\n\nbody.gf-new-version-page .gf-screenshot-dropzone .gf-file-badge {\n    display: inline-flex;\n    align-items: center;\n    padding: 2px 8px;\n    background-color: var(--gf-control);\n    border: 1px solid var(--gf-border);\n    border-radius: 4px;\n    font-size: 11px;\n    color: var(--gf-text);\n    font-weight: 500;\n}\nbody.gf-new-version-page .gf-markdown-editor .gf-screenshot-dropzone .gf-file-badge {\n    padding: 1px 6px!important;\n    font-size: 10px!important;\n}\n\n/* Option Items (Script Type and Adult Content cards) */\nbody.gf-new-version-page .gf-options-group {\n    padding: 20px 24px!important;\n}\nbody.gf-new-version-page .gf-options-list {\n    display: flex;\n    flex-direction: column;\n    gap: 10px;\n    margin-top: 4px;\n}\nbody.gf-new-version-page .gf-option-item {\n    box-sizing: border-box;\n    display: flex;\n    align-items: flex-start;\n    gap: 12px;\n    padding: 12px 16px;\n    background-color: var(--gf-inset);\n    border: 1px solid var(--gf-border);\n    border-radius: 6px;\n    cursor: pointer;\n    transition: border-color 0.15s, background-color 0.15s;\n    position: relative;\n    user-select: none;\n}\nbody.gf-new-version-page .gf-option-item:hover {\n    border-color: var(--gf-strong);\n    background-color: var(--gf-canvas);\n}\nbody.gf-new-version-page .gf-option-item.is-selected {\n    border-color: var(--gf-accent);\n    background-color: var(--gf-soft);\n}\nbody.gf-new-version-page .gf-option-item input[type=\"radio\"],\nbody.gf-new-version-page .gf-option-item input[type=\"checkbox\"] {\n    position: absolute;\n    opacity: 0;\n    width: 0;\n    height: 0;\n    margin: 0;\n}\nbody.gf-new-version-page .gf-radio-indicator {\n    width: 16px;\n    height: 16px;\n    border: 1px solid var(--gf-border);\n    border-radius: 50%;\n    margin-top: 3px;\n    flex-shrink: 0;\n    position: relative;\n    background-color: var(--gf-canvas);\n    transition: border-color 0.15s, background-color 0.15s;\n}\nbody.gf-new-version-page .gf-option-item:hover .gf-radio-indicator {\n    border-color: var(--gf-strong);\n}\nbody.gf-new-version-page .gf-option-item.is-selected .gf-radio-indicator {\n    border-color: var(--gf-accent);\n    background-color: var(--gf-accent);\n}\nbody.gf-new-version-page .gf-option-item.is-selected .gf-radio-indicator::after {\n    content: \"\";\n    position: absolute;\n    width: 6px;\n    height: 6px;\n    top: 4px;\n    left: 4px;\n    border-radius: 50%;\n    background-color: #fff;\n}\nbody.gf-new-version-page .gf-checkbox-indicator {\n    width: 16px;\n    height: 16px;\n    border: 1px solid var(--gf-border);\n    border-radius: 4px;\n    margin-top: 3px;\n    flex-shrink: 0;\n    position: relative;\n    background-color: var(--gf-canvas);\n    transition: border-color 0.15s, background-color 0.15s;\n}\nbody.gf-new-version-page .gf-option-item:hover .gf-checkbox-indicator {\n    border-color: var(--gf-strong);\n}\nbody.gf-new-version-page .gf-option-item.is-selected .gf-checkbox-indicator {\n    border-color: var(--gf-accent);\n    background-color: var(--gf-accent);\n}\nbody.gf-new-version-page .gf-option-item.is-selected .gf-checkbox-indicator::after {\n    content: \"\";\n    position: absolute;\n    left: 5px;\n    top: 2px;\n    width: 4px;\n    height: 8px;\n    border: solid #fff;\n    border-width: 0 2px 2px 0;\n    transform: rotate(45deg);\n}\n\nbody.gf-new-version-page .gf-option-content {\n    flex: 1;\n    min-width: 0;\n}\nbody.gf-new-version-page .gf-option-title {\n    font-size: 13px;\n    font-weight: 600;\n    color: var(--gf-text);\n    margin-bottom: 2px;\n}\nbody.gf-new-version-page .gf-option-desc {\n    font-size: 12px;\n    color: var(--gf-muted);\n    line-height: 1.4;\n}\n\n/* Warnings and Overrides Card Group */\nbody.gf-new-version-page .gf-adult-content-group .gf-option-item.is-selected {\n    border-color: #d29922;\n    background-color: rgba(210, 153, 34, 0.1);\n}\nbody.gf-new-version-page .gf-adult-content-group .gf-option-item.is-selected .gf-checkbox-indicator {\n    border-color: #d29922;\n    background-color: #d29922;\n}\n\n/* Submit and Action Buttons */\nbody.gf-new-version-page .gf-form-actions {\n    display: flex!important;\n    align-items: center!important;\n    justify-content: flex-end!important;\n    gap: 16px!important;\n    margin: 8px 0 24px 0!important;\n    width: min(100%, 1180px)!important;\n    margin-inline: auto!important;\n    box-sizing: border-box!important;\n}\nbody.gf-new-version-page .gf-version-submit {\n    order: 2!important;\n    padding: 8px 18px!important;\n    border: 1px solid var(--gf-success)!important;\n    border-radius: 6px!important;\n    background: var(--gf-success)!important;\n    color: #fff!important;\n    font: inherit!important;\n    font-size: 13px!important;\n    font-weight: 600!important;\n    cursor: pointer!important;\n    box-shadow: 0 1px 0 rgba(0,0,0,0.1), inset 0 1px 0 rgba(255,255,255,0.03)!important;\n    transition: background-color 0.12s, border-color 0.12s!important;\n}\nbody.gf-new-version-page .gf-version-submit:hover {\n    background-color: var(--gf-accent)!important;\n    border-color: var(--gf-accent)!important;\n    filter: none!important;\n}\nbody.gf-new-version-page .gf-version-submit:active {\n    background-color: var(--gf-success)!important;\n    border-color: var(--gf-success)!important;\n}\nbody.gf-new-version-page .gf-form-cancel {\n    order: 1!important;\n    font-size: 13px!important;\n    color: var(--gf-muted)!important;\n    font-weight: 500!important;\n    text-decoration: none!important;\n}\nbody.gf-new-version-page .gf-form-cancel:hover {\n    color: #cf222e!important;\n    text-decoration: none!important;\n}\n\n/* Responsive adjustments */\n@media(max-width:760px){\n    body.gf-new-version-page form.new_script_version .form-section{padding:0!important}\n    body.gf-new-version-page form.new_script_version .form-section:has(#script_version_code) .form-control{padding:0!important}\n    body.gf-new-version-page form.new_script_version .form-control{padding:14px 16px!important}\n    body.gf-new-version-page .gf-card-header{padding:12px 16px!important}\n    body.gf-new-version-page form.new_script_version #script_version_code{min-height:420px!important}\n    body.gf-new-version-page .gf-options-group{padding:14px 16px!important}\n    body.gf-new-version-page .gf-form-actions{justify-content:space-between!important;padding:0 16px!important}\n}\n\n/* Derivatives / Similarity page */\r\nbody.gf-derivatives-page .gf-derivatives-dashboard{display:flex;flex-direction:column;gap:18px;width:100%;max-width:1040px;margin:0 auto;padding:8px 0 32px}\r\nbody.gf-derivatives-page .gf-derivatives-intro{padding:28px 32px;border:1px solid var(--gf-border);border-radius:10px;background:linear-gradient(135deg,var(--gf-subtle),var(--gf-canvas));box-shadow:0 12px 28px var(--gf-shadow)}\r\nbody.gf-derivatives-page .gf-derivatives-kicker{display:block;color:var(--gf-accent);font-size:11px;font-weight:700;letter-spacing:.12em}\r\nbody.gf-derivatives-page .gf-derivatives-intro h2{margin:8px 0 10px;color:var(--gf-text);font-size:26px}\r\nbody.gf-derivatives-page .gf-derivatives-intro p{max-width:780px;margin:0;color:var(--gf-secondary);line-height:1.7}\r\nbody.gf-derivatives-page .gf-derivatives-checks{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px}\r\nbody.gf-derivatives-page .gf-derivatives-check{min-height:150px;padding:20px;border:1px solid var(--gf-border);border-radius:9px;background:var(--gf-canvas);box-shadow:0 8px 20px var(--gf-shadow)}\r\nbody.gf-derivatives-page .gf-derivatives-check.is-clear{border-top:3px solid var(--gf-success)}\r\nbody.gf-derivatives-page .gf-derivatives-check.is-warning{border-top:3px solid #d29922}\r\nbody.gf-derivatives-page .gf-derivatives-check-header{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:14px}\r\nbody.gf-derivatives-page .gf-derivatives-check h3{margin:0;color:var(--gf-text);font-size:16px}\r\nbody.gf-derivatives-page .gf-derivatives-badge{padding:3px 8px;border-radius:999px;background:var(--gf-soft);color:var(--gf-accent);font-size:10px;font-weight:700;letter-spacing:.08em}\r\n/* Derivatives / Similarity page */\nbody.gf-derivatives-page .gf-derivatives-dashboard{display:flex;flex-direction:column;gap:18px;width:100%;max-width:1040px;margin:0 auto;padding:8px 0 32px}\nbody.gf-derivatives-page .gf-derivatives-intro{padding:28px 32px;border:1px solid var(--gf-border);border-radius:10px;background:linear-gradient(135deg,var(--gf-subtle),var(--gf-canvas));box-shadow:0 12px 28px var(--gf-shadow)}\nbody.gf-derivatives-page .gf-derivatives-kicker{display:block;color:var(--gf-accent);font-size:11px;font-weight:700;letter-spacing:.12em}\nbody.gf-derivatives-page .gf-derivatives-intro h2{margin:8px 0 10px;color:var(--gf-text);font-size:26px}\nbody.gf-derivatives-page .gf-derivatives-intro p{max-width:780px;margin:0;color:var(--gf-secondary);line-height:1.7}\nbody.gf-derivatives-page .gf-derivatives-checks{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px}\nbody.gf-derivatives-page .gf-derivatives-check{min-height:150px;padding:20px;border:1px solid var(--gf-border);border-radius:9px;background:var(--gf-canvas);box-shadow:0 8px 20px var(--gf-shadow)}\nbody.gf-derivatives-page .gf-derivatives-check.is-clear{border-top:3px solid var(--gf-success)}\nbody.gf-derivatives-page .gf-derivatives-check.is-warning{border-top:3px solid #d29922}\nbody.gf-derivatives-page .gf-derivatives-check-header{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:14px}\nbody.gf-derivatives-page .gf-derivatives-check h3{margin:0;color:var(--gf-text);font-size:16px}\nbody.gf-derivatives-page .gf-derivatives-badge{padding:3px 8px;border-radius:999px;background:var(--gf-soft);color:var(--gf-accent);font-size:10px;font-weight:700;letter-spacing:.08em}\nbody.gf-derivatives-page .gf-derivatives-check.is-warning .gf-derivatives-badge{background:rgba(210,153,34,.14);color:#d29922}\nbody.gf-derivatives-page .gf-derivatives-check p{margin:0 0 14px;color:var(--gf-muted);font-size:13px;line-height:1.6}\nbody.gf-derivatives-page .gf-derivatives-result{margin:0!important;padding:14px;border:1px dashed var(--gf-border);border-radius:7px;background:var(--gf-subtle);color:var(--gf-muted);font-size:13px}\nbody.gf-derivatives-page .gf-derivatives-footer{display:flex;align-items:center;justify-content:space-between;gap:16px;padding:16px 20px;border:1px solid var(--gf-border);border-radius:9px;background:var(--gf-subtle)}\nbody.gf-derivatives-page .gf-derivatives-last-check p{margin:5px 0 0;color:var(--gf-secondary);font-size:13px}\nbody.gf-derivatives-page .gf-derivatives-action{margin:0!important}\nbody.gf-derivatives-page .gf-derivatives-action button{padding:8px 14px;border:1px solid var(--gf-border);border-radius:6px;background:var(--gf-control);color:var(--gf-text);font:inherit;font-weight:600;cursor:pointer}\nbody.gf-derivatives-page .gf-derivatives-action button:hover{border-color:var(--gf-accent);color:var(--gf-accent)}\n@media(max-width:760px){body.gf-derivatives-page .gf-derivatives-checks{grid-template-columns:1fr}body.gf-derivatives-page .gf-derivatives-intro{padding:22px}body.gf-derivatives-page .gf-derivatives-footer{align-items:flex-start;flex-direction:column}}\n\n/* Delete Script Page */\nbody.gf-delete-page #script-content {\n    max-width: none!important;\n    padding: 0!important;\n}\n\nbody.gf-delete-page .gf-delete-dashboard {\n    display: flex!important;\n    flex-direction: column!important;\n    gap: 24px!important;\n    width: min(100%, 820px)!important;\n    margin: 24px auto 40px auto!important;\n    box-sizing: border-box!important;\n    padding: 0 16px!important;\n}\n\nbody.gf-delete-page .gf-delete-header h2 {\n    font-size: 20px!important;\n    font-weight: 600!important;\n    color: var(--gf-text)!important;\n    margin: 12px 0 0 0!important;\n    padding-bottom: 12px!important;\n    border-bottom: 1px solid var(--gf-border-muted)!important;\n}\n\n/* Base card layout */\nbody.gf-delete-page .gf-delete-card {\n    box-sizing: border-box!important;\n    border: 1px solid var(--gf-border)!important;\n    border-radius: 6px!important;\n    background: var(--gf-subtle)!important;\n    box-shadow: 0 4px 12px var(--gf-shadow)!important;\n    overflow: hidden!important;\n}\n\nbody.gf-delete-page .gf-delete-card .gf-card-body {\n    padding: 24px!important;\n}\n\n/* Warnings and Alerts */\nbody.gf-delete-page .gf-alert {\n    display: flex!important;\n    align-items: flex-start!important;\n    gap: 12px!important;\n    padding: 16px!important;\n    border-radius: 6px!important;\n    font-size: 13px!important;\n    line-height: 1.55!important;\n    margin-bottom: 20px!important;\n    box-sizing: border-box!important;\n}\n\nbody.gf-delete-page .gf-alert-icon {\n    flex-shrink: 0!important;\n    margin-top: 2px!important;\n}\n\nbody.gf-delete-page .gf-alert-body {\n    flex: 1!important;\n}\n\nbody.gf-delete-page .gf-alert-body p {\n    margin: 0 0 8px 0!important;\n}\nbody.gf-delete-page .gf-alert-body p:last-child {\n    margin: 0!important;\n}\n\n/* Warning alert (yellow) */\nbody.gf-delete-page .gf-alert-warning {\n    background-color: rgba(210, 153, 34, 0.08)!important;\n    border: 1px solid rgba(210, 153, 34, 0.35)!important;\n    color: var(--gf-text)!important;\n}\nbody.gf-delete-page .gf-alert-warning .gf-alert-icon {\n    color: #d29922!important;\n}\n\n/* Danger alert (red) */\nbody.gf-delete-page .gf-alert-danger {\n    background-color: rgba(248, 81, 73, 0.08)!important;\n    border: 1px solid rgba(248, 81, 73, 0.35)!important;\n    color: var(--gf-text)!important;\n}\nbody.gf-delete-page .gf-alert-danger .gf-alert-icon {\n    color: #f85149!important;\n}\n\n/* Option Groups & Lists inside delete card */\nbody.gf-delete-page .gf-options-group,\nbody.gf-admin-page .gf-options-group {\n    padding: 0!important;\n    margin-top: 12px!important;\n}\n\nbody.gf-delete-page .gf-options-group-title,\nbody.gf-admin-page .gf-options-group-title {\n    font-size: 14px!important;\n    font-weight: 600!important;\n    color: var(--gf-text)!important;\n    margin: 0 0 12px 0!important;\n}\n\nbody.gf-delete-page .gf-options-list,\nbody.gf-admin-page .gf-options-list {\n    display: flex;\n    flex-direction: column;\n    gap: 8px;\n}\n\n/* Option item styling */\nbody.gf-delete-page .gf-option-item,\nbody.gf-admin-page .gf-option-item {\n    position: relative!important;\n    display: flex!important;\n    align-items: flex-start!important;\n    gap: 12px!important;\n    padding: 14px 16px!important;\n    border: 1px solid var(--gf-border)!important;\n    border-radius: 6px!important;\n    cursor: pointer!important;\n    transition: all 0.15s ease!important;\n    background: var(--gf-canvas)!important;\n}\nbody.gf-delete-page .gf-option-item:hover,\nbody.gf-admin-page .gf-option-item:hover {\n    background-color: var(--gf-subtle)!important;\n}\nbody.gf-delete-page .gf-option-item.is-selected,\nbody.gf-admin-page .gf-option-item.is-selected {\n    border-color: var(--gf-accent)!important;\n    background-color: var(--gf-inset)!important;\n    box-shadow: 0 0 0 1px var(--gf-accent)!important;\n}\n\nbody.gf-delete-page .gf-option-item input[type=\"radio\"],\nbody.gf-admin-page .gf-option-item input[type=\"radio\"] {\n    margin: 0!important;\n    margin-top: 2px!important;\n    width: 16px!important;\n    height: 16px!important;\n    accent-color: var(--gf-accent)!important;\n    cursor: pointer!important;\n}\n\nbody.gf-delete-page .gf-option-content,\nbody.gf-admin-page .gf-option-content {\n    flex: 1!important;\n}\nbody.gf-delete-page .gf-option-title,\nbody.gf-admin-page .gf-option-title {\n    font-size: 14px!important;\n    font-weight: 500!important;\n    color: var(--gf-text)!important;\n    line-height: 1.4!important;\n}\nbody.gf-delete-page .gf-option-item.is-selected .gf-option-title,\nbody.gf-admin-page .gf-option-item.is-selected .gf-option-title {\n    color: var(--gf-accent)!important;\n}\n\n/* Redirect Input */\nbody.gf-delete-page .gf-redirect-input-row {\n    margin-top: 16px!important;\n    padding: 16px!important;\n    background-color: var(--gf-inset)!important;\n    border: 1px solid var(--gf-border)!important;\n    border-radius: 6px!important;\n    box-sizing: border-box!important;\n}\n\nbody.gf-delete-page .gf-redirect-label {\n    display: block!important;\n    font-size: 13px!important;\n    font-weight: 500!important;\n    color: var(--gf-secondary)!important;\n    margin-bottom: 8px!important;\n}\n\nbody.gf-delete-page .gf-redirect-text-input {\n    box-sizing: border-box!important;\n    width: 100%!important;\n    max-width: 100%!important;\n    padding: 6px 12px!important;\n    border: 1px solid var(--gf-border)!important;\n    border-radius: 6px!important;\n    background: var(--gf-canvas)!important;\n    color: var(--gf-text)!important;\n    font: inherit!important;\n    font-size: 13px!important;\n    outline: none!important;\n    transition: border-color 0.15s, box-shadow 0.15s!important;\n}\nbody.gf-delete-page .gf-redirect-text-input:focus {\n    border-color: var(--gf-accent)!important;\n    box-shadow: 0 0 0 3px var(--gf-ring)!important;\n}\n\n/* GitHub Danger Zone UI */\nbody.gf-delete-page .gf-danger-zone-container {\n    margin-top: 32px!important;\n}\n\nbody.gf-delete-page .gf-danger-zone-title {\n    font-size: 20px!important;\n    font-weight: 500!important;\n    color: #f85149!important;\n    margin: 0 0 8px 0!important;\n    padding-bottom: 8px!important;\n    border-bottom: 1px solid rgba(248, 81, 73, 0.4)!important;\n}\n\nbody.gf-delete-page .gf-danger-zone-box {\n    border: 1px solid rgba(248, 81, 73, 0.4)!important;\n    border-radius: 6px!important;\n    background: var(--gf-canvas)!important;\n    overflow: hidden!important;\n}\n\nbody.gf-delete-page .gf-danger-zone-row {\n    display: flex!important;\n    justify-content: space-between!important;\n    align-items: center!important;\n    padding: 16px!important;\n    gap: 16px!important;\n}\n\nbody.gf-delete-page .gf-danger-zone-info {\n    flex: 1!important;\n}\n\nbody.gf-delete-page .gf-danger-zone-info strong {\n    display: block!important;\n    font-size: 14px!important;\n    font-weight: 600!important;\n    color: var(--gf-text)!important;\n    margin-bottom: 4px!important;\n}\n\nbody.gf-delete-page .gf-danger-text {\n    font-size: 13px!important;\n    color: var(--gf-muted)!important;\n    margin: 0!important;\n    line-height: 1.5!important;\n}\n\n/* Form buttons in actions row */\nbody.gf-delete-page .gf-form-actions {\n    display: flex!important;\n    align-items: center!important;\n    justify-content: flex-start!important;\n    gap: 16px!important;\n    margin: 20px 0 0 0!important;\n    padding-top: 16px!important;\n    border-top: 1px solid var(--gf-border-muted)!important;\n    box-sizing: border-box!important;\n}\n\nbody.gf-delete-page .gf-btn {\n    display: inline-flex!important;\n    align-items: center!important;\n    justify-content: center!important;\n    padding: 7px 16px!important;\n    font-size: 13px!important;\n    font-weight: 600!important;\n    border-radius: 6px!important;\n    cursor: pointer!important;\n    transition: background-color 0.12s, border-color 0.12s!important;\n    box-shadow: 0 1px 0 rgba(0,0,0,0.1)!important;\n}\n\n/* Warning button (Soft delete) */\nbody.gf-delete-page .gf-btn-warning {\n    background-color: var(--gf-control)!important;\n    border: 1px solid var(--gf-border)!important;\n    color: #d29922!important;\n}\nbody.gf-delete-page .gf-btn-warning:hover {\n    background-color: var(--gf-border)!important;\n    border-color: var(--gf-strong)!important;\n}\n\n/* Danger button (Hard delete) */\nbody.gf-delete-page .gf-btn-danger {\n    background-color: #da3637!important;\n    border: 1px solid rgba(27, 31, 36, 0.15)!important;\n    color: #ffffff!important;\n}\nbody.gf-delete-page .gf-btn-danger:hover {\n    background-color: #b82526!important;\n}\n\nbody.gf-delete-page .gf-form-cancel {\n    font-size: 13px!important;\n    color: var(--gf-muted)!important;\n    font-weight: 500!important;\n    text-decoration: none!important;\n}\nbody.gf-delete-page .gf-form-cancel:hover {\n    color: var(--gf-text)!important;\n    text-decoration: underline!important;\n}\n\n/* Admin Page */\nbody.gf-admin-page #script-content {\n    max-width: none!important;\n    padding: 0!important;\n}\n\nbody.gf-admin-page .gf-admin-dashboard {\n    display: flex!important;\n    flex-direction: column!important;\n    gap: 32px!important;\n    width: min(100%, 820px)!important;\n    margin: 24px auto 40px auto!important;\n    box-sizing: border-box!important;\n    padding: 0 16px!important;\n}\n\nbody.gf-admin-page .gf-admin-section-title {\n    font-size: 20px!important;\n    font-weight: 500!important;\n    color: var(--gf-text)!important;\n    margin: 0 0 12px 0!important;\n    padding-bottom: 8px!important;\n    border-bottom: 1px solid var(--gf-border-muted)!important;\n}\n\nbody.gf-admin-page .gf-admin-card {\n    box-sizing: border-box!important;\n    border: 1px solid var(--gf-border)!important;\n    border-radius: 6px!important;\n    background: var(--gf-canvas)!important;\n    box-shadow: 0 4px 12px var(--gf-shadow)!important;\n    padding: 24px!important;\n}\n\nbody.gf-admin-page .gf-admin-card p {\n    margin: 0 0 12px 0!important;\n    color: var(--gf-secondary)!important;\n    font-size: 14px!important;\n    line-height: 1.5!important;\n}\nbody.gf-admin-page .gf-admin-card p:last-child {\n    margin-bottom: 0!important;\n}\n\nbody.gf-admin-page .gf-admin-text-input {\n    box-sizing: border-box!important;\n    width: 100%!important;\n    max-width: 100%!important;\n    padding: 8px 12px!important;\n    border: 1px solid var(--gf-border)!important;\n    border-radius: 6px!important;\n    background: var(--gf-inset)!important;\n    color: var(--gf-text)!important;\n    font: inherit!important;\n    font-size: 14px!important;\n    outline: none!important;\n    transition: border-color 0.15s, box-shadow 0.15s!important;\n    margin-bottom: 16px!important;\n}\nbody.gf-admin-page .gf-admin-text-input:focus {\n    border-color: var(--gf-accent)!important;\n    box-shadow: 0 0 0 3px var(--gf-ring)!important;\n}\n\nbody.gf-admin-page select.gf-admin-text-input {\n    appearance: none!important;\n    background-image: url('data:image/svg+xml;utf8,<svg viewBox=\"0 0 16 16\" width=\"16\" height=\"16\" fill=\"gray\"><path d=\"M4.22 6.22a.75.75 0 011.06 0L8 8.94l2.72-2.72a.75.75 0 111.06 1.06l-3.25 3.25a.75.75 0 01-1.06 0L4.22 7.28a.75.75 0 010-1.06z\"></path></svg>')!important;\n    background-repeat: no-repeat!important;\n    background-position: right 8px center!important;\n    padding-right: 32px!important;\n}\n\nbody.gf-admin-page label {\n    display: block!important;\n    font-size: 14px!important;\n    font-weight: 600!important;\n    color: var(--gf-text)!important;\n    margin-bottom: 8px!important;\n}\nbody.gf-admin-page label.radio-label {\n    display: inline-block!important;\n    font-weight: normal!important;\n    margin-bottom: 0!important;\n    margin-left: 6px!important;\n}\n\nbody.gf-admin-page .form-control {\n    margin-bottom: 20px!important;\n}\n\nbody.gf-admin-page .gf-admin-submit {\n    display: inline-flex!important;\n    align-items: center!important;\n    justify-content: center!important;\n    padding: 7px 16px!important;\n    font-size: 14px!important;\n    font-weight: 600!important;\n    border-radius: 6px!important;\n    cursor: pointer!important;\n    border: 1px solid var(--gf-border)!important;\n    background: var(--gf-control)!important;\n    color: var(--gf-text)!important;\n    transition: background-color 0.12s, border-color 0.12s!important;\n    box-shadow: 0 1px 0 rgba(0,0,0,0.1)!important;\n}\nbody.gf-admin-page .gf-admin-submit:hover {\n    background-color: var(--gf-border)!important;\n}\n\n/* Primary buttons in Admin */\nbody.gf-admin-page .gf-admin-submit.gf-btn-primary {\n    background-color: var(--gf-success)!important;\n    border-color: var(--gf-success)!important;\n    color: #ffffff!important;\n}\nbody.gf-admin-page .gf-admin-submit.gf-btn-primary:hover {\n    background-color: var(--gf-accent)!important;\n    border-color: var(--gf-accent)!important;\n}\n\n/* Checkup list */\nbody.gf-admin-page .checkup-list {\n    list-style: none!important;\n    padding: 0!important;\n    margin: 16px 0 0 0!important;\n    display: flex!important;\n    flex-direction: column!important;\n    gap: 12px!important;\n}\nbody.gf-admin-page .checkup-list li {\n    display: flex!important;\n    align-items: flex-start!important;\n    gap: 12px!important;\n    padding: 16px!important;\n    border: 1px solid var(--gf-border)!important;\n    border-radius: 6px!important;\n    background: var(--gf-inset)!important;\n    color: var(--gf-text)!important;\n    font-size: 14px!important;\n    line-height: 1.5!important;\n}\nbody.gf-admin-page .gf-check-icon {\n    color: var(--gf-success)!important;\n    flex-shrink: 0!important;\n    margin-top: 2px!important;\n}\nbody.gf-admin-page .gf-cross-icon {\n    color: #f85149!important;\n    flex-shrink: 0!important;\n    margin-top: 2px!important;\n}\n\n/* Actions footer bar inside settings cards */\nbody.gf-admin-page .gf-admin-actions-bar {\n    margin: 24px -24px -24px -24px!important;\n    padding: 16px 24px!important;\n    background-color: var(--gf-inset)!important;\n    border-top: 1px solid var(--gf-border)!important;\n    border-bottom-left-radius: 6px!important;\n    border-bottom-right-radius: 6px!important;\n    display: flex!important;\n    justify-content: flex-start!important;\n    gap: 12px!important;\n    box-sizing: border-box!important;\n}\n\nbody.gf-admin-page .gf-admin-actions-bar .gf-admin-submit {\n    margin: 0!important;\n}\n\n/* Sync additional info buttons */\nbody.gf-admin-page #add-synced-additional-info {\n    display: inline-flex!important;\n    align-items: center!important;\n    justify-content: center!important;\n    padding: 6px 12px!important;\n    font-size: 13px!important;\n    font-weight: 500!important;\n    border-radius: 6px!important;\n    cursor: pointer!important;\n    border: 1px solid var(--gf-border)!important;\n    background: var(--gf-control)!important;\n    color: var(--gf-text)!important;\n    box-shadow: 0 1px 0 rgba(0,0,0,0.05)!important;\n    margin-top: 8px!important;\n    transition: all 0.12s!important;\n}\nbody.gf-admin-page #add-synced-additional-info:hover {\n    background: var(--gf-border)!important;\n    border-color: var(--gf-strong)!important;\n}\n\n/* Synced additional info markup selection row */\nbody.gf-admin-page .gf-editor-format-row {\n    display: flex!important;\n    align-items: center!important;\n    gap: 12px!important;\n    margin-top: 12px!important;\n}\n\nbody.gf-admin-page .gf-preview-btn {\n    padding: 4px 12px!important;\n    font-size: 12px!important;\n    background: var(--gf-control)!important;\n    border: 1px solid var(--gf-border)!important;\n    color: var(--gf-text)!important;\n    border-radius: 6px!important;\n    font-weight: 500!important;\n    cursor: pointer!important;\n    transition: all 0.12s!important;\n    margin: 0!important;\n}\nbody.gf-admin-page .gf-preview-btn:hover {\n    background: var(--gf-border)!important;\n    border-color: var(--gf-strong)!important;\n}\n\n/* Segmented Pill Selector for Admin page */\nbody.gf-admin-page .gf-markup-pills {\n    display: inline-flex!important;\n    background-color: var(--gf-inset)!important;\n    border: 1px solid var(--gf-border)!important;\n    border-radius: 6px!important;\n    padding: 2px!important;\n    gap: 2px!important;\n}\n\nbody.gf-admin-page .gf-markup-pill {\n    display: inline-flex!important;\n    align-items: center!important;\n    padding: 4px 10px!important;\n    font-size: 12px!important;\n    font-weight: 500!important;\n    color: var(--gf-muted)!important;\n    border-radius: 4px!important;\n    cursor: pointer!important;\n    user-select: none!important;\n    transition: all 0.12s ease!important;\n    margin: 0!important;\n}\n\nbody.gf-admin-page .gf-markup-pill:hover {\n    color: var(--gf-text)!important;\n    background-color: rgba(255, 255, 255, 0.05)!important;\n}\n\nbody.gf-admin-page .gf-markup-pill.is-active {\n    color: var(--gf-text)!important;\n    background-color: var(--gf-canvas)!important;\n    box-shadow: 0 1px 3px rgba(0,0,0,0.08)!important;\n}\n\nbody.gf-admin-page .gf-markup-pill input[type=\"radio\"] {\n    position: absolute!important;\n    opacity: 0!important;\n    width: 0!important;\n    height: 0!important;\n    margin: 0!important;\n}\n\r\n\n\n/* ============================================================\n   Feedback Page\n   ============================================================ */\n\n/* Notice banner */\nbody.gf-feedback-page .gf-feedback-notice {\n    margin: 0 0 24px;\n    border: 1px solid var(--gf-border);\n    border-left: 4px solid #388bfd;\n    border-radius: 6px;\n    background: var(--gf-subtle);\n    overflow: hidden;\n}\nhtml[data-gf-theme=\"light\"] body.gf-feedback-page .gf-feedback-notice {\n    border-left-color: #0969da;\n}\n\nbody.gf-feedback-page .gf-feedback-notice-header {\n    display: flex;\n    align-items: center;\n    gap: 8px;\n    padding: 10px 14px;\n    cursor: default;\n    user-select: none;\n}\n\nbody.gf-feedback-page .gf-feedback-notice-icon {\n    display: flex;\n    align-items: center;\n    flex-shrink: 0;\n    color: #388bfd;\n}\nhtml[data-gf-theme=\"light\"] body.gf-feedback-page .gf-feedback-notice-icon {\n    color: #0969da;\n}\n\nbody.gf-feedback-page .gf-feedback-notice-title {\n    flex: 1;\n    font-size: 13px;\n    font-weight: 600;\n    color: var(--gf-text);\n    line-height: 1.3;\n}\n\nbody.gf-feedback-page .gf-feedback-notice-toggle {\n    flex-shrink: 0;\n    display: flex;\n    align-items: center;\n    justify-content: center;\n    width: 24px;\n    height: 24px;\n    padding: 0;\n    border: 1px solid var(--gf-border);\n    border-radius: 4px;\n    background: transparent;\n    color: var(--gf-muted);\n    cursor: pointer;\n    transition: background 120ms, color 120ms, transform 160ms ease;\n}\nbody.gf-feedback-page .gf-feedback-notice-toggle:hover {\n    background: var(--gf-control);\n    color: var(--gf-text);\n}\nbody.gf-feedback-page .gf-feedback-notice-toggle.is-collapsed svg {\n    transform: rotate(180deg);\n}\n\nbody.gf-feedback-page .gf-feedback-notice-body {\n    padding: 0 14px 12px;\n    border-top: 1px solid var(--gf-border-muted);\n}\n\nbody.gf-feedback-page .gf-feedback-tips-list {\n    margin: 10px 0 0;\n    padding: 0;\n    list-style: none;\n    display: flex;\n    flex-direction: column;\n    gap: 8px;\n}\n\nbody.gf-feedback-page .gf-feedback-tips-list li {\n    display: flex;\n    align-items: baseline;\n    gap: 8px;\n    font-size: 12px;\n    line-height: 1.6;\n    color: var(--gf-muted);\n}\nbody.gf-feedback-page .gf-feedback-tips-list li strong {\n    color: var(--gf-secondary);\n    font-weight: 600;\n}\n\nbody.gf-feedback-page .gf-feedback-notice-footer {\r\n    margin-top: 10px;\r\n    padding-top: 8px;\r\n    border-top: 1px solid var(--gf-border);\r\n    font-size: 12px;\r\n    color: var(--gf-muted);\r\n    opacity: 0.65;\r\n    line-height: 1.5;\r\n}\r\n\r\nbody.gf-feedback-page .gf-tip-emoji {\n    flex-shrink: 0;\n    font-size: 14px;\n    line-height: 1;\n    margin-top: 2px;\n}\n\n/* Feedback Page Tabs */\nbody.gf-feedback-page .gf-feedback-tabs {\n    display: flex;\n    gap: 8px;\n    border-bottom: 1px solid var(--gf-border);\n    margin: -24px -24px 20px -24px;\n    padding: 12px 24px;\n    background: var(--gf-inset);\n    border-top-left-radius: 6px;\n    border-top-right-radius: 6px;\n}\n\nbody.gf-feedback-page .gf-feedback-tab-btn {\n    display: inline-flex;\n    align-items: center;\n    gap: 6px;\n    padding: 6px 12px;\n    border: 0;\n    border-radius: 6px;\n    background: transparent;\n    color: var(--gf-muted);\n    font-family: inherit;\n    font-size: 13px;\n    font-weight: 500;\n    cursor: pointer;\n    transition: all 0.12s ease;\n}\n\nbody.gf-feedback-page .gf-feedback-tab-btn:hover {\n    background: var(--gf-control);\n    color: var(--gf-text);\n}\n\nbody.gf-feedback-page .gf-feedback-tab-btn.is-active {\n    background: var(--gf-soft);\n    color: var(--gf-accent);\n    font-weight: 600;\n}\n\nbody.gf-feedback-page .gf-feedback-tab-btn svg {\n    width: 16px;\n    height: 16px;\n    fill: none;\n    stroke: currentColor;\n    stroke-width: 2;\n}\n\n/* Discussion form card */\nbody.gf-feedback-page .gf-discussion-form-card {\n    box-sizing: border-box;\n    padding: 24px!important;\n    border: 1px solid var(--gf-border)!important;\n    border-radius: 6px!important;\n    background: var(--gf-subtle)!important;\n    box-shadow: 0 4px 12px var(--gf-shadow)!important;\n    margin: 0!important;\n}\n\nbody.gf-feedback-page .gf-discussion-form-heading {\n    margin: 0 0 18px!important;\n    padding-bottom: 14px!important;\n    border-bottom: 1px solid var(--gf-border-muted)!important;\n    color: var(--gf-text)!important;\n    font-size: 16px!important;\n    font-weight: 600!important;\n}\n\n/* Attachment dropzone */\nbody.gf-feedback-page .gf-attach-area {\n    position: relative;\n    margin: 12px 0;\n}\n\nbody.gf-feedback-page .gf-feedback-dropzone {\n    display: flex;\n    flex-direction: column;\n    align-items: center;\n    gap: 4px;\n    padding: 20px 16px;\n    border: 2px dashed var(--gf-border);\n    border-radius: 6px;\n    background: var(--gf-inset);\n    color: var(--gf-muted);\n    text-align: center;\n    cursor: pointer;\n    transition: border-color 160ms, background 160ms;\n}\nbody.gf-feedback-page .gf-feedback-dropzone:hover {\n    border-color: var(--gf-accent);\n    background: var(--gf-soft);\n}\n\nbody.gf-feedback-page .gf-upload-icon {\n    margin-bottom: 4px;\n    opacity: .65;\n}\n\nbody.gf-feedback-page .gf-dropzone-cta {\n    font-size: 13px;\n    font-weight: 600;\n    color: var(--gf-accent);\n}\n\nbody.gf-feedback-page .gf-dropzone-hint {\n    font-size: 11px;\n    color: var(--gf-muted);\n}\n\nbody.gf-feedback-page .gf-dropzone-filelist {\n    display: none;\n    flex-wrap: wrap;\n    gap: 6px;\n    margin-top: 6px;\n    justify-content: center;\n}\n\nbody.gf-feedback-page .gf-dropzone-input {\n    position: absolute!important;\n    inset: 0!important;\n    width: 100%!important;\n    height: 100%!important;\n    opacity: 0!important;\n    cursor: pointer!important;\n    z-index: 2!important;\n}\n\nbody.gf-feedback-page .gf-file-badge {\n    display: inline-flex;\n    align-items: center;\n    padding: 2px 8px;\n    border: 1px solid var(--gf-border);\n    border-radius: 11px;\n    background: var(--gf-canvas);\n    color: var(--gf-secondary);\n    font-size: 11px;\n}\n\n/* Environment tips banner */\nbody.gf-feedback-page .gf-env-tips {\n    display: flex;\n    align-items: flex-start;\n    gap: 10px;\n    padding: 12px 16px;\n    border: 1px solid rgba(56, 139, 253, 0.4);\n    border-radius: 6px;\n    background: rgba(56, 139, 253, 0.08);\n    color: var(--gf-text);\n    font-size: 13px;\n    line-height: 1.5;\n    margin: 12px 0 16px;\n}\n\nbody.gf-feedback-page .gf-env-tips svg {\n    flex: 0 0 16px;\n    width: 16px;\n    height: 16px;\n    fill: currentColor;\n    color: #58a6ff;\n    margin-top: 2px;\n}\n\nbody.gf-feedback-page .gf-env-tips strong {\n    font-weight: 600;\n    color: var(--gf-accent);\n}\n\n/* Markdown Editor */\nbody.gf-feedback-page .gf-markdown-editor {\n    display: flex;\n    flex-direction: column;\n    margin: 12px 0;\n}\n\nbody.gf-feedback-page .gf-editor-tabs {\n    display: flex;\n    gap: 4px;\n    border-bottom: 1px solid var(--gf-border);\n    margin-bottom: -1px;\n    position: relative;\n    z-index: 2;\n}\n\nbody.gf-feedback-page .gf-editor-tabs a {\n    display: inline-flex;\n    align-items: center;\n    padding: 8px 16px;\n    font-size: 13px;\n    color: var(--gf-muted);\n    text-decoration: none!important;\n    border: 1px solid transparent;\n    border-bottom: 0;\n    border-top-left-radius: 6px;\n    border-top-right-radius: 6px;\n    cursor: pointer;\n    background: transparent;\n    transition: color 0.12s ease;\n}\n\nbody.gf-feedback-page .gf-editor-tabs a:hover {\n    color: var(--gf-text);\n}\n\nbody.gf-feedback-page .gf-editor-tabs a.active {\n    color: var(--gf-text);\n    background: var(--gf-subtle);\n    border-color: var(--gf-border);\n    border-bottom: 1px solid var(--gf-subtle);\n    font-weight: 600;\n}\n\nbody.gf-feedback-page textarea.comment-entry {\n    box-sizing: border-box;\n    width: 100%!important;\n    min-height: 140px;\n    padding: 12px 16px!important;\n    border: 1px solid var(--gf-border)!important;\n    border-radius: 6px!important;\n    background: var(--gf-inset)!important;\n    color: var(--gf-text)!important;\n    font-family: inherit!important;\n    font-size: 14px!important;\n    line-height: 1.6!important;\n    resize: vertical;\n    transition: border-color 0.2s, box-shadow 0.2s;\n}\n\nbody.gf-feedback-page textarea.comment-entry:focus {\n    outline: 0!important;\n    border-color: var(--gf-accent)!important;\n    box-shadow: 0 0 0 3px var(--gf-ring)!important;\n}\n\nbody.gf-feedback-page .preview-results {\n    box-sizing: border-box;\n    min-height: 140px;\n    padding: 16px 20px!important;\n    border: 1px solid var(--gf-border)!important;\n    border-radius: 6px!important;\n    background: var(--gf-inset)!important;\n    color: var(--gf-text)!important;\n    font-size: 14px!important;\n    line-height: 1.6!important;\n}\n\n/* Discussion ratings */\nbody.gf-feedback-page .discussion-rating {\n    margin: 16px 0 12px;\n}\n\nbody.gf-feedback-page .discussion-rating > label:first-child {\n    display: block;\n    font-size: 14px;\n    font-weight: 600;\n    color: var(--gf-text);\n    margin-bottom: 8px;\n}\n\nbody.gf-feedback-page .gf-rating-options {\n    display: flex;\n    flex-direction: column;\n    gap: 8px;\n    margin-bottom: 12px;\n}\n\nbody.gf-feedback-page .gf-rating-option-wrapper {\n    display: flex;\n    align-items: center;\n    gap: 10px;\n    padding: 10px 14px;\n    border: 1px solid var(--gf-border);\n    border-radius: 6px;\n    background: var(--gf-inset);\n    cursor: pointer;\n    transition: all 0.15s ease;\n}\n\nbody.gf-feedback-page .gf-rating-option-wrapper:hover {\n    background: var(--gf-control);\n    border-color: var(--gf-strong);\n}\n\nbody.gf-feedback-page .gf-rating-option-wrapper:has(input:checked) {\n    border-color: var(--gf-accent);\n    background: var(--gf-soft);\n}\n\nbody.gf-feedback-page .gf-rating-option-wrapper input[type=\"radio\"] {\n    margin: 0;\n    accent-color: var(--gf-accent);\n}\n\nbody.gf-feedback-page .gf-rating-option-wrapper label.radio-label {\n    margin: 0;\n    font-size: 13px;\n    color: var(--gf-text);\n    cursor: pointer;\n}\n\nbody.gf-feedback-page .radio-note {\n    display: block;\n    margin-top: 6px;\n    font-size: 12px;\n    color: var(--gf-muted);\n}\n\n/* Subscribe checkbox */\nbody.gf-feedback-page .gf-subscribe-option-wrapper {\n    display: inline-flex;\n    align-items: center;\n    gap: 10px;\n    padding: 10px 14px;\n    border: 1px solid var(--gf-border);\n    border-radius: 6px;\n    background: var(--gf-inset);\n    cursor: pointer;\n    margin: 12px 0 20px;\n    transition: all 0.15s ease;\n}\n\nbody.gf-feedback-page .gf-subscribe-option-wrapper:hover {\n    background: var(--gf-control);\n    border-color: var(--gf-strong);\n}\n\nbody.gf-feedback-page .gf-subscribe-option-wrapper:has(input:checked) {\n    border-color: var(--gf-accent);\n    background: var(--gf-soft);\n}\n\nbody.gf-feedback-page .gf-subscribe-option-wrapper input[type=\"checkbox\"] {\n    margin: 0;\n    accent-color: var(--gf-accent);\n}\n\nbody.gf-feedback-page .gf-subscribe-option-wrapper label.radio-label {\n    margin: 0;\n    font-size: 13px;\n    color: var(--gf-text);\n    cursor: pointer;\n}\n\n/* Hide duplicate files instructions */\nbody.gf-feedback-page .gf-attach-area > p {\n    display: none!important;\n}\n\n/* Markup option spacing */\nbody.gf-feedback-page .gf-editor-markup-options {\n    display: flex;\n    justify-content: space-between;\n    align-items: center;\n    margin-bottom: 8px;\n}\n\nbody.gf-feedback-page .gf-discussion-form-card p,\nbody.gf-feedback-page .gf-discussion-form-card li {\n    font-size: 13px;\n    color: var(--gf-muted)!important;\n    line-height: 1.5;\n}\n\n\n/* Submit button */\nbody.gf-feedback-page input.gf-btn-primary,\nbody.gf-feedback-page button.gf-btn-primary {\n    display: inline-flex!important;\n    align-items: center!important;\n    gap: 6px!important;\n    padding: 7px 18px!important;\n    border: 1px solid rgba(63,185,80,.3)!important;\n    border-radius: 6px!important;\n    background: var(--gf-success)!important;\n    color: #fff!important;\n    font: inherit!important;\n    font-size: 13px!important;\n    font-weight: 600!important;\n    cursor: pointer!important;\n    transition: filter 120ms!important;\n}\nbody.gf-feedback-page input.gf-btn-primary:hover,\nbody.gf-feedback-page button.gf-btn-primary:hover {\n    filter: brightness(1.12)!important;\n}\n\n@media (max-width: 640px) {\n    body.gf-feedback-page .gf-discussion-form-card {\n        padding: 16px!important;\n    }\n}\n";
    if (typeof GM_addStyle !== 'undefined') {
        GM_addStyle(cssContent);
    } else {
        const style = document.createElement('style');
        style.id = 'gf-beautifier-injected-style';
        style.textContent = cssContent;
        if (document.head || document.documentElement) {
            (document.head || document.documentElement).appendChild(style);
        } else {
            const observer = new MutationObserver(() => {
                if (document.head || document.documentElement) {
                    (document.head || document.documentElement).appendChild(style);
                    observer.disconnect();
                }
            });
            observer.observe(document, { childList: true, subtree: true });
        }
    }
})();

// --- Bound Dependency: prism/prism-core.js ---
/// <reference lib="WebWorker"/>

var _self = (typeof window !== 'undefined')
	? window   // if in browser
	: (
		(typeof WorkerGlobalScope !== 'undefined' && self instanceof WorkerGlobalScope)
			? self // if in worker
			: {}   // if in node js
	);

/**
 * Prism: Lightweight, robust, elegant syntax highlighting
 *
 * @license MIT <https://opensource.org/licenses/MIT>
 * @author Lea Verou <https://lea.verou.me>
 * @namespace
 * @public
 */
var Prism = (function (_self) {

	// Private helper vars
	var lang = /(?:^|\s)lang(?:uage)?-([\w-]+)(?=\s|$)/i;
	var uniqueId = 0;

	// The grammar object for plaintext
	var plainTextGrammar = {};


	var _ = {
		/**
		 * By default, Prism will attempt to highlight all code elements (by calling {@link Prism.highlightAll}) on the
		 * current page after the page finished loading. This might be a problem if e.g. you wanted to asynchronously load
		 * additional languages or plugins yourself.
		 *
		 * By setting this value to `true`, Prism will not automatically highlight all code elements on the page.
		 *
		 * You obviously have to change this value before the automatic highlighting started. To do this, you can add an
		 * empty Prism object into the global scope before loading the Prism script like this:
		 *
		 * ```js
		 * window.Prism = window.Prism || {};
		 * Prism.manual = true;
		 * // add a new <script> to load Prism's script
		 * ```
		 *
		 * @default false
		 * @type {boolean}
		 * @memberof Prism
		 * @public
		 */
		manual: _self.Prism && _self.Prism.manual,
		/**
		 * By default, if Prism is in a web worker, it assumes that it is in a worker it created itself, so it uses
		 * `addEventListener` to communicate with its parent instance. However, if you're using Prism manually in your
		 * own worker, you don't want it to do this.
		 *
		 * By setting this value to `true`, Prism will not add its own listeners to the worker.
		 *
		 * You obviously have to change this value before Prism executes. To do this, you can add an
		 * empty Prism object into the global scope before loading the Prism script like this:
		 *
		 * ```js
		 * window.Prism = window.Prism || {};
		 * Prism.disableWorkerMessageHandler = true;
		 * // Load Prism's script
		 * ```
		 *
		 * @default false
		 * @type {boolean}
		 * @memberof Prism
		 * @public
		 */
		disableWorkerMessageHandler: _self.Prism && _self.Prism.disableWorkerMessageHandler,

		/**
		 * A namespace for utility methods.
		 *
		 * All function in this namespace that are not explicitly marked as _public_ are for __internal use only__ and may
		 * change or disappear at any time.
		 *
		 * @namespace
		 * @memberof Prism
		 */
		util: {
			encode: function encode(tokens) {
				if (tokens instanceof Token) {
					return new Token(tokens.type, encode(tokens.content), tokens.alias);
				} else if (Array.isArray(tokens)) {
					return tokens.map(encode);
				} else {
					return tokens.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/\u00a0/g, ' ');
				}
			},

			/**
			 * Returns the name of the type of the given value.
			 *
			 * @param {any} o
			 * @returns {string}
			 * @example
			 * type(null)      === 'Null'
			 * type(undefined) === 'Undefined'
			 * type(123)       === 'Number'
			 * type('foo')     === 'String'
			 * type(true)      === 'Boolean'
			 * type([1, 2])    === 'Array'
			 * type({})        === 'Object'
			 * type(String)    === 'Function'
			 * type(/abc+/)    === 'RegExp'
			 */
			type: function (o) {
				return Object.prototype.toString.call(o).slice(8, -1);
			},

			/**
			 * Returns a unique number for the given object. Later calls will still return the same number.
			 *
			 * @param {Object} obj
			 * @returns {number}
			 */
			objId: function (obj) {
				if (!obj['__id']) {
					Object.defineProperty(obj, '__id', { value: ++uniqueId });
				}
				return obj['__id'];
			},

			/**
			 * Creates a deep clone of the given object.
			 *
			 * The main intended use of this function is to clone language definitions.
			 *
			 * @param {T} o
			 * @param {Record<number, any>} [visited]
			 * @returns {T}
			 * @template T
			 */
			clone: function deepClone(o, visited) {
				visited = visited || {};

				var clone; var id;
				switch (_.util.type(o)) {
					case 'Object':
						id = _.util.objId(o);
						if (visited[id]) {
							return visited[id];
						}
						clone = /** @type {Record<string, any>} */ ({});
						visited[id] = clone;

						for (var key in o) {
							if (o.hasOwnProperty(key)) {
								clone[key] = deepClone(o[key], visited);
							}
						}

						return /** @type {any} */ (clone);

					case 'Array':
						id = _.util.objId(o);
						if (visited[id]) {
							return visited[id];
						}
						clone = [];
						visited[id] = clone;

						(/** @type {Array} */(/** @type {any} */(o))).forEach(function (v, i) {
							clone[i] = deepClone(v, visited);
						});

						return /** @type {any} */ (clone);

					default:
						return o;
				}
			},

			/**
			 * Returns the Prism language of the given element set by a `language-xxxx` or `lang-xxxx` class.
			 *
			 * If no language is set for the element or the element is `null` or `undefined`, `none` will be returned.
			 *
			 * @param {Element} element
			 * @returns {string}
			 */
			getLanguage: function (element) {
				while (element) {
					var m = lang.exec(element.className);
					if (m) {
						return m[1].toLowerCase();
					}
					element = element.parentElement;
				}
				return 'none';
			},

			/**
			 * Sets the Prism `language-xxxx` class of the given element.
			 *
			 * @param {Element} element
			 * @param {string} language
			 * @returns {void}
			 */
			setLanguage: function (element, language) {
				// remove all `language-xxxx` classes
				// (this might leave behind a leading space)
				element.className = element.className.replace(RegExp(lang, 'gi'), '');

				// add the new `language-xxxx` class
				// (using `classList` will automatically clean up spaces for us)
				element.classList.add('language-' + language);
			},

			/**
			 * Returns the script element that is currently executing.
			 *
			 * This does __not__ work for line script element.
			 *
			 * @returns {HTMLScriptElement | null}
			 */
			currentScript: function () {
				if (typeof document === 'undefined') {
					return null;
				}
				if ('currentScript' in document && 1 < 2 /* hack to trip TS' flow analysis */) {
					return /** @type {any} */ (document.currentScript);
				}

				// IE11 workaround
				// we'll get the src of the current script by parsing IE11's error stack trace
				// this will not work for inline scripts

				try {
					throw new Error();
				} catch (err) {
					// Get file src url from stack. Specifically works with the format of stack traces in IE.
					// A stack will look like this:
					//
					// Error
					//    at _.util.currentScript (http://localhost/components/prism-core.js:119:5)
					//    at Global code (http://localhost/components/prism-core.js:606:1)

					var src = (/at [^(\r\n]*\((.*):[^:]+:[^:]+\)$/i.exec(err.stack) || [])[1];
					if (src) {
						var scripts = document.getElementsByTagName('script');
						for (var i in scripts) {
							if (scripts[i].src == src) {
								return scripts[i];
							}
						}
					}
					return null;
				}
			},

			/**
			 * Returns whether a given class is active for `element`.
			 *
			 * The class can be activated if `element` or one of its ancestors has the given class and it can be deactivated
			 * if `element` or one of its ancestors has the negated version of the given class. The _negated version_ of the
			 * given class is just the given class with a `no-` prefix.
			 *
			 * Whether the class is active is determined by the closest ancestor of `element` (where `element` itself is
			 * closest ancestor) that has the given class or the negated version of it. If neither `element` nor any of its
			 * ancestors have the given class or the negated version of it, then the default activation will be returned.
			 *
			 * In the paradoxical situation where the closest ancestor contains __both__ the given class and the negated
			 * version of it, the class is considered active.
			 *
			 * @param {Element} element
			 * @param {string} className
			 * @param {boolean} [defaultActivation=false]
			 * @returns {boolean}
			 */
			isActive: function (element, className, defaultActivation) {
				var no = 'no-' + className;

				while (element) {
					var classList = element.classList;
					if (classList.contains(className)) {
						return true;
					}
					if (classList.contains(no)) {
						return false;
					}
					element = element.parentElement;
				}
				return !!defaultActivation;
			}
		},

		/**
		 * This namespace contains all currently loaded languages and the some helper functions to create and modify languages.
		 *
		 * @namespace
		 * @memberof Prism
		 * @public
		 */
		languages: {
			/**
			 * The grammar for plain, unformatted text.
			 */
			plain: plainTextGrammar,
			plaintext: plainTextGrammar,
			text: plainTextGrammar,
			txt: plainTextGrammar,

			/**
			 * Creates a deep copy of the language with the given id and appends the given tokens.
			 *
			 * If a token in `redef` also appears in the copied language, then the existing token in the copied language
			 * will be overwritten at its original position.
			 *
			 * ## Best practices
			 *
			 * Since the position of overwriting tokens (token in `redef` that overwrite tokens in the copied language)
			 * doesn't matter, they can technically be in any order. However, this can be confusing to others that trying to
			 * understand the language definition because, normally, the order of tokens matters in Prism grammars.
			 *
			 * Therefore, it is encouraged to order overwriting tokens according to the positions of the overwritten tokens.
			 * Furthermore, all non-overwriting tokens should be placed after the overwriting ones.
			 *
			 * @param {string} id The id of the language to extend. This has to be a key in `Prism.languages`.
			 * @param {Grammar} redef The new tokens to append.
			 * @returns {Grammar} The new language created.
			 * @public
			 * @example
			 * Prism.languages['css-with-colors'] = Prism.languages.extend('css', {
			 *     // Prism.languages.css already has a 'comment' token, so this token will overwrite CSS' 'comment' token
			 *     // at its original position
			 *     'comment': { ... },
			 *     // CSS doesn't have a 'color' token, so this token will be appended
			 *     'color': /\b(?:red|green|blue)\b/
			 * });
			 */
			extend: function (id, redef) {
				var lang = _.util.clone(_.languages[id]);

				for (var key in redef) {
					lang[key] = redef[key];
				}

				return lang;
			},

			/**
			 * Inserts tokens _before_ another token in a language definition or any other grammar.
			 *
			 * ## Usage
			 *
			 * This helper method makes it easy to modify existing languages. For example, the CSS language definition
			 * not only defines CSS highlighting for CSS documents, but also needs to define highlighting for CSS embedded
			 * in HTML through `<style>` elements. To do this, it needs to modify `Prism.languages.markup` and add the
			 * appropriate tokens. However, `Prism.languages.markup` is a regular JavaScript object literal, so if you do
			 * this:
			 *
			 * ```js
			 * Prism.languages.markup.style = {
			 *     // token
			 * };
			 * ```
			 *
			 * then the `style` token will be added (and processed) at the end. `insertBefore` allows you to insert tokens
			 * before existing tokens. For the CSS example above, you would use it like this:
			 *
			 * ```js
			 * Prism.languages.insertBefore('markup', 'cdata', {
			 *     'style': {
			 *         // token
			 *     }
			 * });
			 * ```
			 *
			 * ## Special cases
			 *
			 * If the grammars of `inside` and `insert` have tokens with the same name, the tokens in `inside`'s grammar
			 * will be ignored.
			 *
			 * This behavior can be used to insert tokens after `before`:
			 *
			 * ```js
			 * Prism.languages.insertBefore('markup', 'comment', {
			 *     'comment': Prism.languages.markup.comment,
			 *     // tokens after 'comment'
			 * });
			 * ```
			 *
			 * ## Limitations
			 *
			 * The main problem `insertBefore` has to solve is iteration order. Since ES2015, the iteration order for object
			 * properties is guaranteed to be the insertion order (except for integer keys) but some browsers behave
			 * differently when keys are deleted and re-inserted. So `insertBefore` can't be implemented by temporarily
			 * deleting properties which is necessary to insert at arbitrary positions.
			 *
			 * To solve this problem, `insertBefore` doesn't actually insert the given tokens into the target object.
			 * Instead, it will create a new object and replace all references to the target object with the new one. This
			 * can be done without temporarily deleting properties, so the iteration order is well-defined.
			 *
			 * However, only references that can be reached from `Prism.languages` or `insert` will be replaced. I.e. if
			 * you hold the target object in a variable, then the value of the variable will not change.
			 *
			 * ```js
			 * var oldMarkup = Prism.languages.markup;
			 * var newMarkup = Prism.languages.insertBefore('markup', 'comment', { ... });
			 *
			 * assert(oldMarkup !== Prism.languages.markup);
			 * assert(newMarkup === Prism.languages.markup);
			 * ```
			 *
			 * @param {string} inside The property of `root` (e.g. a language id in `Prism.languages`) that contains the
			 * object to be modified.
			 * @param {string} before The key to insert before.
			 * @param {Grammar} insert An object containing the key-value pairs to be inserted.
			 * @param {Object<string, any>} [root] The object containing `inside`, i.e. the object that contains the
			 * object to be modified.
			 *
			 * Defaults to `Prism.languages`.
			 * @returns {Grammar} The new grammar object.
			 * @public
			 */
			insertBefore: function (inside, before, insert, root) {
				root = root || /** @type {any} */ (_.languages);
				var grammar = root[inside];
				/** @type {Grammar} */
				var ret = {};

				for (var token in grammar) {
					if (grammar.hasOwnProperty(token)) {

						if (token == before) {
							for (var newToken in insert) {
								if (insert.hasOwnProperty(newToken)) {
									ret[newToken] = insert[newToken];
								}
							}
						}

						// Do not insert token which also occur in insert. See #1525
						if (!insert.hasOwnProperty(token)) {
							ret[token] = grammar[token];
						}
					}
				}

				var old = root[inside];
				root[inside] = ret;

				// Update references in other language definitions
				_.languages.DFS(_.languages, function (key, value) {
					if (value === old && key != inside) {
						this[key] = ret;
					}
				});

				return ret;
			},

			// Traverse a language definition with Depth First Search
			DFS: function DFS(o, callback, type, visited) {
				visited = visited || {};

				var objId = _.util.objId;

				for (var i in o) {
					if (o.hasOwnProperty(i)) {
						callback.call(o, i, o[i], type || i);

						var property = o[i];
						var propertyType = _.util.type(property);

						if (propertyType === 'Object' && !visited[objId(property)]) {
							visited[objId(property)] = true;
							DFS(property, callback, null, visited);
						} else if (propertyType === 'Array' && !visited[objId(property)]) {
							visited[objId(property)] = true;
							DFS(property, callback, i, visited);
						}
					}
				}
			}
		},

		plugins: {},

		/**
		 * This is the most high-level function in Prism’s API.
		 * It fetches all the elements that have a `.language-xxxx` class and then calls {@link Prism.highlightElement} on
		 * each one of them.
		 *
		 * This is equivalent to `Prism.highlightAllUnder(document, async, callback)`.
		 *
		 * @param {boolean} [async=false] Same as in {@link Prism.highlightAllUnder}.
		 * @param {HighlightCallback} [callback] Same as in {@link Prism.highlightAllUnder}.
		 * @memberof Prism
		 * @public
		 */
		highlightAll: function (async, callback) {
			_.highlightAllUnder(document, async, callback);
		},

		/**
		 * Fetches all the descendants of `container` that have a `.language-xxxx` class and then calls
		 * {@link Prism.highlightElement} on each one of them.
		 *
		 * The following hooks will be run:
		 * 1. `before-highlightall`
		 * 2. `before-all-elements-highlight`
		 * 3. All hooks of {@link Prism.highlightElement} for each element.
		 *
		 * @param {ParentNode} container The root element, whose descendants that have a `.language-xxxx` class will be highlighted.
		 * @param {boolean} [async=false] Whether each element is to be highlighted asynchronously using Web Workers.
		 * @param {HighlightCallback} [callback] An optional callback to be invoked on each element after its highlighting is done.
		 * @memberof Prism
		 * @public
		 */
		highlightAllUnder: function (container, async, callback) {
			var env = {
				callback: callback,
				container: container,
				selector: 'code[class*="language-"], [class*="language-"] code, code[class*="lang-"], [class*="lang-"] code'
			};

			_.hooks.run('before-highlightall', env);

			env.elements = Array.prototype.slice.apply(env.container.querySelectorAll(env.selector));

			_.hooks.run('before-all-elements-highlight', env);

			for (var i = 0, element; (element = env.elements[i++]);) {
				_.highlightElement(element, async === true, env.callback);
			}
		},

		/**
		 * Highlights the code inside a single element.
		 *
		 * The following hooks will be run:
		 * 1. `before-sanity-check`
		 * 2. `before-highlight`
		 * 3. All hooks of {@link Prism.highlight}. These hooks will be run by an asynchronous worker if `async` is `true`.
		 * 4. `before-insert`
		 * 5. `after-highlight`
		 * 6. `complete`
		 *
		 * Some the above hooks will be skipped if the element doesn't contain any text or there is no grammar loaded for
		 * the element's language.
		 *
		 * @param {Element} element The element containing the code.
		 * It must have a class of `language-xxxx` to be processed, where `xxxx` is a valid language identifier.
		 * @param {boolean} [async=false] Whether the element is to be highlighted asynchronously using Web Workers
		 * to improve performance and avoid blocking the UI when highlighting very large chunks of code. This option is
		 * [disabled by default](https://prismjs.com/faq.html#why-is-asynchronous-highlighting-disabled-by-default).
		 *
		 * Note: All language definitions required to highlight the code must be included in the main `prism.js` file for
		 * asynchronous highlighting to work. You can build your own bundle on the
		 * [Download page](https://prismjs.com/download.html).
		 * @param {HighlightCallback} [callback] An optional callback to be invoked after the highlighting is done.
		 * Mostly useful when `async` is `true`, since in that case, the highlighting is done asynchronously.
		 * @memberof Prism
		 * @public
		 */
		highlightElement: function (element, async, callback) {
			// Find language
			var language = _.util.getLanguage(element);
			var grammar = _.languages[language];

			// Set language on the element, if not present
			_.util.setLanguage(element, language);

			// Set language on the parent, for styling
			var parent = element.parentElement;
			if (parent && parent.nodeName.toLowerCase() === 'pre') {
				_.util.setLanguage(parent, language);
			}

			var code = element.textContent;

			var env = {
				element: element,
				language: language,
				grammar: grammar,
				code: code
			};

			function insertHighlightedCode(highlightedCode) {
				env.highlightedCode = highlightedCode;

				_.hooks.run('before-insert', env);

				env.element.innerHTML = env.highlightedCode;

				_.hooks.run('after-highlight', env);
				_.hooks.run('complete', env);
				callback && callback.call(env.element);
			}

			_.hooks.run('before-sanity-check', env);

			// plugins may change/add the parent/element
			parent = env.element.parentElement;
			if (parent && parent.nodeName.toLowerCase() === 'pre' && !parent.hasAttribute('tabindex')) {
				parent.setAttribute('tabindex', '0');
			}

			if (!env.code) {
				_.hooks.run('complete', env);
				callback && callback.call(env.element);
				return;
			}

			_.hooks.run('before-highlight', env);

			if (!env.grammar) {
				insertHighlightedCode(_.util.encode(env.code));
				return;
			}

			if (async && _self.Worker) {
				var worker = new Worker(_.filename);

				worker.onmessage = function (evt) {
					insertHighlightedCode(evt.data);
				};

				worker.postMessage(JSON.stringify({
					language: env.language,
					code: env.code,
					immediateClose: true
				}));
			} else {
				insertHighlightedCode(_.highlight(env.code, env.grammar, env.language));
			}
		},

		/**
		 * Low-level function, only use if you know what you’re doing. It accepts a string of text as input
		 * and the language definitions to use, and returns a string with the HTML produced.
		 *
		 * The following hooks will be run:
		 * 1. `before-tokenize`
		 * 2. `after-tokenize`
		 * 3. `wrap`: On each {@link Token}.
		 *
		 * @param {string} text A string with the code to be highlighted.
		 * @param {Grammar} grammar An object containing the tokens to use.
		 *
		 * Usually a language definition like `Prism.languages.markup`.
		 * @param {string} language The name of the language definition passed to `grammar`.
		 * @returns {string} The highlighted HTML.
		 * @memberof Prism
		 * @public
		 * @example
		 * Prism.highlight('var foo = true;', Prism.languages.javascript, 'javascript');
		 */
		highlight: function (text, grammar, language) {
			var env = {
				code: text,
				grammar: grammar,
				language: language
			};
			_.hooks.run('before-tokenize', env);
			if (!env.grammar) {
				throw new Error('The language "' + env.language + '" has no grammar.');
			}
			env.tokens = _.tokenize(env.code, env.grammar);
			_.hooks.run('after-tokenize', env);
			return Token.stringify(_.util.encode(env.tokens), env.language);
		},

		/**
		 * This is the heart of Prism, and the most low-level function you can use. It accepts a string of text as input
		 * and the language definitions to use, and returns an array with the tokenized code.
		 *
		 * When the language definition includes nested tokens, the function is called recursively on each of these tokens.
		 *
		 * This method could be useful in other contexts as well, as a very crude parser.
		 *
		 * @param {string} text A string with the code to be highlighted.
		 * @param {Grammar} grammar An object containing the tokens to use.
		 *
		 * Usually a language definition like `Prism.languages.markup`.
		 * @returns {TokenStream} An array of strings and tokens, a token stream.
		 * @memberof Prism
		 * @public
		 * @example
		 * let code = `var foo = 0;`;
		 * let tokens = Prism.tokenize(code, Prism.languages.javascript);
		 * tokens.forEach(token => {
		 *     if (token instanceof Prism.Token && token.type === 'number') {
		 *         console.log(`Found numeric literal: ${token.content}`);
		 *     }
		 * });
		 */
		tokenize: function (text, grammar) {
			var rest = grammar.rest;
			if (rest) {
				for (var token in rest) {
					grammar[token] = rest[token];
				}

				delete grammar.rest;
			}

			var tokenList = new LinkedList();
			addAfter(tokenList, tokenList.head, text);

			matchGrammar(text, tokenList, grammar, tokenList.head, 0);

			return toArray(tokenList);
		},

		/**
		 * @namespace
		 * @memberof Prism
		 * @public
		 */
		hooks: {
			all: {},

			/**
			 * Adds the given callback to the list of callbacks for the given hook.
			 *
			 * The callback will be invoked when the hook it is registered for is run.
			 * Hooks are usually directly run by a highlight function but you can also run hooks yourself.
			 *
			 * One callback function can be registered to multiple hooks and the same hook multiple times.
			 *
			 * @param {string} name The name of the hook.
			 * @param {HookCallback} callback The callback function which is given environment variables.
			 * @public
			 */
			add: function (name, callback) {
				var hooks = _.hooks.all;

				hooks[name] = hooks[name] || [];

				hooks[name].push(callback);
			},

			/**
			 * Runs a hook invoking all registered callbacks with the given environment variables.
			 *
			 * Callbacks will be invoked synchronously and in the order in which they were registered.
			 *
			 * @param {string} name The name of the hook.
			 * @param {Object<string, any>} env The environment variables of the hook passed to all callbacks registered.
			 * @public
			 */
			run: function (name, env) {
				var callbacks = _.hooks.all[name];

				if (!callbacks || !callbacks.length) {
					return;
				}

				for (var i = 0, callback; (callback = callbacks[i++]);) {
					callback(env);
				}
			}
		},

		Token: Token
	};
	_self.Prism = _;


	// Typescript note:
	// The following can be used to import the Token type in JSDoc:
	//
	//   @typedef {InstanceType<import("./prism-core")["Token"]>} Token

	/**
	 * Creates a new token.
	 *
	 * @param {string} type See {@link Token#type type}
	 * @param {string | TokenStream} content See {@link Token#content content}
	 * @param {string|string[]} [alias] The alias(es) of the token.
	 * @param {string} [matchedStr=""] A copy of the full string this token was created from.
	 * @class
	 * @global
	 * @public
	 */
	function Token(type, content, alias, matchedStr) {
		/**
		 * The type of the token.
		 *
		 * This is usually the key of a pattern in a {@link Grammar}.
		 *
		 * @type {string}
		 * @see GrammarToken
		 * @public
		 */
		this.type = type;
		/**
		 * The strings or tokens contained by this token.
		 *
		 * This will be a token stream if the pattern matched also defined an `inside` grammar.
		 *
		 * @type {string | TokenStream}
		 * @public
		 */
		this.content = content;
		/**
		 * The alias(es) of the token.
		 *
		 * @type {string|string[]}
		 * @see GrammarToken
		 * @public
		 */
		this.alias = alias;
		// Copy of the full string this token was created from
		this.length = (matchedStr || '').length | 0;
	}

	/**
	 * A token stream is an array of strings and {@link Token Token} objects.
	 *
	 * Token streams have to fulfill a few properties that are assumed by most functions (mostly internal ones) that process
	 * them.
	 *
	 * 1. No adjacent strings.
	 * 2. No empty strings.
	 *
	 *    The only exception here is the token stream that only contains the empty string and nothing else.
	 *
	 * @typedef {Array<string | Token>} TokenStream
	 * @global
	 * @public
	 */

	/**
	 * Converts the given token or token stream to an HTML representation.
	 *
	 * The following hooks will be run:
	 * 1. `wrap`: On each {@link Token}.
	 *
	 * @param {string | Token | TokenStream} o The token or token stream to be converted.
	 * @param {string} language The name of current language.
	 * @returns {string} The HTML representation of the token or token stream.
	 * @memberof Token
	 * @static
	 */
	Token.stringify = function stringify(o, language) {
		if (typeof o == 'string') {
			return o;
		}
		if (Array.isArray(o)) {
			var s = '';
			o.forEach(function (e) {
				s += stringify(e, language);
			});
			return s;
		}

		var env = {
			type: o.type,
			content: stringify(o.content, language),
			tag: 'span',
			classes: ['token', o.type],
			attributes: {},
			language: language
		};

		var aliases = o.alias;
		if (aliases) {
			if (Array.isArray(aliases)) {
				Array.prototype.push.apply(env.classes, aliases);
			} else {
				env.classes.push(aliases);
			}
		}

		_.hooks.run('wrap', env);

		var attributes = '';
		for (var name in env.attributes) {
			attributes += ' ' + name + '="' + (env.attributes[name] || '').replace(/"/g, '&quot;') + '"';
		}

		return '<' + env.tag + ' class="' + env.classes.join(' ') + '"' + attributes + '>' + env.content + '</' + env.tag + '>';
	};

	/**
	 * @param {RegExp} pattern
	 * @param {number} pos
	 * @param {string} text
	 * @param {boolean} lookbehind
	 * @returns {RegExpExecArray | null}
	 */
	function matchPattern(pattern, pos, text, lookbehind) {
		pattern.lastIndex = pos;
		var match = pattern.exec(text);
		if (match && lookbehind && match[1]) {
			// change the match to remove the text matched by the Prism lookbehind group
			var lookbehindLength = match[1].length;
			match.index += lookbehindLength;
			match[0] = match[0].slice(lookbehindLength);
		}
		return match;
	}

	/**
	 * @param {string} text
	 * @param {LinkedList<string | Token>} tokenList
	 * @param {any} grammar
	 * @param {LinkedListNode<string | Token>} startNode
	 * @param {number} startPos
	 * @param {RematchOptions} [rematch]
	 * @returns {void}
	 * @private
	 *
	 * @typedef RematchOptions
	 * @property {string} cause
	 * @property {number} reach
	 */
	function matchGrammar(text, tokenList, grammar, startNode, startPos, rematch) {
		for (var token in grammar) {
			if (!grammar.hasOwnProperty(token) || !grammar[token]) {
				continue;
			}

			var patterns = grammar[token];
			patterns = Array.isArray(patterns) ? patterns : [patterns];

			for (var j = 0; j < patterns.length; ++j) {
				if (rematch && rematch.cause == token + ',' + j) {
					return;
				}

				var patternObj = patterns[j];
				var inside = patternObj.inside;
				var lookbehind = !!patternObj.lookbehind;
				var greedy = !!patternObj.greedy;
				var alias = patternObj.alias;

				if (greedy && !patternObj.pattern.global) {
					// Without the global flag, lastIndex won't work
					var flags = patternObj.pattern.toString().match(/[imsuy]*$/)[0];
					patternObj.pattern = RegExp(patternObj.pattern.source, flags + 'g');
				}

				/** @type {RegExp} */
				var pattern = patternObj.pattern || patternObj;

				for ( // iterate the token list and keep track of the current token/string position
					var currentNode = startNode.next, pos = startPos;
					currentNode !== tokenList.tail;
					pos += currentNode.value.length, currentNode = currentNode.next
				) {

					if (rematch && pos >= rematch.reach) {
						break;
					}

					var str = currentNode.value;

					if (tokenList.length > text.length) {
						// Something went terribly wrong, ABORT, ABORT!
						return;
					}

					if (str instanceof Token) {
						continue;
					}

					var removeCount = 1; // this is the to parameter of removeBetween
					var match;

					if (greedy) {
						match = matchPattern(pattern, pos, text, lookbehind);
						if (!match || match.index >= text.length) {
							break;
						}

						var from = match.index;
						var to = match.index + match[0].length;
						var p = pos;

						// find the node that contains the match
						p += currentNode.value.length;
						while (from >= p) {
							currentNode = currentNode.next;
							p += currentNode.value.length;
						}
						// adjust pos (and p)
						p -= currentNode.value.length;
						pos = p;

						// the current node is a Token, then the match starts inside another Token, which is invalid
						if (currentNode.value instanceof Token) {
							continue;
						}

						// find the last node which is affected by this match
						for (
							var k = currentNode;
							k !== tokenList.tail && (p < to || typeof k.value === 'string');
							k = k.next
						) {
							removeCount++;
							p += k.value.length;
						}
						removeCount--;

						// replace with the new match
						str = text.slice(pos, p);
						match.index -= pos;
					} else {
						match = matchPattern(pattern, 0, str, lookbehind);
						if (!match) {
							continue;
						}
					}

					// eslint-disable-next-line no-redeclare
					var from = match.index;
					var matchStr = match[0];
					var before = str.slice(0, from);
					var after = str.slice(from + matchStr.length);

					var reach = pos + str.length;
					if (rematch && reach > rematch.reach) {
						rematch.reach = reach;
					}

					var removeFrom = currentNode.prev;

					if (before) {
						removeFrom = addAfter(tokenList, removeFrom, before);
						pos += before.length;
					}

					removeRange(tokenList, removeFrom, removeCount);

					var wrapped = new Token(token, inside ? _.tokenize(matchStr, inside) : matchStr, alias, matchStr);
					currentNode = addAfter(tokenList, removeFrom, wrapped);

					if (after) {
						addAfter(tokenList, currentNode, after);
					}

					if (removeCount > 1) {
						// at least one Token object was removed, so we have to do some rematching
						// this can only happen if the current pattern is greedy

						/** @type {RematchOptions} */
						var nestedRematch = {
							cause: token + ',' + j,
							reach: reach
						};
						matchGrammar(text, tokenList, grammar, currentNode.prev, pos, nestedRematch);

						// the reach might have been extended because of the rematching
						if (rematch && nestedRematch.reach > rematch.reach) {
							rematch.reach = nestedRematch.reach;
						}
					}
				}
			}
		}
	}

	/**
	 * @typedef LinkedListNode
	 * @property {T} value
	 * @property {LinkedListNode<T> | null} prev The previous node.
	 * @property {LinkedListNode<T> | null} next The next node.
	 * @template T
	 * @private
	 */

	/**
	 * @template T
	 * @private
	 */
	function LinkedList() {
		/** @type {LinkedListNode<T>} */
		var head = { value: null, prev: null, next: null };
		/** @type {LinkedListNode<T>} */
		var tail = { value: null, prev: head, next: null };
		head.next = tail;

		/** @type {LinkedListNode<T>} */
		this.head = head;
		/** @type {LinkedListNode<T>} */
		this.tail = tail;
		this.length = 0;
	}

	/**
	 * Adds a new node with the given value to the list.
	 *
	 * @param {LinkedList<T>} list
	 * @param {LinkedListNode<T>} node
	 * @param {T} value
	 * @returns {LinkedListNode<T>} The added node.
	 * @template T
	 */
	function addAfter(list, node, value) {
		// assumes that node != list.tail && values.length >= 0
		var next = node.next;

		var newNode = { value: value, prev: node, next: next };
		node.next = newNode;
		next.prev = newNode;
		list.length++;

		return newNode;
	}
	/**
	 * Removes `count` nodes after the given node. The given node will not be removed.
	 *
	 * @param {LinkedList<T>} list
	 * @param {LinkedListNode<T>} node
	 * @param {number} count
	 * @template T
	 */
	function removeRange(list, node, count) {
		var next = node.next;
		for (var i = 0; i < count && next !== list.tail; i++) {
			next = next.next;
		}
		node.next = next;
		next.prev = node;
		list.length -= i;
	}
	/**
	 * @param {LinkedList<T>} list
	 * @returns {T[]}
	 * @template T
	 */
	function toArray(list) {
		var array = [];
		var node = list.head.next;
		while (node !== list.tail) {
			array.push(node.value);
			node = node.next;
		}
		return array;
	}


	if (!_self.document) {
		if (!_self.addEventListener) {
			// in Node.js
			return _;
		}

		if (!_.disableWorkerMessageHandler) {
			// In worker
			_self.addEventListener('message', function (evt) {
				var message = JSON.parse(evt.data);
				var lang = message.language;
				var code = message.code;
				var immediateClose = message.immediateClose;

				_self.postMessage(_.highlight(code, _.languages[lang], lang));
				if (immediateClose) {
					_self.close();
				}
			}, false);
		}

		return _;
	}

	// Get current script and highlight
	var script = _.util.currentScript();

	if (script) {
		_.filename = script.src;

		if (script.hasAttribute('data-manual')) {
			_.manual = true;
		}
	}

	function highlightAutomaticallyCallback() {
		if (!_.manual) {
			_.highlightAll();
		}
	}

	if (!_.manual) {
		// If the document state is "loading", then we'll use DOMContentLoaded.
		// If the document state is "interactive" and the prism.js script is deferred, then we'll also use the
		// DOMContentLoaded event because there might be some plugins or languages which have also been deferred and they
		// might take longer one animation frame to execute which can create a race condition where only some plugins have
		// been loaded when Prism.highlightAll() is executed, depending on how fast resources are loaded.
		// See https://github.com/PrismJS/prism/issues/2102
		var readyState = document.readyState;
		if (readyState === 'loading' || readyState === 'interactive' && script && script.defer) {
			document.addEventListener('DOMContentLoaded', highlightAutomaticallyCallback);
		} else {
			if (window.requestAnimationFrame) {
				window.requestAnimationFrame(highlightAutomaticallyCallback);
			} else {
				window.setTimeout(highlightAutomaticallyCallback, 16);
			}
		}
	}

	return _;

}(_self));

if (typeof module !== 'undefined' && module.exports) {
	module.exports = Prism;
}

// hack for components to work correctly in node.js
if (typeof global !== 'undefined') {
	global.Prism = Prism;
}

// some additional documentation/types

/**
 * The expansion of a simple `RegExp` literal to support additional properties.
 *
 * @typedef GrammarToken
 * @property {RegExp} pattern The regular expression of the token.
 * @property {boolean} [lookbehind=false] If `true`, then the first capturing group of `pattern` will (effectively)
 * behave as a lookbehind group meaning that the captured text will not be part of the matched text of the new token.
 * @property {boolean} [greedy=false] Whether the token is greedy.
 * @property {string|string[]} [alias] An optional alias or list of aliases.
 * @property {Grammar} [inside] The nested grammar of this token.
 *
 * The `inside` grammar will be used to tokenize the text value of each token of this kind.
 *
 * This can be used to make nested and even recursive language definitions.
 *
 * Note: This can cause infinite recursion. Be careful when you embed different languages or even the same language into
 * each another.
 * @global
 * @public
 */

/**
 * @typedef Grammar
 * @type {Object<string, RegExp | GrammarToken | Array<RegExp | GrammarToken>>}
 * @property {Grammar} [rest] An optional grammar object that will be appended to this grammar.
 * @global
 * @public
 */

/**
 * A function which will invoked after an element was successfully highlighted.
 *
 * @callback HighlightCallback
 * @param {Element} element The element successfully highlighted.
 * @returns {void}
 * @global
 * @public
 */

/**
 * @callback HookCallback
 * @param {Object<string, any>} env The environment variables of the hook.
 * @returns {void}
 * @global
 * @public
 */


// --- Bound Dependency: prism/prism-clike.js ---
Prism.languages.clike = {
	'comment': [
		{
			pattern: /(^|[^\\])\/\*[\s\S]*?(?:\*\/|$)/,
			lookbehind: true,
			greedy: true
		},
		{
			pattern: /(^|[^\\:])\/\/.*/,
			lookbehind: true,
			greedy: true
		}
	],
	'string': {
		pattern: /(["'])(?:\\(?:\r\n|[\s\S])|(?!\1)[^\\\r\n])*\1/,
		greedy: true
	},
	'class-name': {
		pattern: /(\b(?:class|extends|implements|instanceof|interface|new|trait)\s+|\bcatch\s+\()[\w.\\]+/i,
		lookbehind: true,
		inside: {
			'punctuation': /[.\\]/
		}
	},
	'keyword': /\b(?:break|catch|continue|do|else|finally|for|function|if|in|instanceof|new|null|return|throw|try|while)\b/,
	'boolean': /\b(?:false|true)\b/,
	'function': /\b\w+(?=\()/,
	'number': /\b0x[\da-f]+\b|(?:\b\d+(?:\.\d*)?|\B\.\d+)(?:e[+-]?\d+)?/i,
	'operator': /[<>]=?|[!=]=?=?|--?|\+\+?|&&?|\|\|?|[?*/~^%]/,
	'punctuation': /[{}[\];(),.:]/
};


// --- Bound Dependency: prism/prism-javascript.js ---
Prism.languages.javascript = Prism.languages.extend('clike', {
	'class-name': [
		Prism.languages.clike['class-name'],
		{
			pattern: /(^|[^$\w\xA0-\uFFFF])(?!\s)[_$A-Z\xA0-\uFFFF](?:(?!\s)[$\w\xA0-\uFFFF])*(?=\.(?:constructor|prototype))/,
			lookbehind: true
		}
	],
	'keyword': [
		{
			pattern: /((?:^|\})\s*)catch\b/,
			lookbehind: true
		},
		{
			pattern: /(^|[^.]|\.\.\.\s*)\b(?:as|assert(?=\s*\{)|async(?=\s*(?:function\b|\(|[$\w\xA0-\uFFFF]|$))|await|break|case|class|const|continue|debugger|default|delete|do|else|enum|export|extends|finally(?=\s*(?:\{|$))|for|from(?=\s*(?:['"]|$))|function|(?:get|set)(?=\s*(?:[#\[$\w\xA0-\uFFFF]|$))|if|implements|import|in|instanceof|interface|let|new|null|of|package|private|protected|public|return|static|super|switch|this|throw|try|typeof|undefined|var|void|while|with|yield)\b/,
			lookbehind: true
		},
	],
	// Allow for all non-ASCII characters (See http://stackoverflow.com/a/2008444)
	'function': /#?(?!\s)[_$a-zA-Z\xA0-\uFFFF](?:(?!\s)[$\w\xA0-\uFFFF])*(?=\s*(?:\.\s*(?:apply|bind|call)\s*)?\()/,
	'number': {
		pattern: RegExp(
			/(^|[^\w$])/.source +
			'(?:' +
			(
				// constant
				/NaN|Infinity/.source +
				'|' +
				// binary integer
				/0[bB][01]+(?:_[01]+)*n?/.source +
				'|' +
				// octal integer
				/0[oO][0-7]+(?:_[0-7]+)*n?/.source +
				'|' +
				// hexadecimal integer
				/0[xX][\dA-Fa-f]+(?:_[\dA-Fa-f]+)*n?/.source +
				'|' +
				// decimal bigint
				/\d+(?:_\d+)*n/.source +
				'|' +
				// decimal number (integer or float) but no bigint
				/(?:\d+(?:_\d+)*(?:\.(?:\d+(?:_\d+)*)?)?|\.\d+(?:_\d+)*)(?:[Ee][+-]?\d+(?:_\d+)*)?/.source
			) +
			')' +
			/(?![\w$])/.source
		),
		lookbehind: true
	},
	'operator': /--|\+\+|\*\*=?|=>|&&=?|\|\|=?|[!=]==|<<=?|>>>?=?|[-+*/%&|^!=<>]=?|\.{3}|\?\?=?|\?\.?|[~:]/
});

Prism.languages.javascript['class-name'][0].pattern = /(\b(?:class|extends|implements|instanceof|interface|new)\s+)[\w.\\]+/;

Prism.languages.insertBefore('javascript', 'keyword', {
	'regex': {
		pattern: RegExp(
			// lookbehind
			// eslint-disable-next-line regexp/no-dupe-characters-character-class
			/((?:^|[^$\w\xA0-\uFFFF."'\])\s]|\b(?:return|yield))\s*)/.source +
			// Regex pattern:
			// There are 2 regex patterns here. The RegExp set notation proposal added support for nested character
			// classes if the `v` flag is present. Unfortunately, nested CCs are both context-free and incompatible
			// with the only syntax, so we have to define 2 different regex patterns.
			/\//.source +
			'(?:' +
			/(?:\[(?:[^\]\\\r\n]|\\.)*\]|\\.|[^/\\\[\r\n])+\/[dgimyus]{0,7}/.source +
			'|' +
			// `v` flag syntax. This supports 3 levels of nested character classes.
			/(?:\[(?:[^[\]\\\r\n]|\\.|\[(?:[^[\]\\\r\n]|\\.|\[(?:[^[\]\\\r\n]|\\.)*\])*\])*\]|\\.|[^/\\\[\r\n])+\/[dgimyus]{0,7}v[dgimyus]{0,7}/.source +
			')' +
			// lookahead
			/(?=(?:\s|\/\*(?:[^*]|\*(?!\/))*\*\/)*(?:$|[\r\n,.;:})\]]|\/\/))/.source
		),
		lookbehind: true,
		greedy: true,
		inside: {
			'regex-source': {
				pattern: /^(\/)[\s\S]+(?=\/[a-z]*$)/,
				lookbehind: true,
				alias: 'language-regex',
				inside: Prism.languages.regex
			},
			'regex-delimiter': /^\/|\/$/,
			'regex-flags': /^[a-z]+$/,
		}
	},
	// This must be declared before keyword because we use "function" inside the look-forward
	'function-variable': {
		pattern: /#?(?!\s)[_$a-zA-Z\xA0-\uFFFF](?:(?!\s)[$\w\xA0-\uFFFF])*(?=\s*[=:]\s*(?:async\s*)?(?:\bfunction\b|(?:\((?:[^()]|\([^()]*\))*\)|(?!\s)[_$a-zA-Z\xA0-\uFFFF](?:(?!\s)[$\w\xA0-\uFFFF])*)\s*=>))/,
		alias: 'function'
	},
	'parameter': [
		{
			pattern: /(function(?:\s+(?!\s)[_$a-zA-Z\xA0-\uFFFF](?:(?!\s)[$\w\xA0-\uFFFF])*)?\s*\(\s*)(?!\s)(?:[^()\s]|\s+(?![\s)])|\([^()]*\))+(?=\s*\))/,
			lookbehind: true,
			inside: Prism.languages.javascript
		},
		{
			pattern: /(^|[^$\w\xA0-\uFFFF])(?!\s)[_$a-z\xA0-\uFFFF](?:(?!\s)[$\w\xA0-\uFFFF])*(?=\s*=>)/i,
			lookbehind: true,
			inside: Prism.languages.javascript
		},
		{
			pattern: /(\(\s*)(?!\s)(?:[^()\s]|\s+(?![\s)])|\([^()]*\))+(?=\s*\)\s*=>)/,
			lookbehind: true,
			inside: Prism.languages.javascript
		},
		{
			pattern: /((?:\b|\s|^)(?!(?:as|async|await|break|case|catch|class|const|continue|debugger|default|delete|do|else|enum|export|extends|finally|for|from|function|get|if|implements|import|in|instanceof|interface|let|new|null|of|package|private|protected|public|return|set|static|super|switch|this|throw|try|typeof|undefined|var|void|while|with|yield)(?![$\w\xA0-\uFFFF]))(?:(?!\s)[_$a-zA-Z\xA0-\uFFFF](?:(?!\s)[$\w\xA0-\uFFFF])*\s*)\(\s*|\]\s*\(\s*)(?!\s)(?:[^()\s]|\s+(?![\s)])|\([^()]*\))+(?=\s*\)\s*\{)/,
			lookbehind: true,
			inside: Prism.languages.javascript
		}
	],
	'constant': /\b[A-Z](?:[A-Z_]|\dx?)*\b/
});

Prism.languages.insertBefore('javascript', 'string', {
	'hashbang': {
		pattern: /^#!.*/,
		greedy: true,
		alias: 'comment'
	},
	'template-string': {
		pattern: /`(?:\\[\s\S]|\$\{(?:[^{}]|\{(?:[^{}]|\{[^}]*\})*\})+\}|(?!\$\{)[^\\`])*`/,
		greedy: true,
		inside: {
			'template-punctuation': {
				pattern: /^`|`$/,
				alias: 'string'
			},
			'interpolation': {
				pattern: /((?:^|[^\\])(?:\\{2})*)\$\{(?:[^{}]|\{(?:[^{}]|\{[^}]*\})*\})+\}/,
				lookbehind: true,
				inside: {
					'interpolation-punctuation': {
						pattern: /^\$\{|\}$/,
						alias: 'punctuation'
					},
					rest: Prism.languages.javascript
				}
			},
			'string': /[\s\S]+/
		}
	},
	'string-property': {
		pattern: /((?:^|[,{])[ \t]*)(["'])(?:\\(?:\r\n|[\s\S])|(?!\2)[^\\\r\n])*\2(?=\s*:)/m,
		lookbehind: true,
		greedy: true,
		alias: 'property'
	}
});

Prism.languages.insertBefore('javascript', 'operator', {
	'literal-property': {
		pattern: /((?:^|[,{])[ \t]*)(?!\s)[_$a-zA-Z\xA0-\uFFFF](?:(?!\s)[$\w\xA0-\uFFFF])*(?=\s*:)/m,
		lookbehind: true,
		alias: 'property'
	},
});

if (Prism.languages.markup) {
	Prism.languages.markup.tag.addInlined('script', 'javascript');

	// add attribute support for all DOM events.
	// https://developer.mozilla.org/en-US/docs/Web/Events#Standard_events
	Prism.languages.markup.tag.addAttribute(
		/on(?:abort|blur|change|click|composition(?:end|start|update)|dblclick|error|focus(?:in|out)?|key(?:down|up)|load|mouse(?:down|enter|leave|move|out|over|up)|reset|resize|scroll|select|slotchange|submit|unload|wheel)/.source,
		'javascript'
	);
}

Prism.languages.js = Prism.languages.javascript;


// --- Bound Dependency: prism/prism-line-numbers.js ---
(function () {

	if (typeof Prism === 'undefined' || typeof document === 'undefined') {
		return;
	}

	/**
	 * Plugin name which is used as a class name for <pre> which is activating the plugin
	 *
	 * @type {string}
	 */
	var PLUGIN_NAME = 'line-numbers';

	/**
	 * Regular expression used for determining line breaks
	 *
	 * @type {RegExp}
	 */
	var NEW_LINE_EXP = /\n(?!$)/g;


	/**
	 * Global exports
	 */
	var config = Prism.plugins.lineNumbers = {
		/**
		 * Get node for provided line number
		 *
		 * @param {Element} element pre element
		 * @param {number} number line number
		 * @returns {Element|undefined}
		 */
		getLine: function (element, number) {
			if (element.tagName !== 'PRE' || !element.classList.contains(PLUGIN_NAME)) {
				return;
			}

			var lineNumberRows = element.querySelector('.line-numbers-rows');
			if (!lineNumberRows) {
				return;
			}
			var lineNumberStart = parseInt(element.getAttribute('data-start'), 10) || 1;
			var lineNumberEnd = lineNumberStart + (lineNumberRows.children.length - 1);

			if (number < lineNumberStart) {
				number = lineNumberStart;
			}
			if (number > lineNumberEnd) {
				number = lineNumberEnd;
			}

			var lineIndex = number - lineNumberStart;

			return lineNumberRows.children[lineIndex];
		},

		/**
		 * Resizes the line numbers of the given element.
		 *
		 * This function will not add line numbers. It will only resize existing ones.
		 *
		 * @param {HTMLElement} element A `<pre>` element with line numbers.
		 * @returns {void}
		 */
		resize: function (element) {
			resizeElements([element]);
		},

		/**
		 * Whether the plugin can assume that the units font sizes and margins are not depended on the size of
		 * the current viewport.
		 *
		 * Setting this to `true` will allow the plugin to do certain optimizations for better performance.
		 *
		 * Set this to `false` if you use any of the following CSS units: `vh`, `vw`, `vmin`, `vmax`.
		 *
		 * @type {boolean}
		 */
		assumeViewportIndependence: true
	};

	/**
	 * Resizes the given elements.
	 *
	 * @param {HTMLElement[]} elements
	 */
	function resizeElements(elements) {
		elements = elements.filter(function (e) {
			var codeStyles = getStyles(e);
			var whiteSpace = codeStyles['white-space'];
			return whiteSpace === 'pre-wrap' || whiteSpace === 'pre-line';
		});

		if (elements.length == 0) {
			return;
		}

		var infos = elements.map(function (element) {
			var codeElement = element.querySelector('code');
			var lineNumbersWrapper = element.querySelector('.line-numbers-rows');
			if (!codeElement || !lineNumbersWrapper) {
				return undefined;
			}

			/** @type {HTMLElement} */
			var lineNumberSizer = element.querySelector('.line-numbers-sizer');
			var codeLines = codeElement.textContent.split(NEW_LINE_EXP);

			if (!lineNumberSizer) {
				lineNumberSizer = document.createElement('span');
				lineNumberSizer.className = 'line-numbers-sizer';

				codeElement.appendChild(lineNumberSizer);
			}

			lineNumberSizer.innerHTML = '0';
			lineNumberSizer.style.display = 'block';

			var oneLinerHeight = lineNumberSizer.getBoundingClientRect().height;
			lineNumberSizer.innerHTML = '';

			return {
				element: element,
				lines: codeLines,
				lineHeights: [],
				oneLinerHeight: oneLinerHeight,
				sizer: lineNumberSizer,
			};
		}).filter(Boolean);

		infos.forEach(function (info) {
			var lineNumberSizer = info.sizer;
			var lines = info.lines;
			var lineHeights = info.lineHeights;
			var oneLinerHeight = info.oneLinerHeight;

			lineHeights[lines.length - 1] = undefined;
			lines.forEach(function (line, index) {
				if (line && line.length > 1) {
					var e = lineNumberSizer.appendChild(document.createElement('span'));
					e.style.display = 'block';
					e.textContent = line;
				} else {
					lineHeights[index] = oneLinerHeight;
				}
			});
		});

		infos.forEach(function (info) {
			var lineNumberSizer = info.sizer;
			var lineHeights = info.lineHeights;

			var childIndex = 0;
			for (var i = 0; i < lineHeights.length; i++) {
				if (lineHeights[i] === undefined) {
					lineHeights[i] = lineNumberSizer.children[childIndex++].getBoundingClientRect().height;
				}
			}
		});

		infos.forEach(function (info) {
			var lineNumberSizer = info.sizer;
			var wrapper = info.element.querySelector('.line-numbers-rows');

			lineNumberSizer.style.display = 'none';
			lineNumberSizer.innerHTML = '';

			info.lineHeights.forEach(function (height, lineNumber) {
				wrapper.children[lineNumber].style.height = height + 'px';
			});
		});
	}

	/**
	 * Returns style declarations for the element
	 *
	 * @param {Element} element
	 */
	function getStyles(element) {
		if (!element) {
			return null;
		}

		return window.getComputedStyle ? getComputedStyle(element) : (element.currentStyle || null);
	}

	var lastWidth = undefined;
	window.addEventListener('resize', function () {
		if (config.assumeViewportIndependence && lastWidth === window.innerWidth) {
			return;
		}
		lastWidth = window.innerWidth;

		resizeElements(Array.prototype.slice.call(document.querySelectorAll('pre.' + PLUGIN_NAME)));
	});

	Prism.hooks.add('complete', function (env) {
		if (!env.code) {
			return;
		}

		var code = /** @type {Element} */ (env.element);
		var pre = /** @type {HTMLElement} */ (code.parentNode);

		// works only for <code> wrapped inside <pre> (not inline)
		if (!pre || !/pre/i.test(pre.nodeName)) {
			return;
		}

		// Abort if line numbers already exists
		if (code.querySelector('.line-numbers-rows')) {
			return;
		}

		// only add line numbers if <code> or one of its ancestors has the `line-numbers` class
		if (!Prism.util.isActive(code, PLUGIN_NAME)) {
			return;
		}

		// Remove the class 'line-numbers' from the <code>
		code.classList.remove(PLUGIN_NAME);
		// Add the class 'line-numbers' to the <pre>
		pre.classList.add(PLUGIN_NAME);

		var match = env.code.match(NEW_LINE_EXP);
		var linesNum = match ? match.length + 1 : 1;
		var lineNumbersWrapper;

		var lines = new Array(linesNum + 1).join('<span></span>');

		lineNumbersWrapper = document.createElement('span');
		lineNumbersWrapper.setAttribute('aria-hidden', 'true');
		lineNumbersWrapper.className = 'line-numbers-rows';
		lineNumbersWrapper.innerHTML = lines;

		if (pre.hasAttribute('data-start')) {
			pre.style.counterReset = 'linenumber ' + (parseInt(pre.getAttribute('data-start'), 10) - 1);
		}

		env.element.appendChild(lineNumbersWrapper);

		resizeElements([pre]);

		Prism.hooks.run('line-numbers', env);
	});

	Prism.hooks.add('line-numbers', function (env) {
		env.plugins = env.plugins || {};
		env.plugins.lineNumbers = true;
	});

}());


// --- Content Logic ---
// Enhances Greasy Fork while preserving the site's original interactive DOM.
const GF_THEME_STORAGE_KEY = 'greasyfork-beautifier-theme';

const getStoredTheme = () => {
    try {
        const theme = localStorage.getItem(GF_THEME_STORAGE_KEY);
        return theme === 'light' || theme === 'dark' ? theme : 'dark';
    } catch {
        return 'dark';
    }
};

const applyTheme = (theme) => {
    if (document.documentElement) {
        document.documentElement.dataset.gfTheme = theme;
        document.documentElement.style.colorScheme = theme;
    } else {
        const observer = new MutationObserver(() => {
            if (document.documentElement) {
                document.documentElement.dataset.gfTheme = theme;
                document.documentElement.style.colorScheme = theme;
                observer.disconnect();
            }
        });
        observer.observe(document, { childList: true });
    }
};

const switchTheme = (theme) => {
    const update = () => applyTheme(theme);
    const canUseViewTransition = typeof document.startViewTransition === 'function'
        && !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (canUseViewTransition) document.startViewTransition(update);
    else update();
};

applyTheme(getStoredTheme());

// Remove any conflicting Greasy Fork styling scripts that would override our CSS.
// These are identified by the comment "GitHub Style for GreasyFork" in their style content.
(function neutralizeConflictingStyles() {
    const isConflict = (node) =>
        node.nodeType === 1 && // ELEMENT_NODE
        node.tagName === 'STYLE' &&
        node.textContent &&
        node.textContent.includes('GitHub Style for GreasyFork');
    const purge = (node) => { if (isConflict(node)) node.remove(); };
    document.querySelectorAll('style').forEach(purge);
    new MutationObserver((mutations) => {
        for (const mutation of mutations) mutation.addedNodes.forEach(purge);
    }).observe(document, { childList: true, subtree: true });
})();

const initializeBeautifier = () => {
    if (!document.body) return;
    if (document.body.classList.contains('gf-enhanced')) {
        releaseGreasyForkBootAfterPaint();
        return;
    }
    try {
    document.body.classList.add('gf-enhanced');

    document.querySelectorAll('.sidebar-search .search-submit, .home-search .search-submit').forEach((submit) => {
        if (submit.tagName !== 'INPUT') return;
        const button = document.createElement('button');
        button.type = 'submit';
        button.className = submit.className;
        button.setAttribute('aria-label', 'Search');
        button.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.5" cy="10.5" r="7.5"/><line x1="16" y1="16" x2="22" y2="22"/></svg>';
        submit.replaceWith(button);
    });

    document.querySelectorAll('.sidebarred .list-option-group').forEach((group) => {
        if (/语言|language/i.test(group.textContent)) group.classList.add('gf-discussion-language-group');
    });

    const headerContent = document.querySelector('#main-header > .width-constraint');
    const userInfo = headerContent?.querySelector('#nav-user-info');
    const languageSelector = userInfo?.querySelector('.language-selector');
    const mobileNav = headerContent?.querySelector('#mobile-nav');
    if (headerContent && userInfo && !headerContent.querySelector('.gf-theme-toggle')) {
        const accountGroup = document.createElement('div');
        accountGroup.className = 'gf-account-group';
        Array.from(userInfo.children)
            .filter((element) => element !== languageSelector)
            .forEach((element) => accountGroup.appendChild(element));

        const headerTools = document.createElement('div');
        headerTools.className = 'gf-header-tools';
        if (languageSelector) headerTools.appendChild(languageSelector);
        userInfo.append(accountGroup, headerTools);

        const isChinese = document.documentElement.lang.toLowerCase().startsWith('zh');
        const themeToggle = document.createElement('button');
        themeToggle.type = 'button';
        themeToggle.className = 'gf-theme-toggle';

        const updateThemeToggle = () => {
            const isDark = document.documentElement.dataset.gfTheme === 'dark';
            const label = isChinese
                ? `切换到${isDark ? '日间' : '夜间'}模式`
                : `Switch to ${isDark ? 'light' : 'dark'} mode`;
            themeToggle.textContent = isDark ? '☀' : '☾';
            themeToggle.setAttribute('aria-label', label);
            themeToggle.setAttribute('title', label);
            themeToggle.setAttribute('aria-pressed', String(!isDark));
        };

        themeToggle.addEventListener('click', () => {
            const nextTheme = document.documentElement.dataset.gfTheme === 'dark' ? 'light' : 'dark';
            switchTheme(nextTheme);
            try {
                localStorage.setItem(GF_THEME_STORAGE_KEY, nextTheme);
            } catch {
                // The active theme still works for this page when storage is unavailable.
            }
            updateThemeToggle();
        });

        headerTools.appendChild(themeToggle);
        const mobileLayout = window.matchMedia('(max-width: 1180px)');
        const placeThemeToggle = () => {
            if (mobileLayout.matches && mobileNav) {
                headerContent.insertBefore(themeToggle, mobileNav);
            } else {
                headerTools.appendChild(themeToggle);
            }
        };
        mobileLayout.addEventListener('change', placeThemeToggle);
        placeThemeToggle();
        updateThemeToggle();
    }

    setupUserDashboard();
    setupHelpPage();
    cacheScriptHeaderStats();
    setupFeedbackPage();
    setupStatisticsPage();
    setupDerivativesPage();
    setupNewVersionPage();
    setupDeletePage();
    setupAdminPage();
    setupCodePage();
    setupScriptDetailPage();
    setupVersionsPage();

    // Add bell icon to header notification badge
    const notifyLink = document.querySelector('.gf-account-group .notification-widget');
    if (notifyLink && notifyLink.tagName === 'A' && !notifyLink.querySelector('svg')) {
        const bellSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        bellSvg.setAttribute('viewBox', '0 0 24 24');
        bellSvg.setAttribute('aria-hidden', 'true');
        bellSvg.innerHTML = '<path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 01-3.46 0"/>';
        notifyLink.insertBefore(bellSvg, notifyLink.firstChild);
    }

    const step1 = document.querySelector('#home-step-1');
    const textContent = step1?.closest('.text-content');
    if (!step1 || !textContent || document.querySelector('.gf-scroll-container')) return;

    const pageContent = textContent.parentElement;
    if (!pageContent) return;
    document.body.classList.add('gf-homepage-redesign');

    const scrollContainer = document.createElement('main');
    scrollContainer.className = 'gf-scroll-container';
    scrollContainer.setAttribute('aria-label', 'Greasy Fork homepage');
    const sections = [];
    const addPage = (content, modifier, label) => {
        if (!content) return;
        const page = document.createElement('section');
        page.className = `gf-scroll-page ${modifier}`;
        page.setAttribute('aria-label', label);
        const card = document.createElement('div');
        card.className = 'gf-page-card';
        card.appendChild(content);
        page.appendChild(card);
        scrollContainer.appendChild(page);
        sections.push(page);
    };

    const heroContent = document.createElement('div');
    heroContent.className = 'gf-hero-content';
    const title = textContent.querySelector('.super-title');
    const scriptNav = textContent.querySelector('#home-script-nav');
    if (title) heroContent.appendChild(title);
    if (scriptNav) heroContent.appendChild(scriptNav);
    const searchSubmit = scriptNav?.querySelector('.search-submit');
    if (searchSubmit && searchSubmit.tagName === 'INPUT') {
        const searchButton = document.createElement('button');
        searchButton.type = 'submit';
        searchButton.className = searchSubmit.className;
        searchButton.setAttribute('aria-label', 'Search');
        searchButton.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.5" cy="10.5" r="7.5"/><line x1="16" y1="16" x2="22" y2="22"/></svg>`;
        searchSubmit.replaceWith(searchButton);
    }
    addPage(heroContent, 'gf-hero-page', title?.textContent.trim() || 'Greasy Fork');

    const intro = Array.from(textContent.children).find((element) => element.tagName === 'SECTION' && !element.id);
    addPage(intro, 'gf-intro-page', intro?.querySelector('h2, h3')?.textContent.trim() || 'About user scripts');
    [1, 2, 3].forEach((number) => {
        const section = document.querySelector(`#home-step-${number}`);
        addPage(section, `gf-step-page gf-step-${number}-page`, section?.querySelector('h2, h3')?.textContent.trim() || `Step ${number}`);
    });
    if (!sections.length) return;
    pageContent.insertBefore(scrollContainer, textContent);
    const hasVisibleRemainder = Array.from(textContent.childNodes).some((node) => {
        if (node.nodeType === 3) return Boolean(node.textContent.trim()); // TEXT_NODE
        if (node.nodeType !== 1) return false; // ELEMENT_NODE
        if (node.matches('.ad, .ad-ga, .rightAD, [id*="google_ads"]')) return false;
        return !['SCRIPT', 'STYLE', 'TEMPLATE'].includes(node.tagName);
    });
    if (hasVisibleRemainder) {
        const remainder = document.createElement('section');
        remainder.className = 'gf-scroll-page gf-remainder-page';
        const card = document.createElement('div');
        card.className = 'gf-page-card';
        card.appendChild(textContent);
        remainder.appendChild(card);
        scrollContainer.appendChild(remainder);
        sections.push(remainder);
    } else textContent.remove();

    const pageNav = document.createElement('nav');
    pageNav.className = 'gf-page-nav';
    pageNav.setAttribute('aria-label', 'Homepage sections');
    const navButtons = sections.map((section, index) => {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'gf-page-nav-button';
        const label = section.getAttribute('aria-label') || `Section ${index + 1}`;
        button.setAttribute('aria-label', label);
        button.setAttribute('title', label);
        button.addEventListener('click', () => section.scrollIntoView({ behavior: 'smooth', block: 'start' }));
        pageNav.appendChild(button);
        return button;
    });
    document.body.appendChild(pageNav);
    const activate = (activeSection) => sections.forEach((section, index) => {
        const isActive = section === activeSection;
        section.classList.toggle('is-active', isActive);
        navButtons[index].classList.toggle('is-active', isActive);
        navButtons[index].setAttribute('aria-current', isActive ? 'step' : 'false');
    });
    activate(sections[0]);
    let updatePending = false;
    const scheduleActiveUpdate = () => {
        if (updatePending) return;
        updatePending = true;
        requestAnimationFrame(() => {
            updatePending = false;
            const center = window.innerHeight / 2;
            const active = sections.reduce((closest, section) => {
                const rect = section.getBoundingClientRect();
                const distance = Math.abs(rect.top + rect.height / 2 - center);
                return distance < closest.distance ? { section, distance } : closest;
            }, { section: sections[0], distance: Number.POSITIVE_INFINITY }).section;
            activate(active);
        });
    };
    scrollContainer.addEventListener('scroll', scheduleActiveUpdate, { passive: true });
    window.addEventListener('scroll', scheduleActiveUpdate, { passive: true });
    window.addEventListener('resize', scheduleActiveUpdate, { passive: true });
    } finally {
        releaseGreasyForkBootAfterPaint();
    }
};

if (document.readyState === 'interactive' || document.readyState === 'complete') {
    initializeBeautifier();
} else {
    document.addEventListener('DOMContentLoaded', initializeBeautifier);
    window.addEventListener('load', initializeBeautifier);
}

function setupUserDashboard() {
    const moduleConfig = [
        { id: 'control-panel', icon: '<path d="M4 4h16v16H4z"/><path d="M8 8h2M14 8h2M8 12h8M8 16h5"/>' },
        { id: 'user-script-list-section', icon: '<path d="M6 4h12v16H6z"/><path d="M9 8h6M9 12h6M9 16h4"/>' },
        { id: 'user-discussions-on-scripts-written', icon: '<path d="M4 5h16v11H8l-4 4z"/><path d="M8 9h8M8 12h5"/>' },
        { id: 'user-discussions', icon: '<path d="M5 4h14v13H8l-3 3z"/><path d="M8 8h8M8 11h6"/>' },
        { id: 'user-conversations', icon: '<path d="M4 6h16v12H8l-4 3z"/><path d="m5 7 7 5 7-5"/>' },
        { id: 'user-script-sets-section', icon: '<path d="M5 5h6l2 2h6v12H5z"/><path d="M8 12h6M8 15h4"/>' }
    ];
    const modules = moduleConfig.map((item) => {
        const element = document.getElementById(item.id);
        const heading = element?.querySelector(':scope > header h3');
        return { ...item, element, label: heading?.textContent.trim() || item.id };
    }).filter((item) => item.element);
    const about = document.getElementById('about-user');
    if (!about || modules.length < 2 || document.querySelector('.gf-user-dashboard')) return;
    const pageConstraint = about.closest('.width-constraint');
    if (!pageConstraint) return;

    const isChinesePage = document.documentElement.lang.toLowerCase().startsWith('zh');
    const emptyProfileText = isChinesePage
        ? '还没有个人简介。正在用代码、工具和一点点好奇心，把想法变成可用的东西。'
        : 'No profile bio yet. Building useful things with code, tools, and a little curiosity.';
    let profile = about.querySelector('#user-profile');
    if (!profile) {
        profile = document.createElement('section');
        profile.id = 'user-profile';
        profile.className = 'user-content gf-profile-placeholder';
        profile.innerHTML = `<p>${emptyProfileText}</p>`;
        about.appendChild(profile);
    } else if (!profile.textContent.trim()) {
        profile.classList.add('gf-profile-placeholder');
        profile.innerHTML = `<p>${emptyProfileText}</p>`;
    }

    about.classList.add('gf-profile-card');

    // Hide report link if viewing own profile
    const loggedInUserEl = document.querySelector('.user-profile-link a');
    if (loggedInUserEl) {
        const loggedInUsername = loggedInUserEl.textContent.trim();
        const nameEl = about.querySelector('h2');
        const profileUsername = nameEl ? nameEl.textContent.trim() : null;

        const loggedInHref = loggedInUserEl.getAttribute('href') || '';
        const loggedInUid = (loggedInHref.match(/\/users\/(\d+)/) || [])[1];

        const reportLink = about.querySelector('.report-link');
        const reportHref = reportLink ? reportLink.getAttribute('href') || '' : '';
        const targetUid = (reportHref.match(/item_id=(\d+)/) || [])[1];

        if ((loggedInUsername && profileUsername && loggedInUsername === profileUsername) ||
            (loggedInUid && targetUid && loggedInUid === targetUid)) {
            if (reportLink) {
                reportLink.style.display = 'none';
            }
        }
    }

    if (!about.querySelector('.gf-profile-avatar')) {
        const avatar = document.createElement('div');
        avatar.className = 'gf-profile-avatar';
        avatar.setAttribute('aria-hidden', 'true');
        const nameEl = about.querySelector('h2');
        if (nameEl) avatar.textContent = nameEl.textContent.trim().charAt(0).toUpperCase();
        about.insertBefore(avatar, about.firstChild);
    }

    const meta = about.querySelector('.gf-profile-meta');
    if (!meta) {
        const metaEl = document.createElement('span');
        metaEl.className = 'gf-profile-meta';
        const nameEl = about.querySelector('h2');
        if (nameEl) nameEl.insertAdjacentElement('afterend', metaEl);
    }

    const dashboard = document.createElement('div');
    dashboard.className = 'gf-user-dashboard';
    const sidebarColumn = document.createElement('div');
    sidebarColumn.className = 'gf-dashboard-sidebar-column';
    const sidebar = document.createElement('aside');
    sidebar.className = 'gf-dashboard-sidebar';
    sidebar.setAttribute('aria-label', document.documentElement.lang.toLowerCase().startsWith('zh') ? '个人中心导航' : 'Profile navigation');
    const content = document.createElement('div');
    content.className = 'gf-dashboard-content';
    const buttons = [];
    const activate = (activeId) => modules.forEach((item, index) => {
        const active = item.id === activeId;
        item.element.hidden = !active;
        item.element.classList.toggle('gf-dashboard-panel-active', active);
        buttons[index].classList.toggle('is-active', active);
        buttons[index].setAttribute('aria-selected', String(active));
        buttons[index].tabIndex = active ? 0 : -1;
    });
    modules.forEach((item, index) => {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'gf-dashboard-tab';
        button.setAttribute('role', 'tab');
        button.setAttribute('aria-controls', item.id);
        button.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true">${item.icon}</svg><span>${item.label}</span>`;
        button.addEventListener('click', () => activate(item.id));
        button.addEventListener('keydown', (event) => {
            if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
            event.preventDefault();
            const next = (index + (event.key === 'ArrowDown' ? 1 : -1) + buttons.length) % buttons.length;
            buttons[next].focus();
            activate(modules[next].id);
        });
        buttons.push(button);
        sidebar.appendChild(button);
        content.appendChild(item.element);
    });
    sidebarColumn.append(about, sidebar);
    dashboard.append(sidebarColumn, content);
    pageConstraint.prepend(dashboard);

    const legacyScriptLayout = pageConstraint.querySelector('.sidebarred');
    if (legacyScriptLayout && !legacyScriptLayout.querySelector('#user-script-list-section')) {
        legacyScriptLayout.classList.add('gf-dashboard-legacy-filters');
    }

    activate(modules[0].id);

    const iconMap = {
        '/script_versions/new': '<path d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/>',
        'language=css': '<path d="M7 8l-4 4 4 4m10-8l4 4-4 4M14 4l-4 16"/>',
        '/sets/new': '<path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"/>',
        '/import': '<path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>',
        '/webhook': '<path d="M18 20V10M12 20V4M6 20v-6"/>',
        '/edit': '<path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/>',
        '/edit_sign_in': '<path d="M15 7h2a5 5 0 010 10h-2m-6-10H7a5 5 0 000 10h2"/><path d="M8 12h8"/>',
        '/notifications': '<path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 01-3.46 0"/>',
        '/notification_settings': '<path d="M12.22 2h-.44a2 2 0 00-2 2v.18a2 2 0 01-1 1.73l-.43.25a2 2 0 01-2 0l-.15-.08a2 2 0 00-2.73.73l-.22.38a2 2 0 00.73 2.73l.15.1a2 2 0 011 1.72v.51a2 2 0 01-1 1.74l-.15.09a2 2 0 00-.73 2.73l.22.38a2 2 0 002.73.73l.15-.08a2 2 0 012 0l.43.25a2 2 0 011 1.73V20a2 2 0 002 2h.44a2 2 0 002-2v-.18a2 2 0 011-1.73l.43-.25a2 2 0 012 0l.15.08a2 2 0 002.73-.73l.22-.39a2 2 0 00-.73-2.73l-.15-.08a2 2 0 01-1-1.74v-.5a2 2 0 011-1.74l.15-.09a2 2 0 00.73-2.73l-.22-.38a2 2 0 00-2.73-.73l-.15.08a2 2 0 01-2 0l-.43-.25a2 2 0 01-1-1.73V4a2 2 0 00-2-2z"/><circle cx="12" cy="12" r="3"/>',
        '/delete_info': '<path d="M3 6h18"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/>',
        '/sign_out': '<path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>'
    };
    const controlLinks = document.querySelectorAll('#user-control-panel a');
    controlLinks.forEach((link) => {
        if (!link.querySelector('.gf-ctrl-icon')) {
            const matchedKey = Object.keys(iconMap).find((key) => link.getAttribute('href').includes(key));
            if (matchedKey) {
                const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
                svg.setAttribute('viewBox', '0 0 24 24');
                svg.setAttribute('aria-hidden', 'true');
                svg.innerHTML = iconMap[matchedKey];
                const wrapper = document.createElement('span');
                wrapper.className = 'gf-ctrl-icon';
                wrapper.appendChild(svg);
                link.insertBefore(wrapper, link.firstChild);
            }
        }
        if (!link.querySelector('.gf-ctrl-label')) {
            const label = document.createElement('span');
            label.className = 'gf-ctrl-label';
            const icon = link.querySelector('.gf-ctrl-icon');
            Array.from(link.childNodes).forEach((node) => {
                if (node !== icon) label.appendChild(node);
            });
            if (icon) icon.insertAdjacentElement('afterend', label);
            else link.appendChild(label);
        }
    });
    const signOut = document.querySelector('#user-control-panel a[href*="sign_out"]');
    if (signOut) signOut.closest('li').classList.add('gf-danger-separator');
    const deleteInfo = document.querySelector('#user-control-panel a[href*="delete_info"]');
    if (deleteInfo) deleteInfo.closest('li').classList.add('gf-danger-separator');
}

function setupHelpPage() {
    const textContent = document.querySelector('body.gf-enhanced > .width-constraint > section.text-content');
    if (!textContent) return;

    const isHelpIndex = window.location.pathname.endsWith('/help');
    const isHelpSubpage = window.location.pathname.includes('/help/');

    if (isHelpIndex) {
        if (textContent.querySelector('.gf-help-grid')) return;

        const cards = [];
        const elements = Array.from(textContent.children);
        let titleText = '帮助与支持';
        let subtitleText = '获取有关 Greasy Fork 使用、开发及社区的帮助文档';

        const isChinese = document.documentElement.lang.toLowerCase().startsWith('zh');
        if (!isChinese) {
            titleText = 'Help & Support';
            subtitleText = 'Get help and documentation for using and developing on Greasy Fork';
        }

        const originalTitle = textContent.querySelector('h1, h2');
        if (originalTitle) {
            titleText = originalTitle.textContent.trim();
            originalTitle.remove();
        }

        let currentH3 = null;
        let currentUL = null;
        let footerP = null;

        elements.forEach(el => {
            if (el.tagName === 'H3') {
                currentH3 = el;
            } else if (el.tagName === 'UL' && currentH3) {
                currentUL = el;
                cards.push({ h3: currentH3, ul: currentUL });
                currentH3 = null;
                currentUL = null;
            } else if (el.tagName === 'P' || el.tagName === 'DIV') {
                if (el.parentNode) {
                    footerP = el;
                }
            }
        });

        const newContent = document.createDocumentFragment();

        const header = document.createElement('div');
        header.className = 'gf-help-header';
        header.innerHTML = `
            <h1>${titleText}</h1>
            <p class="subtitle">${subtitleText}</p>
        `;
        newContent.appendChild(header);

        const grid = document.createElement('div');
        grid.className = 'gf-help-grid';

        cards.forEach(card => {
            const cardDiv = document.createElement('div');
            cardDiv.className = 'gf-help-card';

            const h3 = document.createElement('h3');
            h3.textContent = card.h3.textContent.trim();
            cardDiv.appendChild(h3);

            const ul = document.createElement('ul');
            Array.from(card.ul.querySelectorAll('li')).forEach(li => {
                const newLi = document.createElement('li');
                const a = li.querySelector('a');
                if (a) {
                    const newA = document.createElement('a');
                    newA.setAttribute('href', a.getAttribute('href'));
                    newA.textContent = a.textContent.trim();
                    newLi.appendChild(newA);
                } else {
                    newLi.textContent = li.textContent.trim();
                }
                ul.appendChild(newLi);
            });

            cardDiv.appendChild(ul);
            grid.appendChild(cardDiv);
        });
        newContent.appendChild(grid);

        if (footerP) {
            const footer = document.createElement('div');
            footer.className = 'gf-help-footer';
            footer.appendChild(footerP);
            newContent.appendChild(footer);
        }

        textContent.innerHTML = '';
        textContent.appendChild(newContent);
    } else if (isHelpSubpage) {
        if (textContent.querySelector('.gf-back-link')) return;
        const backDiv = document.createElement('div');
        backDiv.className = 'gf-back-link';
        const isChinese = document.documentElement.lang.toLowerCase().startsWith('zh');
        const label = isChinese ? '← 返回帮助中心' : '← Back to Help Center';

        const helpPath = window.location.pathname.split('/help/')[0] + '/help';
        backDiv.innerHTML = `<a href="${helpPath}">${label}</a>`;
        textContent.insertBefore(backDiv, textContent.firstChild);
    }
}

const GF_SCRIPT_CACHE_KEY = 'greasyfork-beautifier-script-meta';

function getScriptCacheId() {
    const match = window.location.pathname.match(/\/scripts\/(\d+)/);
    return match ? match[1] : null;
}

function cacheScriptHeaderStats() {
    const scriptId = getScriptCacheId();
    if (!scriptId) return;
    const authorLink = document.querySelector('.script-show-author a') || document.querySelector('#script-stats .script-show-author a');
    const installs = document.querySelector('.script-show-total-installs + dd') || document.querySelector('#script-stats dd.script-show-total-installs');
    const ratings = document.querySelector('.good-rating-count');
    try {
        const existing = JSON.parse(sessionStorage.getItem(GF_SCRIPT_CACHE_KEY) || '{}');
        const previous = existing[scriptId] || {};
        existing[scriptId] = {
            authorName: authorLink?.textContent.trim() || previous.authorName || 'Author',
            authorUrl: authorLink?.href || previous.authorUrl || '#',
            totalInstalls: installs?.textContent.trim() || previous.totalInstalls || '0',
            goodRatings: ratings?.textContent.trim() || previous.goodRatings || '0'
        };
        sessionStorage.setItem(GF_SCRIPT_CACHE_KEY, JSON.stringify(existing));
    } catch { /* sessionStorage may be unavailable */ }
}

function readCachedScriptHeaderStats() {
    const scriptId = getScriptCacheId();
    if (!scriptId) return null;
    try { return JSON.parse(sessionStorage.getItem(GF_SCRIPT_CACHE_KEY) || '{}')[scriptId] || null; } catch { return null; }
}

function setupFeedbackPage() {
    const isFeedbackPage = /\/scripts\/\d+[^/]*\/feedback/.test(window.location.pathname);
    if (!isFeedbackPage) return;
    const scriptContent = document.querySelector('#script-content');
    if (!scriptContent || scriptContent.querySelector('.gf-feedback-notice')) return;
    document.body.classList.add('gf-feedback-page');

    // Language detection
    const lang = (document.documentElement.lang || '').toLowerCase();
    const urlLocale = window.location.pathname.split('/')[1] || '';
    const isChinese = lang.startsWith('zh') || urlLocale === 'zh-cn' || urlLocale === 'zh-tw';

    const i18n = isChinese ? {
        bannerTitle: '提交反馈前，请阅读以下须知',
        tips: [
            { icon: '🌐', label: '用正经浏览器', text: 'Firefox、Chrome、Edge、Safari，四选一。别拿些吹得天花乱坠的套壳浏览器来问为什么不行——你都不知道它阉割了什么。' },
            { icon: '🖥️', label: '运行环境', text: '浏览器型号版本、脚本管理器型号版本、脚本版本号，三样一个不能少——缺了就别指望作者能帮你复现。' },
            { icon: '📝', label: '描述要具体', text: '做了什么、出了什么错、报了什么信息，给我写清楚。截控制台图是基本操作，别跟挤牙膏似的挤一句等一句。' },
            { icon: '🔍', label: '先搜索再提问', text: '翻翻已有反馈，你遇到的大概率早有人提过了。重复发帖就是在浪费所有人时间。' },
            { icon: '🤝', label: '作者是志愿者', text: '开发者用自己时间免费帮你，不是你雇的客服。嘴不干净的直接忽略，别怪没提醒。' },
            { icon: '🎯', label: '精准而非情绪', text: '"怎么用不了" 这种废话谁也救不了你。写清楚操作步骤，别让作者猜谜。' },
        ],
        collapse: '收起',
        expand: '展开提示',
        attachLabel: '点击选择附件图片',
        attachHint: '最多 5 张，每张不超过 1.0 MB，支持 PNG / GIF / JPEG / WebP',
        tabAll: '全部反馈',
        tabPost: '提交反馈',
    } : {
        bannerTitle: 'Before submitting feedback, please read this',
        tips: [
            { icon: '🌐', label: 'Use a real browser', text: 'Firefox, Chrome, Edge, or Safari. Not some "turbo-charged" fork that gutted half the APIs. If it ain\'t one of those four, don\'t bother asking why it broke.' },
            { icon: '🖥️', label: 'Your environment', text: 'Browser + version, userscript manager + version, and script version — all three required. Missing any? Don\'t expect help.' },
            { icon: '📝', label: 'Be specific', text: 'What you did, what broke, what errors showed up. Write it all. Screenshots of the console are the bare minimum.' },
            { icon: '🔍', label: 'Search first', text: 'Check existing feedback — your issue is almost certainly already posted. Duplicates waste everyone\'s time.' },
            { icon: '🤝', label: 'Authors are volunteers', text: 'Devs work for free in their spare time, not as your paid support. Rudeness gets ignored. Simple.' },
            { icon: '🎯', label: 'Precision over emotion', text: '"It doesn\'t work" helps nobody. Provide actual steps to reproduce.' },
        ],
        collapse: 'Collapse',
        expand: 'Show Tips',
        attachLabel: 'Choose attachment images',
        attachHint: 'Up to 5 images, max 1.0 MB each. PNG / GIF / JPEG / WebP',
        tabAll: 'All Feedback',
        tabPost: 'Submit Feedback',
    };

    // ── Notice banner ────────────────────────────────────────────────
    const banner = document.createElement('div');
    banner.className = 'gf-feedback-notice';

    const noticeHeader = document.createElement('div');
    noticeHeader.className = 'gf-feedback-notice-header';
    noticeHeader.innerHTML = `
        <span class="gf-feedback-notice-icon">
            <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
        </span>
        <span class="gf-feedback-notice-title">${i18n.bannerTitle}</span>
    `;

    const noticeToggle = document.createElement('button');
    noticeToggle.type = 'button';
    noticeToggle.className = 'gf-feedback-notice-toggle';
    noticeToggle.setAttribute('aria-expanded', 'true');
    noticeToggle.innerHTML = `<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><polyline points="18 15 12 9 6 15"/></svg>`;
    noticeHeader.appendChild(noticeToggle);
    banner.appendChild(noticeHeader);

    const noticeBody = document.createElement('div');
    noticeBody.className = 'gf-feedback-notice-body';
    const tipsList = document.createElement('ul');
    tipsList.className = 'gf-feedback-tips-list';
    i18n.tips.forEach(tip => {
        const li = document.createElement('li');
        li.innerHTML = `<span class="gf-tip-emoji">${tip.icon}</span><span><strong>${tip.label}</strong> — ${tip.text}</span>`;
        tipsList.appendChild(li);
    });
    noticeBody.appendChild(tipsList);

    const noticeFooter = document.createElement('div');
    noticeFooter.className = 'gf-feedback-notice-footer';
    noticeFooter.textContent = isChinese
        ? '以上提示来自 GreasyFork 美化（咸鱼真人）。不服就去代码里删掉——说明我针对的就是你。不要败坏开源社区的风气。'
        : 'These tips brought to you by GreasyFork Beautifier. Mad about it? Delete them from the source code — you\'re exactly who they\'re for.';
    noticeBody.appendChild(noticeFooter);
    banner.appendChild(noticeBody);

    let noticeCollapsed = false;
    noticeToggle.addEventListener('click', () => {
        noticeCollapsed = !noticeCollapsed;
        noticeBody.style.display = noticeCollapsed ? 'none' : '';
        noticeToggle.setAttribute('aria-expanded', String(!noticeCollapsed));
        noticeToggle.classList.toggle('is-collapsed', noticeCollapsed);
    });
    scriptContent.insertBefore(banner, scriptContent.firstChild);

    // ── Form beautification ──────────────────────────────────────────
    // Find the discussion section (contains a form)
    const discussionSection = Array.from(scriptContent.querySelectorAll('section, div')).find(el =>
        el.querySelector('form') && !el.classList.contains('gf-discussion-form-card')
    ) || scriptContent;

    if (discussionSection && !discussionSection.classList.contains('gf-discussion-form-card')) {
        discussionSection.classList.add('gf-discussion-form-card');

        // Create Tabs Navigation
        const tabsContainer = document.createElement('div');
        tabsContainer.className = 'gf-feedback-tabs';
        tabsContainer.setAttribute('role', 'tablist');

        const tabAllBtn = document.createElement('button');
        tabAllBtn.type = 'button';
        tabAllBtn.className = 'gf-feedback-tab-btn is-active';
        tabAllBtn.setAttribute('role', 'tab');
        tabAllBtn.setAttribute('aria-selected', 'true');
        tabAllBtn.innerHTML = `
            <svg viewBox="0 0 24 24">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
            </svg>
            <span>${i18n.tabAll}</span>
        `;

        const tabPostBtn = document.createElement('button');
        tabPostBtn.type = 'button';
        tabPostBtn.className = 'gf-feedback-tab-btn';
        tabPostBtn.setAttribute('role', 'tab');
        tabPostBtn.setAttribute('aria-selected', 'false');
        tabPostBtn.innerHTML = `
            <svg viewBox="0 0 24 24">
                <path d="M12 5v14M5 12h14"/>
            </svg>
            <span>${i18n.tabPost}</span>
        `;

        tabsContainer.append(tabAllBtn, tabPostBtn);
        discussionSection.insertBefore(tabsContainer, discussionSection.firstChild);

        const showElement = (el, show) => {
            if (el) el.style.setProperty('display', show ? '' : 'none', 'important');
        };

        const updateTabState = (activeTab) => {
            const isAll = activeTab === 'all';

            // All feedback elements
            const list = discussionSection.querySelector('.script-discussion-list');
            const pagy = discussionSection.querySelector('nav.pagy, .pagination, nav.series-nav');
            const firstP = discussionSection.querySelector('p:not(.gf-feedback-notice-footer):not(.gf-dropzone-hint)');

            // Post feedback elements
            const notice = document.querySelector('.gf-feedback-notice');
            const formHeading = discussionSection.querySelector('#post-discussion');
            const form = discussionSection.querySelector('form#new-script-discussion');
            const reportP = Array.from(discussionSection.querySelectorAll('p')).find(p => p.textContent.includes('举报') || p.textContent.includes('rules') || p.textContent.includes('report'));
            const envTips = discussionSection.querySelector('.gf-env-tips');

            // Toggle lists
            showElement(list, isAll);
            showElement(pagy, isAll);
            showElement(firstP, isAll);

            // Toggle form elements
            showElement(notice, !isAll);
            showElement(formHeading, !isAll);
            showElement(form, !isAll);
            showElement(reportP, !isAll);
            showElement(envTips, !isAll);

            // Update button styles
            tabAllBtn.classList.toggle('is-active', isAll);
            tabAllBtn.setAttribute('aria-selected', String(isAll));
            tabPostBtn.classList.toggle('is-active', !isAll);
            tabPostBtn.setAttribute('aria-selected', String(!isAll));
        };

        tabAllBtn.addEventListener('click', () => {
            updateTabState('all');
            if (window.location.hash === '#post-discussion' || window.location.hash === '#new-script-discussion') {
                history.pushState('', document.title, window.location.pathname + window.location.search);
            }
        });
        tabPostBtn.addEventListener('click', () => {
            updateTabState('post');
        });

        // Initialize state based on URL hash
        if (window.location.hash === '#post-discussion' || window.location.hash === '#new-script-discussion') {
            updateTabState('post');
        } else {
            updateTabState('all');
        }

        window.addEventListener('hashchange', () => {
            if (window.location.hash === '#post-discussion' || window.location.hash === '#new-script-discussion') {
                updateTabState('post');
            }
        });

        // Heading
        const heading = discussionSection.querySelector('h2, h3');
        if (heading) heading.classList.add('gf-discussion-form-heading');

        // Markup format pills (HTML / Markdown)
        const markupOptions = discussionSection.querySelector('.markup-options');
        if (markupOptions && !markupOptions.classList.contains('gf-editor-markup-options')) {
            markupOptions.classList.add('gf-editor-markup-options');
            const helpLink = markupOptions.querySelector('a[href*="allowed-markup"]');
            if (helpLink) helpLink.classList.add('gf-markup-help');
            const labels = Array.from(markupOptions.querySelectorAll('label.radio-label'));
            if (labels.length) {
                const pillContainer = document.createElement('div');
                pillContainer.className = 'gf-markup-pills';
                labels.forEach(label => {
                    const input = label.querySelector('input[type="radio"]');
                    if (!input) return;
                    const pill = document.createElement('label');
                    pill.className = 'gf-markup-pill';
                    if (input.checked) pill.classList.add('is-active');
                    const textSpan = document.createElement('span');
                    let txt = '';
                    Array.from(label.childNodes).forEach(n => { if (n !== input) txt += n.textContent.trim(); });
                    textSpan.textContent = txt || input.value;
                    pill.append(input, textSpan);
                    pillContainer.appendChild(pill);
                    input.addEventListener('change', () => {
                        pillContainer.querySelectorAll('.gf-markup-pill').forEach(p => {
                            p.classList.toggle('is-active', !!p.querySelector('input')?.checked);
                        });
                    });
                });
                markupOptions.innerHTML = '';
                if (helpLink) markupOptions.appendChild(helpLink);
                markupOptions.appendChild(pillContainer);
            }
        }

        // Environment Template Prepended to Textarea
        let cachedBrowser = '';
        let cachedManager = '';

        const initEnvironmentInfo = async () => {
            if (cachedBrowser && cachedManager) return;

            const ua = navigator.userAgent;
            let browserName = 'Unknown';
            let browserVersion = '';

            const edgMatch = ua.match(/Edg\/([0-9.]+)/i);
            const chromeMatch = ua.match(/Chrome\/([0-9.]+)/i);
            const firefoxMatch = ua.match(/Firefox\/([0-9.]+)/i);
            const safariMatch = ua.match(/Version\/([0-9.]+).*Safari/i);

            if (edgMatch) {
                browserName = 'Edge';
                browserVersion = edgMatch[1];
            } else if (chromeMatch) {
                browserName = 'Chrome';
                browserVersion = chromeMatch[1];
            } else if (firefoxMatch) {
                browserName = 'Firefox';
                browserVersion = firefoxMatch[1];
            } else if (safariMatch) {
                browserName = 'Safari';
                browserVersion = safariMatch[1];
            }

            // Asynchronously check for full version to bypass User-Agent Reduction
            if (navigator.userAgentData && typeof navigator.userAgentData.getHighEntropyValues === 'function') {
                try {
                    const highEntropy = await navigator.userAgentData.getHighEntropyValues(['uaFullVersion']);
                    if (highEntropy.uaFullVersion) {
                        browserVersion = highEntropy.uaFullVersion;
                    }
                } catch {}
            }

            let managerName = 'Unknown';
            if (typeof GM_info !== 'undefined') {
                const handler = GM_info.scriptHandler || 'Tampermonkey';
                const ver = GM_info.version || '';
                managerName = `${handler} ${ver}`.trim();
            } else if (typeof chrome !== 'undefined' && chrome.runtime && typeof chrome.runtime.getManifest === 'function') {
                try {
                    const manifest = chrome.runtime.getManifest();
                    managerName = `Chrome Extension ${manifest.version || ''}`.trim();
                } catch {
                    managerName = 'Chrome Extension';
                }
            }

            cachedBrowser = `${browserName} ${browserVersion}`.trim();
            cachedManager = managerName;
        };

        const getEnvironmentTemplate = (isHtml) => {
            const scriptVerLabel = isChinese ? '自行填写' : 'Fill this in';
            if (isHtml) {
                return `浏览器 / Browser: ${cachedBrowser}\n脚本管理器 / Script Manager: ${cachedManager}\n脚本版本 / Script Version: ${scriptVerLabel}\n\n`;
            } else {
                return `- **浏览器 / Browser**: ${cachedBrowser}\n- **脚本管理器 / Script Manager**: ${cachedManager}\n- **脚本版本 / Script Version**: ${scriptVerLabel}\n\n`;
            }
        };

        const textareaNode = discussionSection.querySelector('textarea.comment-entry');
        if (textareaNode) {
            initEnvironmentInfo().then(() => {
                const checkedInput = discussionSection.querySelector('.markup-options input[type="radio"]:checked');
                const isHtml = checkedInput && checkedInput.value.toLowerCase() === 'html';
                const template = getEnvironmentTemplate(isHtml);

                const currentVal = textareaNode.value;
                if (!currentVal.includes('Script Version') && !currentVal.includes('脚本版本')) {
                    textareaNode.value = template + currentVal;
                    textareaNode.dispatchEvent(new Event('input', { bubbles: true }));
                }

                // Listen to format toggling to swap template format dynamically
                const markupRadios = discussionSection.querySelectorAll('.markup-options input[type="radio"]');
                markupRadios.forEach(radio => {
                    radio.addEventListener('change', () => {
                        const val = textareaNode.value;
                        const toHtml = radio.value.toLowerCase() === 'html';
                        const oldTemplate = getEnvironmentTemplate(!toHtml);
                        const newTemplate = getEnvironmentTemplate(toHtml);

                        if (val.startsWith(oldTemplate)) {
                            textareaNode.value = val.replace(oldTemplate, newTemplate);
                            textareaNode.dispatchEvent(new Event('input', { bubbles: true }));
                        }
                    });
                });
            });
        }

        // Add callout tips banner above the editor
        const editorNode = discussionSection.querySelector('.gf-markdown-editor, .previewable');
        if (editorNode && !discussionSection.querySelector('.gf-env-tips')) {
            const tipsContainer = document.createElement('div');
            tipsContainer.className = 'gf-env-tips';
            tipsContainer.innerHTML = isChinese ? `
                <svg viewBox="0 0 16 16" width="16" height="16">
                    <path d="M0 8a8 8 0 1 1 16 0A8 8 0 0 1 0 8Zm8-3a1 1 0 1 0 0-2 1 1 0 0 0 0 2Zm1.5 5.25a.75.75 0 0 0-1.5 0v3a.75.75 0 0 0 1.5 0v-3ZM8 9a.75.75 0 1 0 0-1.5A.75.75 0 0 0 8 9Z"/>
                </svg>
                <span>当前已在输入框内自动注入版本环境信息。请在下方<strong>自行填写具体的脚本版本</strong>和你的反馈问题（如果系统自动获取的不对，请自行手动修改一下）。</span>
            ` : `
                <svg viewBox="0 0 16 16" width="16" height="16">
                    <path d="M0 8a8 8 0 1 1 16 0A8 8 0 0 1 0 8Zm8-3a1 1 0 1 0 0-2 1 1 0 0 0 0 2Zm1.5 5.25a.75.75 0 0 0-1.5 0v3a.75.75 0 0 0 1.5 0v-3ZM8 9a.75.75 0 1 0 0-1.5A.75.75 0 0 0 8 9Z"/>
                </svg>
                <span>Environment info has been automatically injected into the comments input box. Please <strong>fill in the script version</strong> and write your feedback below (if the auto-detected details are incorrect, please modify them manually).</span>
            `;
            editorNode.parentNode.insertBefore(tipsContainer, editorNode);
        }

        // Write/Preview editor tabs
        const setupEditorTabs = (editor) => {
            const tabs = editor.querySelector('.tabs');
            if (tabs && !tabs.classList.contains('gf-editor-tabs')) tabs.classList.add('gf-editor-tabs');
        };
        discussionSection.querySelectorAll('.previewable').forEach(editor => {
            editor.classList.add('gf-markdown-editor');
            setupEditorTabs(editor);
            const obs = new MutationObserver(() => setupEditorTabs(editor));
            obs.observe(editor, { childList: true, subtree: true });
        });

        // File attachment dropzone
        const attachArea = discussionSection.querySelector('.attachments, [class*="attachment"], .script-screenshot-control');
        if (attachArea && !attachArea.classList.contains('gf-attach-area')) {
            attachArea.classList.add('gf-attach-area');
            const fileInput = attachArea.querySelector('input[type="file"]');
            const existingLabel = attachArea.querySelector('label');
            if (fileInput && existingLabel) {
                existingLabel.style.cssText = 'display:none!important';
                const dropzone = document.createElement('div');
                dropzone.className = 'gf-feedback-dropzone';
                dropzone.innerHTML = `
                    <svg class="gf-upload-icon" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                        <polyline points="17 8 12 3 7 8"/>
                        <line x1="12" y1="3" x2="12" y2="15"/>
                    </svg>
                    <span class="gf-dropzone-cta">${i18n.attachLabel}</span>
                    <span class="gf-dropzone-hint">${i18n.attachHint}</span>
                    <div class="gf-dropzone-filelist"></div>
                `;
                fileInput.classList.add('gf-dropzone-input');
                fileInput.addEventListener('change', () => {
                    const list = dropzone.querySelector('.gf-dropzone-filelist');
                    list.innerHTML = '';
                    Array.from(fileInput.files || []).forEach(f => {
                        const badge = document.createElement('span');
                        badge.className = 'gf-file-badge';
                        badge.textContent = `${f.name} (${(f.size / 1048576).toFixed(2)} MB)`;
                        list.appendChild(badge);
                    });
                    list.style.display = fileInput.files?.length ? 'flex' : 'none';
                });
                attachArea.insertBefore(dropzone, existingLabel);
                attachArea.appendChild(fileInput);
            }
        }

        // Group discussion rating radios
        const ratingGroup = discussionSection.querySelector('.discussion-rating');
        if (ratingGroup && !ratingGroup.querySelector('.gf-rating-options')) {
            const headingLabel = ratingGroup.querySelector('label:not(.radio-label)');
            const radioNote = ratingGroup.querySelector('.radio-note');
            const radios = Array.from(ratingGroup.querySelectorAll('input[type="radio"]'));

            const optionsContainer = document.createElement('div');
            optionsContainer.className = 'gf-rating-options';

            radios.forEach(radio => {
                const label = ratingGroup.querySelector(`label[for="${radio.id}"]`);
                if (label) {
                    const optWrapper = document.createElement('label');
                    optWrapper.className = 'gf-rating-option-wrapper';
                    optWrapper.append(radio, label);
                    optionsContainer.appendChild(optWrapper);
                }
            });

            ratingGroup.innerHTML = '';
            if (headingLabel) ratingGroup.appendChild(headingLabel);
            ratingGroup.appendChild(optionsContainer);
            if (radioNote) ratingGroup.appendChild(radioNote);
        }

        // Notify checkbox
        const subscribeInput = discussionSection.querySelector('input[type="checkbox"]#subscribe');
        const subscribeLabel = discussionSection.querySelector('label[for="subscribe"]');
        if (subscribeInput && subscribeLabel && !discussionSection.querySelector('.gf-subscribe-option-wrapper')) {
            const parent = subscribeInput.parentElement;
            const wrapper = document.createElement('label');
            wrapper.className = 'gf-subscribe-option-wrapper';
            wrapper.append(subscribeInput, subscribeLabel);
            parent.appendChild(wrapper);
        }

        // Submit button
        discussionSection.querySelectorAll('input[type="submit"], button[type="submit"]').forEach(btn => {
            if (!btn.classList.contains('gf-btn-primary')) btn.classList.add('gf-btn-primary');
        });
    }
}

function setupStatisticsPage() {
    const isStatsPage = /\/scripts\/\d+[^/]*\/stats\/?$/.test(window.location.pathname);
    const scriptContent = document.querySelector('#script-content');
    if (!isStatsPage || !scriptContent || scriptContent.querySelector('.gf-statistics-shell')) return;
    document.body.classList.add('gf-statistics-page');

    const filter = Array.from(scriptContent.children).find((element) => element.tagName === 'P' && /过滤|最近|last|days/i.test(element.textContent));
    if (filter) {
        const periodGroup = document.createElement('div');
        periodGroup.className = 'gf-period-switcher';
        const isYearPeriod = new URL(window.location.href).searchParams.get('period') === 'year';
        const buildPeriodUrl = (period) => {
            const url = new URL(window.location.href);
            if (period === 'year') url.searchParams.set('period', 'year');
            else url.searchParams.delete('period');
            return `${url.pathname}${url.search}${url.hash}`;
        };
        [['30', '最近 30 日'], ['365', '最近 365 日']].forEach(([period, label]) => {
            const button = document.createElement('a');
            button.className = `gf-period-button ${isYearPeriod === (period === '365') ? 'is-active' : ''}`;
            button.href = buildPeriodUrl(period === '365' ? 'year' : 'month');
            button.textContent = label;
            button.setAttribute('aria-current', isYearPeriod === (period === '365') ? 'page' : 'false');
            periodGroup.appendChild(button);
        });
        const entertainmentButton = document.createElement('button');
        entertainmentButton.type = 'button';
        entertainmentButton.className = 'gf-entertainment-toggle';
        entertainmentButton.textContent = '娱乐模式';
        entertainmentButton.setAttribute('aria-pressed', 'false');
        entertainmentButton.addEventListener('click', () => {
            const enabled = document.body.classList.toggle('gf-entertainment-mode');
            entertainmentButton.classList.toggle('is-active', enabled);
            entertainmentButton.setAttribute('aria-pressed', String(enabled));
            entertainmentButton.textContent = enabled ? '退出娱乐模式' : '娱乐模式';
        });
        const controls = document.createElement('div');
        controls.className = 'gf-statistics-controls';
        controls.append(periodGroup, entertainmentButton);
        filter.className = 'gf-statistics-filter';
        filter.textContent = '';
        filter.appendChild(controls);
    }

    const nativeInstallChart = scriptContent.querySelector('#install-stats-chart-container');
    if (nativeInstallChart) {
        const customChart = document.createElement('div');
        customChart.className = 'gf-market-chart';
        nativeInstallChart.insertAdjacentElement('beforebegin', customChart);
        const values = extractChartData(nativeInstallChart.id);
        if (values.length) renderMarketBars(customChart, values);
    }

    const table = scriptContent.querySelector('table.stats-table');
    if (table) rebuildStatisticsDataPanel(table);

    const shell = document.createElement('div');
    shell.className = 'gf-statistics-shell';
    Array.from(scriptContent.children).forEach((child) => shell.appendChild(child));
    scriptContent.appendChild(shell);
}

function rebuildStatisticsDataPanel(table) {
    const title = table.previousElementSibling?.tagName === 'H3' ? table.previousElementSibling : null;
    const rows = Array.from(table.tBodies[0]?.rows || []).map((row) => Array.from(row.cells).map((cell) => cell.textContent.trim()));
    const downloads = [];
    const nodesToRemove = [table];
    if (title) nodesToRemove.push(title);

    let cursor = table.nextSibling;
    while (cursor && downloads.length < 2) {
        const next = cursor.nextSibling;
        if (cursor.nodeType === Node.TEXT_NODE && /下载所有数据|download all/i.test(cursor.textContent)) nodesToRemove.push(cursor);
        if (cursor.nodeType === Node.ELEMENT_NODE && cursor.tagName === 'A') {
            downloads.push({ href: cursor.href, label: cursor.textContent.trim().toUpperCase() });
            nodesToRemove.push(cursor);
        }
        cursor = next;
    }

    const panel = document.createElement('section');
    panel.className = 'gf-statistics-data-panel';

    const header = document.createElement('header');
    header.className = 'gf-statistics-data-header';
    const heading = document.createElement('h3');
    heading.textContent = title?.textContent.trim() || '原始数据';
    const count = document.createElement('span');
    count.className = 'gf-statistics-data-count';
    count.textContent = `${rows.length} 天`;
    header.append(heading, count);

    const grid = document.createElement('div');
    grid.className = 'gf-statistics-data-grid';
    rows.forEach(([date, installs, checks]) => {
        const card = document.createElement('article');
        card.className = 'gf-statistics-data-card';
        const dateEl = document.createElement('time');
        dateEl.textContent = date;
        const metrics = document.createElement('div');
        metrics.className = 'gf-statistics-data-metrics';
        [['安装量', installs], ['更新检查', checks]].forEach(([label, value]) => {
            const metric = document.createElement('div');
            metric.className = 'gf-statistics-metric';
            const labelEl = document.createElement('span');
            labelEl.textContent = label;
            const valueEl = document.createElement('strong');
            valueEl.textContent = value;
            metric.append(labelEl, valueEl);
            metrics.appendChild(metric);
        });
        card.append(dateEl, metrics);
        grid.appendChild(card);
    });

    const footer = document.createElement('footer');
    footer.className = 'gf-download-panel';
    const footerLabel = document.createElement('span');
    footerLabel.textContent = '下载全部数据';
    footer.appendChild(footerLabel);
    downloads.forEach(({ href, label }) => {
        const link = document.createElement('a');
        link.href = href;
        link.className = 'gf-download-button';
        link.textContent = label;
        footer.appendChild(link);
    });

    panel.append(header, grid, footer);
    table.insertAdjacentElement('afterend', panel);
    nodesToRemove.forEach((node) => node.remove());
}

function extractChartData(chartId) {
    const script = Array.from(document.querySelectorAll('#script-content script')).find((node) => node.textContent.includes(chartId));
    const match = script?.textContent.match(new RegExp(`initializeChart\\s*\\(\\s*(\\{[\\s\\S]*?\\})\\s*,\\s*['"]${chartId}['"]\\s*\\)`));
    if (!match) return [];
    try { return Object.entries(JSON.parse(match[1])); } catch { return []; }
}

function renderMarketBars(container, values) {
    const closes = values.map(([date, rawValue]) => ({ date, close: Number(rawValue) }));
    const points = closes.map(({ date, close }, index) => {
        const open = index ? closes[index - 1].close : close;
        const previousMove = index ? Math.abs(open - closes[Math.max(0, index - 2)].close) : 0;
        const currentMove = Math.abs(close - open);
        const nextMove = index < closes.length - 1 ? Math.abs(closes[index + 1].close - close) : 0;
        // Only daily totals are available. Wicks are restrained local-volatility estimates, not intraday observations.
        const localMove = Math.max(0.5, (previousMove + currentMove + nextMove) / 6);
        const rise = close >= open;
        const shape = index % 5;
        const upperWick = localMove * (shape === 1 || shape === 4 ? 1.7 : shape === 3 ? 0.45 : rise ? 0.8 : 1.15);
        const lowerWick = localMove * (shape === 0 || shape === 3 ? 1.7 : shape === 2 ? 0.45 : rise ? 1.15 : 0.8);
        const high = Math.max(open, close) + upperWick;
        const low = Math.max(0, Math.min(open, close) - lowerWick);
        return { date, open, close, high, low, change: close - open };
    });
    const rawMin = Math.min(...points.map(({ low }) => low));
    const rawMax = Math.max(...points.map(({ high }) => high), 1);
    const padding = Math.max(0.5, (rawMax - rawMin) * 0.08);
    const minValue = Math.max(0, rawMin - padding);
    const maxValue = rawMax + padding;
    const range = Math.max(maxValue - minValue, 1);
    const position = (value) => `${(maxValue - value) / range * 100}%`;

    container.innerHTML = '';
    const bars = document.createElement('div');
    bars.className = 'gf-market-bars gf-value-axis';
    bars.setAttribute('aria-label', '基于每日安装量估算的趋势蜡烛图');
    points.forEach(({ date, open, close, high, low, change }, index) => {
        const slot = document.createElement('div');
        const direction = change > 0 ? 'is-up' : change < 0 ? 'is-down' : 'is-flat';
        slot.className = `gf-market-slot ${direction}`;
        slot.title = index === 0
            ? `${date}｜当日安装量 ${close}（基准日）`
            : `${date}｜前日安装量 ${open}｜当日安装量 ${close}｜估算上沿 ${high.toFixed(1)} / 下沿 ${low.toFixed(1)}｜变化 ${change > 0 ? '+' : ''}${change}`;

        const wick = document.createElement('span');
        wick.className = 'gf-market-wick';
        wick.style.setProperty('--wick-top', position(high));
        wick.style.setProperty('--wick-height', `${(high - low) / range * 100}%`);

        const candle = document.createElement('span');
        candle.className = 'gf-market-bar';
        const topValue = Math.max(open, close);
        const bottomValue = Math.min(open, close);
        candle.style.setProperty('--candle-top', position(topValue));
        candle.style.setProperty('--candle-height', `${Math.max(2, (topValue - bottomValue) / range * 100)}%`);
        candle.style.setProperty('--point-position', position(close));
        slot.append(wick, candle);
        bars.appendChild(slot);
    });
    container.appendChild(bars);
    enableMarketChartNavigation(container, bars);
}

function enableMarketChartNavigation(container, bars) {
    container.classList.add('gf-market-chart-viewport');
    let dragging = false;
    let dragMoved = false;
    let lastX = 0;
    let frame = 0;
    let pendingScroll = 0;

    container.addEventListener('pointerdown', (event) => {
        if (event.button !== 0) return;
        dragging = true;
        dragMoved = false;
        lastX = event.clientX;
        container.setPointerCapture(event.pointerId);
        container.classList.add('is-dragging');
    });
    container.addEventListener('pointermove', (event) => {
        if (!dragging) return;
        const delta = event.clientX - lastX;
        if (Math.abs(delta) > 1) dragMoved = true;
        lastX = event.clientX;
        pendingScroll -= delta;
        if (frame) return;
        frame = requestAnimationFrame(() => {
            container.scrollLeft += pendingScroll;
            pendingScroll = 0;
            frame = 0;
        });
    });
    const stopDragging = () => {
        dragging = false;
        pendingScroll = 0;
        if (frame) cancelAnimationFrame(frame);
        frame = 0;
        container.classList.remove('is-dragging');
    };
    container.addEventListener('pointerup', stopDragging);
    container.addEventListener('pointercancel', stopDragging);
    container.addEventListener('wheel', (event) => {
        if (Math.abs(event.deltaY) <= Math.abs(event.deltaX) && !event.ctrlKey) return;
        event.preventDefault();
        const oldWidth = Number.parseFloat(getComputedStyle(bars).getPropertyValue('--candle-width')) || 7;
        const nextWidth = Math.min(18, Math.max(3, oldWidth + (event.deltaY < 0 ? 1 : -1)));
        if (nextWidth === oldWidth) return;
        const rect = container.getBoundingClientRect();
        const pointerX = Math.max(0, Math.min(rect.width, event.clientX - rect.left));
        const anchor = container.scrollLeft + pointerX;
        const scale = nextWidth / oldWidth;
        bars.style.setProperty('--candle-width', `${nextWidth}px`);
        requestAnimationFrame(() => {
            container.scrollLeft = Math.max(0, anchor * scale - pointerX);
        });
    }, { passive: false });
}

function setupNewVersionPage() {
    const isNewVersionPage = /\/scripts\/\d+[^/]*\/versions\/new\/?$/.test(window.location.pathname);
    const form = document.querySelector('form.new_script_version');
    if (!isNewVersionPage || !form || form.classList.contains('gf-new-version-enhanced')) return;

    document.body.classList.add('gf-new-version-page');
    form.classList.add('gf-new-version-enhanced');

    // Reorder cards: Additional Info -> Source Code -> Changelog
    const codeCard = form.querySelector('#script_version_code')?.closest('.form-section');
    const additionalCard = form.querySelector('#script-version-additional-info-0')?.closest('.form-section');
    const changelogCard = form.querySelector('#script_version_changelog')?.closest('.form-section');
    if (additionalCard && codeCard && changelogCard) {
        form.insertBefore(additionalCard, form.firstChild);
        form.insertBefore(codeCard, additionalCard.nextSibling);
        form.insertBefore(changelogCard, codeCard.nextSibling);
    }

    // 1. Beautify top notices
    const notice = form.previousElementSibling;
    if (notice && notice.tagName === 'P' && !notice.classList.contains('gf-notice-banner')) {
        notice.classList.add('gf-notice-banner');
        const icon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        icon.setAttribute('viewBox', '0 0 24 24');
        icon.setAttribute('width', '16');
        icon.setAttribute('height', '16');
        icon.setAttribute('fill', 'none');
        icon.setAttribute('stroke', 'currentColor');
        icon.setAttribute('stroke-width', '2');
        icon.innerHTML = '<circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/>';
        notice.insertBefore(icon, notice.firstChild);
    }

    // 2. Format all form-sections into cards with beautiful headers
    const allSections = form.querySelectorAll('.form-section');
    allSections.forEach((section, index) => {
        section.classList.add('gf-version-form-card', `gf-version-form-card-${index + 1}`);

        const label = section.querySelector('label:not(.checkbox-label):not(.radio-label)');
        const labelNote = section.querySelector('.label-note');

        if (label) {
            const header = document.createElement('div');
            header.className = 'gf-card-header';

            const title = document.createElement('h3');
            title.className = 'gf-card-title';
            title.textContent = label.textContent.trim();
            header.appendChild(title);

            // Handle special subtitle note
            if (labelNote) {
                const subtext = document.createElement('span');
                subtext.className = 'gf-card-subtitle';

                // For editor toggle checkboxes, extract them nicely to the right
                const editorToggle = labelNote.querySelector('.enable-source-editor');
                if (editorToggle) {
                    const toggleWrapper = document.createElement('div');
                    toggleWrapper.className = 'gf-header-toggle-wrapper';
                    while (labelNote.firstChild) {
                        toggleWrapper.appendChild(labelNote.firstChild);
                    }
                    header.appendChild(toggleWrapper);
                } else {
                    subtext.appendChild(labelNote);
                    header.appendChild(subtext);
                }
            }

            // Adult content extra loose text description extraction
            const isAdult = label.textContent.includes('成人内容') || label.textContent.toLowerCase().includes('adult content');
            if (isAdult) {
                const control = section.querySelector('.form-control');
                if (control) {
                    let descText = '';
                    Array.from(control.childNodes).forEach(node => {
                        if (node.nodeType === Node.TEXT_NODE && node.textContent.trim()) {
                            descText += node.textContent.trim();
                            node.remove();
                        } else if (node.tagName === 'BR') {
                            node.remove();
                        }
                    });
                    if (descText) {
                        const sub = document.createElement('span');
                        sub.className = 'gf-card-subtitle';
                        sub.textContent = descText;
                        header.appendChild(sub);
                    }
                }
            }

            section.insertBefore(header, section.firstChild);
            label.remove();
        }
    });

    // 3. Code upload section styling (Custom file input buttons)
    const codeUpload = form.querySelector('#code-upload');
    if (codeUpload) {
        const parent = codeUpload.parentElement;
        if (parent) {
            parent.classList.add('gf-file-upload-row');

            codeUpload.style.cssText = 'position:absolute;width:0.1px;height:0.1px;opacity:0;overflow:hidden;z-index:-1;';

            const uploadBtn = document.createElement('label');
            uploadBtn.className = 'gf-upload-btn';
            uploadBtn.setAttribute('for', 'code-upload');
            const isChinese = document.documentElement.lang.toLowerCase().startsWith('zh');
            uploadBtn.textContent = isChinese ? '选择文件' : 'Choose file';

            const fileStatus = document.createElement('span');
            fileStatus.className = 'gf-upload-status';
            fileStatus.textContent = isChinese ? '未选择任何文件' : 'No file chosen';

            codeUpload.addEventListener('change', () => {
                if (codeUpload.files && codeUpload.files.length > 0) {
                    fileStatus.textContent = codeUpload.files[0].name;
                    fileStatus.classList.add('has-file');
                } else {
                    fileStatus.textContent = isChinese ? '未选择任何文件' : 'No file chosen';
                    fileStatus.classList.remove('has-file');
                }
            });

            parent.innerHTML = '';
            const textSpan = document.createElement('span');
            textSpan.textContent = isChinese ? '或本地上传代码：' : 'Or upload code locally: ';
            parent.append(textSpan, uploadBtn, fileStatus, codeUpload);
        }
    }

    // 4. Screenshots dropzone area style
    const screenshotArea = form.querySelector('.script-screenshot-control');
    if (screenshotArea) {
        screenshotArea.classList.add('gf-screenshot-dropzone');

        // Find main text node
        const textNode = Array.from(screenshotArea.childNodes).find(n => n.nodeType === Node.TEXT_NODE && n.textContent.trim());
        const infoText = textNode ? textNode.textContent.trim() : '屏幕截图。格式为：PNG、JPEG 或 GIF。最大 2 MB，最多 5 张。';
        if (textNode) textNode.remove();

        const fileInput = screenshotArea.querySelector('input[type="file"]');
        const inputLabel = screenshotArea.querySelector('label[for="script_version_attachments"]');

        const dropzoneContent = document.createElement('div');
        dropzoneContent.className = 'gf-dropzone-inner';
        dropzoneContent.innerHTML = `
            <svg class="gf-upload-icon" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
            <div class="gf-dropzone-text">
                <span class="gf-dropzone-action">点击选择文件</span> 或拖拽图片至此处
            </div>
            <div class="gf-dropzone-info">${infoText}</div>
            <div class="gf-dropzone-files" style="display: none;"></div>
        `;

        if (inputLabel) inputLabel.style.display = 'none';
        if (fileInput) {
            fileInput.classList.add('gf-dropzone-input');
            fileInput.addEventListener('change', () => {
                const filesContainer = dropzoneContent.querySelector('.gf-dropzone-files');
                if (fileInput.files && fileInput.files.length > 0) {
                    filesContainer.innerHTML = '';
                    filesContainer.style.display = 'flex';
                    Array.from(fileInput.files).forEach(file => {
                        const badge = document.createElement('span');
                        badge.className = 'gf-file-badge';
                        badge.textContent = `${file.name} (${(file.size / 1024 / 1024).toFixed(2)} MB)`;
                        filesContainer.appendChild(badge);
                    });
                } else {
                    filesContainer.style.display = 'none';
                }
            });
        }

        screenshotArea.appendChild(dropzoneContent);
        if (fileInput) screenshotArea.appendChild(fileInput);
    }

    // 5. Setup markdown editors (Additional Info and Changelog)
    const setupEditorTabs = (editorContainer) => {
        const tabs = editorContainer.querySelector('.tabs');
        if (tabs && !tabs.classList.contains('gf-editor-tabs')) {
            tabs.classList.add('gf-editor-tabs');

            // Find formatting options (HTML/Markdown radios)
            const parentControl = editorContainer.closest('.form-control') || editorContainer.parentElement;
            const markupOptions = parentControl?.querySelector('.markup-options');
            if (markupOptions && !markupOptions.classList.contains('gf-editor-markup-options')) {
                markupOptions.classList.add('gf-editor-markup-options');

                const helpLink = markupOptions.querySelector('a[href*="allowed-markup"]');
                if (helpLink) {
                    helpLink.classList.add('gf-markup-help');
                }

                const labels = Array.from(markupOptions.querySelectorAll('label.radio-label'));
                const pillContainer = document.createElement('div');
                pillContainer.className = 'gf-markup-pills';

                labels.forEach(label => {
                    const input = label.querySelector('input[type="radio"]');
                    if (input) {
                        const pill = document.createElement('label');
                        pill.className = 'gf-markup-pill';
                        if (input.checked) pill.classList.add('is-active');

                        const textSpan = document.createElement('span');
                        let txt = '';
                        Array.from(label.childNodes).forEach(node => {
                            if (node !== input && node.tagName !== 'A') {
                                txt += node.textContent.trim();
                            } else if (node.tagName === 'A') {
                                txt += node.textContent.trim();
                            }
                        });
                        textSpan.textContent = txt || input.value;

                        pill.append(input, textSpan);
                        pillContainer.appendChild(pill);

                        input.addEventListener('change', () => {
                            pillContainer.querySelectorAll('.gf-markup-pill').forEach(p => {
                                const r = p.querySelector('input[type="radio"]');
                                p.classList.toggle('is-active', r.checked);
                            });
                        });
                    }
                });

                markupOptions.innerHTML = '';
                if (helpLink) markupOptions.appendChild(helpLink);
                markupOptions.appendChild(pillContainer);
                tabs.appendChild(markupOptions);
            }
        }
    };

    form.querySelectorAll('.previewable').forEach(editorContainer => {
        editorContainer.classList.add('gf-markdown-editor');

        const parentControl = editorContainer.closest('.form-control') || editorContainer.parentElement;
        if (parentControl) {
            parentControl.querySelectorAll('br').forEach(br => br.remove());
        }

        // Style immediately if tabs exist
        setupEditorTabs(editorContainer);

        // Also observe for when tabs are added dynamically by Greasy Fork scripts
        const observer = new MutationObserver((mutations, obs) => {
            if (editorContainer.querySelector('.tabs')) {
                setupEditorTabs(editorContainer);
                obs.disconnect();
            }
        });
        observer.observe(editorContainer, { childList: true, subtree: true });
    });

    // Nest screenshots upload dropzone inside the Additional Info markdown editor card (at the end)
    const addInfoEditor = form.querySelector('#script-version-additional-info-0')?.closest('.gf-markdown-editor');
    if (addInfoEditor && screenshotArea) {
        addInfoEditor.appendChild(screenshotArea);
    }

    // 6. Script Type options card group
    const radioGroup = form.querySelector('.form-control.radio-group');
    if (radioGroup) {
        const radios = Array.from(radioGroup.querySelectorAll('input[type="radio"]'));
        if (radios.length > 0 && radios[0].name === 'script[script_type]') {
            radioGroup.classList.add('gf-options-group');

            const optionsList = document.createElement('div');
            optionsList.className = 'gf-options-list';

            radios.forEach(radio => {
                const label = radioGroup.querySelector(`label[for="${radio.id}"]`);
                if (label) {
                    const item = document.createElement('div');
                    item.className = 'gf-option-item';
                    if (radio.checked) item.classList.add('is-selected');

                    const radioIndicator = document.createElement('span');
                    radioIndicator.className = 'gf-radio-indicator';

                    const contentWrapper = document.createElement('div');
                    contentWrapper.className = 'gf-option-content';

                    const strong = label.querySelector('strong');
                    const titleText = strong ? strong.textContent : 'Option';

                    let descText = label.textContent.replace(titleText, '').trim();
                    descText = descText.replace(/^[\s\-\—\：\:\,]+/, '');

                    const optionTitle = document.createElement('div');
                    optionTitle.className = 'gf-option-title';
                    optionTitle.textContent = titleText;

                    const optionDesc = document.createElement('div');
                    optionDesc.className = 'gf-option-desc';
                    optionDesc.textContent = descText;

                    contentWrapper.append(optionTitle, optionDesc);
                    item.append(radio, radioIndicator, contentWrapper);
                    optionsList.appendChild(item);

                    item.addEventListener('click', (e) => {
                        if (e.target !== radio) {
                            radio.checked = true;
                            radio.dispatchEvent(new Event('change', { bubbles: true }));
                        }
                    });

                    radio.addEventListener('change', () => {
                        optionsList.querySelectorAll('.gf-option-item').forEach(el => {
                            const r = el.querySelector('input[type="radio"]');
                            el.classList.toggle('is-selected', r.checked);
                        });
                    });

                    label.remove();
                }
            });

            Array.from(radioGroup.childNodes).forEach(node => {
                if (node.tagName === 'BR' || node.tagName === 'LABEL') node.remove();
            });
            radioGroup.appendChild(optionsList);
        }
    }

    // 7. Adult Content option card checkbox
    const adultCheckbox = form.querySelector('#script_adult_content_self_report');
    if (adultCheckbox) {
        const parentControl = adultCheckbox.closest('.form-control');
        if (parentControl) {
            parentControl.classList.add('gf-options-group', 'gf-adult-content-group');

            const label = parentControl.querySelector(`label[for="${adultCheckbox.id}"]`);
            if (label) {
                const item = document.createElement('div');
                item.className = 'gf-option-item gf-checkbox-item';
                if (adultCheckbox.checked) item.classList.add('is-selected');

                const checkboxIndicator = document.createElement('span');
                checkboxIndicator.className = 'gf-checkbox-indicator';

                const contentWrapper = document.createElement('div');
                contentWrapper.className = 'gf-option-content';

                const optionTitle = document.createElement('div');
                optionTitle.className = 'gf-option-title';
                optionTitle.textContent = label.textContent.trim();

                contentWrapper.appendChild(optionTitle);
                item.append(adultCheckbox, checkboxIndicator, contentWrapper);

                item.addEventListener('click', (e) => {
                    if (e.target !== adultCheckbox) {
                        adultCheckbox.checked = !adultCheckbox.checked;
                        adultCheckbox.dispatchEvent(new Event('change', { bubbles: true }));
                    }
                });

                adultCheckbox.addEventListener('change', () => {
                    item.classList.toggle('is-selected', adultCheckbox.checked);
                });

                label.remove();

                Array.from(parentControl.childNodes).forEach(node => {
                    if (node !== item && node !== adultCheckbox) {
                        if (node.nodeType === Node.ELEMENT_NODE && node.classList.contains('gf-card-header')) return;
                        node.remove();
                    }
                });

                parentControl.appendChild(item);
            }
        }
    }

    // 8. Form action buttons styling and Cancel link
    const submit = form.querySelector('input[type="submit"][name="commit"]');
    if (submit) {
        submit.classList.add('gf-version-submit');
        const parentP = submit.parentElement;
        if (parentP && parentP.tagName === 'P') {
            parentP.className = 'gf-form-actions';

            const cancelLink = document.createElement('a');
            cancelLink.className = 'gf-form-cancel';
            const isChinese = document.documentElement.lang.toLowerCase().startsWith('zh');
            cancelLink.textContent = isChinese ? '取消' : 'Cancel';

            const cancelUrl = window.location.pathname.replace(/\/versions\/new\/?$/, '');
            cancelLink.setAttribute('href', cancelUrl);

            parentP.appendChild(cancelLink);
        }
    }
}

function setupDeletePage() {
    const isDeletePage = /\/scripts\/\d+[^/]*\/delete\/?$/.test(window.location.pathname);
    const content = document.querySelector('#script-content');
    if (!isDeletePage || !content || content.querySelector('.gf-delete-enhanced')) return;

    document.body.classList.add('gf-delete-page');

    const container = document.createElement('div');
    container.className = 'gf-delete-enhanced gf-delete-dashboard';

    // 1. Title Header
    const isChinese = document.documentElement.lang.toLowerCase().startsWith('zh');
    const header = document.createElement('div');
    header.className = 'gf-delete-header';

    const titleText = isChinese ? '删除脚本' : 'Delete Script';
    header.innerHTML = `<h2>${titleText}</h2>`;
    container.appendChild(header);

    // Create soft delete wrapper card
    const softCard = document.createElement('div');
    softCard.className = 'gf-delete-card gf-soft-delete-card';
    container.appendChild(softCard);

    // 2. Locate Soft Delete Form
    const softForm = content.querySelector('form[action*="/delete"]');
    if (softForm) {
        // Extract explanation paragraph
        const introP = softForm.querySelector('p');
        if (introP) {
            const warningAlert = document.createElement('div');
            warningAlert.className = 'gf-alert gf-alert-warning';
            warningAlert.innerHTML = `
                <svg class="gf-alert-icon" viewBox="0 0 16 16" width="16" height="16" fill="currentColor"><path d="M6.457 1.047c.659-1.233 2.427-1.233 3.086 0l6.03 11.3c.63 1.18-.218 2.653-1.543 2.653H1.97C.645 15-.203 13.527.427 12.347l6.03-11.3zM9 10.5a1 1 0 10-2 0 1 1 0 002 0zm-.25-4.75a.75.75 0 00-1.5 0v2.5a.75.75 0 001.5 0v-2.5z"></path></svg>
                <div class="gf-alert-body">${introP.innerHTML}</div>
            `;
            softCard.appendChild(warningAlert);
            introP.remove();
        }

        // Format Radio control options
        const radioGroup = softForm.querySelector('.form-control:has(input[type="radio"])');
        if (radioGroup) {
            radioGroup.classList.add('gf-options-group');

            // Extract the title text
            let groupTitleText = '';
            Array.from(radioGroup.childNodes).forEach(node => {
                if (node.nodeType === Node.TEXT_NODE && node.textContent.trim()) {
                    groupTitleText += node.textContent.trim();
                    node.remove();
                } else if (node.tagName === 'BR') {
                    node.remove();
                }
            });

            const groupTitle = document.createElement('h3');
            groupTitle.className = 'gf-options-group-title';
            groupTitle.textContent = groupTitleText || (isChinese ? '请选择对用户的措施' : 'Choose action for users');
            softCard.appendChild(groupTitle);

            const optionsList = document.createElement('div');
            optionsList.className = 'gf-options-list';

            const radios = Array.from(radioGroup.querySelectorAll('input[type="radio"]'));
            radios.forEach(radio => {
                const label = radioGroup.querySelector(`label[for="${radio.id}"]`);
                if (label) {
                    const item = document.createElement('div');
                    item.className = 'gf-option-item';
                    if (radio.checked) item.classList.add('is-selected');

                    const radioIndicator = document.createElement('span');
                    radioIndicator.className = 'gf-radio-indicator';

                    const contentWrapper = document.createElement('div');
                    contentWrapper.className = 'gf-option-content';

                    const titleDiv = document.createElement('div');
                    titleDiv.className = 'gf-option-title';
                    titleDiv.textContent = label.textContent.trim();
                    contentWrapper.appendChild(titleDiv);

                    item.append(radio, radioIndicator, contentWrapper);
                    optionsList.appendChild(item);

                    item.addEventListener('click', (e) => {
                        if (e.target !== radio) {
                            radio.checked = true;
                            radio.dispatchEvent(new Event('change', { bubbles: true }));
                        }
                    });

                    radio.addEventListener('change', () => {
                        optionsList.querySelectorAll('.gf-option-item').forEach(el => {
                            const r = el.querySelector('input[type="radio"]');
                            el.classList.toggle('is-selected', r.checked);
                        });
                        toggleRedirectInput();
                    });

                    label.remove();
                }
            });

            radioGroup.innerHTML = '';
            radioGroup.appendChild(optionsList);

            // Clean up left over BR nodes in radioGroup
            Array.from(radioGroup.childNodes).forEach(node => {
                if (node.tagName === 'BR') node.remove();
            });
        }

        // Redirect URL optional text input style
        const redirectInput = softForm.querySelector('#replaced_by_script_id')?.closest('.form-control');
        const toggleRedirectInput = () => {
            if (redirectInput) {
                const redirectRadio = softForm.querySelector('input[value="redirect"]');
                if (redirectRadio && redirectRadio.checked) {
                    redirectInput.style.display = 'block';
                } else {
                    redirectInput.style.display = 'none';
                }
            }
        };

        if (redirectInput) {
            redirectInput.classList.add('gf-redirect-input-row');
            const label = redirectInput.querySelector('label');
            if (label) {
                label.className = 'gf-redirect-label';
            }
            const input = redirectInput.querySelector('input');
            if (input) {
                input.className = 'gf-redirect-text-input';
                input.setAttribute('placeholder', isChinese ? '请输入替代脚本的网址，例如：https://greasyfork.org/scripts/...' : 'Please enter alternative script URL...');
            }
            // Remove BR tags
            redirectInput.querySelectorAll('br').forEach(br => br.remove());
        }

        toggleRedirectInput();

        // Submit action button and actions row styling
        const submit = softForm.querySelector('input[type="submit"]');
        if (submit) {
            submit.className = 'gf-btn gf-btn-warning gf-delete-submit';
            submit.value = isChinese ? '标为已删除 (Soft Delete)' : 'Mark as Deleted';

            // Wrap in action row with cancel
            const parentP = submit.parentElement;
            if (parentP && parentP.tagName === 'P') {
                parentP.className = 'gf-form-actions';
            } else {
                const actionRow = document.createElement('div');
                actionRow.className = 'gf-form-actions';
                submit.parentNode.insertBefore(actionRow, submit);
                actionRow.appendChild(submit);
            }

            const actionRow = submit.closest('.gf-form-actions');
            if (actionRow) {
                const cancelLink = document.createElement('a');
                cancelLink.className = 'gf-form-cancel';
                cancelLink.textContent = isChinese ? '取消' : 'Cancel';
                const cancelUrl = window.location.pathname.replace(/\/delete\/?$/, '');
                cancelLink.setAttribute('href', cancelUrl);
                actionRow.appendChild(cancelLink);
            }
        }

        // Append softForm elements to softCard
        const cardBody = document.createElement('div');
        cardBody.className = 'gf-card-body';
        while (softForm.firstChild) {
            cardBody.appendChild(softForm.firstChild);
        }
        softForm.appendChild(cardBody);
        softCard.appendChild(softForm);
    }

    // 3. Locate Permanent Delete Card
    const permHeader = content.querySelector('h3');
    const permForm = content.querySelector('form[action*="/request_permanent_deletion"]');
    if (permHeader && permForm) {
        const zoneContainer = document.createElement('div');
        zoneContainer.className = 'gf-danger-zone-container';

        const zoneTitle = document.createElement('h3');
        zoneTitle.className = 'gf-danger-zone-title';
        zoneTitle.textContent = isChinese ? '危险区域 (Danger Zone)' : 'Danger Zone';
        zoneContainer.appendChild(zoneTitle);

        const permCard = document.createElement('div');
        permCard.className = 'gf-danger-zone-box';

        // Gather paragraphs between permHeader and permForm
        let sibling = permHeader.nextElementSibling;
        const paragraphs = [];
        while (sibling && sibling !== permForm) {
            if (sibling.tagName === 'P' || sibling.tagName === 'DIV') {
                paragraphs.push(sibling);
            }
            sibling = sibling.nextElementSibling;
        }

        const dangerRow = document.createElement('div');
        dangerRow.className = 'gf-danger-zone-row';

        const dangerInfo = document.createElement('div');
        dangerInfo.className = 'gf-danger-zone-info';

        const infoTitle = document.createElement('strong');
        infoTitle.textContent = permHeader.textContent.trim();
        dangerInfo.appendChild(infoTitle);

        paragraphs.forEach(p => {
            p.className = 'gf-danger-text';
            dangerInfo.appendChild(p);
        });

        permHeader.remove();

        const dangerAction = document.createElement('div');
        dangerAction.className = 'gf-danger-zone-action';

        permForm.classList.add('gf-perm-delete-form');
        const submit = permForm.querySelector('input[type="submit"]');
        if (submit) {
            submit.className = 'gf-btn gf-btn-danger gf-perm-delete-submit';
            submit.value = isChinese ? '永久删除该脚本' : 'Delete this script';
        }

        dangerAction.appendChild(permForm);

        dangerRow.appendChild(dangerInfo);
        dangerRow.appendChild(dangerAction);
        permCard.appendChild(dangerRow);
        zoneContainer.appendChild(permCard);
        container.appendChild(zoneContainer);
    }

    content.innerHTML = '';
    content.appendChild(container);
}

function setupAdminPage() {
    const isAdminPage = /\/scripts\/\d+[^/]*\/admin\/?$/.test(window.location.pathname);
    const content = document.querySelector('#script-content');
    if (!isAdminPage || !content || content.querySelector('.gf-admin-enhanced')) return;

    document.body.classList.add('gf-admin-page');

    const container = document.createElement('div');
    container.className = 'gf-admin-enhanced gf-admin-dashboard';

    // Get the sections directly from content
    const sections = Array.from(content.querySelectorAll('section.multiform-page'));
    if (sections.length === 0) return;

    const isChinese = document.documentElement.lang.toLowerCase().startsWith('zh');

    sections.forEach(section => {
        const wrapper = document.createElement('div');
        wrapper.className = 'gf-admin-section';

        const h3 = section.querySelector('h3');
        if (h3) {
            h3.className = 'gf-admin-section-title';
            wrapper.appendChild(h3);
        }

        const card = document.createElement('div');
        card.className = 'gf-admin-card';

        while(section.firstChild) {
            card.appendChild(section.firstChild);
        }

        // Inside card, let's format inputs and buttons
        const inputs = card.querySelectorAll('input[type="text"], input[type="url"], input[type="number"], select');
        inputs.forEach(input => input.classList.add('gf-admin-text-input'));

        const submitBtns = card.querySelectorAll('input[type="submit"], button[type="submit"]:not(.preview-button)');
        submitBtns.forEach(btn => {
            btn.classList.add('gf-btn', 'gf-admin-submit');
            if (btn.value && (btn.value.includes('更新') || btn.value.includes('设置') || btn.value.includes('发送') || btn.value.includes('比较') || btn.value.includes('邀请') || btn.value.includes('Update') || btn.value.includes('Set') || btn.value.includes('Send') || btn.value.includes('Compare') || btn.value.includes('Invite'))) {
                btn.classList.add('gf-btn-primary');
            }
        });

        // Special fix for the "源代码同步" radio group
        const syncRadios = card.querySelector('.radio-group');
        if (syncRadios) {
            syncRadios.className = 'gf-admin-radio-group gf-options-list';
            const radios = Array.from(syncRadios.querySelectorAll('input[type="radio"]'));
            radios.forEach(radio => {
                const label = syncRadios.querySelector(`label[for="${radio.id}"]`);
                if (label) {
                    const item = document.createElement('div');
                    item.className = 'gf-option-item';
                    if (radio.checked) item.classList.add('is-selected');

                    const radioIndicator = document.createElement('span');
                    radioIndicator.className = 'gf-radio-indicator';

                    const contentWrapper = document.createElement('div');
                    contentWrapper.className = 'gf-option-content';

                    const titleDiv = document.createElement('div');
                    titleDiv.className = 'gf-option-title';
                    titleDiv.textContent = label.textContent.trim();
                    contentWrapper.appendChild(titleDiv);

                    syncRadios.insertBefore(item, radio);
                    item.append(radio, radioIndicator, contentWrapper);
                    item.addEventListener('click', (e) => {
                        if (e.target !== radio) {
                            radio.checked = true;
                            radio.dispatchEvent(new Event('change', { bubbles: true }));
                        }
                    });

                    radio.addEventListener('change', () => {
                        syncRadios.querySelectorAll('.gf-option-item').forEach(el => {
                            const r = el.querySelector('input[type="radio"]');
                            if(r) el.classList.toggle('is-selected', r.checked);
                        });
                    });

                    item.insertBefore(radio, radioIndicator);
                    label.remove();
                }
            });

            // clean br and floating text
            Array.from(syncRadios.childNodes).forEach(node => {
                if (node.tagName === 'BR' || (node.nodeType === Node.TEXT_NODE && node.textContent.trim().length > 0)) {
                    if(node.nodeType === Node.TEXT_NODE) {
                        const groupTitle = document.createElement('h4');
                        groupTitle.className = 'gf-options-group-title';
                        groupTitle.textContent = node.textContent.trim();
                        syncRadios.insertBefore(groupTitle, syncRadios.firstChild);
                    }
                    node.remove();
                }
            });
        }

        // Synced additional info format selector pills wrapping
        const syncControls = card.querySelectorAll('.form-control:has(input[name*="[value_markup]"])');
        syncControls.forEach(control => {
            const radios = Array.from(control.querySelectorAll('input[type="radio"][name*="[value_markup]"]'));
            if (radios.length > 0) {
                const pillContainer = document.createElement('div');
                pillContainer.className = 'gf-markup-pills';

                radios.forEach(radio => {
                    const pill = document.createElement('label');
                    pill.className = 'gf-markup-pill';
                    if (radio.checked) pill.classList.add('is-active');

                    const textSpan = document.createElement('span');
                    const txt = radio.value === 'html' ? 'HTML' : 'Markdown';
                    textSpan.textContent = txt;

                    if (radio.value === 'markdown') {
                        const nextA = radio.nextElementSibling;
                        if (nextA && nextA.tagName === 'A') {
                            nextA.remove();
                        }
                    }

                    let next = radio.nextSibling;
                    while (next && next.nodeType === Node.TEXT_NODE) {
                        next.remove();
                        next = radio.nextSibling;
                    }

                    pill.append(radio, textSpan);
                    pillContainer.appendChild(pill);

                    radio.addEventListener('change', () => {
                        pillContainer.querySelectorAll('.gf-markup-pill').forEach(el => {
                            const r = el.querySelector('input[type="radio"]');
                            el.classList.toggle('is-active', r.checked);
                        });
                    });
                });

                const previewBtn = control.querySelector('.preview-button');
                if (previewBtn) {
                    previewBtn.classList.add('gf-btn', 'gf-preview-btn');
                    const formatRow = document.createElement('div');
                    formatRow.className = 'gf-editor-format-row';
                    formatRow.append(pillContainer, previewBtn);
                    control.appendChild(formatRow);
                } else {
                    control.appendChild(pillContainer);
                }
            }
        });

        // Wrap the card submit button in a actions footer bar
        const form = card.querySelector('form');
        if (form) {
            const submit = form.querySelector('input[type="submit"], button[type="submit"]:not(.preview-button):not(#add-synced-additional-info)');
            if (submit) {
                const actionsBar = document.createElement('div');
                actionsBar.className = 'gf-admin-actions-bar';

                const parent = submit.parentElement;
                if (parent && parent.tagName === 'P') {
                    parent.parentNode.insertBefore(actionsBar, parent);
                    actionsBar.appendChild(submit);
                    parent.remove();
                } else {
                    submit.parentNode.insertBefore(actionsBar, submit);
                    actionsBar.appendChild(submit);
                }
            }
        }

        // Checkup list styles
        const checkups = card.querySelectorAll('.checkup-list li');
        checkups.forEach(li => {
            if (li.classList.contains('good-check')) {
                li.innerHTML = `<svg class="gf-check-icon" viewBox="0 0 16 16" width="16" height="16" fill="currentColor"><path d="M13.78 4.22a.75.75 0 010 1.06l-7.25 7.25a.75.75 0 01-1.06 0L2.22 9.28a.75.75 0 011.06-1.06L6 10.94l6.72-6.72a.75.75 0 011.06 0z"></path></svg>` + li.innerHTML;
            } else if (li.classList.contains('bad-check')) {
                li.innerHTML = `<svg class="gf-cross-icon" viewBox="0 0 16 16" width="16" height="16" fill="currentColor"><path d="M3.72 3.72a.75.75 0 011.06 0L8 6.94l3.22-3.22a.75.75 0 111.06 1.06L9.06 8l3.22 3.22a.75.75 0 11-1.06 1.06L8 9.06l-3.22 3.22a.75.75 0 01-1.06-1.06L6.94 8 3.72 4.78a.75.75 0 010-1.06z"></path></svg>` + li.innerHTML;
            }
        });

        wrapper.appendChild(card);
        container.appendChild(wrapper);
    });

    content.innerHTML = '';
    content.appendChild(container);
}

function setupDerivativesPage() {
    const isDerivativesPage = /\/scripts\/\d+[^/]*\/derivatives\/?$/.test(window.location.pathname);
    const content = document.querySelector('#script-content');
    if (!isDerivativesPage || !content || content.querySelector('.gf-derivatives-dashboard')) return;

    document.body.classList.add('gf-derivatives-page');
    const nodes = Array.from(content.children);
    const intro = nodes.find((node) => node.tagName === 'P' && /这些脚本可能|these scripts may/i.test(node.textContent));
    const headings = nodes.filter((node) => node.tagName === 'H3');
    const exactHeading = headings.find((node) => /完全相同|exactly identical|identical/i.test(node.textContent));
    const similarHeading = headings.find((node) => /相似脚本|similar scripts/i.test(node.textContent));
    const exactText = exactHeading?.nextElementSibling;
    const similarDescription = similarHeading?.nextElementSibling;
    const emptySimilar = similarDescription?.nextElementSibling;
    const checkTime = nodes.find((node) => /上一次对您的脚本查重|last checked/i.test(node.textContent));
    const form = content.querySelector('form.button_to');

    const dashboard = document.createElement('div');
    dashboard.className = 'gf-derivatives-dashboard';
    const introCard = document.createElement('section');
    introCard.className = 'gf-derivatives-intro';
    introCard.innerHTML = '<span class="gf-derivatives-kicker">CODE INTEGRITY</span><h2>脚本相似性检查</h2>';
    if (intro) { const copy = document.createElement('p'); copy.textContent = intro.textContent.trim(); introCard.appendChild(copy); }

    const makeCheckCard = (heading, text, empty, ok) => {
        const card = document.createElement('section');
        card.className = `gf-derivatives-check ${ok ? 'is-clear' : 'is-warning'}`;
        const title = document.createElement('h3');
        title.textContent = heading?.textContent.trim() || '检查项目';
        const badge = document.createElement('span');
        badge.className = 'gf-derivatives-badge';
        badge.textContent = ok ? 'CLEAR' : 'REVIEW';
        const header = document.createElement('div');
        header.className = 'gf-derivatives-check-header';
        header.append(title, badge);
        card.appendChild(header);
        if (text) { const desc = document.createElement('p'); desc.textContent = text.textContent.trim(); card.appendChild(desc); }
        if (empty) { empty.classList.add('gf-derivatives-result'); card.appendChild(empty); }
        return card;
    };

    const checks = document.createElement('div');
    checks.className = 'gf-derivatives-checks';
    checks.append(
        makeCheckCard(exactHeading, null, exactText, true),
        makeCheckCard(similarHeading, similarDescription, emptySimilar, !emptySimilar || !/没有|none|no similar/i.test(emptySimilar.textContent))
    );

    const footer = document.createElement('section');
    footer.className = 'gf-derivatives-footer';
    const footerMeta = document.createElement('div');
    footerMeta.className = 'gf-derivatives-last-check';
    footerMeta.innerHTML = '<span class="gf-derivatives-kicker">LAST CHECK</span>';
    if (checkTime) { const time = document.createElement('p'); time.append(...Array.from(checkTime.childNodes).map((node) => node.cloneNode(true))); footerMeta.appendChild(time); }
    footer.appendChild(footerMeta);
    if (form) { form.classList.add('gf-derivatives-action'); footer.appendChild(form); }

    dashboard.append(introCard, checks, footer);
    content.innerHTML = '';
    content.appendChild(dashboard);
}

function setupCodePage() {
    const isCodePage = /\/scripts\/\d+[^/]*\/code\/?$/.test(window.location.pathname);
    const codeContainer = document.querySelector('.code-container');
    const source = codeContainer?.querySelector('pre');
    if (!isCodePage || !codeContainer || !source || codeContainer.dataset.gfCodeEnhanced === 'true') return;

    document.body.classList.add('gf-code-page');
    codeContainer.dataset.gfCodeEnhanced = 'true';
    codeContainer.classList.add('gf-code-card');
    source.classList.add('gf-source-pre');

    const rawSource = source.textContent || '';
    const lineCount = Math.max(1, rawSource.split(/\r?\n/).length);
    const language = Array.from(source.classList).find((name) => name.startsWith('lang-'))?.slice(5).toUpperCase() || 'SOURCE';

    // Google Code Prettify creates one DOM node per line and becomes very expensive on large scripts.
    // Keep the native wrap class, but restore the source to one plain text node for fast paint/copy/search.
    source.classList.remove('prettyprint', 'linenums');
    source.classList.add('gf-raw-source');
    source.replaceChildren(document.createTextNode(rawSource));

    const codeViewport = document.createElement('div');
    codeViewport.className = 'gf-code-viewport';
    source.parentNode.insertBefore(codeViewport, source);
    codeViewport.appendChild(source);

    let highlighted = false;
    const wrapToggle = document.querySelector('#wrap-lines');
    const wrapLabel = wrapToggle?.nextElementSibling;
    wrapToggle?.classList.add('gf-wrap-toggle-input');
    wrapLabel?.classList.add('gf-wrap-toggle-label');
    const updateWrapMode = () => {
        const isWrapped = Boolean(wrapToggle?.checked);
        codeViewport.classList.toggle('is-wrapped', isWrapped);
        codeViewport.classList.toggle('is-unwrapped', !isWrapped);
        codeViewport.dataset.wrapMode = isWrapped ? 'wrapped' : 'unwrapped';
        if (highlighted) {
            const code = source.querySelector('code');
            source.classList.add('line-numbers');
            if (code && window.Prism) {
                // Rebuild the plugin rows on every mode change so wrapped-line heights never persist in no-wrap mode.
                source.querySelectorAll('.line-numbers-rows, .line-numbers-sizer').forEach((node) => node.remove());
                Prism.highlightElement(code, false);
                if (isWrapped && window.Prism.plugins?.lineNumbers) {
                    window.requestAnimationFrame(() => Prism.plugins.lineNumbers.resize(source));
                }
            }
        }
        wrapLabel?.setAttribute('data-state', isWrapped ? 'on' : 'off');
        wrapLabel?.setAttribute('aria-label', isWrapped ? '关闭自动换行' : '开启自动换行');
        wrapLabel?.setAttribute('title', isWrapped ? '自动换行：每个真实源码行只在第一视觉行显示编号' : '关闭自动换行以查看不折行的原始源码');
    };
    wrapToggle?.addEventListener('change', updateWrapMode);
    updateWrapMode();

    const toolbar = document.createElement('div');
    toolbar.className = 'gf-code-toolbar';
    const meta = document.createElement('div');
    meta.className = 'gf-code-meta';
    meta.innerHTML = `<span class="gf-code-language">${language}</span><span class="gf-code-separator">·</span><span>${lineCount.toLocaleString()} 行</span>`;

    const actions = document.createElement('div');
    actions.className = 'gf-code-actions';
    const setActionLabel = (button, icon, label) => {
        button.innerHTML = `${icon}<span>${label}</span>`;
    };
    const icons = {
        highlight: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m12 3-2.2 5.8L4 11l5.8 2.2L12 19l2.2-5.8L20 11l-5.8-2.2L12 3Z"/><path d="m5 3 .7 1.8L7.5 5.5l-1.8.7L5 8l-.7-1.8-1.8-.7 1.8-.7L5 3Z"/></svg>',
        copy: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>',
        expand: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 3H3v5M16 3h5v5M21 16v5h-5M3 16v5h5"/><path d="m3 8 6-6M21 8l-6-6M21 16l-6 6M3 16l6 6"/></svg>',
        close: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12"/></svg>'
    };
    const highlightButton = document.createElement('button');
    highlightButton.type = 'button';
    highlightButton.className = 'gf-code-action gf-code-highlight';
    setActionLabel(highlightButton, icons.highlight, rawSource.length > 250000 ? '启用高亮' : '关闭高亮');

    const restorePlainSource = () => {
        source.replaceChildren(document.createTextNode(rawSource));
        source.classList.remove('language-javascript', 'line-numbers');
        highlighted = false;
        setActionLabel(highlightButton, icons.highlight, '启用高亮');
        highlightButton.setAttribute('aria-pressed', 'false');
    };
    const applyHighlight = () => {
        if (!window.Prism?.languages?.javascript) return false;
        try {
            const code = document.createElement('code');
            code.className = 'language-javascript';
            // Prism counts newline separators. Add a display-only newline so a real trailing empty source line gets its own number.
            const highlightSource = rawSource.endsWith('\n') ? `${rawSource}\n` : rawSource;
            code.textContent = highlightSource;
            source.replaceChildren(code);
            source.classList.add('language-javascript', 'line-numbers');
            Prism.highlightElement(code, false);
            highlighted = true;
            if (wrapToggle?.checked && window.Prism?.plugins?.lineNumbers) {
                window.requestAnimationFrame(() => Prism.plugins.lineNumbers.resize(source));
            }
            setActionLabel(highlightButton, icons.highlight, '关闭高亮');
            highlightButton.setAttribute('aria-pressed', 'true');
            return true;
        } catch {
            restorePlainSource();
            return false;
        }
    };
    const scheduleHighlight = () => {
        const run = () => applyHighlight();
        if (typeof window.requestIdleCallback === 'function') window.requestIdleCallback(run, { timeout: 1200 });
        else window.setTimeout(run, 80);
    };
    highlightButton.addEventListener('click', () => {
        if (highlighted) restorePlainSource();
        else applyHighlight();
    });
    highlightButton.setAttribute('aria-pressed', 'false');
    actions.appendChild(highlightButton);
    const copyButton = document.createElement('button');
    copyButton.type = 'button';
    copyButton.className = 'gf-code-action gf-code-copy';
    setActionLabel(copyButton, icons.copy, '复制源码');
    copyButton.addEventListener('click', async () => {
        const text = rawSource;
        let copied = false;
        try {
            await navigator.clipboard.writeText(text);
            copied = true;
        } catch {
            const textarea = document.createElement('textarea');
            textarea.value = text;
            textarea.setAttribute('readonly', '');
            textarea.style.cssText = 'position:fixed;left:-9999px;top:0;opacity:0';
            document.body.appendChild(textarea);
            textarea.select();
            copied = document.execCommand('copy');
            textarea.remove();
        }
        setActionLabel(copyButton, icons.copy, copied ? '已复制' : '复制失败');
        window.setTimeout(() => { setActionLabel(copyButton, icons.copy, '复制源码'); }, 1400);
    });
    const wrapControl = wrapToggle?.parentElement;
    if (wrapControl && wrapLabel) {
        wrapControl.classList.add('gf-wrap-control');
        actions.appendChild(wrapControl);
    }
    const fullscreenButton = document.createElement('button');
    fullscreenButton.type = 'button';
    fullscreenButton.className = 'gf-code-action gf-code-fullscreen';
    fullscreenButton.setAttribute('aria-label', '放大代码查看器');
    fullscreenButton.setAttribute('title', '放大代码查看器');
    setActionLabel(fullscreenButton, icons.expand, '放大查看');
    const setFullscreen = (enabled) => {
        codeContainer.classList.toggle('is-fullscreen-reader', enabled);
        document.body.classList.toggle('gf-code-reader-open', enabled);
        const fullscreenLabel = enabled ? '退出放大代码查看器' : '放大代码查看器';
        setActionLabel(fullscreenButton, enabled ? icons.close : icons.expand, enabled ? '退出查看' : '放大查看');
        fullscreenButton.setAttribute('aria-pressed', String(enabled));
        fullscreenButton.setAttribute('aria-label', fullscreenLabel);
        fullscreenButton.setAttribute('title', fullscreenLabel);
        if (enabled) codeViewport.focus({ preventScroll: true });
    };
    fullscreenButton.addEventListener('click', () => setFullscreen(!codeContainer.classList.contains('is-fullscreen-reader')));
    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape' && codeContainer.classList.contains('is-fullscreen-reader')) setFullscreen(false);
    });
    actions.append(copyButton, fullscreenButton);
    toolbar.append(meta, actions);
    codeContainer.insertBefore(toolbar, codeViewport);

    if (rawSource.length <= 250000) scheduleHighlight();
}

// --- Script header stats cache (localStorage, keyed by script ID) ---
function getScriptIdFromUrl() {
    const m = window.location.pathname.match(/\/scripts\/(\d+)/);
    return m ? m[1] : null;
}
function readCachedScriptHeaderStats() {
    const id = getScriptIdFromUrl();
    if (!id) return null;
    try {
        const raw = localStorage.getItem('gf-script-header-' + id);
        return raw ? JSON.parse(raw) : null;
    } catch { return null; }
}
function writeCachedScriptHeaderStats(stats) {
    const id = getScriptIdFromUrl();
    if (!id) return;
    try { localStorage.setItem('gf-script-header-' + id, JSON.stringify(stats)); } catch { /* ignore */ }
}
// --- End cache helpers ---

function setupScriptDetailPage() {
    const isScriptDetailPage = /^\/[^\/]+\/scripts\/\d+/.test(window.location.pathname);
    if (!isScriptDetailPage) return;

    const scriptInfo = document.querySelector('#script-info');
    if (!scriptInfo || document.querySelector('.gf-script-header')) return;

    document.body.classList.add('gf-script-detail-page');

    // 1. Extract elements
    const originalHeader = scriptInfo.querySelector('header');
    const originalTabs = scriptInfo.querySelector('ul#script-links');
    const scriptContent = scriptInfo.querySelector('#script-content');

    let scriptName = 'Script';
    if (originalHeader && originalHeader.querySelector('h2')) {
        scriptName = originalHeader.querySelector('h2').textContent.trim();
    }

    // Parse Author details
    let authorName = 'Author';
    let authorUrl = '#';
    const authorLink = document.querySelector('.script-show-author a') || document.querySelector('#script-stats .script-show-author a');
    const cachedStats = readCachedScriptHeaderStats();
    if (authorLink) {
        authorName = authorLink.textContent.trim();
        authorUrl = authorLink.getAttribute('href');
    } else if (cachedStats) {
        authorName = cachedStats.authorName;
        authorUrl = cachedStats.authorUrl;
    }

    // Parse stats for header action buttons
    let totalInstalls = '0';
    const totalInstallsDd = document.querySelector('.script-show-total-installs + dd') || document.querySelector('#script-stats dd.script-show-total-installs');
    if (totalInstallsDd) {
        totalInstalls = totalInstallsDd.textContent.trim();
    } else if (cachedStats) {
        totalInstalls = cachedStats.totalInstalls;
    }

    let goodRatings = '0';
    const goodRatingsSpan = document.querySelector('.good-rating-count');
    if (goodRatingsSpan) {
        goodRatings = goodRatingsSpan.textContent.trim();
    } else if (cachedStats) {
        goodRatings = cachedStats.goodRatings;
    }

    // Persist whatever real data we found so other sub-pages can read it back
    if (authorLink || totalInstallsDd || goodRatingsSpan) {
        writeCachedScriptHeaderStats({ authorName, authorUrl, totalInstalls, goodRatings });
    }

    // 2. Create the GitHub Sub-Header
    const gfHeader = document.createElement('div');
    gfHeader.className = 'gf-script-header';

    const gfHeaderInner = document.createElement('div');
    gfHeaderInner.className = 'width-constraint';

    const breadcrumb = document.createElement('div');
    breadcrumb.className = 'gf-script-breadcrumb';

    const breadcrumbLeft = document.createElement('div');
    breadcrumbLeft.className = 'gf-breadcrumb-left';
    breadcrumbLeft.innerHTML = `
        <svg class="gf-repo-icon" viewBox="0 0 16 16" width="16" height="16" fill="currentColor"><path d="M2 2.5A2.5 2.5 0 0 1 4.5 0h8.75a.75.75 0 0 1 .75.75v12.5a.75.75 0 0 1-.75.75h-2.5a.75.75 0 1 1 0-1.5h1.75v-2h-8a1 1 0 0 0-.714 1.7.75.75 0 0 1-1.072 1.05A2.495 2.495 0 0 1 2 11.5Zm10.5-1V9h-8c-.356 0-.694.074-1 .208V2.5a1 1 0 0 1 1-1h8ZM5 12.25v3.25a.25.25 0 0 0 .4.2l1.45-1.087a.25.25 0 0 1 .3 0L8.6 15.7a.25.25 0 0 0 .4-.2v-3.25A.25.25 0 0 0 8.75 12h-3.5a.25.25 0 0 0-.25.25Z"></path></svg>
        <a href="${authorUrl}" class="gf-repo-owner">${authorName}</a>
        <span class="gf-repo-divider">/</span>
        <span class="gf-repo-name" title="${scriptName}">${scriptName}</span>
        <span class="gf-repo-badge">Public</span>
    `;

    const repoActions = document.createElement('div');
    repoActions.className = 'gf-repo-actions';
    repoActions.innerHTML = `
        <div class="gf-repo-action-btn">
            <svg class="gf-action-icon" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
            <span class="gf-action-label">Installs</span>
            <span class="gf-action-counter">${totalInstalls}</span>
        </div>
        <div class="gf-repo-action-btn">
            <svg class="gf-action-icon" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
            <span class="gf-action-label">Star</span>
            <span class="gf-action-counter">${goodRatings}</span>
        </div>
    `;

    breadcrumb.appendChild(breadcrumbLeft);
    breadcrumb.appendChild(repoActions);
    gfHeaderInner.appendChild(breadcrumb);

    // Create tabs container
    if (originalTabs) {
        const tabsNav = document.createElement('div');
        tabsNav.className = 'gf-script-tabs-container';

        const tabsUl = document.createElement('ul');
        tabsUl.className = 'gf-script-tabs';

        const iconMap = {
            '信息': `<svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round" class="gf-tab-icon"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>`,
            'Info': `<svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round" class="gf-tab-icon"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>`,
            '代码': `<svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round" class="gf-tab-icon"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>`,
            'Code': `<svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round" class="gf-tab-icon"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>`,
            '历史': `<svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round" class="gf-tab-icon"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>`,
            'History': `<svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round" class="gf-tab-icon"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>`,
            '反馈': `<svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round" class="gf-tab-icon"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>`,
            'Feedback': `<svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round" class="gf-tab-icon"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>`,
            '统计': `<svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round" class="gf-tab-icon"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>`,
            'Stats': `<svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round" class="gf-tab-icon"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>`,
            '相似': `<svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round" class="gf-tab-icon"><line x1="6" y1="3" x2="6" y2="15"/><circle cx="18" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><path d="M18 9a9 9 0 0 1-9 9"/></svg>`,
            'Derivatives': `<svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round" class="gf-tab-icon"><line x1="6" y1="3" x2="6" y2="15"/><circle cx="18" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><path d="M18 9a9 9 0 0 1-9 9"/></svg>`,
            '更新': `<svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round" class="gf-tab-icon"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 1 1 3 3L12 15l-4 1 1-4z"/></svg>`,
            'Admin': `<svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round" class="gf-tab-icon"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>`,
            '管理': `<svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round" class="gf-tab-icon"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>`,
            '删除': `<svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round" class="gf-tab-icon"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>`,
            'Delete': `<svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round" class="gf-tab-icon"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>`
        };

        Array.from(originalTabs.querySelectorAll('li')).forEach(li => {
            const newLi = document.createElement('li');
            newLi.className = li.className;

            const linkOrSpan = li.firstElementChild;
            if (linkOrSpan) {
                const labelText = linkOrSpan.textContent.trim();
                const matchedKey = Object.keys(iconMap).find(key => labelText.includes(key));
                const iconSvg = matchedKey ? iconMap[matchedKey] : '';

                const newEl = document.createElement(linkOrSpan.tagName);
                if (linkOrSpan.tagName === 'A') {
                    newEl.setAttribute('href', linkOrSpan.getAttribute('href'));
                }
                newEl.innerHTML = `${iconSvg}<span>${labelText}</span>`;
                newLi.appendChild(newEl);
            }
            tabsUl.appendChild(newLi);
        });

        tabsNav.appendChild(tabsUl);
        gfHeaderInner.appendChild(tabsNav);
        originalTabs.remove();
    }

    gfHeader.appendChild(gfHeaderInner);

    // Insert sub-header full width after main header
    const mainHeader = document.querySelector('#main-header');
    if (mainHeader) {
        mainHeader.insertAdjacentElement('afterend', gfHeader);
    } else {
        scriptInfo.parentNode.insertBefore(gfHeader, scriptInfo);
    }

    // 3. Create the 2-column Layout
    const isDeletePage = /\/delete\/?$/.test(window.location.pathname);
    const isAdminPage = /\/admin\/?$/.test(window.location.pathname);
    if (isDeletePage || isAdminPage) {
        if (originalHeader) originalHeader.remove();
        return;
    }

    const bodyLayout = document.createElement('div');
    bodyLayout.className = 'gf-script-body-layout';

    const mainCol = document.createElement('div');
    mainCol.className = 'gf-script-main-column';

    const sidebarCol = document.createElement('div');
    sidebarCol.className = 'gf-script-sidebar-column';

    // Move content
    if (scriptContent) {
        const metaBlock = scriptContent.querySelector('.script-meta-block');
        if (metaBlock) {
            sidebarCol.appendChild(metaBlock);
            formatSidebarStats(sidebarCol);
        }

        // Install area goes first
        const installArea = scriptContent.querySelector('#install-area');
        if (installArea) {
            mainCol.appendChild(installArea);
        }

        const originalDesc = originalHeader ? originalHeader.querySelector('p') : null;
        const addInfo = scriptContent.querySelector('#additional-info');
        if (originalDesc && addInfo) {
            const readmeBox = document.createElement('div');
            readmeBox.className = 'gf-readme-box';

            const readmeHeader = document.createElement('div');
            readmeHeader.className = 'gf-readme-header';
            readmeHeader.innerHTML = `
                <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round" class="gf-readme-icon"><line x1="4" y1="9" x2="20" y2="9"/><line x1="4" y1="15" x2="20" y2="15"/><line x1="10" y1="3" x2="8" y2="21"/><line x1="16" y1="3" x2="14" y2="21"/></svg>
                <span>README.md</span>
            `;
            readmeBox.appendChild(readmeHeader);

            const readmeContent = document.createElement('div');
            readmeContent.className = 'gf-readme-content';

            const summaryDesc = document.createElement('div');
            summaryDesc.className = 'gf-readme-summary';
            summaryDesc.textContent = originalDesc.textContent.trim();
            readmeContent.appendChild(summaryDesc);

            readmeContent.appendChild(addInfo);
            readmeBox.appendChild(readmeContent);

            mainCol.appendChild(readmeBox);
        }

        // Move remaining content elements
        Array.from(scriptContent.childNodes).forEach(node => {
            if (node.nodeType === Node.ELEMENT_NODE) {
                if (node.classList.contains('script-meta-block') || node.id === 'additional-info' || node.id === 'install-area') {
                    return;
                }
            }
            mainCol.appendChild(node);
        });

        scriptContent.innerHTML = '';
        bodyLayout.appendChild(mainCol);
        bodyLayout.appendChild(sidebarCol);
        scriptContent.appendChild(bodyLayout);
    }

    if (originalHeader) {
        originalHeader.remove();
    }
}

function formatSidebarStats(sidebarCol) {
    const statsList = sidebarCol.querySelector('#script-stats');
    if (!statsList) return;

    // Parse all metadata rows
    const data = {};
    const dts = Array.from(statsList.querySelectorAll('dt'));
    dts.forEach(dt => {
        const dd = dt.nextElementSibling;
        if (dd && dd.tagName === 'DD') {
            const labelText = dt.textContent.trim();
            // Clone value nodes to preserve inner structure and links
            const originalSpan = dd.firstElementChild || dd;
            const valueClone = originalSpan.cloneNode(true);
            data[labelText] = valueClone;
        }
    });

    // Helper to find key in data (handles multilingual like "作者" / "Author")
    function getValueOf(keys) {
        for (const k of keys) {
            const matchedKey = Object.keys(data).find(key => key.toLowerCase().includes(k.toLowerCase()));
            if (matchedKey) return data[matchedKey];
        }
        return null;
    }

    // Extract stats
    const authorVal = getValueOf(['作者', 'Author']);
    const versionVal = getValueOf(['版本', 'Version']);
    const createdVal = getValueOf(['创建', 'Created']);
    const updatedVal = getValueOf(['更新', 'Updated']);
    const sizeVal = getValueOf(['大小', 'Size']);
    const licenseVal = getValueOf(['许可证', 'License']);
    const appliesVal = getValueOf(['适用', 'Applies']);
    const totalInstallsVal = getValueOf(['总安装', 'Total installs']);
    const dailyInstallsVal = getValueOf(['日安装', 'Daily installs']);
    const ratingsVal = getValueOf(['评分', 'Ratings']);

    // Build the sections
    const container = document.createElement('div');
    container.className = 'gf-sidebar-groups';

    const iconMap = {
        globe: `<svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none" class="gf-sidebar-icon"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>`,
        license: `<svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none" class="gf-sidebar-icon"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>`,
        file: `<svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none" class="gf-sidebar-icon"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>`,
        download: `<svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none" class="gf-sidebar-icon"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>`,
        star: `<svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none" class="gf-sidebar-icon"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>`,
        tag: `<svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none" class="gf-sidebar-icon"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg>`,
        user: `<svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none" class="gf-sidebar-icon"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>`
    };

    // 1. About section
    const aboutSec = document.createElement('div');
    aboutSec.className = 'gf-sidebar-section';
    aboutSec.innerHTML = `<h3>About</h3>`;

    if (appliesVal) {
        const row = createSidebarRow(iconMap.globe, '适用于', appliesVal);
        aboutSec.appendChild(row);
    }
    if (licenseVal) {
        const row = createSidebarRow(iconMap.license, '许可证', licenseVal);
        aboutSec.appendChild(row);
    }
    if (sizeVal) {
        const row = createSidebarRow(iconMap.file, '大小', sizeVal);
        aboutSec.appendChild(row);
    }
    if (totalInstallsVal) {
        const row = createSidebarRow(iconMap.download, '总安装量', totalInstallsVal);
        if (dailyInstallsVal) {
            const span = document.createElement('span');
            span.className = 'gf-sidebar-subtext';
            span.textContent = ` (本日: ${dailyInstallsVal.textContent.trim()})`;
            row.querySelector('.gf-sidebar-value').appendChild(span);
        }
        aboutSec.appendChild(row);
    }
    if (ratingsVal) {
        const row = createSidebarRow(iconMap.star, '评分', ratingsVal);
        aboutSec.appendChild(row);
    }
    container.appendChild(aboutSec);

    // 2. Releases section
    if (versionVal) {
        const releasesSec = document.createElement('div');
        releasesSec.className = 'gf-sidebar-section';
        releasesSec.innerHTML = `<h3>Releases</h3>`;

        const row = document.createElement('div');
        row.className = 'gf-sidebar-row gf-release-row';
        row.innerHTML = `
            ${iconMap.tag}
            <a href="#" class="gf-release-link">v${versionVal.textContent.trim()}</a>
            <span class="gf-release-latest">Latest</span>
        `;
        releasesSec.appendChild(row);

        // Hijack click to trigger install link
        const releaseLink = row.querySelector('.gf-release-link');
        if (releaseLink) {
            releaseLink.addEventListener('click', (e) => {
                e.preventDefault();
                const installBtn = document.querySelector('#install-area a.install-link');
                if (installBtn) {
                    installBtn.click();
                }
            });
        }

        if (updatedVal || createdVal) {
            const timeSub = document.createElement('div');
            timeSub.className = 'gf-release-subtext';
            const updatedText = updatedVal ? updatedVal.textContent.trim() : (createdVal ? createdVal.textContent.trim() : '');
            timeSub.textContent = `更新于: ${updatedText}`;
            releasesSec.appendChild(timeSub);
        }

        container.appendChild(releasesSec);
    }

    // 3. Contributors section
    if (authorVal) {
        const contribSec = document.createElement('div');
        contribSec.className = 'gf-sidebar-section';
        contribSec.innerHTML = `<h3>Contributors</h3>`;

        const list = document.createElement('div');
        list.className = 'gf-contributors-list';

        const row = document.createElement('div');
        row.className = 'gf-contributor-item';

        const avatarLink = authorVal.querySelector('a') || authorVal;
        const name = authorVal.textContent.trim();
        const url = avatarLink.tagName === 'A' ? avatarLink.getAttribute('href') : '#';

        row.innerHTML = `
            <a href="${url}" class="gf-contributor-link">
                ${iconMap.user}
                <span class="gf-contributor-name">${name}</span>
            </a>
        `;
        list.appendChild(row);
        contribSec.appendChild(list);
        container.appendChild(contribSec);
    }

    statsList.innerHTML = '';
    statsList.appendChild(container);
}

function createSidebarRow(iconSvg, label, valueNode) {
    const row = document.createElement('div');
    row.className = 'gf-sidebar-row';

    const labelSpan = document.createElement('span');
    labelSpan.className = 'gf-sidebar-label';
    labelSpan.textContent = label + ': ';

    const valueSpan = document.createElement('span');
    valueSpan.className = 'gf-sidebar-value';
    valueSpan.appendChild(valueNode);

    row.innerHTML = iconSvg;
    row.appendChild(labelSpan);
    row.appendChild(valueSpan);
    return row;
}

function setupVersionsPage() {
    const isVersionsPage = window.location.pathname.endsWith('/versions');
    if (!isVersionsPage) return;

    const historyUl = document.querySelector('ul.history_versions');
    if (!historyUl || historyUl.classList.contains('gf-reconstructed')) return;

    document.body.classList.add('gf-versions-page');
    historyUl.classList.add('gf-reconstructed');

    const lis = Array.from(historyUl.querySelectorAll('li'));
    lis.forEach((li, idx) => {
        const diffControls = li.querySelector('.diff-controls');
        const versionNumEl = li.querySelector('.version-number');
        const versionDateEl = li.querySelector('.version-date');
        const changelogEl = li.querySelector('.version-changelog');

        let versionText = 'v0.0.0';
        let versionHref = '#';
        let deleteLinkHTML = '';
        if (versionNumEl) {
            const a = versionNumEl.querySelector('a');
            if (a) {
                versionText = a.textContent.trim().replace(/^版本\s*/, 'v').replace(/^Version\s*/, 'v');
                versionHref = a.getAttribute('href');
            }
            const del = versionNumEl.querySelector('a[data-method="delete"]') || Array.from(versionNumEl.querySelectorAll('a')).find(a => a.textContent.includes('Delete') || a.textContent.includes('删除'));
            if (del) {
                deleteLinkHTML = `<a href="${del.getAttribute('href')}" class="gf-release-delete-btn" title="Delete release">${del.textContent.trim()}</a>`;
            }
        }

        let dateText = 'Unknown date';
        if (versionDateEl) {
            dateText = versionDateEl.textContent.trim();
        }

        let changelogHTML = '<p class="gf-no-changelog">No release notes provided.</p>';
        if (changelogEl) {
            changelogHTML = changelogEl.innerHTML;
        }

        const isLatestBadge = (idx === 0) ? '<span class="gf-release-latest">Latest</span>' : '';

        let diffRadioHTML = '';
        if (diffControls) {
            diffRadioHTML = `
                <div class="gf-release-diff-select">
                    <span class="gf-diff-select-label">Compare:</span>
                    ${diffControls.innerHTML}
                </div>
            `;
        }

        li.innerHTML = `
            <div class="gf-release-sidebar">
                <div class="gf-release-date" title="${dateText}">${dateText}</div>
                <div class="gf-release-timeline-node">
                    <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none" class="gf-tag-icon"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg>
                </div>
            </div>
            <div class="gf-release-main-card">
                <div class="gf-release-card-header">
                    <div class="gf-release-header-left">
                        <a href="${versionHref}" class="gf-release-version-title">${versionText}</a>
                        ${isLatestBadge}
                    </div>
                    <div class="gf-release-header-right">
                        ${diffRadioHTML}
                        ${deleteLinkHTML}
                    </div>
                </div>
                <div class="gf-release-card-body">
                    <div class="markdown-body">
                        ${changelogHTML}
                    </div>
                </div>
                <div class="gf-release-card-footer">
                    <h4 class="gf-assets-title">Assets</h4>
                    <div class="gf-assets-list">
                        <a href="${versionHref}" class="gf-asset-item">
                            <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round" class="gf-asset-icon"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                            <span class="gf-asset-name">Source Code / Install Version</span>
                        </a>
                    </div>
                </div>
            </div>
        `;
    });
}
