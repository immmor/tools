(function () {
  'use strict';

  // ---------- 客服后端 / Supabase 实时配置（与 vpn qa.js / account cs.js 同源）----------
  const SUPPORT_API = 'https://api.funbua.uk';
  const SUPABASE_URL = 'https://imuopmivywtlzzlwgtmi.supabase.co';
  const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImltdW9wbWl2eXd0bHp6bHdndG1pIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTkxNzM0MjMsImV4cCI6MjA3NDc0OTQyM30.ItR-A59_dHmfM2eECU3ENeJxGpATPz_hnQaTwAoKQaM';

  // ---------- 仅聊天面板专用的少量样式 ----------
  const style = document.createElement('style');
  style.textContent = `
    #csChatPanel .cs-msg { animation: csPop .18s ease-out; }
    @keyframes csPop { from { opacity:0; transform: translateY(6px);} to {opacity:1; transform:none;} }
    #csChatPanel .cs-scroll::-webkit-scrollbar { width:6px; }
    #csChatPanel .cs-scroll::-webkit-scrollbar-thumb { background:#e5e7eb; border-radius:3px; }
  `;
  document.head.appendChild(style);

  // ---------- 构建面板 DOM ----------
  const panel = document.createElement('div');
  panel.id = 'csChatPanel';
  panel.className = 'hidden fixed bottom-4 right-4 z-[60] w-[340px] h-[480px] max-h-[80vh] max-w-[calc(100vw-2rem)] bg-white rounded-xl shadow-2xl shadow-swiss-red/10 border border-slate-200 flex flex-col overflow-hidden';
  panel.innerHTML = `
    <div class="flex items-center justify-between px-4 h-14 bg-swiss-red text-white shrink-0">
      <div>
        <div class="flex items-center gap-2">
          <span class="w-2 h-2 rounded-full bg-white/90 animate-pulse"></span>
          <div class="text-[13px] font-bold tracking-wide font-mono">SMSVerify 客服</div>
        </div>
        <div id="csStatus" class="text-[10px] text-white/80 h-3 leading-3"></div>
      </div>
      <button id="csClose" class="text-white/80 hover:text-white text-xl leading-none">&times;</button>
    </div>
    <div id="csMessages" class="cs-scroll flex-1 overflow-y-auto px-3 py-3 space-y-3 bg-slate-50"></div>
    <div id="csQuick" class="flex flex-wrap gap-1.5 px-3 pb-2 bg-slate-50"></div>
    <div class="flex gap-2 p-3 border-t border-slate-100 bg-white">
      <input id="csInput" type="text" placeholder="输入您的问题，客服会实时回复…" class="flex-1 min-w-0 px-3 h-9 rounded-lg border border-slate-200 text-sm outline-none focus:border-swiss-red">
      <button id="csSend" class="shrink-0 px-4 h-9 rounded-lg bg-swiss-red hover:bg-swiss-hoverRed text-white text-sm font-bold transition-colors">发送</button>
    </div>
  `;
  document.body.appendChild(panel);

  const messagesEl = panel.querySelector('#csMessages');
  const inputEl = panel.querySelector('#csInput');
  const quickEl = panel.querySelector('#csQuick');
  const statusEl = panel.querySelector('#csStatus');

  // ---------- 工具函数 ----------
  const escapeHtml = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  function addMsg(text, who) {
    const row = document.createElement('div');
    row.className = 'cs-msg flex ' + (who === 'user' ? 'justify-end' : 'justify-start');
    const bubble = document.createElement('div');
    bubble.className = 'max-w-[80%] px-3 py-2 rounded-2xl text-[13px] leading-relaxed ' +
      (who === 'user' ? 'bg-swiss-red text-white rounded-br-sm' : 'bg-white border border-slate-200 text-slate-800 rounded-bl-sm shadow-sm');
    bubble.innerHTML = escapeHtml(text);
    row.appendChild(bubble);
    messagesEl.appendChild(row);
    messagesEl.scrollTop = messagesEl.scrollHeight;
    return row;
  }

  const setStatus = (t) => { statusEl.textContent = t || ''; };

  // ---------- 当前会话身份：登录用户取用户名，否则用稳定的匿名 ID ----------
  const LOGIN_OBF_KEY = 'PHANTOM_LOGIN_OBF_KEY_2024';
  function deobfuscateLoginToken(b64) {
    try {
      const bin = atob(b64);
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      const key = new TextEncoder().encode(LOGIN_OBF_KEY);
      const out = new Uint8Array(bytes.length);
      for (let i = 0; i < bytes.length; i++) out[i] = bytes[i] ^ key[i % key.length];
      return new TextDecoder().decode(out);
    } catch (e) { return ''; }
  }
  function getAnonId() {
    let id = localStorage.getItem('anonSupportId');
    if (!id) {
      const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
      let s = '';
      for (let i = 0; i < 5; i++) s += chars[Math.floor(Math.random() * chars.length)];
      id = '匿名用户' + s;
      localStorage.setItem('anonSupportId', id);
    }
    return id;
  }
  function getSupportUsername() {
    // smsverify 登录态存于 smsverify_token；兼容 account 的 p_token
    const tok = localStorage.getItem('smsverify_token') || localStorage.getItem('p_token');
    if (tok) {
      try {
        const obj = JSON.parse(deobfuscateLoginToken(tok));
        if (obj.u && obj.u.username) return obj.u.username;
      } catch (e) {}
    }
    return getAnonId();
  }

  // ---------- 本地历史持久化（按会话身份分桶，重载后可续聊）----------
  const storeKey = () => 'cs_chat_' + getSupportUsername();
  const loadMsgs = () => { try { return JSON.parse(localStorage.getItem(storeKey()) || '[]'); } catch (e) { return []; } };
  const saveMsg = (text, who) => {
    const arr = loadMsgs();
    arr.push({ text, who });
    try { localStorage.setItem(storeKey(), JSON.stringify(arr.slice(-50))); } catch (e) {}
  };

  // ---------- Supabase 实时回复（优先）；未配置则回落 15s 轮询 ----------
  let supabaseClient = null;
  let replyChannel = null;
  const shownReplyIds = new Set();
  let leaveSubmittedAt = null;
  let replyPollTimer = null;
  let replyPollCount = 0;
  const REPLY_POLL_INTERVAL = 15000;
  const REPLY_POLL_MAX = 8;

  const getSupabase = async () => {
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return null;
    if (!supabaseClient) {
      try {
        const { createClient } = await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm');
        supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
      } catch (e) { return null; }
    }
    return supabaseClient;
  };

  const startReplyListening = async () => {
    const username = getSupportUsername();
    if (!username || !leaveSubmittedAt) return;
    const sb = await getSupabase();
    if (sb) {
      replyChannel = sb.channel(`support-${username}`)
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'support_messages' }, (payload) => {
          const row = payload.new;
          if (row.username !== username || row.from_role !== 'agent' || shownReplyIds.has(row.id)) return;
          shownReplyIds.add(row.id);
          addMsg(row.content, 'agent');
          saveMsg(row.content, 'agent');
          setStatus('');
          fetch(`${SUPPORT_API}/api/messages/read`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, messageId: row.id })
          }).catch(() => {});
        })
        .subscribe();
    } else {
      startReplyPolling();
    }
  };
  const stopReplyListening = () => {
    stopReplyPolling();
    if (replyChannel) { replyChannel.unsubscribe?.(); replyChannel = null; }
  };

  const pollSupportReplies = async () => {
    const username = getSupportUsername();
    if (!username || !leaveSubmittedAt) return;
    replyPollCount++;
    try {
      const res = await fetch(`${SUPPORT_API}/api/messages?username=${encodeURIComponent(username)}`);
      const data = await res.json();
      const list = (data && data.data && data.data.messages) || [];
      let gotReply = false;
      list.forEach((m) => {
        if (shownReplyIds.has(m.id)) return;
        const date = new Date(String(m.created_at).replace(' ', 'T') + 'Z');
        if (date < leaveSubmittedAt) return;
        shownReplyIds.add(m.id);
        addMsg(m.content, 'agent');
        saveMsg(m.content, 'agent');
        gotReply = true;
        fetch(`${SUPPORT_API}/api/messages/read`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ messageId: m.id, username })
        }).catch(() => {});
      });
      if (gotReply) setStatus('');
      if (gotReply || replyPollCount >= REPLY_POLL_MAX) { leaveSubmittedAt = null; stopReplyPolling(); }
    } catch (e) { /* 下一轮继续 */ }
  };
  const startReplyPolling = () => {
    if (replyPollTimer) return;
    pollSupportReplies();
    replyPollTimer = setInterval(pollSupportReplies, REPLY_POLL_INTERVAL);
  };
  const stopReplyPolling = () => { if (replyPollTimer) { clearInterval(replyPollTimer); replyPollTimer = null; } };

  // ---------- 发送：转发给真人客服，并开启实时收消息 ----------
  async function send(text) {
    const v = (text != null ? text : inputEl.value).trim();
    if (!v) return;
    addMsg(v, 'user');
    saveMsg(v, 'user');
    inputEl.value = '';
    setStatus('客服正在查看，请稍候…');

    const username = getSupportUsername();
    const payload = `[联系客服对话消息] 用户: ${username}\n内容: ${v}`;
    try {
      await Promise.all([
        fetch(`${SUPPORT_API}/api/send-message`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content: payload, target: 'single', username: 'admin' })
        }),
        fetch(`${SUPPORT_API}/api/send-message`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content: payload, target: 'single', username: 'immmor' })
        })
      ]);
      const sb = await getSupabase();
      if (sb) await sb.from('support_messages').insert({ username, from_role: 'user', content: v });
    } catch (e) { /* 静默，轮询/实时仍会兜底 */ }

    leaveSubmittedAt = new Date();
    replyPollCount = 0;
    startReplyListening();
  }

  // ---------- 快捷问题（点击即作为消息发给客服）----------
  ['如何租赁号码？', '收不到验证码', '如何充值？', '申请退款'].forEach((q) => {
    const b = document.createElement('button');
    b.className = 'px-2.5 h-7 rounded-full border border-slate-200 text-[11px] text-slate-600 hover:border-swiss-red hover:text-swiss-red transition-colors';
    b.textContent = q;
    b.addEventListener('click', () => send(q));
    quickEl.appendChild(b);
  });

  // ---------- 开关 ----------
  let greeted = false;
  function restoreHistory() {
    const arr = loadMsgs();
    if (arr.length) {
      arr.forEach((m) => addMsg(m.text, m.who));
      greeted = true;
    }
  }
  window.openCsChat = function () {
    panel.classList.remove('hidden');
    if (!greeted) {
      addMsg('您好，这里是 SMSVerify 在线客服。请留下您的问题，客服会实时为您回复～', 'agent');
      greeted = true;
    }
    // 已有未结会话则继续监听客服回复
    if (leaveSubmittedAt) startReplyListening();
    setTimeout(() => inputEl.focus(), 50);
  };
  window.toggleCsChat = function () {
    if (panel.classList.contains('hidden')) window.openCsChat();
    else window.closeCsChat();
  };
  window.closeCsChat = function () { panel.classList.add('hidden'); };

  panel.querySelector('#csClose').addEventListener('click', window.closeCsChat);
  panel.querySelector('#csSend').addEventListener('click', () => send());
  inputEl.addEventListener('keydown', (e) => { if (e.key === 'Enter') send(); });

  // 页面关闭时释放 Supabase 订阅
  window.addEventListener('beforeunload', stopReplyListening);

  // 初始化：恢复历史会话
  restoreHistory();

  // ---------- 绑定 nav 上的「客服」按钮 ----------
  const navBtn = document.getElementById('csBtn');
  if (navBtn) navBtn.addEventListener('click', (e) => { e.preventDefault(); window.openCsChat(); });
})();
