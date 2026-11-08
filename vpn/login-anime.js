// login-anime.js — vpay 登录跳转动画（全屏遮罩 + 品牌动效）
// 用法：
//   VpayLoginAnime.show({ text, theme });  // theme: 'light' | 'dark' | 省略(自动)
//   VpayLoginAnime.setText('新文案');
//   VpayLoginAnime.hide();                  // 登录成功/失败后再隐藏
// 设计目标：从"点击跳转"到"登录成功"全程显示动画，登录成功才消失。
(function (global) {
  'use strict';

  let overlay = null;
  let shownAt = 0;
  const SPIN_MS = 900;   // 每圈时长，须与 va-spin 动画一致
  const MIN_SPINS = 3;   // 不管成功失败，至少转 3 圈
  const MIN_MS = SPIN_MS * MIN_SPINS;
  const FADE_MS = 420;

  function prefersLight() {
    try {
      const p = new URLSearchParams(location.search).get('theme');
      if (p === 'light') return true;
      if (p === 'dark') return false;
      return !!document.body.classList.contains('theme-light');
    } catch (e) {
      return false;
    }
  }

  function build(light) {
    // 关键帧（自包含，不依赖外部 css）
    const style = document.createElement('style');
    style.textContent =
      '@keyframes va-spin{to{transform:rotate(360deg)}}' +
      '@keyframes va-pulse{0%,100%{transform:scale(.82);opacity:.65}50%{transform:scale(1.12);opacity:1}}' +
      '@keyframes va-glow{0%,100%{transform:scale(1);opacity:.85}50%{transform:scale(1.18);opacity:1}}';

    const wrap = document.createElement('div');
    wrap.id = 'vpay-login-anime';
    wrap.style.cssText = [
      'position:fixed', 'inset:0', 'z-index:99999',
      'display:flex', 'flex-direction:column', 'align-items:center', 'justify-content:center', 'gap:24px',
      light ? 'background:rgba(255,255,255,0.85)' : 'background:rgba(8,9,16,0.92)',
      '-webkit-backdrop-filter:blur(12px)', 'backdrop-filter:blur(12px)',
      'transition:opacity .4s ease', 'opacity:1', 'font-family:inherit'
    ].join(';');

    // 品牌 LOGO
    const brand = document.createElement('div');
    brand.style.cssText = 'display:flex;align-items:center;gap:12px;font-size:24px;font-weight:700;letter-spacing:1px;' +
      (light ? 'color:#1a1c23;' : 'color:#fff;');
    brand.innerHTML =
      '<i class="fa-solid fa-gem" style="color:#a29bfe;font-size:30px;animation:va-glow 1.6s ease-in-out infinite"></i>' +
      '<span style="background:linear-gradient(135deg,#6c5ce7,#a29bfe);-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent">FUNBUA</span>';

    // 旋转环 + 中心脉冲
    const spinner = document.createElement('div');
    spinner.style.cssText = 'position:relative;width:76px;height:76px;';
    spinner.innerHTML =
      '<div style="position:absolute;inset:0;border-radius:50%;border:4px solid ' +
        (light ? 'rgba(108,92,231,.18)' : 'rgba(108,92,231,.28)') +
        ';border-top-color:#6c5ce7;animation:va-spin .9s linear infinite"></div>' +
      '<div style="position:absolute;inset:18px;border-radius:50%;background:linear-gradient(135deg,#6c5ce7,#a29bfe);animation:va-pulse 1.2s ease-in-out infinite"></div>';

    // 文案
    const text = document.createElement('div');
    text.id = 'vpay-login-anime-text';
    text.style.cssText = 'font-size:14px;letter-spacing:.5px;' +
      (light ? 'color:rgba(0,0,0,.6);' : 'color:rgba(255,255,255,.65);');

    wrap.appendChild(style);
    wrap.appendChild(brand);
    wrap.appendChild(spinner);
    wrap.appendChild(text);
    return wrap;
  }

  const API = {
    show: function (opts) {
      opts = opts || {};
      if (overlay) {
        if (opts.text) API.setText(opts.text);
        return;
      }
      const light = opts.theme ? opts.theme === 'light' : prefersLight();
      overlay = build(light);
      API.setText(opts.text || '登录中…');
      document.body.appendChild(overlay);
      shownAt = Date.now();
    },
    setText: function (t) {
      if (!overlay) return;
      const tx = overlay.querySelector('#vpay-login-anime-text');
      if (tx && t) tx.textContent = t;
    },
    hide: function () {
      if (!overlay) return;
      const o = overlay;
      overlay = null;
      // 至少转满 MIN_SPINS 圈（不论登录成功或失败），再开始淡出
      const wait = Math.max(0, MIN_MS - (Date.now() - shownAt));
      setTimeout(function () {
        o.style.opacity = '0';
        setTimeout(function () {
          if (o.parentNode) o.parentNode.removeChild(o);
        }, FADE_MS);
      }, wait);
    }
  };

  global.VpayLoginAnime = API;
})(window);
