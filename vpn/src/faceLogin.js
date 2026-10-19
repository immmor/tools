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

  // 人脸相关多语言字典（站点翻译由外部运行时加载，这里内嵌以保证人脸 UI 多语言）
  const FACE_I18N = {
    'zh-CN': {
      face_login: '人脸识别登录', face_login_title: '人脸识别登录',
      face_login_tip: '正对摄像头，点击“刷脸登录”即可一键登录',
      face_status_ready: '点击“开启摄像头”开始', face_start: '开启摄像头', face_recognize: '刷脸登录',
      face_back_account: '返回账号登录', face_loading_model: '正在加载人脸识别模型…',
      face_camera_ready: '摄像头已开启，点击“刷脸登录”', face_camera_fail: '摄像头启动失败',
      face_no_face: '未检测到人脸，请正对摄像头、保证光线充足', face_recognizing: '正在识别…',
      face_login_ok: '刷脸登录成功！', face_login_fail: '识别失败',
      face_enroll_title: '录入人脸', face_enroll_btn: '录入人脸',
      face_enroll_ok: '录入成功！', face_enroll_fail: '录入失败',
      face_need_login: '请先登录后再录入人脸', face_error: '出错了，请重试',
      nav_enroll_face: '录入人脸'
    },
    'en-US': {
      face_login: 'Face Login', face_login_title: 'Face Login',
      face_login_tip: 'Look at the camera and tap “Face Login” to sign in instantly',
      face_status_ready: 'Tap “Start Camera” to begin', face_start: 'Start Camera', face_recognize: 'Face Login',
      face_back_account: 'Back to account login', face_loading_model: 'Loading face recognition model…',
      face_camera_ready: 'Camera is on. Tap “Face Login”', face_camera_fail: 'Failed to start camera',
      face_no_face: 'No face detected. Please face the camera with good lighting', face_recognizing: 'Recognizing…',
      face_login_ok: 'Face login successful!', face_login_fail: 'Recognition failed',
      face_enroll_title: 'Enroll Face', face_enroll_btn: 'Enroll Face',
      face_enroll_ok: 'Face enrolled!', face_enroll_fail: 'Failed to enroll',
      face_need_login: 'Please sign in before enrolling your face', face_error: 'Something went wrong, please retry',
      nav_enroll_face: 'Enroll Face'
    },
    'ja-JP': {
      face_login: '顔認証ログイン', face_login_title: '顔認証ログイン',
      face_login_tip: 'カメラを見つめて「顔認証ログイン」をタップすると即ログイン',
      face_status_ready: '「カメラ開始」をタップして開始', face_start: 'カメラ開始', face_recognize: '顔認証ログイン',
      face_back_account: 'アカウントログインに戻る', face_loading_model: '顔認識モデルを読み込み中…',
      face_camera_ready: 'カメラ起動中。「顔認証ログイン」をタップ', face_camera_fail: 'カメラの起動に失敗',
      face_no_face: '顔が検出されません。明るい場所でカメラに向いてください', face_recognizing: '認識中…',
      face_login_ok: '顔認証ログイン成功！', face_login_fail: '認識に失敗',
      face_enroll_title: '顔を登録', face_enroll_btn: '顔を登録',
      face_enroll_ok: '顔の登録成功！', face_enroll_fail: '登録に失敗',
      face_need_login: '顔を登録する前にログインしてください', face_error: 'エラーが発生しました。再試行してください',
      nav_enroll_face: '顔を登録'
    },
    'ko-KR': {
      face_login: '얼굴 인증 로그인', face_login_title: '얼굴 인증 로그인',
      face_login_tip: '카메라를 보고 “얼굴 인증 로그인”을 탭하면 즉시 로그인',
      face_status_ready: '“카메라 시작”을 탭하여 시작', face_start: '카메라 시작', face_recognize: '얼굴 인증 로그인',
      face_back_account: '계정 로그인으로 돌아가기', face_loading_model: '얼굴 인식 모델 로딩 중…',
      face_camera_ready: '카메라 켜짐. “얼굴 인증 로그인” 탭', face_camera_fail: '카메라 시작 실패',
      face_no_face: '얼굴이 감지되지 않았습니다. 밝은 곳에서 카메라를 보세요', face_recognizing: '인식 중…',
      face_login_ok: '얼굴 인증 로그인 성공!', face_login_fail: '인식 실패',
      face_enroll_title: '얼굴 등록', face_enroll_btn: '얼굴 등록',
      face_enroll_ok: '얼굴 등록 완료!', face_enroll_fail: '등록 실패',
      face_need_login: '얼굴 등록 전에 먼저 로그인하세요', face_error: '오류가 발생했습니다. 다시 시도하세요',
      nav_enroll_face: '얼굴 등록'
    },
    'es-ES': {
      face_login: 'Inicio de sesión facial', face_login_title: 'Inicio de sesión facial',
      face_login_tip: 'Mirando a la cámara, toca “Inicio de sesión facial” para entrar al instante',
      face_status_ready: 'Toca “Iniciar cámara” para empezar', face_start: 'Iniciar cámara', face_recognize: 'Inicio de sesión facial',
      face_back_account: 'Volver al inicio de sesión por cuenta', face_loading_model: 'Cargando modelo de reconocimiento facial…',
      face_camera_ready: 'Cámara activada. Toca “Inicio de sesión facial”', face_camera_fail: 'No se pudo iniciar la cámara',
      face_no_face: 'No se detectó rostro. Mira a la cámara con buena luz', face_recognizing: 'Reconociendo…',
      face_login_ok: '¡Inicio de sesión facial correcto!', face_login_fail: 'Fallo al reconocer',
      face_enroll_title: 'Registrar rostro', face_enroll_btn: 'Registrar rostro',
      face_enroll_ok: '¡Rostro registrado!', face_enroll_fail: 'Error al registrar',
      face_need_login: 'Inicia sesión antes de registrar tu rostro', face_error: 'Algo salió mal, inténtalo de nuevo',
      nav_enroll_face: 'Registrar rostro'
    },
    'vi-VN': {
      face_login: 'Đăng nhập bằng khuôn mặt', face_login_title: 'Đăng nhập bằng khuôn mặt',
      face_login_tip: 'Nhìn vào camera và nhấn “Đăng nhập bằng khuôn mặt” để vào ngay',
      face_status_ready: 'Nhấn “Bật camera” để bắt đầu', face_start: 'Bật camera', face_recognize: 'Đăng nhập bằng khuôn mặt',
      face_back_account: 'Quay lại đăng nhập tài khoản', face_loading_model: 'Đang tải mô hình nhận diện khuôn mặt…',
      face_camera_ready: 'Camera đã bật. Nhấn “Đăng nhập bằng khuôn mặt”', face_camera_fail: 'Không thể bật camera',
      face_no_face: 'Không phát hiện khuôn mặt. Hãy nhìn vào camera nơi đủ sáng', face_recognizing: 'Đang nhận diện…',
      face_login_ok: 'Đăng nhập bằng khuôn mặt thành công!', face_login_fail: 'Nhận diện thất bại',
      face_enroll_title: 'Đăng ký khuôn mặt', face_enroll_btn: 'Đăng ký khuôn mặt',
      face_enroll_ok: 'Đã đăng ký khuôn mặt!', face_enroll_fail: 'Đăng ký thất bại',
      face_need_login: 'Hãy đăng nhập trước khi đăng ký khuôn mặt', face_error: 'Có lỗi, vui lòng thử lại',
      nav_enroll_face: 'Đăng ký khuôn mặt'
    },
    'ar-SA': {
      face_login: 'تسجيل الدخول بالوجه', face_login_title: 'تسجيل الدخول بالوجه',
      face_login_tip: 'انظر إلى الكاميرا واضغط “تسجيل الدخول بالوجه” للدخول فورًا',
      face_status_ready: 'اضغط “تشغيل الكاميرا” للبدء', face_start: 'تشغيل الكاميرا', face_recognize: 'تسجيل الدخول بالوجه',
      face_back_account: 'العودة إلى تسجيل الدخول بالحساب', face_loading_model: 'جارٍ تحميل نموذج التعرف على الوجه…',
      face_camera_ready: 'الكاميرا تعمل. اضغط “تسجيل الدخول بالوجه”', face_camera_fail: 'تعذّر تشغيل الكاميرا',
      face_no_face: 'لم يتم رصد وجه. انظر إلى الكاميرا في مكان مضيء', face_recognizing: 'جارٍ التعرف…',
      face_login_ok: 'تم تسجيل الدخول بالوجه بنجاح!', face_login_fail: 'فشل التعرف',
      face_enroll_title: 'تسجيل الوجه', face_enroll_btn: 'تسجيل الوجه',
      face_enroll_ok: 'تم تسجيل الوجه!', face_enroll_fail: 'فشل التسجيل',
      face_need_login: 'سجّل الدخول قبل تسجيل وجهك', face_error: 'حدث خطأ، حاول مرة أخرى',
      nav_enroll_face: 'تسجيل الوجه'
    },
    'ru-RU': {
      face_login: 'Вход по лицу', face_login_title: 'Вход по лицу',
      face_login_tip: 'Посмотрите в камеру и нажмите «Вход по лицу», чтобы войти мгновенно',
      face_status_ready: 'Нажмите «Включить камеру», чтобы начать', face_start: 'Включить камеру', face_recognize: 'Вход по лицу',
      face_back_account: 'Назад к входу по аккаунту', face_loading_model: 'Загрузка модели распознавания лиц…',
      face_camera_ready: 'Камера включена. Нажмите «Вход по лицу»', face_camera_fail: 'Не удалось запустить камеру',
      face_no_face: 'Лицо не обнаружено. Посмотрите в камеру при хорошем освещении', face_recognizing: 'Распознавание…',
      face_login_ok: 'Вход по лицу выполнен!', face_login_fail: 'Ошибка распознавания',
      face_enroll_title: 'Записать лицо', face_enroll_btn: 'Записать лицо',
      face_enroll_ok: 'Лицо записано!', face_enroll_fail: 'Не удалось записать',
      face_need_login: 'Войдите в аккаунт перед записью лица', face_error: 'Произошла ошибка, попробуйте снова',
      nav_enroll_face: 'Записать лицо'
    }
  };

  let faceApiLoading = false;
  let faceApiReady = false;
  let stream = null;
  let videoEl = null;
  let mode = 'login'; // 'login' | 'enroll'

  const $ = (id) => document.getElementById(id);

  // 多语言文本兜底（优先用人脸内嵌字典，其次主脚本 translations，最后兜底）
  function t(key, fallback) {
    try {
      if (FACE_I18N[currentLang] && FACE_I18N[currentLang][key]) return FACE_I18N[currentLang][key];
      const d = (typeof translations !== 'undefined' && currentLang && translations[currentLang]) ? translations[currentLang] : null;
      return (d && d[key]) || fallback || key;
    } catch (e) {
      return fallback || key;
    }
  }

  // 把人脸相关 data-i18n 文案按当前语言应用到 DOM（在外部 i18n 之后执行，覆盖中文兜底）
  function applyFaceI18n() {
    document.querySelectorAll('[data-i18n]').forEach(el => {
      const k = el.getAttribute('data-i18n');
      const v = (FACE_I18N[currentLang] && FACE_I18N[currentLang][k])
        || (typeof translations !== 'undefined' && currentLang && translations[currentLang] && translations[currentLang][k]);
      if (v) el.textContent = v;
    });
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
    applyFaceI18n();
    document.addEventListener('languageChanged', applyFaceI18n);
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
