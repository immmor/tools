// ==================== 声纹识别登录 ====================
// 依赖：@jaehyun-ko/speaker-verification + onnxruntime-web（首次使用时从 CDN 懒加载）
// 前端只负责录音、用 getEmbedding 提取声纹向量（Float32Array），比对/存储由后端完成（/api/voice-login、/api/save-voice）
// 成功登录后复用站点既有的登录态写入方式（localStorage.userInfo + updateNav）
// 注意：translations / currentLang / updateNav 是主脚本（index.html 内联）的顶层绑定，
//       本文件作为经典脚本在之后加载，可直接访问。
(function () {
  'use strict';

  const API = 'https://api.funbua.uk';

  // 声纹相关多语言字典（站点翻译由外部运行时加载，这里内嵌以保证声纹 UI 多语言）
  const VOICE_I18N = {
    'zh-CN': {
      voice_login: '声纹登录', voice_login_title: '声纹识别登录',
      voice_login_tip: '对着麦克风朗读下方文本，点击“开始录音”，录音将自动录满 5 秒',
      voice_status_ready: '点击“开始录音”录入声纹', voice_record: '开始录音', voice_stop_record: '停止录音',
      voice_recognize: '声纹登录', voice_back_account: '返回账号登录',
      voice_loading_model: '正在加载声纹模型…', voice_recording: '正在录音…请朗读',
      voice_recorded: '已录制，点击“声纹登录”', voice_extracting: '正在提取声纹特征…',
      voice_sending: '正在发送到服务器验证…',
      voice_login_ok: '声纹登录成功！', voice_login_fail: '声纹验证失败',
      voice_enroll_title: '录入声纹', voice_enroll_btn: '录入声纹',
      voice_enroll_ok: '声纹录入成功！', voice_enroll_fail: '声纹录入失败',
      voice_need_login: '请先登录后再录入声纹', voice_error: '出错了，请重试',
      voice_mic_fail: '无法访问麦克风', voice_no_audio: '请先录音',
      nav_enroll_voice: '录入声纹', voice_read_prompt: '请朗读', voice_rerecord: '重新录制', voice_rec: '录音中', voice_need_username: '请输入用户名', voice_read_text: '今天天气真好。', voice_lang_hint: '请使用与录入时相同的语言朗读', voice_info_title: '录制须知', voice_info_1: '请在安静环境中朗读，避免背景噪音干扰', voice_info_2: '使用与录入时相同的语言，朗读上方指定文本', voice_info_3: '录音将自动录满 5 秒，请保持匀速、清晰发音', voice_info_secure: '声纹仅用于本人登录验证，已在服务端加密保存。', voice_download: '下载录音', voice_upload: '上传录音', voice_uploaded: '已选择录音文件，点击“声纹登录”验证'
    },
    'en-US': {
      voice_login: 'Voice Login', voice_login_title: 'Voiceprint Login',
      voice_login_tip: 'Read the text below to the mic, then tap “Start Recording”; recording auto-stops after 5 seconds',
      voice_status_ready: 'Tap “Start Recording” to begin', voice_record: 'Start Recording', voice_stop_record: 'Stop Recording',
      voice_recognize: 'Voice Login', voice_back_account: 'Back to account login',
      voice_loading_model: 'Loading voiceprint model…', voice_recording: 'Recording… please speak',
      voice_recorded: 'Recorded. Tap “Voice Login”', voice_extracting: 'Extracting voiceprint features…',
      voice_sending: 'Verifying with server…',
      voice_login_ok: 'Voice login successful!', voice_login_fail: 'Voice verification failed',
      voice_enroll_title: 'Enroll Voiceprint', voice_enroll_btn: 'Enroll Voiceprint',
      voice_enroll_ok: 'Voiceprint enrolled!', voice_enroll_fail: 'Failed to enroll voiceprint',
      voice_need_login: 'Please sign in before enrolling your voiceprint', voice_error: 'Something went wrong, please retry',
      voice_mic_fail: 'Cannot access microphone', voice_no_audio: 'Please record first',
      nav_enroll_voice: 'Enroll Voiceprint', voice_read_prompt: 'Please read', voice_rerecord: 'Record again', voice_rec: 'Recording', voice_need_username: 'Please enter your username', voice_read_text: 'The weather is really nice today.', voice_lang_hint: 'Please read in the same language you used when enrolling', voice_info_title: 'Recording Notes', voice_info_1: 'Record in a quiet environment and avoid background noise', voice_info_2: 'Read the text above in the same language you used when enrolling', voice_info_3: 'Recording auto-stops after 5 seconds; speak steadily and clearly', voice_info_secure: 'Your voiceprint is used only for your own login and is encrypted on the server.', voice_download: 'Download Recording', voice_upload: 'Upload Recording', voice_uploaded: 'Recording file selected. Tap “Voice Login” to verify'
    },
    'ja-JP': {
      voice_login: '声紋ログイン', voice_login_title: '声紋認証ログイン',
      voice_login_tip: 'マイクに向かって下の文章を読み上げ、「録音開始」をタップ。録音は5秒で自動停止します',
      voice_status_ready: '「録音開始」をタップして開始', voice_record: '録音開始', voice_stop_record: '録音停止',
      voice_recognize: '声紋ログイン', voice_back_account: 'アカウントログインに戻る',
      voice_loading_model: '声紋モデルを読み込み中…', voice_recording: '録音中…声を出してください',
      voice_recorded: '録音完了。「声紋ログイン」をタップ', voice_extracting: '声紋特徴を抽出中…',
      voice_sending: 'サーバーで検証中…',
      voice_login_ok: '声紋ログイン成功！', voice_login_fail: '声紋認証に失敗',
      voice_enroll_title: '声紋を登録', voice_enroll_btn: '声紋を登録',
      voice_enroll_ok: '声紋の登録成功！', voice_enroll_fail: '声紋の登録に失敗',
      voice_need_login: '声紋登録前にログインしてください', voice_error: 'エラーが発生しました。再試行してください',
      voice_mic_fail: 'マイクにアクセスできません', voice_no_audio: 'まず録音してください',
      nav_enroll_voice: '声紋を登録', voice_read_prompt: '以下を読んで', voice_rerecord: '再录制', voice_rec: '録音中', voice_need_username: 'ユーザー名を入力してください', voice_read_text: '今日はいい天気ですね。', voice_lang_hint: '登録時と同じ言語で読み上げてください', voice_info_title: '録音の注意点', voice_info_1: '静かな環境で読み上げ、背景雑音を避けてください', voice_info_2: '登録時と同じ言語で上の文章を読んでください', voice_info_3: '録音は5秒で自動停止します。一定のペースで明瞭に話してください', voice_info_secure: '声紋は本人のログインのみに使用され、サーバー上で暗号化されて保存されます。', voice_download: '録音をダウンロード', voice_upload: '録音をアップロード', voice_uploaded: '録音ファイルを選択しました。「声紋ログイン」をタップして認証'
    },
    'ko-KR': {
      voice_login: '음성 로그인', voice_login_title: '음성 인증 로그인',
      voice_login_tip: '마이크에 대고 아래 문장을 읽고 “녹음 시작”을 탭하세요. 녹음은 5초 후 자동 종료됩니다.',
      voice_status_ready: '“녹음 시작”을 탭하여 시작', voice_record: '녹음 시작', voice_stop_record: '녹음 중지',
      voice_recognize: '음성 로그인', voice_back_account: '계정 로그인으로 돌아가기',
      voice_loading_model: '음성 모델 로딩 중…', voice_recording: '녹음 중… 말씀해 주세요',
      voice_recorded: '녹음 완료. “음성 로그인” 탭', voice_extracting: '음성 특징 추출 중…',
      voice_sending: '서버에서 검증 중…',
      voice_login_ok: '음성 로그인 성공!', voice_login_fail: '음성 인증 실패',
      voice_enroll_title: '음성 등록', voice_enroll_btn: '음성 등록',
      voice_enroll_ok: '음성 등록 완료!', voice_enroll_fail: '음성 등록 실패',
      voice_need_login: '음성 등록 전에 먼저 로그인하세요', voice_error: '오류가 발생했습니다. 다시 시도하세요',
      voice_mic_fail: '마이크에 접근할 수 없습니다', voice_no_audio: '먼저 녹음하세요',
      nav_enroll_voice: '음성 등록', voice_read_prompt: '다음을 읽으세요', voice_rerecord: '다시 녹음', voice_rec: '녹음 중', voice_need_username: '사용자 이름을 입력하세요', voice_read_text: '오늘 날씨가 참 좋네요.', voice_lang_hint: '등록할 때와 같은 언어로 읽어 주세요', voice_info_title: '녹음 안내', voice_info_1: '조용한 환경에서 읽어주시고 배경 소음을 피해 주세요', voice_info_2: '등록할 때와 같은 언어로 위 문장을 읽어 주세요', voice_info_3: '녹음은 5초 후 자동 종료됩니다. 일정한 속도로 또렷하게 말씀해 주세요', voice_info_secure: '음성 데이터는 본인 로그인에만 사용되며 서버에서 암호화되어 저장됩니다.', voice_download: '녹음 다운로드', voice_upload: '녹음 업로드', voice_uploaded: '녹음 파일을 선택했습니다. “음성 로그인”을 탭하여 인증'
    },
    'es-ES': {
      voice_login: 'Inicio de sesión por voz', voice_login_title: 'Inicio de sesión por voz',
      voice_login_tip: 'Lee el texto en voz alta al micrófono y pulsa “Iniciar grabación”; la grabación se detiene sola tras 5 s',
      voice_status_ready: 'Pulsa “Iniciar grabación” para empezar', voice_record: 'Iniciar grabación', voice_stop_record: 'Detener grabación',
      voice_recognize: 'Iniciar sesión por voz', voice_back_account: 'Volver al inicio de sesión por cuenta',
      voice_loading_model: 'Cargando modelo de voz…', voice_recording: 'Grabando… por favor habla',
      voice_recorded: 'Grabado. Pulsa “Iniciar sesión por voz”', voice_extracting: 'Extrayendo características de voz…',
      voice_sending: 'Verificando con el servidor…',
      voice_login_ok: '¡Inicio de sesión por voz correcto!', voice_login_fail: 'Fallo la verificación de voz',
      voice_enroll_title: 'Registrar voz', voice_enroll_btn: 'Registrar voz',
      voice_enroll_ok: '¡Voz registrada!', voice_enroll_fail: 'Error al registrar la voz',
      voice_need_login: 'Inicia sesión antes de registrar tu voz', voice_error: 'Algo salió mal, inténtalo de nuevo',
      voice_mic_fail: 'No se puede acceder al micrófono', voice_no_audio: 'Graba primero',
      nav_enroll_voice: 'Registrar voz', voice_read_prompt: 'Lea en voz alta', voice_rerecord: 'Grabar de nuevo', voice_rec: 'Grabando', voice_need_username: 'Introduce tu nombre de usuario', voice_read_text: 'Hoy hace muy buen tiempo.', voice_lang_hint: 'Lee en el mismo idioma que usaste al registrar tu voz', voice_info_title: 'Notas de grabación', voice_info_1: 'Graba en un entorno tranquilo y evita el ruido de fondo', voice_info_2: 'Lee el texto de arriba en el mismo idioma que usaste al registrarte', voice_info_3: 'La grabación se detiene sola tras 5 s; habla con ritmo constante y claro', voice_info_secure: 'Tu voz se usa solo para tu propio inicio de sesión y se guarda cifrada en el servidor.', voice_download: 'Descargar grabación', voice_upload: 'Subir grabación', voice_uploaded: 'Archivo de grabación seleccionado. Pulsa “Iniciar sesión por voz” para verificar'
    },
    'vi-VN': {
      voice_login: 'Đăng nhập bằng giọng nói', voice_login_title: 'Đăng nhập bằng giọng nói',
      voice_login_tip: 'Đọc to văn bản bên dưới vào mic rồi nhấn “Bắt đầu ghi”; ghi âm tự dừng sau 5 giây',
      voice_status_ready: 'Nhấn “Bắt đầu ghi” để bắt đầu', voice_record: 'Bắt đầu ghi', voice_stop_record: 'Dừng ghi',
      voice_recognize: 'Đăng nhập bằng giọng nói', voice_back_account: 'Quay lại đăng nhập tài khoản',
      voice_loading_model: 'Đang tải mô hình giọng nói…', voice_recording: 'Đang ghi… hãy nói',
      voice_recorded: 'Đã ghi. Nhấn “Đăng nhập bằng giọng nói”', voice_extracting: 'Đang trích xuất đặc trưng giọng nói…',
      voice_sending: 'Đang xác thực với máy chủ…',
      voice_login_ok: 'Đăng nhập bằng giọng nói thành công!', voice_login_fail: 'Xác thực giọng nói thất bại',
      voice_enroll_title: 'Đăng ký giọng nói', voice_enroll_btn: 'Đăng ký giọng nói',
      voice_enroll_ok: 'Đã đăng ký giọng nói!', voice_enroll_fail: 'Đăng ký giọng nói thất bại',
      voice_need_login: 'Hãy đăng nhập trước khi đăng ký giọng nói', voice_error: 'Có lỗi, vui lòng thử lại',
      voice_mic_fail: 'Không thể truy cập mic', voice_no_audio: 'Hãy ghi âm trước',
      nav_enroll_voice: 'Đăng ký giọng nói', voice_read_prompt: 'Hãy đọc', voice_rerecord: 'Ghi lại', voice_rec: 'Đang ghi', voice_need_username: 'Vui lòng nhập tên người dùng', voice_read_text: 'Hôm nay thời tiết thật đẹp.', voice_lang_hint: 'Hãy đọc bằng ngôn ngữ bạn đã dùng khi đăng ký', voice_info_title: 'Lưu ý khi ghi', voice_info_1: 'Hãy ghi âm ở nơi yên tĩnh và tránh tiếng ồn xung quanh', voice_info_2: 'Đọc văn bản bên trên bằng ngôn ngữ bạn đã dùng khi đăng ký', voice_info_3: 'Ghi âm tự dừng sau 5 giây; hãy nói đều và rõ ràng', voice_info_secure: 'Giọng nói chỉ dùng cho đăng nhập của bạn và được mã hóa lưu trên máy chủ.', voice_download: 'Tải bản ghi', voice_upload: 'Tải lên bản ghi', voice_uploaded: 'Đã chọn tệp bản ghi. Nhấn “Đăng nhập bằng giọng nói” để xác thực'
    },
    'ar-SA': {
      voice_login: 'تسجيل الدخول بالصوت', voice_login_title: 'تسجيل الدخول ببصمة الصوت',
      voice_login_tip: 'اقرأ النص أدناه بصوت عالٍ أمام الميكروفون ثم اضغط “بدء التسجيل”؛ يتوقف التسجيل تلقائيًا بعد 5 ثوانٍ',
      voice_status_ready: 'اضغط “بدء التسجيل” للبدء', voice_record: 'بدء التسجيل', voice_stop_record: 'إيقاف التسجيل',
      voice_recognize: 'تسجيل الدخول بالصوت', voice_back_account: 'العودة إلى تسجيل الدخول بالحساب',
      voice_loading_model: 'جارٍ تحميل نموذج الصوت…', voice_recording: 'جارٍ التسجيل… تحدث الآن',
      voice_recorded: 'تم التسجيل. اضغط “تسجيل الدخول بالصوت”', voice_extracting: 'جارٍ استخراج ميزات الصوت…',
      voice_sending: 'جارٍ التحقق مع الخادم…',
      voice_login_ok: 'تم تسجيل الدخول بالصوت بنجاح!', voice_login_fail: 'فشل التحقق من الصوت',
      voice_enroll_title: 'تسجيل بصمة الصوت', voice_enroll_btn: 'تسجيل بصمة الصوت',
      voice_enroll_ok: 'تم تسجيل بصمة الصوت!', voice_enroll_fail: 'فشل تسجيل بصمة الصوت',
      voice_need_login: 'سجّل الدخول قبل تسجيل بصمة صوتك', voice_error: 'حدث خطأ، حاول مرة أخرى',
      voice_mic_fail: 'تعذّر الوصول إلى الميكروفون', voice_no_audio: 'سجّل أولاً',
      nav_enroll_voice: 'تسجيل بصمة الصوت', voice_read_prompt: 'اقرأ', voice_rerecord: 'إعادة التسجيل', voice_rec: 'جارٍ التسجيل', voice_need_username: 'الرجاء إدخال اسم المستخدم', voice_read_text: 'إن الجو جميل اليوم.', voice_lang_hint: 'يُرجى القراءة بنفس اللغة التي استخدمتها عند التسجيل', voice_info_title: 'ملاحظات التسجيل', voice_info_1: 'سجّل في بيئة هادئة وتجنّب ضجيج الخلفية', voice_info_2: 'اقرأ النص أعلاه بنفس اللغة التي استخدمتها عند التسجيل', voice_info_3: 'يتوقف التسجيل تلقائيًا بعد 5 ثوانٍ؛ تحدث بوضوح وبنبرة ثابتة', voice_info_secure: 'تُستخدم بصمة صوتك فقط لدخولك الشخصي وتُحفظ مشفّرة على الخادم.', voice_download: 'تحميل التسجيل', voice_upload: 'رفع التسجيل', voice_uploaded: 'تم اختيار ملف التسجيل. اضغط “تسجيل الدخول بالصوت” للتحقق'
    },
    'ru-RU': {
      voice_login: 'Вход по голосу', voice_login_title: 'Вход по голосовому отпечатку',
      voice_login_tip: 'Прочитайте текст ниже в микрофон, затем нажмите «Начать запись»; запись остановится через 5 секунд',
      voice_status_ready: 'Нажмите «Начать запись», чтобы начать', voice_record: 'Начать запись', voice_stop_record: 'Остановить запись',
      voice_recognize: 'Вход по голосу', voice_back_account: 'Назад к входу по аккаунту',
      voice_loading_model: 'Загрузка голосовой модели…', voice_recording: 'Идёт запись… говорите',
      voice_recorded: 'Записано. Нажмите «Вход по голосу»', voice_extracting: 'Извлечение голосовых признаков…',
      voice_sending: 'Проверка на сервере…',
      voice_login_ok: 'Вход по голосу выполнен!', voice_login_fail: 'Ошибка проверки голоса',
      voice_enroll_title: 'Записать голос', voice_enroll_btn: 'Записать голос',
      voice_enroll_ok: 'Голос записан!', voice_enroll_fail: 'Не удалось записать голос',
      voice_need_login: 'Войдите в аккаунт перед записью голоса', voice_error: 'Произошла ошибка, попробуйте снова',
      voice_mic_fail: 'Нет доступа к микрофону', voice_no_audio: 'Сначала запишите звук',
      nav_enroll_voice: 'Записать голос', voice_read_prompt: 'Прочитайте', voice_rerecord: 'Записать снова', voice_rec: 'Запись', voice_need_username: 'Введите имя пользователя', voice_read_text: 'Сегодня такая хорошая погода.', voice_lang_hint: 'Читайте на том же языке, что и при записи', voice_info_title: 'Правила записи', voice_info_1: 'Записывайте в тихом месте и избегайте фонового шума', voice_info_2: 'Читайте текст выше на том же языке, что при регистрации', voice_info_3: 'Запись автоматически остановится через 5 секунд; говорите ровно и чётко', voice_info_secure: 'Ваш голос используется только для вашего входа и хранится зашифрованным на сервере.', voice_download: 'Скачать запись', voice_upload: 'Загрузить запись', voice_uploaded: 'Файл записи выбран. Нажмите «Вход по голосу» для проверки'
    }
  };

  let voiceLibLoading = false;
  let voiceLibReady = false;
  let verifier = null;
  let mediaRecorder = null;
  let audioChunks = [];
  let recordedBlob = null;
  let recording = false;
  let stream = null;
  let recordCountdownTimer = null;
  let recordStopTimer = null;
  let mode = 'login'; // 'login' | 'enroll'

  const $ = (id) => document.getElementById(id);

  function t(key, fallback) {
    try {
      if (VOICE_I18N[currentLang] && VOICE_I18N[currentLang][key]) return VOICE_I18N[currentLang][key];
      const d = (typeof translations !== 'undefined' && currentLang && translations[currentLang]) ? translations[currentLang] : null;
      return (d && d[key]) || fallback || key;
    } catch (e) {
      return fallback || key;
    }
  }

  // 把声纹相关 data-i18n 文案按当前语言应用到 DOM（在外部 i18n 之后执行，覆盖中文兜底）
  function applyVoiceI18n() {
    const dict = VOICE_I18N[currentLang];
    if (!dict) return;
    document.querySelectorAll('[data-i18n]').forEach(el => {
      const k = el.getAttribute('data-i18n');
      // 只处理声纹自己的文案：不要用主字典兜底，否则会把其它含 HTML 的文案（如游戏中心消耗金额）
      // 用 textContent 覆盖成纯文本，破坏 innerHTML 渲染
      if (k && dict[k]) el.textContent = dict[k];
    });
  }

  function setStatus(msg) {
    const el = $('voice-status');
    if (el) el.textContent = msg;
  }

  // 固定朗读文本（按界面语言本地化）：注册与登录都读同一句，保证声纹特征一致、匹配更稳定
  const VOICE_READ_TEXT = '今天天气真好。';
  function generatePrompt() {
    const el = $('voice-prompt');
    if (!el) return;
    el.textContent = t('voice_read_prompt', '请朗读') + '：' + t('voice_read_text', VOICE_READ_TEXT);
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

  async function ensureVoiceLib() {
    if (voiceLibReady) return;
    if (voiceLibLoading) {
      while (!voiceLibReady) await new Promise(r => setTimeout(r, 80));
      return;
    }
    voiceLibLoading = true;
    try {
      if (typeof ort === 'undefined') {
        await loadScript('https://cdn.jsdelivr.net/npm/onnxruntime-web@1.16.3/dist/ort.min.js');
      }
      if (typeof SpeakerVerification === 'undefined') {
        await loadScript('https://cdn.jsdelivr.net/npm/@jaehyun-ko/speaker-verification@5.0.0/dist/speaker-verification.js');
      }
      verifier = new SpeakerVerification();
      await verifier.initialize('mobile-128');
      voiceLibReady = true;
    } finally {
      voiceLibLoading = false;
    }
  }

  function stopRecording() {
    if (mediaRecorder && mediaRecorder.state === 'recording') {
      try { mediaRecorder.stop(); } catch (e) {}
    }
    recording = false;
    if (stream) { stream.getTracks().forEach(t => t.stop()); stream = null; }
  }

  // 下载刚录制的音频（recordedBlob）
  function downloadRecording() {
    if (!recordedBlob) return;
    const url = URL.createObjectURL(recordedBlob);
    const a = document.createElement('a');
    const ty = recordedBlob.type || '';
    let ext = 'webm';
    if (ty.indexOf('mp4') >= 0) ext = 'mp4';
    else if (ty.indexOf('mpeg') >= 0 || ty.indexOf('mp3') >= 0) ext = 'mp3';
    else if (ty.indexOf('ogg') >= 0) ext = 'ogg';
    else if (ty.indexOf('wav') >= 0) ext = 'wav';
    a.href = url;
    a.download = 'voice-recording-' + Date.now() + '.' + ext;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  // 选择本地录音文件（如之前下载的录音），写入 recordedBlob 供登录/录入校验
  function onUploadChange(e) {
    const file = e.target && e.target.files && e.target.files[0];
    if (!file) return;
    recordedBlob = file;
    const dl = $('voice-download-btn');
    if (dl) { dl.disabled = false; dl.classList.remove('opacity-50', 'cursor-not-allowed'); }
    const sb = $('voice-submit-btn');
    if (sb) { sb.disabled = false; sb.classList.remove('opacity-50', 'cursor-not-allowed'); }
    const st = $('voice-status');
    if (st) { st.style.color = ''; st.textContent = t('voice_uploaded', '已选择录音文件，点击“声纹登录”验证'); }
  }

  async function toggleRecord() {
    const recordBtn = $('voice-record-btn');
    const status = $('voice-status');
    const submitBtn = $('voice-submit-btn');
    // 强制录满 3 秒：录音进行中不允许手动停止
    if (recording) return;
    try {
      recordedBlob = null;
      const dlBtn0 = $('voice-download-btn');
      if (dlBtn0) { dlBtn0.disabled = true; dlBtn0.classList.add('opacity-50', 'cursor-not-allowed'); }
      if (submitBtn) { submitBtn.disabled = true; submitBtn.classList.add('opacity-50', 'cursor-not-allowed'); }
      generatePrompt();
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioChunks = [];
      let mimeType = 'audio/webm';
      if (!MediaRecorder.isTypeSupported(mimeType)) mimeType = 'audio/mp4';
      mediaRecorder = new MediaRecorder(stream, { mimeType });
      mediaRecorder.ondataavailable = (e) => { if (e.data.size > 0) audioChunks.push(e.data); };
      mediaRecorder.onstop = () => {
        if (recordCountdownTimer) { clearInterval(recordCountdownTimer); recordCountdownTimer = null; }
        if (recordStopTimer) { clearTimeout(recordStopTimer); recordStopTimer = null; }
        recordedBlob = new Blob(audioChunks, { type: mimeType });
        recording = false;
        if (recordBtn) { recordBtn.textContent = t('voice_rerecord', '重新录制'); recordBtn.style.background = ''; recordBtn.disabled = false; recordBtn.classList.remove('opacity-50', 'cursor-not-allowed'); }
        if (status) status.textContent = t('voice_recorded', '已录制，点击“声纹登录”');
        if (submitBtn) { submitBtn.disabled = false; submitBtn.classList.remove('opacity-50', 'cursor-not-allowed'); }
        const dlBtn = $('voice-download-btn');
        if (dlBtn) { dlBtn.disabled = false; dlBtn.classList.remove('opacity-50', 'cursor-not-allowed'); }
        if (stream) { stream.getTracks().forEach(t => t.stop()); stream = null; }
      };
      mediaRecorder.start();
      recording = true;
      // 录音期间按钮变红且禁用，显示 3 秒倒计时
      if (recordBtn) { recordBtn.disabled = true; recordBtn.classList.add('opacity-50', 'cursor-not-allowed'); recordBtn.style.background = '#dc2626'; }
      if (status) status.textContent = t('voice_recording', '正在录音…请朗读上方文本');
      let remain = 5;
      if (recordBtn) recordBtn.textContent = t('voice_rec', '录音中') + ' (' + remain + ')';
      recordCountdownTimer = setInterval(() => {
        remain--;
        if (remain > 0) {
          if (recordBtn) recordBtn.textContent = t('voice_rec', '录音中') + ' (' + remain + ')';
        } else if (recordCountdownTimer) {
          clearInterval(recordCountdownTimer);
          recordCountdownTimer = null;
        }
      }, 1000);
      // 强制录满 5 秒后自动停止
      recordStopTimer = setTimeout(() => {
        if (mediaRecorder && mediaRecorder.state === 'recording') mediaRecorder.stop();
      }, 5000);
    } catch (err) {
      recording = false;
      if (recordCountdownTimer) { clearInterval(recordCountdownTimer); recordCountdownTimer = null; }
      if (recordStopTimer) { clearTimeout(recordStopTimer); recordStopTimer = null; }
      const msg = (err && err.message) || t('voice_mic_fail', '无法访问麦克风');
      if (status) status.textContent = msg;
      if (recordBtn) { recordBtn.disabled = false; recordBtn.style.background = ''; recordBtn.classList.remove('opacity-50', 'cursor-not-allowed'); }
      if (submitBtn) submitBtn.disabled = false;
    }
  }

  // 复用站点既有登录成功逻辑：写 localStorage + 刷新导航
  function completeLogin(data) {
    const userInfoWithPrice = window.applyLoginData(data);
    if (!userInfoWithPrice) return;
    localStorage.setItem('userInfo', JSON.stringify(userInfoWithPrice));
    localStorage.setItem('loginTime', Date.now());
    if (typeof window.updateNav === 'function') window.updateNav(userInfoWithPrice);
    try { window.GameCenterModule && window.GameCenterModule.renderGameHistory && window.GameCenterModule.renderGameHistory('wheel'); } catch (e) {}
    // 登录后同步最新用户态（含订单历史等），统一走 refreshUserSession
    if (window.refreshUserSession) window.refreshUserSession();
  }

  function showVoicePanel(m) {
    mode = m;
    $('immmor-wallet-landing') && $('immmor-wallet-landing').classList.add('hidden');
    const modal = $('auth-modal');
    if (modal) modal.classList.remove('hidden');
    $('auth-form') && $('auth-form').classList.add('hidden');
    $('auth-switch-block') && $('auth-switch-block').classList.add('hidden');
    $('forgot-pwd-container') && $('forgot-pwd-container').classList.add('hidden');
    $('auth-message') && $('auth-message').classList.add('hidden');

    const panel = $('voice-login-panel');
    panel.classList.remove('hidden');
    panel.classList.add('flex');
    // 仅录入声纹时隐藏左侧图片；登录模式保留图片
    const _hero = $('auth-hero'); if (_hero) _hero.style.display = (m === 'enroll') ? 'none' : '';
    // 顶部标题：录入模式显示“录入声纹”，登录模式显示“登录”
    const _mt = $('modal-title');
    if (_mt) {
      _mt.classList.remove('hidden');
      _mt.textContent = (m === 'enroll') ? t('voice_enroll_title', '录入声纹') : t('modal_title_login', '登录');
    }

    const titleEl = panel.querySelector('h3');
    const submitBtn = $('voice-submit-btn');
    const recordBtn = $('voice-record-btn');
    if (m === 'enroll') {
      if (titleEl) { titleEl.textContent = t('voice_enroll_title', '录入声纹'); titleEl.style.display = 'none'; }
      if (submitBtn) submitBtn.textContent = t('voice_enroll_btn', '录入声纹');
    } else {
      if (titleEl) { titleEl.textContent = t('voice_login_title', '声纹识别登录'); titleEl.style.display = ''; }
      if (submitBtn) submitBtn.textContent = t('voice_recognize', '声纹登录');
    }
    // 录入模式（已登录，从账户菜单进入）不显示“返回账号登录”和用户名输入
    const backBtn = $('voice-back-btn');
    if (backBtn) backBtn.style.display = (m === 'enroll') ? 'none' : '';
    const userInput = $('voice-username');
    if (userInput) userInput.style.display = (m === 'enroll') ? 'none' : '';
    // “用相同语言朗读”的提醒只在登录模式显示（录入模式无需）
    const langHint = $('voice-lang-hint');
    if (langHint) langHint.style.display = (m === 'enroll') ? 'none' : '';
    // 录入界面不需要上传按钮（本就用麦克风录入），登录界面不需要下载按钮
    const uploadBtn = $('voice-upload-btn');
    if (uploadBtn) uploadBtn.style.display = (m === 'enroll') ? 'none' : '';
    const downloadBtn = $('voice-download-btn');
    if (downloadBtn) downloadBtn.style.display = (m === 'login') ? 'none' : '';
    // 复位状态
    recordedBlob = null;
    const dlBtnR = $('voice-download-btn');
    if (dlBtnR) { dlBtnR.disabled = true; dlBtnR.classList.add('opacity-50', 'cursor-not-allowed'); }
    const upInp = $('voice-upload-input');
    if (upInp) upInp.value = '';
    recording = false;
    generatePrompt();
    if (recordBtn) { recordBtn.textContent = t('voice_record', '开始录音'); recordBtn.style.background = ''; recordBtn.disabled = true; recordBtn.classList.add('opacity-50', 'cursor-not-allowed'); }
    if (submitBtn) { submitBtn.disabled = true; submitBtn.classList.add('opacity-50', 'cursor-not-allowed'); }
    const status = $('voice-status');
    if (status) { status.style.color = ''; status.textContent = t('voice_loading_model', '正在加载声纹模型…'); }
    ensureVoiceLib().then(() => {
      if (status) status.textContent = t('voice_status_ready', '点击“开始录音”录入声纹');
      if (recordBtn) { recordBtn.disabled = false; recordBtn.classList.remove('opacity-50', 'cursor-not-allowed'); }
    }).catch((err) => {
      if (status) status.textContent = (err && err.message) || t('voice_error', '出错了，请重试');
    });
  }

  function restoreAccountView() {
    const panel = $('voice-login-panel');
    if (panel) { panel.classList.add('hidden'); panel.classList.remove('flex'); }
    const _hero = $('auth-hero'); if (_hero) _hero.style.display = '';
    const _mt = $('modal-title'); if (_mt) { _mt.classList.remove('hidden'); _mt.textContent = t('modal_title_login', '登录'); }
    stopRecording();
    $('auth-form') && $('auth-form').classList.remove('hidden');
    $('auth-switch-block') && $('auth-switch-block').classList.remove('hidden');
  }

  function closeVoiceAndRestore() {
    restoreAccountView();
    const modal = $('auth-modal');
    if (modal) modal.classList.add('hidden');
  }

  async function onSubmit() {
    const status = $('voice-status');
    const submitBtn = $('voice-submit-btn');
    const recordBtn = $('voice-record-btn');
    if (submitBtn) submitBtn.disabled = true;
    if (status) status.style.color = '';
    try {
      if (mode === 'login') {
        const uname = (($('voice-username') && $('voice-username').value) || '').trim();
        if (!uname) {
          const msg = t('voice_need_username', '请输入用户名');
          if (status) { status.textContent = msg; status.style.color = 'var(--neon-red)'; }
          if (submitBtn) submitBtn.disabled = false;
          return;
        }
      }
      if (!recordedBlob) {
        const msg = t('voice_no_audio', '请先录音');
        if (status) { status.textContent = msg; status.style.color = 'var(--neon-red)'; }
        if (submitBtn) submitBtn.disabled = false;
        return;
      }
      if (status) status.textContent = t('voice_extracting', '正在提取声纹特征…');
      if (!voiceLibReady || !verifier) await ensureVoiceLib();
      const embRes = await verifier.getEmbedding(recordedBlob);
      const embedding = Array.from(embRes.embedding);
      if (status) status.textContent = t('voice_sending', '正在发送到服务器验证…');

      if (mode === 'login') {
        const uname = (($('voice-username') && $('voice-username').value) || '').trim();
        const res = await fetch(`${API}/api/voice-login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username: uname, embedding })
        });
        const data = await res.json();
        if (data && data.success) {
          // 成功时也展示识别结果（相似度 / 阈值），便于核对与校准
          let msg = data.message || t('voice_login_ok', '声纹登录成功！');
          if (typeof data.sim === 'number') msg += `（相似度 ${data.sim}${data.threshold ? ' / 阈值 ' + data.threshold : ''}）`;
          if (status) { status.textContent = msg; status.style.color = 'var(--neon-green)'; }
          setTimeout(() => { completeLogin(data); closeVoiceAndRestore(); }, 1300);
        } else {
          // 显示实测相似度，辅助校准阈值（data.sim 由后端在失败时返回）
          let msg = data && data.message ? data.message : t('voice_login_fail', '声纹验证失败');
          if (data && typeof data.sim === 'number') msg += `（相似度 ${data.sim}${data.threshold ? ' / 阈值 ' + data.threshold : ''}）`;
          if (status) { status.textContent = msg; status.style.color = 'var(--neon-red)'; }
          if (submitBtn) submitBtn.disabled = false;
        }
      } else {
        const info = JSON.parse(localStorage.getItem('userInfo') || '{}');
        if (!info.username || !info.p_token) {
          const msg = t('voice_need_login', '请先登录后再录入声纹');
          if (status) { status.textContent = msg; status.style.color = 'var(--neon-red)'; }
          if (submitBtn) submitBtn.disabled = false;
          return;
        }
        const res = await fetch(`${API}/api/save-voice`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username: info.username, p_token: info.p_token, embedding })
        });
        const data = await res.json();
        if (data && data.success) {
          const msg = t('voice_enroll_ok', '声纹录入成功！');
          if (status) { status.textContent = msg; status.style.color = 'var(--neon-green)'; }
          setTimeout(closeVoiceAndRestore, 1300);
        } else {
          const msg = t('voice_enroll_fail', '声纹录入失败');
          if (status) { status.textContent = msg; status.style.color = 'var(--neon-red)'; }
          if (submitBtn) submitBtn.disabled = false;
        }
      }
    } catch (err) {
      const msg = t('voice_error', '出错了，请重试');
      if (status) { status.textContent = msg; status.style.color = 'var(--neon-red)'; }
      if (submitBtn) submitBtn.disabled = false;
    }
  }

  // 检测浏览器是否支持语音录制：需 getUserMedia + MediaRecorder + 可用音频格式
  function voiceSupported() {
    try {
      return !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia &&
                typeof MediaRecorder !== 'undefined' &&
                (MediaRecorder.isTypeSupported('audio/webm') || MediaRecorder.isTypeSupported('audio/mp4')));
    } catch (e) { return false; }
  }

  function init() {
    applyVoiceI18n();
    document.addEventListener('languageChanged', applyVoiceI18n);
    // 不支持语音录制的浏览器：隐藏声纹入口，避免用户点到失败
    if (!voiceSupported()) {
      const lb = $('voice-login-btn'); if (lb) lb.style.display = 'none';
      const eb = $('enroll-voice-btn'); if (eb) eb.style.display = 'none';
      return;
    }
    $('voice-login-btn') && $('voice-login-btn').addEventListener('click', () => showVoicePanel('login'));
    $('enroll-voice-btn') && $('enroll-voice-btn').addEventListener('click', () => {
      const menu = $('dropdown-menu');
      if (menu) menu.classList.add('hidden');
      showVoicePanel('enroll');
    });
    $('voice-record-btn') && $('voice-record-btn').addEventListener('click', toggleRecord);
    $('voice-submit-btn') && $('voice-submit-btn').addEventListener('click', onSubmit);
    $('voice-download-btn') && $('voice-download-btn').addEventListener('click', downloadRecording);
    $('voice-upload-btn') && $('voice-upload-btn').addEventListener('click', () => { const inp = $('voice-upload-input'); if (inp) inp.click(); });
    $('voice-upload-input') && $('voice-upload-input').addEventListener('change', onUploadChange);
    $('voice-back-btn') && $('voice-back-btn').addEventListener('click', restoreAccountView);
    $('modal-close') && $('modal-close').addEventListener('click', restoreAccountView);
    const modal = $('auth-modal');
    if (modal) modal.addEventListener('click', (e) => { if (e.target === modal) restoreAccountView(); });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
