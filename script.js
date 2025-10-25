(function(){
  // 每次推送時更新此五碼（手動或由腳本自動更新）
  const BUILD_CODE = 'M8P2Y';
  const dom = {
    views: Array.from(document.querySelectorAll('.view')),
    navLinks: Array.from(document.querySelectorAll('.nav-link')),
    startBtn: document.getElementById('startQuestBtn'),
    year: document.getElementById('year'),
    // Home / Level / XP
    currentLevelLabel: document.getElementById('currentLevelLabel'),
    xpFill: document.getElementById('xpFill'),
    xpText: document.getElementById('xpText'),
    // Practice metrics
    wpmDisplay: document.getElementById('wpmDisplay'),
    accuracyDisplay: document.getElementById('accuracyDisplay'),
    charsDisplay: document.getElementById('charsDisplay'),
    levelReqText: document.getElementById('levelReqText'),
    // Practice area
    targetBox: document.getElementById('targetBox'),
    progressFill: document.getElementById('progressFill'),
    typingInput: document.getElementById('typingInput'),
    startPracticeBtn: document.getElementById('startPracticeBtn'),
    languageFilter: document.getElementById('languageFilter'),
    difficultyFilter: document.getElementById('difficultyFilter'),
    passageItems: document.getElementById('passageItems'),
    // Levels view
    levelText: document.getElementById('levelText'),
    levelFill: document.getElementById('levelFill'),
    levelNotes: document.getElementById('levelNotes'),
    // Rewards
    rewardsGrid: document.getElementById('rewardsGrid'),
    // Settings
    darkModeToggle: document.getElementById('darkModeToggle'),
    resetBtn: document.getElementById('resetProgressBtn'),
    // Confetti
    confettiCanvas: document.getElementById('confettiCanvas'),
    submitBtn: document.getElementById('submitBtn'),
    resultModal: document.getElementById('resultModal'),
    resultContent: document.getElementById('resultContent'),
    closeModalBtn: document.getElementById('closeModalBtn')
  };

  // -------------------------
  // 狀態與常數
  // -------------------------
  const STORAGE_KEY = 'tmq_state_v1';
  // XP 階級（只保留 XP，不再使用等級條件）
  const XP_TIERS = [100, 150, 200, 300, 350, 400];

  const state = loadState() || {
    xp: 0,
    tierIndex: 0, // 0~5 對應 XP_TIERS
    xpToNext: XP_TIERS[0],
    completedPassages: {}, // { passageId: true }
    rewardsUnlocked: {}, // { rewardId: true }
    theme: 'light',
    highScores: [] // { id, wpm, accuracy, chars, date }
  };

  let passages = [];
  let rewards = {};
  // 後備英文段落（若載入 JSON 失敗時使用）
  const DEFAULT_EN_PASSAGES = [
    { id:'e1-01', level:1, difficulty:'beginner', lang:'en', title:'Morning Routine', preview:'I wake up early and brew a warm cup of tea', text:'I wake up early and brew a warm cup of tea. The quiet kitchen feels like a tiny harbor before the day begins. I stretch, breathe slowly, and plan a simple to-do list.' },
    { id:'e2-01', level:2, difficulty:'intermediate', lang:'en', title:'City Walk at Noon', preview:'At noon, the city hums with energy and chatter', text:'At noon, the city hums with energy and chatter. I walk past a park where children play tag, and a street musician plays a bright tune. I grab a sandwich and sit on a sunny bench.' },
    { id:'e3-01', level:3, difficulty:'advanced', lang:'en', title:'The Library in Rain', preview:'Rain taps on the old library windows as readers settle', text:'Rain taps on the old library windows as readers settle into cozy corners. Pages turn like gentle waves, and the air smells of paper and time. I find a well-worn book, underline a thoughtful line, and feel quietly renewed.' }
  ];
  let selectedPassage = null;
  let startTime = 0;
  let endTime = 0;
  let typedChars = 0;
  let correctChars = 0;
  let lastCalcAt = 0;
  let progressTimer = null;

  // -------------------------
  // 初始化
  // -------------------------
  init();

  function init(){
    dom.year.textContent = new Date().getFullYear();
    applyTheme(state.theme);
    renderLevelXP();
    bindNav();
    bindSettings();
    bindPractice();
    lazyLoadData();
    setVersionTag();
  }

  function bindNav(){
    dom.navLinks.forEach(btn=>{
      btn.addEventListener('click',()=>{
        const target = btn.getAttribute('data-target');
        switchView(target);
        dom.navLinks.forEach(b=>b.classList.toggle('active', b===btn));
      });
    });
    if(dom.startBtn){
      dom.startBtn.addEventListener('click',()=>{
        switchView('#practice');
        dom.navLinks.forEach(b=>b.classList.toggle('active', b.getAttribute('data-target')==='#practice'));
        setTimeout(()=>dom.typingInput.focus(), 50);
      });
    }
  }

  function setVersionTag(){
    const el = document.getElementById('versionText');
    if(!el) return;
    el.textContent = BUILD_CODE;
  }

  function switchView(selector){
    dom.views.forEach(v=>v.classList.remove('active'));
    const el = document.querySelector(selector);
    if(el){ el.classList.add('active'); }
  }

  function bindSettings(){
    dom.darkModeToggle.checked = state.theme === 'dark';
    dom.darkModeToggle.addEventListener('change',()=>{
      state.theme = dom.darkModeToggle.checked ? 'dark' : 'light';
      applyTheme(state.theme);
      saveState();
    });
    dom.resetBtn.addEventListener('click',()=>{
      if(confirm('確定要重置所有進度嗎？此動作無法復原。')){
        localStorage.removeItem(STORAGE_KEY);
        location.reload();
      }
    });
  }

  function applyTheme(theme){
    if(theme==='dark'){
      document.documentElement.setAttribute('data-theme','dark');
    }else{
      document.documentElement.removeAttribute('data-theme');
    }
  }

  function lazyLoadData(){
    // 延遲載入 passages 與 rewards（避免快取）
    fetch('./passages.json', { cache: 'no-store' })
      .then(r=>{
        if(!r.ok) throw new Error('passages.json load failed: '+r.status);
        return r.json();
      })
      .then(data=>{
        if(!Array.isArray(data) || !data.length) throw new Error('empty passages');
        passages = data;
        renderPassageList();
      })
      .catch(err=>{
        console.error('[TypeMaster] passages load error', err);
        passages = DEFAULT_EN_PASSAGES;
        renderPassageList();
      });
    fetch('./rewards.json', { cache: 'no-store' }).then(r=>r.json()).then(data=>{
      rewards = data;
      renderRewards();
    }).catch(()=>{ rewards = {}; });
  }

  // -------------------------
  // 練習邏輯
  // -------------------------
  function bindPractice(){
    // 語言固定為英文，不再提供切換；若元素不存在則不綁定
    if(dom.languageFilter){
      dom.languageFilter.addEventListener('change',()=>{
        renderPassageList();
      });
    }
    if(dom.difficultyFilter){
      dom.difficultyFilter.addEventListener('change',()=>{
        renderPassageList();
      });
    }
    
    // 禁用複製貼上功能
    dom.typingInput.addEventListener('paste', (e) => {
      e.preventDefault();
      return false;
    });
    dom.typingInput.addEventListener('copy', (e) => {
      e.preventDefault();
      return false;
    });
    dom.typingInput.addEventListener('cut', (e) => {
      e.preventDefault();
      return false;
    });
    
    dom.typingInput.addEventListener('input', debounce(handleTyping, 16));
    dom.typingInput.addEventListener('keydown', ()=>{
      if(!startTime || dom.typingInput.disabled){ return; }
      if(!lastCalcAt){ lastCalcAt = performance.now(); }
    });
    if(dom.startPracticeBtn){
      dom.startPracticeBtn.addEventListener('click',()=>startPractice());
    }
    if(dom.submitBtn){
      dom.submitBtn.addEventListener('click',()=>{
        if(dom.submitBtn.disabled || !selectedPassage) return;
        // 只有在送出時才結算（finalize 內會顯示結算彈窗）
        finalizeAndScore(lastResult || { wpm:0, accuracy:0, chars:0 });
      });
    }
    if(dom.closeModalBtn){
      dom.closeModalBtn.addEventListener('click',()=>hideResultModal());
    }
  }

  function renderPassageList(){
    const lang = 'en';
    const diff = dom.difficultyFilter ? dom.difficultyFilter.value : 'all';
    const list = passages.filter(p=>{
      const okLang = !p.lang || p.lang===lang;
      const okDiff = diff==='all' || p.difficulty===diff;
      return okLang && okDiff;
    });
    dom.passageItems.innerHTML = '';
    list.forEach(p=>{
      const li = document.createElement('li');
      li.className = 'passage-item' + (selectedPassage && selectedPassage.id===p.id ? ' active': '');
      li.innerHTML = `<div><strong>${escapeHtml(p.title)}</strong></div><div style="font-size:12px;color:#6b7280">${escapeHtml(p.preview || p.text.slice(0,26))}…</div>`;
      li.addEventListener('click',()=>selectPassage(p));
      dom.passageItems.appendChild(li);
    });
    if(!selectedPassage && list[0]) selectPassage(list[0]);
    if(!list.length){
      // 若仍為空，顯示提示
      const li = document.createElement('li');
      li.className = 'passage-item';
      li.textContent = 'No passages available.';
      dom.passageItems.appendChild(li);
    }
  }

  function selectPassage(passage){
    selectedPassage = passage;
    renderTargetText(passage.text);
    resetTypingStats();
    dom.passageItems.querySelectorAll('.passage-item').forEach((el)=>{
      el.classList.remove('active');
    });
    // 高亮當前選項
    const idx = Array.from(dom.passageItems.children).findIndex(li=>li.querySelector('strong')?.textContent===passage.title);
    if(idx>=0){ dom.passageItems.children[idx].classList.add('active'); }
    dom.typingInput.focus();
  }

  function renderTargetText(text){
    const frag = document.createDocumentFragment();
    Array.from(text).forEach((ch)=>{
      const span = document.createElement('span');
      span.textContent = ch;
      frag.appendChild(span);
    });
    dom.targetBox.innerHTML='';
    dom.targetBox.appendChild(frag);
  }

  function resetTypingStats(){
    startTime = 0; endTime = 0; typedChars = 0; correctChars = 0; lastCalcAt = 0;
    dom.wpmDisplay.textContent = '0';
    dom.accuracyDisplay.textContent = '100%';
    dom.charsDisplay.textContent = '0';
    dom.progressFill.style.width = '0%';
    dom.typingInput.value = '';
    if(dom.submitBtn){ dom.submitBtn.disabled = true; }
    if(dom.typingInput){ dom.typingInput.disabled = true; }
  }

  function startPractice(){
    resetTypingStats();
    startTime = performance.now();
    if(dom.typingInput){ dom.typingInput.disabled = false; dom.typingInput.focus(); }
  }

  function handleTyping(){
    if(!selectedPassage) return;
    const input = dom.typingInput.value;
    const target = selectedPassage.text;
    const minLen = Math.min(input.length, target.length);
    typedChars = input.length;

    // 字元比對與高亮
    const spans = dom.targetBox.childNodes;
    correctChars = 0;
    for(let i=0;i<spans.length;i++){
      const span = spans[i];
      const targetChar = target[i] ?? '';
      const inputChar = input[i] ?? null;
      if(inputChar===null){
        span.className = '';
      }else if(inputChar===targetChar){
        span.className = 'correct';
        correctChars++;
      }else{
        span.className = 'wrong';
      }
    }

    const accuracy = typedChars===0 ? 100 : Math.max(0, Math.round((correctChars/typedChars)*100));
    dom.accuracyDisplay.textContent = accuracy + '%';
    dom.charsDisplay.textContent = String(typedChars);

    // 進度
    const progress = Math.min(100, Math.round((minLen/target.length)*100));
    dom.progressFill.style.width = progress + '%';

    // WPM 計算
    const now = performance.now();
    const elapsedMin = startTime ? (now - startTime) / 60000 : 0;
    const grossWpm = elapsedMin>0 ? Math.round((typedChars/5) / elapsedMin) : 0;
    dom.wpmDisplay.textContent = String(grossWpm);

    // 完成檢查
    if(typedChars>=target.length){
      endTime = performance.now();
      onFinish({ wpm: grossWpm, accuracy, chars: typedChars, ms: Math.max(0, Math.round(endTime - startTime)) });
    }
  }

  let lastResult = null;
  function onFinish(result){
    // 記錄分數
    state.highScores.push({ id: selectedPassage.id, ...result, date: new Date().toISOString() });
    if(state.highScores.length>50) state.highScores.shift();

    // 僅完成輸入，暫不給分；待送出時 finalize
    lastResult = result;
    if(dom.submitBtn){ dom.submitBtn.disabled = false; }
  }

  function finalizeAndScore(result){
    // 依難度給予 XP
    const diff = selectedPassage?.difficulty || 'beginner';
    const XP_BY_DIFF = { beginner: 10, intermediate: 15, advanced: 25 };
    const earnedXp = XP_BY_DIFF[diff] ?? 10;

    // 當前等級需求，用於是否計入升級判定
    // 以 XP 模式不再檢查 WPM/準確率門檻，只以 XP 提升階級
    const reach = true;

    // 統計完成數並標記本篇完成
    state.completedPassages[selectedPassage.id] = true;
    const leveledByXp = gainXp(earnedXp);

    // 不再依靠完成篇數升級

    saveState();
    renderLevelXP();
    renderRewards();

    // 結算資訊：解鎖與下一獎勵（改顯示在彈窗）
    const unlockedList = Object.keys(state.rewardsUnlocked||{}).filter(k=>state.rewardsUnlocked[k]);
    const lastUnlockedKey = unlockedList[unlockedList.length-1];
    const lastUnlockedName = lastUnlockedKey ? (rewards[lastUnlockedKey]?.name || lastUnlockedKey) : '—';

    // 依 XP 模式：距離下一獎勵以 XP 計
    const nextRewardKey = 'level'+(state.tierIndex+1);
    const nextRewardName = rewards[nextRewardKey]?.name || nextRewardKey;

    // 顯示在彈窗
    const remainXp = Math.max(0, (state.xpToNext||0) - (state.xp||0));
    showResultModal({ ...result, xp: earnedXp, diff, unlockedName: lastUnlockedName, nextRewardName, remainXp });
    // 送出後清除輸入
    if(dom.typingInput){ dom.typingInput.value=''; dom.typingInput.disabled = true; }
  }

  function showResultModal(data){
    const ms = data.ms ?? (endTime && startTime ? Math.max(0, Math.round(endTime - startTime)) : 0);
    const seconds = (ms/1000).toFixed(2);
    const bestMsKey = 'tmq_best_ms';
    const prevBest = Number(localStorage.getItem(bestMsKey) || 0);
    let best = prevBest>0 ? prevBest : 0;
    if(ms>0 && (best===0 || ms<best)){
      best = ms; localStorage.setItem(bestMsKey, String(best));
    }
    const bestSeconds = best>0 ? (best/1000).toFixed(2) : '-';
    dom.resultContent.innerHTML = `
      <div>段落：<strong>${escapeHtml(selectedPassage.title)}</strong></div>
      <div>WPM：<strong>${data.wpm}</strong> · 準確率：<strong>${data.accuracy}%</strong> · 字元數：<strong>${data.chars}</strong></div>
      <div>本次時間：<strong>${seconds}s</strong> · 最佳時間：<strong>${bestSeconds}s</strong></div>
      <div>難度：<strong>${escapeHtml(data.diff||selectedPassage.difficulty||'beginner')}</strong> · 本次 XP：<strong>${data.xp ?? '-'}</strong></div>
      <div>解鎖獎勵：<strong>${escapeHtml(data.unlockedName||'—')}</strong> · 距離下一個獎勵（${escapeHtml(data.nextRewardName||'level'+(state.tierIndex+1))}）還差：<strong>${data.remainXp ?? 0}</strong> XP</div>
    `;
    dom.resultModal.hidden = false;
  }
  function hideResultModal(){
    dom.resultModal.hidden = true;
  }

  function gainXp(x){
    state.xp += x;
    let leveled = false;
    while(state.xp>=state.xpToNext && state.tierIndex < XP_TIERS.length){
      state.xp -= state.xpToNext;
      state.tierIndex = Math.min(state.tierIndex + 1, XP_TIERS.length - 1);
      state.xpToNext = XP_TIERS[state.tierIndex];
      leveled = true;
      // 觸發升階：更新介面與獎勵解鎖
      levelUp();
    }
    return leveled;
  }

  function levelUp(){
    saveState();
    renderLevelXP();
    setTimeout(renderLevelXP, 0);
    flashNote(`恭喜晉升 XP 級距 ${state.tierIndex+1}！`);
    celebrate();
    // tierIndex 1 -> 解鎖 level1，以此類推
    unlockRewardForLevel(state.tierIndex);
  }

  function unlockRewardForLevel(level){
    // level 對應 rewards.json 的 key（level1 = 綠芽）
    const key = 'level'+level;
    const r = rewards[key];
    if(!r) return;
    state.rewardsUnlocked[key] = true;
  }

  function renderLevelXP(){
    dom.currentLevelLabel.textContent = 'XP Tier ' + (state.tierIndex+1);
    const percent = Math.round((state.xp/state.xpToNext)*100);
    dom.xpFill.style.width = percent + '%';
    dom.xpText.textContent = `${state.xp} / ${state.xpToNext} XP`;
    if(dom.levelText){ dom.levelText.textContent = String(state.tierIndex+1); }
    if(dom.levelFill){ dom.levelFill.style.width = percent + '%'; }
    dom.levelReqText.textContent = `下一級需累積：${state.xpToNext} XP`;
  }

  function renderRewards(){
    dom.rewardsGrid.innerHTML = '';
    const entries = Object.entries(rewards);
    entries.forEach(([key, r])=>{
      const card = document.createElement('div');
      card.className = 'reward-card';
      const unlocked = !!state.rewardsUnlocked[key];
      card.innerHTML = `
        <div style="font-size:28px;color:${unlocked?'#4CAF50':'#9CA3AF'};text-align:center">
          <i class="fa-solid ${iconForReward(r)}"></i>
        </div>
        <div class="reward-name">${escapeHtml(r.name || key)}</div>
        <div class="reward-type">${escapeHtml(r.type || '其他')} · ${unlocked?'已解鎖':'未解鎖'}</div>
        <div style="font-size:12px;color:#6b7280">${escapeHtml(r.description || '')}</div>
      `;
      dom.rewardsGrid.appendChild(card);
    });
  }

  function iconForReward(r){
    switch(r.type){
      case 'badge': return 'fa-leaf';
      case 'theme': return 'fa-palette';
      case 'currency': return 'fa-star';
      case 'audio': return 'fa-microphone';
      default: return 'fa-gift';
    }
  }

  // -------------------------
  // 視覺與動畫
  // -------------------------
  function flashNote(text){
    const div = document.createElement('div');
    div.textContent = text;
    Object.assign(div.style,{
      position:'fixed',left:'50%',top:'18px',transform:'translateX(-50%)',
      background:'#141a1b',color:'#fff',padding:'10px 14px',borderRadius:'999px',
      boxShadow:'0 10px 30px rgba(0,0,0,.25)',zIndex:50,opacity:'0',transition:'opacity .2s, transform .2s'
    });
    document.body.appendChild(div);
    requestAnimationFrame(()=>{
      div.style.opacity='1';
      div.style.transform='translateX(-50%) translateY(0)';
    });
    setTimeout(()=>{
      div.style.opacity='0';
      div.style.transform='translateX(-50%) translateY(-6px)';
      setTimeout(()=>div.remove(),220);
    }, 1600);
  }

  function celebrate(){
    // 簡易彩帶動畫（不依賴外部庫）
    const ctx = dom.confettiCanvas.getContext('2d');
    const { width, height } = dom.confettiCanvas;
    dom.confettiCanvas.width = innerWidth; dom.confettiCanvas.height = innerHeight;
    const particles = Array.from({length:120}).map(()=>({
      x: Math.random()*innerWidth,
      y: -20 - Math.random()*200,
      r: 3+Math.random()*4,
      vx: -1+Math.random()*2,
      vy: 2+Math.random()*3,
      color: `hsl(${Math.random()*360},80%,60%)`,
      life: 0
    }));
    let running = true;
    const start = performance.now();
    (function loop(){
      if(!running) return;
      ctx.clearRect(0,0,dom.confettiCanvas.width,dom.confettiCanvas.height);
      particles.forEach(p=>{
        p.x += p.vx; p.y += p.vy; p.vy += 0.03; p.life += 1;
        ctx.fillStyle = p.color;
        ctx.beginPath(); ctx.arc(p.x,p.y,p.r,0,Math.PI*2); ctx.fill();
      });
      if(performance.now()-start<2000){
        requestAnimationFrame(loop);
      }else{
        running = false; ctx.clearRect(0,0,dom.confettiCanvas.width,dom.confettiCanvas.height);
      }
    })();
  }

  // -------------------------
  // 儲存
  // -------------------------
  function loadState(){
    try{
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : null;
    }catch(e){ return null; }
  }
  function saveState(){
    try{ localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }catch(e){}
  }

  // -------------------------
  // 工具
  // -------------------------
  function debounce(fn, wait){
    let t; return function(){ clearTimeout(t); t = setTimeout(()=>fn.apply(this, arguments), wait); };
  }
  function escapeHtml(str){
    return String(str).replace(/[&<>"]/g, function(s){
      return ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[s]);
    });
  }
})();