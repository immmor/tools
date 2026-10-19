/**
 * 网站导览（产品分步介绍）模块
 * 由客服助手触发：客服悬浮头像会移动到每个区域逐步讲解；
 * 对“可点击”的区域（按钮 / 卡片），指针会移动到目标并【真实点击】，把里面的
 * 下拉菜单或弹窗内容展示出来；纯介绍性的区域只移动头像、指针不出现也不点击。
 *
 * 元素定位与文案集中在本文件：STEPS 定义要介绍的 DOM 选择器、多语言文案，
 * 以及 click（是否需要指针点击）/ kind（点击后内容的类型，用于展示与清理）。
 */
(function () {
    'use strict';

    // ===== 多语言 UI 文案 =====
    const UI = {
        'zh-CN': { name: '客服', skip: '跳过', prev: '上一步', next: '下一步', finish: '完成' },
        'en-US': { name: 'Support', skip: 'Skip', prev: 'Back', next: 'Next', finish: 'Done' }
    };
    const ui = (k) => (UI[window.currentLang] || UI['zh-CN'])[k] || UI['zh-CN'][k];
    const txt = (o) => (o && (o[window.currentLang] || o['zh-CN'])) || '';

    // ===== 步骤定义 =====
    // click: 该步骤是否需要指针去真实点击（true 时指针出现并点击；false 时仅头像移动）
    // kind:  'link'    打开新标签页
    //        'dropdown' 点击展开下拉（离开时再次点击收起）
    //        'toggle'   点击切换状态（离开时再次点击还原，如主题）
    //        'modal'    点击打开弹窗（离开时隐藏弹窗）
    const STEPS = [
        {
            sel: '#tour-nav', click: false,
            t: { 'zh-CN': '顶部导航栏', 'en-US': 'Top Navigation' },
            d: {
                'zh-CN': '顶部导航栏：右侧集中了几个常用入口，下面逐个为你介绍——安装教程、语言、主题与通知。',
                'en-US': 'Top navigation: the right side gathers a few shortcuts. Let me walk you through them — Install, Language, Theme and Notifications.'
            }
        },
        {
            sel: '#tour-install', click: true, kind: 'link', noClick: true,
            t: { 'zh-CN': '安装教程入口', 'en-US': 'Install Guide' },
            d: {
                'zh-CN': '「安装」：点击跳转到客户端安装教程页，按平台（Windows / Android / iOS / macOS / Linux）下载并配置 PHANTOM 客户端。',
                'en-US': '"Install": jump to the client setup guide and download & configure PHANTOM for your platform (Windows / Android / iOS / macOS / Linux).'
            }
        },
        {
            sel: '#lang-btn', click: true, kind: 'dropdown',
            t: { 'zh-CN': '语言切换', 'en-US': 'Language' },
            d: {
                'zh-CN': '「语言」：点击展开语言菜单，支持简体中文、English、한국어、العربية、Русский、Español、日本語、Tiếng Việt 一键切换。',
                'en-US': '"Language": open the menu to switch between 简体中文, English, 한국어, العربية, Русский, Español, 日本語, Tiếng Việt.'
            }
        },
        {
            sel: '#theme-toggle-btn', click: true, kind: 'toggle',
            t: { 'zh-CN': '主题切换', 'en-US': 'Theme' },
            d: {
                'zh-CN': '「主题」：点击在深色 / 浅色界面之间切换，跟随你的使用习惯与时段。',
                'en-US': '"Theme": toggle between dark and light UI to match your preference and time of day.'
            }
        },
        {
            sel: '#notification-btn', click: true, kind: 'dropdown',
            t: { 'zh-CN': '系统通知', 'en-US': 'Notifications' },
            d: {
                'zh-CN': '「通知」：点击查看活动、福利与系统消息；未读时按钮上会有红点提示，点开后底部还能「联系客服」。',
                'en-US': '"Notifications": view campaigns, perks and system messages; a red dot marks unread items, and you can also "Contact support" from there.'
            }
        },
        {
            sel: '#tour-hero', click: false,
            t: { 'zh-CN': '品牌主视觉与使用流程', 'en-US': 'Hero & Quick Start' },
            d: {
                'zh-CN': '品牌主视觉展示核心主张「安全 · 稳定 · 高速」。下方是使用流程：登录注册 → 购买节点 → 安装客户端 → 导入节点，跟着指引即可快速上手。',
                'en-US': 'The hero shows our slogan "Safe · Stable · Fast". Below is the quick-start flow: Sign up → Buy a plan → Install client → Import nodes.'
            }
        },
        {
            sel: '#tour-free', click: true, kind: 'modal',
            t: { 'zh-CN': '免费节点包', 'en-US': 'Free Node Pack' },
            d: {
                'zh-CN': '免费节点包：零门槛体验，点击即可领取免费节点，先试用再决定是否升级。',
                'en-US': 'Free node pack: try the service for free with zero cost before upgrading.'
            }
        },
        {
            sel: '#tour-monthly', click: true, kind: 'modal',
            t: { 'zh-CN': '月付节点包', 'en-US': 'Monthly Plan' },
            d: {
                'zh-CN': '月付节点包：按月付费，限时折扣中，适合短期或初次体验的用户，随时可续费。',
                'en-US': 'Monthly plan: pay monthly with a limited-time discount — ideal for short-term or first-time users.'
            }
        },
        {
            sel: '#tour-annual', click: true, kind: 'modal',
            t: { 'zh-CN': '年付节点包', 'en-US': 'Yearly Plan' },
            d: {
                'zh-CN': '年付节点包：一次性购买一年，立省更多，长期使用的性价比之选。',
                'en-US': 'Yearly plan: one purchase covers a full year with the best savings — great for long-term use.'
            }
        },
        {
            sel: '#tour-custom', click: true, kind: 'modal',
            t: { 'zh-CN': '定制节点', 'en-US': 'Custom Nodes' },
            d: {
                'zh-CN': '定制节点：若对节点有专属需求（特定地区、独享带宽等），可联系我们定制方案，价格详谈。',
                'en-US': 'Custom nodes: need a dedicated region or bandwidth? Contact us for a tailored plan.'
            }
        },
        {
            sel: '#game-section', click: false,
            t: { 'zh-CN': '游戏中心', 'en-US': 'Game Center' },
            d: {
                'zh-CN': '游戏中心：每日签到、幸运转盘、老虎机等小游戏，玩游戏赢取福利与节点时长，边玩边省。',
                'en-US': 'Game center: daily check-in, lucky wheel, slots and more — play to earn perks and node time.'
            }
        },
        {
            sel: '#tour-nodes', click: false,
            t: { 'zh-CN': '热门节点分布', 'en-US': 'Popular Nodes' },
            d: {
                'zh-CN': '热门节点：覆盖美国、日本、新加坡等 10+ 国家和地区，高速稳定，就近选择延迟更低。',
                'en-US': 'Popular nodes: 10+ countries & regions including US, Japan, Singapore — pick the nearest for lower latency.'
            }
        },
        {
            sel: '#tour-compare', click: false,
            t: { 'zh-CN': '为什么选择 PHANTOM', 'en-US': 'Why PHANTOM' },
            d: {
                'zh-CN': '为什么选择 PHANTOM：这里对比我们的核心优势——十年老品牌、隐私保护、多协议支持、稳定高速。',
                'en-US': 'Why PHANTOM: our core advantages — 10-year brand, privacy protection, multi-protocol support, stable & fast.'
            }
        },
        {
            sel: '#tour-testimonials', click: false,
            t: { 'zh-CN': '客户评价', 'en-US': 'Testimonials' },
            d: {
                'zh-CN': '客户评价：来自全球用户的真实反馈，看看大家为什么选择并推荐 PHANTOM。',
                'en-US': 'Testimonials: real feedback from users worldwide on why they choose and recommend PHANTOM.'
            }
        }
    ];

    // ===== 样式（注入一次）=====
    const STYLE = `
#tour-highlight{position:fixed;z-index:9991;pointer-events:none;border-radius:16px;
  box-shadow:0 0 0 9999px rgba(0,0,0,.72), 0 0 0 3px var(--neon-blue), 0 0 22px rgba(0,170,255,.55);
  transition:left .5s cubic-bezier(.22,1,.36,1), top .5s cubic-bezier(.22,1,.36,1), width .5s cubic-bezier(.22,1,.36,1), height .5s cubic-bezier(.22,1,.36,1);
  animation:tourPulse 1.8s ease-in-out infinite;}
@keyframes tourPulse{0%,100%{box-shadow:0 0 0 9999px rgba(0,0,0,.72),0 0 0 3px var(--neon-blue),0 0 16px rgba(0,170,255,.45);}
  50%{box-shadow:0 0 0 9999px rgba(0,0,0,.72),0 0 0 3px var(--neon-green),0 0 30px rgba(0,255,65,.55);}}
#tour-guide{position:fixed;z-index:10001;width:300px;max-width:86vw;background:#16161af2;border:1px solid rgba(0,170,255,.45);
  border-radius:16px;box-shadow:0 14px 44px rgba(0,0,0,.55);padding:14px;color:#fff;font-family:inherit;
  transition:left .5s cubic-bezier(.22,1,.36,1), top .5s cubic-bezier(.22,1,.36,1), opacity .3s ease, transform .3s ease;
  opacity:0;transform:scale(.92);}
#tour-guide.show{opacity:1;transform:scale(1);}
#tour-arrow{position:absolute;width:0;height:0;}
#tour-arrow.a-left{right:100%;border-top:8px solid transparent;border-bottom:8px solid transparent;border-right:10px solid #16161af2;}
#tour-arrow.a-right{left:100%;border-top:8px solid transparent;border-bottom:8px solid transparent;border-left:10px solid #16161af2;}
#tour-arrow.a-top{bottom:100%;border-left:8px solid transparent;border-right:8px solid transparent;border-bottom:10px solid #16161af2;}
#tour-arrow.a-bottom{top:100%;border-left:8px solid transparent;border-right:8px solid transparent;border-top:10px solid #16161af2;}
.tg-head{display:flex;align-items:center;gap:10px;margin-bottom:10px;}
.tg-avatar{width:36px;height:36px;border-radius:50%;object-fit:cover;flex-shrink:0;box-shadow:0 0 0 2px var(--neon-blue);}
.tg-name{font-weight:800;font-size:14px;line-height:1.1;}
.tg-step{font-size:11px;color:var(--neon-blue);opacity:.85;margin-top:2px;}
.tg-title{font-weight:800;font-size:15px;margin-bottom:6px;color:#fff;}
.tg-desc{font-size:13px;line-height:1.6;color:#d4d4d8;margin-bottom:12px;}
.tg-actions{display:flex;align-items:center;justify-content:space-between;gap:8px;}
.tg-nav{display:flex;gap:8px;margin-left:auto;}
.tg-btn{font-size:12px;font-weight:700;padding:7px 12px;border-radius:9px;border:1px solid #3f3f46;background:#27272a;color:#e4e4e7;cursor:pointer;transition:all .15s;}
.tg-btn:hover{background:#3f3f46;}
.tg-btn.primary{background:var(--neon-blue);color:#000;border-color:transparent;}
.tg-btn.primary:hover{opacity:.9;}
.tg-btn:disabled{opacity:.4;cursor:not-allowed;}
.tg-skip{font-size:12px;color:#a1a1aa;background:none;border:none;cursor:pointer;text-decoration:underline;padding:4px;}
#tour-pointer{position:fixed;z-index:10002;width:32px;height:32px;pointer-events:none;
  transition:left .5s cubic-bezier(.22,1,.36,1), top .5s cubic-bezier(.22,1,.36,1), transform .12s ease;
  transform:translate(-4px,-3px);filter:drop-shadow(0 0 6px rgba(0,232,245,.9)) drop-shadow(0 1px 2px rgba(0,0,0,.45));display:none;}
#tour-pointer img{width:100%;height:100%;object-fit:contain;display:block;}
#tour-pointer.tap{transform:translate(-4px,-3px) scale(.82);}
#tour-click-ring{position:fixed;z-index:10003;width:28px;height:28px;border-radius:50%;border:3px solid var(--neon-green);
  pointer-events:none;transform:translate(-50%,-50%) scale(.3);opacity:0;display:none;}
#tour-click-ring.go{animation:tourClick .6s ease-out;}
@keyframes tourClick{0%{opacity:.9;transform:translate(-50%,-50%) scale(.3);}100%{opacity:0;transform:translate(-50%,-50%) scale(2.6);}}
`;

    // ===== 状态 =====
    let active = false;
    let idx = 0;
    let dom = null;
    let rafPending = false;
    let activeEl = null;
    let activeStep = null;
    let revealed = []; // 本步骤因点击而提升层级 / 打开的内容，用于离开时清理
    let clickTimer = null; // 指针移动到目标后的真实点击（延时，避免“瞬间点完”）
    let popObserver = null; // 监听 DOM，捕获异步插入的弹窗（如 VIP 先查状态再弹窗）
    const bound = { scroll: null, resize: null, key: null };

    // ===== DOM 构建 =====
    function buildDom() {
        if (dom) return dom;

        const style = document.createElement('style');
        style.textContent = STYLE;
        document.head.appendChild(style);

        const highlight = document.createElement('div');
        highlight.id = 'tour-highlight';
        highlight.style.display = 'none';

        const pointer = document.createElement('div');
        pointer.id = 'tour-pointer';
        pointer.innerHTML = '<img src="static/phantom-cursor.svg" alt="">';

        const clickRing = document.createElement('div');
        clickRing.id = 'tour-click-ring';

        const guide = document.createElement('div');
        guide.id = 'tour-guide';
        guide.innerHTML = `
            <div id="tour-arrow"></div>
            <div class="tg-head">
                <img class="tg-avatar" src="static/cs1.webp" alt="客服">
                <div>
                    <div class="tg-name"></div>
                    <div class="tg-step"></div>
                </div>
            </div>
            <div class="tg-title"></div>
            <div class="tg-desc"></div>
            <div class="tg-actions">
                <button class="tg-skip" id="tour-skip"></button>
                <div class="tg-nav">
                    <button class="tg-btn" id="tour-prev"></button>
                    <button class="tg-btn primary" id="tour-next"></button>
                </div>
            </div>`;

        document.body.appendChild(highlight);
        document.body.appendChild(pointer);
        document.body.appendChild(clickRing);
        document.body.appendChild(guide);

        dom = {
            highlight, pointer, clickRing, guide,
            arrow: guide.querySelector('#tour-arrow'),
            name: guide.querySelector('.tg-name'),
            step: guide.querySelector('.tg-step'),
            title: guide.querySelector('.tg-title'),
            desc: guide.querySelector('.tg-desc'),
            skip: guide.querySelector('#tour-skip'),
            prev: guide.querySelector('#tour-prev'),
            next: guide.querySelector('#tour-next')
        };

        dom.name.textContent = ui('name');
        dom.skip.textContent = ui('skip');
        dom.prev.textContent = ui('prev');
        dom.next.textContent = ui('next');

        dom.skip.addEventListener('click', finish);
        dom.prev.addEventListener('click', () => goTo(idx - 1));
        dom.next.addEventListener('click', () => {
            if (idx >= STEPS.length - 1) finish();
            else goTo(idx + 1);
        });

        return dom;
    }

    // ===== 定位与布局 =====
    const clamp = (v, min, max) => Math.max(min, Math.min(max, v));

    function chooseSide(rect) {
        const vw = window.innerWidth, vh = window.innerHeight;
        const w = dom.guide.offsetWidth || 300;
        const h = dom.guide.offsetHeight || 220;
        if (rect.right + w + 44 <= vw) return 'right';
        if (rect.left - w - 44 >= 0) return 'left';
        if (rect.bottom + h + 44 <= vh) return 'bottom';
        if (rect.top - h - 44 >= 0) return 'top';
        return 'right';
    }

    function placeGuide(rect, side) {
        const g = dom.guide;
        const w = g.offsetWidth, h = g.offsetHeight;
        let left, top;
        if (side === 'right') { left = rect.right + 18; top = rect.top; }
        else if (side === 'left') { left = rect.left - w - 18; top = rect.top; }
        else if (side === 'bottom') { left = rect.left; top = rect.bottom + 18; }
        else { left = rect.left; top = rect.top - h - 18; }
        left = clamp(left, 12, window.innerWidth - w - 12);
        top = clamp(top, 12, window.innerHeight - h - 12);
        g.style.left = left + 'px';
        g.style.top = top + 'px';

        const a = dom.arrow;
        a.className = '';
        a.style.top = ''; a.style.left = '';
        if (side === 'right') { a.classList.add('a-left'); a.style.top = (rect.top + rect.height / 2 - top - 8) + 'px'; }
        else if (side === 'left') { a.classList.add('a-right'); a.style.top = (rect.top + rect.height / 2 - top - 8) + 'px'; }
        else if (side === 'bottom') { a.classList.add('a-top'); a.style.left = (rect.left + rect.width / 2 - left - 8) + 'px'; }
        else { a.classList.add('a-bottom'); a.style.left = (rect.left + rect.width / 2 - left - 8) + 'px'; }
    }

    function positionAll() {
        const step = STEPS[idx];
        const el = document.querySelector(step.sel);
        if (!el) return;
        const rect = el.getBoundingClientRect();
        const pad = 6;

        dom.highlight.style.left = (rect.left - pad) + 'px';
        dom.highlight.style.top = (rect.top - pad) + 'px';
        dom.highlight.style.width = (rect.width + pad * 2) + 'px';
        dom.highlight.style.height = (rect.height + pad * 2) + 'px';

        placeGuide(rect, chooseSide(rect));

        // 指针仅在“需要点击”的步骤出现并移动到目标中心
        if (step.click) {
            // 尖角落在元素右下角（略内移），指针从右下角“指”向元素
            const cx = rect.right - 6;
            const cy = rect.bottom - 6;
            dom.pointer.style.display = 'block';
            dom.pointer.style.left = cx + 'px';
            dom.pointer.style.top = cy + 'px';
        } else {
            dom.pointer.style.display = 'none';
        }
    }

    function isInView(el) {
        const r = el.getBoundingClientRect();
        const m = 80;
        return r.top >= -m && r.bottom <= window.innerHeight + m &&
               r.left >= -m && r.right <= window.innerWidth + m;
    }

    // ===== 真实点击：展示目标里的内容 =====
    // 找到当前可见的弹层（下拉 / 弹窗）
    function isVisible(n) {
        const cs = getComputedStyle(n);
        const r = n.getBoundingClientRect();
        // 注意：fixed 定位元素 offsetParent 为 null，故用计算样式 + 包围盒判断可见性
        return cs.display !== 'none' && cs.visibility !== 'hidden' && r.width > 0 && r.height > 0;
    }
    function popovers() {
        const out = [];
        document.querySelectorAll('.dropdown-menu, [id$="-modal"], [id$="-dropdown"]').forEach(n => {
            if (n.closest('#tour-guide') || n.id === 'tour-highlight') return;
            if (isVisible(n)) out.push(n);
        });
        return out;
    }
    // 把弹层提升到导览遮罩之上：找到其最近的“带 z-index 的堆叠上下文祖先”一并提升
    function raiseFor(node) {
        let el = node;
        while (el && el !== document.body) {
            const z = getComputedStyle(el).zIndex;
            if (z !== 'auto' && z !== '') {
                if (el._tourZ === undefined) el._tourZ = el.style.zIndex;
                el.style.zIndex = '10000';
                return el;
            }
            el = el.parentElement;
        }
        if (node._tourZ === undefined) node._tourZ = node.style.zIndex;
        node.style.zIndex = '10000';
        return node;
    }
    // 关闭弹窗：优先点弹窗自带的关闭按钮（与站点原生关闭一致），否则直接移除
    function closeModal(node) {
        const btn = node.querySelector('[onclick*=".remove()"]') ||
                    node.querySelector('[id$="-close"]') ||
                    node.querySelector('[onclick*="hidden"]') ||
                    node.querySelector('button');
        if (btn) btn.click();
        else node.remove();
    }
    // 监听 DOM：VIP 等异步插入的弹窗一出现就登记并提升（避免点击瞬间漏抓）
    function startObserver() {
        if (popObserver) return;
        popObserver = new MutationObserver(muts => {
            for (const m of muts) {
                m.addedNodes.forEach(node => {
                    if (node.nodeType !== 1) return;
                    const found = [];
                    if (node.matches && node.matches('.dropdown-menu, [id$="-modal"], [id$="-dropdown"]')) found.push(node);
                    node.querySelectorAll('.dropdown-menu, [id$="-modal"], [id$="-dropdown"]').forEach(n => found.push(n));
                    found.forEach(n => {
                        if (n.closest('#tour-guide') || n.id === 'tour-highlight') return;
                        if (revealed.some(r => r.node === n)) return;
                        if (!isVisible(n)) return;
                        revealed.push({ node: n, anchor: raiseFor(n) });
                    });
                });
            }
        });
        popObserver.observe(document.body, { childList: true, subtree: true });
    }
    function stopObserver() {
        if (popObserver) { popObserver.disconnect(); popObserver = null; }
    }

    // 指针“按下”视觉反馈 + 点击涟漪
    function pointerPress() {
        if (!dom) return;
        dom.pointer.classList.add('tap');
        dom.clickRing.style.display = 'block';
        dom.clickRing.style.left = dom.pointer.style.left;
        dom.clickRing.style.top = dom.pointer.style.top;
        dom.clickRing.classList.remove('go');
        void dom.clickRing.offsetWidth;
        dom.clickRing.classList.add('go');
        setTimeout(() => dom.pointer.classList.remove('tap'), 160);
    }

    function captureNew(before) {
        popovers().forEach(n => {
            if (!before.has(n)) revealed.push({ node: n, anchor: raiseFor(n) });
        });
    }

    function interact(el, step) {
        // 先让指针飞到目标，短暂停顿后再“按下”真实点击，做到点一步演示一步、更顺滑
        if (clickTimer) clearTimeout(clickTimer);
        clickTimer = setTimeout(() => {
            pointerPress();
            if (step.kind === 'link') {
                // 安装等入口：只演示“指过去”，不真正打开新标签页
                if (!step.noClick && el.href) window.open(el.href, '_blank', 'noopener');
                return;
            }
            const before = new Set(popovers());
            el.click();
            captureNew(before); // 同步打开的（免费节点、下拉）立即登记；异步的（VIP）由 MutationObserver 捕获
        }, 550);
    }

    // 离开某步：收起下拉 / 隐藏弹窗 / 还原切换状态 / 还原被提升的层级
    function leaveStep(el, step) {
        if (!el || !step) return;
        if (step.kind === 'link') return;
        if (step.kind === 'dropdown' || step.kind === 'toggle') {
            el.click(); // 再次点击：收起下拉 / 还原主题
        } else if (step.kind === 'modal') {
            // 直接点击弹窗自带的关闭按钮（与站点原生关闭逻辑一致），点不到再移除
            revealed.forEach(r => { closeModal(r.node); });
        }
        revealed.forEach(r => { if (r.anchor && r.anchor !== el) r.anchor.style.zIndex = r.anchor._tourZ ?? ''; });
        revealed = [];
    }

    // ===== 步骤切换 =====
    function goTo(i) {
        if (i < 0 || i >= STEPS.length) return;
        if (clickTimer) clearTimeout(clickTimer);
        leaveStep(activeEl, activeStep); // 清理上一步

        idx = i;
        const step = STEPS[idx];
        const el = document.querySelector(step.sel);
        if (!el) { finish(); return; }

        activeEl = el; activeStep = step;

        dom.name.textContent = ui('name');
        dom.skip.textContent = ui('skip');
        dom.prev.textContent = ui('prev');
        dom.next.textContent = idx >= STEPS.length - 1 ? ui('finish') : ui('next');
        dom.title.textContent = txt(step.t);
        dom.desc.textContent = txt(step.d);
        dom.step.textContent = `第 ${idx + 1} / ${STEPS.length} 步`;
        dom.prev.disabled = idx === 0;

        if (!isInView(el)) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        positionAll();

        if (step.click) interact(el, step);
    }

    // ===== 启动 / 结束 =====
    function start() {
        if (active) return;
        buildDom();
        active = true;
        startObserver();
        idx = 0;
        activeEl = null; activeStep = null;

        [dom.highlight].forEach(e => e.style.display = 'block');
        dom.guide.style.display = '';
        requestAnimationFrame(() => dom.guide.classList.add('show'));

        bound.scroll = () => {
            if (rafPending) return;
            rafPending = true;
            requestAnimationFrame(() => { rafPending = false; positionAll(); });
        };
        bound.resize = bound.scroll;
        bound.key = (e) => { if (e.key === 'Escape') finish(); };
        window.addEventListener('scroll', bound.scroll, true);
        window.addEventListener('resize', bound.resize);
        window.addEventListener('keydown', bound.key);

        goTo(0);
    }

    function finish() {
        if (!active) return;
        active = false;
        stopObserver();
        if (clickTimer) clearTimeout(clickTimer);
        leaveStep(activeEl, activeStep);
        // 兜底：若上一步弹窗是异步打开、尚未被登记，结束导览时一并移除
        setTimeout(() => {
            document.querySelectorAll('[id$="-modal"]').forEach(n => {
                const cs = getComputedStyle(n);
                const r = n.getBoundingClientRect();
                if (cs.display !== 'none' && cs.visibility !== 'hidden' && r.width > 0 && r.height > 0) n.remove();
            });
        }, 700);
        activeEl = null; activeStep = null;
        if (dom) {
            dom.guide.classList.remove('show');
            dom.highlight.style.display = 'none';
            dom.pointer.style.display = 'none';
            dom.clickRing.style.display = 'none';
            setTimeout(() => { if (dom) dom.guide.style.display = 'none'; }, 300);
        }
        window.removeEventListener('scroll', bound.scroll, true);
        window.removeEventListener('resize', bound.resize);
        window.removeEventListener('keydown', bound.key);
    }

    // ===== 触发入口：客服弹窗里的“网站导览”按钮 =====
    document.addEventListener('DOMContentLoaded', () => {
        const btn = document.getElementById('tour-start-btn');
        if (btn) {
            btn.addEventListener('click', () => {
                if (typeof window.SupportModule !== 'undefined') window.SupportModule.close();
                start();
            });
        }
    });

    window.TourModule = { start, stop: finish };
})();
