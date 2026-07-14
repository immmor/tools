document.addEventListener('DOMContentLoaded', () => {
    const SupportModule = (() => {
        let questions = [];
        let loadedLang = null;
        let chatHistory = [];
        let isChatMode = false;
        let ws = null;
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
                // 复制一份用于无缝循环滚动
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
                        <span class="w-2 h-2 bg-zinc-500 rounded-full animate-bounce" style="animation-delay: 0ms"></span>
                        <span class="w-2 h-2 bg-zinc-500 rounded-full animate-bounce" style="animation-delay: 150ms"></span>
                        <span class="w-2 h-2 bg-zinc-500 rounded-full animate-bounce" style="animation-delay: 300ms"></span>
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

        const getActionHandler = (actionType) => {
            switch (actionType) {
                case 'openRecharge':
                    return () => {
                        const userInfo = window.userInfo || JSON.parse(localStorage.getItem('userInfo') || '{}');
                        const username = userInfo.username || '';
                        window.open(`https://immmor.com/pay?username=${encodeURIComponent(username)}`, '_blank');
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
                default:
                    return null;
            }
        };

        const addBotMessage = async (text, action) => {
            removeTypingIndicator();
            const div = document.createElement('div');
            div.className = 'flex gap-3 support-bot-message';
            div.innerHTML = `
                <div class="w-8 h-8 rounded-full bg-[var(--neon-blue)] flex items-center justify-center text-black text-xs font-bold shrink-0">
                    <i data-lucide="headphones" class="w-4 h-4"></i>
                </div>
                <div class="max-w-[80%]">
                    <div class="support-bubble px-4 py-3 text-sm"></div>
                </div>
            `;
            messagesContainer.appendChild(div);
            messagesContainer.scrollTop = messagesContainer.scrollHeight;
            if (window.lucide) lucide.createIcons();
            
            const bubble = div.querySelector('.support-bubble');
            await typeWriter(bubble, text, 30);

            if (action && action.label) {
                const btn = document.createElement('button');
                btn.className = 'support-action-btn mt-3';
                btn.textContent = action.label;
                const handler = getActionHandler(action.type);
                if (handler) btn.onclick = handler;
                bubble.appendChild(btn);
                messagesContainer.scrollTop = messagesContainer.scrollHeight;
            }
        };

        const addMessage = (type, text) => {
            const div = document.createElement('div');
            div.className = `flex gap-3 ${type === 'user' ? 'support-user-message' : 'support-bot-message'}`;
            
            if (type === 'user') {
                div.innerHTML = `
                    <div class="max-w-[80%]">
                        <div class="support-bubble px-4 py-3 text-sm">${text}</div>
                    </div>
                `;
            } else {
                div.innerHTML = `
                    <div class="w-8 h-8 rounded-full bg-[var(--neon-blue)] flex items-center justify-center text-black text-xs font-bold shrink-0">
                        <i data-lucide="headphones" class="w-4 h-4"></i>
                    </div>
                    <div class="max-w-[80%]">
                        <div class="support-bubble px-4 py-3 text-sm">${text}</div>
                    </div>
                `;
            }
            
            messagesContainer.appendChild(div);
            messagesContainer.scrollTop = messagesContainer.scrollHeight;
            if (window.lucide) lucide.createIcons();
        };

        const addRelatedQuestions = async (questions) => {
            removeTypingIndicator();
            const div = document.createElement('div');
            div.className = 'flex gap-3 support-bot-message';
            div.innerHTML = `
                <div class="w-8 h-8 rounded-full bg-[var(--neon-blue)] flex items-center justify-center text-black text-xs font-bold shrink-0">
                    <i data-lucide="headphones" class="w-4 h-4"></i>
                </div>
                <div class="max-w-[80%]">
                    <div class="support-bubble px-4 py-3 text-sm"></div>
                </div>
            `;
            messagesContainer.appendChild(div);
            messagesContainer.scrollTop = messagesContainer.scrollHeight;
            if (window.lucide) lucide.createIcons();

            const bubble = div.querySelector('.support-bubble');
            const moreInfoLabel = (window.translations && window.translations[window.currentLang]?.support_more_info) || '您可能还想了解：';
            
            const labelSpan = document.createElement('span');
            labelSpan.textContent = moreInfoLabel;
            bubble.appendChild(labelSpan);

            const suggestionsWrap = document.createElement('div');
            suggestionsWrap.className = 'support-related-wrap';
            questions.forEach(q => {
                const tag = document.createElement('span');
                tag.className = 'support-suggestion';
                tag.textContent = q.question.replace('？', '').replace('?', '');
                tag.onclick = () => handleSuggestionClick(q);
                suggestionsWrap.appendChild(tag);
            });
            bubble.appendChild(suggestionsWrap);
            
            messagesContainer.scrollTop = messagesContainer.scrollHeight;
        };

        const handleSuggestionClick = async (questionData) => {
            if (isChatMode) return;
            addMessage('user', questionData.question);
            chatHistory.push({ type: 'user', text: questionData.question });
            const minDelay = 800;
            const maxDelay = 1500;
            const delay = Math.floor(Math.random() * (maxDelay - minDelay + 1)) + minDelay;
            await new Promise(resolve => setTimeout(resolve, delay));
            showTypingIndicator();
            const typingDuration = 500 + Math.floor(Math.random() * 800);
            await new Promise(resolve => setTimeout(resolve, typingDuration));
            await addBotMessage(questionData.answer, questionData.action);
            chatHistory.push({ type: 'bot', text: questionData.answer });
        };

        const fuzzySearch = (query) => {
            if (!query.trim()) return [];
            const queryLower = query.toLowerCase();
            return questions.map(q => {
                const questionLower = q.question.toLowerCase();
                let score = 0;
                
                if (questionLower.includes(queryLower)) {
                    score += 10;
                    const index = questionLower.indexOf(queryLower);
                    if (index === 0) score += 5;
                }
                
                queryLower.split('').forEach(char => {
                    if (questionLower.includes(char)) score += 1;
                });
                
                return { ...q, score };
            })
            .filter(q => q.score > 0)
            .sort((a, b) => b.score - a.score)
            .slice(0, 3);
        };

        const checkHumanService = (text) => {
            const keywords = ['人工', '客服', 'human', 'service', '真人'];
            return keywords.some(k => text.toLowerCase().includes(k));
        };

        const confirmHumanService = async () => {
            const confirmText = (window.translations && window.translations[window.currentLang]?.support_confirm_human) || '确定要转接人工客服吗？如果当前没有客服在线，您的问题将转为留言。';
            const confirmBtnText = (window.translations && window.translations[window.currentLang]?.support_confirm) || '确定';
            const cancelBtnText = (window.translations && window.translations[window.currentLang]?.support_cancel) || '取消';
            
            removeTypingIndicator();
            const div = document.createElement('div');
            div.className = 'flex gap-3 support-bot-message';
            div.innerHTML = `
                <div class="w-8 h-8 rounded-full bg-[var(--neon-blue)] flex items-center justify-center text-black text-xs font-bold shrink-0">
                    <i data-lucide="headphones" class="w-4 h-4"></i>
                </div>
                <div class="max-w-[80%]">
                    <div class="support-bubble px-4 py-3 text-sm">${confirmText}</div>
                    <div class="flex gap-2 mt-3">
                        <button class="support-action-btn bg-[var(--neon-green)]" id="support-human-confirm">${confirmBtnText}</button>
                        <button class="support-action-btn bg-zinc-600" id="support-human-cancel">${cancelBtnText}</button>
                    </div>
                </div>
            `;
            messagesContainer.appendChild(div);
            messagesContainer.scrollTop = messagesContainer.scrollHeight;
            if (window.lucide) lucide.createIcons();

            return new Promise((resolve) => {
                document.getElementById('support-human-confirm').onclick = () => {
                    resolve(true);
                };
                document.getElementById('support-human-cancel').onclick = () => {
                    resolve(false);
                };
            });
        };

        const getSupportStatus = async () => {
            try {
                const res = await fetch('https://api.funbua.uk/api/support/status');
                const data = await res.json();
                return data.data?.online || false;
            } catch {
                return false;
            }
        };

        const sendMessageToSupport = async (content) => {
            const userInfo = window.userInfo || JSON.parse(localStorage.getItem('userInfo') || '{}');
            const history = chatHistory.map(h => `${h.type === 'user' ? '[用户]' : '[客服]'} ${h.text}`).join('\n');
            
            try {
                const res = await fetch('https://api.funbua.uk/api/support/message', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        username: userInfo.username || '',
                        content,
                        history
                    })
                });
                const data = await res.json();
                return data.code === 200;
            } catch {
                return false;
            }
        };

        const enterChatMode = () => {
            isChatMode = true;
            suggestionsContainer.style.display = 'none';
            const modeText = (window.translations && window.translations[window.currentLang]?.support_chat_mode) || '已进入人工客服模式';
            addMessage('bot', modeText);
        };

        const handleSend = async () => {
            const text = input.value.trim();
            if (!text) return;
            
            addMessage('user', text);
            chatHistory.push({ type: 'user', text });
            input.value = '';

            if (isChatMode) {
                return;
            }

            if (checkHumanService(text)) {
                const confirmed = await confirmHumanService();
                if (!confirmed) {
                    return;
                }

                const isOnline = await getSupportStatus();
                if (isOnline) {
                    enterChatMode();
                } else {
                    const offlineText = (window.translations && window.translations[window.currentLang]?.support_offline) || '当前没有客服在线，您的问题已转为留言，我们会尽快回复您！';
                    addMessage('bot', offlineText);
                    await sendMessageToSupport(text);
                }
                return;
            }

            const results = fuzzySearch(text);
            
            const minDelay = 800;
            const maxDelay = 2000;
            const delay = Math.floor(Math.random() * (maxDelay - minDelay + 1)) + minDelay;
            await new Promise(resolve => setTimeout(resolve, delay));
            
            if (results.length > 0) {
                showTypingIndicator();
                const typingDuration = 500 + Math.floor(Math.random() * 1000);
                await new Promise(resolve => setTimeout(resolve, typingDuration));
                await addBotMessage(results[0].answer, results[0].action);
                chatHistory.push({ type: 'bot', text: results[0].answer });
                
                if (results.length > 1) {
                    await new Promise(resolve => setTimeout(resolve, 800));
                    showTypingIndicator();
                    await new Promise(resolve => setTimeout(resolve, 500));
                    await addRelatedQuestions(results.slice(1));
                }
            } else {
                showTypingIndicator();
                await new Promise(resolve => setTimeout(resolve, 1000));
                const noAnswer = (window.translations && window.translations[window.currentLang]?.support_no_answer) || '抱歉，我暂时无法回答这个问题。请详细描述您的问题，我们会尽快为您解决。';
                await addBotMessage(noAnswer);
                chatHistory.push({ type: 'bot', text: noAnswer });
            }
        };

        const openModal = () => {
            modal.classList.remove('hidden');
            if (window.lucide) lucide.createIcons();
            chatHistory = [];
            isChatMode = false;
            const currentLang = window.currentLang || 'zh-CN';
            if (questions.length === 0 || loadedLang !== currentLang) {
                loadQuestions();
            }
        };

        const closeModal = () => {
            modal.classList.add('hidden');
            if (ws) {
                ws.close();
                ws = null;
            }
        };

        const updateLanguage = () => {
            questions = [];
            messagesContainer.innerHTML = '';
            chatHistory = [];
            isChatMode = false;
            loadQuestions();
            const welcomeMsg = (window.translations && window.translations[window.currentLang]?.support_welcome) || '您好！欢迎来到 PHANTOM VPN 客服中心。我是您的智能客服助手，有什么可以帮助您的吗？';
            addMessage('bot', welcomeMsg);
        };

        closeBtn?.addEventListener('click', closeModal);
        modal?.addEventListener('click', (e) => {
            if (e.target === modal) closeModal();
        });
        sendBtn?.addEventListener('click', handleSend);
        input?.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') handleSend();
        });

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
