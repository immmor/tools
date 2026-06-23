// 世界杯竞猜前端逻辑（支持多场）
(function () {
  const API_BASE = 'https://api.immmor.com';
  let selectedBet = null;   // { matchId, choice, odds }
  let allMatches = [];

  const $ = (id) => document.getElementById(id);

  function getUserInfo() {
    try { return JSON.parse(localStorage.getItem('userInfo') || 'null'); } catch (e) { return null; }
  }

  // i18n 辅助：从全局翻译字典取值
  function t(key) {
    try {
      if (typeof translations !== 'undefined' && translations[currentLang] && translations[currentLang][key]) {
        return translations[currentLang][key];
      }
    } catch (e) {}
    return key;
  }

  // 将 UTC 时间字符串转为用户本地时区显示
  function toLocalTime(utcStr) {
    if (!utcStr) return '';
    try {
      const d = new Date(utcStr.replace(/-/g, '/').replace('T', ' ').replace('Z', '') + 'Z');
      if (isNaN(d.getTime())) return utcStr;
      return d.toLocaleString([], { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
    } catch (e) { return utcStr; }
  }

  function getBeijingTodayStartTs() {
    try {
      const s = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Shanghai' });
      const [y, m, d] = s.split('-');
      const dt = new Date(`${y}/${m}/${d} 00:00:00 GMT+0800`);
      return dt.getTime();
    } catch (e) {
      const now = new Date();
      const y = now.getFullYear();
      const m = String(now.getMonth() + 1).padStart(2, '0');
      const d = String(now.getDate()).padStart(2, '0');
      return new Date(`${y}/${m}/${d} 00:00:00 GMT+0800`).getTime();
    }
  }

  // 国家名称中文到 key 的映射（用于翻译）
  const countryKeyMap = {
    '墨西哥': 'country_mexico', '南非': 'country_south_africa', '韩国': 'country_korea',
    '捷克': 'country_czech', '加拿大': 'country_canada', '波黑': 'country_bosnia',
    '卡塔尔': 'country_qatar', '瑞士': 'country_switzerland', '巴西': 'country_brazil',
    '摩洛哥': 'country_morocco', '海地': 'country_haiti', '苏格兰': 'country_scotland',
    '美国': 'country_usa', '巴拉圭': 'country_paraguay', '澳大利亚': 'country_australia',
    '土耳其': 'country_turkey', '德国': 'country_germany', '库拉索': 'country_curacao',
    '科特迪瓦': 'country_ivory_coast', '厄瓜多尔': 'country_ecuador', '荷兰': 'country_netherlands',
    '日本': 'country_japan', '瑞典': 'country_sweden', '突尼斯': 'country_tunisia',
    '比利时': 'country_belgium', '埃及': 'country_egypt', '伊朗': 'country_iran',
    '新西兰': 'country_new_zealand', '西班牙': 'country_spain', '佛得角': 'country_cape_verde',
    '沙特阿拉伯': 'country_saudi_arabia', '乌拉圭': 'country_uruguay', '法国': 'country_france',
    '塞内加尔': 'country_senegal', '伊拉克': 'country_iraq', '挪威': 'country_norway',
    '阿根廷': 'country_argentina', '阿尔及利亚': 'country_algeria', '奥地利': 'country_austria',
    '约旦': 'country_jordan', '葡萄牙': 'country_portugal', '刚果': 'country_congo',
    '乌兹别克斯坦': 'country_uzbekistan', '哥伦比亚': 'country_colombia', '英格兰': 'country_england',
    '克罗地亚': 'country_croatia', '加纳': 'country_ghana', '巴拿马': 'country_panama'
  };
  function translateCountry(name) {
    if (!name) return name;
    const key = countryKeyMap[name.trim()];
    return key ? t(key) : name;
  }

  // 将 a/draw/b 转为翻译后的主胜/平局/客胜
  function translateChoice(choice) {
    if (!choice) return '';
    return t(choiceLabelKey[choice]) || choice;
  }

  function formatMatchResult(m) {
    if (m.score) return m.score;
    if (m.status === 'settled' && m.result) return translateChoice(m.result);
    return '';
  }

  const statusMap = {
    open: { textKey: 'fb_status_open', color: 'var(--neon-green)' },
    closed: { textKey: 'fb_status_closed', color: '#888' },
    settled: { textKey: 'fb_status_settled', color: 'var(--neon-blue)' }
  };
  const choiceLabelKey = { a: 'fb_win_label', draw: 'fb_draw_label', b: 'fb_lose_label' };
  const choiceColor = { a: 'var(--neon-green)', draw: 'var(--neon-blue)', b: 'var(--neon-orange)' };

  // 渲染单场比赛卡片（用于轮播）
  function renderMatchCard(m) {
    const st = statusMap[m.status] || statusMap.open;
    const canBet = m.status === 'open' && !m._started;
    const scoreText = formatMatchResult(m) || (m.matchTime ? '' : 'VS');
    // 状态标签：已开始 > 原状态
    const displayStatus = (m.status === 'open' && m._started) ? { text: t('fb_status_live'), color: 'var(--neon-red)' } : { text: t(st.textKey), color: st.color };

    return `
      <div class="match-slide" data-match-id="${m.id}">
        <div class="fb-match-card">
          <!-- 头部：状态 + 时间 -->
          <div class="flex justify-between items-center mb-2">
            <span class="text-[10px] px-2 py-0.5 rounded font-bold tracking-wider" style="background: ${displayStatus.color}15; color: ${displayStatus.color}; border: 1px solid ${displayStatus.color}30;">${displayStatus.text}</span>
            ${m._displayTime ? `<span class="text-[10px] font-mono text-zinc-500">${m._displayTime}</span>` : ''}
          </div>

          <!-- 队伍 vs -->
          <div class="fb-vs-row">
            <div class="fb-team">
              <div class="fb-team-flag">${m.flagA || '🏴'}</div>
              <div class="fb-team-name">${translateCountry(m.teamA)}</div>
            </div>
            <div class="fb-vs-score">
              <div class="fb-vs-score-val" style="color: ${m.result ? (choiceColor[m.result] || '#666') : '#555'};">${scoreText || '-'}</div>
            </div>
            <div class="fb-team">
              <div class="fb-team-flag">${m.flagB || '🇦🇷'}</div>
              <div class="fb-team-name">${translateCountry(m.teamB)}</div>
            </div>
          </div>

          <!-- 下注选项 -->
          <div class="fb-bet-grid" data-bet-options="${m.id}">
            <button class="bet-option ${canBet ? '' : 'disabled'}"
                    data-match-id="${m.id}" data-bet="a">
              <div class="bet-option-label">${t('fb_home')}</div>
              <div class="bet-option-odds">${m.oddsA}</div>
            </button>
            <button class="bet-option ${canBet ? '' : 'disabled'}"
                    data-match-id="${m.id}" data-bet="draw">
              <div class="bet-option-label">${t('fb_draw')}</div>
              <div class="bet-option-odds">${m.oddsDraw}</div>
            </button>
            <button class="bet-option ${canBet ? '' : 'disabled'}"
                    data-match-id="${m.id}" data-bet="b">
              <div class="bet-option-label">${t('fb_away')}</div>
              <div class="bet-option-odds">${m.oddsB}</div>
            </button>
          </div>
        </div>
      </div>
    `;
  }

  let currentSlide = 0;
  let selectedDate = '';

  function formatDateLabel(key) {
    if (!key) return '-';
    const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Shanghai' });
    const [y, mo, d] = key.split('-');
    const text = new Date(`${y}/${mo}/${d} 00:00:00 GMT+0800`).toLocaleDateString([], { month: '2-digit', day: '2-digit' });
    return key === today ? `${t('fb_today')} ${text}` : text;
  }

  function updateDateSelect() {
    const sel = $('fb-match-select');
    if (!sel) return;
    const dates = [...new Set(allMatches.map(m => m._dateKey).filter(Boolean))].sort();
    if (!dates.length) { sel.innerHTML = ''; sel.classList.add('hidden'); return; }
    if (!dates.includes(selectedDate)) {
      const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Shanghai' });
      selectedDate = dates.includes(today) ? today : dates[0];
    }
    sel.classList.remove('hidden');
    sel.innerHTML = dates.map(d => `<option value="${d}">${formatDateLabel(d)}</option>`).join('');
    sel.value = selectedDate;
    sel.disabled = dates.length <= 1;
  }

  function renderSlider() {
    const container = $('football-matches');
    if (!container) return;
    const list = allMatches.filter(m => m._dateKey === selectedDate);
    if (!list.length) {
      container.innerHTML = `<p class="text-zinc-500 text-sm text-center py-6">${t('fb_no_matches')}</p>`;
      return;
    }

    currentSlide = list.findIndex(m => !m._started || m.status === 'open');
    if (currentSlide < 0) currentSlide = 0;
    const total = list.length;
    const showArrows = total > 1;

    container.innerHTML = `
      <div id="fb-slider-wrap">
        ${showArrows ? `<button id="fb-prev"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M15 18l-6-6 6-6"/></svg></button>` : ''}
        <div id="fb-slider-track" class="overflow-hidden rounded-lg">
          <div id="fb-slides">${list.map(renderMatchCard).join('')}</div>
        </div>
        ${showArrows ? `<button id="fb-next"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M9 18l6-6-6-6"/></svg></button>` : ''}
      </div>`;

    container.querySelectorAll('.bet-option').forEach(btn => {
      btn.addEventListener('click', () => handleSelectBet(parseInt(btn.dataset.matchId), btn.dataset.bet, btn));
    });

    if (!showArrows) return;
    updateSlider();
    $('fb-prev').addEventListener('click', () => { currentSlide = (currentSlide - 1 + total) % total; updateSlider(); });
    $('fb-next').addEventListener('click', () => { currentSlide = (currentSlide + 1) % total; updateSlider(); });
    let touchStartX = 0;
    container.querySelector('#fb-slider-track').addEventListener('touchstart', e => { touchStartX = e.changedTouches[0].screenX; }, { passive: true });
    container.querySelector('#fb-slider-track').addEventListener('touchend', e => {
      const diff = touchStartX - e.changedTouches[0].screenX;
      if (Math.abs(diff) > 50) {
        currentSlide = diff > 0 ? Math.min(currentSlide + 1, total - 1) : Math.max(currentSlide - 1, 0);
        updateSlider();
      }
    }, { passive: true });
  }

  // 加载比赛列表并渲染（轮播模式）
  async function loadMatches() {
    try {
      const res = await fetch(`${API_BASE}/api/football/match`);
      const data = await res.json();
      if (!data.success) return;

      allMatches = data.matches || [];
      const container = $('football-matches');
      if (!container) return;

      if (allMatches.length === 0) {
        container.innerHTML = `<p class="text-zinc-500 text-sm text-center py-6">${t('fb_no_matches')}</p>`;
        updateDateSelect();
        return;
      }

      // 解析比赛时间（统一北京时间 UTC+8 判断，显示转本地时区）
      const now = Date.now();
      allMatches.forEach(m => {
        let ts = Infinity;
        if (m.matchTime) {
          const d = new Date(m.matchTime.replace(/-/g, '/') + ' GMT+0800');
          if (!isNaN(d.getTime())) ts = d.getTime();
        }
        m._ts = ts;
        m._started = m._ts <= now;
        // 显示时间转为用户本地时区
        if (m.matchTime && !isNaN(ts)) {
          const bjDate = new Date(m.matchTime.replace(/-/g, '/') + ' GMT+0800');
          m._displayTime = bjDate.toLocaleString([], { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
          m._dateKey = bjDate.toLocaleDateString('en-CA', { timeZone: 'Asia/Shanghai' });
        } else {
          m._displayTime = m.matchTime || '';
          m._dateKey = '';
        }
      });

      const showUntilTs = getBeijingTodayStartTs() + 2 * 86400000 - 1;
      allMatches = allMatches.filter(m => m._ts === Infinity || m._ts <= showUntilTs);

      if (allMatches.length === 0) {
        container.innerHTML = `<p class="text-zinc-500 text-sm text-center py-6">${t('fb_no_matches')}</p>`;
        updateDateSelect();
        return;
      }

      allMatches.sort((a, b) => {
        if (a.status === 'settled' && b.status !== 'settled') return 1;
        if (b.status === 'settled' && a.status !== 'settled') return -1;
        if (a.status === 'closed' && b.status !== 'closed') return 1;
        if (b.status === 'closed' && a.status !== 'closed') return -1;
        return a._ts - b._ts;
      });

      updateDateSelect();
      renderSlider();
      loadHistory();

    } catch (e) {
      console.error('加载比赛失败:', e);
    }
  }

  function updateSlider() {
    const slidesEl = $('fb-slides');
    if (slidesEl) slidesEl.style.transform = `translateX(-${currentSlide * 100}%)`;
  }

  // 选择下注选项
  function handleSelectBet(matchId, choice, btnEl) {
    const match = allMatches.find(m => m.id == matchId);
    if (!match) return;

    // 比赛已开始则禁止下注
    if (match._started) {
      alert(t('fb_alert_started') || 'Match has started');
      return;
    }

    if (match.status !== 'open') { alert(t('fb_alert_closed') || 'Betting is closed'); return; }

    const oddsMap = { a: 'oddsA', draw: 'oddsDraw', b: 'oddsB' };
    selectedBet = { matchId, choice, odds: parseFloat(match[oddsMap[choice]]) };

    // 清除所有选中态，只高亮当前
    document.querySelectorAll('.bet-option.selected').forEach(b => b.classList.remove('selected'));
    btnEl.classList.add('selected');

    // 显示下注面板
    const panel = $('football-bet-panel');
    if (panel) panel.classList.remove('hidden');
    if ($('bet-selected-text')) {
      $('bet-selected-text').textContent =
        `${translateCountry(match.teamA)} vs ${translateCountry(match.teamB)} · ${translateChoice(choice)} @${selectedBet.odds}x`;
    }
    updatePotentialWin();
  }

  // 实时计算预期收益
  function updatePotentialWin() {
    const el = $('bet-potential-win');
    if (!el || !selectedBet) return;
    const amt = parseFloat($('bet-amount')?.value) || 0;
    el.textContent = amt > 0 ? `${t('fb_potential')} ¥${Math.floor(amt * selectedBet.odds)}` : '';
  }

  // 提交下注
  async function submitBet() {
    const user = getUserInfo();
    if (!user || !user.username) { alert(t('fb_alert_login') || 'Please login first'); return; }
    if (!selectedBet) { alert(t('fb_alert_select') || 'Please select an option'); return; }

    const amtInput = $('bet-amount');
    const amount = parseFloat(amtInput?.value);
    if (!amount || amount < 1) { alert(t('fb_alert_amount') || 'Enter valid amount (min 1)'); return; }

    const submitBtn = $('btn-submit-bet');
    if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = t('fb_submitting') || 'Submitting...'; }

    try {
      const res = await fetch(`${API_BASE}/api/football/bet`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: user.username,
          password: user.password || '',
          choice: selectedBet.choice,
          amount: amount,
          matchId: selectedBet.matchId
        })
      });
      const data = await res.json();

      if (data.success) {
        alert(data.message);
        cancelBet();
        loadMatches();
        if (typeof updateBalanceDisplay === 'function') updateBalanceDisplay();
      } else {
        alert(data.message || (t('fb_alert_bet_fail') || 'Bet failed'));
      }
    } catch (e) {
      alert(t('fb_alert_network') || 'Network error, please retry');
    } finally {
      if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = t('fb_bet_now'); }
    }
  }

  function cancelBet() {
    selectedBet = null;
    document.querySelectorAll('.bet-option.selected').forEach(b => b.classList.remove('selected'));
    const panel = $('football-bet-panel');
    if (panel) panel.classList.add('hidden');
    const amtInput = $('bet-amount');
    if (amtInput) amtInput.value = '';
  }

  // 加载历史记录
  async function loadHistory() {
    const user = getUserInfo();
    if (!user || !user.username) {
      // 未登录时隐藏记录区域并清空内容
      const listEl = $('football-bet-list');
      if (listEl) listEl.innerHTML = '';
      if ($('football-my-bets')) $('football-my-bets').classList.add('hidden');
      return;
    }

    try {
      const res = await fetch(`${API_BASE}/api/football/history`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: user.username, password: user.password || '' })
      });
      const data = await res.json();
      const myBets = (data.bets || []).filter(bet => bet.username === user.username);
      if (!data.success || myBets.length === 0) return;

      const listEl = $('football-bet-list');
      if (!listEl) return;
      listEl.innerHTML = '';

      myBets.forEach(bet => {
        const div = document.createElement('div');
        div.className = `bet-item ${bet.status}`;
        const mi = bet.matchInfo;
        const matchStr = mi ? `${translateCountry(mi.teamA)} vs ${translateCountry(mi.teamB)}` : `#${bet.match_id}`;
        const choiceStr = translateChoice(bet.choice);
        const resultSuffix = (mi && mi.status === 'settled' && mi.result)
          ? ` · ${t('fb_match_result')}: ${translateChoice(mi.result)}`
          : '';
        const statusTag = bet.status === 'win'
          ? `<span class="font-bold" style="color: var(--neon-green);">+¥${bet.payout}</span>`
          : bet.status === 'lose'
            ? `<span style="color: #666;">${t('fb_lose_result')}</span>`
            : `<span style="color: var(--neon-blue);">${t('fb_pending_result')}</span>`;

        div.innerHTML = `
          <div>
            <div class="font-mono text-zinc-300">${matchStr}</div>
            <div class="text-[10px] text-zinc-500 mt-0.5">${choiceStr} · ¥${bet.amount} × ${bet.odds}x${resultSuffix}</div>
          </div>
          <div class="text-right">
            <div>${statusTag}</div>
            <div class="text-[10px] text-zinc-600 mt-0.5">${toLocalTime(bet.created_at)}</div>
          </div>
        `;
        listEl.appendChild(div);
      });

      if ($('football-my-bets')) $('football-my-bets').classList.remove('hidden');
    } catch (e) {
      console.error('加载记录失败:', e);
    }
  }

  function init() {
    const submitBtn = $('btn-submit-bet');
    if (submitBtn) submitBtn.addEventListener('click', submitBet);

    const cancelBtn = $('btn-cancel-bet');
    if (cancelBtn) cancelBtn.addEventListener('click', cancelBet);

    const amtInput = $('bet-amount');
    if (amtInput) {
      amtInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') submitBet(); });
      amtInput.addEventListener('input', updatePotentialWin);
    }

    const selectEl = $('fb-match-select');
    if (selectEl) selectEl.addEventListener('change', () => { selectedDate = selectEl.value; cancelBet(); renderSlider(); });

    loadMatches();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  window.FootballModule = { loadMatches, loadHistory };
})();
