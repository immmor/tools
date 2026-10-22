// 邮箱 OCR 识别（登录/注册界面）
// 用法：点击邮箱框旁的相机按钮 → 选择「拍照」或「从相册选择」→ Tesseract.js 识别图片中的邮箱并回填。
// 模型：Tesseract.js v5（浏览器端 WASM，语言包 eng 自动从 CDN 拉取）。
(function () {
  const $ = (id) => document.getElementById(id);
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const t = (key, fallback) => {
    const dict = (window.translations && window.currentLang && window.translations[window.currentLang]) || {};
    return (key in dict && dict[key]) ? dict[key] : fallback;
  };
  const TESSERACT_SRC = 'https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js';

  function loadScript(src) {
    return new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = src;
      s.onload = resolve;
      s.onerror = () => reject(new Error('OCR 脚本加载失败: ' + src));
      document.head.appendChild(s);
    });
  }

  // ---- OCR 引擎（懒加载，单例） ----
  let ocrReady = false, ocrLoading = false, worker = null;

  async function ensureOCR() {
    if (ocrReady) return;
    if (ocrLoading) { while (!ocrReady) await wait(80); return; }
    ocrLoading = true;
    try {
      if (typeof Tesseract === 'undefined') await loadScript(TESSERACT_SRC);
      worker = await Tesseract.createWorker('eng'); // 邮箱为拉丁字符，eng 足够
      ocrReady = true;
    } finally {
      ocrLoading = false;
    }
  }

  async function recognize(file) {
    await ensureOCR();
    const { data: { text } } = await worker.recognize(file);
    const rawMatches = text.match(/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi) || [];
    // 域名后缀容错修正 + 去重（修正后相同后缀会被合并，避免 gmail.com 与 gmai1.com 重复列出）
    const emails = [...new Set(rawMatches.map((s) => optimizeEmail(s)))];
    return { text, emails };
  }

  // ---- 邮箱后缀容错匹配 ----
  // OCR 常把 q↔g、l↔i、m↔n、u↔v、s↔z、b↔d、c↔e、o↔0 等认错，
  // 这里用“混淆加权编辑距离”：易混淆字母替换代价 0.5，其余 1，在候选后缀里找最接近的一个。
  const CONFUSE = {
    q: 'g', g: 'q',
    o: '0', '0': 'o',
    l: 'i1', i: 'l1', '1': 'il',
    m: 'n', n: 'm',
    u: 'v', v: 'u',
    s: 'z', z: 's',
    b: 'd', d: 'b',
    c: 'e', e: 'c'
  };
  function confused(a, b) { const x = CONFUSE[a]; return !!x && x.indexOf(b) !== -1; }
  function confusionDist(a, b) {
    a = String(a).toLowerCase(); b = String(b).toLowerCase();
    const m = a.length, n = b.length;
    const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
    for (let i = 0; i <= m; i++) dp[i][0] = i;
    for (let j = 0; j <= n; j++) dp[0][j] = j;
    for (let i = 1; i <= m; i++) {
      for (let j = 1; j <= n; j++) {
        const cost = a[i - 1] === b[j - 1] ? 0 : (confused(a[i - 1], b[j - 1]) ? 0.5 : 1);
        dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + cost);
      }
    }
    return dp[m][n];
  }
  function tldOf(d) { const i = d.lastIndexOf('.'); return i < 0 ? '' : d.slice(i + 1); }
  // 在候选后缀里找最接近的一个；偏差（混淆距离）≤1 才采用，否则返回 null
  function matchSuffix(domain, candidates) {
    domain = domain.toLowerCase().replace(/\s+/g, '');
    if (!domain) return null;
    if (candidates.indexOf(domain) !== -1) return domain;
    const ocrTld = tldOf(domain);
    let best = null, bestScore = Infinity;
    for (const c of candidates) {
      // 顶级域（.com/.net/.cn…）偏差过大则跳过，避免跨后缀误匹配
      if (ocrTld && tldOf(c) && confusionDist(ocrTld, tldOf(c)) > 1) continue;
      const d = confusionDist(domain, c);
      if (d < bestScore) { bestScore = d; best = c; }
    }
    return (best && bestScore <= 1) ? best : null;
  }
  // 修正整邮箱里的域名部分（无匹配则返回原串）
  function fixDomainInEmail(e, domainEl) {
    if (!e.includes('@') || !domainEl) return e;
    const at = e.lastIndexOf('@');
    const prefix = e.slice(0, at);
    const d = e.slice(at + 1);
    const opts = [...domainEl.options].map((o) => o.value);
    const candidates = [...new Set(opts.concat(KNOWN_DOMAINS))];
    const m = candidates.indexOf(d) !== -1 ? d : matchSuffix(d, candidates);
    return m ? prefix + '@' + m : e;
  }

  // 常见邮箱后缀白名单（OCR 容错候选池）
  const KNOWN_DOMAINS = ['gmail.com','googlemail.com','qq.com','163.com','126.com','outlook.com','hotmail.com','live.com','yahoo.com','yahoo.com.cn','foxmail.com','sina.com','sina.cn','icloud.com','me.com','139.com','aliyun.com','21cn.com','sohu.com','tom.com','189.cn','yeah.net','msn.com'];

  // 对“整邮箱”做域名后缀容错修正（前缀不动），无匹配返回原串
  function optimizeEmail(raw) {
    if (!raw) return raw;
    const e = String(raw).trim().toLowerCase().replace(/\s+/g, '');
    const at = e.lastIndexOf('@');
    if (at < 1) return e;
    const prefix = e.slice(0, at);
    const d = e.slice(at + 1);
    const domainEl = $('email-domain');
    const opts = domainEl ? [...domainEl.options].map((o) => o.value) : [];
    const candidates = [...new Set(opts.concat(KNOWN_DOMAINS))];
    const fixed = candidates.indexOf(d) !== -1 ? d : matchSuffix(d, candidates);
    return fixed ? prefix + '@' + fixed : e;
  }

  // 相机是否可用（用于决定是否显示「拍照」选项）
  function cameraSupported() {
    return !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
  }

  // 同步后缀镜像文字宽度（等同 auth 内 syncDomainWidth，避免 OCR 回填后后缀显示异常）
  function syncDomainMirror(domain) {
    const mirror = $('email-domain-mirror');
    if (mirror && domain) mirror.textContent = domain.options[domain.selectedIndex].text;
  }

  // ---- 把识别出的邮箱回填到邮箱框 ----
  // 登录模式：不拆分、不显示后缀，整邮箱填入输入框（登录框不允许出现后缀拆分）
  // 注册模式：拆分 前缀+域名，并展开后缀选择框（允许手动切换后缀）
  function fillEmail(rawEmail) {
    const user = $('username');
    const domain = $('email-domain');
    const wrap = $('email-domain-wrapper');
    const modal = $('auth-modal');
    if (!user || !rawEmail) return;
    const e = rawEmail.trim().toLowerCase();
    const isRegister = modal && modal.classList.contains('mode-register');

    if (!isRegister) {
      // 登录：整邮箱填入，确保后缀保持隐藏；同时对域名做容错修正
      user.value = fixDomainInEmail(e, domain);
      if (wrap) wrap.classList.add('hidden');
      if (domain) domain.disabled = false;
    } else if (e.includes('@')) {
      const at = e.lastIndexOf('@');
      const prefix = e.slice(0, at);
      const d = e.slice(at + 1);
      // 候选后缀 = 下拉选项 + 常见邮箱后缀，保证即使选项里没有也能容错匹配
      const opts = domain ? [...domain.options].map((o) => o.value) : [];
      const candidates = [...new Set(opts.concat(KNOWN_DOMAINS))];
      const matched = candidates.indexOf(d) !== -1 ? d : (candidates.length ? matchSuffix(d, candidates) : null);
      if (matched) {
        user.value = prefix;
        if (domain) { domain.value = matched; domain.disabled = false; } // OCR 识别的邮箱允许手动切换后缀
        if (wrap) wrap.classList.remove('hidden');
        syncDomainMirror(domain);
      } else {
        user.value = e;
        if (wrap) wrap.classList.add('hidden');
        if (domain) domain.disabled = false;
      }
    } else {
      user.value = e;
    }
    user.dispatchEvent(new Event('input', { bubbles: true }));
  }

  // ---- 登录/注册模式下相机按钮定位：登录=框内右侧(绝对)，注册=框外左侧(流式子元素) ----
  function placeCamButton() {
    const field = $('username-field');
    const input = $('username');
    const btn = $('email-ocr-btn');
    const modal = $('auth-modal');
    if (!field || !input || !btn || !modal) return;
    const isRegister = modal.classList.contains('mode-register');
    if (isRegister) {
      // 邮箱后缀右边：作为最后一个流式子元素（位于域名选择框右侧）
      btn.style.position = 'static';
      btn.style.transform = 'none';
      btn.style.right = 'auto';
      btn.style.left = 'auto';
      btn.style.top = 'auto';
      input.style.paddingRight = '';
      if (btn.parentNode !== field || field.lastElementChild !== btn) field.appendChild(btn);
    } else {
      // 登录：内部右侧（绝对定位在输入框上）。
      // 让相机“图标”与下方密码框锁图标到右边框的距离一致：
      // 锁按钮 right-3(12px) 且图标紧贴右缘；相机按钮 36px 宽、图标 18px 居中(半边内边距 9px)，
      // 故 right = 锁right - 9px ≈ 3px，使两个图标对齐。
      const lockBtn = $('toggle-password');
      let rightPx = 3;
      if (lockBtn) {
        const lr = parseFloat(getComputedStyle(lockBtn).right);
        if (!isNaN(lr)) rightPx = lr - ((btn.offsetWidth || 36) - 18) / 2;
      }
      btn.style.position = 'absolute';
      btn.style.right = rightPx + 'px';
      btn.style.left = 'auto';
      btn.style.top = '50%';
      btn.style.transform = 'translateY(-50%)';
      btn.style.zIndex = '10';
      input.style.paddingRight = '48px';
      if (btn.parentNode !== field) field.appendChild(btn);
    }
  }

  // ---- 本地图片选择（点击 OCR 按钮直接打开，不再弹下拉菜单 / 调摄像头） ----
  let fileAlbum = null;

  // 当前 OCR 目标（由 openMenuFor 设置）：输入框 + 按钮 + 回填回调
  let active = null;
  function ocrBtn() { return (active && active.btn) || $('email-ocr-btn'); }

  // 统一处理图片（相册或拍照）→ OCR → 回填到指定输入框
  function runOCR(fileOrBlob, inputEl, btn, onSelect) {
    if (!fileOrBlob || !inputEl) return;
    const oldTitle = btn ? btn.title : '';
    if (btn) { btn.style.opacity = '0.5'; btn.title = '识别中…'; }
    recognize(fileOrBlob).then(({ emails }) => {
      if (emails.length > 1) {
        showEmailPicker(emails, inputEl, onSelect, btn);
        if (btn) btn.title = t('ocr_multi_email_count', '识别到 {n} 个邮箱，请选择').replace('{n}', emails.length);
      } else if (emails.length === 1) {
        onSelect(emails[0]);
        if (btn) btn.title = '已填入: ' + emails[0];
      } else if (btn) btn.title = '未识别到邮箱';
    }).catch(() => {
      if (btn) btn.title = '识别失败，请重试';
    }).finally(() => {
      if (btn) { btn.style.opacity = ''; setTimeout(() => { if (btn) btn.title = oldTitle; }, 2500); }
    });
  }

  // 登录/注册弹窗用的入口：回填到 #username（含后缀拆分逻辑在 fillEmail 内）
  function processImage(fileOrBlob) {
    if (!active) return;
    runOCR(fileOrBlob, active.input, active.btn, active.onSelect);
  }

  // 多个邮箱时的选择浮层（fixed 定位，避免被弹窗 overflow 裁剪）
  function showEmailPicker(emails, inputEl, onSelect, btn) {
    hideEmailPicker();
    inputEl = inputEl || $('username');
    const r = inputEl.getBoundingClientRect();
    const picker = document.createElement('div');
    picker.id = 'ocr-email-picker';
    picker.className = 'fixed z-[320] rounded-lg border border-zinc-700 bg-zinc-900 shadow-xl overflow-hidden';
    picker.style.left = r.left + 'px';
    picker.style.top = (r.bottom + 6) + 'px';
    picker.style.width = Math.max(r.width, 220) + 'px';
    const head = document.createElement('div');
    head.className = 'px-3 py-2 text-xs text-zinc-400 bg-zinc-800 border-b border-zinc-700';
    head.textContent = t('ocr_multi_email', '识别到多个邮箱，请选择');
    picker.appendChild(head);
    const list = document.createElement('div');
    list.className = 'max-h-56 overflow-y-auto';
    emails.forEach((em) => {
      const item = document.createElement('button');
      item.type = 'button';
      item.className = 'w-full text-left px-3 py-2 text-sm text-white hover:bg-[var(--neon-blue)]/20 transition-colors';
      item.textContent = em;
      item.addEventListener('click', (ev) => {
        ev.stopPropagation();
        onSelect(em);
        if (btn) btn.title = '已填入: ' + em;
        hideEmailPicker();
      });
      list.appendChild(item);
    });
    picker.appendChild(list);
    document.body.appendChild(picker);
  }
  function hideEmailPicker() {
    const p = $('ocr-email-picker');
    if (p) p.remove();
  }

  function ensureFilePicker() {
    if (fileAlbum) return;
    fileAlbum = document.createElement('input');
    fileAlbum.type = 'file';
    fileAlbum.accept = 'image/*';
    fileAlbum.className = 'hidden';
    document.body.appendChild(fileAlbum);
    fileAlbum.addEventListener('change', (e) => {
      const f = e.target.files && e.target.files[0];
      processImage(f);
      fileAlbum.value = '';
    });
  }

  // 点击 OCR 按钮：直接打开本地图片选择器（不再弹出下拉菜单）
  function openAlbum() {
    ensureFilePicker();
    if (fileAlbum) fileAlbum.click();
  }

  function setActive(inputEl, btn, onSelect) { active = { input: inputEl, btn: btn, onSelect: onSelect }; }
  function openMenuFor(inputEl, btn, onSelect) {
    setActive(inputEl, btn, onSelect);
    hideEmailPicker();
    openAlbum();
  }

  function init() {
    const btn = $('email-ocr-btn');
    if (!btn) return;
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      setActive($('username'), $('email-ocr-btn'), (em) => fillEmail(em));
      hideEmailPicker();
      openAlbum();
    });
    // 点击空白处关闭多邮箱选择浮层
    document.addEventListener('click', (ev) => {
      const picker = $('ocr-email-picker');
      if (!picker) return;
      const ob = ocrBtn();
      if (!picker.contains(ev.target) && ev.target !== ob && !(ob && ob.contains(ev.target))) {
        picker.remove();
      }
    });
    // 监听登录/注册模式切换（#auth-modal 的 mode-register class）
    const modal = $('auth-modal');
    if (modal) {
      new MutationObserver(() => { placeCamButton(); hideEmailPicker(); }).observe(modal, { attributes: true, attributeFilter: ['class'] });
    }
    placeCamButton();
  }

  // 暴露给其他脚本使用
  window.OCR = { ensureOCR, recognize, supported: cameraSupported, openMenuFor, optimizeEmail };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
