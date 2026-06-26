// ==================== 加载动画 ====================
const loadingScreen = document.getElementById('loading-screen');
const loadingProgressBar = document.getElementById('loading-progress-bar');
const loadingText = document.getElementById('loading-text');

const loadingMessages = [
    'INITIALIZING...',
    'CONNECTING TO NETWORK...',
    'LOADING MODULES...',
    'PREPARING INTERFACE...',
    'WELCOME TO PHANTOM!'
];

let progress = 0;
let messageIndex = 0;

const updateLoading = () => {
    progress += Math.random() * 25;
    if (progress > 100) progress = 100;

    loadingProgressBar.style.width = `${progress}%`;

    if (progress > 20 && messageIndex < 1) {
        messageIndex = 1;
        loadingText.textContent = loadingMessages[messageIndex];
    }
    if (progress > 40 && messageIndex < 2) {
        messageIndex = 2;
        loadingText.textContent = loadingMessages[messageIndex];
    }
    if (progress > 70 && messageIndex < 3) {
        messageIndex = 3;
        loadingText.textContent = loadingMessages[messageIndex];
    }
    if (progress >= 100) {
        messageIndex = 4;
        loadingText.textContent = loadingMessages[messageIndex];
        setTimeout(() => {
            loadingScreen.classList.add('hidden');
        }, 800);
        return;
    }

    setTimeout(updateLoading, Math.random() * 400 + 200);
};

// 页面加载完成后开始
window.addEventListener('load', () => {
    updateLoading();
});

// 如果加载时间过长，确保显示
setTimeout(() => {
    if (!loadingScreen.classList.contains('hidden')) {
        updateLoading();
    }
}, 1000);

