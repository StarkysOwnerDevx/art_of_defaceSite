(function() {
  let currentUser = null;
  let viewingUser = null;
  let users = [];
  let allDefaces = {}; 

  function loadFromStorage() {
    const storedUsers = localStorage.getItem('artdeface_users');
    if (storedUsers) {
      try {
        users = JSON.parse(storedUsers);
      } catch(e) { users = []; }
    } else {
      users = [];
    }
    
    const storedDefaces = localStorage.getItem('artdeface_defaces');
    if (storedDefaces) {
      try {
        allDefaces = JSON.parse(storedDefaces);
      } catch(e) { allDefaces = {}; }
    } else {
      allDefaces = {};
    }
    
    const storedSession = localStorage.getItem('artdeface_session');
    if (storedSession) {
      try {
        const session = JSON.parse(storedSession);
        if (session.expires > Date.now() && users.find(u => u.username === session.username)) {
          currentUser = session.username;
        } else {
          localStorage.removeItem('artdeface_session');
        }
      } catch(e) {}
    }
    
    checkUrlForUser();
    updateUI();
    renderAll();
  }

  function saveUsers() {
    localStorage.setItem('artdeface_users', JSON.stringify(users));
  }

  function saveDefaces() {
    localStorage.setItem('artdeface_defaces', JSON.stringify(allDefaces));
  }

  function saveSession() {
    if (currentUser) {
      localStorage.setItem('artdeface_session', JSON.stringify({
        username: currentUser,
        expires: Date.now() + (30 * 24 * 60 * 60 * 1000)
      }));
    } else {
      localStorage.removeItem('artdeface_session');
    }
  }

  function checkUrlForUser() {
    const params = new URLSearchParams(window.location.search);
    const userParam = params.get('user');
    if (userParam) {
      viewingUser = userParam;
      document.getElementById('profileNavBtn').style.display = 'inline-flex';
      if (currentUser) {
        document.getElementById('loginNavBtn').style.display = 'none';
      } else {
        document.getElementById('loginNavBtn').style.display = 'inline-flex';
      }
    } else {
      viewingUser = null;
      document.getElementById('profileNavBtn').style.display = currentUser ? 'inline-flex' : 'none';
      document.getElementById('loginNavBtn').style.display = currentUser ? 'none' : 'inline-flex';
    }
  }

  function getUserDefaces(username) {
    return allDefaces[username] || [];
  }

  function addUserDeface(username, deface) {
    if (!allDefaces[username]) allDefaces[username] = [];
    allDefaces[username].unshift(deface);
    saveDefaces();
  }

  function updateUI() {
    const loginNav = document.getElementById('loginNavBtn');
    const profileNav = document.getElementById('profileNavBtn');
    
    if (currentUser) {
      if (loginNav) loginNav.style.display = 'none';
      if (profileNav) profileNav.style.display = 'inline-flex';
    } else {
      if (loginNav) loginNav.style.display = 'inline-flex';
      if (profileNav) profileNav.style.display = 'none';
    }
    
    if (viewingUser && !currentUser) {
      document.querySelector('[data-page="profile"]').click();
    }
  }

  function renderHome() {
    const tbody = document.getElementById('homeTableBody');
    if (!tbody) return;
    
    let allEntries = [];
    for (const username in allDefaces) {
      allEntries.push(...allDefaces[username]);
    }
    allEntries.sort((a,b) => b.timestampMs - a.timestampMs);
    const recent = allEntries.slice(0,5);
    
    if (recent.length === 0) {
      tbody.innerHTML = '<tr class="empty-row"><td colspan="4">no defaces yet</td></tr>';
      return;
    }
    
    let html = '';
    for (const e of recent) {
      const domain = extractDomain(e.url);
      html += `<tr><td class="team-cell">${escapeHtml(e.teamDisplay)}</td><td>${escapeHtml(e.hacker)}</td>${domainWithIcon(domain, e.url, e.isSpecial)}<td><span class="mirror-link" data-url="${escapeHtml(e.url)}" data-domain="${escapeHtml(domain)}" data-hacker="${escapeHtml(e.hacker)}" data-team="${escapeHtml(e.teamDisplay)}">mirror</span></td></tr>`;
    }
    tbody.innerHTML = html;
    attachMirrorEvents();
  }

  function renderArchives() {
    const tbody = document.getElementById('archivesTableBody');
    const totalSpan = document.getElementById('totalCount');
    if (!tbody) return;
    
    let entries = [];
    for (const username in allDefaces) {
      entries.push(...allDefaces[username]);
    }
    entries.sort((a,b) => b.timestampMs - a.timestampMs);
    
    const searchTerm = document.getElementById('searchInput')?.value.toLowerCase() || '';
    let filtered = entries;
    if (searchTerm) {
      filtered = entries.filter(e => e.hacker.toLowerCase().includes(searchTerm) || e.teamDisplay.toLowerCase().includes(searchTerm) || e.url.toLowerCase().includes(searchTerm));
    }
    
    if (totalSpan) totalSpan.textContent = entries.length;
    const resultSpan = document.getElementById('searchResultCount');
    if (resultSpan) resultSpan.textContent = filtered.length !== entries.length ? `(showing ${filtered.length})` : '';
    
    if (filtered.length === 0) {
      tbody.innerHTML = '<tr class="empty-row"><td colspan="4">no defaces found</td></tr>';
      return;
    }
    
    let html = '';
    for (const e of filtered) {
      const domain = extractDomain(e.url);
      html += `<tr><td class="team-cell">${escapeHtml(e.teamDisplay)}</td><td>${escapeHtml(e.hacker)}</td>${domainWithIcon(domain, e.url, e.isSpecial)}<td><span class="mirror-link" data-url="${escapeHtml(e.url)}" data-domain="${escapeHtml(domain)}" data-hacker="${escapeHtml(e.hacker)}" data-team="${escapeHtml(e.teamDisplay)}">mirror</span></td></tr>`;
    }
    tbody.innerHTML = html;
    attachMirrorEvents();
  }

  function renderRanked() {
    const tbody = document.getElementById('rankedTableBody');
    if (!tbody) return;
    
    const now = Date.now();
    const lastReset = localStorage.getItem('artdeface_last_reset');
    let resetTime = lastReset ? parseInt(lastReset) : new Date().setHours(0,0,0,0);
    
    if (now - resetTime >= 24*60*60*1000) {
      localStorage.removeItem('artdeface_ranked_stats');
      localStorage.setItem('artdeface_last_reset', now.toString());
      resetTime = now;
    }
    
    let hackerStats = {};
    const storedStats = localStorage.getItem('artdeface_ranked_stats');
    if (storedStats) {
      hackerStats = JSON.parse(storedStats);
    }
    
    let entries = [];
    for (const username in allDefaces) {
      entries.push(...allDefaces[username]);
    }
    
    const todayStart = resetTime;
    const todayEntries = entries.filter(e => e.timestampMs > todayStart);
    
    for (const e of todayEntries) {
      const name = e.hacker.toLowerCase();
      hackerStats[name] = (hackerStats[name] || 0) + 1;
    }
    
    localStorage.setItem('artdeface_ranked_stats', JSON.stringify(hackerStats));
    
    const top = Object.entries(hackerStats).sort((a,b)=>b[1]-a[1]).slice(0,10);
    
    if (top.length === 0) {
      tbody.innerHTML = '<tr class="empty-row"><td colspan="3">no data available</td></tr>';
      return;
    }
    
    let html = '';
    for (let i=0; i<top.length; i++) {
      html += `<tr><td>#${i+1}</td><td>${escapeHtml(top[i][0])}</td><td>${top[i][1]}</td></tr>`;
    }
    tbody.innerHTML = html;
    
    const tomorrow = new Date(resetTime + 24*60*60*1000);
    const diff = tomorrow - now;
    const hours = Math.floor(diff/3600000);
    const minutes = Math.floor((diff%3600000)/60000);
    const seconds = Math.floor((diff%60000)/1000);
    const timer = document.getElementById('resetTimer');
    if (timer) timer.textContent = `${hours.toString().padStart(2,'0')}:${minutes.toString().padStart(2,'0')}:${seconds.toString().padStart(2,'0')}`;
  }

  function renderProfiles() {
    const tbody = document.getElementById('profilesTableBody');
    const totalSpan = document.getElementById('totalHackersCount');
    if (!tbody) return;
    
    const hackerMap = new Map();
    for (const username in allDefaces) {
      for (const e of allDefaces[username]) {
        const hacker = e.hacker;
        if (!hackerMap.has(hacker)) {
          hackerMap.set(hacker, { hacker, team: e.teamDisplay === 'Anonymous' ? '-' : e.teamDisplay, count: 0, lastTimestamp: 0 });
        }
        const profile = hackerMap.get(hacker);
        profile.count++;
        if (e.timestampMs > profile.lastTimestamp) {
          profile.lastTimestamp = e.timestampMs;
          profile.team = e.teamDisplay === 'Anonymous' ? '-' : e.teamDisplay;
        }
      }
    }
    
    const profiles = Array.from(hackerMap.values()).sort((a,b) => b.count - a.count);
    if (totalSpan) totalSpan.textContent = profiles.length;
    
    if (profiles.length === 0) {
      tbody.innerHTML = '<tr class="empty-row"><td colspan="4">no hackers yet</td></tr>';
      return;
    }
    
    let html = '';
    for (const p of profiles) {
      const lastDate = p.lastTimestamp ? new Date(p.lastTimestamp).toLocaleDateString() : '-';
      html += `<tr><td>${escapeHtml(p.hacker)}</td><td>${escapeHtml(p.team)}</td><td>${p.count}</td><td>${lastDate}</td></tr>`;
    }
    tbody.innerHTML = html;
  }

  function renderProfile() {
    const tbody = document.getElementById('profileTableBody');
    const countSpan = document.getElementById('userDefaceCount');
    const shareInput = document.getElementById('shareLinkInput');
    
    const username = viewingUser || currentUser;
    
    if (shareInput) {
      const url = `${window.location.origin}${window.location.pathname}?user=${encodeURIComponent(username)}`;
      shareInput.value = url;
    }
    
    if (!username) {
      if (tbody) tbody.innerHTML = '<tr class="empty-row"><td colspan="4">no user selected</td></tr>';
      if (countSpan) countSpan.textContent = '0';
      return;
    }
    
    const defaces = getUserDefaces(username);
    if (countSpan) countSpan.textContent = defaces.length;
    
    if (defaces.length === 0) {
      tbody.innerHTML = '<tr class="empty-row"><td colspan="4">no defaces yet</td></tr>';
      return;
    }
    
    let html = '';
    for (const e of defaces) {
      const domain = extractDomain(e.url);
      html += `<tr><td class="team-cell">${escapeHtml(e.teamDisplay)}</td><td>${escapeHtml(e.hacker)}</td>${domainWithIcon(domain, e.url, e.isSpecial)}<td><span class="mirror-link" data-url="${escapeHtml(e.url)}" data-domain="${escapeHtml(domain)}" data-hacker="${escapeHtml(e.hacker)}" data-team="${escapeHtml(e.teamDisplay)}">mirror</span></td></tr>`;
    }
    tbody.innerHTML = html;
    attachMirrorEvents();
  }

  function renderAll() {
    renderHome();
    renderArchives();
    renderRanked();
    renderProfiles();
    renderProfile();
  }

  function isSpecialDomain(url) {
    const specialTLDs = ['.com.br','.gov','.gov.br','.it','.edu','.edu.br','.org','.org.br','.net','.mil','.mil.br'];
    return specialTLDs.some(tld => url.toLowerCase().includes(tld));
  }

  function extractDomain(url) {
    try {
      const urlObj = new URL(url);
      let hostname = urlObj.hostname;
      if (hostname.startsWith('www.')) hostname = hostname.substring(4);
      return hostname;
    } catch { return url; }
  }

  function domainWithIcon(domain, url, isSpecial) {
    const starHtml = isSpecial ? '<span class="star">*</span>' : '';
    const icon = `<svg class="domain-icon" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>`;
    return `<td class="domain-cell">${starHtml}<span style="display:inline-flex;align-items:center;gap:4px;">${icon}<a href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(domain)}</a></span></td>`;
  }

  function getIpInfo(domain) {
    return fetch(`https://cloudflare-dns.com/dns-query?name=${domain}&type=A`, { headers: { 'Accept': 'application/dns-json' } }).then(res=>res.json()).catch(()=>null);
  }

  function getCountryCode(ip) {
    return fetch(`https://ipapi.co/${ip}/json/`).then(res=>res.json()).catch(()=>null);
  }

  function getFlag(countryCode) {
    const flags = { 'US':'US','BR':'BR','GB':'GB','DE':'DE','FR':'FR','IT':'IT','ES':'ES','PT':'PT','NL':'NL','RU':'RU','CN':'CN','JP':'JP','AU':'AU','CA':'CA','IN':'IN' };
    return flags[countryCode] || 'XX';
  }

  function showMirrorModal(url, domain, hacker, team) {
    const modal = document.getElementById('mirrorModal');
    const mirrorInfo = document.getElementById('mirrorInfo');
    mirrorInfo.innerHTML = '<div class="mirror-loading">loading mirror information...</div>';
    modal.style.display = 'block';
    const timestamp = new Date().toLocaleString();
    getIpInfo(domain).then(dnsData => {
      let ip = 'unable to resolve', country = 'Unknown', flag = 'XX';
      if (dnsData && dnsData.Answer && dnsData.Answer.length > 0) {
        ip = dnsData.Answer[0].data;
        getCountryCode(ip).then(geoData => {
          if (geoData && geoData.country_name) { country = geoData.country_name; flag = getFlag(geoData.country_code || 'XX'); }
          renderMirror();
        }).catch(()=>renderMirror());
      } else { renderMirror(); }
      function renderMirror() {
        mirrorInfo.innerHTML = `<div class="mirror-info-row"><span class="mirror-label">date</span><span class="mirror-value">${escapeHtml(timestamp)}</span></div>
          <div class="mirror-info-row"><span class="mirror-label">system</span><span class="mirror-value">Linux</span></div>
          <div class="mirror-info-row"><span class="mirror-label">hacker</span><span class="mirror-value">${escapeHtml(hacker)}</span></div>
          <div class="mirror-info-row"><span class="mirror-label">team</span><span class="mirror-value">${escapeHtml(team)}</span></div>
          <div class="mirror-info-row"><span class="mirror-label">ip address</span><span class="mirror-value">${escapeHtml(ip)}</span></div>
          <div class="mirror-info-row"><span class="mirror-label">country</span><span class="mirror-value"><span class="flag-icon">${flag}</span> <span class="country-name">${escapeHtml(country)}</span></span></div>
          <div class="mirror-info-row"><span class="mirror-label">domain</span><span class="mirror-value"><a href="${escapeHtml(url)}" target="_blank">${escapeHtml(domain)}</a></span></div>
          <div class="mirror-info-row"><span class="mirror-label">preview</span><iframe class="preview-frame" src="${escapeHtml(url)}" sandbox="allow-same-origin allow-scripts allow-popups allow-forms" referrerpolicy="no-referrer" title="mirror preview"></iframe></div>
          <div class="mirror-info-row"><span class="mirror-label">note</span><span class="mirror-value">this mirror is for archival purposes only</span></div>`;
      }
    }).catch(()=>{
      mirrorInfo.innerHTML = `<div class="mirror-info-row"><span class="mirror-label">date</span><span class="mirror-value">${escapeHtml(timestamp)}</span></div>
        <div class="mirror-info-row"><span class="mirror-label">system</span><span class="mirror-value">Linux</span></div>
        <div class="mirror-info-row"><span class="mirror-label">hacker</span><span class="mirror-value">${escapeHtml(hacker)}</span></div>
        <div class="mirror-info-row"><span class="mirror-label">team</span><span class="mirror-value">${escapeHtml(team)}</span></div>
        <div class="mirror-info-row"><span class="mirror-label">ip address</span><span class="mirror-value">unable to resolve</span></div>
        <div class="mirror-info-row"><span class="mirror-label">country</span><span class="mirror-value"><span class="flag-icon">XX</span> Unknown</span></div>
        <div class="mirror-info-row"><span class="mirror-label">domain</span><span class="mirror-value"><a href="${escapeHtml(url)}" target="_blank">${escapeHtml(domain)}</a></span></div>
        <div class="mirror-info-row"><span class="mirror-label">preview</span><iframe class="preview-frame" src="${escapeHtml(url)}" sandbox="allow-same-origin allow-scripts allow-popups allow-forms" referrerpolicy="no-referrer" title="mirror preview"></iframe></div>`;
    });
  }

  function attachMirrorEvents() {
    document.querySelectorAll('.mirror-link').forEach(el => {
      el.removeEventListener('click', mirrorHandler);
      el.addEventListener('click', mirrorHandler);
    });
  }
  function mirrorHandler(e) {
    const url = e.currentTarget.getAttribute('data-url');
    const domain = e.currentTarget.getAttribute('data-domain');
    const hacker = e.currentTarget.getAttribute('data-hacker');
    const team = e.currentTarget.getAttribute('data-team');
    showMirrorModal(url, domain, hacker, team);
  }

  function escapeHtml(str) { if (!str) return ''; return str.replace(/[&<>]/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;'}[m])); }
  function sanitizeInput(str) { if (!str) return ''; return str.replace(/[<>]/g,'').replace(/javascript:/gi,'').replace(/on\w+=/gi,'').replace(/\\/g,'').replace(/['";]/g,'').trim().slice(0,200); }
  function isValidUrl(str) { if (!str || str.length>230) return false; try { const url=new URL(str); return url.protocol==='http:'||url.protocol==='https:'; } catch { return false; } }
  function isValidName(str) { return str && str.length>=2 && str.length<=50 && /^[a-zA-Z0-9\s\-_.]{2,50}$/.test(str); }
  function isSpamDetected(username, hackerName, url) {
    const defaces = getUserDefaces(username);
    const now=Date.now();
    const recent=defaces.filter(e=>now-(e.timestampMs||0)<60000);
    if (recent.filter(e=>e.hacker.toLowerCase()===hackerName.toLowerCase()).length>=3) return true;
    if (recent.filter(e=>e.url===url).length>=2) return true;
    return false;
  }
  function showMessage(id, msg, isError=true) {
    const div=document.getElementById(id); if(!div) return;
    div.textContent=msg; div.style.color=isError?'#ff5555':'#55ff55';
    setTimeout(()=>{ if(div.textContent===msg) div.textContent=''; },4000);
  }

  function handleLogin() {
    const username = document.getElementById('loginUsername').value.trim();
    const password = document.getElementById('loginPassword').value;
    const user = users.find(u => u.username === username);
    if (!user || user.password !== btoa(password)) {
      showMessage('loginMessage', 'Error: Invalid username or password', true);
      return;
    }
    currentUser = username;
    saveSession();
    updateUI();
    renderProfile();
    document.getElementById('loginUsername').value = '';
    document.getElementById('loginPassword').value = '';
    showMessage('loginMessage', `Welcome back, ${escapeHtml(username)}`, false);
    setTimeout(() => { document.querySelector('[data-page="home"]').click(); }, 1000);
  }

  function handleRegister() {
    const username = document.getElementById('regUsername').value.trim();
    const password = document.getElementById('regPassword').value;
    const confirm = document.getElementById('regConfirm').value;
    if (!username || username.length < 3) { showMessage('registerMessage', 'Error: Username must be at least 3 characters', true); return; }
    if (!/^[a-zA-Z0-9_]{3,20}$/.test(username)) { showMessage('registerMessage', 'Error: Username can only contain letters, numbers and underscore', true); return; }
    if (!password || password.length < 4) { showMessage('registerMessage', 'Error: Password must be at least 4 characters', true); return; }
    if (password !== confirm) { showMessage('registerMessage', 'Error: Passwords do not match', true); return; }
    if (users.find(u => u.username === username)) { showMessage('registerMessage', 'Error: Username already exists', true); return; }
    users.push({ username, password: btoa(password) });
    saveUsers();
    showMessage('registerMessage', 'Registration successful! Please login.', false);
    setTimeout(() => { document.getElementById('showLogin').click(); }, 1500);
  }

  function handleSendNotify() {
    if (!currentUser) {
      showMessage('notifyMessage', 'Error: Please login to submit defaces', true);
      setTimeout(() => { document.querySelector('[data-page="login"]').click(); }, 1500);
      return;
    }
    const nInp=document.getElementById('notifyName'), tInp=document.getElementById('teamName'), uInp=document.getElementById('targetUrl');
    let rawNotify=nInp.value, rawTeam=tInp.value, rawUrl=uInp.value;
    if(rawUrl.length>230){ showMessage('notifyMessage','Error: URL exceeds 230 characters',true); nInp.value=tInp.value=uInp.value=''; return; }
    let cleanedNotify=sanitizeInput(rawNotify), cleanedTeam=sanitizeInput(rawTeam), cleanedUrl=rawUrl.trim();
    if(!cleanedNotify||cleanedNotify.length<2){ showMessage('notifyMessage','Error: Hacker name must be at least 2 characters',true); return; }
    if(!isValidName(cleanedNotify)){ showMessage('notifyMessage','Error: Hacker name contains invalid characters',true); return; }
    if(cleanedTeam && !isValidName(cleanedTeam)){ showMessage('notifyMessage','Error: Team name contains invalid characters',true); return; }
    if(!cleanedUrl){ showMessage('notifyMessage','Error: URL is required',true); return; }
    if(!isValidUrl(cleanedUrl)){ showMessage('notifyMessage','Error: Invalid URL. Use http:// or https://',true); return; }
    const blacklist=['localhost','127.0.0.1','192.168.','10.0.','172.16.','internal','example.com','test.com'];
    if(blacklist.some(b=>cleanedUrl.toLowerCase().includes(b))){ showMessage('notifyMessage','Error: Invalid or blocked URL detected',true); return; }
    if(isSpamDetected(currentUser, cleanedNotify, cleanedUrl)){ showMessage('notifyMessage','Error: Spam detected. Please wait.',true); return; }
    const isSpecial=isSpecialDomain(cleanedUrl);
    let teamDisplay=cleanedTeam||'Anonymous';
    if(teamDisplay.length>15) teamDisplay=teamDisplay.substring(0,12)+'...';
    const newEntry={ id:Date.now(), hacker:escapeHtml(cleanedNotify), team:escapeHtml(cleanedTeam||''), teamDisplay:escapeHtml(teamDisplay), url:cleanedUrl, isSpecial, timestampMs:Date.now() };
    addUserDeface(currentUser, newEntry);
    renderAll();
    nInp.value=tInp.value=uInp.value='';
    showMessage('notifyMessage','Deface added to archives',false);
  }

  function copyShareLink() {
    const input = document.getElementById('shareLinkInput');
    if (input) {
      input.select();
      document.execCommand('copy');
      showMessage('notifyMessage', 'Link copied to clipboard!', false);
      setTimeout(() => { document.getElementById('notifyMessage').textContent = ''; }, 2000);
    }
  }

  const navBtns=document.querySelectorAll('.nav-btn'), pages=document.querySelectorAll('.page');
  navBtns.forEach(btn=>{
    btn.addEventListener('click',()=>{
      const pageId=btn.getAttribute('data-page');
      navBtns.forEach(b=>b.classList.remove('active'));
      btn.classList.add('active');
      pages.forEach(p=>p.classList.remove('active'));
      document.getElementById(pageId).classList.add('active');
      if(pageId==='ranked') renderRanked();
      if(pageId==='profiles') renderProfiles();
      if(pageId==='profile') renderProfile();
    });
  });
  document.getElementById('sendNotifyBtn')?.addEventListener('click',handleSendNotify);
  document.getElementById('loginBtn')?.addEventListener('click',handleLogin);
  document.getElementById('registerBtn')?.addEventListener('click',handleRegister);
  document.getElementById('copyLinkBtn')?.addEventListener('click',copyShareLink);
  document.getElementById('showRegister')?.addEventListener('click',()=>{
    document.getElementById('login').classList.remove('active');
    document.getElementById('register').classList.add('active');
  });
  document.getElementById('showLogin')?.addEventListener('click',()=>{
    document.getElementById('register').classList.remove('active');
    document.getElementById('login').classList.add('active');
  });
  ['notifyName','teamName','targetUrl'].forEach(id=>{
    document.getElementById(id)?.addEventListener('keypress',e=>{ if(e.key==='Enter'){ e.preventDefault(); handleSendNotify(); } });
  });
  const searchInput=document.getElementById('searchInput'), searchClear=document.getElementById('searchClear');
  if(searchInput){
    searchInput.addEventListener('input',()=>{ renderArchives(); if(searchClear) searchClear.style.display=searchInput.value?'inline-block':'none'; });
  }
  if(searchClear){
    searchClear.addEventListener('click',()=>{ searchInput.value=''; renderArchives(); searchClear.style.display='none'; });
  }
  const modal=document.getElementById('mirrorModal'), closeBtn=document.querySelector('.modal-close');
  if(closeBtn) closeBtn.addEventListener('click',()=>{ modal.style.display='none'; });
  window.addEventListener('click',(e)=>{ if(e.target===modal) modal.style.display='none'; });
  
  loadFromStorage();
  setInterval(()=>{ renderHome(); renderRanked(); },30000);
})();
