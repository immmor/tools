(function createElegantAIChat() {
  const init = () => {
    if (document.getElementById('elegant-ai-container')) return;

    const style = document.createElement('style');
    style.textContent = `
      #elegant-ai-container {
        position: fixed; bottom: 30px; right: 30px; z-index: 2147483647;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif;
        --accent-color: #f97316;
      --bg-white: #ffffff;
      --text-main: #1f2937;
      --shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
      }

      /* 悬浮按钮 - 极简呼吸灯感 */
      #elegant-trigger { width: 56px; height: 56px; background: var(--accent-color);
        border-radius: 28px; cursor: grab; display: flex;
        align-items: center; justify-content: center;
        box-shadow: 0 10px 15px -3px rgba(124, 58, 237, 0.3);
        transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
        position: relative;
      }
      
      #elegant-trigger:hover { transform: translateY(-3px); box-shadow: 0 20px 25px -5px rgba(249, 115, 22, 0.4); }
      #elegant-trigger:active { cursor: grabbing; transform: scale(0.95); }

      #elegant-trigger svg { width: 24px; height: 24px; fill: white; transition: transform 0.4s; }
      .active #elegant-trigger svg { transform: rotate(90deg) scale(0.8); opacity: 0.8; }

      /* 聊天面板 - 优雅弧度与毛玻璃 */
      #elegant-panel {
        position: absolute; bottom: 75px; right: 0;
        width: 340px; height: 480px; background: var(--bg-white);
        border-radius: 24px; box-shadow: var(--shadow);
        display: none; flex-direction: column; overflow: hidden;
        transform: translateY(20px) scale(0.95); transform-origin: bottom right;
        opacity: 0; transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
      }

      #elegant-panel.open { display: flex; transform: translateY(0) scale(1); opacity: 1; }

      @media (max-width: 768px) {
        #elegant-panel {
          position: fixed; top: 50%; left: 50%;
          width: 90%; max-width: 340px; height: 80%; max-height: 480px;
          transform: translate(-50%, -50%) translateY(20px) scale(0.95); transform-origin: center;
        }

        #elegant-panel.open { transform: translate(-50%, -50%) translateY(0) scale(1); }
      }

      .header { padding: 20px 24px; display: flex; align-items: center; gap: 12px; border-bottom: 1px solid #f3f4f6; }
      .header-dot { width: 8px; height: 8px; background: #10b981; border-radius: 50%; box-shadow: 0 0 0 3px rgba(16, 185, 129, 0.1); }
      .header-title { font-weight: 600; font-size: 15px; color: var(--text-main); }

      #messages-flow { flex: 1; padding: 20px; overflow-y: auto; display: flex; flex-direction: column; gap: 16px; scrollbar-width: none; }
      #messages-flow::-webkit-scrollbar { display: none; }

      .bubble { padding: 12px 16px; font-size: 14px; line-height: 1.5; max-width: 85%; transition: all 0.3s; }
      .bubble.ai { background: #f3f4f6; color: var(--text-main); border-radius: 18px 18px 18px 4px; align-self: flex-start; }
      .bubble.user { background: var(--accent-color); color: white; border-radius: 18px 18px 4px 18px; align-self: flex-end; }

      .input-bar { padding: 16px 20px; display: flex; align-items: center; gap: 10px; background: white; border-top: 1px solid #f3f4f6; }
      #user-input { flex: 1; border: none; outline: none; font-size: 14px; color: var(--text-main); height: 36px; }
      #send-btn { color: var(--accent-color); font-weight: 600; cursor: pointer; font-size: 14px; padding: 8px 12px; border-radius: 8px; transition: background 0.2s, opacity 0.2s; }
      #send-btn:hover { background: rgba(249, 115, 22, 0.05); }
      #send-btn:disabled { opacity: 0.5; cursor: not-allowed; }

      .loading { padding: 12px 16px; font-size: 14px; color: #6b7280; background: #f3f4f6; border-radius: 18px 18px 18px 4px; align-self: flex-start; display: inline-flex; align-items: center; gap: 4px; }
      .dot { width: 6px; height: 6px; background: #9ca3af; border-radius: 50%; animation: wave 1s infinite ease-in-out; }
      .dot:nth-child(1) { animation-delay: -0.2s; }
      .dot:nth-child(2) { animation-delay: -0.1s; }
      .dot:nth-child(3) { animation-delay: 0s; }
      @keyframes wave { 0%, 100% { transform: translateY(0); opacity: 0.4; } 50% { transform: translateY(-2px); opacity: 1; } }

      /* 动画：消息弹出 */
      @keyframes slideUp { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
      .new-msg { animation: slideUp 0.3s ease-out forwards; }
    `;
    document.head.appendChild(style);

    const container = document.createElement('div');
    container.id = 'elegant-ai-container';
    container.innerHTML = `
      <div id="elegant-panel">
        <div class="header">
          <div class="header-dot"></div>
          <div class="header-title">小客服</div>
        </div>
        <div id="messages-flow">
          <div class="bubble ai">下午好。很高兴见到你，有什么我可以帮你的吗？</div>
        </div>
        <div class="input-bar">
          <input type="text" id="user-input" placeholder="输入消息..." autocomplete="off">
          <div id="send-btn">发送</div>
        </div>
      </div>
      <div id="elegant-trigger">
        <svg viewBox="0 0 24 24"><path d="M12 2C6.477 2 2 6.477 2 12c0 1.821.484 3.53 1.33 5.002L2 22l4.998-1.33A9.959 9.959 0 0012 22c5.523 0 10-4.477 10-10S17.523 2 12 2zm0 18c-1.476 0-2.886-.313-4.156-.878l-3.156.842.842-3.156A7.957 7.957 0 014 12c0-4.411 3.589-8 8-8s8 3.589 8 8-3.589 8-8 8z"/></svg>
      </div>
    `;
    document.body.appendChild(container);

    const panel = document.getElementById('elegant-panel');
    const input = document.getElementById('user-input');
    const trigger = document.getElementById('elegant-trigger');
    const flow = document.getElementById('messages-flow');

    let isDragging = false;
    let startX, startY, initialLeft, initialTop;

    trigger.onmousedown = (e) => {
      isDragging = true;
      startX = e.clientX;
      startY = e.clientY;
      
      const rect = trigger.getBoundingClientRect();
      const containerRect = container.getBoundingClientRect();
      
      initialLeft = rect.left - containerRect.left;
      initialTop = rect.top - containerRect.top;
      
      trigger.style.cursor = 'grabbing';
      trigger.style.transition = 'none';
      
      e.preventDefault();
    };

    document.onmousemove = (e) => {
      if (!isDragging) return;
      
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      
      trigger.style.transform = `translate(${initialLeft + dx}px, ${initialTop + dy}px)`;
    };

    document.onmouseup = () => {
      if (!isDragging) return;
      isDragging = false;
      
      const currentTransform = trigger.style.transform;
      trigger.style.transition = 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)';
      trigger.style.cursor = 'grab';
      
      if (currentTransform !== 'none') {
        const rect = trigger.getBoundingClientRect();
        const containerRect = container.getBoundingClientRect();
        
        const newX = rect.left - containerRect.left;
        const newY = rect.top - containerRect.top;
        
        trigger.style.transform = `translate(${newX}px, ${newY}px)`;
      }
    };

    trigger.onclick = () => {
      if (isDragging) return;
      const isOpen = panel.classList.toggle('open');
      container.classList.toggle('active');
      if (isOpen) {
        panel.style.display = 'flex';
        setTimeout(() => input.focus(), 200);
      } else {
        setTimeout(() => { if(!panel.classList.contains('open')) panel.style.display = 'none'; }, 400);
      }
    };

    const pushMessage = (role, text) => {
      const b = document.createElement('div');
      b.className = `bubble ${role} new-msg`;
      b.textContent = text;
      flow.appendChild(b);
      flow.scrollTop = flow.scrollHeight;
    };

    const messages = [];
    let messageCount = 0;

    const callAPI = async (messages) => {
      document.getElementById('send-btn').disabled = true;

      const loading = document.createElement('div');
      loading.className = 'bubble ai new-msg loading';
      loading.innerHTML = '<span class="dot"></span><span class="dot"></span><span class="dot"></span>';
      flow.appendChild(loading);
      flow.scrollTop = flow.scrollHeight;

      try {
        const response = await fetch('https://mrok.dpdns.org/v1/chat/completions', {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'Authorization': 'Bearer AIzaSyCPD3zr473D24gY9edkIabdFMQR80YIqmQ'
          },
          body: JSON.stringify({
            model: 'gemini-flash-latest',
            messages: messages,
            stream: false,
            options: { temperature: 0.7, max_tokens: -1 }
          })
        });

        if (!response.ok) throw new Error('API 请求失败');
        const data = await response.json();
        return data.choices[0].message.content;
      } catch (error) {
        console.error('API 调用错误:', error);
        return '抱歉，服务暂时不可用。请确保 ollama_server.py 已启动。';
      } finally {
        flow.removeChild(loading);
        document.getElementById('send-btn').disabled = false;
      }
    };

    const handleSend = async () => {
      const val = input.value.trim();
      if (!val) return;
      pushMessage('user', val);
      messages.push({ role: 'user', content: val });
      input.value = '';
      messageCount++;

      const aiResponse = await callAPI(messages);
      pushMessage('ai', aiResponse);
      messages.push({ role: 'assistant', content: aiResponse });
      messageCount++;

      if (messageCount % 20 === 0) {
        messages.splice(0, 2);
        messageCount = 0;
        pushMessage('ai', '⚠️ 对话历史已重置，为保证流畅体验，我只记得最近 10 轮对话。');
      }
    };

    document.getElementById('send-btn').onclick = handleSend;
    input.onkeydown = (e) => { if(e.key === 'Enter' && !document.getElementById('send-btn').disabled) handleSend(); };
  };

  if (document.body) init(); else window.addEventListener('DOMContentLoaded', init);
})();