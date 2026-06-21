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

        // 幸运转盘功能
        const wheel = document.getElementById('wheel');
        const spinBtn = document.getElementById('spin-wheel');
        const wheelResult = document.getElementById('wheel-result');
        
        spinBtn.addEventListener('click', () => {
            if (!checkLogin()) return;
            if (spinBtn.disabled) return;
            
            const userInfo = JSON.parse(localStorage.getItem('userInfo') || '{}');
            const balance = parseFloat(userInfo.balance || 0);
            
            if (balance < 10) {
                alert('余额不足！每次抽奖需要10元');
                return;
            }
            
            spinBtn.disabled = true;
            wheelResult.textContent = '';
            
            // 重置转盘状态，确保每次旋转都是从相同状态开始
            wheel.style.transition = 'none';
            wheel.style.transform = 'rotate(0deg)';
            
            // 强制重绘
            void wheel.offsetWidth;
            
            // 设置新的旋转角度和过渡效果
            const spinDegrees = Math.floor(Math.random() * 360) + 1080;
            wheel.style.transition = 'transform 4s cubic-bezier(0.175, 0.885, 0.32, 1.275)';
            wheel.style.transform = `rotate(${spinDegrees}deg)`;
            
            setTimeout(() => {
                const segments = wheel.querySelectorAll('.wheel-segment');
                const angle = spinDegrees % 360;
                const segmentAngle = 45;
                // 每个扇形占据45度，指针在顶部(0度)
                // 计算指针指向的扇形索引
                const adjustedAngle = (360 - angle + 22.5) % 360;
                const activeIndex = Math.floor(adjustedAngle / segmentAngle) % segments.length;
                const prizeText = segments[activeIndex].getAttribute('data-prize');
                const prize = parseFloat(prizeText);
                
                // 扣除余额，增加奖励
                userInfo.balance = (balance - 10) + prize;
                localStorage.setItem('userInfo', JSON.stringify(userInfo));
                
                // 更新显示的余额
                updateBalanceDisplay(userInfo.balance);
                
                wheelResult.textContent = `🎉 恭喜获得 ¥${prize}！`;
                spinBtn.disabled = false;
            }, 4000);
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
            
            // 每个符号的高度是90px，显示区域能看到3个符号
            const symbolHeight = 90;
            const visibleSymbols = 3;
            
            // 生成随机停止位置（确保最终中间位置显示目标符号）
            // stopIndex 0-6 对应7个符号，加上21个额外符号（3圈）确保滚动流畅
            const stopIndex1 = Math.floor(Math.random() * 7);
            const stopIndex2 = Math.floor(Math.random() * 7);
            const stopIndex3 = Math.floor(Math.random() * 7);
            
            // 计算滚动位置：(额外圈数 + 停止索引) * 符号高度 + 中间位置偏移
            // 中间位置是第2个符号的位置（索引1），所以需要向上滚动1个符号的高度
            const totalSpin1 = (7 + stopIndex1) * symbolHeight - symbolHeight;
            const totalSpin2 = (8 + stopIndex2) * symbolHeight - symbolHeight;
            const totalSpin3 = (9 + stopIndex3) * symbolHeight - symbolHeight;
            
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
                
                if (symbols[stopIndex1] === symbols[stopIndex2] && symbols[stopIndex2] === symbols[stopIndex3]) {
                    let prize = 0;
                    if (symbols[stopIndex1] === '7️⃣') prize = 200;
                    else if (symbols[stopIndex1] === '💎') prize = 100;
                    else if (symbols[stopIndex1] === '⭐') prize = 50;
                    else prize = 30;
                    
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