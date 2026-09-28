// 可复用的图片拼图滑块验证码
// 用法：
//   const ctl = initPuzzleSlider({
//     track, handle, fill, text,            // 轨道 / 拖拽手柄 / 填充 / 文案 元素
//     bgCanvas, pieceCanvas,                // 背景画布 / 拼图块画布
//     refreshBtn, statusEl,                 // 刷新按钮 / 状态提示（可选）
//     onVerifiedChange                      // (verified:boolean) => void
//   });
//   ctl.reset()      重新生成拼图
//   ctl.isVerified() 当前是否已验证
(function () {
  function initPuzzleSlider(opts) {
    const {
      track, handle, fill, text,
      bgCanvas, pieceCanvas, refreshBtn, statusEl, onVerifiedChange
    } = opts || {};
    if (!track || !handle || !bgCanvas || !pieceCanvas) return null;

    const i18n = () => (window.translations && window.translations[window.currentLang]) || {};
    const notify = (v) => { if (typeof onVerifiedChange === 'function') onVerifiedChange(v); };

    const bgCtx = bgCanvas.getContext('2d');
    const pieceCtx = pieceCanvas.getContext('2d');
    const CW = bgCanvas.width;   // 280
    const CH = bgCanvas.height;  // 160
    const PW = pieceCanvas.width;  // 50
    const PH = pieceCanvas.height; // 160
    const PIECE_H = 40;
    const PIECE_TOP = (CH - PIECE_H) / 2;
    const TOLERANCE = 6;

    let targetX = 0;
    let isDragging = false;
    let startX = 0;
    let startHandleLeft = 0;
    let verified = false;

    const getTrackWidth = () => track.clientWidth;
    const getHandleWidth = () => handle.offsetWidth;
    const getMaxLeft = () => Math.max(0, getTrackWidth() - getHandleWidth());

    // 生成随机彩色渐变 + 噪点背景
    const drawBackground = () => {
      const hue1 = Math.floor(Math.random() * 360);
      const hue2 = (hue1 + 60 + Math.floor(Math.random() * 180)) % 360;
      const grad = bgCtx.createLinearGradient(0, 0, CW, CH);
      grad.addColorStop(0, `hsl(${hue1}, 70%, 45%)`);
      grad.addColorStop(0.5, `hsl(${(hue1 + hue2) / 2}, 65%, 35%)`);
      grad.addColorStop(1, `hsl(${hue2}, 70%, 40%)`);
      bgCtx.fillStyle = grad;
      bgCtx.fillRect(0, 0, CW, CH);
      for (let i = 0; i < 8; i++) {
        bgCtx.fillStyle = `hsla(${Math.floor(Math.random() * 360)}, 70%, 60%, ${0.15 + Math.random() * 0.25})`;
        const sh = Math.floor(Math.random() * 3);
        const x = Math.random() * CW, y = Math.random() * CH, r = 15 + Math.random() * 35;
        bgCtx.beginPath();
        if (sh === 0) bgCtx.arc(x, y, r, 0, Math.PI * 2);
        else if (sh === 1) bgCtx.rect(x - r, y - r / 2, r * 2, r);
        else { bgCtx.moveTo(x, y - r); bgCtx.lineTo(x + r, y + r); bgCtx.lineTo(x - r, y + r); bgCtx.closePath(); }
        bgCtx.fill();
      }
      const imgData = bgCtx.getImageData(0, 0, CW, CH);
      for (let i = 0; i < imgData.data.length; i += 4) {
        const n = (Math.random() - 0.5) * 30;
        imgData.data[i] = Math.max(0, Math.min(255, imgData.data[i] + n));
        imgData.data[i + 1] = Math.max(0, Math.min(255, imgData.data[i + 1] + n));
        imgData.data[i + 2] = Math.max(0, Math.min(255, imgData.data[i + 2] + n));
      }
      bgCtx.putImageData(imgData, 0, 0);
    };

    // 多种形状路径
    const SHAPES = ['roundRect', 'circle', 'triangle', 'diamond', 'star', 'hexagon', 'pentagon'];
    const drawShapePath = (ctx, shape, x, y, w, h, rotation = 0) => {
      const cx = x + w / 2, cy = y + h / 2, r = Math.min(w, h) / 2;
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(rotation);
      ctx.translate(-cx, -cy);
      ctx.beginPath();
      switch (shape) {
        case 'roundRect': {
          const rr = Math.min(w, h) * 0.2;
          ctx.moveTo(x + rr, y);
          ctx.lineTo(x + w - rr, y);
          ctx.quadraticCurveTo(x + w, y, x + w, y + rr);
          ctx.lineTo(x + w, y + h - rr);
          ctx.quadraticCurveTo(x + w, y + h, x + w - rr, y + h);
          ctx.lineTo(x + rr, y + h);
          ctx.quadraticCurveTo(x, y + h, x, y + h - rr);
          ctx.lineTo(x, y + rr);
          ctx.quadraticCurveTo(x, y, x + rr, y);
          ctx.closePath();
          break;
        }
        case 'circle':
          ctx.arc(cx, cy, r, 0, Math.PI * 2);
          break;
        case 'triangle':
          ctx.moveTo(cx, y); ctx.lineTo(x + w, y + h); ctx.lineTo(x, y + h); ctx.closePath();
          break;
        case 'diamond':
          ctx.moveTo(cx, y); ctx.lineTo(x + w, cy); ctx.lineTo(cx, y + h); ctx.lineTo(x, cy); ctx.closePath();
          break;
        case 'star': {
          const spikes = 5, oR = r, iR = r * 0.4;
          let rot = -Math.PI / 2;
          for (let i = 0; i < spikes * 2; i++) {
            const rr2 = i % 2 === 0 ? oR : iR;
            const px = cx + Math.cos(rot) * rr2, py = cy + Math.sin(rot) * rr2;
            if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
            rot += Math.PI / spikes;
          }
          ctx.closePath();
          break;
        }
        case 'hexagon':
          for (let i = 0; i < 6; i++) {
            const a = Math.PI / 3 * i - Math.PI / 2;
            const px = cx + Math.cos(a) * r, py = cy + Math.sin(a) * r;
            if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
          }
          ctx.closePath();
          break;
        case 'pentagon':
          for (let i = 0; i < 5; i++) {
            const a = Math.PI * 2 / 5 * i - Math.PI / 2;
            const px = cx + Math.cos(a) * r, py = cy + Math.sin(a) * r;
            if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
          }
          ctx.closePath();
          break;
      }
      ctx.restore();
    };

    // 生成验证码：先拷贝拼图块，再挖凹槽 + 误导凹槽
    const generateCaptcha = () => {
      drawBackground();
      targetX = PW + 10 + Math.floor(Math.random() * (CW - PW * 3));
      const targetY = PIECE_TOP;
      const realShape = SHAPES[Math.floor(Math.random() * SHAPES.length)];

      // 1) 拷贝拼图块到 pieceCanvas
      pieceCtx.clearRect(0, 0, PW, PH);
      pieceCtx.save();
      drawShapePath(pieceCtx, realShape, 0, targetY, PW, PIECE_H);
      pieceCtx.clip();
      pieceCtx.drawImage(bgCanvas, -targetX, 0);
      pieceCtx.restore();
      // 拼图块边框
      pieceCtx.save();
      drawShapePath(pieceCtx, realShape, 0, targetY, PW, PIECE_H);
      pieceCtx.strokeStyle = 'rgba(255, 255, 255, 0.9)';
      pieceCtx.lineWidth = 1.5;
      pieceCtx.stroke();
      pieceCtx.restore();

      // 2) 挖真实凹槽
      bgCtx.save();
      drawShapePath(bgCtx, realShape, targetX, targetY, PW, PIECE_H);
      bgCtx.fillStyle = 'rgba(0, 0, 0, 0.55)';
      bgCtx.fill();
      bgCtx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
      bgCtx.lineWidth = 1;
      bgCtx.stroke();
      bgCtx.restore();

      // 3) 画 1-2 个误导凹槽（相同形状、不同位置、随机旋转角度）
      const decoyCount = 1 + Math.floor(Math.random() * 2);
      const usedX = [targetX];
      for (let i = 0; i < decoyCount; i++) {
        let dx, tries = 0;
        do {
          dx = PW + 10 + Math.floor(Math.random() * (CW - PW * 3));
          tries++;
        } while (usedX.some(ux => Math.abs(ux - dx) < PW + 10) && tries < 20);
        if (tries >= 20) continue;
        usedX.push(dx);
        const dRot = (Math.random() - 0.5) * Math.PI; // -90° ~ 90° 随机旋转
        bgCtx.save();
        drawShapePath(bgCtx, realShape, dx, targetY, PW, PIECE_H, dRot);
        bgCtx.fillStyle = 'rgba(0, 0, 0, 0.45)';
        bgCtx.fill();
        bgCtx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
        bgCtx.lineWidth = 1;
        bgCtx.stroke();
        bgCtx.restore();
      }

      // 重置拼图块和滑块位置
      pieceCanvas.style.opacity = '1';
      setSliderPosition(0);
    };

    // 设置滑块位置（用百分比定位 piece canvas，适配响应式宽度）
    const setSliderPosition = (left) => {
      const max = getMaxLeft();
      left = Math.max(0, Math.min(left, max));
      handle.style.left = left + 'px';
      fill.style.width = (left + getHandleWidth()) + 'px';
      // piece 用百分比定位：pieceLeft% = (left / max) * (pieceMax / CW) * 100
      const pieceMax = CW - PW;
      const pieceLeftRatio = max > 0 ? (left / max) * pieceMax / CW : 0;
      pieceCanvas.style.left = (pieceLeftRatio * 100) + '%';
      // piece canvas 显示宽度也用百分比
      pieceCanvas.style.width = (PW / CW * 100) + '%';
    };

    const showStatus = (msg, type) => {
      if (!statusEl) return;
      statusEl.textContent = msg;
      statusEl.className = `absolute bottom-1 left-1/2 -translate-x-1/2 px-2 py-0.5 rounded text-[10px] z-10 ${type === 'error' ? 'bg-red-500/80 text-white' : 'bg-[var(--neon-green)]/80 text-black'}`;
      statusEl.classList.remove('hidden');
      if (type === 'error') {
        setTimeout(() => statusEl.classList.add('hidden'), 1500);
      }
    };

    const completeSlider = (left) => {
      verified = true;
      notify(true);
      // 拼图块停在验证完成的位置
      setSliderPosition(left);
      // 填充平滑拉满（成功绿）
      fill.style.transition = 'width 0.25s ease';
      fill.style.width = '100%';
      // 隐藏滑块拖拽按钮（稍延迟，配合动画）
      setTimeout(() => { handle.style.display = 'none'; fill.style.display = 'none'; }, 200);
      // 轨道绿光闪
      track.classList.remove('slider-success');
      void track.offsetWidth;
      track.classList.add('slider-success');
      // 拼图块回弹
      pieceCanvas.classList.remove('slider-piece-in');
      void pieceCanvas.offsetWidth;
      pieceCanvas.classList.add('slider-piece-in');
      const t = i18n();
      text.innerHTML = `✔ ${t.withdraw_slider_ok || '验证完成'}`;
      text.classList.remove('text-zinc-400');
      text.classList.add('text-[var(--neon-green)]', 'font-medium');
      // 文字 pop 动画
      text.classList.remove('slider-pop');
      void text.offsetWidth;
      text.classList.add('slider-pop');
    };

    const failSlider = () => {
      verified = false;
      notify(false);
      handle.style.display = '';
      fill.style.display = '';
      const t = i18n();
      showStatus(t.withdraw_slider_fail || '验证失败，请重试', 'error');
      track.classList.add('animate-shake');
      setTimeout(() => {
        track.classList.remove('animate-shake');
        handle.classList.add('bg-zinc-700', 'border-zinc-600');
        handle.classList.remove('bg-[var(--neon-green)]', 'border-[var(--neon-green)]');
        handle.querySelector('svg').innerHTML = '<polyline points="9 18 15 12 9 6"></polyline>';
        handle.querySelector('svg').classList.remove('text-black');
        handle.querySelector('svg').classList.add('text-zinc-400');
        text.textContent = t.withdraw_slider_tip || '拖动滑块完成验证';
        text.classList.add('text-zinc-400');
        text.classList.remove('text-[var(--neon-green)]', 'font-medium');
        generateCaptcha();
      }, 500);
    };

    const resetSlider = () => {
      verified = false;
      notify(false);
      handle.style.display = '';
      fill.style.display = '';
      fill.style.transition = '';
      fill.style.width = '0';
      track.classList.remove('slider-success');
      pieceCanvas.classList.remove('slider-piece-in');
      text.classList.remove('slider-pop');
      handle.classList.add('bg-zinc-700', 'border-zinc-600');
      handle.classList.remove('bg-[var(--neon-green)]', 'border-[var(--neon-green)]');
      handle.querySelector('svg').innerHTML = '<polyline points="9 18 15 12 9 6"></polyline>';
      handle.querySelector('svg').classList.remove('text-black');
      handle.querySelector('svg').classList.add('text-zinc-400');
      const t = i18n();
      text.textContent = t.withdraw_slider_tip || '拖动滑块完成验证';
      text.classList.add('text-zinc-400');
      text.classList.remove('text-[var(--neon-green)]', 'font-medium');
      if (statusEl) statusEl.classList.add('hidden');
      generateCaptcha();
    };

    handle.addEventListener('pointerdown', (e) => {
      if (verified) return;
      isDragging = true;
      startX = e.clientX;
      const rect = handle.getBoundingClientRect();
      const trackRect = track.getBoundingClientRect();
      startHandleLeft = rect.left - trackRect.left;
      handle.setPointerCapture(e.pointerId);
      if (statusEl) statusEl.classList.add('hidden');
    });

    handle.addEventListener('pointermove', (e) => {
      if (!isDragging) return;
      const deltaX = e.clientX - startX;
      setSliderPosition(startHandleLeft + deltaX);
    });

    const handleEnd = (e) => {
      if (!isDragging) return;
      isDragging = false;
      const currentLeft = parseFloat(handle.style.left) || 0;
      const max = getMaxLeft();
      const pieceMax = CW - PW;
      const currentPieceX = max > 0 ? (currentLeft / max) * pieceMax : 0;
      if (Math.abs(currentPieceX - targetX) <= TOLERANCE) {
        completeSlider(currentLeft);
      } else {
        failSlider();
      }
      try { if (e && e.pointerId !== undefined) handle.releasePointerCapture(e.pointerId); } catch {}
    };

    handle.addEventListener('pointerup', handleEnd);
    handle.addEventListener('pointercancel', handleEnd);

    if (refreshBtn) {
      refreshBtn.addEventListener('click', () => {
        if (isDragging) return;
        resetSlider();
      });
    }

    return { reset: resetSlider, isVerified: () => verified };
  }

  window.initPuzzleSlider = initPuzzleSlider;

  // 可复用的“看图输入文字”验证码
  // 用法：
  //   const ctl = initTextCaptcha({
  //     canvas,            // 绘制验证码的 canvas
  //     input,             // 用户输入框
  //     refreshBtn,        // 刷新按钮（可选）
  //     statusEl,          // 状态提示（可选）
  //     onVerifiedChange,  // (verified:boolean) => void
  //     length             // 字符数，默认 4
  //   });
  //   ctl.reset()      重新生成
  //   ctl.isVerified() 当前是否已验证
  function initTextCaptcha(opts) {
    const { canvas, input, confirmBtn, refreshBtn, statusEl, onVerifiedChange, length = 4 } = opts || {};
    if (!canvas || !input) return null;

    const i18n = () => (window.translations && window.translations[window.currentLang]) || {};
    const notify = (v) => { if (typeof onVerifiedChange === 'function') onVerifiedChange(v); };
    const ctx = canvas.getContext('2d');
    const CW = canvas.width;
    const CH = canvas.height;

    // 去除易混淆字符（0/O、1/l/I 等）
    const CHARS = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
    const rand = (a, b) => a + Math.random() * (b - a);
    const pick = (s) => s.charAt(Math.floor(Math.random() * s.length));

    let answer = '';
    let verified = false;

    const generate = () => {
      answer = '';
      for (let i = 0; i < length; i++) answer += pick(CHARS);

      // 背景：浅色渐变
      const g = ctx.createLinearGradient(0, 0, CW, CH);
      g.addColorStop(0, `hsl(${Math.floor(Math.random() * 360)}, 25%, 90%)`);
      g.addColorStop(1, `hsl(${Math.floor(Math.random() * 360)}, 25%, 82%)`);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, CW, CH);

      // 干扰线
      for (let i = 0; i < 6; i++) {
        ctx.strokeStyle = `hsla(${Math.floor(Math.random() * 360)}, 70%, 50%, 0.45)`;
        ctx.lineWidth = rand(1, 2.5);
        ctx.beginPath();
        ctx.moveTo(rand(0, CW), rand(0, CH));
        ctx.lineTo(rand(0, CW), rand(0, CH));
        ctx.stroke();
      }

      // 干扰点
      for (let i = 0; i < 70; i++) {
        ctx.fillStyle = `rgba(0,0,0,${rand(0.05, 0.18)})`;
        ctx.beginPath();
        ctx.arc(rand(0, CW), rand(0, CH), rand(0.5, 1.6), 0, Math.PI * 2);
        ctx.fill();
      }

      // 字符：随机大小、颜色、旋转、上下偏移
      const step = CW / (length + 1);
      for (let i = 0; i < length; i++) {
        const ch = answer[i];
        const x = step * (i + 1);
        const y = CH / 2 + rand(-12, 12);
        const rot = rand(-0.35, 0.35);
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(rot);
        ctx.font = `bold ${Math.floor(rand(CH * 0.42, CH * 0.58))}px Georgia, "Times New Roman", serif`;
        ctx.fillStyle = `hsl(${Math.floor(Math.random() * 360)}, 65%, 38%)`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(ch, 0, 0);
        ctx.restore();
      }
    };

    const showStatus = (msg, type) => {
      if (!statusEl) return;
      statusEl.textContent = msg;
      statusEl.className = `absolute bottom-1 left-1/2 -translate-x-1/2 px-2 py-0.5 rounded text-[10px] z-10 ${type === 'ok' ? 'bg-[var(--neon-green)]/80 text-black' : 'bg-red-500/80 text-white'}`;
      statusEl.classList.remove('hidden');
    };

    const check = () => {
      if (verified) return;
      if (input.value.trim().toUpperCase() === answer) {
        verified = true;
        notify(true);
        input.disabled = true;
        if (confirmBtn) confirmBtn.disabled = true;
        const t = i18n();
        showStatus(t.text_captcha_ok || '验证成功', 'ok');
      }
    };

    const reset = () => {
      verified = false;
      notify(false);
      input.value = '';
      input.disabled = false;
      if (confirmBtn) confirmBtn.disabled = false;
      if (statusEl) statusEl.classList.add('hidden');
      generate();
    };

    // 有确认按钮时：仅在点击确认（或回车）时校验，不做输入时自动验证
    if (confirmBtn) {
      confirmBtn.addEventListener('click', check);
    } else {
      input.addEventListener('input', check);
    }
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') check(); });
    if (refreshBtn) refreshBtn.addEventListener('click', reset);

    generate();
    return { reset, isVerified: () => verified };
  }

  window.initTextCaptcha = initTextCaptcha;

  // 可复用的“声音验证”验证码（Web Speech API，朗读中/英文简单词汇）
  // 用法：
  //   const ctl = initAudioCaptcha({
  //     playBtn,           // 播放按钮
  //     input,             // 用户输入框
  //     confirmBtn,        // 确认按钮（可选）
  //     statusEl,          // 状态/提示（可选）
  //     onVerifiedChange   // (verified:boolean) => void
  //   });
  //   ctl.reset() / ctl.isVerified() / ctl.play()
  function initAudioCaptcha(opts) {
    const { playBtn, input, confirmBtn, statusEl, onVerifiedChange } = opts || {};
    if (!playBtn || !input) return null;

    const i18n = () => (window.translations && window.translations[window.currentLang]) || {};
    const notify = (v) => { if (typeof onVerifiedChange === 'function') onVerifiedChange(v); };
    const speechSupported = ('speechSynthesis' in window);

    // 纯中文 / 纯英文简单词汇（不混排），按当前语言选用
    const WORDS = {
      'zh-CN': ['苹果','西瓜','小猫','火车','太阳','月亮','学校','朋友','音乐','天空','大海','电脑','手机','红色','春天','老虎','兔子','星星','花朵','雨伞','金鱼','气球','白云','高山','书本','铅笔'],
      'en-US': ['apple','banana','cat','dog','sun','moon','book','tree','water','happy','blue','red','star','fish','bird','house','rain','snow','cake','milk','green','cloud']
    };

    let answer = '';
    let verified = false;

    const pickWord = () => {
      const list = WORDS[window.currentLang === 'zh-CN' ? 'zh-CN' : 'en-US'];
      return list[Math.floor(Math.random() * list.length)];
    };

    const generate = () => { answer = pickWord(); };

    const speak = () => {
      if (!speechSupported) {
        showStatus(i18n().audio_captcha_unsupported || '当前浏览器不支持语音播放', 'error');
        return;
      }
      const isZh = window.currentLang === 'zh-CN';
      const u = new SpeechSynthesisUtterance(answer);
      u.lang = isZh ? 'zh-CN' : 'en-US';
      u.rate = 0.9;
      u.pitch = 1;
      try { window.speechSynthesis.cancel(); window.speechSynthesis.speak(u); } catch (e) {}
    };

    const showStatus = (msg, type) => {
      if (!statusEl) return;
      if (!msg) { statusEl.textContent = ''; statusEl.classList.add('hidden'); return; }
      const colorCls = type === 'ok' ? 'text-[var(--neon-green)]' : (type === 'hint' ? 'text-zinc-400' : 'text-red-400');
      statusEl.textContent = msg;
      statusEl.className = `flex items-center justify-center text-center text-xs mb-3 ${colorCls}`;
      statusEl.classList.remove('hidden');
    };

    const check = () => {
      if (verified) return;
      const val = input.value.trim();
      if (!val) return;
      if (val.toLowerCase() === answer.toLowerCase()) {
        verified = true;
        notify(true);
        input.disabled = true;
        if (confirmBtn) confirmBtn.disabled = true;
        showStatus(i18n().text_captcha_ok || '验证成功', 'ok');
      }
    };

    const reset = () => {
      verified = false;
      notify(false);
      input.value = '';
      input.disabled = false;
      if (confirmBtn) confirmBtn.disabled = false;
      generate();
      if (!speechSupported) showStatus(i18n().audio_captcha_unsupported || '当前浏览器不支持语音播放', 'error');
      else showStatus('', 'hint'); // 提示已改为输入框 placeholder
    };

    playBtn.addEventListener('click', () => { if (!verified) speak(); });
    if (confirmBtn) confirmBtn.addEventListener('click', check);
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') check(); });

    generate();
    if (!speechSupported) showStatus(i18n().audio_captcha_unsupported || '当前浏览器不支持语音播放', 'error');
    else showStatus('', 'hint'); // 提示已改为输入框 placeholder

    return { reset, isVerified: () => verified, play: speak };
  }

  window.initAudioCaptcha = initAudioCaptcha;
})();
