(function() {
  let defaceEntries = [];
  let hackerStats = {};
  let lastResetDate = null;

  function loadFromStorage() {
    const stored = localStorage.getItem('artdeface_entries_v2');
    if (stored) {
      try {
        defaceEntries = JSON.parse(stored);
      } catch(e) {
        defaceEntries = [];
      }
    }
    
    const storedStats = localStorage.getItem('artdeface_hacker_stats');
    if (storedStats) {
      try {
        hackerStats = JSON.parse(storedStats);
      } catch(e) {
        hackerStats = {};
      }
    }
    
    const storedReset = localStorage.getItem('artdeface_last_reset');
    if (storedReset) {
      lastResetDate = new Date(parseInt(storedReset));
    } else {
      lastResetDate = new Date();
      lastResetDate.setHours(0, 0, 0, 0);
      localStorage.setItem('artdeface_last_reset', lastResetDate.getTime());
    }
    
    checkAndResetRanking();
    renderArchives();
    renderHome();
    renderRanked();
    startResetTimer();
  }

  function saveToStorage() {
    localStorage.setItem('artdeface_entries_v2', JSON.stringify(defaceEntries));
    localStorage.setItem('artdeface_hacker_stats', JSON.stringify(hackerStats));
  }

  function checkAndResetRanking() {
    const now = new Date();
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    if (!lastResetDate) {
      lastResetDate = today;
      localStorage.setItem('artdeface_last_reset', lastResetDate.getTime());
      return;
    }
    
    const lastReset = new Date(lastResetDate);
    if (now.getTime() - lastReset.getTime() >= 24 * 60 * 60 * 1000) {
      hackerStats = {};
      lastResetDate = today;
      localStorage.setItem('artdeface_last_reset', lastResetDate.getTime());
      saveToStorage();
    }
  }

  function updateHackerStats(hackerName) {
    const now = new Date();
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    if (lastResetDate && (now.getTime() - new Date(lastResetDate).getTime() >= 24 * 60 * 60 * 1000)) {
      hackerStats = {};
      lastResetDate = today;
      localStorage.setItem('artdeface_last_reset', lastResetDate.getTime());
    }
    
    const cleanName = escapeHtmlSimple(hackerName.toLowerCase());
    if (!hackerStats[cleanName]) {
      hackerStats[cleanName] = 0;
    }
    hackerStats[cleanName]++;
    saveToStorage();
    renderRanked();
  }

  function getTopHackers(limit = 10) {
    const entries = Object.entries(hackerStats);
    entries.sort((a, b) => b[1] - a[1]);
    return entries.slice(0, limit).map(([name, count]) => ({ name, count }));
  }

  function isSpecialDomain(url) {
    const specialTLDs = ['.com.br', '.gov', '.gov.br', '.it', '.edu', '.edu.br', '.org', '.org.br', '.net', '.mil', '.mil.br'];
    const lowerUrl = url.toLowerCase();
    for (let tld of specialTLDs) {
      if (lowerUrl.includes(tld)) {
        return true;
      }
    }
    return false;
  }

  function extractDomain(url) {
    try {
      const urlObj = new URL(url);
      let hostname = urlObj.hostname;
      if (hostname.startsWith('www.')) {
        hostname = hostname.substring(4);
      }
      return hostname;
    } catch {
      return url;
    }
  }

  function getIpInfo(domain) {
    return fetch(`https://cloudflare-dns.com/dns-query?name=${domain}&type=A`, {
      headers: { 'Accept': 'application/dns-json' }
    })
    .then(res => res.json())
    .catch(() => null);
  }

  function getCountryCode(ip) {
    return fetch(`https://ipapi.co/${ip}/json/`)
      .then(res => res.json())
      .catch(() => null);
  }

  function getFlag(countryCode) {
    const flags = {
      'US': 'US', 'BR': 'BR', 'GB': 'GB', 'DE': 'DE', 'FR': 'FR', 'IT': 'IT',
      'ES': 'ES', 'PT': 'PT', 'NL': 'NL', 'RU': 'RU', 'CN': 'CN', 'JP': 'JP',
      'AU': 'AU', 'CA': 'CA', 'IN': 'IN', 'Unknown': 'XX'
    };
    return flags[countryCode] || 'XX';
  }

  function showMirrorModal(url, domain, hacker, team) {
    const modal = document.getElementById('mirrorModal');
    const mirrorInfo = document.getElementById('mirrorInfo');
    
    mirrorInfo.innerHTML = '<div class="mirror-loading">loading mirror information...</div>';
    modal.style.display = 'block';
    
    const timestamp = new Date().toLocaleString();
    
    getIpInfo(domain).then(dnsData => {
      let ip = 'unable to resolve';
      let country = 'Unknown';
      let flag = 'XX';
      
      if (dnsData && dnsData.Answer && dnsData.Answer.length > 0) {
        ip = dnsData.Answer[0].data;
        getCountryCode(ip).then(geoData => {
          if (geoData && geoData.country_name) {
            country = geoData.country_name;
            const code = geoData.country_code || 'XX';
            flag = getFlag(code);
          }
          renderMirrorContent();
        }).catch(() => renderMirrorContent());
      } else {
        renderMirrorContent();
      }
      
      function renderMirrorContent() {
        mirrorInfo.innerHTML = `
          <div class="mirror-info-row">
            <span class="mirror-label">date</span>
            <span class="mirror-value">${escapeHtmlSimple(timestamp)}</span>
          </div>
          <div class="mirror-info-row">
            <span class="mirror-label">system</span>
            <span class="mirror-value">Linux</span>
          </div>
          <div class="mirror-info-row">
            <span class="mirror-label">hacker</span>
            <span class="mirror-value">${escapeHtmlSimple(hacker)}</span>
          </div>
          <div class="mirror-info-row">
            <span class="mirror-label">team</span>
            <span class="mirror-value">${escapeHtmlSimple(team)}</span>
          </div>
          <div class="mirror-info-row">
            <span class="mirror-label">ip address</span>
            <span class="mirror-value">${escapeHtmlSimple(ip)}</span>
          </div>
          <div class="mirror-info-row">
            <span class="mirror-label">country</span>
            <span class="mirror-value"><span class="flag-icon">${flag}</span> <span class="country-name">${escapeHtmlSimple(country)}</span></span>
          </div>
          <div class="mirror-info-row">
            <span class="mirror-label">domain</span>
            <span class="mirror-value"><a href="${escapeHtmlSimple(url)}" target="_blank" rel="noopener noreferrer">${escapeHtmlSimple(domain)}</a></span>
          </div>
          <div class="mirror-info-row">
            <span class="mirror-label">preview</span>
            <iframe class="preview-frame" src="${escapeHtmlSimple(url)}" sandbox="allow-same-origin allow-scripts allow-popups allow-forms" referrerpolicy="no-referrer" title="mirror preview"></iframe>
          </div>
          <div class="mirror-info-row">
            <span class="mirror-label">note</span>
            <span class="mirror-value">this mirror is for archival purposes only</span>
          </div>
        `;
      }
    }).catch(() => {
      mirrorInfo.innerHTML = `
        <div class="mirror-info-row">
          <span class="mirror-label">date</span>
          <span class="mirror-value">${escapeHtmlSimple(timestamp)}</span>
        </div>
        <div class="mirror-info-row">
          <span class="mirror-label">system</span>
          <span class="mirror-value">Linux</span>
        </div>
        <div class="mirror-info-row">
          <span class="mirror-label">hacker</span>
          <span class="mirror-value">${escapeHtmlSimple(hacker)}</span>
        </div>
        <div class="mirror-info-row">
          <span class="mirror-label">team</span>
          <span class="mirror-value">${escapeHtmlSimple(team)}</span>
        </div>
        <div class="mirror-info-row">
          <span class="mirror-label">ip address</span>
          <span class="mirror-value">unable to resolve</span>
        </div>
        <div class="mirror-info-row">
          <span class="mirror-label">country</span>
          <span class="mirror-value"><span class="flag-icon">XX</span> Unknown</span>
        </div>
        <div class="mirror-info-row">
          <span class="mirror-label">domain</span>
          <span class="mirror-value"><a href="${escapeHtmlSimple(url)}" target="_blank" rel="noopener noreferrer">${escapeHtmlSimple(domain)}</a></span>
        </div>
        <div class="mirror-info-row">
          <span class="mirror-label">preview</span>
          <iframe class="preview-frame" src="${escapeHtmlSimple(url)}" sandbox="allow-same-origin allow-scripts allow-popups allow-forms" referrerpolicy="no-referrer" title="mirror preview"></iframe>
        </div>
      `;
    });
  }

  function renderHome() {
    const tableBody = document.getElementById('homeTableBody');
    if (!tableBody) return;

    const recentEntries = defaceEntries.slice(0, 5);

    if (recentEntries.length === 0) {
      tableBody.innerHTML = '<tr class="empty-row"><td colspan="4">no defaces yet</td></tr>';
      return;
    }

    let html = '';
    for (let i = 0; i < recentEntries.length; i++) {
      const entry = recentEntries[i];
      const domain = extractDomain(entry.url);
      const starHtml = entry.isSpecial ? '<span class="star">*</span>' : '';
      
      html += `
        <tr>
          <td class="team-cell">${escapeHtmlSimple(entry.teamDisplay)}</td>
          <td>${escapeHtmlSimple(entry.hacker)}</td>
          <td class="domain-cell">${starHtml}<a href="${escapeHtmlSimple(entry.url)}" target="_blank" rel="noopener noreferrer">${escapeHtmlSimple(domain)}</a></td>
          <td><span class="mirror-link" data-url="${escapeHtmlSimple(entry.url)}" data-domain="${escapeHtmlSimple(domain)}" data-hacker="${escapeHtmlSimple(entry.hacker)}" data-team="${escapeHtmlSimple(entry.teamDisplay)}">mirror</span></td>
        </tr>
      `;
    }
    tableBody.innerHTML = html;
    attachMirrorEvents();
  }

  function renderArchives() {
    const tableBody = document.getElementById('archivesTableBody');
    const totalSpan = document.getElementById('totalCount');
    
    if (!tableBody) return;

    if (defaceEntries.length === 0) {
      tableBody.innerHTML = '<tr class="empty-row"><td colspan="4">no defaces yet</td></tr>';
      if (totalSpan) totalSpan.textContent = '0';
      return;
    }

    if (totalSpan) totalSpan.textContent = defaceEntries.length;

    let html = '';
    for (let i = 0; i < defaceEntries.length; i++) {
      const entry = defaceEntries[i];
      const domain = extractDomain(entry.url);
      const starHtml = entry.isSpecial ? '<span class="star">*</span>' : '';
      
      html += `
        <tr>
          <td class="team-cell">${escapeHtmlSimple(entry.teamDisplay)}</td>
          <td>${escapeHtmlSimple(entry.hacker)}</td>
          <td class="domain-cell">${starHtml}<a href="${escapeHtmlSimple(entry.url)}" target="_blank" rel="noopener noreferrer">${escapeHtmlSimple(domain)}</a></td>
          <td><span class="mirror-link" data-url="${escapeHtmlSimple(entry.url)}" data-domain="${escapeHtmlSimple(domain)}" data-hacker="${escapeHtmlSimple(entry.hacker)}" data-team="${escapeHtmlSimple(entry.teamDisplay)}">mirror</span></td>
        </tr>
      `;
    }
    tableBody.innerHTML = html;
    attachMirrorEvents();
  }

  function renderRanked() {
    const tableBody = document.getElementById('rankedTableBody');
    if (!tableBody) return;
    
    const topHackers = getTopHackers(10);
    
    if (topHackers.length === 0) {
      tableBody.innerHTML = '<tr class="empty-row"><td colspan="3">no data available</td></tr>';
      return;
    }
    
    let html = '';
    for (let i = 0; i < topHackers.length; i++) {
      const hacker = topHackers[i];
      const rank = i + 1;
      const rankDisplay = rank === 1 ? '#' + rank : rank;
      html += `
        <tr>
          <td>${rankDisplay}</td>
          <td>${escapeHtmlSimple(hacker.name)}</td>
          <td>${hacker.count}</td>
        </tr>
      `;
    }
    tableBody.innerHTML = html;
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

  function escapeHtmlSimple(str) {
    if (!str) return '';
    return str.replace(/[&<>]/g, function(m) {
      if (m === '&') return '&amp;';
      if (m === '<') return '&lt;';
      if (m === '>') return '&gt;';
      return m;
    });
  }

  function sanitizeInput(str) {
    if (!str) return '';
    let cleaned = str.replace(/[<>]/g, '');
    cleaned = cleaned.replace(/javascript:/gi, '');
    cleaned = cleaned.replace(/on\w+=/gi, '');
    cleaned = cleaned.replace(/\\/g, '');
    cleaned = cleaned.replace(/['";]/g, '');
    cleaned = cleaned.trim();
    if (cleaned.length > 200) {
      cleaned = cleaned.substring(0, 200);
    }
    return cleaned;
  }

  function isValidUrl(str) {
    if (!str) return false;
    if (str.length > 230) return false;
    try {
      const url = new URL(str);
      return url.protocol === 'http:' || url.protocol === 'https:';
    } catch {
      return false;
    }
  }

  function isValidName(str) {
    if (!str || str.length < 2) return false;
    const nameRegex = /^[a-zA-Z0-9\s\-_.]{2,50}$/;
    return nameRegex.test(str);
  }

  function isSpamDetected(hackerName, teamName, url) {
    const now = Date.now();
    const recentEntries = defaceEntries.filter(entry => 
      now - entry.timestampMs < 60 * 1000
    );
    
    const sameHacker = recentEntries.filter(entry => 
      entry.hacker.toLowerCase() === hackerName.toLowerCase()
    ).length;
    
    if (sameHacker >= 3) return true;
    
    const sameUrl = recentEntries.filter(entry => 
      entry.url === url
    ).length;
    
    if (sameUrl >= 2) return true;
    
    return false;
  }

  function showMessage(elementId, msg, isError = true) {
    const msgDiv = document.getElementById(elementId);
    if (!msgDiv) return;
    msgDiv.textContent = msg;
    msgDiv.style.color = isError ? '#ff5555' : '#55ff55';
    setTimeout(() => {
      if (msgDiv.textContent === msg) {
        msgDiv.textContent = '';
      }
    }, 4000);
  }

  function startResetTimer() {
    function updateTimer() {
      const now = new Date();
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(0, 0, 0, 0);
      
      const diff = tomorrow - now;
      if (diff <= 0) {
        location.reload();
        return;
      }
      
      const hours = Math.floor(diff / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);
      
      const timerSpan = document.getElementById('resetTimer');
      if (timerSpan) {
        timerSpan.textContent = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
      }
    }
    
    updateTimer();
    setInterval(updateTimer, 1000);
  }

  function handleSendNotify() {
    const notifyNameInput = document.getElementById('notifyName');
    const teamNameInput = document.getElementById('teamName');
    const targetUrlInput = document.getElementById('targetUrl');

    let rawNotify = notifyNameInput.value;
    let rawTeam = teamNameInput.value;
    let rawUrl = targetUrlInput.value;

    if (rawUrl.length > 230) {
      showMessage('notifyMessage', 'Error: URL exceeds 230 characters. Entry rejected.', true);
      notifyNameInput.value = '';
      teamNameInput.value = '';
      targetUrlInput.value = '';
      return;
    }

    let cleanedNotify = sanitizeInput(rawNotify);
    let cleanedTeam = sanitizeInput(rawTeam);
    let cleanedUrl = rawUrl ? rawUrl.trim() : '';

    if (!cleanedNotify || cleanedNotify.length < 2) {
      showMessage('notifyMessage', 'Error: Hacker name must be at least 2 characters', true);
      return;
    }

    if (!isValidName(cleanedNotify)) {
      showMessage('notifyMessage', 'Error: Hacker name contains invalid characters', true);
      return;
    }

    if (cleanedTeam && cleanedTeam.length > 0) {
      if (!isValidName(cleanedTeam)) {
        showMessage('notifyMessage', 'Error: Team name contains invalid characters', true);
        return;
      }
    }

    if (!cleanedUrl) {
      showMessage('notifyMessage', 'Error: URL is required', true);
      return;
    }

    if (!isValidUrl(cleanedUrl)) {
      showMessage('notifyMessage', 'Error: Invalid URL. Use http:// or https://', true);
      return;
    }

    const urlBlacklist = ['localhost', '127.0.0.1', '0.0.0.0', '192.168.', '10.0.', '172.16.', 'internal', 'example.com', 'test.com'];
    for (let blocked of urlBlacklist) {
      if (cleanedUrl.toLowerCase().includes(blocked)) {
        showMessage('notifyMessage', 'Error: Invalid or blocked URL detected', true);
        return;
      }
    }

    if (isSpamDetected(cleanedNotify, cleanedTeam, cleanedUrl)) {
      showMessage('notifyMessage', 'Error: Spam detected. Please wait before sending more notifications.', true);
      return;
    }

    const isSpecial = isSpecialDomain(cleanedUrl);
    let teamDisplay = cleanedTeam && cleanedTeam.length > 0 ? cleanedTeam : 'Anonymous';
    if (teamDisplay.length > 15) {
      teamDisplay = teamDisplay.substring(0, 12) + '...';
    }

    const newEntry = {
      id: Date.now(),
      hacker: escapeHtmlSimple(cleanedNotify),
      team: escapeHtmlSimple(cleanedTeam || ''),
      teamDisplay: escapeHtmlSimple(teamDisplay),
      url: cleanedUrl,
      isSpecial: isSpecial,
      timestampMs: Date.now()
    };

    defaceEntries.unshift(newEntry);
    saveToStorage();
    renderArchives();
    renderHome();
    updateHackerStats(cleanedNotify);

    notifyNameInput.value = '';
    teamNameInput.value = '';
    targetUrlInput.value = '';

    showMessage('notifyMessage', 'Deface added to archives', false);
  }

  const navBtns = document.querySelectorAll('.nav-btn');
  const pages = document.querySelectorAll('.page');

  navBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const pageId = btn.getAttribute('data-page');
      
      navBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      
      pages.forEach(page => page.classList.remove('active'));
      document.getElementById(pageId).classList.add('active');
      
      if (pageId === 'ranked') {
        renderRanked();
      }
    });
  });

  const sendBtn = document.getElementById('sendNotifyBtn');
  if (sendBtn) sendBtn.addEventListener('click', handleSendNotify);

  const inputs = ['notifyName', 'teamName', 'targetUrl'];
  inputs.forEach(id => {
    const input = document.getElementById(id);
    if (input) {
      input.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          handleSendNotify();
        }
      });
    }
  });

  const modal = document.getElementById('mirrorModal');
  const closeBtn = document.querySelector('.modal-close');
  if (closeBtn) {
    closeBtn.addEventListener('click', () => {
      modal.style.display = 'none';
    });
  }
  window.addEventListener('click', (e) => {
    if (e.target === modal) modal.style.display = 'none';
  });

  loadFromStorage();
  setInterval(() => {
    renderHome();
    checkAndResetRanking();
    renderRanked();
  }, 300000);
})();
