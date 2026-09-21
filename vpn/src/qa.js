document.addEventListener('DOMContentLoaded', () => {
    const SupportModule = (() => {
        let questions = [];
        let loadedLang = null;
        let idleTimer = null;
        let isLeaveMessageMode = false;
        let isBotReplying = false;
        // 回复期间仅禁用发送按钮；输入框保持可聚焦/可输入（不禁用，避免失焦）
        const setInputEnabled = (enabled) => {
            if (sendBtn) sendBtn.disabled = !enabled;
        };
        const modal = document.getElementById('support-modal');
        const closeBtn = document.getElementById('support-close');
        const messagesContainer = document.getElementById('support-messages');
        const input = document.getElementById('support-input');
        const sendBtn = document.getElementById('support-send');
        const suggestionsContainer = document.getElementById('support-suggestions');

        const loadQuestions = async () => {
            try {
                const lang = window.currentLang || 'zh-CN';
                const response = await fetch(`lang/questions-${lang}.json`);
                questions = await response.json();
                loadedLang = lang;
                renderSuggestions();
            } catch (error) {
                console.error('加载常见问题失败:', error);
            }
        };

        const enableDragScroll = (row, track, offsetStart) => {
            let scrollPos = 0;
            let isDragging = false;
            let autoPaused = false;
            let startX = 0;
            let startScroll = 0;
            let moved = false;
            let rafId = null;

            const getHalfWidth = () => track.scrollWidth / 2;

            // 第二行从中间开始，错开显示
            requestAnimationFrame(() => {
                const half = getHalfWidth();
                if (offsetStart && half > 0) {
                    scrollPos = half / 2;
                    track.style.transform = `translateX(${-scrollPos}px)`;
                }
            });

            const autoScroll = () => {
                if (!isDragging && !autoPaused) {
                    scrollPos += 0.35;
                    const half = getHalfWidth();
                    if (half > 0) {
                        if (scrollPos >= half) scrollPos -= half;
                        track.style.transform = `translateX(${-scrollPos}px)`;
                    }
                }
                rafId = requestAnimationFrame(autoScroll);
            };

            let pointerActive = false;
            let pointerId = null;

            row.addEventListener('pointerdown', (e) => {
                pointerActive = true;
                pointerId = e.pointerId;
                moved = false;
                startX = e.clientX;
                startScroll = scrollPos;
            });
            row.addEventListener('pointermove', (e) => {
                if (!pointerActive) return;
                const dx = e.clientX - startX;
                // 超过阈值才进入拖拽，并捕获指针，避免影响普通点击
                if (!isDragging && Math.abs(dx) > 5) {
                    isDragging = true;
                    moved = true;
                    try { row.setPointerCapture(pointerId); } catch (_) {}
                    row.classList.add('dragging');
                }
                if (isDragging) {
                    let newPos = startScroll - dx;
                    const half = getHalfWidth();
                    if (half > 0) {
                        while (newPos < 0) newPos += half;
                        while (newPos >= half) newPos -= half;
                        scrollPos = newPos;
                        track.style.transform = `translateX(${-scrollPos}px)`;
                    }
                }
            });
            const endDrag = (e) => {
                if (!pointerActive) return;
                const wasDragging = isDragging;
                pointerActive = false;
                isDragging = false;
                if (wasDragging) {
                    row.classList.remove('dragging');
                    try { row.releasePointerCapture(pointerId); } catch (_) {}
                }
            };
            row.addEventListener('pointerup', endDrag);
            row.addEventListener('pointercancel', endDrag);

            row.addEventListener('mouseenter', () => { autoPaused = true; });
            row.addEventListener('mouseleave', () => { autoPaused = false; });

            // 拖拽后抑制误触的点击
            row.addEventListener('click', (e) => {
                if (moved) {
                    e.stopPropagation();
                    e.preventDefault();
                    moved = false;
                }
            }, true);

            rafId = requestAnimationFrame(autoScroll);
        };

        const renderSuggestions = () => {
            suggestionsContainer.innerHTML = '';
            suggestionsContainer.className = 'mb-3 support-suggestions-wrap';

            const mid = Math.ceil(questions.length / 2);
            const halves = [questions.slice(0, mid), questions.slice(mid)];

            halves.forEach((half, idx) => {
                if (half.length === 0) return;
                const row = document.createElement('div');
                row.className = 'support-suggestions-row';
                const track = document.createElement('div');
                track.className = 'support-suggestions-inner';
                const buildItems = () => {
                    const frag = document.createDocumentFragment();
                    half.forEach(q => {
                        const tag = document.createElement('span');
                        tag.className = 'support-suggestion';
                        tag.textContent = q.question.replace('？', '').replace('?', '');
                        tag.onclick = () => handleSuggestionClick(q);
                        frag.appendChild(tag);
                    });
                    return frag;
                };
                track.appendChild(buildItems());
                track.appendChild(buildItems());
                row.appendChild(track);
                suggestionsContainer.appendChild(row);
                enableDragScroll(row, track, idx === 1);
            });
        };

        const removeTypingIndicator = () => {
            const indicator = document.getElementById('support-typing-indicator');
            if (indicator) {
                indicator.remove();
            }
        };

        const showTypingIndicator = () => {
            removeTypingIndicator();
            const div = document.createElement('div');
            div.id = 'support-typing-indicator';
            div.className = 'flex gap-3 support-bot-message';
            div.innerHTML = `
                <div class="w-8 h-8 rounded-full bg-[var(--neon-blue)] flex items-center justify-center text-black text-xs font-bold shrink-0">
                    <i data-lucide="headphones" class="w-4 h-4"></i>
                </div>
                <div class="max-w-[80%]">
                    <div class="support-bubble px-4 py-3 text-sm flex gap-1">
                        <span class="w-2 h-2 bg-zinc-500 rounded-full animate-bounce" style="animation-delay: ${Math.random() * 200}ms"></span>
                        <span class="w-2 h-2 bg-zinc-500 rounded-full animate-bounce" style="animation-delay: ${150 + Math.random() * 200}ms"></span>
                        <span class="w-2 h-2 bg-zinc-500 rounded-full animate-bounce" style="animation-delay: ${300 + Math.random() * 200}ms"></span>
                    </div>
                </div>
            `;
            messagesContainer.appendChild(div);
            messagesContainer.scrollTop = messagesContainer.scrollHeight;
            if (window.lucide) lucide.createIcons();
        };

        const typeWriter = (element, text, speed = 30) => {
            let i = 0;
            element.textContent = '';
            return new Promise((resolve) => {
                const timer = setInterval(() => {
                    if (i < text.length) {
                        element.textContent += text.charAt(i);
                        i++;
                        messagesContainer.scrollTop = messagesContainer.scrollHeight;
                    } else {
                        clearInterval(timer);
                        resolve();
                    }
                }, speed);
            });
        };

        const addBotMessageStream = async (text, action) => {
            isBotReplying = true;
            setInputEnabled(false);
            if (Math.random() > 0.3) {
                showTypingIndicator();
                await new Promise(resolve => setTimeout(resolve, 500 + Math.random() * 800));
            }
            removeTypingIndicator();
            const div = document.createElement('div');
            div.className = 'flex gap-3 support-bot-message';
            div.innerHTML = `
                <div class="w-8 h-8 rounded-full bg-[var(--neon-blue)] flex items-center justify-center text-black text-xs font-bold shrink-0">
                    <i data-lucide="headphones" class="w-4 h-4"></i>
                </div>
                <div class="max-w-[80%] js-bubble-wrap">
                    <div class="support-bubble px-4 py-3 text-sm"></div>
                </div>
            `;
            messagesContainer.appendChild(div);
            messagesContainer.scrollTop = messagesContainer.scrollHeight;
            if (window.lucide) lucide.createIcons();
            appendMsgTime(div, new Date());

            const bubble = div.querySelector('.support-bubble');
            await typeWriter(bubble, text, 30 + Math.random() * 20);

            if (action && action.label) {
                const btn = document.createElement('button');
                btn.className = 'support-action-btn mt-3';
                btn.textContent = action.label;
                const handler = getActionHandler(action.type);
                if (handler) btn.onclick = handler;
                bubble.appendChild(btn);
                messagesContainer.scrollTop = messagesContainer.scrollHeight;
            }
            isBotReplying = false;
            setInputEnabled(true);
        };

        const getActionHandler = (actionType) => {
            switch (actionType) {
                case 'openRecharge':
                    return () => {
                        const userInfo = window.userInfo || JSON.parse(localStorage.getItem('userInfo') || '{}');
                        const username = userInfo.username || '';
                        const lang = (window.currentLang || 'zh-CN').split('-')[0];
                        window.open(`https://funbua.uk/vpay?username=${encodeURIComponent(username)}&lang=${encodeURIComponent(lang)}`, '_blank');
                    };
                case 'openLogin':
                    return () => {
                        const toggle = document.getElementById('auth-toggle');
                        if (toggle) toggle.click();
                        SupportModule.close();
                    };
                case 'openDownload':
                    return () => {
                        window.location.href = 'download.html';
                    };
                case 'openVip':
                    return () => {
                        if (typeof showVipNodes === 'function') {
                            showVipNodes();
                        }
                        SupportModule.close();
                    };
                case 'openInvite':
                    return () => {
                        const inviteBtn = document.getElementById('invite-btn');
                        if (inviteBtn) inviteBtn.click();
                        else {
                            const loginHandler = getActionHandler('openLogin');
                            if (loginHandler) loginHandler();
                        }
                        SupportModule.close();
                    };
                case 'openAgent':
                    return () => {
                        document.getElementById('agent-btn')?.click();
                        SupportModule.close();
                    };
                case 'openLanguage':
                    return () => {
                        document.getElementById('lang-btn')?.click();
                        SupportModule.close();
                    };
                case 'openComplaintModal':
                    return () => {
                        document.getElementById('complaint-btn')?.click();
                        SupportModule.close();
                    };
                case 'openComplaint':
                    return async () => {
                        isLeaveMessageMode = true;
                        const msg = (window.translations && window.translations[window.currentLang]?.support_idle_msg) || '您可以留下您的问题，我们会尽快回复您。';
                        await addBotMessageStream(msg);
                        input.placeholder = (window.translations && window.translations[window.currentLang]?.support_leave_placeholder) || '请输入您的留言...';
                    };
                default:
                    return null;
            }
        };

        // ===== 消息时间显示 & 客服回复轮询 =====
        const API_BASE = 'https://api.funbua.uk';
        // 本地时间 -> 'HH:MM'
        const fmtClock = (date) => {
            const h = String(date.getHours()).padStart(2, '0');
            const m = String(date.getMinutes()).padStart(2, '0');
            return `${h}:${m}`;
        };
        // 把时间元素追加到气泡下方的容器
        const appendMsgTime = (div, date) => {
            const wrap = div.querySelector('.js-bubble-wrap');
            if (!wrap) return;
            const t = document.createElement('div');
            t.className = 'support-msg-time';
            t.textContent = fmtClock(date);
            wrap.appendChild(t);
        };
        // 后端 created_at 形如 'YYYY-MM-DD HH:MM:SS'（UTC），转本地 Date
        const parseMsgTime = (createdAt) => new Date(String(createdAt).replace(' ', 'T') + 'Z');
        // 是否当天（按本地日期比较）—— 只显示当前时间段的消息
        const isSameLocalDay = (date) => {
            const now = new Date();
            return date.getFullYear() === now.getFullYear()
                && date.getMonth() === now.getMonth()
                && date.getDate() === now.getDate();
        };
        // 已渲染的客服回复 id，避免轮询重复显示
        const shownReplyIds = new Set();
        // 用户成功提交留言的时间；只有此后到达的客服回复才显示（避免一打开就翻出历史消息）
        let leaveSubmittedAt = null;
        const pollSupportReplies = async () => {
            const userInfo = window.userInfo || JSON.parse(localStorage.getItem('userInfo') || '{}');
            const username = userInfo.username;
            if (!username || !leaveSubmittedAt) return; // 未登录 / 未留言不拉取
            replyPollCount++;
            try {
                const res = await fetch(`${API_BASE}/api/messages?username=${encodeURIComponent(username)}`);
                const data = await res.json();
                const list = (data && data.data && data.data.messages) || [];
                let gotReply = false;
                list.forEach((m) => {
                    if (shownReplyIds.has(m.id)) return;
                    const date = parseMsgTime(m.created_at);
                    if (date < leaveSubmittedAt) return; // 只显示留言之后的消息
                    shownReplyIds.add(m.id);
                    addMessage('support', m.content, date);
                    gotReply = true;
                    // 标记已读，避免重复拉取
                    fetch(`${API_BASE}/api/messages/read`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ messageId: m.id, username })
                    }).catch(() => {});
                });
                // 收到客服回复，或达到最大轮询次数（2 分钟），即停止轮询
                if (gotReply || replyPollCount >= REPLY_POLL_MAX) {
                    leaveSubmittedAt = null;
                    stopReplyPolling();
                }
            } catch (e) { /* 静默，下一轮继续 */ }
        };
        const REPLY_POLL_INTERVAL = 15000; // 客服回复轮询间隔（毫秒）
        const REPLY_POLL_MAX = 8; // 最多轮询次数：8 × 15s = 2 分钟
        let replyPollTimer = null;
        let replyPollCount = 0;
        const startReplyPolling = () => {
            if (replyPollTimer) return;
            pollSupportReplies();
            replyPollTimer = setInterval(pollSupportReplies, REPLY_POLL_INTERVAL);
        };
        const stopReplyPolling = () => {
            if (replyPollTimer) { clearInterval(replyPollTimer); replyPollTimer = null; }
        };

        const addMessage = (type, text, time) => {
            const date = (time instanceof Date) ? time : new Date();
            const isSupport = type === 'support';
            const div = document.createElement('div');
            div.className = `flex gap-3 ${type === 'user' ? 'support-user-message' : 'support-bot-message'}`;
            
            if (type === 'user') {
                div.innerHTML = `
                    <div class="max-w-[80%] js-bubble-wrap">
                        <div class="support-bubble px-4 py-3 text-sm">${text}</div>
                    </div>
                `;
            } else if (isSupport) {
                div.innerHTML = `
                    <div class="w-8 h-8 rounded-full bg-[var(--neon-blue)] flex items-center justify-center text-black text-xs font-bold shrink-0">
                        <i data-lucide="headphones" class="w-4 h-4"></i>
                    </div>
                    <div class="max-w-[80%] js-bubble-wrap">
                        <span style="display:inline-block;font-size:10px;color:var(--neon-blue);opacity:.75;margin-bottom:4px;">客服</span>
                        <div class="support-bubble px-4 py-3 text-sm bg-[#22c55e26] border border-[#22c55e80]">${text}</div>
                    </div>
                `;
            } else {
                div.innerHTML = `
                    <div class="w-8 h-8 rounded-full bg-[var(--neon-blue)] flex items-center justify-center text-black text-xs font-bold shrink-0">
                        <i data-lucide="headphones" class="w-4 h-4"></i>
                    </div>
                    <div class="max-w-[80%] js-bubble-wrap">
                        <div class="support-bubble px-4 py-3 text-sm">${text}</div>
                    </div>
                `;
            }
            
            appendMsgTime(div, date);
            messagesContainer.appendChild(div);
            messagesContainer.scrollTop = messagesContainer.scrollHeight;
            if (window.lucide) lucide.createIcons();
        };

        const addRelatedQuestions = async (questions) => {
            const moreInfoLabel = (window.translations && window.translations[window.currentLang]?.support_more_info) || '您可能还想了解：';

            const suggestionsWrap = document.createElement('div');
            suggestionsWrap.className = 'support-related-wrap';
            questions.forEach(q => {
                const tag = document.createElement('span');
                tag.className = 'support-suggestion';
                tag.textContent = q.question.replace('？', '').replace('?', '');
                tag.onclick = () => handleSuggestionClick(q);
                suggestionsWrap.appendChild(tag);
            });

            // 标签与推荐按钮放在同一个气泡内
            const div = document.createElement('div');
            div.className = 'flex gap-3 support-bot-message';
            div.innerHTML = `
                <div class="w-8 h-8 rounded-full bg-[var(--neon-blue)] flex items-center justify-center text-black text-xs font-bold shrink-0">
                    <i data-lucide="headphones" class="w-4 h-4"></i>
                </div>
                <div class="max-w-[80%] js-bubble-wrap">
                    <div class="support-bubble px-4 py-3 text-sm">
                        <span class="support-related-label">${moreInfoLabel}</span>
                    </div>
                </div>
            `;
            div.querySelector('.support-bubble').appendChild(suggestionsWrap);
            appendMsgTime(div, new Date());
            messagesContainer.appendChild(div);
            messagesContainer.scrollTop = messagesContainer.scrollHeight;
            if (window.lucide) lucide.createIcons();
        };

        const handleSuggestionClick = async (questionData) => {
            if (isBotReplying) return;
            addMessage('user', questionData.question);
            await addBotMessageStream(questionData.answer, questionData.action);
        };

        // 同义词/归一化词典（按语种）。匹配前把两边都映射到标准词，解决近义词与口语差异。
        // 默认 en 词典作为「通用/跨语种」兜底（英文词在所有语种界面都能命中），zh 为中文口语归一化。
        const SYNONYM_MAP = {
            'zh-CN': {
                '连不上': '连接', '连不了': '连接', '无法连接': '连接', '连不上网': '连接', '断线': '连接', '断流': '连接',
                '充钱': '充值', '续费': '充值', '交钱': '充值', '付款': '充值', '支付': '充值',
                '开户': '开通vip', '开通vip': '开通vip', '买vip': '开通vip', '升级vip': '开通vip', '办会员': '开通vip',
                '慢': '速度慢', '卡': '速度慢', '卡顿': '速度慢', '延迟高': '速度慢',
                '下不了': '下载', '装客户端': '下载', '获取客户端': '下载', '安装包': '下载',
                '代理': '代理商', '加盟': '代理商', '分销': '代理商',
                '封号': '账号被封', '被封': '账号被封',
                '安卓': 'android', '苹果': 'ios', '苹果手机': 'ios',
                '配置': '配置', '导入': '配置', '订阅': '配置', '订阅链接': '配置',
                '密保': '密保', '密保问题': '密保', '安保': '密保',
                '邀请': '邀请', '推广': '邀请', '返利': '邀请', '提成': '邀请',
                '语言': '语言', '切换语言': '语言', '改语言': '语言', '换语言': '语言',
            },
            // 英文及非中文语种的口语归一化（也覆盖用户用英文词搜索的场景）
            'en': {
                'connect': '连接', 'cant connect': '连接', 'cannot connect': '连接', "can't connect": '连接', 'disconnect': '连接', 'drop': '连接', 'keeps dropping': '连接',
                'recharge': '充值', 'top up': '充值', 'topup': '充值', 'pay': '充值', 'payment': '充值', 'subscribe': '充值',
                'slow': '速度慢', 'laggy': '速度慢', 'lag': '速度慢', 'high ping': '速度慢', 'buffering': '速度慢', 'speed': '速度慢',
                'download': '下载', 'install': '下载', 'setup': '下载', 'app': '下载', 'client': '下载', 'get the app': '下载',
                'windows': 'windows', 'mac': 'mac', 'macos': 'mac', 'android': 'android', 'ios': 'ios', 'iphone': 'ios',
                'protocol': '协议', 'vpn protocol': '协议',
                'config': '配置', 'configure': '配置', 'subscription': '配置', 'subscribe link': '配置', 'import': '配置', 'qr': '配置',
                'agent': '代理商', 'reseller': '代理商', 'distributor': '代理商', 'partner': '代理商',
                'banned': '账号被封', 'ban': '账号被封', 'suspended': '账号被封', 'blocked': '账号被封', 'disable': '账号被封',
                'invite': '邀请', 'referral': '邀请', 'affiliate': '邀请', 'commission': '邀请',
                'language': '语言', 'change language': '语言', 'switch language': '语言', 'locale': '语言',
                'vip': '开通vip', 'membership': '开通vip', 'member': '开通vip', 'premium': '开通vip', 'upgrade': '开通vip',
                'security': '密保', 'security question': '密保', '2fa': '密保', 'protect': '密保',
            },
        };
        // 非中文语种统一复用 en 词典（英文通用词在各语种界面都能命中）
        const getSynonyms = (lang) => SYNONYM_MAP[lang] || SYNONYM_MAP['en'];
        // 所有意图归一化词（SYNONYM_MAP 的值）：命中它们说明用户表达了明确的意图，
        // 权重应高于「什么/怎么」这类泛义 2-gram，避免被通用词带偏到错误问题。
        const INTENT_TOKENS = (() => {
            const s = new Set();
            Object.values(SYNONYM_MAP).forEach(m => Object.values(m).forEach(v => s.add(v)));
            return s;
        })();

        // 把文本切成「词单元」：先按词典做最长匹配替换归一化，再按 2-gram + 分词符切分
        const tokenize = (text) => {
            let t = (text || '').toLowerCase();
            // 移除常见标点与空格
            t = t.replace(/[？?！!，,。.、；;：:""''（）()【】\[\]~\-_/\\]/g, ' ');
            // 同义词归一化（长词优先）；优先当前语种词典，再叠加 en 通用词典
            const dict = { ...SYNONYM_MAP['en'], ...getSynonyms(window.currentLang) };
            const keys = Object.keys(dict).sort((a, b) => b.length - a.length);
            keys.forEach(k => { t = t.split(k).join(' ' + dict[k] + ' '); });
            // 中文 2-gram
            const grams = new Set();
            const cn = t.replace(/[^一-龥]/g, '');
            for (let i = 0; i < cn.length - 1; i++) grams.add(cn.substr(i, 2));
            if (cn.length === 1) grams.add(cn);
            // 英文/数字单词
            t.split(/\s+/).forEach(w => { if (w) grams.add(w); });
            return [...grams];
        };

        // 单条问题的可匹配词库（question + keywords + aliases 合并）
        const buildIndexTokens = (q) => {
            const parts = [q.question, ...(q.keywords || []), ...(q.aliases || [])];
            const set = new Set();
            parts.forEach(p => tokenize(p).forEach(tk => set.add(tk)));
            return set;
        };

        const scoreOne = (queryTokens, q) => {
            const idx = buildIndexTokens(q);
            let score = 0;
            queryTokens.forEach(qt => {
                if (idx.has(qt)) score += INTENT_TOKENS.has(qt) ? 10 : (qt.length >= 2 ? 3 : 2); // 意图词权重更高；泛义2-gram降权，避免被通用词误判为命中
            });
            return score;
        };

        // 多意图拆分：按连接词/标点把一句话拆成多个子问题
        const splitIntents = (text) => {
            const segs = text.split(/[，,。.\n；;、]|(?:还有)|(?:另外)|(?:以及)|(?:并且)|(?:\s+和\s+)/).map(s => s.trim()).filter(Boolean);
            return segs.length > 1 ? segs : [text];
        };

        const matchQuestions = (query, limit = 3) => {
            const trimmed = (query || '').trim();
            if (!trimmed) return [];
            // 子意图分别打分后合并，避免一个长句只命中第一条
            const subQueries = splitIntents(trimmed);
            const bestByQuestion = new Map();
            subQueries.forEach(sq => {
                const qt = tokenize(sq);
                if (qt.length === 0) return;
                questions.forEach(q => {
                    const s = scoreOne(qt, q);
                    const key = q.question;
                    if (!bestByQuestion.has(key) || bestByQuestion.get(key) < s) {
                        bestByQuestion.set(key, Math.max(bestByQuestion.get(key) || 0, s));
                    }
                });
            });
            return [...bestByQuestion.entries()]
                .map(([qk, score]) => {
                    const base = questions.find(q => q.question === qk);
                    return { ...base, score };
                })
                .filter(q => q.score > 0)
                .sort((a, b) => b.score - a.score)
                .slice(0, limit);
        };

        // 简单问候：识别后直接在对话里回复问候，不进入留言/转人工流程
        const GREETINGS = ['你好', '您好', 'hi', 'hello', 'hey', 'hiya', '嗨', '在吗', '在么', '有人吗', 'yo', 'hola', 'bonjour', 'привет', 'здравствуйте', '안녕', 'こんにちは', 'こんにちわ', 'مرحبا', 'سلام', 'xin chào', 'chào', 'sup', 'howdy'];
        const isGreeting = (text) => {
            const t = (text || '').trim().toLowerCase();
            if (!t || t.length > 12) return false; // 仅限短句，避免「你好我想问…」被误判
            const clean = t.replace(/[\s，,。.？?！!、；;：:""''（）()【】\[\]~\-_/\\]/g, '');
            return GREETINGS.some(g => clean === g || clean.startsWith(g) || clean.endsWith(g));
        };
        const GREETING_REPLY = {
            'zh-CN': '您好！我是 PHANTOM VPN 智能客服，请问有什么可以帮您？',
            'en-US': 'Hello! I’m your PHANTOM VPN assistant. How can I help you today?',
            'es-ES': '¡Hola! Soy el asistente de soporte de PHANTOM VPN. ¿En qué puedo ayudarte?',
            'ja-JP': 'こんにちは！PHANTOM VPN のサポートアシスタントです。ご用件をお聞かせください。',
            'ko-KR': '안녕하세요! PHANTOM VPN 지원 어시스턴트입니다. 무엇을 도와드릴까요?',
            'ru-RU': 'Здравствуйте! Я ваш помощник поддержки PHANTOM VPN. Чем могу помочь?',
            'vi-VN': 'Xin chào! Tôi là trợ lý hỗ trợ PHANTOM VPN. Tôi có thể giúp gì cho bạn?',
            'ar-SA': 'مرحباً! أنا مساعد دعم PHANTOM VPN. كيف يمكنني مساعدتك؟'
        };
        const getGreetingReply = () => GREETING_REPLY[window.currentLang] || GREETING_REPLY['en-US'];

        const handleSend = async () => {
            if (isBotReplying) return;
            const text = input.value.trim();
            if (!text) return;
            
            addMessage('user', text);
            input.value = '';
            resetIdleTimer();

            if (isGreeting(text)) {
                await addBotMessageStream(getGreetingReply());
                return;
            }

            if (isLeaveMessageMode) {
                const userInfo = window.userInfo || JSON.parse(localStorage.getItem('userInfo') || '{}');
                const username = userInfo.username || '匿名用户';
                const msg = `[投诉] 用户: ${username}\n内容: ${text}`;
                const API = 'https://api.funbua.uk';
                try {
                    await Promise.all([
                        fetch(`${API}/api/send-message`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ content: msg, target: 'single', username: 'admin' })
                        }),
                        fetch(`${API}/api/send-message`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ content: msg, target: 'single', username: 'immmor' })
                        })
                    ]);
                    const successMsg = (window.translations && window.translations[window.currentLang]?.support_leave_success) || '您的留言已提交，我们会尽快回复您！';
                    await addBotMessageStream(successMsg);
                    // 留言提交成功后，才开始监听客服回复（只显示此后的消息）
                    leaveSubmittedAt = new Date();
                    replyPollCount = 0;
                    startReplyPolling();
                } catch (e) {
                    const failMsg = (window.translations && window.translations[window.currentLang]?.support_leave_fail) || '留言提交失败，请稍后重试。';
                    await addBotMessageStream(failMsg);
                }
                isLeaveMessageMode = false;
                input.placeholder = '';
                return;
            }
            
            const humanKeywords = ['留言', '人工', '客服', '真人', '客服人员', '人工服务', '转人工', '联系客服', '客服帮忙'];
            const hasHumanKeyword = humanKeywords.some(k => text.includes(k));
            
            if (hasHumanKeyword) {
                const msg = (window.translations && window.translations[window.currentLang]?.support_idle_msg) || '您可以留下您的问题，我们会尽快回复您。';
                await addBotMessageStream(msg);
                isLeaveMessageMode = true;
                input.placeholder = (window.translations && window.translations[window.currentLang]?.support_leave_placeholder) || '请输入您的留言...';
                return;
            }
            
            const results = matchQuestions(text);
            // 高置信度阈值：分数过低视为未命中，避免噪声误答
            const HIT_THRESHOLD = 6;
            const hits = results.filter(r => r.score >= HIT_THRESHOLD);

            if (hits.length > 0) {
                // 多意图：逐条流式回复，取前 2 条直接应答，其余作为相关推荐
                const primary = hits.slice(0, 1);
                for (const r of primary) {
                    await addBotMessageStream(r.answer, r.action);
                }
                const related = results.filter(r => !primary.includes(r)).slice(0, 3);
                if (related.length > 0) {
                    await addRelatedQuestions(related);
                }
            } else {
                // 兜底：给出最相近的候选问题 + 留言入口，而不是一句冷冰冰的「无法回答」
                const leaveLabel = (window.translations && window.translations[window.currentLang]?.support_leave_btn)
                    || '留言';
                // 留言按钮挂在引导语气泡内，不单独占位气泡
                const guessLabel = (window.translations && window.translations[window.currentLang]?.support_guess)
                    || '没完全理解您的问题，您是不是想：';
                await addBotMessageStream(guessLabel, { type: 'openComplaint', label: leaveLabel });
            }
        };

        const openModal = () => {
            modal.classList.remove('hidden');
            if (window.lucide) lucide.createIcons();
            const currentLang = window.currentLang || 'zh-CN';
            if (questions.length === 0 || loadedLang !== currentLang) {
                loadQuestions();
            }
            resetIdleTimer();
            // 若今天已留言过，重新打开时继续监听客服回复；否则不主动拉取历史消息
            if (leaveSubmittedAt) startReplyPolling();
        };

        // 空闲计时：用户最后一次输入或发消息后 2 分钟无活动，自动转入留言模式
        const resetIdleTimer = () => {
            if (idleTimer) clearTimeout(idleTimer);
            idleTimer = setTimeout(async () => {
                const msg = (window.translations && window.translations[window.currentLang]?.support_idle_msg) || '您可以留下您的问题，我们会尽快回复您。';
                await addBotMessageStream(msg);
                isLeaveMessageMode = true;
                input.placeholder = (window.translations && window.translations[window.currentLang]?.support_leave_placeholder) || '请输入您的留言...';
            }, 120000);
        };

        const closeModal = () => {
            modal.classList.add('hidden');
            if (idleTimer) { clearTimeout(idleTimer); idleTimer = null; }
            isLeaveMessageMode = false;
            isBotReplying = false;
            setInputEnabled(true);
            input.placeholder = '';
            stopReplyPolling();
        };

        const updateLanguage = async () => {
            questions = [];
            messagesContainer.innerHTML = '';
            loadQuestions();
            const welcomeMsg = (window.translations && window.translations[window.currentLang]?.support_welcome) || '您好！欢迎来到 PHANTOM VPN 客服中心。我是您的智能客服助手，有什么可以帮助您的吗？';
            await addBotMessageStream(welcomeMsg);
        };

        closeBtn?.addEventListener('click', closeModal);
        modal?.addEventListener('click', (e) => {
            if (e.target === modal) closeModal();
        });
        sendBtn?.addEventListener('click', handleSend);
        input?.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') handleSend();
        });
        input?.addEventListener('input', resetIdleTimer);

        document.addEventListener('languageChanged', () => {
            if (!modal.classList.contains('hidden')) {
                updateLanguage();
            } else {
                loadedLang = null;
                questions = [];
            }
        });

        return { open: openModal, close: closeModal };
    })();

    window.SupportModule = SupportModule;
});
