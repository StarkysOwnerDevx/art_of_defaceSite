import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getDatabase, ref, get, set, query, orderByChild, limitToLast, onValue } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";

const firebaseConfig = {
  apiKey: "AIzaSyA3KGM_iDgn_tWF1eHLAwNXdncr7Re6XQo",
  authDomain: "artdeface-42cde.firebaseapp.com",
  databaseURL: "https://artdeface-42cde-default-rtdb.firebaseio.com",
  projectId: "artdeface-42cde",
  storageBucket: "artdeface-42cde.firebasestorage.app",
  messagingSenderId: "762578785414",
  appId: "1:762578785414:web:6e7e87dcbcc6cff5d92d07",
  measurementId: "G-HT4E5JG9B6"
};

const app = initializeApp(firebaseConfig);
const database = getDatabase(app);

(function() {
  let defaceEntries = [];
  let hackerStats = {};
  let lastResetDate = null;
  let currentSearchTerm = '';

  async function loadFromFirebase() {
    console.log('Loading from Firebase...');
    try {
      const defacesRef = ref(database, 'defaces');
      const defacesSnapshot = await get(defacesRef);
      console.log('Defaces snapshot exists:', defacesSnapshot.exists());
      
      if (defacesSnapshot.exists()) {
        const data = defacesSnapshot.val();
        defaceEntries = Object.values(data).sort((a,b) => b.timestampMs - a.timestampMs);
        console.log('Loaded', defaceEntries.length, 'defaces');
      } else {
        defaceEntries = [];
        console.log('No defaces found, creating sample data');
        const sampleEntry = {
          id: Date.now(),
          hacker: "sample_hacker",
          team: "sample_team",
          teamDisplay: "sample_team",
          url: "https://example.com",
          isSpecial: false,
          timestampMs: Date.now()
        };
        defaceEntries = [sampleEntry];
        await set(ref(database, 'defaces/' + sampleEntry.id), sampleEntry);
        console.log('Sample data created');
      }
      
      const statsRef = ref(database, 'stats_hacker');
      const statsSnapshot = await get(statsRef);
      if (statsSnapshot.exists()) {
        hackerStats = statsSnapshot.val();
      } else {
        hackerStats = {};
        await set(ref(database, 'stats_hacker'), {});
      }
      
      const resetRef = ref(database, 'stats_lastReset');
      const resetSnapshot = await get(resetRef);
      if (resetSnapshot.exists()) {
        lastResetDate = resetSnapshot.val();
      } else {
        lastResetDate = new Date().setHours(0,0,0,0);
        await set(ref(database, 'stats_lastReset'), lastResetDate);
      }
      
      console.log('Data loaded successfully');
      renderArchives();
      renderHome();
      renderRanked();
      renderProfiles();
      startResetTimer();
      
    } catch (e) {
      console.error('Firebase error:', e);
      document.getElementById('homeTableBody').innerHTML = '<tr class="empty-row"><td colspan="4">database error: check console</td></tr>';
      document.getElementById('archivesTableBody').innerHTML = '<tr class="empty-row"><td colspan="4">database error: check console</td></tr>';
    }
  }

  async function addToFirebase(entry) {
    try {
      await set(ref(database, 'defaces/' + entry.id), entry);
      console.log('Entry saved to Firebase:', entry.id);
    } catch(e) {
      console.error('Save error:', e);
      throw e;
    }
  }

  async function updateStatsInFirebase() {
    try {
      await set(ref(database, 'stats_hacker'), hackerStats);
      await set(ref(database, 'stats_lastReset'), lastResetDate);
    } catch(e) {
      console.error('Stats update error:', e);
    }
  }

  function checkAndResetRanking() {
    const now = new Date();
    const today = new Date(); today.setHours(0,0,0,0);
    if (!lastResetDate) { lastResetDate = today.getTime(); updateStatsInFirebase(); return; }
    const lastReset = new Date(lastResetDate);
    if (now.getTime() - lastReset.getTime() >= 24*60*60*1000) {
      hackerStats = {};
      lastResetDate = today.getTime();
      updateStatsInFirebase();
    }
  }

  function updateHackerStats(hackerName) {
    const now = new Date();
    const today = new Date(); today.setHours(0,0,0,0);
    if (lastResetDate && (now.getTime() - new Date(lastResetDate).getTime() >= 24*60*60*1000)) {
      hackerStats = {};
      lastResetDate = today.getTime();
    }
    const cleanName = escapeHtmlSimple(hackerName.toLowerCase());
    hackerStats[cleanName] = (hackerStats[cleanName] || 0) + 1;
    updateStatsInFirebase();
    renderRanked();
    renderProfiles();
  }

  function getTopHackers(limit=10) {
    return Object.entries(hackerStats).sort((a,b)=>b[1]-a[1]).slice(0,limit).map(([name,count])=>({name,count}));
  }

  function getHackerProfiles() {
    const profileMap = new Map();
    for (const entry of defaceEntries) {
      const hacker = entry.hacker;
      const team = entry.teamDisplay;
      if (!profileMap.has(hacker)) {
        profileMap.set(hacker, { hacker, team: team === 'Anonymous' ? '-' : team, count: 0, lastTimestamp: 0 });
      }
      const profile = profileMap.get(hacker);
      profile.count++;
      if (entry.timestampMs > profile.lastTimestamp) {
        profile.lastTimestamp = entry.timestampMs;
        profile.team = team === 'Anonymous' ? '-' : team;
      }
    }
    return Array.from(profileMap.values()).sort((a,b) => b.count - a.count);
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
        mirrorInfo.innerHTML = `<div class="mirror-info-row"><span class="mirror-label">date</span><span class="mirror-value">${escapeHtmlSimple(timestamp)}</span></div>
          <div class="mirror-info-row"><span class="mirror-label">system</span><span class="mirror-value">Linux</span></div>
          <div class="mirror-info-row"><span class="mirror-label">hacker</span><span class="mirror-value">${escapeHtmlSimple(hacker)}</span></div>
          <div class="mirror-info-row"><span class="mirror-label">team</span><span class="mirror-value">${escapeHtmlSimple(team)}</span></div>
          <div class="mirror-info-row"><span class="mirror-label">ip address</span><span class="mirror-value">${escapeHtmlSimple(ip)}</span></div>
          <div class="mirror-info-row"><span class="mirror-label">country</span><span class="mirror-value"><span class="flag-icon">${flag}</span> <span class="country-name">${escapeHtmlSimple(country)}</span></span></div>
          <div class="mirror-info-row"><span class="mirror-label">domain</span><span class="mirror-value"><a href="${escapeHtmlSimple(url)}" target="_blank">${escapeHtmlSimple(domain)}</a></span></div>
          <div class="mirror-info-row"><span class="mirror-label">preview</span><iframe class="preview-frame" src="${escapeHtmlSimple(url)}" sandbox="allow-same-origin allow-scripts allow-popups allow-forms" referrerpolicy="no-referrer" title="mirror preview"></iframe></div>
          <div class="mirror-info-row"><span class="mirror-label">note</span><span class="mirror-value">this mirror is for archival purposes only</span></div>`;
      }
    }).catch(()=>{
      mirrorInfo.innerHTML = `<div class="mirror-info-row"><span class="mirror-label">date</span><span class="mirror-value">${escapeHtmlSimple(timestamp)}</span></div>
        <div class="mirror-info-row"><span class="mirror-label">system</span><span class="mirror-value">Linux</span></div>
        <div class="mirror-info-row"><span class="mirror-label">hacker</span><span class="mirror-value">${escapeHtmlSimple(hacker)}</span></div>
        <div class="mirror-info-row"><span class="mirror-label">team</span><span class="mirror-value">${escapeHtmlSimple(team)}</span></div>
        <div class="mirror-info-row"><span class="mirror-label">ip address</span><span class="mirror-value">unable to resolve</span></div>
        <div class="mirror-info-row"><span class="mirror-label">country</span><span class="mirror-value"><span class="flag-icon">XX</span> Unknown</span></div>
        <div class="mirror-info-row"><span class="mirror-label">domain</span><span class="mirror-value"><a href="${escapeHtmlSimple(url)}" target="_blank">${escapeHtmlSimple(domain)}</a></span></div>
        <div class="mirror-info-row"><span class="mirror-label">preview</span><iframe class="preview-frame" src="${escapeHtmlSimple(url)}" sandbox="allow-same-origin allow-scripts allow-popups allow-forms" referrerpolicy="no-referrer" title="mirror preview"></iframe></div>`;
    });
  }

  function domainWithIcon(domain, url, isSpecial) {
    const starHtml = isSpecial ? '<span class="star">*</span>' : '';
    const icon = `<svg class="domain-icon" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>`;
    return `<td class="domain-cell">${starHtml}<span style="display:inline-flex;align-items:center;gap:4px;">${icon}<a href="${escapeHtmlSimple(url)}" target="_blank" rel="noopener noreferrer">${escapeHtmlSimple(domain)}</a></span></td>`;
  }

  function renderHome() {
    const tbody = document.getElementById('homeTableBody');
    if (!tbody) return;
    const recent = defaceEntries.slice(0,5);
    if (recent.length === 0) { tbody.innerHTML = '<tr class="empty-row"><td colspan="4">no defaces yet</td></tr>'; return; }
    let html = '';
    for (const e of recent) {
      const domain = extractDomain(e.url);
      html += `<tr><td class="team-cell">${escapeHtmlSimple(e.teamDisplay)}</td><td>${escapeHtmlSimple(e.hacker)}</td>${domainWithIcon(domain, e.url, e.isSpecial)}<td><span class="mirror-link" data-url="${escapeHtmlSimple(e.url)}" data-domain="${escapeHtmlSimple(domain)}" data-hacker="${escapeHtmlSimple(e.hacker)}" data-team="${escapeHtmlSimple(e.teamDisplay)}">mirror</span></td></tr>`;
    }
    tbody.innerHTML = html;
    attachMirrorEvents();
  }

  function renderArchives() {
    const tbody = document.getElementById('archivesTableBody');
    const totalSpan = document.getElementById('totalCount');
    const resultSpan = document.getElementById('searchResultCount');
    if (!tbody) return;
    let filtered = defaceEntries;
    if (currentSearchTerm) {
      const term = currentSearchTerm.toLowerCase();
      filtered = defaceEntries.filter(e => e.hacker.toLowerCase().includes(term) || e.teamDisplay.toLowerCase().includes(term) || e.url.toLowerCase().includes(term));
    }
    if (filtered.length === 0) {
      tbody.innerHTML = '<tr class="empty-row"><td colspan="4">no defaces found</td></tr>';
      if (totalSpan) totalSpan.textContent = defaceEntries.length;
      if (resultSpan) resultSpan.textContent = filtered.length !== defaceEntries.length ? `(showing ${filtered.length})` : '';
      return;
    }
    if (totalSpan) totalSpan.textContent = defaceEntries.length;
    if (resultSpan) resultSpan.textContent = filtered.length !== defaceEntries.length ? `(showing ${filtered.length})` : '';
    let html = '';
    for (const e of filtered) {
      const domain = extractDomain(e.url);
      html += `<tr><td class="team-cell">${escapeHtmlSimple(e.teamDisplay)}</td><td>${escapeHtmlSimple(e.hacker)}</td>${domainWithIcon(domain, e.url, e.isSpecial)}<td><span class="mirror-link" data-url="${escapeHtmlSimple(e.url)}" data-domain="${escapeHtmlSimple(domain)}" data-hacker="${escapeHtmlSimple(e.hacker)}" data-team="${escapeHtmlSimple(e.teamDisplay)}">mirror</span></td></tr>`;
    }
    tbody.innerHTML = html;
    attachMirrorEvents();
  }

  function renderRanked() {
    const tbody = document.getElementById('rankedTableBody');
    if (!tbody) return;
    const top = getTopHackers(10);
    if (top.length === 0) { tbody.innerHTML = '<tr class="empty-row"><td colspan="3">no data available</td></tr>'; return; }
    let html = '';
    for (let i=0; i<top.length; i++) {
      html += `<tr><td>#${i+1}</td><td>${escapeHtmlSimple(top[i].name)}</td><td>${top[i].count}</td></tr>`;
    }
    tbody.innerHTML = html;
  }

  function renderProfiles() {
    const tbody = document.getElementById('profilesTableBody');
    const totalSpan = document.getElementById('totalHackersCount');
    if (!tbody) return;
    const profiles = getHackerProfiles();
    if (totalSpan) totalSpan.textContent = profiles.length;
    if (profiles.length === 0) { tbody.innerHTML = '<tr class="empty-row"><td colspan="4">no hackers yet</td></tr>'; return; }
    let html = '';
    for (const p of profiles) {
      const lastDate = p.lastTimestamp ? new Date(p.lastTimestamp).toLocaleDateString() : '-';
      html += `<tr><td>${escapeHtmlSimple(p.hacker)}</td><td>${escapeHtmlSimple(p.team)}</td><td>${p.count}</td><td>${lastDate}</td></tr>`;
    }
    tbody.innerHTML = html;
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

  function escapeHtmlSimple(str) { if (!str) return ''; return str.replace(/[&<>]/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;'}[m])); }
  function sanitizeInput(str) { if (!str) return ''; return str.replace(/[<>]/g,'').replace(/javascript:/gi,'').replace(/on\w+=/gi,'').replace(/\\/g,'').replace(/['";]/g,'').trim().slice(0,200); }
  function isValidUrl(str) { if (!str || str.length>230) return false; try { const url=new URL(str); return url.protocol==='http:'||url.protocol==='https:'; } catch { return false; } }
  function isValidName(str) { return str && str.length>=2 && str.length<=50 && /^[a-zA-Z0-9\s\-_.]{2,50}$/.test(str); }
  function isSpamDetected(hackerName, url) {
    const now=Date.now();
    const recent=defaceEntries.filter(e=>now-(e.timestampMs||0)<60000);
    if (recent.filter(e=>e.hacker.toLowerCase()===hackerName.toLowerCase()).length>=3) return true;
    if (recent.filter(e=>e.url===url).length>=2) return true;
    return false;
  }
  function showMessage(id, msg, isError=true) {
    const div=document.getElementById(id); if(!div) return;
    div.textContent=msg; div.style.color=isError?'#ff5555':'#55ff55';
    setTimeout(()=>{ if(div.textContent===msg) div.textContent=''; },4000);
  }
  function startResetTimer() {
    function update(){
      const tomorrow=new Date(); tomorrow.setDate(tomorrow.getDate()+1); tomorrow.setHours(0,0,0,0);
      const diff=tomorrow-new Date();
      if(diff<=0){ location.reload(); return; }
      const h=Math.floor(diff/3600000), m=Math.floor((diff%3600000)/60000), s=Math.floor((diff%60000)/1000);
      const timer=document.getElementById('resetTimer');
      if(timer) timer.textContent=`${h.toString().padStart(2,'0')}:${m.toString().padStart(2,'0')}:${s.toString().padStart(2,'0')}`;
    }
    update(); setInterval(update,1000);
  }
  async function handleSendNotify() {
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
    if(isSpamDetected(cleanedNotify,cleanedUrl)){ showMessage('notifyMessage','Error: Spam detected. Please wait.',true); return; }
    const isSpecial=isSpecialDomain(cleanedUrl);
    let teamDisplay=cleanedTeam||'Anonymous';
    if(teamDisplay.length>15) teamDisplay=teamDisplay.substring(0,12)+'...';
    const newEntry={ id:Date.now(), hacker:escapeHtmlSimple(cleanedNotify), team:escapeHtmlSimple(cleanedTeam||''), teamDisplay:escapeHtmlSimple(teamDisplay), url:cleanedUrl, isSpecial, timestampMs:Date.now() };
    defaceEntries.unshift(newEntry);
    await addToFirebase(newEntry);
    updateHackerStats(cleanedNotify);
    renderArchives(); renderHome(); renderRanked(); renderProfiles();
    nInp.value=tInp.value=uInp.value='';
    showMessage('notifyMessage','Deface added to archives',false);
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
    });
  });
  document.getElementById('sendNotifyBtn')?.addEventListener('click',handleSendNotify);
  ['notifyName','teamName','targetUrl'].forEach(id=>{
    document.getElementById(id)?.addEventListener('keypress',e=>{ if(e.key==='Enter'){ e.preventDefault(); handleSendNotify(); } });
  });
  const searchInput=document.getElementById('searchInput'), searchClear=document.getElementById('searchClear');
  if(searchInput){
    searchInput.addEventListener('input',(e)=>{
      currentSearchTerm=e.target.value;
      if(searchClear) searchClear.style.display=currentSearchTerm?'inline-block':'none';
      renderArchives();
    });
  }
  if(searchClear){
    searchClear.addEventListener('click',()=>{
      searchInput.value='';
      currentSearchTerm='';
      searchClear.style.display='none';
      renderArchives();
    });
  }
  const modal=document.getElementById('mirrorModal'), closeBtn=document.querySelector('.modal-close');
  if(closeBtn) closeBtn.addEventListener('click',()=>{ modal.style.display='none'; });
  window.addEventListener('click',(e)=>{ if(e.target===modal) modal.style.display='none'; });
  
  loadFromFirebase();
  setInterval(()=>{ renderHome(); checkAndResetRanking(); renderRanked(); },300000);
})();
