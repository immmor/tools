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
    // 节点套餐步骤按会员状态动态生成：会员走 VIP 节点界面，已登录非会员走免费节点界面，游客仅高亮介绍
    const BASE_PLAN_STEPS = GROUPS[1].steps;
    const BASE_NAV_STEPS = GROUPS[0].steps;
    const TI = {
        freeIface: {
            t: { 'zh-CN': '免费节点界面', 'en-US': 'Free Node Interface', 'ja-JP': '無料ノード画面', 'ko-KR': '무료 노드 화면', 'es-ES': 'Interfaz de nodos gratis', 'vi-VN': 'Giao diện nút miễn phí', 'ar-SA': 'واجهة العقد المجانية', 'ru-RU': 'Интерфейс бесплатных узлов' },
            d: { 'zh-CN': '免费节点界面：这里提供 Clash 与 V2Ray 两种订阅链接。点击「复制」复制到剪贴板，或点「下载」保存文件，再导入 PHANTOM 客户端即可连接。', 'en-US': 'Free node screen: gives Clash and V2Ray subscription links. Tap Copy to copy to clipboard, or Download to save the file, then import it into the PHANTOM client to connect.', 'ja-JP': '無料ノード画面：Clash と V2Ray の購読リンクを提供します。「コピー」でクリップボードへ、「ダウンロード」でファイルを保存し、PHANTOM クライアントにインポートすれば接続できます。', 'ko-KR': '무료 노드 화면：Clash·V2Ray 구독 링크를 제공합니다. 「복사」로 클립보드에 복사하거나 「다운로드」로 저장한 뒤 PHANTOM 클라이언트에 가져오면 연결됩니다.', 'es-ES': 'Pantalla de nodos gratis: ofrece enlaces de suscripción Clash y V2Ray. Pulsa Copiar para copiar al portapapeles o Descargar para guardar el archivo, luego impórtalo en el cliente PHANTOM para conectar.', 'vi-VN': 'Giao diện nút miễn phí：cung cấp liên kết đăng ký Clash và V2Ray. Nhấn Sao chép để copy vào clipboard, hoặc Tải xuống để lưu file, rồi nhập vào client PHANTOM để kết nối.', 'ar-SA': 'واجهة العقد المجانية：توفر روابط اشتراك Clash وV2Ray. اضغط نسخ لنسخ الرابط، أو تنزيل لحفظ الملف، ثم استورده في عميل PHANTOM للاتصال.', 'ru-RU': 'Экран бесплатных узлов：даёт ссылки подписки Clash и V2Ray. Нажмите Копировать для копирования в буфер или Скачать для сохранения файла, затем импортируйте его в клиент PHANTOM для подключения.' }
        },
        freeLink: {
            t: { 'zh-CN': '订阅链接', 'en-US': 'Subscription Link', 'ja-JP': '購読リンク', 'ko-KR': '구독 링크', 'es-ES': 'Enlace de suscripción', 'vi-VN': 'Liên kết đăng ký', 'ar-SA': 'رابط الاشتراك', 'ru-RU': 'Ссылка подписки' },
            d: { 'zh-CN': '这就是订阅链接，包含你的专属节点配置。点击「复制」一键复制，粘贴到客户端的订阅栏即可；也可点「下载」保存为本地文件。每日签到还能领取当日免费节点。', 'en-US': 'This is the subscription link with your personal node config. Tap Copy to copy it, then paste into the client subscription box; or Download to save it locally. Daily check-in also grants today free node.', 'ja-JP': 'これが購読リンクで、あなた専用のノード設定が含まれます。「コピー」でワンタップ複製し、クライアントの購読欄に貼り付けてください。「ダウンロード」で保存も可。毎日の签到で当日の無料ノードも受け取れます。', 'ko-KR': '이곳이 구독 링크로, 본인 전용 노드 설정이 담겨 있습니다. 「복사」로 복사해 클라이언트 구독란에 붙여넣거나, 「다운로드」로 저장하세요. 매일 출석하면 당일 무료 노드도 받을 수 있습니다.', 'es-ES': 'Este es el enlace de suscripción con tu configuración de nodo. Pulsa Copiar para copiarlo y pégalo en el cuadro de suscripción del cliente; o Descargar para guardarlo. La check-in diaria también otorga el nodo gratis del día.', 'vi-VN': 'Đây là liên kết đăng ký chứa cấu hình nút riêng của bạn. Nhấn Sao chép để copy rồi dán vào ô đăng ký của client, hoặc Tải xuống để lưu file. Điểm danh hằng ngày còn nhận node miễn phí trong ngày.', 'ar-SA': 'هذا رابط الاشتراك ويحتوي إعداد عقدتك الخاص. اضغط نسخ لنسخه والصقه في خانة الاشتراك بالعميل، أو تنزيل لحفظه. كما تمنحك التسجيلة اليومية عقدة مجانية لليوم.', 'ru-RU': 'Это ссылка подписки с вашей личной конфигурацией узла. Нажмите Копировать, чтобы скопировать, и вставьте в поле подписки клиента; или Скачать для сохранения. Ежедневная отметка также даёт бесплатный узел на день.' }
        },
        vipIface: {
            t: { 'zh-CN': 'VIP 节点界面', 'en-US': 'VIP Node Interface', 'ja-JP': 'VIPノード画面', 'ko-KR': 'VIP 노드 화면', 'es-ES': 'Interfaz de nodos VIP', 'vi-VN': 'Giao diện nút VIP', 'ar-SA': 'واجهة عقد VIP', 'ru-RU': 'Интерфейс VIP-узлов' },
            d: { 'zh-CN': 'VIP 节点界面：顶部显示套餐（月付/年付）、时长与价格；VIP 有效时下方展示 Clash/V2Ray 订阅配置，复制即可导入客户端。还可查看 VIP 状态（有效期、剩余天数、可用流量）。', 'en-US': 'VIP node screen: top shows the plan (monthly/yearly), duration and price; when VIP is active it shows Clash/V2Ray subscription configs to copy into the client. You can also see VIP status (expiry, days left, traffic).', 'ja-JP': 'VIPノード画面：上部にプラン（月額/年額）・期間・価格が表示され、VIP 有効時は Clash/V2Ray 購読設定が出てクライアントへコピーできます。下部には VIP ステータス（有効期限・残り日数・通信量）も。', 'ko-KR': 'VIP 노드 화면: 상단에 플랜(월간/연간)·기간·가격이 표시되고, VIP 유효 시 Clash/V2Ray 구독 설정이 나와 클라이언트로 복사할 수 있습니다. 아래에서 VIP 상태(만료일·잔여 일수·트래픽)도 확인.', 'es-ES': 'Pantalla VIP: arriba muestra el plan (mensual/anual), la duración y el precio; con VIP activo aparecen las configs Clash/V2Ray para copiar en el cliente. Abajo está el estado VIP (caducidad, días restantes, tráfico).', 'vi-VN': 'Giao diện nút VIP: đầu hiển thị gói (tháng/năm), thời hạn và giá; khi VIP còn hạn sẽ hiện cấu hình Clash/V2Ray để copy vào client. Bên dưới xem trạng thái VIP (hạn, ngày còn, dung lượng).', 'ar-SA': 'واجهة عقد VIP：تُظهر الخطة (شهرية/سنوية) والمدة والسعر بالأعلى؛ عند تفعيل VIP تظهر إعدادات Clash/V2Ray للنسخ إلى العميل. بالأسفل حالة VIP (الانتهاء، الأيام المتبقية، البيانات).', 'ru-RU': 'Экран VIP-узлов: вверху план (месяц/год), срок и цена; при активном VIP отображаются конфиги Clash/V2Ray для копирования в клиент. Ниже — статус VIP (срок, дни, трафик).' }
        },
        vipConfig: {
            t: { 'zh-CN': '订阅配置', 'en-US': 'Subscription Config', 'ja-JP': '購読設定', 'ko-KR': '구독 설정', 'es-ES': 'Configuración de suscripción', 'vi-VN': 'Cấu hình đăng ký', 'ar-SA': 'إعداد الاشتراك', 'ru-RU': 'Конфиг подписки' },
            d: { 'zh-CN': '这就是你的专属 Clash/V2Ray 订阅配置。点击「复制」一键复制，粘贴到客户端的订阅栏即可连接；也可点「下载」保存文件。每个套餐对应一份长期有效的专属链接。', 'en-US': 'This is your personal Clash/V2Ray subscription config. Tap Copy to copy it, paste into the client subscription box to connect; or Download to save the file. Each plan has one long-lived dedicated link.', 'ja-JP': 'これがご自身の専用 Clash/V2Ray 購読設定です。「コピー」でワンタップ複製し、クライアントの購読欄に貼り付けて接続できます。「ダウンロード」で保存も可。各プランに専用リンクが一つあり有効期限が長いです。', 'ko-KR': '이곳이 본인 전용 Clash/V2Ray 구독 설정입니다. 「복사」로 복사해 클라이언트 구독란에 붙여넣어 연결하거나, 「다운로드」로 저장하세요. 각 플랜에는 장기 유효한 전용 링크가 하나 있습니다.', 'es-ES': 'Esta es tu configuración personal de suscripción Clash/V2Ray. Pulsa Copiar para copiarla y pégala en el cuadro de suscripción del cliente para conectar; o Descargar para guardarla. Cada plan tiene un enlace dedicado de larga duración.', 'vi-VN': 'Đây là cấu hình đăng ký Clash/V2Ray riêng của bạn. Nhấn Sao chép để copy rồi dán vào ô đăng ký của client để kết nối, hoặc Tải xuống để lưu file. Mỗi gói có một liên kết riêng hiệu lực lâu dài.', 'ar-SA': 'هذا إعداد اشتراك Clash/V2Ray الخاص بك. اضغط نسخ لنسخه والصقه في خانة الاشتراك بالعميل للاتصال، أو تنزيل لحفظه. كل باقة لها رابط مخصص صالح طويلاً.', 'ru-RU': 'Это ваша личная конфигурация подписки Clash/V2Ray. Нажмите Копировать, чтобы скопировать, и вставьте в поле подписки клиента для подключения; или Скачать для сохранения. У каждого плана — один долговременный выделенный линк.' }
        },
        vipPrice: {
            t: { 'zh-CN': '价格与续费', 'en-US': 'Price & Renewal', 'ja-JP': '価格と更新', 'ko-KR': '가격 및 갱신', 'es-ES': 'Precio y renovación', 'vi-VN': 'Giá và gia hạn', 'ar-SA': 'السعر والتجديد', 'ru-RU': 'Цена и продление' },
            d: { 'zh-CN': '这里显示当前套餐的价格与时长。开启「自动续费」可在到期前自动扣款，并额外赠送 2 天；余额不足时会提示充值。', 'en-US': 'This shows the current plan price and duration. Enable Auto-renew to charge automatically before expiry and get 2 extra days; if balance is low it prompts you to top up.', 'ja-JP': '現在のプラン価格と期間を表示します。「自動更新」をオンにすると期限前に自動決済され、さらに 2 日プレゼント。残高不足時はチャージを促します。', 'ko-KR': '현재 플랜 가격과 기간을 표시합니다. 「자동 갱신」을 켜면 만료 전 자동 결제되고 2일이 추가로 제공됩니다. 잔액 부족 시 충전을 안내합니다.', 'es-ES': 'Muestra el precio y la duración del plan actual. Activa Renovación automática para cobrar antes del vencimiento y obtener 2 días extra; si el saldo es bajo, avisa para recargar.', 'vi-VN': 'Hiển thị giá và thời hạn gói hiện tại. Bật Tự động gia hạn để tự trừ trước hạn và tặng thêm 2 ngày; số dư thấp sẽ nhắc nạp tiền.', 'ar-SA': 'يعرض سعر ومدة الخطة الحالية. فعّل التجديد التلقائي للخصم قبل الانتهاء مع هدية 2 يوم إضافية؛ وعند نقص الرصيد يُطلب شحنه.', 'ru-RU': 'Показывает цену и срок текущего плана. Включите Автопродление для списания до окончания и +2 дня бонусом; при нехватке баланса предложит пополнить.' }
        }
    };
    const NM = {
        login: {
            t: { 'zh-CN': '登录 / 注册', 'en-US': 'Log In / Sign Up', 'ja-JP': 'ログイン / 登録', 'ko-KR': '로그인 / 회원가입', 'es-ES': 'Iniciar sesión / Registrarse', 'vi-VN': 'Đăng nhập / Đăng ký', 'ar-SA': 'تسجيل الدخول / التسجيل', 'ru-RU': 'Вход / Регистрация' },
            d: { 'zh-CN': '点击这里登录或注册账号。登录后即可领取专属节点、复制订阅链接、查看余额并邀请好友得奖励。', 'en-US': 'Tap here to log in or register. Once signed in you can claim your dedicated nodes, copy subscription links, check balance and invite friends for rewards.', 'ja-JP': 'ここからログインまたは登録できます。ログインすると専用ノードを受け取り、購読リンクをコピーし、残高確認や友達招待で特典を得られます。', 'ko-KR': '여기서 로그인하거나 가입하세요. 로그인하면 전용 노드를 받고, 구독 링크를 복사하고, 잔액을 확인하며 친구 초대로 보상을 얻을 수 있습니다.', 'es-ES': 'Pulsa aquí para iniciar sesión o registrarte. Al entrar puedes reclamar tus nodos, copiar enlaces de suscripción, ver el saldo e invitar amigos por recompensas.', 'vi-VN': 'Nhấn vào đây để đăng nhập hoặc đăng ký. Sau khi đăng nhập bạn có thể nhận node riêng, sao chép liên kết đăng ký, xem số dư và mời bạn bè nhận thưởng.', 'ar-SA': 'اضغط هنا لتسجيل الدخول أو إنشاء حساب. بعد الدخول يمكنك الحصول على عقدك الخاصة ونسخ روابط الاشتراك ومراجعة الرصيد ودعوة الأصدقاء للحصول على مكافآت.', 'ru-RU': 'Нажмите здесь, чтобы войти или зарегистрироваться. После входа вы сможете получить свои узлы, копировать ссылки подписки, видеть баланс и приглашать друзей за вознаграждение.' }
        },
        menuBtn: {
            t: { 'zh-CN': '用户菜单', 'en-US': 'User Menu', 'ja-JP': 'ユーザーメニュー', 'ko-KR': '사용자 메뉴', 'es-ES': 'Menú de usuario', 'vi-VN': 'Menu người dùng', 'ar-SA': 'قائمة المستخدم', 'ru-RU': 'Меню пользователя' },
            d: { 'zh-CN': '点击右上角的头像 / “菜单”按钮，展开你的个人中心，可查看余额、提现、复制专属邀请链接、查看购买记录、联系客服，以及退出登录。', 'en-US': 'Tap the avatar / “Menu” button at top-right to open your account center — view balance, withdraw, copy your invite link, see purchase history, contact support, and log out.', 'ja-JP': '右上のアイコン / 「メニュー」ボタンを押すと個人センターが開き、残高確認・出金・専用招待リンクのコピー・購入履歴・サポート・ログアウトができます。', 'ko-KR': '우측 상단 아바타 / 「메뉴」 버튼을 누르면 개인 센터가 열립니다. 잔액 확인, 출금, 전용 초대 링크 복사, 구매 내역, 고객센터, 로그아웃을 할 수 있습니다.', 'es-ES': 'Pulsa el avatar / botón “Menú” arriba a la derecha para abrir tu centro de cuenta: saldo, retiro, copiar enlace de invitación, historial de compras, soporte y cerrar sesión.', 'vi-VN': 'Nhấn biểu tượng / nút “Menu” góc phải trên cùng để mở trung tâm tài khoản: xem số dư, rút tiền, sao chép liên kết mời, lịch sử mua hàng, liên hệ hỗ trợ và đăng xuất.', 'ar-SA': 'اضغط الصورة / زر «القائمة» أعلى اليمين لفتح مركز حسابك: الرصيد والسحب ونسخ رابط الدعوة وسجل المشتريات والدعم وتسجيل الخروج.', 'ru-RU': 'Нажмите аватар / кнопку «Меню» вверху справа, чтобы открыть личный кабинет: баланс, вывод, копия пригласительной ссылки, история покупок, поддержка и выход.' }
        },
        menu: {
            t: { 'zh-CN': '个人中心', 'en-US': 'Account Center', 'ja-JP': 'アカウント', 'ko-KR': '계정 센터', 'es-ES': 'Centro de cuenta', 'vi-VN': 'Trung tâm tài khoản', 'ar-SA': 'مركز الحساب', 'ru-RU': 'Личный кабинет' },
            d: { 'zh-CN': '这里汇总了账户相关操作：查看与复制专属邀请链接、申请提现、查看购买记录、录入人脸 / 声纹、联系客服，以及退出登录。', 'en-US': 'This gathers your account actions: view & copy your invite link, request a withdrawal, see purchase history, enroll face/voiceprint, contact support, and log out.', 'ja-JP': 'ここにアカウント関連の操作がまとまっています：専用招待リンクの表示・コピー、出金申請、購入履歴、顔・声紋登録、サポート、ログアウト。', 'ko-KR': '여기에 계정 관련 작업이 모여 있습니다: 전용 초대 링크 보기·복사, 출금 신청, 구매 내역, 얼굴·음성 등록, 고객센터, 로그아웃.', 'es-ES': 'Aquí se reúnen las acciones de cuenta: ver y copiar tu enlace de invitación, solicitar retiro, ver historial de compras, registrar rostro/ voz, contactar soporte y cerrar sesión.', 'vi-VN': 'Tại đây tập hợp các thao tác tài khoản: xem và sao chép liên kết mời, yêu cầu rút tiền, xem lịch sử mua hàng, đăng ký khuôn mặt/giọng nói, liên hệ hỗ trợ và đăng xuất.', 'ar-SA': 'هنا مجموعة إجراءات الحساب: عرض ونسخ رابط الدعوة وطلب السحب وعرض سجل المشتريات وتسجيل الوجه/الصوت والتواصل مع الدعم وتسجيل الخروج.', 'ru-RU': 'Здесь собраны действия с аккаунтом: просмотр и копия пригласительной ссылки, запрос на вывод, история покупок, регистрация лица/голоса, поддержка и выход.' }
        }
    };
    // 用户下拉框逐项介绍（登录态）
    const MI = {
        balance: {
            t: { 'zh-CN': '账户余额', 'en-US': 'Account Balance', 'ja-JP': '残高', 'ko-KR': '잔액', 'es-ES': 'Saldo', 'vi-VN': 'Số dư', 'ar-SA': 'الرصيد', 'ru-RU': 'Баланс' },
            d: { 'zh-CN': '这里显示你账户的当前余额（元）。', 'en-US': 'Your current account balance is shown here.', 'ja-JP': '現在の残高（元）が表示されます。', 'ko-KR': '계정 잔액(위안)이 표시됩니다.', 'es-ES': 'Muestra tu saldo actual (¥).', 'vi-VN': 'Hiển thị số dư hiện tại (¥).', 'ar-SA': 'يعرض رصيد حسابك الحالي (يوان).', 'ru-RU': 'Здесь отображается текущий баланс (юани).' }
        },
        recharge: {
            t: { 'zh-CN': '充值', 'en-US': 'Recharge', 'ja-JP': 'チャージ', 'ko-KR': '충전', 'es-ES': 'Recargar', 'vi-VN': 'Nạp tiền', 'ar-SA': 'شحن', 'ru-RU': 'Пополнение' },
            d: { 'zh-CN': '点击前往充值页面，为余额充值。', 'en-US': 'Top up your account balance.', 'ja-JP': '残高をチャージします。', 'ko-KR': '계정 잔액을 충전합니다.', 'es-ES': 'Recarga el saldo de tu cuenta.', 'vi-VN': 'Nạp thêm tiền vào số dư.', 'ar-SA': 'اشحن رصيد حسابك.', 'ru-RU': 'Пополните баланс счёта.' }
        },
        withdraw: {
            t: { 'zh-CN': '提现', 'en-US': 'Withdraw', 'ja-JP': '出金', 'ko-KR': '출금', 'es-ES': 'Retirar', 'vi-VN': 'Rút tiền', 'ar-SA': 'سحب', 'ru-RU': 'Вывод' },
            d: { 'zh-CN': '将账户余额提现到你的钱包。', 'en-US': 'Withdraw your balance to your wallet.', 'ja-JP': '残高をウォレットへ出金します。', 'ko-KR': '잔액을 지갑으로 출금합니다.', 'es-ES': 'Retira tu saldo a tu billetera.', 'vi-VN': 'Rút số dư về ví của bạn.', 'ar-SA': 'اسحب رصيدك إلى محفظتك.', 'ru-RU': 'Выведите баланс на кошелёк.' }
        },
        invite: {
            t: { 'zh-CN': '专属邀请链接', 'en-US': 'Invite Link', 'ja-JP': '招待リンク', 'ko-KR': '초대 링크', 'es-ES': 'Enlace de invitación', 'vi-VN': 'Liên kết mời', 'ar-SA': 'رابط الدعوة', 'ru-RU': 'Пригласительная ссылка' },
            d: { 'zh-CN': '你的专属邀请链接与邀请码，分享好友得返利。', 'en-US': 'Your unique invite link & code — share to earn rewards.', 'ja-JP': '専用の招待リンクとコード。友達紹介で特典。', 'ko-KR': '전용 초대 링크와 코드. 친구 초대로 보상.', 'es-ES': 'Tu enlace y código de invitación únicos.', 'vi-VN': 'Liên kết và mã mời riêng của bạn.', 'ar-SA': 'رابط ورمز الدعوة الخاصان بك.', 'ru-RU': 'Ваша уникальная ссылка и код приглашения.' }
        },
        vorders: {
            t: { 'zh-CN': '购买记录', 'en-US': 'Purchase History', 'ja-JP': '購入履歴', 'ko-KR': '구매 내역', 'es-ES': 'Historial de compras', 'vi-VN': 'Lịch sử mua hàng', 'ar-SA': 'سجل المشتريات', 'ru-RU': 'История покупок' },
            d: { 'zh-CN': '查看你购买过的节点套餐与订单。', 'en-US': 'View your node packages and orders.', 'ja-JP': '購入したノードと注文を確認。', 'ko-KR': '구매한 노드 패키지와 주문 내역.', 'es-ES': 'Consulta tus paquetes y pedidos.', 'vi-VN': 'Xem các gói node và đơn hàng.', 'ar-SA': 'اعرض حزم العقد وطلباتك.', 'ru-RU': 'Просмотр пакетов узлов и заказов.' }
        },
        ad: {
            t: { 'zh-CN': '广告招商', 'en-US': 'Advertising', 'ja-JP': '広告募集', 'ko-KR': '광고 제휴', 'es-ES': 'Publicidad', 'vi-VN': 'Quảng cáo', 'ar-SA': 'الإعلانات', 'ru-RU': 'Реклама' },
            d: { 'zh-CN': '了解平台广告招商合作。', 'en-US': 'Learn about advertising partnerships.', 'ja-JP': '広告掲載の提携について。', 'ko-KR': '광고 제휴를 알아보세요.', 'es-ES': 'Infórmate sobre publicidad.', 'vi-VN': 'Tìm hiểu hợp tác quảng cáo.', 'ar-SA': 'تعرف على شراكات الإعلان.', 'ru-RU': 'Узнайте о рекламном сотрудничестве.' }
        },
        agent: {
            t: { 'zh-CN': '成为代理', 'en-US': 'Become an Agent', 'ja-JP': '代理になる', 'ko-KR': '에이전트 되기', 'es-ES': 'Ser agente', 'vi-VN': 'Trở thành đại lý', 'ar-SA': 'كن وكيلاً', 'ru-RU': 'Стать агентом' },
            d: { 'zh-CN': '申请成为平台代理，发展团队赚佣金。', 'en-US': 'Apply to be an agent and earn commissions.', 'ja-JP': '代理に申し込み、紹介で報酬。', 'ko-KR': '에이전트 신청하고 수수료 획득.', 'es-ES': 'Conviértete en agente y gana.', 'vi-VN': 'Trở thành đại lý nhận hoa hồng.', 'ar-SA': 'تصبح وكيلاً وتكسب عمولة.', 'ru-RU': 'Станьте агентом и получайте комиссию.' }
        },
        invest: {
            t: { 'zh-CN': '投资入股', 'en-US': 'Invest', 'ja-JP': '出資する', 'ko-KR': '투자', 'es-ES': 'Invertir', 'vi-VN': 'Đầu tư', 'ar-SA': 'استثمر', 'ru-RU': 'Инвестировать' },
            d: { 'zh-CN': '参与平台投资入股。', 'en-US': 'Participate in platform investment.', 'ja-JP': 'プラットフォームへの出資。', 'ko-KR': '플랫폼 투자에 참여.', 'es-ES': 'Participa en la inversión.', 'vi-VN': 'Tham gia đầu tư nền tảng.', 'ar-SA': 'شارك في استثمار المنصة.', 'ru-RU': 'Участвуйте в инвестировании.' }
        },
        complaint: {
            t: { 'zh-CN': '投诉 / 反馈', 'en-US': 'Feedback', 'ja-JP': '問い合わせ', 'ko-KR': '문의 / 불만', 'es-ES': 'Quejas', 'vi-VN': 'Khiếu nại', 'ar-SA': 'الشكاوى', 'ru-RU': 'Жалобы' },
            d: { 'zh-CN': '遇到问题可在此投诉或反馈。', 'en-US': 'Submit complaints or feedback here.', 'ja-JP': '問題があれば問い合わせを。', 'ko-KR': '문제 발생 시 문의/불만 제기.', 'es-ES': 'Envía quejas o comentarios.', 'vi-VN': 'Gửi khiếu nại hoặc góp ý.', 'ar-SA': 'أرسل شكاوى أو ملاحظات.', 'ru-RU': 'Отправляйте жалобы и отзывы.' }
        },
        face: {
            t: { 'zh-CN': '录入人脸', 'en-US': 'Enroll Face', 'ja-JP': '顔登録', 'ko-KR': '얼굴 등록', 'es-ES': 'Registrar rostro', 'vi-VN': 'Đăng ký khuôn mặt', 'ar-SA': 'تسجيل الوجه', 'ru-RU': 'Регистрация лица' },
            d: { 'zh-CN': '录入人脸，提升账户安全与验证。', 'en-US': 'Enroll your face for secure verification.', 'ja-JP': '顔を登録しセキュリティ向上。', 'ko-KR': '얼굴을 등록해 보안 강화.', 'es-ES': 'Registra tu rostro para mayor seguridad.', 'vi-VN': 'Đăng ký khuôn mặt để xác minh bảo mật.', 'ar-SA': 'سجّل وجهك للتحقق الآمن.', 'ru-RU': 'Зарегистрируйте лицо для безопасности.' }
        },
        voice: {
            t: { 'zh-CN': '录入声纹', 'en-US': 'Enroll Voiceprint', 'ja-JP': '声紋登録', 'ko-KR': '음성 등록', 'es-ES': 'Registrar voz', 'vi-VN': 'Đăng ký giọng nói', 'ar-SA': 'تسجيل الصوت', 'ru-RU': 'Регистрация голоса' },
            d: { 'zh-CN': '录入声纹，作为辅助验证方式。', 'en-US': 'Enroll your voiceprint as a backup verification.', 'ja-JP': '声紋を登録（補助認証）。', 'ko-KR': '음성 등록(보조 인증).', 'es-ES': 'Registra tu voz como respaldo.', 'vi-VN': 'Đăng ký giọng nói làm xác minh phụ.', 'ar-SA': 'سجّل صوتك كتحقق بديل.', 'ru-RU': 'Зарегистрируйте голос как резерв.' }
        },
        logout: {
            t: { 'zh-CN': '退出登录', 'en-US': 'Log Out', 'ja-JP': 'ログアウト', 'ko-KR': '로그아웃', 'es-ES': 'Cerrar sesión', 'vi-VN': 'Đăng xuất', 'ar-SA': 'تسجيل الخروج', 'ru-RU': 'Выйти' },
            d: { 'zh-CN': '退出当前账号登录。', 'en-US': 'Log out of your account.', 'ja-JP': 'アカウントからログアウト。', 'ko-KR': '계정에서 로그아웃.', 'es-ES': 'Cierra la sesión de tu cuenta.', 'vi-VN': 'Đăng xuất khỏi tài khoản.', 'ar-SA': 'سجّل الخروج من حسابك.', 'ru-RU': 'Выйдите из аккаунта.' }
        }
    };
    // 通知下拉框逐项介绍
    const NI = {
        btn: {
            t: { 'zh-CN': '系统通知', 'en-US': 'Notifications', 'ja-JP': '通知', 'ko-KR': '알림', 'es-ES': 'Notificaciones', 'vi-VN': 'Thông báo', 'ar-SA': 'الإشعارات', 'ru-RU': 'Уведомления' },
            d: {
                'zh-CN': '「通知」：点击打开通知中心，查看活动、福利与系统消息；有未读时按钮上会出现红点提示。',
                'en-US': '"Notifications": open the center to see campaigns, perks and system messages; a red dot marks unread items.',
                'ja-JP': '「通知」：クリックで通知センターを開き、キャンペーン・特典・システムメッセージを確認。未読があると赤い点が表示されます。',
                'ko-KR': '「알림」: 클릭하면 알림 센터가 열려 이벤트·혜택·시스템 메시지를 볼 수 있습니다. 읽지 않으면 빨간 점이 표시됩니다.',
                'es-ES': '«Notificaciones»: abre el centro para ver campañas, beneficios y mensajes del sistema; un punto rojo marca lo no leído.',
                'vi-VN': '「Thông báo」: mở trung tâm xem chiến dịch, ưu đãi và tin nhắn hệ thống; chấm đỏ báo chưa đọc.',
                'ar-SA': '«الإشعارات»: افتح المركز لعرض الحملات والمزايا والرسائل؛ تشير نقطة حمراء إلى غير المقروء.',
                'ru-RU': '«Уведомления»: откройте центр, чтобы видеть акции, бонусы и сообщения; красная точка — непрочитанное.'
            }
        },
        list: {
            t: { 'zh-CN': '通知列表', 'en-US': 'Notification List', 'ja-JP': '通知リスト', 'ko-KR': '알림 목록', 'es-ES': 'Lista de notificaciones', 'vi-VN': 'Danh sách thông báo', 'ar-SA': 'قائمة الإشعارات', 'ru-RU': 'Список уведомлений' },
            d: {
                'zh-CN': '通知列表：这里汇总所有活动、福利与系统消息。点击某条可查看详情，未读项会有高亮或红点。',
                'en-US': 'The list gathers all campaigns, perks and system messages. Tap an item for details; unread ones are highlighted or marked with a dot.',
                'ja-JP': '通知リスト：すべてのキャンペーン・特典・システムメッセージをまとめます。項目をタップで詳細表示、未読はハイライトまたは赤点。',
                'ko-KR': '알림 목록: 이벤트·혜택·시스템 메시지를 모두 모읍니다. 항목을 누르면 상세 보기, 읽지 않은 항목은 강조되거나 점 표시.',
                'es-ES': 'La lista reúne campañas, beneficios y mensajes. Pulsa un item para verlo; los no leídos se resaltan o marcan con un punto.',
                'vi-VN': 'Danh sách tập hợp chiến dịch, ưu đãi và tin nhắn. Nhấn mục để xem chi tiết; chưa đọc được làm nổi bật hoặc đánh dấu.',
                'ar-SA': 'القائمة تجمع الحملات والمزايا والرسائل. اضغط عنصراً للتفاصيل؛ غير المقروء مميز أو بنقطة.',
                'ru-RU': 'Список собирает акции, бонусы и сообщения. Нажмите элемент для подробностей; непрочитанное выделено или отмечено точкой.'
            }
        },
        mark: {
            t: { 'zh-CN': '全部已读', 'en-US': 'Mark All Read', 'ja-JP': 'すべて既読', 'ko-KR': '모두 읽음', 'es-ES': 'Marcar leídas', 'vi-VN': 'Đánh dấu đã đọc', 'ar-SA': 'تعليم الكل كمقروء', 'ru-RU': 'Отметить прочитанным' },
            d: {
                'zh-CN': '「全部已读」：一键把所有通知标记为已读，按钮上的红点提示会随之消失。',
                'en-US': '"Mark all read": mark every notification as read at once; the red dot on the bell disappears.',
                'ja-JP': '「すべて既読」：通知を一括で既読に。ベルの赤点が消えます。',
                'ko-KR': '「모두 읽음」: 모든 알림을 한 번에 읽음 처리하며, 벨의 빨간 점이 사라집니다.',
                'es-ES': '«Marcar leídas»: marca todas las notificaciones como leídas; el punto rojo desaparece.',
                'vi-VN': '「Đánh dấu đã đọc」: đánh dấu tất cả thông báo là đã đọc; chấm đỏ trên chuông biến mất.',
                'ar-SA': '«تعليم الكل كمقروء»: حدد كل الإشعارات كمقروءة دفعة واحدة؛ تختفي النقطة الحمراء.',
                'ru-RU': '«Отметить прочитанным»: помечает все уведомления прочитанными; красная точка исчезает.'
            }
        },
        contact: {
            t: { 'zh-CN': '联系客服', 'en-US': 'Contact Support', 'ja-JP': 'サポートへ連絡', 'ko-KR': '고객센터 문의', 'es-ES': 'Contactar soporte', 'vi-VN': 'Liên hệ hỗ trợ', 'ar-SA': 'التواصل مع الدعم', 'ru-RU': 'Связаться с поддержкой' },
            d: {
                'zh-CN': '「联系客服」：点击打开客服对话，遇到问题随时咨询，也可在这里反馈建议。',
                'en-US': '"Contact support": open the support chat to ask questions or send feedback anytime.',
                'ja-JP': '「サポートへ連絡」：クリックでサポートとのチャットを開き、いつでも質問やご意見をどうぞ。',
                'ko-KR': '「고객센터 문의」: 클릭하면 상담 채팅이 열려 언제든 문의나 의견을 남길 수 있습니다.',
                'es-ES': '«Contactar soporte»: abre el chat de soporte para preguntar o enviar comentarios cuando quieras.',
                'vi-VN': '「Liên hệ hỗ trợ」: mở chat hỗ trợ để hỏi đáp hoặc góp ý bất cứ lúc nào.',
                'ar-SA': '«التواصل مع الدعم»: افتح محادثة الدعم لطرح الأسئلة أو إرسال الملاحظات في أي وقت.',
                'ru-RU': '«Связаться с поддержкой»: откройте чат поддержки, чтобы задать вопрос или оставить отзыв в любое время.'
            }
        }
    };
    function planStepsForUser() {
        const isVip = (() => { try { return localStorage.getItem('isVip') === 'true'; } catch (e) { return false; } })();
        const loggedIn = (() => { try { return !!JSON.parse(localStorage.getItem('userInfo') || 'null'); } catch (e) { return false; } })();
        const [freeCard, monthlyCard, annualCard, customCard] = BASE_PLAN_STEPS;
        const tease = (c) => Object.assign({}, c, { click: false, noClick: true });
        const openFree = () => ([
            Object.assign({}, freeCard, { keepOpen: true }),
            { sel: '#free-nodes-modal .cyber-card', click: false, kind: 'modal', keepOpen: true, noClick: true, t: TI.freeIface.t, d: TI.freeIface.d },
            { sel: '#free-nodes-modal [data-link]', click: false, kind: 'modal', noClick: true, t: TI.freeLink.t, d: TI.freeLink.d }
        ]);
        if (isVip) {
            return [
                Object.assign({}, monthlyCard, { keepOpen: true }),
                { sel: '#vip-modal .cyber-card', click: false, kind: 'modal', keepOpen: true, noClick: true, t: TI.vipIface.t, d: TI.vipIface.d },
                { sel: '#vip-modal .vip-plan-price', click: false, kind: 'modal', keepOpen: true, noClick: true, t: TI.vipPrice.t, d: TI.vipPrice.d },
                { sel: '#vip-modal .vip-clash-input', click: false, kind: 'modal', noClick: true, t: TI.vipConfig.t, d: TI.vipConfig.d },
                tease(annualCard),
                tease(customCard)
            ];
        }
        if (loggedIn) {
            return openFree().concat([tease(monthlyCard), tease(annualCard), tease(customCard)]);
        }
        return [tease(freeCard), tease(monthlyCard), tease(annualCard), tease(customCard)];
    }
    function navStepsForUser() {
        const loggedIn = (() => { try { return !!JSON.parse(localStorage.getItem('userInfo') || 'null'); } catch (e) { return false; } })();
        // 逐项高亮下拉框内的每个功能，下拉保持打开，直到“退出登录”才关闭
        const itemSteps = [
            ['#user-balance', 'balance'],
            ['#recharge-btn', 'recharge'],
            ['#withdraw-btn', 'withdraw'],
            ['#invite-btn', 'invite'],
            ['#vorders-btn', 'vorders'],
            ['#ad-btn', 'ad'],
            ['#agent-btn', 'agent'],
            ['#invest-btn', 'invest'],
            ['#complaint-btn', 'complaint'],
            ['#enroll-face-btn', 'face'],
            ['#enroll-voice-btn', 'voice']
        ].map(([sel, key]) => ({ sel, click: false, kind: 'modal', keepOpen: true, noClick: true, t: MI[key].t, d: MI[key].d }));
        // 通知下拉框：打开 → 列表 → 全部已读 → 联系客服（收尾步关闭）
        const notifSteps = [
            { sel: '#notification-btn', click: true, kind: 'modal', keepOpen: true, t: NI.btn.t, d: NI.btn.d },
            { sel: '#notification-list', click: false, kind: 'modal', keepOpen: true, noClick: true, t: NI.list.t, d: NI.list.d },
            { sel: '#mark-all-read-btn', click: false, kind: 'modal', keepOpen: true, noClick: true, t: NI.mark.t, d: NI.mark.d },
            { sel: '#contact-btn', click: false, kind: 'modal', keepOpen: false, noClick: true, t: NI.contact.t, d: NI.contact.d }
        ];
        const base = BASE_NAV_STEPS.flatMap(s => s.sel === '#notification-btn' ? notifSteps : [s]);
        if (!loggedIn) {
            return base.concat([
                { sel: '#auth-toggle', click: false, noClick: true, kind: 'link', t: NM.login.t, d: NM.login.d }
            ]);
        }
        return base.concat([
            { sel: '#auth-toggle', click: true, kind: 'modal', keepOpen: true, t: NM.menuBtn.t, d: NM.menuBtn.d },
            ...itemSteps,
            { sel: '#logout-btn', click: false, kind: 'modal', keepOpen: false, noClick: true, t: MI.logout.t, d: MI.logout.d }
        ]);
    }
    GROUPS[0].steps = navStepsForUser();
    GROUPS[1].steps = planStepsForUser();
    // 展平为顺序步骤，并附带分组信息（用于“大功能自动介绍小功能”与进度展示）
    let STEPS = [];
    function buildSteps() {
        STEPS = [];
        GROUPS.forEach((g, gi) => g.steps.forEach((s, si) => {
            STEPS.push(Object.assign({}, s, {
                groupTitle: g.title,
                groupIndex: gi,
                groupStep: si,
                groupCount: g.steps.length,
                isGroupStart: si === 0
            }));
        }));
    }
    buildSteps();

    // ===== 样式（注入一次）=====
    const STYLE = `
#tour-highlight{position:fixed;z-index:9991;pointer-events:none;border-radius:16px;
  box-shadow:0 0 0 9999px rgba(0,0,0,.72);
  transition:left .5s cubic-bezier(.22,1,.36,1), top .5s cubic-bezier(.22,1,.36,1), width .5s cubic-bezier(.22,1,.36,1), height .5s cubic-bezier(.22,1,.36,1);}
#tour-ring{position:fixed;z-index:9998;pointer-events:none;border-radius:16px;display:none;
  box-shadow:0 0 0 3px var(--neon-blue), 0 0 22px rgba(0,170,255,.55);
  transition:left .5s cubic-bezier(.22,1,.36,1), top .5s cubic-bezier(.22,1,.36,1), width .5s cubic-bezier(.22,1,.36,1), height .5s cubic-bezier(.22,1,.36,1);
  animation:tourPulse 1.8s ease-in-out infinite;}
@keyframes tourPulse{0%,100%{box-shadow:0 0 0 3px var(--neon-blue),0 0 16px rgba(0,170,255,.45);}
  50%{box-shadow:0 0 0 3px var(--neon-green),0 0 30px rgba(0,255,65,.55);}}
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
    let raisedStack = []; // 因“被困于祖先堆叠上下文”而一并抬升的祖先，离开时还原
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

        const ring = document.createElement('div');
        ring.id = 'tour-ring';

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
        // 导览按钮（上一步/下一步/暂停/跳过）的点击不要冒泡到 document，
        // 避免触发页面“点击空白关闭下拉框”的逻辑把正在讲解的下拉框关掉
        guide.addEventListener('click', e => e.stopPropagation());

        document.body.appendChild(highlight);
        document.body.appendChild(ring);
        document.body.appendChild(pointer);
        document.body.appendChild(clickRing);
        document.body.appendChild(guide);

        dom = {
            highlight, ring, pointer, clickRing, guide,
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
        return { left, top, w, h, right: left + w, bottom: top + h };
    }

    // 客服旋钮（真实悬浮窗）悬浮在讲解信息卡片内右上角，跟随卡片移动到当前区块
    function placeFabInGuide(gr) {
        if (!supportFab || !gr) return;
        const fw = 44, fh = 44, inset = 16;
        // 贴住卡片右上角内侧，像卡片自带的“旋钮”
        let left = gr.right - fw - inset;
        let top = gr.top + inset;
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

        // 蓝色边框环与聚光同位置，但置于弹窗之上（弹窗内容可见、边框不被盖住）
        if (dom.ring) {
            dom.ring.style.left = (rect.left - pad) + 'px';
            dom.ring.style.top = (rect.top - pad) + 'px';
            dom.ring.style.width = (rect.width + pad * 2) + 'px';
            dom.ring.style.height = (rect.height + pad * 2) + 'px';
        }

        // 讲解气泡贴着被讲解的元素（选空白处一侧、留间距），随步骤滑动且不会遮挡讲解区域
        const side = chooseSide(rect);
        const gr = placeGuide(rect, side);
        placeFabInGuide(gr); // 客服旋钮悬浮在信息卡片内右上角，跟随卡片移动

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
    // 是否需要滚动到目标：不在视口内，或被某个可滚动祖先裁剪（如 VIP 弹窗内部 overflow-y:auto）
    function needsScroll(el) {
        if (!isInView(el)) return true;
        let p = el.parentElement;
        while (p && p !== document.body && p !== document.documentElement) {
            const oy = getComputedStyle(p).overflowY;
            if ((oy === 'auto' || oy === 'scroll') && p.scrollHeight > p.clientHeight + 1) {
                const er = el.getBoundingClientRect();
                const pr = p.getBoundingClientRect();
                if (er.top < pr.top - 2 || er.bottom > pr.bottom + 2) return true;
            }
            p = p.parentElement;
        }
        return false;
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
        // 弹窗不抬到暗色遮罩之上：统一由 #tour-highlight 选择框“挖洞”透出，背景由同一块遮罩变暗
        if (node && node.id && node.id.endsWith('-modal')) return null;
        let el = node;
        while (el && el !== document.body) {
            const z = getComputedStyle(el).zIndex;
            if (z !== 'auto' && z !== '') {
                if (el._tourZ === undefined) el._tourZ = el.style.zIndex;
                el.style.zIndex = '9995';
                // 若其祖先创建了更低层级的堆叠上下文（如 fixed 顶栏 z-100），该弹层会被“困住”
                // 仍被导览暗色遮罩盖住——一并抬升这些祖先，使其逃逸到遮罩之上
                let p = el.parentElement;
                while (p && p !== document.body) {
                    const pcs = getComputedStyle(p);
                    const pz = parseInt(pcs.zIndex, 10);
                    if ((pcs.position === 'relative' || pcs.position === 'absolute' || pcs.position === 'fixed') && !isNaN(pz) && pz < 9991) {
                        if (p._tourZ === undefined) p._tourZ = p.style.zIndex;
                        p.style.zIndex = '9992';
                        if (!raisedStack.some(r => r.el === p)) raisedStack.push({ el: p, z: p._tourZ });
                    }
                    p = p.parentElement;
                }
                return el;
            }
            el = el.parentElement;
        }
        if (node._tourZ === undefined) node._tourZ = node.style.zIndex;
        node.style.zIndex = '9995';
        return node;
    }
    // 关闭弹窗：优先点弹窗自带的关闭按钮（与站点原生关闭一致），否则直接移除
    function closeModal(node) {
        // 用户下拉菜单：通过触发按钮关闭，避免误点内部按钮或误删 DOM
        if (node && node.id === 'dropdown-menu') {
            const t = document.getElementById('auth-toggle');
            if (t) { t.click(); return; }
        }
        // 通知下拉框：点触发按钮关闭，避免误点内部“全部已读 / 联系客服”或误删 DOM
        if (node && node.id === 'notification-dropdown') {
            const b = document.getElementById('notification-btn');
            if (b) { b.click(); return; }
        }
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
            // keepOpen：弹窗需保持打开以继续讲解其内部（如节点订阅配置），离开时不关闭
            if (!step.keepOpen) revealed.forEach(r => { closeModal(r.node); });
        }
        // keepOpen 的步骤：保留弹窗与其被提升的层级，直到“收尾”步骤才清理
        if (!step.keepOpen) {
            revealed.forEach(r => { if (r.anchor && r.anchor !== el) r.anchor.style.zIndex = r.anchor._tourZ ?? ''; });
            raisedStack.forEach(r => { r.el.style.zIndex = r.z ?? ''; });
            raisedStack = [];
            revealed = [];
        }
    }

    // ===== 步骤切换 =====
    function goTo(i) {
        if (i < 0 || i >= STEPS.length) return;
        if (clickTimer) clearTimeout(clickTimer);
        if (autoTimer) clearTimeout(autoTimer); // 取消上一轮的自动前进，避免重复触发
        leaveStep(activeEl, activeStep); // 清理上一步

        idx = i;
        const step = STEPS[idx];
        let el = document.querySelector(step.sel);
        if (!el) { finish(); return; }
        // 下拉框步骤：若所属下拉框被（点击空白 / 导览按钮冒泡等）关闭，重新打开后再定位，避免后续步骤定位不到元素
        const owner = el.closest && (el.closest('#dropdown-menu') || el.closest('[id$="-dropdown"]'));
        if (owner && !isVisible(owner)) {
            const trigId = owner.id === 'dropdown-menu' ? 'auth-toggle' : owner.id.replace('-dropdown', '-btn');
            const trig = trigId && document.getElementById(trigId);
            if (trig) trig.click();
            el = document.querySelector(step.sel);
        }
        if (!el || !isVisible(el)) { finish(); return; }

        activeEl = el; activeStep = step;

        dom.skip.textContent = ui('skip');
        dom.prev.textContent = ui('prev');
        dom.next.textContent = idx >= STEPS.length - 1 ? ui('finish') : ui('next');
        dom.title.textContent = txt(step.t);
        dom.desc.textContent = txt(step.d);
        dom.group.textContent = txt(step.groupTitle);                 // 大功能名（pill）
        dom.step.textContent = `第 ${idx + 1} / ${STEPS.length} 步 · ${step.groupStep + 1}/${step.groupCount}`; // 大功能内进度
        dom.prev.disabled = idx === 0;

        if (needsScroll(el)) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
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

        [dom.highlight, dom.ring].forEach(e => e.style.display = 'block');
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

        // 按当前会员状态重算导航与节点套餐步骤，再展平
        GROUPS[0].steps = navStepsForUser();
        GROUPS[1].steps = planStepsForUser();
        buildSteps();
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
        raisedStack.forEach(r => { r.el.style.zIndex = r.z ?? ''; });
        raisedStack = [];
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
            dom.ring.style.display = 'none';
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
