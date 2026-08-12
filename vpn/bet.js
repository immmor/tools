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
                playGameTone(550 + Math.random() * 250, 0.04, 'square', 0.05);
                slotLastTickIndex = idx;
            }
            slotSoundRaf = requestAnimationFrame(loop);
        };
        slotSoundRaf = requestAnimationFrame(loop);
    };
    const playSlotReelStop = () => {
        playGameTone(180, 0.12, 'triangle', 0.1);
        setTimeout(() => playGameTone(120, 0.08, 'triangle', 0.07), 40);
    };
    const playSlotWinSound = () => {
        [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => playGameTone(f, 0.18, 'sine', 0.09), i * 100));
    };

    const getElementRotation = (el) => {
        const m = getComputedStyle(el).transform;
        if (!m || m === 'none') return 0;
        const p = m.match(/matrix\(([^)]+)\)/);
        if (!p) return 0;
        const v = p[1].split(',').map(parseFloat);
        return Math.atan2(v[1], v[0]) * (180 / Math.PI);
    };

    let wheelSoundRaf = null;
    let wheelTickCount = 0;

    const stopWheelSpinSound = () => {
        if (wheelSoundRaf) { cancelAnimationFrame(wheelSoundRaf); wheelSoundRaf = null; }
        wheelTickCount = 0;
    };

    const startWheelSpinSound = (wheelEl, duration, stepDeg) => {
        stopWheelSpinSound();
        let prevAngle = null;
        let cumulative = 0;
        const start = performance.now();
        const loop = (now) => {
            if (now - start > duration + 80) return;
            const angle = getElementRotation(wheelEl);
            if (prevAngle !== null) {
                let delta = angle - prevAngle;
                if (delta > 180) delta -= 360;
                if (delta < -180) delta += 360;
                cumulative += Math.abs(delta);
                const count = Math.floor(cumulative / stepDeg);
                while (wheelTickCount < count) {
                    playGameTone(420 + Math.random() * 180, 0.035, 'square', 0.04);
                    wheelTickCount++;
                }
            }
            prevAngle = angle;
            wheelSoundRaf = requestAnimationFrame(loop);
        };
        wheelSoundRaf = requestAnimationFrame(loop);
    };

    const playWheelStopSound = () => {
        playGameTone(160, 0.14, 'triangle', 0.1);
        setTimeout(() => playGameTone(90, 0.1, 'triangle', 0.07), 45);
    };

    const showGameResult = (isWin, amount, icon) => {
        const modal = document.getElementById('game-result-modal');
        const iconEl = document.getElementById('game-result-icon');
        const titleEl = document.getElementById('game-result-title');
        const amountEl = document.getElementById('game-result-amount');
        const closeBtn = document.getElementById('game-result-close');
        
        const dict = window.translations?.[window.currentLang] || {};
        
        modal.classList.remove('win', 'lose');
        modal.classList.add(isWin ? 'win' : 'lose');
        
        iconEl.textContent = icon || (isWin ? '🎉' : '😔');
        titleEl.textContent = isWin ? (dict.game_result_win_title || '恭喜中奖！') : (dict.game_result_lose_title || '未中奖');
        amountEl.textContent = isWin ? `¥${amount}` : '';
        amountEl.style.display = isWin ? 'block' : 'none';
        
        closeBtn.textContent = dict.game_result_close || '确定';
        
        modal.classList.add('show');
        
        closeBtn.onclick = () => {
            modal.classList.remove('show');
        };
        
        modal.onclick = (e) => {
            if (e.target === modal) {
                modal.classList.remove('show');
            }
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
                    resultText = `${topicQ || ('话题#' + (parsed.topic_id ?? '?'))} → ${parsed.option_name || '选项'}`;
                } catch (e) {
                    resultText = item.result || '预测记录';
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
        const WHEEL_COLORS = [
            '#448aff', '#00d4ff', '#00e676', '#b388ff',
            '#ffd600', '#ff9100', '#ff4081', '#ff5252'
        ];

        const wheelFace = document.getElementById('wheel-face');
        const spinBtn = document.getElementById('spin-wheel');
        const wheelResult = document.getElementById('wheel-result');
        let wheelRotation = 0;
        let isWheelSpinning = false;

        const normalizeDeg = (deg) => ((deg % 360) + 360) % 360;
        const getWheelStep = () => 360 / WHEEL_PRIZES.length;

        const getIndexAtPointer = (rotation) => {
            const step = getWheelStep();
            const mod = normalizeDeg(rotation);
            const centerAtTop = normalizeDeg(360 - mod);
            return Math.floor(centerAtTop / step) % WHEEL_PRIZES.length;
        };

        const initWheel = () => {
            if (!wheelFace) return;
            const step = getWheelStep();
            const gradientStops = WHEEL_PRIZES.map((_, i) =>
                `${WHEEL_COLORS[i]} ${i * step}deg ${(i + 1) * step}deg`
            ).join(', ');
            wheelFace.style.background = `conic-gradient(from -90deg, ${gradientStops})`;
            wheelFace.innerHTML = WHEEL_PRIZES.map((prize, i) => {
                const angle = i * step + step / 2;
                return `<span class="wheel-label" style="--angle:${angle}deg;color:#fff">¥${prize}</span>`;
            }).join('');
        };

        initWheel();

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
                    const step = getWheelStep();
                    const segmentCenter = targetIndex * step + step / 2;
                    const targetMod = normalizeDeg(360 - segmentCenter);
                    const currentMod = normalizeDeg(wheelRotation);
                    let delta = targetMod - currentMod;
                    if (delta <= 0) delta += 360;
                    const extraSpins = 4 + Math.floor(Math.random() * 2);
                    wheelRotation += delta + extraSpins * 360;
                    const WHEEL_SPIN_MS = 4000;
                    playGameTone(280, 0.06, 'sine', 0.05);
                    startWheelSpinSound(wheelFace, WHEEL_SPIN_MS, step);
                    wheelFace.style.transition = `transform ${WHEEL_SPIN_MS}ms cubic-bezier(0.17, 0.67, 0.12, 0.99)`;
                    wheelFace.style.transform = `rotate(${wheelRotation}deg)`;
                    setTimeout(() => {
                        playWheelStopSound();
                        stopWheelSpinSound();
                        playSlotWinSound();
                        updateBalanceDisplay(giftData.balance);
                        renderGameHistory('wheel');
                        showGameResult(giftData.prize > 0, giftData.prize, '🎁');
                        if (window.pendingGift) { window.pendingGift.wheel = false; window.updateGameCostText && window.updateGameCostText('wheel'); }
                        isWheelSpinning = false;
                        spinBtn.disabled = false;
                    }, WHEEL_SPIN_MS);
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
                const step = getWheelStep();
                const segmentCenter = targetIndex * step + step / 2;
                const targetMod = normalizeDeg(360 - segmentCenter);
                const currentMod = normalizeDeg(wheelRotation);
                let delta = targetMod - currentMod;
                if (delta <= 0) delta += 360;
                const extraSpins = 4 + Math.floor(Math.random() * 2);
                wheelRotation += delta + extraSpins * 360;

                const WHEEL_SPIN_MS = 4000;
                playGameTone(280, 0.06, 'sine', 0.05);
                startWheelSpinSound(wheelFace, WHEEL_SPIN_MS, step);
                wheelFace.style.transition = `transform ${WHEEL_SPIN_MS}ms cubic-bezier(0.17, 0.67, 0.12, 0.99)`;
                wheelFace.style.transform = `rotate(${wheelRotation}deg)`;

                setTimeout(() => {
                    playWheelStopSound();
                    stopWheelSpinSound();
                    playSlotWinSound();

                    updateBalanceDisplay(data.balance);
                    renderGameHistory('wheel');
                    showGameResult(data.prize > 0, data.prize, '🎡');

                    isWheelSpinning = false;
                    spinBtn.disabled = false;
                }, WHEEL_SPIN_MS + 100);
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

        const initSlotReels = () => {
            const reel1 = document.getElementById('slot-reel-1');
            const reel2 = document.getElementById('slot-reel-2');
            const reel3 = document.getElementById('slot-reel-3');
            if (!reel1 || !reel2 || !reel3) return;
            const createReelContent = () => {
                let content = '';
                for (let i = 0; i < 3; i++) {
                    symbols.forEach(symbol => {
                        content += `<div class="slot-symbol">${symbol}</div>`;
                    });
                }
                return content;
            };
            reel1.innerHTML = createReelContent();
            reel2.innerHTML = createReelContent();
            reel3.innerHTML = createReelContent();
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
                    setTimeout(playSlotReelStop, spinDuration1);
                    setTimeout(playSlotReelStop, spinDuration2);
                    setTimeout(() => { playSlotReelStop(); stopSlotSpinSound(); }, spinDuration3);
                    reel1.style.transition = `transform ${spinDuration1}ms cubic-bezier(0.175, 0.885, 0.32, 1.275)`;
                    reel2.style.transition = `transform ${spinDuration2}ms cubic-bezier(0.175, 0.885, 0.32, 1.275)`;
                    reel3.style.transition = `transform ${spinDuration3}ms cubic-bezier(0.175, 0.885, 0.32, 1.275)`;
                    reel1.style.transform = `translateY(-${totalSpin1}px)`;
                    reel2.style.transform = `translateY(-${totalSpin2}px)`;
                    reel3.style.transform = `translateY(-${totalSpin3}px)`;
                    setTimeout(() => {
                        if (giftData.prize > 0) { playSlotWinSound(); showGameResult(true, giftData.prize, '🎁'); }
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
                setTimeout(playSlotReelStop, spinDuration1);
                setTimeout(playSlotReelStop, spinDuration2);
                setTimeout(() => { playSlotReelStop(); stopSlotSpinSound(); }, spinDuration3);

                reel1.style.transition = `transform ${spinDuration1}ms cubic-bezier(0.175, 0.885, 0.32, 1.275)`;
                reel2.style.transition = `transform ${spinDuration2}ms cubic-bezier(0.175, 0.885, 0.32, 1.275)`;
                reel3.style.transition = `transform ${spinDuration3}ms cubic-bezier(0.175, 0.885, 0.32, 1.275)`;

                reel1.style.transform = `translateY(-${totalSpin1}px)`;
                reel2.style.transform = `translateY(-${totalSpin2}px)`;
                reel3.style.transform = `translateY(-${totalSpin3}px)`;

                setTimeout(() => {
                    if (data.prize > 0) {
                        playSlotWinSound();
                        showGameResult(true, data.prize, '🎰');
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

        const initScratchCard = () => {
            const canvas = document.getElementById('scratch-canvas');
            const card = document.getElementById('scratch-card');
            const scratchPrize = document.getElementById('scratch-prize');

            if (!canvas || !card) return;

            const rect = card.getBoundingClientRect();
            canvas.width = rect.width;
            canvas.height = rect.height;

            scratchCanvas = canvas;
            scratchCtx = canvas.getContext('2d');

            const dict = window.translations?.[window.currentLang] || {};
            if (!hasValidCard) {
                scratchPrize.textContent = '';
                scratchCtx.fillStyle = 'rgba(60, 60, 60, 0.95)';
                scratchCtx.fillRect(0, 0, canvas.width, canvas.height);
                scratchCtx.fillStyle = '#888';
                scratchCtx.font = 'bold 14px Arial';
                scratchCtx.textAlign = 'center';
                scratchCtx.textBaseline = 'middle';
                scratchCtx.fillText(dict.scratch_buy_first || '请先购买刮刮卡', canvas.width / 2, canvas.height / 2);
                return;
            }

            const gradient = scratchCtx.createLinearGradient(0, 0, canvas.width, canvas.height);
            gradient.addColorStop(0, '#444');
            gradient.addColorStop(0.5, '#666');
            gradient.addColorStop(1, '#444');
            scratchCtx.fillStyle = gradient;
            scratchCtx.fillRect(0, 0, canvas.width, canvas.height);

            scratchCtx.fillStyle = '#999';
            scratchCtx.font = 'bold 16px Arial';
            scratchCtx.textAlign = 'center';
            scratchCtx.textBaseline = 'middle';
            scratchCtx.fillText(dict.scratch_here || '👆 刮开此处', canvas.width / 2, canvas.height / 2);

            scratchCtx.strokeStyle = 'rgba(255,255,255,0.1)';
            scratchCtx.lineWidth = 1;
            for (let i = 0; i < canvas.width; i += 20) {
                scratchCtx.beginPath();
                scratchCtx.moveTo(i, 0);
                scratchCtx.lineTo(i, canvas.height);
                scratchCtx.stroke();
            }
            for (let i = 0; i < canvas.height; i += 20) {
                scratchCtx.beginPath();
                scratchCtx.moveTo(0, i);
                scratchCtx.lineTo(canvas.width, i);
                scratchCtx.stroke();
            }

            if (!scratchEventsInitialized) {
                initScratchEvents();
                scratchEventsInitialized = true;
            }
        };

        const initScratchEvents = () => {
            if (!scratchCanvas) return;

            const getPos = (e) => {
                const rect = scratchCanvas.getBoundingClientRect();
                const scaleX = scratchCanvas.width / rect.width;
                const scaleY = scratchCanvas.height / rect.height;
                if (e.touches) {
                    return {
                        x: (e.touches[0].clientX - rect.left) * scaleX,
                        y: (e.touches[0].clientY - rect.top) * scaleY
                    };
                }
                return {
                    x: (e.clientX - rect.left) * scaleX,
                    y: (e.clientY - rect.top) * scaleY
                };
            };

            const draw = (e) => {
                if (!scratchIsDrawing || !hasValidCard) return;
                const pos = getPos(e);
                scratchCtx.globalCompositeOperation = 'destination-out';
                scratchCtx.beginPath();
                scratchCtx.arc(pos.x, pos.y, 25, 0, Math.PI * 2);
                scratchCtx.fill();
                checkScratchProgress();
            };

            scratchCanvas.addEventListener('mousedown', (e) => {
                if (hasValidCard) { scratchIsDrawing = true; draw(e); }
            });
            scratchCanvas.addEventListener('mousemove', draw);
            scratchCanvas.addEventListener('mouseup', () => { scratchIsDrawing = false; });
            scratchCanvas.addEventListener('mouseleave', () => { scratchIsDrawing = false; });

            scratchCanvas.addEventListener('touchstart', (e) => {
                if (hasValidCard) { scratchIsDrawing = true; draw(e); }
            });
            scratchCanvas.addEventListener('touchmove', draw);
            scratchCanvas.addEventListener('touchend', () => { scratchIsDrawing = false; });
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

    // ===== 中奖信息轮播（纯前端模拟） =====
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
                    border: 1px solid rgba(255,200,80,0.35);
                    box-shadow: 0 0 18px rgba(255,170,0,0.18), inset 0 0 12px rgba(0,243,255,0.08);
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
                    background: linear-gradient(90deg, #ffd34d, #ff9d2f);
                    box-shadow: 0 0 10px rgba(255,180,40,0.55);
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
                    color: #ffb347;
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
                    content: '🪙 ';
                }
            `;
            document.head.appendChild(style);
        }

        // 模拟数据
        const tr = (k) => (window.translations && window.translations[currentLang] && window.translations[currentLang][k]) || k;
        const mailPrefix = ['a', 'b', 'c', 'm', 'x', 'k', 't', 'z', 'user', 'vip', '2386'];
        const mailDomains = ['qq.com', '163.com', 'gmail.com', 'outlook.com', 'foxmail.com'];
        const gameKeys = ['game_wheel', 'game_slot', 'game_scratch'];
        const prizes = [200, 100, 50, 20];
        const buildName = () => {
            const p = mailPrefix[Math.floor(Math.random() * mailPrefix.length)];
            const d = mailDomains[Math.floor(Math.random() * mailDomains.length)];
            return p + '***@' + d;
        };
        const mockWinners = [];
        for (let i = 0; i < 10; i++) {
            const name = buildName();
            const gameKey = gameKeys[Math.floor(Math.random() * gameKeys.length)];
            const amount = prizes[Math.floor(Math.random() * prizes.length)];
            mockWinners.push({ name, gameKey, game: tr(gameKey), amount });
        }

        const buildSlide = (w) => {
            const slide = document.createElement('div');
            slide.className = 'winner-slide';
            slide.innerHTML =
                '<span class="winner-icon">🎉</span>' +
                '<span class="winner-name">' + w.name + '</span>' +
                '<span data-i18n="winner_at">' + tr('winner_at') + '</span>' +
                '<span class="winner-game" data-i18n="' + w.gameKey + '">' + w.game + '</span>' +
                '<span data-i18n="winner_won">' + tr('winner_won') + '</span>' +
                '<span class="winner-amount">' + w.amount + '</span>';
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
        [...mockWinners, ...mockWinners].forEach(w => track.appendChild(buildSlide(w)));
        view.appendChild(track);
        carousel.appendChild(view);
        tabsEl.insertAdjacentElement('beforebegin', carousel);
    };
    // ===== 预测未来 — 无庄家彩池模式 =====
    const PredictModule = (() => {
        const API_BASE = 'https://api.immmor.com';
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

        function toLocalTime(isoStr) {
            if (!isoStr) return '';
            try {
                const d = new Date(isoStr + 'Z');
                if (isNaN(d.getTime())) return isoStr;
                return d.toLocaleString([], { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
            } catch (e) { return isoStr; }
        }

        function getRemaining(isoStr) {
            if (!isoStr) return '';
            const diff = new Date(isoStr + 'Z') - new Date();
            if (diff <= 0) return '已结束';
            const dh = Math.floor(diff / 3600000);
            const dm = Math.floor((diff % 3600000) / 60000);
            if (dh >= 24) return `${Math.floor(dh / 24)}天${dh % 24}h`;
            if (dh > 0) return `${dh}h${dm}m`;
            return `${dm}分钟`;
        }

        function isExpired(isoStr) {
            return isoStr && new Date(isoStr + 'Z') <= new Date();
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
                        option_pools: t.option_pools || t.options.map(() => 0),
                        pool: Array.isArray(t.option_pools) ? t.option_pools.reduce((a, b) => a + b, 0) : Number(t.pool) || 0,
                        option_bettors: t.option_bettors || t.options.map(() => 0),
                        winner: t.winner == null || Number(t.winner) < 0 ? null : t.winner
                    }));
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
                container.innerHTML = '<p class="text-xs text-center text-zinc-500 py-8">暂无预测话题</p>';
                return;
            }
            container.innerHTML = allTopics.map((t) => {
                const active = t.status === 'active';
                const expired = active && isExpired(t.end_time);
                const displayStatus = !active ? 'resolved' : expired ? 'ended' : 'active';
                const totalPool = t.pool || 0;

                const barHTML = t.options.map((_, i) => {
                    const amt = (t.option_pools && t.option_pools[i]) || 0;
                    const pct = totalPool > 0 ? (amt / totalPool * 100) : (1 / t.options.length * 100);
                    const isWinner = !active && t.winner === i;
                    const odds = amt > 0 ? (totalPool / amt).toFixed(2) : '--';
                    return { pct, isWinner, odds, color: getColor(i) };
                });

                const myBet = myPredictBets[t.id];
                const optionsHTML = t.options.map((opt, i) => {
                    const b = barHTML[i];
                    let cls = 'predict-opt-btn';
                    if (myBet && myBet.optionIndex === i) cls += ' selected';
                    if (b.isWinner) cls += ' resolved-winner';
                    return `
                        <button class="${cls}" data-topic="${t.id}" data-opt="${i}" ${!active ? 'disabled' : ''}>
                            <span class="text-xs flex items-center gap-2">
                                <span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${b.color};flex-shrink:0;"></span>
                                ${b.isWinner ? '🏆 ' : ''}${opt}
                            </span>
                            <span class="text-[10px] font-mono" style="color:#999;">
                                赔率 ${b.odds} | ${Number(b.pct).toFixed(1)}%
                            </span>
                        </button>`;
                }).join('');

                const barSegments = barHTML.map(b =>
                    `<div class="predict-pool-segment" style="width:${b.pct}%;background:${b.color};${b.isWinner ? 'box-shadow:0 0 8px var(--neon-green);' : ''}"></div>`
                ).join('');

                return `
                    <div class="predict-topic-card ${!active ? 'resolved' : ''}">
                        <div class="flex justify-between items-start mb-1">
                            <p class="text-xs font-bold leading-relaxed flex-1 mr-2">${t.question}</p>
                            <div class="flex items-center gap-2 shrink-0">
                                <span class="predict-badge ${displayStatus}">${
                                    displayStatus === 'active' ? '进行中' :
                                    displayStatus === 'resolved' ? '已结算' : '已截止'
                                }</span>
                            </div>
                        </div>
                        <div class="flex items-center justify-between mb-2">
                            <span class="predict-time">${displayStatus === 'active' ? '截止: ' + toLocalTime(t.end_time) + ' (' + getRemaining(t.end_time) + ')' : '已结束'}</span>
                            <span class="predict-pool-amount">${formatMoney(totalPool)}</span>
                        </div>
                        <div class="predict-pool-bar">${barSegments}</div>
                        <div class="grid gap-1 mt-2" style="display:flex; flex-direction:column; gap:6px;">${optionsHTML}</div>
                        ${t.winner !== null && t.winner !== undefined ? `<p class="text-[10px] mt-2" style="color:var(--neon-green);">结果: ${t.options[t.winner]}</p>` : ''}
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
                alert('请先登录');
                document.getElementById('auth-toggle')?.click();
                return;
            }
            const topic = allTopics.find(t => String(t.id) === String(topicId));
            if (!topic || topic.status !== 'active') return;
            const optName = topic.options[optIndex];
            const amount = prompt(`你对「${topic.question}」\n投注: ${optName}\n请输入投注金额（¥）：`, '10');
            if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) return;
            const betAmount = parseFloat(Number(amount).toFixed(2));

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
                    alert(data.message || '投注失败');
                }
            } catch (e) {
                console.warn('投注API失败', e);
                alert('网络错误，请重试');
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
