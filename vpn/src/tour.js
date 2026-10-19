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
        'en-US': { name: 'Support', skip: 'Skip', prev: 'Back', next: 'Next', finish: 'Done' },
        'ja-JP': { name: 'サポート', skip: 'スキップ', prev: '前へ', next: '次へ', finish: '完了' },
        'ko-KR': { name: '고객지원', skip: '건너뛰기', prev: '이전', next: '다음', finish: '완료' },
        'es-ES': { name: 'Soporte', skip: 'Omitir', prev: 'Atrás', next: 'Siguiente', finish: 'Listo' },
        'vi-VN': { name: 'Hỗ trợ', skip: 'Bỏ qua', prev: 'Trước', next: 'Tiếp', finish: 'Xong' },
        'ar-SA': { name: 'الدعم', skip: 'تخطي', prev: 'السابق', next: 'التالي', finish: 'إنهاء' },
        'ru-RU': { name: 'Поддержка', skip: 'Пропустить', prev: 'Назад', next: 'Далее', finish: 'Готово' }
    };
    const ui = (k) => (UI[window.currentLang] || UI['zh-CN'])[k] || UI['zh-CN'][k];
    const txt = (o) => (o && (o[window.currentLang] || o['zh-CN'])) || '';

    // ===== 步骤定义 =====
    // click: 该步骤是否需要指针去真实点击（true 时指针出现并点击；false 时仅头像移动）
    // kind:  'link'    打开新标签页
    //        'dropdown' 点击展开下拉（离开时再次点击收起）
    //        'toggle'   点击切换状态（离开时再次点击还原，如主题）
    //        'modal'    点击打开弹窗（离开时隐藏弹窗）
    // ===== 步骤定义（按“大功能”分组）=====
    // 进入一个大功能后，导览会自动逐个介绍它里面的“小功能”，无需用户一步一步点击；
    // 想慢慢看时可随时暂停。click / kind 含义见上方注释。
    const GROUPS = [
        {
            title: { 'zh-CN': '顶部导航栏', 'en-US': 'Top Navigation', 'ja-JP': 'トップナビゲーション', 'ko-KR': '상단 네비게이션', 'es-ES': 'Barra superior', 'vi-VN': 'Thanh điều hướng', 'ar-SA': 'شريط التنقل العلوي', 'ru-RU': 'Верхняя навигация' },
            steps: [
                {
                    sel: '#tour-install', click: true, kind: 'link', noClick: true,
                    t: { 'zh-CN': '安装教程入口', 'en-US': 'Install Guide', 'ja-JP': 'インストール手順', 'ko-KR': '설치 가이드', 'es-ES': 'Guía de instalación', 'vi-VN': 'Hướng dẫn cài đặt', 'ar-SA': 'دليل التثبيت', 'ru-RU': 'Установка' },
                    d: {
                        'zh-CN': '「安装」：点击跳转到客户端安装教程页，按平台（Windows / Android / iOS / macOS / Linux）下载并配置 PHANTOM 客户端。',
                        'en-US': '"Install": jump to the client setup guide and download & configure PHANTOM for your platform (Windows / Android / iOS / macOS / Linux).',
                        'ja-JP': '「インストール」：クリックでクライアントのインストール手順ページへ移動し、プラットフォーム（Windows / Android / iOS / macOS / Linux）ごとに PHANTOM クライアントをダウンロードして設定します。',
                        'ko-KR': '「설치」: 클릭하면 클라이언트 설치 가이드로 이동하며, 플랫폼별(Windows / Android / iOS / macOS / Linux)로 PHANTOM 클라이언트를 다운로드·설정합니다.',
                        'es-ES': '«Instalar»: abre la guía de configuración del cliente y descarga y configura PHANTOM para tu plataforma (Windows / Android / iOS / macOS / Linux).',
                        'vi-VN': '「Cài đặt」: mở trang hướng dẫn cài đặt client, tải và cấu hình PHANTOM cho nền tảng của bạn (Windows / Android / iOS / macOS / Linux).',
                        'ar-SA': '«التثبيت»: ينقلك إلى دليل إعداد العميل لتنزيل وتهيئة PHANTOM لمنصتك (Windows / Android / iOS / macOS / Linux).',
                        'ru-RU': '«Установка»: откройте руководство по настройке клиента и скачайте/настройте PHANTOM для вашей платформы (Windows / Android / iOS / macOS / Linux).'
                    }
                },
                {
                    sel: '#lang-btn', click: true, kind: 'dropdown',
                    t: { 'zh-CN': '语言切换', 'en-US': 'Language', 'ja-JP': '言語切替', 'ko-KR': '언어 전환', 'es-ES': 'Idioma', 'vi-VN': 'Ngôn ngữ', 'ar-SA': 'اللغة', 'ru-RU': 'Язык' },
                    d: {
                        'zh-CN': '「语言」：点击展开语言菜单，支持简体中文、English、한국어、العربية、Русский、Español、日本語、Tiếng Việt 一键切换。',
                        'en-US': '"Language": open the menu to switch between 简体中文, English, 한국어, العربية, Русский, Español, 日本語, Tiếng Việt.',
                        'ja-JP': '「言語」：クリックで言語メニューを開き、簡体中文・English・한국어・العربية・Русский・Español・日本語・Tiếng Việt をワンタップで切り替えられます。',
                        'ko-KR': '「언어」: 클릭하면 언어 메뉴가 열리며, 简体中文·English·한국어·العربية·Русский·Español·日本語·Tiếng Việt 중에서 한 번에 전환할 수 있습니다.',
                        'es-ES': '«Idioma»: abre el menú para cambiar entre 简体中文, English, 한국어, العربية, Русский, Español, 日本語, Tiếng Việt.',
                        'vi-VN': '「Ngôn ngữ」: mở menu để chuyển đổi giữa 简体中文, English, 한국어, العربية, Русский, Español, 日本語, Tiếng Việt.',
                        'ar-SA': '«اللغة»: افتح القائمة للتبديل بين 简体中文 وEnglish و한국어 والعربية وРусский وEspañol و日本語 وTiếng Việt.',
                        'ru-RU': '«Язык»: откройте меню для переключения между 简体中文, English, 한국어, العربية, Русский, Español, 日本語, Tiếng Việt.'
                    }
                },
                {
                    sel: '#theme-toggle-btn', click: true, kind: 'toggle',
                    t: { 'zh-CN': '主题切换', 'en-US': 'Theme', 'ja-JP': 'テーマ切替', 'ko-KR': '테마 전환', 'es-ES': 'Tema', 'vi-VN': 'Giao diện', 'ar-SA': 'السمة', 'ru-RU': 'Тема' },
                    d: {
                        'zh-CN': '「主题」：点击在深色 / 浅色界面之间切换，跟随你的使用习惯与时段。',
                        'en-US': '"Theme": toggle between dark and light UI to match your preference and time of day.',
                        'ja-JP': '「テーマ」：クリックでダーク / ライトの UI を切り替え、使いやすい方や時間帯に合わせられます。',
                        'ko-KR': '「테마」: 클릭하면 다크/라이트 UI를 전환하여 습관과 시간대에 맞출 수 있습니다.',
                        'es-ES': '«Tema»: alterna entre la interfaz oscura y clara según tu preferencia y la hora del día.',
                        'vi-VN': '「Giao diện」: nhấn để chuyển giữa giao diện tối / sáng theo sở thích và thời điểm.',
                        'ar-SA': '«السمة»: بدّل بين الواجهة الداكنة والفاتحة حسب تفضيلك ووقت اليوم.',
                        'ru-RU': '«Тема»: переключайтесь между тёмным и светлым интерфейсом под ваши привычки и время суток.'
                    }
                },
                {
                    sel: '#notification-btn', click: true, kind: 'dropdown',
                    t: { 'zh-CN': '系统通知', 'en-US': 'Notifications', 'ja-JP': '通知', 'ko-KR': '알림', 'es-ES': 'Notificaciones', 'vi-VN': 'Thông báo', 'ar-SA': 'الإشعارات', 'ru-RU': 'Уведомления' },
                    d: {
                        'zh-CN': '「通知」：点击查看活动、福利与系统消息；未读时按钮上会有红点提示，点开后底部还能「联系客服」。',
                        'en-US': '"Notifications": view campaigns, perks and system messages; a red dot marks unread items, and you can also "Contact support" from there.',
                        'ja-JP': '「通知」：クリックでキャンペーン・特典・システムメッセージを確認できます。未読があるとボタンに赤い点が表示され、開くと下部から「サポートへ連絡」もできます。',
                        'ko-KR': '「알림」: 클릭하면 이벤트·혜택·시스템 메시지를 볼 수 있습니다. 읽지 않으면 버튼에 빨간 점이 표시되고, 열면 하단에서 「고객센터 문의」도 가능합니다.',
                        'es-ES': '«Notificaciones»: consulta campañas, beneficios y mensajes del sistema; un punto rojo marca los no leídos y también puedes «Contactar con soporte» desde ahí.',
                        'vi-VN': '「Thông báo」: xem chiến dịch, ưu đãi và tin nhắn hệ thống; chấm đỏ báo chưa đọc, và bạn có thể «Liên hệ hỗ trợ」 từ đây.',
                        'ar-SA': '«الإشعارات»: اعرض الحملات والمزايا ورسائل النظام؛ تشير نقطة حمراء إلى غير المقروء، ويمكنك أيضاً «التواصل مع الدعم» من هناك.',
                        'ru-RU': '«Уведомления»: просматривайте акции, бонусы и системные сообщения; красная точка отмечает непрочитанное, а также можно «Связаться с поддержкой» оттуда.'
                    }
                }
            ]
        },
        {
            title: { 'zh-CN': '节点套餐', 'en-US': 'Node Plans', 'ja-JP': 'ノードプラン', 'ko-KR': '노드 요금제', 'es-ES': 'Planes de nodos', 'vi-VN': 'Gói nút', 'ar-SA': 'باقات العقد', 'ru-RU': 'Тарифы узлов' },
            steps: [
                {
                    sel: '#tour-free', click: true, kind: 'modal',
                    t: { 'zh-CN': '免费节点包', 'en-US': 'Free Node Pack', 'ja-JP': '無料ノードパック', 'ko-KR': '무료 노드 팩', 'es-ES': 'Paquete gratis', 'vi-VN': 'Gói nút miễn phí', 'ar-SA': 'باقة مجانية', 'ru-RU': 'Бесплатный пакет' },
                    d: {
                        'zh-CN': '免费节点包：零门槛体验，点击即可领取免费节点，先试用再决定是否升级。',
                        'en-US': 'Free node pack: try the service for free with zero cost before upgrading.',
                        'ja-JP': '無料ノードパック：手軽に体験でき、クリックするだけで無料ノードを受け取れます。まず試してからアップグレードするか決められます。',
                        'ko-KR': '무료 노드 팩: 진입 장벽 없이 체험 가능하며, 클릭만으로 무료 노드를 받아 먼저 써보고 업그레이드를 결정할 수 있습니다.',
                        'es-ES': 'Paquete de nodos gratis: prueba el servicio sin costo antes de actualizar.',
                        'vi-VN': 'Gói nút miễn phí: trải nghiệm không rào cản, nhấn để nhận node miễn phí, dùng thử trước khi nâng cấp.',
                        'ar-SA': 'باقة العقد المجانية: جرّب الخدمة مجاناً دون أي تكلفة قبل الترقية.',
                        'ru-RU': 'Бесплатный пакет узлов: попробуйте сервис бесплатно, прежде чем обновлять.'
                    }
                },
                {
                    sel: '#tour-monthly', click: true, kind: 'modal',
                    t: { 'zh-CN': '月付节点包', 'en-US': 'Monthly Plan', 'ja-JP': '月額ノードパック', 'ko-KR': '월간 노드 팩', 'es-ES': 'Plan mensual', 'vi-VN': 'Gói tháng', 'ar-SA': 'الباقة الشهرية', 'ru-RU': 'Месячный план' },
                    d: {
                        'zh-CN': '月付节点包：按月付费，限时折扣中，适合短期或初次体验的用户，随时可续费。',
                        'en-US': 'Monthly plan: pay monthly with a limited-time discount — ideal for short-term or first-time users.',
                        'ja-JP': '月額ノードパック：月単位で支払い、期間限定の割引中。短期利用や初めての方に最適で、いつでも更新可能です。',
                        'ko-KR': '월간 노드 팩: 매월 결제하며 한정 기간 할인 중이라 단기나 처음 사용하는 분께 적합하고 언제든 연장할 수 있습니다.',
                        'es-ES': 'Plan mensual: paga mes a mes con un descuento por tiempo limitado — ideal para usuarios ocasionales o primerizos.',
                        'vi-VN': 'Gói tháng: trả theo tháng với ưu đãi có hạn — phù hợp cho người dùng ngắn hạn hoặc mới bắt đầu.',
                        'ar-SA': 'الباقة الشهرية: ادفع شهرياً بخصم محدود الوقت — مثالية للمستخدمين قصيري الأمد أو الجدد.',
                        'ru-RU': 'Месячный план: платите помесячно со скидкой ограниченное время — идеально для краткосрочных или новых пользователей.'
                    }
                },
                {
                    sel: '#tour-annual', click: true, kind: 'modal',
                    t: { 'zh-CN': '年付节点包', 'en-US': 'Yearly Plan', 'ja-JP': '年額ノードパック', 'ko-KR': '연간 노드 팩', 'es-ES': 'Plan anual', 'vi-VN': 'Gói năm', 'ar-SA': 'الباقة السنوية', 'ru-RU': 'Годовой план' },
                    d: {
                        'zh-CN': '年付节点包：一次性购买一年，立省更多，长期使用的性价比之选。',
                        'en-US': 'Yearly plan: one purchase covers a full year with the best savings — great for long-term use.',
                        'ja-JP': '年額ノードパック：1年分をまとめて購入でお得になり、長期利用におすすめです。',
                        'ko-KR': '연간 노드 팩: 1년치를 한 번에 구매하면 더 절약되며 장기 이용에 가장 효율적입니다.',
                        'es-ES': 'Plan anual: una sola compra cubre todo un año con el mayor ahorro — genial para uso a largo plazo.',
                        'vi-VN': 'Gói năm: một lần thanh toán cho cả năm với tiết kiệm lớn nhất — lựa chọn lý tưởng cho dùng lâu dài.',
                        'ar-SA': 'الباقة السنوية: شراء واحد يغطي سنة كاملة بأفضل توفير — ممتاز للاستخدام الطويل.',
                        'ru-RU': 'Годовой план: одна покупка на целый год с максимальной экономией — отлично для долгосрочного использования.'
                    }
                },
                {
                    sel: '#tour-custom', click: true, kind: 'modal',
                    t: { 'zh-CN': '定制节点', 'en-US': 'Custom Nodes', 'ja-JP': 'カスタムノード', 'ko-KR': '맞춤 노드', 'es-ES': 'Nodos personalizados', 'vi-VN': 'Nút tùy chỉnh', 'ar-SA': 'العقد المخصصة', 'ru-RU': 'Пользовательские узлы' },
                    d: {
                        'zh-CN': '定制节点：若对节点有专属需求（特定地区、独享带宽等），可联系我们定制方案，价格详谈。',
                        'en-US': 'Custom nodes: need a dedicated region or bandwidth? Contact us for a tailored plan.',
                        'ja-JP': 'カスタムノード：特定の地域や専有帯域など専用のご要件がある場合は、お問い合わせください。価格はご相談です。',
                        'ko-KR': '맞춤 노드: 특정 지역이나 전용 대역폭 등 전용 요구가 있으면 맞춤 플랜을 상담할 수 있습니다.',
                        'es-ES': 'Nodos personalizados: ¿necesitas una región o ancho de banda dedicado? Contáctanos para un plan a medida.',
                        'vi-VN': 'Nút tùy chỉnh: cần khu vực riêng hoặc băng thông riêng? Liên hệ để có gói riêng.',
                        'ar-SA': 'العقد المخصصة: تحتاج منطقة أو سرعة مخصصة؟ تواصل معنا لخطة مخصصة.',
                        'ru-RU': 'Пользовательские узлы: нужен выделенный регион или канал? Свяжитесь с нами для индивидуального плана.'
                    }
                }
            ]
        },
        {
            title: { 'zh-CN': '更多亮点', 'en-US': 'More Highlights', 'ja-JP': 'その他の特徴', 'ko-KR': '더 많은 특징', 'es-ES': 'Más destacados', 'vi-VN': 'Điểm nổi bật', 'ar-SA': 'المزيد من المميزات', 'ru-RU': 'Другие преимущества' },
            steps: [
                {
                    sel: '#game-section', click: false,
                    t: { 'zh-CN': '游戏中心', 'en-US': 'Game Center', 'ja-JP': 'ゲームセンター', 'ko-KR': '게임 센터', 'es-ES': 'Centro de juegos', 'vi-VN': 'Trung tâm game', 'ar-SA': 'مركز الألعاب', 'ru-RU': 'Игровой центр' },
                    d: {
                        'zh-CN': '游戏中心：每日签到、幸运转盘、老虎机等小游戏，玩游戏赢取福利与节点时长，边玩边省。',
                        'en-US': 'Game center: daily check-in, lucky wheel, slots and more — play to earn perks and node time.',
                        'ja-JP': 'ゲームセンター：毎日の签到・幸運のルーレット・スロットなどのミニゲームで、特典やノード時間を獲得できます。遊びながら節約。',
                        'ko-KR': '게임 센터: 매일 출석, 행운의 룰렛, 슬롯 등 미니게임으로 혜택과 노드 시간을 얻고 즐기며 아낄 수 있습니다.',
                        'es-ES': 'Centro de juegos: check-in diario, ruleta de la suerte, tragamonedas y más — juega para ganar beneficios y tiempo de nodo.',
                        'vi-VN': 'Trung tâm game: điểm danh hàng ngày, vòng quay may mắn, slot và hơn thế nữa — chơi để nhận ưu đãi và thời gian node.',
                        'ar-SA': 'مركز الألعاب: تسجيل يومي وحظ وجهاز وسائط أكثر — العب لربح المزايا ووقت العقد.',
                        'ru-RU': 'Игровой центр: ежедневная отметка, колесо фортуны, слоты и другое — играйте, чтобы получать бонусы и время узлов.'
                    }
                },
                {
                    sel: '#tour-nodes', click: false,
                    t: { 'zh-CN': '热门节点分布', 'en-US': 'Popular Nodes', 'ja-JP': '人気ノード', 'ko-KR': '인기 노드', 'es-ES': 'Nodos populares', 'vi-VN': 'Nút phổ biến', 'ar-SA': 'العقد الشائعة', 'ru-RU': 'Популярные узлы' },
                    d: {
                        'zh-CN': '热门节点：覆盖美国、日本、新加坡等 10+ 国家和地区，高速稳定，就近选择延迟更低。',
                        'en-US': 'Popular nodes: 10+ countries & regions including US, Japan, Singapore — pick the nearest for lower latency.',
                        'ja-JP': '人気ノード：米国・日本・シンガポールなど 10 以上の国と地域をカバー。高速で安定、近いところを選ぶと遅延が低くなります。',
                        'ko-KR': '인기 노드: 미국·일본·싱가포르 등 10개 이상 국가·지역을 커버하며 안정적이고 고속입니다. 가까운 곳을 골라 지연을 줄이세요.',
                        'es-ES': 'Nodos populares: 10+ países y regiones incluyendo EE. UU., Japón, Singapur — elige el más cercano para menor latencia.',
                        'vi-VN': 'Nút phổ biến: hơn 10 quốc gia/vùng lãnh thổ gồm Mỹ, Nhật, Singapore — chọn gần nhất để độ trễ thấp.',
                        'ar-SA': 'العقد الشائعة: 10+ دول ومناطق منها أمريكا واليابان وسنغافورة — اختر الأقرب لزمن وصول أقل.',
                        'ru-RU': 'Популярные узлы: 10+ стран и регионов, включая США, Японию, Сингапур — выбирайте ближайший для меньшей задержки.'
                    }
                },
                {
                    sel: '#tour-compare', click: false,
                    t: { 'zh-CN': '为什么选择 PHANTOM', 'en-US': 'Why PHANTOM', 'ja-JP': 'PHANTOM を選ぶ理由', 'ko-KR': 'PHANTOM을 선택하는 이유', 'es-ES': 'Por qué PHANTOM', 'vi-VN': 'Tại sao chọn PHANTOM', 'ar-SA': 'لماذا PHANTOM', 'ru-RU': 'Почему PHANTOM' },
                    d: {
                        'zh-CN': '为什么选择 PHANTOM：这里对比我们的核心优势——十年老品牌、隐私保护、多协议支持、稳定高速。',
                        'en-US': 'Why PHANTOM: our core advantages — 10-year brand, privacy protection, multi-protocol support, stable & fast.',
                        'ja-JP': 'PHANTOM を選ぶ理由：10年の老舗ブランド、プライバシー保護、マルチプロトコル対応、安定かつ高速という強みを比較しています。',
                        'ko-KR': 'PHANTOM을 선택하는 이유: 10년 브랜드, 개인정보 보호, 멀티 프로토콜 지원, 안정적·고속이라는 핵심 장점을 비교합니다.',
                        'es-ES': 'Por qué PHANTOM: nuestras ventajas clave — marca de 10 años, protección de privacidad, soporte multi-protocolo, estable y rápido.',
                        'vi-VN': 'Tại sao chọn PHANTOM: ưu điểm cốt lõi — thương hiệu 10 năm, bảo vệ riêng tư, đa giao thức, ổn định và nhanh.',
                        'ar-SA': 'لماذا PHANTOM: مزايانا الأساسية — علامة تجارية من 10 سنوات، حماية الخصوصية، دعم متعدد البروتوكولات، مستقر وسريع.',
                        'ru-RU': 'Почему PHANTOM: наши ключевые преимущества — бренд с 10-летней историей, защита приватности, поддержка нескольких протоколов, стабильность и скорость.'
                    }
                },
                {
                    sel: '#tour-testimonials', click: false,
                    t: { 'zh-CN': '客户评价', 'en-US': 'Testimonials', 'ja-JP': 'お客様の声', 'ko-KR': '고객 후기', 'es-ES': 'Testimonios', 'vi-VN': 'Đánh giá khách hàng', 'ar-SA': 'آراء العملاء', 'ru-RU': 'Отзывы клиентов' },
                    d: {
                        'zh-CN': '客户评价：来自全球用户的真实反馈，看看大家为什么选择并推荐 PHANTOM。',
                        'en-US': 'Testimonials: real feedback from users worldwide on why they choose and recommend PHANTOM.',
                        'ja-JP': 'お客様の声：世界中のユーザーからのリアルなフィードバック。皆が PHANTOM を選び、推荐する理由をご覧ください。',
                        'ko-KR': '고객 후기: 전 세계 사용자의 실제 피드백으로, 모두가 PHANTOM을 선택하고 추천하는 이유를 확인하세요.',
                        'es-ES': 'Testimonios: opiniones reales de usuarios de todo el mundo sobre por qué eligen y recomiendan PHANTOM.',
                        'vi-VN': 'Đánh giá khách hàng: phản hồi thực từ người dùng toàn cầu về lý do họ chọn và giới thiệu PHANTOM.',
                        'ar-SA': 'آراء العملاء: تعليقات حقيقية من مستخدمين حول العالم عن سبب اختيارهم لـ PHANTOM وتوصيتهم به.',
                        'ru-RU': 'Отзывы клиентов: реальная обратная связь от пользователей по всему миру о том, почему они выбирают и рекомендуют PHANTOM.'
                    }
                }
            ]
        }
    ];
    // 展平为顺序步骤，并附带分组信息（用于“大功能自动介绍小功能”与进度展示）
    const STEPS = [];
    GROUPS.forEach((g, gi) => g.steps.forEach((s, si) => {
        STEPS.push(Object.assign({}, s, {
            groupTitle: g.title,
            groupIndex: gi,
            groupStep: si,
            groupCount: g.steps.length,
            isGroupStart: si === 0
        }));
    }));

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
.tg-head{display:flex;align-items:center;gap:10px;margin-bottom:10px;}
.tg-step{font-size:11px;color:var(--neon-blue);opacity:.85;margin-top:2px;}
.tg-group{display:inline-block;font-size:11px;font-weight:800;color:#0a0a0a;background:var(--neon-blue);
  padding:2px 9px;border-radius:999px;margin-bottom:8px;letter-spacing:.3px;}
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
    let autoTimer = null;  // 自动播放：当前步停留若干毫秒后自动进入下一步
    let playing = true;    // 自动播放开关（用户可暂停）
    let popObserver = null; // 监听 DOM，捕获异步插入的弹窗（如 VIP 先查状态再弹窗）
    let supportFab = null;   // 复用真实的客服悬浮窗作为导览“导游”
    let supportFabBtn = null;
    let fabSaved = null;     // 导览开始前客服悬浮窗的原始内联样式，用于结束时还原
    const bound = { scroll: null, resize: null, key: null };

    // 导览期间阻止点击客服头像打开对话（捕获阶段拦截 qa.js 的监听器）
    function blockFabClick(e) { e.stopImmediatePropagation(); e.preventDefault(); }

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
            <div class="tg-group"></div>
            <div class="tg-head">
                <div>
                    <div class="tg-step"></div>
                </div>
            </div>
            <div class="tg-title"></div>
            <div class="tg-desc"></div>
            <div class="tg-actions">
                <button class="tg-skip" id="tour-skip"></button>
                <div class="tg-nav">
                    <button class="tg-btn" id="tour-prev"></button>
                    <button class="tg-btn" id="tour-play" title="暂停 / 播放" style="min-width:38px;display:inline-flex;align-items:center;justify-content:center;font-size:14px;"></button>
                    <button class="tg-btn primary" id="tour-next"></button>
                </div>
            </div>`;

        document.body.appendChild(highlight);
        document.body.appendChild(pointer);
        document.body.appendChild(clickRing);
        document.body.appendChild(guide);

        dom = {
            highlight, pointer, clickRing, guide,
            step: guide.querySelector('.tg-step'),
            title: guide.querySelector('.tg-title'),
            desc: guide.querySelector('.tg-desc'),
            group: guide.querySelector('.tg-group'),
            skip: guide.querySelector('#tour-skip'),
            prev: guide.querySelector('#tour-prev'),
            play: guide.querySelector('#tour-play'),
            next: guide.querySelector('#tour-next')
        };

        dom.skip.textContent = ui('skip');
        dom.prev.textContent = ui('prev');
        dom.next.textContent = ui('next');

        dom.skip.addEventListener('click', finish);
        dom.prev.addEventListener('click', () => goTo(idx - 1));
        dom.play.addEventListener('click', () => { playing ? pause() : resume(); });
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
    }

    // 客服旋钮（真实悬浮窗）紧贴着讲解气泡的外侧，与气泡作为一个整体移动到当前区块
    function placeFabBesideBubble(side, rect) {
        if (!supportFab) return;
        const g = dom.guide;
        const w = g.offsetWidth || 300, h = g.offsetHeight || 220;
        const fw = 44, fh = 44, gap = 14;
        // 复算气泡目标位置（与 placeGuide 一致），避免读到过渡动画中的中间坐标
        let bl, bt;
        if (side === 'right') { bl = rect.right + 18; bt = rect.top; }
        else if (side === 'left') { bl = rect.left - w - 18; bt = rect.top; }
        else if (side === 'bottom') { bl = rect.left; bt = rect.bottom + 18; }
        else { bl = rect.left; bt = rect.top - h - 18; }
        bl = clamp(bl, 12, window.innerWidth - w - 12);
        bt = clamp(bt, 12, window.innerHeight - h - 12);
        const br = bl + w, bcy = bt + h / 2;
        let left = (side === 'left') ? (bl - fw - gap) : (br + gap); // 旋钮始终在气泡“外侧”
        let top = bcy - fh / 2;
        left = clamp(left, 12, window.innerWidth - fw - 12);
        top = clamp(top, 12, window.innerHeight - fh - 12);
        supportFab.style.right = 'auto';
        supportFab.style.left = left + 'px';
        supportFab.style.top = top + 'px';
        supportFab.style.transform = 'none';
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

        // 讲解气泡贴着被讲解的元素（选空白处一侧、留间距），随步骤滑动且不会遮挡讲解区域
        const side = chooseSide(rect);
        placeGuide(rect, side);
        placeFabBesideBubble(side, rect); // 客服旋钮跟随气泡一起移动到该区块

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
        if (autoTimer) clearTimeout(autoTimer); // 取消上一轮的自动前进，避免重复触发
        leaveStep(activeEl, activeStep); // 清理上一步

        idx = i;
        const step = STEPS[idx];
        const el = document.querySelector(step.sel);
        if (!el) { finish(); return; }

        activeEl = el; activeStep = step;

        dom.skip.textContent = ui('skip');
        dom.prev.textContent = ui('prev');
        dom.next.textContent = idx >= STEPS.length - 1 ? ui('finish') : ui('next');
        dom.title.textContent = txt(step.t);
        dom.desc.textContent = txt(step.d);
        dom.group.textContent = txt(step.groupTitle);                 // 大功能名（pill）
        dom.step.textContent = `第 ${idx + 1} / ${STEPS.length} 步 · ${step.groupStep + 1}/${step.groupCount}`; // 大功能内进度
        dom.prev.disabled = idx === 0;

        if (!isInView(el)) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        positionAll();

        if (step.click) interact(el, step);
        updatePlayBtn();
        scheduleAuto(); // 自动播放：停留若干毫秒后进入下一步（用户可暂停）
    }

    // 自动播放：当前步停留 dwell 毫秒后自动前进；组首步多停留以便看清“大功能”切换
    function scheduleAuto() {
        if (autoTimer) clearTimeout(autoTimer);
        autoTimer = null;
        if (!playing || !active) return;
        if (idx >= STEPS.length - 1) return; // 最后一步停下，等用户点“完成”
        const step = STEPS[idx];
        let dwell = step.dwell || (step.kind === 'modal' ? 3400 : step.click ? 2800 : 2400);
        if (step.isGroupStart) dwell += 900; // 新大功能：多停留，给读者缓冲
        autoTimer = setTimeout(() => goTo(idx + 1), dwell);
    }
    function pause() { playing = false; if (autoTimer) clearTimeout(autoTimer); autoTimer = null; updatePlayBtn(); }
    function resume() { playing = true; updatePlayBtn(); scheduleAuto(); }
    function updatePlayBtn() { if (dom && dom.play) dom.play.innerHTML = playing ? '<i class="fas fa-pause"></i>' : '<i class="fas fa-play"></i>'; }

    // ===== 启动 / 结束 =====
    function start() {
        if (active) return;
        buildDom();
        active = true;
        startObserver();

        // 复用真实客服悬浮窗作为导游：保存原状态、抬到遮罩之上、禁用其“打开对话”
        supportFab = document.getElementById('support-fab');
        if (supportFab) {
            supportFab.classList.remove('hidden');
            fabSaved = supportFab.style.cssText;
            supportFab.style.zIndex = '10005';
            supportFab.style.transition = 'left .5s cubic-bezier(.22,1,.36,1), top .5s cubic-bezier(.22,1,.36,1)';
            supportFabBtn = supportFab.querySelector('#support-fab-btn');
            if (supportFabBtn) supportFabBtn.addEventListener('click', blockFabClick, true);
        }

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
        if (autoTimer) clearTimeout(autoTimer);
        autoTimer = null;
        playing = true; // 重置为自动播放，下次进入默认自动
        leaveStep(activeEl, activeStep);
        // 兜底：若上一步弹窗是异步打开、尚未被登记，结束导览时一并移除
        setTimeout(() => {
            document.querySelectorAll('[id$="-modal"]').forEach(n => {
                const cs = getComputedStyle(n);
                const r = n.getBoundingClientRect();
                if (cs.display !== 'none' && cs.visibility !== 'hidden' && r.width > 0 && r.height > 0) n.remove();
            });
        }, 700);
        // 还原真实客服悬浮窗（位置 / 层级 / 点击行为），让它回到常态
        if (supportFab) {
            supportFab.style.cssText = fabSaved || '';
            if (supportFabBtn) supportFabBtn.removeEventListener('click', blockFabClick, true);
            supportFab = null; supportFabBtn = null; fabSaved = null;
        }
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
