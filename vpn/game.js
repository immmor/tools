// ==================== 游戏中心模块 ====================
(function() {
    document.addEventListener('DOMContentLoaded', () => {
        initGameCenter();
    });

    const getGameAudioCtx = () => {
        if (!window._gameAudioCtx) {
            window._gameAudioCtx = new (window.AudioContext || window.webkitAudioContext)();
        }
        const ctx = window._gameAudioCtx;
        if (ctx.state === 'suspended') ctx.resume();
        return ctx;
    };

    const playGameTone = (freq, duration, type = 'square', volume = 0.08) => {
        try {
            const ctx = getGameAudioCtx();
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = type;
            osc.frequency.value = freq;
            gain.gain.setValueAtTime(volume, ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start();
            osc.stop(ctx.currentTime + duration);
        } catch (e) {}
    };

    // 摇摇机音效：拉杆 + 齿轮咔哒 + 机身震动 + 爆金币（Web Audio 纯合成）
    const slotAudio = {
        ctx: null,
        init() {
            if (!this.ctx) this.ctx = new (window.AudioContext || window.webkitAudioContext)();
            if (this.ctx.state === 'suspended') this.ctx.resume();
        },
        playLever() {
            this.init();
            const t = this.ctx.currentTime;
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(120, t);
            osc.frequency.linearRampToValueAtTime(40, t + 0.15);
            gain.gain.setValueAtTime(0.3, t);
            gain.gain.linearRampToValueAtTime(0.01, t + 0.15);
            osc.connect(gain).connect(this.ctx.destination);
            osc.start();
            osc.stop(t + 0.15);
        },
        playReelClick(freq = 280) {
            this.init();
            const t = this.ctx.currentTime;
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(freq, t);
            gain.gain.setValueAtTime(0.1, t);
            gain.gain.linearRampToValueAtTime(0.01, t + 0.04);
            osc.connect(gain).connect(this.ctx.destination);
            osc.start();
            osc.stop(t + 0.04);
        },
        // 滚轮落定音：复用咔哒音色，音高逐个上升（280/310/340）
        playReelStop(index = 0) {
            this.playReelClick(280 + index * 30);
        },
        playShakeSound(duration = 0.5) {
            this.init();
            const t = this.ctx.currentTime;
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(65, t);
            osc.frequency.linearRampToValueAtTime(45, t + duration);
            gain.gain.setValueAtTime(0.4, t);
            gain.gain.linearRampToValueAtTime(0.01, t + duration);
            osc.connect(gain).connect(this.ctx.destination);
            osc.start();
            osc.stop(t + duration);
        },
        playCoinSound(intensity = 1) {
            this.init();
            const now = this.ctx.currentTime;
            const max = intensity === 'max';
            const count = max ? 25 : 10;
            for (let i = 0; i < count; i++) {
                const delay = i * (max ? 0.04 : 0.07);
                const osc = this.ctx.createOscillator();
                const gain = this.ctx.createGain();
                osc.type = 'sine';
                osc.frequency.setValueAtTime(950 + Math.random() * 850, now + delay);
                gain.gain.setValueAtTime(0.18, now + delay);
                gain.gain.linearRampToValueAtTime(0.001, now + delay + 0.12);
                osc.connect(gain).connect(this.ctx.destination);
                osc.start(now + delay);
                osc.stop(now + delay + 0.13);
            }
        }
    };

    let slotSoundRaf = null;
    let slotLastTickIndex = 0;

    const getReelTranslateY = (reel) => {
        const m = getComputedStyle(reel).transform;
        if (!m || m === 'none') return 0;
        const vals = m.match(/matrix\(([^)]+)\)/);
        if (vals) return Math.abs(parseFloat(vals[1].split(',')[5]) || 0);
        const ty = m.match(/translateY\(([^)]+)\)/);
        return ty ? Math.abs(parseFloat(ty[1])) : 0;
    };

    const stopSlotSpinSound = () => {
        if (slotSoundRaf) { cancelAnimationFrame(slotSoundRaf); slotSoundRaf = null; }
        slotLastTickIndex = 0;
    };

    const startSlotSpinSound = (reel, symbolHeight, duration) => {
        stopSlotSpinSound();
        const start = performance.now();
        const loop = (now) => {
            if (now - start > duration + 80) return;
            const idx = Math.floor(getReelTranslateY(reel) / symbolHeight);
            if (idx > slotLastTickIndex) {
                slotAudio.playReelClick();
                slotLastTickIndex = idx;
            }
            slotSoundRaf = requestAnimationFrame(loop);
        };
        slotSoundRaf = requestAnimationFrame(loop);
    };

    // 转盘音效：霓虹机台咔哒 + 中奖琶音（Web Audio 纯合成）
    const wheelAudio = {
        ctx: null,
        init() {
            if (!this.ctx) this.ctx = new (window.AudioContext || window.webkitAudioContext)();
            if (this.ctx.state === 'suspended') this.ctx.resume();
        },
        playTick() {
            this.init();
            const t = this.ctx.currentTime;
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(600, t);
            osc.frequency.exponentialRampToValueAtTime(150, t + 0.05);
            gain.gain.setValueAtTime(0.15, t);
            gain.gain.linearRampToValueAtTime(0.01, t + 0.05);
            osc.connect(gain).connect(this.ctx.destination);
            osc.start();
            osc.stop(t + 0.05);
        },
        playWin() {
            this.init();
            const now = this.ctx.currentTime;
            [523.25, 659.25, 783.99, 1046.50].forEach((freq, i) => {
                const osc = this.ctx.createOscillator();
                const gain = this.ctx.createGain();
                osc.type = 'sine';
                osc.frequency.setValueAtTime(freq, now + i * 0.08);
                gain.gain.setValueAtTime(0.2, now + i * 0.08);
                gain.gain.linearRampToValueAtTime(0.01, now + i * 0.08 + 0.3);
                osc.connect(gain).connect(this.ctx.destination);
                osc.start(now + i * 0.08);
                osc.stop(now + i * 0.08 + 0.3);
            });
        }
    };

    // 中奖音：清脆风铃式上行 + 明亮"叮"收尾（八音盒/抽中奖感）
    const playWinSound = () => {
        try {
            const ctx = getGameAudioCtx();
            const now = ctx.currentTime;
            // 风铃上行（高频正弦，像八音盒快速跑动）
            const notes = [659.25, 783.99, 987.77, 1174.66, 1318.51]; // E5 G5 B5 D6 E6
            notes.forEach((f, i) => {
                const t = now + i * 0.06;
                const osc = ctx.createOscillator();
                const g = ctx.createGain();
                osc.type = 'sine';
                osc.frequency.setValueAtTime(f, t);
                g.gain.setValueAtTime(0, t);
                g.gain.linearRampToValueAtTime(0.14, t + 0.01);
                g.gain.exponentialRampToValueAtTime(0.0001, t + 0.5);
                osc.connect(g).connect(ctx.destination);
                osc.start(t);
                osc.stop(t + 0.55);
            });
            // 收尾明亮"叮"（高频短衰减，清脆上头）
            const t2 = now + 0.34;
            const ding = ctx.createOscillator();
            const dg = ctx.createGain();
            ding.type = 'sine';
            ding.frequency.setValueAtTime(1567.98, t2); // G6
            dg.gain.setValueAtTime(0, t2);
            dg.gain.linearRampToValueAtTime(0.16, t2 + 0.005);
            dg.gain.exponentialRampToValueAtTime(0.0001, t2 + 0.6);
            ding.connect(dg).connect(ctx.destination);
            ding.start(t2);
            ding.stop(t2 + 0.65);
        } catch (e) { /* 忽略音频错误 */ }
    };

    // 未中奖音：柔和下行二音（更轻更低）
    const playLoseSound = () => {
        try {
            const ctx = getGameAudioCtx();
            const now = ctx.currentTime;
            const seq = [349.23, 261.63];   // F4 -> C4 柔和下行
            seq.forEach((f, i) => {
                const t = now + i * 0.14;
                const osc = ctx.createOscillator();
                const g = ctx.createGain();
                osc.type = 'sine';
                osc.frequency.setValueAtTime(f, t);
                g.gain.setValueAtTime(0, t);
                g.gain.linearRampToValueAtTime(0.08, t + 0.02);
                g.gain.exponentialRampToValueAtTime(0.0001, t + 0.32);
                osc.connect(g).connect(ctx.destination);
                osc.start(t);
                osc.stop(t + 0.34);
            });
        } catch (e) { /* 忽略 */ }
    };

    const showGameResult = (isWin, amount, icon, skipSound = false) => {
        const modal = document.getElementById('game-result-modal');
        const iconEl = document.getElementById('game-result-icon');
        const titleEl = document.getElementById('game-result-title');
        const amountEl = document.getElementById('game-result-amount');
        const closeBtn = document.getElementById('game-result-close');
        
        const dict = window.translations?.[window.currentLang] || {};
        
        modal.classList.remove('win', 'lose');
        modal.classList.add(isWin ? 'win' : 'lose');

        // 中奖/失败音效（WebAudio 合成，覆盖所有调用本弹窗的游戏）
        if (!skipSound) {
            if (isWin) playWinSound();
            else playLoseSound();
        }
        
        iconEl.textContent = icon || (isWin ? '🎉' : '😔');
        titleEl.textContent = isWin ? (dict.game_result_win_title || '恭喜中奖！') : (dict.game_result_lose_title || '未中奖');
        amountEl.style.display = isWin ? 'block' : 'none';
        if (isWin) {
            const target = Number(amount) || 0;
            amountEl.textContent = '¥0';   // 先归零，避免延迟期间显示旧占位符（如 ¥100）
            const dur = 800;
            // 延迟启动：等图标弹入 + 粒子炸开的高潮过后，金额再开始滚动揭晓
            setTimeout(() => {
                const t0 = performance.now();
                const easeOut = (t) => 1 - Math.pow(1 - t, 3);
                const step = (now) => {
                    const p = Math.min(1, (now - t0) / dur);
                    const v = Math.round(target * easeOut(p));
                    amountEl.textContent = `¥${v}`;
                    if (p < 1) requestAnimationFrame(step);
                    else amountEl.textContent = `¥${target}`;
                };
                requestAnimationFrame(step);
            }, 380);
        }

        // 中奖：狂暴粒子炸裂（海量星火从中心疯狂爆开铺满全屏，纯 CSS 过渡无库）
        if (isWin) {
            const colors = ['#00ff41', '#00f3ff', '#ffaa00', '#ffffff', '#39ffaf', '#7df9ff'];
            const N = 70;
            const maxR = Math.max(window.innerWidth, window.innerHeight) * 0.62;
            for (let i = 0; i < N; i++) {
                const p = document.createElement('div');
                p.className = 'win-particle ' + (i % 3 === 0 ? 'front' : 'back');
                const size = 7 + Math.random() * 13;
                const color = colors[Math.floor(Math.random() * colors.length)];
                p.style.width = p.style.height = size + 'px';
                p.style.background = color;
                p.style.boxShadow = '0 0 ' + (size + 6) + 'px ' + color + ', 0 0 ' + (size + 14) + 'px ' + color;
                const ang = Math.random() * Math.PI * 2;
                const dist = maxR * (0.35 + Math.random() * 0.65);
                const dx = Math.cos(ang) * dist;
                const dy = Math.sin(ang) * dist;
                const rot = (Math.random() * 720 - 360);
                const dur = 0.8 + Math.random() * 0.9;
                modal.appendChild(p);
                requestAnimationFrame(() => {
                    p.style.transition = `transform ${dur}s cubic-bezier(0.15,0.9,0.25,1), opacity ${dur}s ease`;
                    p.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px)) rotate(${rot}deg) scale(${0.1 + Math.random() * 0.3})`;
                    p.style.opacity = '0';
                });
                setTimeout(() => p.remove(), (dur + 0.2) * 1000);
            }
        }
        
        closeBtn.textContent = dict.game_result_close || '确定';
        
        modal.classList.add('show');
        // 中奖瞬间触发屏幕震动（仅中奖时）
        if (isWin) {
            modal.classList.add('shake');
            setTimeout(() => modal.classList.remove('shake'), 500);
        }

        const hideModal = () => {
            modal.classList.remove('show', 'shake');
            modal.querySelectorAll('.win-particle').forEach(el => el.remove());
        };

        closeBtn.onclick = hideModal;

        modal.onclick = (e) => {
            if (e.target === modal) hideModal();
        };
    };

    // 游戏历史记录功能 - 从后端获取
    let gameHistoryCache = {};

    const GAME_API = 'https://api.immmor.com';

    const fetchGameHistory = async (gameType) => {
        const userInfo = JSON.parse(localStorage.getItem('userInfo') || '{}');
        if (!userInfo.username) return [];
        try {
            const resp = await fetch(`${GAME_API}/api/game/history`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username: userInfo.username, gameType })
            });
            const data = await resp.json();
            if (data.success) {
                gameHistoryCache[gameType] = data.history;
                return data.history;
            }
        } catch (e) {
            console.error('获取游戏历史失败:', e);
        }
        return gameHistoryCache[gameType] || [];
    };

    const renderGameHistory = async (gameType) => {
        const containerMap = {
            'wheel': 'wheel-my-bets',
            'slot': 'slot-my-bets',
            'scratch': 'scratch-my-bets',
            'predict': 'predict-my-bets'
        };
        const listMap = {
            'wheel': 'wheel-bet-list',
            'slot': 'slot-bet-list',
            'scratch': 'scratch-bet-list',
            'predict': 'predict-bet-list'
        };
        const container = document.getElementById(containerMap[gameType]);
        const list = document.getElementById(listMap[gameType]);
        if (!container || !list) return;

        const history = await fetchGameHistory(gameType);
        if (history.length === 0) {
            container.classList.add('hidden');
            return;
        }

        container.classList.remove('hidden');
        const dict = window.translations?.[window.currentLang] || {};
        list.innerHTML = history.map(item => {
            // 预测未来：result 存的是 JSON，需解析为可读文本，与其他游戏保持同一渲染样式
            let resultText = item.result;
            if (gameType === 'predict') {
                try {
                    const parsed = JSON.parse(item.result || '{}');
                    const topicQ = typeof PredictModule?.getTopicQuestion === 'function'
                        ? PredictModule.getTopicQuestion(parsed.topic_id)
                        : '';
                    const _tr = (k) => (window.translations?.[window.currentLang]?.[k]) || k;
                    resultText = `${topicQ || (_tr('predict_topic') + '#' + (parsed.topic_id ?? '?'))} → ${parsed.option_name || _tr('predict_option')}`;
                } catch (e) {
                    resultText = item.result || ((window.translations?.[window.currentLang]?.['predict_record']) || '预测记录');
                }
            }
            const isGift = parseFloat(item.cost) === 0;
            const isWin = item.prize > item.cost;
            const net = item.prize - item.cost;
            const timeStr = item.created_at ? item.created_at.slice(0, 16).replace('T', ' ') : '--';
            return `
                <div class="bet-item ${isWin ? 'win' : 'lose'}">
                    <div>
                        <div class="text-zinc-300 font-mono">${resultText}</div>
                        <div class="text-zinc-500 text-[11px] mt-0.5 whitespace-nowrap">${timeStr}</div>
                    </div>
                    <div class="text-right">
                        <div class="font-mono ${isWin ? 'text-[var(--neon-green)]' : 'text-zinc-500'}">${(net >= 0 ? '+' : '')}${net}</div>
                        <div class="text-[10px] text-zinc-500">¥${item.cost}</div>
                    </div>
                </div>
            `;
        }).join('');
    };

    // 更新余额显示
    const updateBalanceDisplay = (balance) => {
        const balanceEl = document.getElementById('user-balance');
        if (balanceEl) {
            balanceEl.textContent = `¥${parseFloat(balance).toFixed(2)}`;
        }
        // 同步更新 localStorage
        const userInfo = JSON.parse(localStorage.getItem('userInfo') || '{}');
        if (userInfo.username) {
            userInfo.balance = balance;
            localStorage.setItem('userInfo', JSON.stringify(userInfo));
        }
    };

    const initGameCenter = () => {
        // 中奖信息轮播（纯前端模拟）
        initWinnerCarousel();

        // Tab切换功能
        const gameTabs = document.querySelectorAll('.game-tab');
        const gameContents = document.querySelectorAll('.game-tab-content');

        gameTabs.forEach(tab => {
            tab.addEventListener('click', () => {
                const tabId = tab.getAttribute('data-tab');
                gameTabs.forEach(t => t.classList.remove('game-tab-active'));
                tab.classList.add('game-tab-active');
                gameContents.forEach(content => content.classList.add('hidden'));
                const activeContent = document.getElementById(`tab-${tabId}`);
                if (activeContent) {
                    activeContent.classList.remove('hidden');
                    if (['wheel', 'slot', 'scratch'].includes(tabId)) {
                        renderGameHistory(tabId);
                    }
                    if (tabId === 'predict') {
                        PredictModule.loadTopics();
                    }
                    if (tabId === 'scratch') {
                        if (isPrizeAdded) {
                            hasValidCard = false;
                            isPrizeAdded = false;
                            scratchPrizeAmount = 0;
                        }
                        setTimeout(() => initScratchCard(), 100);
                    }
                }
            });
        });

        // ==================== 幸运转盘 ====================
        const WHEEL_PRIZES = [3, 5, 5, 10, 10, 20, 50, 200];
        const WHEEL_SEGMENT_STYLE = [
            { bg: '#24113b', text: '#ff99cc', icon: '💵' },
            { bg: '#17072b', text: '#a3ff00', icon: '🪙' },
            { bg: '#24113b', text: '#ffffff', icon: '🐟' },
            { bg: '#17072b', text: '#ff99cc', icon: '✨' },
            { bg: '#24113b', text: '#a3ff00', icon: '🎵' },
            { bg: '#17072b', text: '#ffffff', icon: '💎' },
            { bg: '#24113b', text: '#ff99cc', icon: '🎁' },
            { bg: '#17072b', text: '#a3ff00', icon: '👑' }
        ];

        const WHEEL_SEGMENT_LIGHT = [
            { bg: '#efeaf7', text: '#a1146b', icon: '💵' },
            { bg: '#fbf8fc', text: '#5d7a00', icon: '🪙' },
            { bg: '#efeaf7', text: '#2b2823', icon: '🐟' },
            { bg: '#fbf8fc', text: '#a1146b', icon: '✨' },
            { bg: '#efeaf7', text: '#5d7a00', icon: '🎵' },
            { bg: '#fbf8fc', text: '#2b2823', icon: '💎' },
            { bg: '#efeaf7', text: '#a1146b', icon: '🎁' },
            { bg: '#fbf8fc', text: '#5d7a00', icon: '👑' }
        ];

        const wheelCanvas = document.getElementById('wheelCanvas');
        const spinBtn = document.getElementById('spin-wheel');
        const wheelResult = document.getElementById('wheel-result');
        const wheelCtx = wheelCanvas ? wheelCanvas.getContext('2d') : null;
        let wheelRotation = 0;
        let isWheelSpinning = false;

        const normalizeDeg = (deg) => ((deg % 360) + 360) % 360;
        const getWheelStep = () => 360 / WHEEL_PRIZES.length;

        const drawWheel = () => {
            if (!wheelCtx) return;
            const radius = wheelCanvas.width / 2;
            const segRad = (2 * Math.PI) / WHEEL_PRIZES.length;
            const light = document.body.classList.contains('theme-light');
            const palette = light ? WHEEL_SEGMENT_LIGHT : WHEEL_SEGMENT_STYLE;
            wheelCtx.clearRect(0, 0, wheelCanvas.width, wheelCanvas.height);
            wheelCtx.save();
            wheelCtx.translate(radius, radius);
            wheelCtx.rotate(wheelRotation * Math.PI / 180);
            WHEEL_PRIZES.forEach((prize, i) => {
                const startAng = i * segRad - Math.PI / 2;
                const endAng = startAng + segRad;
                const style = palette[i];
                wheelCtx.beginPath();
                wheelCtx.moveTo(0, 0);
                wheelCtx.arc(0, 0, radius - 15, startAng, endAng);
                wheelCtx.closePath();
                wheelCtx.fillStyle = style.bg;
                wheelCtx.fill();
                wheelCtx.lineWidth = 3;
                wheelCtx.strokeStyle = 'rgba(157, 78, 221, 0.4)';
                wheelCtx.stroke();
                wheelCtx.save();
                wheelCtx.rotate(startAng + segRad / 2);
                wheelCtx.fillStyle = style.text;
                wheelCtx.font = "bold 40px 'PingFang SC', sans-serif";
                wheelCtx.shadowColor = style.text;
                wheelCtx.shadowBlur = 10;
                wheelCtx.fillText('¥' + prize, 160, 10);
                wheelCtx.font = "36px 'Apple Color Emoji'";
                wheelCtx.shadowBlur = 0;
                wheelCtx.fillText(style.icon, 310, 14);
                wheelCtx.restore();
            });
            wheelCtx.restore();
        };

        const wheelMarker = document.querySelector('.wheel-pointer-marker');
        let markerAnim = null;
        // 每格拨动一次指针：先偏移，再带阻尼回弹归位
        const flickMarker = () => {
            if (!wheelMarker) return;
            if (markerAnim) markerAnim.cancel();
            markerAnim = wheelMarker.animate([
                { transform: 'translateX(-50%) rotate(0deg)', offset: 0 },
                { transform: 'translateX(-50%) rotate(16deg)', offset: 0.2 },
                { transform: 'translateX(-50%) rotate(-8deg)', offset: 0.5 },
                { transform: 'translateX(-50%) rotate(3deg)', offset: 0.75 },
                { transform: 'translateX(-50%) rotate(0deg)', offset: 1 }
            ], { duration: 260, easing: 'ease-out' });
        };

        // 指针固定在 12 点，旋转到目标扇区；每跨一格触发一次咔哒音和拨动
        const spinWheelTo = (targetIndex, onDone) => {
            const step = getWheelStep();
            const segmentCenter = targetIndex * step + step / 2;
            const targetMod = normalizeDeg(360 - segmentCenter);
            const currentMod = normalizeDeg(wheelRotation);
            let delta = targetMod - currentMod;
            if (delta <= 0) delta += 360;
            const extraSpins = 6 + Math.floor(Math.random() * 4);
            const startRotation = wheelRotation;
            const endRotation = startRotation + delta + extraSpins * 360;
            const duration = 4800;
            const startTime = performance.now();
            let lastTick = 0;
            const animate = (now) => {
                const p = Math.min((now - startTime) / duration, 1);
                const ease = 1 - Math.pow(1 - p, 3);
                wheelRotation = startRotation + (endRotation - startRotation) * ease;
                drawWheel();
                const seg = Math.floor(normalizeDeg(wheelRotation) / step);
                if (seg !== lastTick) { wheelAudio.playTick(); flickMarker(); lastTick = seg; }
                if (p < 1) requestAnimationFrame(animate);
                else onDone();
            };
            requestAnimationFrame(animate);
        };

        drawWheel();
        document.addEventListener('themechange', () => {
            drawWheel();
            if (!hasValidCard) initScratchCard();
        });

        // 幸运转盘为默认激活 Tab，初始化时加载其历史记录
        renderGameHistory('wheel');

        spinBtn.addEventListener('click', async () => {
            if (isWheelSpinning) return;
            const userInfo = JSON.parse(localStorage.getItem('userInfo') || '{}');
            if (!userInfo.username) {
                const dict = window.translations?.[window.currentLang] || {};
                alert(dict.alert_login || '请先登录！');
                document.getElementById('auth-toggle').click();
                return;
            }

            const dict = window.translations?.[window.currentLang] || {};

            // 先尝试领取赠送
            try {
                const giftResp = await fetch(`${GAME_API}/api/game/claim-gift`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ username: userInfo.username, game_type: 'wheel' })
                });
                const giftData = await giftResp.json();
                if (giftData.success && giftData.gift) {
                    isWheelSpinning = true;
                    spinBtn.disabled = true;
                    wheelResult.textContent = '';
                    const targetIndex = WHEEL_PRIZES.indexOf(giftData.prize);
                    spinWheelTo(targetIndex, () => {
                        const isWin = giftData.prize > 0;
                        if (isWin) wheelAudio.playWin();
                        updateBalanceDisplay(giftData.balance);
                        renderGameHistory('wheel');
                        showGameResult(isWin, giftData.prize, '🎁', isWin);
                        if (window.pendingGift) { window.pendingGift.wheel = false; window.updateGameCostText && window.updateGameCostText('wheel'); }
                        isWheelSpinning = false;
                        spinBtn.disabled = false;
                    });
                    return;
                }
            } catch(e) {}

            if (!confirm(dict.alert_bet10 ||'本次游戏需要花费 ¥10，是否继续？')) return;

            // 先调用后端，获取实际结果
            try {
                const resp = await fetch(`${GAME_API}/api/game/wheel`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ username: userInfo.username })
                });
                const data = await resp.json();
                if (!data.success) {
                    alert(data.message || '操作失败');
                    return;
                }

                isWheelSpinning = true;
                spinBtn.disabled = true;
                wheelResult.textContent = '';

                // 根据后端返回的 prize 计算目标扇区
                const targetIndex = WHEEL_PRIZES.indexOf(data.prize);
                spinWheelTo(targetIndex, () => {
                    const isWin = data.prize > 0;
                    if (isWin) wheelAudio.playWin();
                    updateBalanceDisplay(data.balance);
                    renderGameHistory('wheel');
                    showGameResult(isWin, data.prize, '🎡', isWin);
                    isWheelSpinning = false;
                    spinBtn.disabled = false;
                });
            } catch (e) {
                console.error('转盘游戏失败:', e);
                alert('网络错误，请稍后重试');
            }
        });

        // ==================== 老虎机 ====================
        const slotBtn = document.getElementById('slot-spin');
        const slotResult = document.getElementById('slot-result');
        let isSlotSpinning = false;
        const symbols = ['🍒', '🍊', '🍋', '⭐', '💎', '7️⃣', '🔔'];
        // 后端符号顺序保持不变，仅替换展示图标为猫娘主题
        const displaySymbols = ['🐱', '💎', '👑', '🧦', '🐟', '🎀', '🍬'];
        const machineBody = document.getElementById('machine-body');
        const handle = document.getElementById('mechanical-handle');

        const initSlotReels = () => {
            const reel1 = document.getElementById('slot-reel-1');
            const reel2 = document.getElementById('slot-reel-2');
            const reel3 = document.getElementById('slot-reel-3');
            if (!reel1 || !reel2 || !reel3) return;
            const createReelContent = () => {
                let content = '';
                for (let i = 0; i < 3; i++) {
                    displaySymbols.forEach(symbol => {
                        content += `<div class="slot-symbol">${symbol}</div>`;
                    });
                }
                return content;
            };
            reel1.innerHTML = createReelContent();
            reel2.innerHTML = createReelContent();
            reel3.innerHTML = createReelContent();
        };

        // 拉杆反馈：音效 + 拉杆下压 + 机身轻晃
        const pullLever = () => {
            slotAudio.playLever();
            if (handle) { handle.classList.add('pulled'); setTimeout(() => handle.classList.remove('pulled'), 200); }
            if (machineBody) { machineBody.classList.add('machine-shake-light'); setTimeout(() => machineBody.classList.remove('machine-shake-light'), 500); }
        };
        // 中奖反馈：机身剧烈晃动 + 爆金币声 + 整组发光
        const celebrateWin = () => {
            if (machineBody) { machineBody.classList.add('machine-shake'); setTimeout(() => machineBody.classList.remove('machine-shake'), 1200); }
            slotAudio.playShakeSound(1.2);
            slotAudio.playCoinSound('max');
            const reels = document.querySelector('.slot-reels');
            if (reels) { reels.classList.add('win'); setTimeout(() => reels.classList.remove('win'), 1800); }
        };

        initSlotReels();

        slotBtn.addEventListener('click', async () => {
            if (isSlotSpinning) return;
            const userInfo = JSON.parse(localStorage.getItem('userInfo') || '{}');
            if (!userInfo.username) {
                const dict = window.translations?.[window.currentLang] || {};
                alert(dict.alert_login || '请先登录！');
                document.getElementById('auth-toggle').click();
                return;
            }

            const dict = window.translations?.[window.currentLang] || {};

            // 先尝试领取赠送
            try {
                const giftResp = await fetch(`${GAME_API}/api/game/claim-gift`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ username: userInfo.username, game_type: 'slot' })
                });
                const giftData = await giftResp.json();
                if (giftData.success && giftData.gift) {
                    isSlotSpinning = true;
                    slotBtn.disabled = true;
                    slotResult.textContent = '';
                    pullLever();
                    const reel1 = document.getElementById('slot-reel-1');
                    const reel2 = document.getElementById('slot-reel-2');
                    const reel3 = document.getElementById('slot-reel-3');
                    const symbolHeight = parseInt(getComputedStyle(document.querySelector('.slot-reel') || document.body).height, 10) || 120;
                    const stopIndex1 = symbols.indexOf(giftData.symbols[0]);
                    const stopIndex2 = symbols.indexOf(giftData.symbols[1]);
                    const stopIndex3 = symbols.indexOf(giftData.symbols[2]);
                    const totalSpin1 = (7 + stopIndex1) * symbolHeight;
                    const totalSpin2 = (14 + stopIndex2) * symbolHeight;
                    const totalSpin3 = (14 + stopIndex3) * symbolHeight;
                    reel1.style.transition = 'none'; reel2.style.transition = 'none'; reel3.style.transition = 'none';
                    reel1.style.transform = 'translateY(0)'; reel2.style.transform = 'translateY(0)'; reel3.style.transform = 'translateY(0)';
                    void reel1.offsetWidth; void reel2.offsetWidth; void reel3.offsetWidth;
                    const spinDuration1 = 2000, spinDuration2 = 2500, spinDuration3 = 3000;
                    startSlotSpinSound(reel3, symbolHeight, spinDuration3);
                    setTimeout(stopSlotSpinSound, spinDuration3);
                    setTimeout(() => slotAudio.playReelStop(0), spinDuration1);
                    setTimeout(() => slotAudio.playReelStop(1), spinDuration2);
                    setTimeout(() => slotAudio.playReelStop(2), spinDuration3);
                    reel1.style.transition = `transform ${spinDuration1}ms cubic-bezier(0.175, 0.885, 0.32, 1.275)`;
                    reel2.style.transition = `transform ${spinDuration2}ms cubic-bezier(0.175, 0.885, 0.32, 1.275)`;
                    reel3.style.transition = `transform ${spinDuration3}ms cubic-bezier(0.175, 0.885, 0.32, 1.275)`;
                    reel1.style.transform = `translateY(-${totalSpin1}px)`;
                    reel2.style.transform = `translateY(-${totalSpin2}px)`;
                    reel3.style.transform = `translateY(-${totalSpin3}px)`;
                    setTimeout(() => {
                        if (giftData.prize > 0) { celebrateWin(); showGameResult(true, giftData.prize, '🎁', true); }
                        else { showGameResult(false, 0, '🎁'); }
                        updateBalanceDisplay(giftData.balance);
                        renderGameHistory('slot');
                        if (window.pendingGift) { window.pendingGift.slot = false; window.updateGameCostText && window.updateGameCostText('slot'); }
                        isSlotSpinning = false;
                        slotBtn.disabled = false;
                    }, 3500);
                    return;
                }
            } catch(e) {}

            if (!confirm(dict.alert_bet20 ||'本次游戏需要花费 ¥20，是否继续？')) return;

            // 先调用后端获取结果
            try {
                const resp = await fetch(`${GAME_API}/api/game/slot`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ username: userInfo.username })
                });
                const data = await resp.json();
                if (!data.success) {
                    alert(data.message || '操作失败');
                    return;
                }

                isSlotSpinning = true;
                slotBtn.disabled = true;
                slotResult.textContent = '';
                pullLever();

                const reel1 = document.getElementById('slot-reel-1');
                const reel2 = document.getElementById('slot-reel-2');
                const reel3 = document.getElementById('slot-reel-3');

                const symbolHeight = parseInt(getComputedStyle(document.querySelector('.slot-reel') || document.body).height, 10) || 120;

                // 根据后端返回的 symbols 计算停止位置
                const stopIndex1 = symbols.indexOf(data.symbols[0]);
                const stopIndex2 = symbols.indexOf(data.symbols[1]);
                const stopIndex3 = symbols.indexOf(data.symbols[2]);

                const totalSpin1 = (7 + stopIndex1) * symbolHeight;
                const totalSpin2 = (14 + stopIndex2) * symbolHeight;
                const totalSpin3 = (14 + stopIndex3) * symbolHeight;

                reel1.style.transition = 'none';
                reel2.style.transition = 'none';
                reel3.style.transition = 'none';
                reel1.style.transform = 'translateY(0)';
                reel2.style.transform = 'translateY(0)';
                reel3.style.transform = 'translateY(0)';

                void reel1.offsetWidth;
                void reel2.offsetWidth;
                void reel3.offsetWidth;

                const spinDuration1 = 2000;
                const spinDuration2 = 2500;
                const spinDuration3 = 3000;

                startSlotSpinSound(reel3, symbolHeight, spinDuration3);
                setTimeout(stopSlotSpinSound, spinDuration3);
                setTimeout(() => slotAudio.playReelStop(0), spinDuration1);
                setTimeout(() => slotAudio.playReelStop(1), spinDuration2);
                setTimeout(() => slotAudio.playReelStop(2), spinDuration3);

                reel1.style.transition = `transform ${spinDuration1}ms cubic-bezier(0.175, 0.885, 0.32, 1.275)`;
                reel2.style.transition = `transform ${spinDuration2}ms cubic-bezier(0.175, 0.885, 0.32, 1.275)`;
                reel3.style.transition = `transform ${spinDuration3}ms cubic-bezier(0.175, 0.885, 0.32, 1.275)`;

                reel1.style.transform = `translateY(-${totalSpin1}px)`;
                reel2.style.transform = `translateY(-${totalSpin2}px)`;
                reel3.style.transform = `translateY(-${totalSpin3}px)`;

                setTimeout(() => {
                    if (data.prize > 0) {
                        celebrateWin();
                        showGameResult(true, data.prize, '🎰', true);
                    } else {
                        showGameResult(false, 0, '🎰');
                    }

                    updateBalanceDisplay(data.balance);
                    renderGameHistory('slot');

                    isSlotSpinning = false;
                    slotBtn.disabled = false;
                }, 3500);
            } catch (e) {
                console.error('老虎机游戏失败:', e);
                alert('网络错误，请稍后重试');
            }
        });

        // ==================== 刮刮乐 ====================
        let scratchCanvas = null;
        let scratchCtx = null;
        let scratchPrizeAmount = 0;
        let isPrizeAdded = false;
        let hasValidCard = false;
        let scratchIsDrawing = false;
        let scratchEventsInitialized = false;
        let scratchNoise = null;

        const ensureScratchNoise = () => {
            const ctx = getGameAudioCtx();
            if (scratchNoise) return scratchNoise;
            const sampleRate = ctx.sampleRate;
            const dur = 2;
            const buf = ctx.createBuffer(1, sampleRate * dur, sampleRate);
            const data = buf.getChannelData(0);
            let last = 0;
            for (let i = 0; i < data.length; i++) {
                const white = Math.random() * 2 - 1;
                last = (last + 0.02 * white) / 1.02;
                data[i] = (last * 3.5 + white * 0.6) * 0.35;
            }
            const src = ctx.createBufferSource();
            src.buffer = buf;
            src.loop = true;
            const hp = ctx.createBiquadFilter();
            hp.type = 'highpass';
            hp.frequency.value = 600;
            hp.Q.value = 0.5;
            const bp = ctx.createBiquadFilter();
            bp.type = 'bandpass';
            bp.frequency.value = 3200;
            bp.Q.value = 0.6;
            const gain = ctx.createGain();
            gain.gain.value = 0;
            src.connect(hp).connect(bp).connect(gain).connect(ctx.destination);
            src.start();
            scratchNoise = { src, bp, gain, stop: () => { try { src.stop(); } catch (e) {} gain.disconnect(); } };
            return scratchNoise;
        };

        const startScratchNoise = () => {
            try {
                const n = ensureScratchNoise();
                const now = n.gain.context.currentTime;
                n.gain.gain.cancelScheduledValues(now);
                n.gain.gain.setValueAtTime(0, now);
                n.gain.gain.linearRampToValueAtTime(0.22, now + 0.04);
                n.bp.frequency.cancelScheduledValues(now);
                n.bp.frequency.setValueAtTime(2200, now);
                n.bp.frequency.linearRampToValueAtTime(4200, now + 0.06);
            } catch (e) {}
        };

        const updateScratchNoiseByMove = (dx, dy) => {
            try {
                const n = ensureScratchNoise();
                const speed = Math.min(1, Math.sqrt(dx * dx + dy * dy) / 60);
                const vol = 0.08 + speed * 0.3;
                const freq = 2200 + speed * 3600;
                const now = n.gain.context.currentTime;
                n.gain.gain.setTargetAtTime(vol, now, 0.015);
                n.bp.frequency.setTargetAtTime(freq, now, 0.02);
            } catch (e) {}
        };

        const stopScratchNoise = () => {
            if (!scratchNoise) return;
            try {
                const n = scratchNoise;
                const now = n.gain.context.currentTime;
                n.gain.gain.cancelScheduledValues(now);
                n.gain.gain.setValueAtTime(Math.max(n.gain.gain.value, 0), now);
                n.gain.gain.linearRampToValueAtTime(0, now + 0.08);
            } catch (e) {}
        };

        const initScratchCard = () => {
            const canvas = document.getElementById('scratch-canvas');
            const card = document.getElementById('scratch-card');
            const scratchPrize = document.getElementById('scratch-prize');

            if (!canvas || !card) return;

            const rect = canvas.getBoundingClientRect();
            canvas.width = rect.width;
            canvas.height = rect.height;

            scratchCanvas = canvas;
            scratchCtx = canvas.getContext('2d');
            scratchCtx.textAlign = 'center';
            scratchCtx.textBaseline = 'middle';

            const dict = window.translations?.[window.currentLang] || {};
            if (!hasValidCard) {
                scratchPrize.textContent = '';
                const light = document.body.classList.contains('theme-light');
                scratchCtx.fillStyle = light ? '#f3f1ec' : 'rgba(17, 7, 36, 0.95)';
                scratchCtx.fillRect(0, 0, canvas.width, canvas.height);
                scratchCtx.fillStyle = light ? '#5f5c56' : '#ff99cc';
                scratchCtx.font = 'bold 16px "PingFang SC", sans-serif';
                scratchCtx.fillText(dict.scratch_buy_first || '请先购买刮刮卡', canvas.width / 2, canvas.height / 2);
                return;
            }

            const gradient = scratchCtx.createLinearGradient(0, 0, canvas.width, canvas.height);
            gradient.addColorStop(0, '#3a1c66');
            gradient.addColorStop(0.5, '#200b3b');
            gradient.addColorStop(1, '#ff1493');
            scratchCtx.fillStyle = gradient;
            scratchCtx.fillRect(0, 0, canvas.width, canvas.height);

            scratchCtx.strokeStyle = 'rgba(163, 255, 0, 0.15)';
            scratchCtx.lineWidth = 3;
            for (let i = 0; i < canvas.width; i += 40) {
                scratchCtx.beginPath();
                scratchCtx.moveTo(i, 0);
                scratchCtx.lineTo(i + 20, canvas.height);
                scratchCtx.stroke();
            }

            scratchCtx.fillStyle = '#ffffff';
            scratchCtx.font = 'bold 18px "PingFang SC", sans-serif';
            scratchCtx.fillText(dict.scratch_here || '👆 刮开此处', canvas.width / 2, canvas.height / 2);

            if (!scratchEventsInitialized) {
                initScratchEvents();
                scratchEventsInitialized = true;
            }
        };

        const initScratchEvents = () => {
            if (!scratchCanvas) return;

            const getClientXY = (e) => {
                if (e.touches && e.touches[0]) {
                    return { x: e.touches[0].clientX, y: e.touches[0].clientY };
                }
                return { x: e.clientX || 0, y: e.clientY || 0 };
            };

            const getPos = (e) => {
                const rect = scratchCanvas.getBoundingClientRect();
                const scaleX = scratchCanvas.width / rect.width;
                const scaleY = scratchCanvas.height / rect.height;
                const c = getClientXY(e);
                return {
                    x: (c.x - rect.left) * scaleX,
                    y: (c.y - rect.top) * scaleY,
                    cx: c.x,
                    cy: c.y
                };
            };

            let lastClient = null;
            let lastMoveTick = 0;
            const idleFadeTimer = { id: null };
            const scheduleIdleFade = () => {
                if (idleFadeTimer.id) clearTimeout(idleFadeTimer.id);
                idleFadeTimer.id = setTimeout(() => {
                    if (scratchIsDrawing) stopScratchNoise();
                }, 120);
            };

            const draw = (e) => {
                if (!scratchIsDrawing || !hasValidCard) return;
                const pos = getPos(e);
                scratchCtx.globalCompositeOperation = 'destination-out';
                scratchCtx.beginPath();
                scratchCtx.arc(pos.x, pos.y, 25, 0, Math.PI * 2);
                scratchCtx.fill();

                const now = performance.now();
                if (lastClient != null && now - lastMoveTick > 10) {
                    const dx = pos.cx - lastClient.x;
                    const dy = pos.cy - lastClient.y;
                    if (Math.abs(dx) + Math.abs(dy) > 0.4) {
                        updateScratchNoiseByMove(dx, dy);
                        scheduleIdleFade();
                        lastClient = { x: pos.cx, y: pos.cy };
                        lastMoveTick = now;
                    }
                } else if (lastClient == null) {
                    lastClient = { x: pos.cx, y: pos.cy };
                }

                checkScratchProgress();
            };

            const onDown = (e) => {
                if (!hasValidCard) return;
                scratchIsDrawing = true;
                ensureScratchNoise();
                startScratchNoise();
                lastClient = null;
                lastMoveTick = 0;
                draw(e);
            };
            const onUp = () => {
                scratchIsDrawing = false;
                stopScratchNoise();
                lastClient = null;
                if (idleFadeTimer.id) clearTimeout(idleFadeTimer.id);
            };

            scratchCanvas.addEventListener('mousedown', onDown);
            scratchCanvas.addEventListener('mousemove', draw);
            scratchCanvas.addEventListener('mouseup', onUp);
            scratchCanvas.addEventListener('mouseleave', onUp);

            scratchCanvas.addEventListener('touchstart', (e) => { onDown(e); try { e.preventDefault(); } catch (_) {} }, { passive: false });
            scratchCanvas.addEventListener('touchmove', (e) => { draw(e); try { e.preventDefault(); } catch (_) {} }, { passive: false });
            scratchCanvas.addEventListener('touchend', onUp);
            scratchCanvas.addEventListener('touchcancel', onUp);
        };

        const checkScratchProgress = () => {
            if (isPrizeAdded || !scratchCanvas || !scratchCtx || !hasValidCard) return;

            const imageData = scratchCtx.getImageData(0, 0, scratchCanvas.width, scratchCanvas.height);
            const pixels = imageData.data;
            let transparentPixels = 0;
            const totalPixels = pixels.length / 4;

            for (let i = 3; i < pixels.length; i += 4) {
                if (pixels[i] === 0) transparentPixels++;
            }

            const progress = transparentPixels / totalPixels;
            if (progress > 0.5) {
                addScratchPrize();
            }
        };

        const addScratchPrize = () => {
            if (isPrizeAdded || !hasValidCard) return;
            isPrizeAdded = true;

            updateBalanceDisplay(parseFloat(JSON.parse(localStorage.getItem('userInfo') || '{}').balance || 0) + scratchPrizeAmount);
            renderGameHistory('scratch');
            showGameResult(true, scratchPrizeAmount, '🎁');
            if (window.pendingGift) { window.pendingGift.scratch = false; window.updateGameCostText && window.updateGameCostText('scratch'); }
        };

        const newScratchBtn = document.getElementById('new-scratch');
        const scratchResult = document.getElementById('scratch-result');
        const scratchPrize = document.getElementById('scratch-prize');

        newScratchBtn.addEventListener('click', async () => {
            const userInfo = JSON.parse(localStorage.getItem('userInfo') || '{}');
            if (!userInfo.username) {
                const dict = window.translations?.[window.currentLang] || {};
                alert(dict.alert_login || '请先登录！');
                document.getElementById('auth-toggle').click();
                return;
            }

            const dict = window.translations?.[window.currentLang] || {};

            // 先尝试领取赠送
            try {
                const giftResp = await fetch(`${GAME_API}/api/game/claim-gift`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ username: userInfo.username, game_type: 'scratch' })
                });
                const giftData = await giftResp.json();
                if (giftData.success && giftData.gift) {
                    updateBalanceDisplay(giftData.balance);
                    hasValidCard = true;
                    scratchPrizeAmount = giftData.prize;
                    scratchPrize.textContent = (dict.scratch_win || '🎁 恭喜获得') + ` ¥${giftData.prize}`;
                    scratchResult.textContent = '';
                    isPrizeAdded = false;
                    initScratchCard();
                    return;
                }
            } catch(e) {}

            if (!confirm(dict.alert_bet15 ||'本次游戏需要花费 ¥15，是否继续？')) return;

            // 先调用后端购买刮刮卡
            try {
                const resp = await fetch(`${GAME_API}/api/game/scratch`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ username: userInfo.username })
                });
                const data = await resp.json();
                if (!data.success) {
                    alert(data.message || '操作失败');
                    return;
                }

                updateBalanceDisplay(data.balance);

                hasValidCard = true;
                scratchPrizeAmount = data.prize;
                const dict = window.translations?.[window.currentLang] || {};
                scratchPrize.textContent = (dict.scratch_win || '🎁 恭喜获得') + ` ¥${data.prize}`;
                scratchResult.textContent = '';
                isPrizeAdded = false;

                initScratchCard();
            } catch (e) {
                console.error('刮刮乐购买失败:', e);
                alert('网络错误，请稍后重试');
            }
        });

        // 检查登录状态
        const checkLogin = () => {
            const userInfo = JSON.parse(localStorage.getItem('userInfo') || 'null');
            if (!userInfo) {
                const dict = window.translations?.[window.currentLang] || {};
                alert(dict.alert_login || '请先登录！');
                document.getElementById('auth-toggle').click();
                return false;
            }
            return true;
        };

        // 初始化游戏按钮状态
        const updateGameButtons = () => {
            const userInfo = JSON.parse(localStorage.getItem('userInfo') || 'null');
            const hasUser = userInfo !== null;
            const buttons = [spinBtn, slotBtn, newScratchBtn];
            buttons.forEach(btn => {
                if (btn) btn.disabled = !hasUser;
            });
        };

        updateGameButtons();
        setTimeout(() => initScratchCard(), 100);

        document.addEventListener('userLoggedIn', updateGameButtons);
        document.addEventListener('userLoggedOut', () => {
            updateGameButtons();
        });

        document.addEventListener('languageChanged', () => {
            initScratchCard();
        });

        // 暴露给外部（登录 / 登出时主动刷新幸运转盘数据）
        window.GameCenterModule = { renderGameHistory, updateBalanceDisplay };
    };

    // ===== 中奖 & 提现消息轮播（纯前端模拟） =====
    const initWinnerCarousel = () => {
        const tabsEl = document.querySelector('.game-tabs');
        if (!tabsEl || document.getElementById('winner-carousel')) return;

        // 注入样式（跑马灯 + 玻璃拟态卡片）
        if (!document.getElementById('winner-carousel-style')) {
            const style = document.createElement('style');
            style.id = 'winner-carousel-style';
            style.textContent = `
                .winner-carousel {
                    position: relative;
                    display: flex;
                    align-items: center;
                    gap: 0.75rem;
                    overflow: hidden;
                    border-radius: 0.9rem;
                    margin-bottom: 1.5rem;
                    padding: 0.3rem 0.9rem;
                    background: linear-gradient(135deg, rgba(20,24,40,0.85), rgba(30,20,48,0.85));
                    border: 1px solid rgba(0,243,255,0.35);
                    box-shadow: 0 0 18px rgba(0,243,255,0.18), inset 0 0 12px rgba(0,255,65,0.08);
                    backdrop-filter: blur(6px);
                }
                .winner-carousel-label {
                    flex-shrink: 0;
                    width: 2.4rem;
                    height: 2.4rem;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-weight: 800;
                    font-size: 1.1rem;
                    border-radius: 0.5rem;
                    color: #1a1206;
                    background: linear-gradient(90deg, #00f3ff, #00e676);
                    box-shadow: 0 0 10px rgba(0,243,255,0.55);
                    white-space: nowrap;
                }
                .winner-carousel-view {
                    position: relative;
                    flex: 1;
                    overflow: hidden;
                }
                .winner-carousel-track {
                    display: flex;
                    width: max-content;
                    gap: 1.2rem;
                    animation: winnerMarquee 45s linear infinite;
                }
                .winner-carousel:hover .winner-carousel-track {
                    animation-play-state: paused;
                }
                @keyframes winnerMarquee {
                    0%   { transform: translateX(0); }
                    100% { transform: translateX(-50%); }
                }
                .winner-slide {
                    display: flex;
                    align-items: center;
                    gap: 0.45rem;
                    padding: 0.3rem 0.8rem;
                    border-radius: 0.6rem;
                    white-space: nowrap;
                    font-size: 0.88rem;
                }
                .winner-slide .winner-icon {
                    font-size: 1rem;
                    animation: winnerBlink 1.4s ease-in-out infinite;
                }
                @keyframes winnerBlink {
                    0%, 100% { opacity: 1; }
                    50% { opacity: 0.4; }
                }
                .winner-slide .winner-name {
                    font-weight: 700;
                    color: #00e6ff;
                    font-family: ui-monospace, monospace;
                }
                .winner-slide .winner-game {
                    color: #7fd8ff;
                }
                .winner-slide .winner-amount {
                    font-weight: 800;
                    color: #ffe25a;
                    font-family: ui-monospace, monospace;
                    text-shadow: 0 0 8px rgba(255,210,60,0.5);
                }
                .winner-slide .winner-amount::before {
                    content: '💰 ';
                }
                .winner-slide .withdraw-amount {
                    font-weight: 800;
                    color: #ff9100;
                    font-family: ui-monospace, monospace;
                    text-shadow: 0 0 8px rgba(255,160,40,0.5);
                }
                .winner-slide .withdraw-amount::before {
                    content: '💰 ';
                }
                .winner-slide .withdraw-label {
                    color: #00e676;
                    font-weight: 700;
                }
            `;
            document.head.appendChild(style);
        }

        // 模拟数据 — 混合中奖 + 提现
        const tr = (k) => (window.translations && window.translations[currentLang] && window.translations[currentLang][k]) || k;
        const mailPrefix = ['a', 'b', 'c', 'm', 'x', 'k', 't', 'z'];
        const qqMailPrefix = ['2386', '1234', '5688', '8899', '3366', '2023', '1122', '5566'];
        const otherMailDomains = ['163.com', 'gmail.com', 'outlook.com', 'foxmail.com'];
        const gameKeys = ['game_wheel', 'game_slot', 'game_scratch'];
        const winPrizes = [5, 10, 20, 50, 100];
        const withdrawAmounts = [50, 100, 200, 500];
        const methods = ['微信', '支付宝', 'USDT', 'BTC'];
        const buildName = () => {
            const d = Math.random() < 0.5 ? 'qq.com' : otherMailDomains[Math.floor(Math.random() * otherMailDomains.length)];
            const pool = d === 'qq.com' ? qqMailPrefix : mailPrefix;
            const p = pool[Math.floor(Math.random() * pool.length)];
            return p + '***@' + d;
        };
        const mockItems = [];
        for (let i = 0; i < 5; i++) {
            const name1 = buildName();
            const gameKey = gameKeys[Math.floor(Math.random() * gameKeys.length)];
            const amount1 = winPrizes[Math.floor(Math.random() * winPrizes.length)];
            mockItems.push({ type: 'win', name: name1, gameKey, game: tr(gameKey), amount: amount1 });

            const name2 = buildName();
            const amount2 = withdrawAmounts[Math.floor(Math.random() * withdrawAmounts.length)];
            const method = methods[Math.floor(Math.random() * methods.length)];
            mockItems.push({ type: 'withdraw', name: name2, amount: amount2, method });
        }
        // 打乱顺序，避免中奖/提现严格交替显得太规律
        for (let i = mockItems.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [mockItems[i], mockItems[j]] = [mockItems[j], mockItems[i]];
        }

        const buildSlide = (w) => {
            const slide = document.createElement('div');
            slide.className = 'winner-slide';
            if (w.type === 'win') {
                slide.innerHTML =
                    '<span class="winner-icon">🎉</span>' +
                    '<span class="winner-name">' + w.name + '</span>' +
                    '<span data-i18n="winner_at">' + tr('winner_at') + '</span>' +
                    '<span class="winner-game" data-i18n="' + w.gameKey + '">' + w.game + '</span>' +
                    '<span data-i18n="winner_won">' + tr('winner_won') + '</span>' +
                    '<span class="winner-amount">' + w.amount + '</span>';
            } else {
                slide.innerHTML =
                    '<span class="winner-icon">💸</span>' +
                    '<span class="winner-name">' + w.name + '</span>' +
                    '<span class="withdraw-label" data-i18n="withdraw_title">' + tr('withdraw_title') + '</span>' +
                    '<span class="withdraw-amount">' + w.amount + '</span>';
            }
            return slide;
        };

        // 创建 DOM（放在 Tab 上方）
        const carousel = document.createElement('div');
        carousel.className = 'winner-carousel';
        carousel.id = 'winner-carousel';
        const view = document.createElement('div');
        view.className = 'winner-carousel-view';
        const track = document.createElement('div');
        track.className = 'winner-carousel-track';
        // 复制一份数据实现无缝循环
        [...mockItems, ...mockItems].forEach(w => track.appendChild(buildSlide(w)));
        view.appendChild(track);
        carousel.appendChild(view);
        tabsEl.insertAdjacentElement('beforebegin', carousel);
    };
    // ===== 预测未来 — 无庄家彩池模式 =====
    const PredictModule = (() => {
        const API_BASE = 'https://api.immmor.com';
        const t = (k) => (window.translations?.[window.currentLang]?.[k]) || k;
        let allTopics = [];
        let myPredictBets = {}; // { topicId: { optionIndex, amount } } 本地追踪

        const $ = (id) => document.getElementById(id);

        function getUserInfo() {
            try { return JSON.parse(localStorage.getItem('userInfo') || 'null'); } catch (e) { return null; }
        }

        function formatMoney(v) {
            if (v == null) return '¥0';
            return '¥' + Number(v).toFixed(2);
        }

        function parseTime(isoStr) {
            if (!isoStr) return null;
            // 兼容两种格式：
            //  - 带时区/偏移：2026-08-29T10:07:00.000Z 或 2026-08-15T23:59:00+08:00（new Date 直接解析）
            //  - 无时区：2026-08-15T23:59:00（视为本地时间，补 T 解析）
            let d;
            if (/z$|[+\-]\d{2}:?\d{2}$/i.test(isoStr)) {
                d = new Date(isoStr);
            } else {
                const s = isoStr.replace(' ', 'T');
                d = new Date(s);
                if (isNaN(d.getTime())) d = new Date(s + 'Z');
            }
            return isNaN(d.getTime()) ? null : d;
        }

        function toLocalTime(isoStr) {
            const d = parseTime(isoStr);
            if (!d) return isoStr || '';
            try {
                return d.toLocaleString([], { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
            } catch (e) { return isoStr; }
        }

        function getRemaining(isoStr) {
            const d = parseTime(isoStr);
            if (!d) return '';
            const diff = d - new Date();
            if (diff <= 0) return t('predict_ended');
            const dh = Math.floor(diff / 3600000);
            const dm = Math.floor((diff % 3600000) / 60000);
            if (dh >= 24) return `${Math.floor(dh / 24)}${t('predict_days')}${dh % 24}h`;
            if (dh > 0) return `${dh}h${dm}m`;
            return `${dm}${t('predict_minutes')}`;
        }

        function isExpired(isoStr) {
            const d = parseTime(isoStr);
            return !!(d && d <= new Date());
        }

        function getColor(idx) {
            const colors = ['#00f3ff', '#ea00ff', '#ff5e00', '#00ff41', '#ffe600', '#ff3b3b'];
            return colors[idx % colors.length];
        }

        function generateTopics() {
            // 兜底数据，正常情况由后端返回
            return [];
        }

        async function loadTopics() {
            if (!$('predict-topics')) return;
            try {
                const res = await fetch(`${API_BASE}/api/predict/list`);
                const data = await res.json();
                if (data.success && data.topics) {
                    // 统一数据格式
                    allTopics = data.topics.map(t => ({
                        ...t,
                        question: t.question || t.title,
                        options: t.options || [],
                        pools: t.pools || t.options.map(() => 0),
                        pool: Array.isArray(t.pools) ? t.pools.reduce((a, b) => a + b, 0) : Number(t.pool) || 0,
                        bettors: t.bettors || t.options.map(() => 0),
                        winner: t.winner == null || Number(t.winner) < 0 ? null : t.winner
                    }));
                    // 排序：可投注(active且未过期) → 已结束未结算 → 已结算；同组按截止时间从近到远
                    allTopics.sort((a, b) => {
                        const rankOf = (tp) => {
                            const isActive = tp.status === 'active';
                            const expired = isActive && isExpired(tp.end_time);
                            if (isActive && !expired) return 0;
                            if (isActive && expired) return 1;
                            return 2;
                        };
                        const ra = rankOf(a), rb = rankOf(b);
                        if (ra !== rb) return ra - rb;
                        const ta = parseTime(a.end_time)?.getTime() || 0;
                        const tb = parseTime(b.end_time)?.getTime() || 0;
                        return ra === 2 ? tb - ta : ta - tb;
                    });
                    console.log('预测话题已从后端加载:', allTopics.length, '个');
                } else {
                    allTopics = [];
                }
            } catch (e) {
                console.warn('加载预测话题失败', e);
                allTopics = [];
            }
            renderTopics();
            loadMyBets();
        }

        function renderTopics() {
            const container = $('predict-topics');
            if (!container) return;
            if (!allTopics.length) {
                container.innerHTML = '<p class="text-xs text-center text-zinc-500 py-8">' + t('predict_no_topics') + '</p>';
                return;
            }
            container.innerHTML = allTopics.map((tp) => {
                const active = tp.status === 'active';
                const expired = active && isExpired(tp.end_time);
                const displayStatus = !active ? 'resolved' : expired ? 'ended' : 'active';
                const totalPool = tp.pool || (tp.pools ? tp.pools.reduce((a, b) => a + b, 0) : 0) || 0;

                const barHTML = tp.options.map((_, i) => {
                    const amt = (tp.pools && tp.pools[i]) || 0;
                    const pct = totalPool > 0 ? (amt / totalPool * 100) : (1 / tp.options.length * 100);
                    const isWinner = !active && tp.winner === i;
                    const odds = amt > 0 ? (totalPool / amt).toFixed(2) : '--';
                    return { pct, isWinner, odds, color: getColor(i) };
                });

                const myBet = myPredictBets[tp.id];
                const optionsHTML = tp.options.map((opt, i) => {
                    const b = barHTML[i];
                    let cls = 'predict-opt-btn';
                    if (myBet && myBet.optionIndex === i) cls += ' selected';
                    if (b.isWinner) cls += ' resolved-winner';
                    return `
                        <button class="${cls}" data-topic="${tp.id}" data-opt="${i}" ${!active ? 'disabled' : ''}>
                            <span class="text-xs flex items-center gap-2">
                                <span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${b.color};flex-shrink:0;"></span>
                                ${b.isWinner ? '🏆 ' : ''}${opt}
                            </span>
                            <span class="text-[10px] font-mono" style="color:#999;">
                                ${t('predict_odds')} ${b.odds} | ${Number(b.pct).toFixed(1)}%
                            </span>
                        </button>`;
                }).join('');

                const barSegments = barHTML.map(b =>
                    `<div class="predict-pool-segment" style="width:${b.pct}%;background:${b.color};${b.isWinner ? 'box-shadow:0 0 8px var(--neon-green);' : ''}"></div>`
                ).join('');

                return `
                    <div class="predict-topic-card ${!active ? 'resolved' : ''}">
                        <div class="flex justify-between items-start mb-1">
                            <p class="text-xs font-bold leading-relaxed flex-1 mr-2">${tp.question}</p>
                            <div class="flex items-center gap-2 shrink-0">
                                <span class="predict-badge ${displayStatus}">${
                                    displayStatus === 'active' ? t('predict_ongoing') :
                                    displayStatus === 'resolved' ? t('predict_settled') : t('predict_closed')
                                }</span>
                            </div>
                        </div>
                        <div class="flex items-center justify-between mb-2">
                            <span class="predict-time">${displayStatus === 'active' ? t('predict_deadline') + ' ' + toLocalTime(tp.end_time) + ' (' + getRemaining(tp.end_time) + ')' : t('predict_ended')}</span>
                            <span class="predict-pool-amount">${formatMoney(totalPool)}</span>
                        </div>
                        <div class="predict-pool-bar">${barSegments}</div>
                        <div class="grid gap-1 mt-2" style="display:flex; flex-direction:column; gap:6px;">${optionsHTML}</div>
                        ${tp.winner !== null && tp.winner !== undefined ? `<p class="text-[10px] mt-2" style="color:var(--neon-green);">${t('predict_result')} ${tp.options[tp.winner]}</p>` : ''}
                    </div>`;
            }).join('');

            container.querySelectorAll('.predict-opt-btn').forEach(btn => {
                btn.addEventListener('click', () => {
                    placeBet(parseInt(btn.dataset.topic), parseInt(btn.dataset.opt));
                });
            });
        }

        async function placeBet(topicId, optIndex) {
            const user = getUserInfo();
            if (!user?.username) {
                alert(t('alert_login'));
                document.getElementById('auth-toggle')?.click();
                return;
            }
            const topic = allTopics.find(tp2 => String(tp2.id) === String(topicId));
            if (!topic || topic.status !== 'active') return;
            const optName = topic.options[optIndex];
            const MIN_BET = 10;
            let amount;
            while (true) {
                const raw = prompt(t('predict_enter_amount').replace('{question}', topic.question).replace('{option}', optName).replace('{min}', MIN_BET), String(MIN_BET));
                if (raw == null) return;
                if (!raw || isNaN(Number(raw))) continue;
                const v = parseFloat(Number(raw).toFixed(2));
                if (v < MIN_BET) { alert(t('predict_min_bet').replace('{min}', MIN_BET)); continue; }
                amount = v;
                break;
            }
            const betAmount = amount;

            try {
                const res = await fetch(`${API_BASE}/api/predict/bet`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ username: user.username, topicId, optionIndex: optIndex, optionName: optName, amount: betAmount })
                });
                const data = await res.json();
                if (data.success) {
                    myPredictBets[topicId] = { optionIndex: optIndex, amount: betAmount };
                    if (typeof updateBalanceDisplay === 'function') updateBalanceDisplay(data.balance);
                    await loadTopics();
                    renderTopics();
                    loadMyBets();
                } else {
                    alert(data.message || t('predict_bet_failed'));
                }
            } catch (e) {
                console.warn('投注API失败', e);
                alert(t('predict_network_error'));
            }
        }

        async function loadMyBets() {
            // 直接复用统一的 renderGameHistory，使预测记录样式与转盘/老虎机/刮刮乐完全一致
            try {
                await GameCenterModule.renderGameHistory('predict');
            } catch (e) {
                const container = $('predict-my-bets');
                if (container) container.classList.add('hidden');
            }
        }

        function getTopicQuestion(id) {
            const t = allTopics.find(x => String(x.id) === String(id));
            return t?.question || '';
        }

        return { loadTopics, loadMyBets, getTopicQuestion };
    })();

})();
