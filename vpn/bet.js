// ==================== 游戏中心模块 ====================
(function() {
    // 等待DOM加载完成
    document.addEventListener('DOMContentLoaded', () => {
        initGameCenter();
    });

    const initGameCenter = () => {
        // Tab切换功能
        const gameTabs = document.querySelectorAll('.game-tab');
        const gameContents = document.querySelectorAll('.game-tab-content');

        gameTabs.forEach(tab => {
            tab.addEventListener('click', () => {
                const tabId = tab.getAttribute('data-tab');
                
                // 更新Tab样式
                gameTabs.forEach(t => t.classList.remove('game-tab-active'));
                tab.classList.add('game-tab-active');
                
                // 切换内容
                gameContents.forEach(content => content.classList.add('hidden'));
                const activeContent = document.getElementById(`tab-${tabId}`);
                if (activeContent) {
                    activeContent.classList.remove('hidden');
                    
                    // 如果是刮刮乐，初始化canvas
                    if (tabId === 'scratch') {
                        setTimeout(() => initScratchCard(), 100);
                    }
                }
            });
        });

        // 幸运转盘
        const WHEEL_PRIZES = [100, 50, 200, 10, 500, 20, 1000, 5];
        const WHEEL_COLORS = [
            '#00e676',  // 翠绿 ¥100
            '#00d4ff',  // 天蓝 ¥50
            '#ff9100',  // 橙金 ¥200
            '#b388ff',  // 紫罗兰 ¥10
            '#ff4081',  // 玫红 ¥500
            '#ffd600',  // 金黄 ¥20
            '#ff5252',  // 珊瑚红 ¥1000
            '#448aff'   // 宝蓝 ¥5
        ];
        const wheelFace = document.getElementById('wheel-face');
        const spinBtn = document.getElementById('spin-wheel');
        const wheelResult = document.getElementById('wheel-result');
        let wheelRotation = 0;
        let isWheelSpinning = false;

        const normalizeDeg = (deg) => ((deg % 360) + 360) % 360;

        const getWheelStep = () => 360 / WHEEL_PRIZES.length;

        // 根据当前旋转角度，反算指针（顶部）指向的扇区
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
                const textColor = i === 5 ? '#1a1a2e' : '#fff';
                return `<span class="wheel-label" style="--angle:${angle}deg;color:${textColor}">¥${prize}</span>`;
            }).join('');
        };

        initWheel();

        spinBtn.addEventListener('click', () => {
            if (isWheelSpinning) return;
            if (!checkLogin()) return;
            if (spinBtn.disabled) return;

            const userInfo = JSON.parse(localStorage.getItem('userInfo') || '{}');
            const balance = parseFloat(userInfo.balance || 0);

            if (balance < 10) {
                alert('余额不足！每次抽奖需要10元');
                return;
            }

            isWheelSpinning = true;
            spinBtn.disabled = true;
            wheelResult.textContent = '';

            const step = getWheelStep();
            const targetIndex = Math.floor(Math.random() * WHEEL_PRIZES.length);
            const segmentCenter = targetIndex * step + step / 2;
            const targetMod = normalizeDeg(360 - segmentCenter);
            const currentMod = normalizeDeg(wheelRotation);
            let delta = targetMod - currentMod;
            if (delta <= 0) delta += 360;
            const extraSpins = 4 + Math.floor(Math.random() * 2);
            wheelRotation += delta + extraSpins * 360;

            wheelFace.style.transition = 'transform 4s cubic-bezier(0.17, 0.67, 0.12, 0.99)';
            wheelFace.style.transform = `rotate(${wheelRotation}deg)`;

            setTimeout(() => {
                const actualIndex = getIndexAtPointer(wheelRotation);
                const prize = WHEEL_PRIZES[actualIndex];

                userInfo.balance = (balance - 10) + prize;
                localStorage.setItem('userInfo', JSON.stringify(userInfo));
                updateBalanceDisplay(userInfo.balance);
                wheelResult.textContent = `🎉 恭喜获得 ¥${prize}！`;
                isWheelSpinning = false;
                spinBtn.disabled = false;
            }, 4200);
        });

        // 老虎机功能
        const slotBtn = document.getElementById('slot-spin');
        const slotResult = document.getElementById('slot-result');
        let isSlotSpinning = false;
        const symbols = ['🍒', '🍊', '🍋', '⭐', '💎', '7️⃣', '🔔'];
        
        // 初始化老虎机转轮
        const initSlotReels = () => {
            const reel1 = document.getElementById('slot-reel-1');
            const reel2 = document.getElementById('slot-reel-2');
            const reel3 = document.getElementById('slot-reel-3');
            
            if (!reel1 || !reel2 || !reel3) return;
            
            // 每个转轮添加足够的符号（原始符号重复3次以实现无缝滚动）
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
        
        // 初始化
        initSlotReels();
        
        slotBtn.addEventListener('click', () => {
            if (isSlotSpinning) return;
            if (!checkLogin()) return;
            
            const userInfo = JSON.parse(localStorage.getItem('userInfo') || '{}');
            const balance = parseFloat(userInfo.balance || 0);
            
            if (balance < 20) {
                alert('余额不足！每次游戏需要20元');
                return;
            }
            
            isSlotSpinning = true;
            slotBtn.disabled = true;
            slotResult.textContent = '';
            
            const reel1 = document.getElementById('slot-reel-1');
            const reel2 = document.getElementById('slot-reel-2');
            const reel3 = document.getElementById('slot-reel-3');
            
            if (!reel1 || !reel2 || !reel3) {
                console.error('老虎机元素未找到');
                isSlotSpinning = false;
                slotBtn.disabled = false;
                return;
            }
            
            const symbolHeight = 90;
            
            const stopIndex1 = Math.floor(Math.random() * 7);
            const stopIndex2 = Math.floor(Math.random() * 7);
            const stopIndex3 = Math.floor(Math.random() * 7);
            
            // 每轮转 N 圈（7 的倍数）后停在 stopIndex，使可见符号 = symbols[stopIndex]
            const totalSpin1 = (7 + stopIndex1) * symbolHeight;
            const totalSpin2 = (14 + stopIndex2) * symbolHeight;
            const totalSpin3 = (14 + stopIndex3) * symbolHeight;
            
            // 重置位置到起点
            reel1.style.transition = 'none';
            reel2.style.transition = 'none';
            reel3.style.transition = 'none';
            reel1.style.transform = 'translateY(0)';
            reel2.style.transform = 'translateY(0)';
            reel3.style.transform = 'translateY(0)';
            
            // 强制重绘
            void reel1.offsetWidth;
            void reel2.offsetWidth;
            void reel3.offsetWidth;
            
            // 设置滚动动画
            const spinDuration1 = 2000;
            const spinDuration2 = 2500;
            const spinDuration3 = 3000;
            
            reel1.style.transition = `transform ${spinDuration1}ms cubic-bezier(0.175, 0.885, 0.32, 1.275)`;
            reel2.style.transition = `transform ${spinDuration2}ms cubic-bezier(0.175, 0.885, 0.32, 1.275)`;
            reel3.style.transition = `transform ${spinDuration3}ms cubic-bezier(0.175, 0.885, 0.32, 1.275)`;
            
            reel1.style.transform = `translateY(-${totalSpin1}px)`;
            reel2.style.transform = `translateY(-${totalSpin2}px)`;
            reel3.style.transform = `translateY(-${totalSpin3}px)`;
            
            // 等待所有转轮停止后计算结果
            setTimeout(() => {
                const userInfo = JSON.parse(localStorage.getItem('userInfo') || '{}');
                const balance = parseFloat(userInfo.balance || 0);
                
                const s1 = symbols[stopIndex1];
                const s2 = symbols[stopIndex2];
                const s3 = symbols[stopIndex3];
                let prize = 0;

                if (s1 === s2 && s2 === s3) {
                    if (s1 === '7️⃣') prize = 200;
                    else if (s1 === '💎') prize = 100;
                    else if (s1 === '⭐') prize = 50;
                    else prize = 30;
                } else if (s1 === s2 || s2 === s3 || s1 === s3) {
                    const pairSymbol = s1 === s2 ? s1 : (s2 === s3 ? s2 : s1);
                    if (pairSymbol === '7️⃣') prize = 100;
                    else if (pairSymbol === '💎') prize = 50;
                    else if (pairSymbol === '⭐') prize = 25;
                    else prize = 15;
                }

                if (prize > 0) {
                    userInfo.balance = (balance - 20) + prize;
                    localStorage.setItem('userInfo', JSON.stringify(userInfo));
                    updateBalanceDisplay(userInfo.balance);
                    slotResult.textContent = `🎊 恭喜中奖！获得 ¥${prize}！`;
                } else {
                    userInfo.balance = balance - 20;
                    localStorage.setItem('userInfo', JSON.stringify(userInfo));
                    updateBalanceDisplay(userInfo.balance);
                    slotResult.textContent = '😔 未中奖，再接再厉！';
                }
                
                isSlotSpinning = false;
                slotBtn.disabled = false;
            }, 3500);
        });

        // 刮刮乐功能
        let scratchCanvas = null;
        let scratchCtx = null;
        let scratchPrizeAmount = 0;
        let isPrizeAdded = false;
        let hasValidCard = false;
        
        const initScratchCard = () => {
            const canvas = document.getElementById('scratch-canvas');
            const card = document.getElementById('scratch-card');
            const scratchPrize = document.getElementById('scratch-prize');
            
            if (!canvas || !card) {
                console.error('刮刮乐元素未找到');
                return;
            }
            
            // 设置canvas尺寸
            const rect = card.getBoundingClientRect();
            canvas.width = rect.width;
            canvas.height = rect.height;
            
            scratchCanvas = canvas;
            scratchCtx = canvas.getContext('2d');
            
            // 如果还没有购买卡片，显示提示
            if (!hasValidCard) {
                scratchPrize.textContent = '👆 点击下方按钮购买刮刮卡';
                
                // 绘制半透明覆盖层
                scratchCtx.fillStyle = 'rgba(60, 60, 60, 0.95)';
                scratchCtx.fillRect(0, 0, canvas.width, canvas.height);
                
                scratchCtx.fillStyle = '#888';
                scratchCtx.font = 'bold 14px Arial';
                scratchCtx.textAlign = 'center';
                scratchCtx.fillText('请先购买刮刮卡', canvas.width / 2, canvas.height / 2);
                return;
            }
            
            // 绘制覆盖层
            const gradient = scratchCtx.createLinearGradient(0, 0, canvas.width, canvas.height);
            gradient.addColorStop(0, '#444');
            gradient.addColorStop(0.5, '#666');
            gradient.addColorStop(1, '#444');
            scratchCtx.fillStyle = gradient;
            scratchCtx.fillRect(0, 0, canvas.width, canvas.height);
            
            // 添加刮刮提示
            scratchCtx.fillStyle = '#999';
            scratchCtx.font = 'bold 16px Arial';
            scratchCtx.textAlign = 'center';
            scratchCtx.fillText('👆 刮开此处', canvas.width / 2, canvas.height / 2);
            
            // 添加网格纹理效果
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
            
            // 添加刮擦事件
            initScratchEvents();
        };
        
        const initScratchEvents = () => {
            if (!scratchCanvas || !scratchCtx || !hasValidCard) return;
            
            let isDrawing = false;
            
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
                if (!isDrawing || !hasValidCard) return;
                
                const pos = getPos(e);
                scratchCtx.globalCompositeOperation = 'destination-out';
                scratchCtx.beginPath();
                scratchCtx.arc(pos.x, pos.y, 25, 0, Math.PI * 2);
                scratchCtx.fill();
                
                // 检查刮开进度，超过50%时添加奖金
                checkScratchProgress();
            };
            
            scratchCanvas.addEventListener('mousedown', (e) => { 
                if (hasValidCard) {
                    isDrawing = true; 
                    draw(e); 
                }
            });
            scratchCanvas.addEventListener('mousemove', draw);
            scratchCanvas.addEventListener('mouseup', () => { isDrawing = false; });
            scratchCanvas.addEventListener('mouseleave', () => { isDrawing = false; });
            
            scratchCanvas.addEventListener('touchstart', (e) => { 
                if (hasValidCard) {
                    isDrawing = true; 
                    draw(e); 
                }
            });
            scratchCanvas.addEventListener('touchmove', draw);
            scratchCanvas.addEventListener('touchend', () => { isDrawing = false; });
        };
        
        // 检查刮开进度
        const checkScratchProgress = () => {
            if (isPrizeAdded || !scratchCanvas || !scratchCtx || !hasValidCard) return;
            
            const imageData = scratchCtx.getImageData(0, 0, scratchCanvas.width, scratchCanvas.height);
            const pixels = imageData.data;
            let transparentPixels = 0;
            const totalPixels = pixels.length / 4;
            
            for (let i = 3; i < pixels.length; i += 4) {
                if (pixels[i] === 0) {
                    transparentPixels++;
                }
            }
            
            const progress = transparentPixels / totalPixels;
            
            // 当刮开超过50%时，添加奖金并显示结果
            if (progress > 0.5) {
                addScratchPrize();
            }
        };
        
        // 添加刮刮乐奖金
        const addScratchPrize = () => {
            if (isPrizeAdded || !hasValidCard) return;
            
            isPrizeAdded = true;
            const scratchResult = document.getElementById('scratch-result');
            
            // 添加奖金到余额
            const userInfo = JSON.parse(localStorage.getItem('userInfo') || '{}');
            userInfo.balance = parseFloat(userInfo.balance) + scratchPrizeAmount;
            localStorage.setItem('userInfo', JSON.stringify(userInfo));
            updateBalanceDisplay(userInfo.balance);
            
            scratchResult.textContent = `🎉 恭喜获得 ¥${scratchPrizeAmount}！`;
        };

        const newScratchBtn = document.getElementById('new-scratch');
        const scratchResult = document.getElementById('scratch-result');
        const scratchPrize = document.getElementById('scratch-prize');
        
        newScratchBtn.addEventListener('click', () => {
            if (!checkLogin()) return;
            
            const userInfo = JSON.parse(localStorage.getItem('userInfo') || '{}');
            const balance = parseFloat(userInfo.balance || 0);
            
            if (balance < 15) {
                alert('余额不足！每张刮刮卡需要15元');
                return;
            }
            
            // 扣除余额
            userInfo.balance = balance - 15;
            localStorage.setItem('userInfo', JSON.stringify(userInfo));
            updateBalanceDisplay(userInfo.balance);
            
            // 随机生成奖励
            const prizes = [5, 10, 20, 50, 100, 200];
            const weights = [0.3, 0.25, 0.2, 0.15, 0.08, 0.02];
            let random = Math.random();
            let prize = 0;
            
            for (let i = 0; i < prizes.length; i++) {
                random -= weights[i];
                if (random <= 0) {
                    prize = prizes[i];
                    break;
                }
            }
            
            // 设置有效卡片状态和奖金
            hasValidCard = true;
            scratchPrizeAmount = prize;
            scratchPrize.textContent = `🎁 恭喜获得 ¥${prize}`;
            scratchResult.textContent = '';
            isPrizeAdded = false;
            
            // 初始化/重置canvas
            initScratchCard();
        });

        // 检查登录状态
        const checkLogin = () => {
            const userInfo = JSON.parse(localStorage.getItem('userInfo') || 'null');
            if (!userInfo) {
                alert('请先登录！');
                document.getElementById('auth-toggle').click();
                return false;
            }
            return true;
        };

        // 更新余额显示
        const updateBalanceDisplay = (balance) => {
            const balanceEl = document.getElementById('user-balance');
            if (balanceEl) {
                balanceEl.textContent = `¥${balance.toFixed(2)}`;
            }
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
        
        // 监听登录状态变化
        document.addEventListener('userLoggedIn', updateGameButtons);
        document.addEventListener('userLoggedOut', () => {
            updateGameButtons();
        });
    };
})();