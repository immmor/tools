class StartupAnimation {
    constructor() {
        this.loader = null;
        this.progress = 0;
        this.animationFrame = null;
        this.loadingTexts = [
            "INITIALIZING SYSTEM...",
            "LOADING MODULES...",
            "ESTABLISHING CONNECTION...",
            "SYNCHRONIZING DATA...",
            "BOOTING INTERFACE..."
        ];
        this.currentTextIndex = 0;
    }

    init() {
        this.createLoader();
        this.startAnimation();
        this.simulateLoading();
    }

    createLoader() {
        this.loader = document.createElement('div');
        this.loader.id = 'startup-loader';
        this.loader.innerHTML = `
            <div class="loader-overlay">
                <div class="loader-container">
                    <div class="logo-wrapper">
                        <div class="logo-ring"></div>
                        <div class="logo-core"></div>
                        <div class="logo-particles">
                            <span class="particle p1"></span>
                            <span class="particle p2"></span>
                            <span class="particle p3"></span>
                            <span class="particle p4"></span>
                            <span class="particle p5"></span>
                            <span class="particle p6"></span>
                        </div>
                    </div>
                    <div class="loading-text">${this.loadingTexts[0]}</div>
                    <div class="progress-bar">
                        <div class="progress-fill"></div>
                    </div>
                    <div class="progress-text">0%</div>
                    <div class="scan-line"></div>
                </div>
            </div>
        `;
        document.body.appendChild(this.loader);
    }

    startAnimation() {
        const animate = () => {
            const particles = document.querySelectorAll('.particle');
            particles.forEach((p, i) => {
                const angle = (i / particles.length) * Math.PI * 2;
                const radius = 60 + Math.sin(Date.now() / 500 + i) * 10;
                p.style.left = `${50 + Math.cos(angle) * radius}%`;
                p.style.top = `${50 + Math.sin(angle) * radius}%`;
                p.style.opacity = 0.5 + Math.sin(Date.now() / 300 + i) * 0.5;
            });
            
            const ring = document.querySelector('.logo-ring');
            if (ring) {
                ring.style.transform = `rotate(${Date.now() / 50}deg)`;
            }
            
            const core = document.querySelector('.logo-core');
            if (core) {
                core.style.transform = `rotate(${-Date.now() / 30}deg) scale(${1 + Math.sin(Date.now() / 200) * 0.05})`;
            }
            
            this.animationFrame = requestAnimationFrame(animate);
        };
        animate();
    }

    simulateLoading() {
        const steps = [20, 45, 70, 85, 100];
        const delays = [800, 600, 500, 400, 300];
        
        let stepIndex = 0;
        const loadStep = () => {
            if (stepIndex < steps.length) {
                this.progress = steps[stepIndex];
                this.updateProgress();
                this.currentTextIndex = stepIndex;
                this.updateLoadingText();
                stepIndex++;
                setTimeout(loadStep, delays[stepIndex - 1]);
            } else {
                this.complete();
            }
        };
        
        setTimeout(loadStep, 300);
    }

    updateProgress() {
        const progressFill = document.querySelector('.progress-fill');
        const progressText = document.querySelector('.progress-text');
        if (progressFill) {
            progressFill.style.width = `${this.progress}%`;
        }
        if (progressText) {
            progressText.textContent = `${this.progress}%`;
        }
    }

    updateLoadingText() {
        const loadingText = document.querySelector('.loading-text');
        if (loadingText && this.currentTextIndex < this.loadingTexts.length) {
            loadingText.textContent = this.loadingTexts[this.currentTextIndex];
        }
    }

    complete() {
        if (this.animationFrame) {
            cancelAnimationFrame(this.animationFrame);
        }
        
        const loader = document.getElementById('startup-loader');
        if (loader) {
            loader.classList.add('fade-out');
            setTimeout(() => {
                loader.remove();
                document.body.classList.remove('loading');
            }, 500);
        }
        
        this.playStartupSound();
    }

    playStartupSound() {
        try {
            const audioContext = new (window.AudioContext || window.webkitAudioContext)();
            const notes = [523.25, 659.25, 783.99, 1046.50];
            notes.forEach((freq, i) => {
                setTimeout(() => {
                    const oscillator = audioContext.createOscillator();
                    const gainNode = audioContext.createGain();
                    oscillator.connect(gainNode);
                    gainNode.connect(audioContext.destination);
                    oscillator.frequency.value = freq;
                    oscillator.type = 'sine';
                    gainNode.gain.setValueAtTime(0.1, audioContext.currentTime);
                    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.2);
                    oscillator.start(audioContext.currentTime);
                    oscillator.stop(audioContext.currentTime + 0.2);
                }, i * 100);
            });
        } catch (e) {
            console.log('Audio not supported');
        }
    }
}

document.addEventListener('DOMContentLoaded', () => {
    document.body.classList.add('loading');
    const startup = new StartupAnimation();
    startup.init();
});
