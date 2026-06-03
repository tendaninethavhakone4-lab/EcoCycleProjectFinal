  // XP state
  let currentXP = 3840;
  const XP_LEVEL = 4500;
 
  // Init XP bar
  window.addEventListener('load', () => {
    setTimeout(() => {
      document.getElementById('xpFill').style.width = ((currentXP / XP_LEVEL) * 100) + '%';
      document.getElementById('milestoneProg').style.width = '58%';
    }, 400);
    startAutoFeed();
  });
 
  // Add XP
  function addXP(amount, msg) {
    currentXP += amount;
    document.getElementById('totalXP').textContent = currentXP.toLocaleString();
    document.getElementById('lbXP').textContent = currentXP.toLocaleString() + ' XP';
    document.getElementById('xpFill').style.width = Math.min((currentXP / XP_LEVEL) * 100, 100) + '%';
    showToast('⭐', `+${amount} XP`, msg || 'Keep going!', false);
    addFeedItem('⭐', 'xp', `+${amount} XP`, msg || 'Challenge progress updated', 'Just now');
  }
 
  // Claim bonus
  function claimBonus(btn) {
    btn.disabled = true;
    btn.textContent = '✓ Claimed!';
    addXP(50, 'Daily check-in bonus claimed!');
    showToast('🔥', 'Streak Bonus!', '+50 XP — Come back tomorrow to keep your streak', true);
  }
 
  // Show badge toast
  function showBadge(name, detail) {
    showToast('🏅', `Badge: ${name}`, detail, true);
  }
 
  // Toast
  function showToast(icon, title, msg, isGold) {
    const c = document.getElementById('toastContainer');
    const t = document.createElement('div');
    t.className = 'toast' + (isGold ? ' gold-toast' : '');
    t.innerHTML = `
      <span class="toast-icon">${icon}</span>
      <div class="toast-body">
        <strong>${title}</strong>
        <span>${msg}</span>
      </div>
      <span class="toast-close" onclick="this.parentElement.remove()">×</span>
    `;
    c.appendChild(t);
    setTimeout(() => {
      t.style.animation = 'toastOut .3s forwards';
      setTimeout(() => t.remove(), 300);
    }, 4000);
  }
 
  // Feed
  function addFeedItem(emoji, cls, title, desc, time) {
    const feed = document.getElementById('feedList');
    const div = document.createElement('div');
    div.className = 'feed-item';
    div.innerHTML = `
      <div class="feed-dot ${cls}">${emoji}</div>
      <div class="feed-text">
        <strong>${title}</strong>
        <span>${desc}</span>
      </div>
      <span class="feed-time">${time}</span>
    `;
    feed.insertBefore(div, feed.firstChild);
    if (feed.children.length > 6) feed.lastChild.remove();
  }
 
  // Auto-feed simulation
  const autoEvents = [
    { emoji:'⭐', cls:'xp', title:'+90 XP — Transaction Logged', desc:'Bongani Moyo collected 6 kg of cardboard', time:'Just now' },
    { emoji:'🏅', cls:'badge', title:'Badge Unlocked: Early Bird', desc:'Nomsa Dlamini logged before 7am', time:'Just now' },
    { emoji:'📈', cls:'rank', title:'Leaderboard Update', desc:'Priya Naidoo moved to #6', time:'Just now' },
    { emoji:'🔥', cls:'streak', title:'7-Day Streak!', desc:'Thandi Khumalo hit a 7-day streak', time:'Just now' },
  ];
  let autoIdx = 0;
  function startAutoFeed() {
    setInterval(() => {
      const e = autoEvents[autoIdx % autoEvents.length];
      addFeedItem(e.emoji, e.cls, e.title, e.desc, e.time);
      autoIdx++;
    }, 8000);
  }