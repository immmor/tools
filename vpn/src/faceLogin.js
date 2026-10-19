// ==================== 人脸识别登录 ====================
// 依赖：face-api.js + @tensorflow/tfjs（首次使用时从 CDN 懒加载），模型取自 ./models
// 成功登录后复用站点既有的登录态写入方式（localStorage.userInfo + updateNav）
// 注意：translations / currentLang / updateNav 是主脚本（index.html 内联）的顶层绑定，
//       本文件作为经典脚本在之后加载，可直接访问。
(function () {
  'use strict';

  const API = 'https://api.funbua.uk';
  const MODEL_URL = './models';
  const THRESHOLD = 0.6; // 与后端 /api/face-login 保持一致

  let faceApiLoading = false;
  let faceApiReady = false;
  let stream = null;
  let videoEl = null;
  let mode = 'login'; // 'login' | 'enroll'

  const $ = (id) => document.getElementById(id);

  // 多语言文本兜底（主脚本的 translations/currentLang 可能未就绪）
  function t(key, fallback) {
    try {
      const d = (typeof translations !== 'undefined' && currentLang && translations[currentLang]) ? translations[currentLang] : null;
      return (d && d[key]) || fallback || key;
    } catch (e) {
      return fallback || key;
    }
  }

  function setStatus(msg) {
    const el = $('face-status');
    if (el) el.textContent = msg;
  }

  function loadScript(src) {
    return new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = src;
      s.onload = () => resolve();
      s.onerror = () => reject(new Error('脚本加载失败: ' + src));
      document.head.appendChild(s);
    });
  }

  async function ensureFaceApi() {
    if (faceApiReady) return;
    if (faceApiLoading) {
      while (!faceApiReady) await new Promise(r => setTimeout(r, 80));
      return;
    }
    faceApiLoading = true;
    try {
      if (typeof tf === 'undefined') {
        await loadScript('https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@1.7.4/dist/tf.min.js');
      }
      if (typeof faceapi === 'undefined') {
        await loadScript('https://cdn.jsdelivr.net/npm/face-api.js@0.22.2/dist/face-api.min.js');
      }
      await Promise.all([
        faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
        faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
        faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL)
      ]);
      faceApiReady = true;
    } finally {
      faceApiLoading = false;
    }
  }

  async function startCamera() {
    if (!videoEl) videoEl = $('face-video');
    if (stream) return;
    const s = await navigator.mediaDevices.getUserMedia({ video: true });
    stream = s;
    videoEl.srcObject = s;
    await videoEl.play().catch(() => {});
  }

  function stopCamera() {
    if (stream) {
      stream.getTracks().forEach(tr => tr.stop());
      stream = null;
    }
    if (videoEl) videoEl.srcObject = null;
  }

  async function captureDescriptor() {
    if (!faceApiReady) await ensureFaceApi();
    const detection = await faceapi
      .detectSingleFace(videoEl, new faceapi.TinyFaceDetectorOptions())
      .withFaceLandmarks()
      .withFaceDescriptor();
    if (!detection) throw new Error(t('face_no_face', '未检测到人脸，请正对摄像头、保证光线充足'));
    return Array.from(detection.descriptor);
  }

  // 复用站点既有登录成功逻辑：写 localStorage + 刷新导航
  function completeLogin(data) {
    const userInfoWithPrice = Object.assign({}, data.userInfo, { pricePlan: data.pricePlan });
    localStorage.setItem('userInfo', JSON.stringify(userInfoWithPrice));
    localStorage.setItem('loginTime', Date.now());
    if (typeof window.updateNav === 'function') window.updateNav(userInfoWithPrice);
    try { window.GameCenterModule && window.GameCenterModule.renderGameHistory && window.GameCenterModule.renderGameHistory('wheel'); } catch (e) {}
    // 同步邀请码/来源（与密码登录成功路径保持一致）
    fetch(`${API}/api/get-user?name=${encodeURIComponent(data.userInfo.username)}`)
      .then(r => r.json())
      .then(d => {
        if (d && d.code === 200) {
          const s = JSON.parse(localStorage.getItem('userInfo') || '{}');
          if (d.data.invite_code) s.invite_code = d.data.invite_code;
          if (d.data.source !== undefined) s.source = d.data.source;
          localStorage.setItem('userInfo', JSON.stringify(s));
          if (typeof window.updateNav === 'function') window.updateNav(s);
        }
      })
      .catch(() => {});
  }

  function showFacePanel(m) {
    mode = m;
    $('immmor-wallet-landing') && $('immmor-wallet-landing').classList.add('hidden');
    const modal = $('auth-modal');
    if (modal) modal.classList.remove('hidden');
    $('auth-form') && $('auth-form').classList.add('hidden');
    $('auth-switch-block') && $('auth-switch-block').classList.add('hidden');
    $('forgot-pwd-container') && $('forgot-pwd-container').classList.add('hidden');
    $('auth-message') && $('auth-message').classList.add('hidden');

    const panel = $('face-login-panel');
    panel.classList.remove('hidden');
    panel.classList.add('flex');

    const titleEl = panel.querySelector('h3');
    const submitBtn = $('face-submit-btn');
    if (m === 'enroll') {
      if (titleEl) titleEl.textContent = t('face_enroll_title', '录入 / 更新人脸');
      if (submitBtn) submitBtn.textContent = t('face_enroll_btn', '录入人脸');
    } else {
      if (titleEl) titleEl.textContent = t('face_login_title', '人脸识别登录');
      if (submitBtn) submitBtn.textContent = t('face_recognize', '刷脸登录');
    }
    setStatus(t('face_status_ready', '点击“开启摄像头”开始'));
    if (submitBtn) { submitBtn.disabled = true; submitBtn.classList.add('opacity-50', 'cursor-not-allowed'); }
  }

  function restoreAccountView() {
    const panel = $('face-login-panel');
    if (panel) { panel.classList.add('hidden'); panel.classList.remove('flex'); }
    stopCamera();
    $('auth-form') && $('auth-form').classList.remove('hidden');
    $('auth-switch-block') && $('auth-switch-block').classList.remove('hidden');
  }

  function closeFaceAndRestore() {
    restoreAccountView();
    const modal = $('auth-modal');
    if (modal) modal.classList.add('hidden');
  }

  async function onStart() {
    const status = $('face-status');
    const submitBtn = $('face-submit-btn');
    try {
      if (status) status.textContent = t('face_loading_model', '正在加载人脸识别模型…');
      await ensureFaceApi();
      await startCamera();
      if (status) status.textContent = t('face_camera_ready', '摄像头已开启，点击“刷脸登录”');
      if (submitBtn) { submitBtn.disabled = false; submitBtn.classList.remove('opacity-50', 'cursor-not-allowed'); }
    } catch (err) {
      if (status) status.textContent = (err && err.message) || t('face_camera_fail', '摄像头启动失败');
      if (submitBtn) submitBtn.disabled = false;
    }
  }

  async function onSubmit() {
    const status = $('face-status');
    const submitBtn = $('face-submit-btn');
    if (submitBtn) submitBtn.disabled = true;
    try {
      if (status) status.textContent = t('face_recognizing', '正在识别…');
      const descriptor = await captureDescriptor();

      if (mode === 'login') {
        const res = await fetch(`${API}/api/face-login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ descriptor })
        });
        const data = await res.json();
        if (data && data.success) {
          if (status) status.textContent = t('face_login_ok', '刷脸登录成功！');
          completeLogin(data);
          setTimeout(closeFaceAndRestore, 800);
        } else {
          if (status) status.textContent = (data && data.message) || t('face_login_fail', '识别失败');
          if (submitBtn) submitBtn.disabled = false;
        }
      } else {
        const info = JSON.parse(localStorage.getItem('userInfo') || '{}');
        if (!info.username || !info.p_token) {
          if (status) status.textContent = t('face_need_login', '请先登录后再录入人脸');
          if (submitBtn) submitBtn.disabled = false;
          return;
        }
        const res = await fetch(`${API}/api/save-face`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username: info.username, p_token: info.p_token, descriptor })
        });
        const data = await res.json();
        if (status) status.textContent = (data && data.message) || (data && data.success ? t('face_enroll_ok', '录入成功') : t('face_enroll_fail', '录入失败'));
        if (data && data.success) setTimeout(closeFaceAndRestore, 800);
        else if (submitBtn) submitBtn.disabled = false;
      }
    } catch (err) {
      if (status) status.textContent = (err && err.message) || t('face_error', '出错了，请重试');
      if (submitBtn) submitBtn.disabled = false;
    }
  }

  function init() {
    $('face-login-btn') && $('face-login-btn').addEventListener('click', () => showFacePanel('login'));
    $('enroll-face-btn') && $('enroll-face-btn').addEventListener('click', () => {
      const menu = $('dropdown-menu');
      if (menu) menu.classList.add('hidden');
      showFacePanel('enroll');
    });
    $('face-start-btn') && $('face-start-btn').addEventListener('click', onStart);
    $('face-submit-btn') && $('face-submit-btn').addEventListener('click', onSubmit);
    $('face-back-btn') && $('face-back-btn').addEventListener('click', restoreAccountView);
    // 关闭弹窗（X 或点击遮罩）时复位视图并关闭摄像头
    $('modal-close') && $('modal-close').addEventListener('click', restoreAccountView);
    const modal = $('auth-modal');
    if (modal) modal.addEventListener('click', (e) => { if (e.target === modal) restoreAccountView(); });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
