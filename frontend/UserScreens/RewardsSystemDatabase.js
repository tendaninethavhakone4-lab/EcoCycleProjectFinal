const REWARDS_API_URL = 'http://localhost:4000/api';
const REWARDS_XP_PER_LEVEL = 1000;
let rewardsCurrentXP = 0;
let rewardsCurrentPickerId = null;
let rewardsCanAdmin = false;
let rewardsRedemptions = [];
let rewardsDatabaseFeedReady = false;
let rewardsLastData = null;
let rewardsCurrentEntry = null;

function disableDemoActivityFeed() {
  window.startAutoFeed = function startAutoFeed() {};

  const originalAddFeedItem = window.addFeedItem;
  window.addFeedItem = function addFeedItem(cls, title, desc, time) {
    if (rewardsDatabaseFeedReady) return;
    if (typeof originalAddFeedItem === 'function') originalAddFeedItem(cls, title, desc, time);
  };
}

disableDemoActivityFeed();

function rewardsToken() {
  return localStorage.getItem('token');
}

function rewardsUser() {
  return JSON.parse(localStorage.getItem('user') || '{}');
}

async function rewardsFetch(path) {
  const response = await fetch(`${REWARDS_API_URL}${path}`, {
    headers: { 'Authorization': `Bearer ${rewardsToken()}` },
  });

  if (response.status === 401) {
    window.location.href = '../AuthScreens/login.html';
    return null;
  }

  if (!response.ok) throw new Error(`Rewards request failed: ${path}`);
  return response.json();
}

async function rewardsPost(path, body) {
  const response = await fetch(`${REWARDS_API_URL}${path}`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${rewardsToken()}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || `Rewards request failed: ${path}`);
  return payload;
}

async function rewardsPut(path, body) {
  const response = await fetch(`${REWARDS_API_URL}${path}`, {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${rewardsToken()}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || `Rewards request failed: ${path}`);
  return payload;
}

function normalizeRewardsRole(role) {
  return String(role || '').toLowerCase().replace(/[\s_-]/g, '');
}

function userCanAdminRewards(data = {}) {
  return Boolean(rewardsToken());
}

function setText(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = value;
}

function setFirst(selector, value) {
  const el = document.querySelector(selector);
  if (el) el.textContent = value;
}

function initials(name) {
  return String(name || '')
    .split(' ')
    .filter(Boolean)
    .map(part => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase() || 'EC';
}

function escapeRewardAttr(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function updateRewardsProfile(entry, leaderboard) {
  const xp = Number(entry?.xp || 0);
  rewardsCurrentXP = xp;
  rewardsCurrentPickerId = entry?.picker_id || null;
  const level = Number(entry?.level || 1);
  const nextLevelXp = level * REWARDS_XP_PER_LEVEL;
  const pct = Math.min((xp / nextLevelXp) * 100, 100);
  const badges = entry?.badges || [];

  setText('topbarXP', `${xp.toLocaleString()} XP`);
  setText('totalXP', xp.toLocaleString());
  setText('xpCurrent', xp.toLocaleString());
  setText('lbXP', `${xp.toLocaleString()} XP`);
  setText('storeXPLabel', `${xp.toLocaleString()} XP`);
  setText('xpNote', `${Math.max(0, nextLevelXp - xp).toLocaleString()} XP needed to reach Level ${level + 1}`);

  const statValues = document.querySelectorAll('.stat-value');
  if (statValues[0]) statValues[0].textContent = xp.toLocaleString();
  if (statValues[1]) statValues[1].textContent = `${entry?.transactionCount || 0} txns`;
  if (statValues[2]) statValues[2].textContent = entry?.rank ? `#${entry.rank}` : '-';
  if (statValues[3]) statValues[3].textContent = `${badges.length} / 6`;

  const fill = document.getElementById('xpFill');
  if (fill) fill.style.width = `${pct}%`;
  const milestone = document.getElementById('milestoneProg');
  if (milestone) milestone.style.width = `${pct}%`;

  const profileName = document.querySelector('.profile-info strong');
  if (profileName) profileName.textContent = entry?.picker_name || rewardsUser().name || 'Picker';

  const avatar = document.querySelector('.avatar');
  if (avatar) avatar.textContent = initials(entry?.picker_name || rewardsUser().name);

  const rankBadge = document.querySelector('.rank-badge');
  if (rankBadge) rankBadge.textContent = `Level ${level}`;

  const xpBreakdown = document.querySelector('.xp-breakdown');
  if (xpBreakdown) {
    xpBreakdown.innerHTML = `
      <div class="xp-breakdown-item"><div class="dot" style="background:var(--c-green)"></div><span class="lbl">Recycling Transactions</span><span class="val">+${xp.toLocaleString()} XP</span></div>
      <div class="xp-breakdown-item"><div class="dot" style="background:#f57f17"></div><span class="lbl">Total Collected</span><span class="val">${Number(entry?.totalKg || 0).toLocaleString()} kg</span></div>
      <div class="xp-breakdown-item"><div class="dot" style="background:#6a1b9a"></div><span class="lbl">Transactions</span><span class="val">${entry?.transactionCount || 0}</span></div>
      <div class="xp-breakdown-item"><div class="dot" style="background:#1565c0"></div><span class="lbl">Leaderboard</span><span class="val">#${entry?.rank || '-'}</span></div>`;
  }
}

function closestRewardsPanelByText(text) {
  const label = Array.from(document.querySelectorAll('*')).find(el =>
    el.children.length === 0 && new RegExp(text, 'i').test(el.textContent || '')
  );
  if (!label) return null;
  return label.closest('.card, .panel, .overview-card, .streak-card, .reward-section') ||
    label.parentElement?.parentElement?.parentElement ||
    label.parentElement;
}

function setLargestNumberInPanel(panel, value) {
  if (!panel) return;
  const candidates = Array.from(panel.querySelectorAll('*')).filter(el =>
    /^\d+$/.test((el.textContent || '').trim())
  );
  const target = candidates
    .map(el => ({ el, size: Number.parseFloat(getComputedStyle(el).fontSize) || 0 }))
    .sort((a, b) => b.size - a.size)[0]?.el;
  if (target) target.textContent = String(value);
}

function updateMilestoneRow(panel, days, streak, xp, label = '') {
  const row = Array.from(panel.querySelectorAll('*')).find(el =>
    new RegExp(`${days}\\s*-?\\s*Day`, 'i').test(el.textContent || '')
  )?.closest('li, .milestone, .streak-milestone, div');

  if (!row) return;

  const earned = streak >= days;
  row.classList.toggle('earned', earned);
  row.classList.toggle('locked', !earned);

  const icon = row.querySelector('svg, i, .icon') || row.querySelector('*');
  if (icon && icon.textContent && /^[✓✔🔒]/.test(icon.textContent.trim())) {
    icon.textContent = earned ? '✓' : '🔒';
  }

  const status = Array.from(row.querySelectorAll('*')).find(el =>
    /earned|away|badge|xp/i.test(el.textContent || '') && el.children.length === 0
  );
  const remaining = Math.max(0, days - streak);
  if (status) {
    status.textContent = earned
      ? `+${Number(xp).toLocaleString()} XP earned`
      : `+${Number(xp).toLocaleString()} XP${label ? ` - ${label}` : ` - ${remaining} days away`}`;
  }
}

function updateDailyStreakCard(entry, settings = {}) {
  const panel = closestRewardsPanelByText('DAILY STREAK');
  if (!panel) return;

  const streak = Number(entry?.streak || 0);
  const checkinXp = Number(settings.daily_checkin_xp || 50);
  setLargestNumberInPanel(panel, streak);

  const summary = Array.from(panel.querySelectorAll('*')).find(el =>
    /Day Streak/i.test(el.textContent || '') && el.children.length === 0
  );
  if (summary) summary.textContent = `${streak} Day Streak - ${streak > 0 ? 'Keep it going' : 'Start today'}`;

  const nextMilestone = [7, 10, 15, 30].find(days => streak < days);
  const bonus = Array.from(panel.querySelectorAll('*')).find(el =>
    /Streak Bonus unlocks/i.test(el.textContent || '')
  );
  if (bonus) {
    bonus.textContent = nextMilestone
      ? `Streak Bonus unlocks in ${nextMilestone - streak} more days`
      : 'All streak milestones unlocked';
  }

  const claimButton = Array.from(panel.querySelectorAll('button')).find(button =>
    /Claim Daily Check/i.test(button.textContent || '')
  );
  if (claimButton) claimButton.textContent = `Claim Daily Check-in (+${checkinXp} XP)`;

  updateMilestoneRow(panel, 7, streak, 200);
  updateMilestoneRow(panel, 10, streak, 400);
  updateMilestoneRow(panel, 15, streak, 600);
  updateMilestoneRow(panel, 30, streak, 1500, 'Legendary Badge');
}

function updateLevelMilestones(entry, settings = {}) {
  const panel = closestRewardsPanelByText('Level Milestones');
  if (!panel) return;

  const xp = Number(entry?.xp || 0);
  const xpPerLevel = Number(settings.xp_per_level || REWARDS_XP_PER_LEVEL);
  const currentLevel = Number(entry?.level || Math.floor(xp / xpPerLevel) + 1);
  const milestones = [
    { level: 1, label: 'Starter', xp: 0 },
    { level: 3, label: 'Collector', xp: 500 },
    { level: 5, label: 'Recycler', xp: 1500 },
    { level: 7, label: 'Champion', xp: 3000 },
    { level: 9, label: 'Legend', xp: 5000 },
    { level: 12, label: 'EcoHero', xp: 10000 },
  ];
  const next = milestones.find(item => xp < item.xp) || milestones[milestones.length - 1];
  const previous = [...milestones].reverse().find(item => xp >= item.xp) || milestones[0];
  const span = Math.max(1, next.xp - previous.xp);
  const pct = next === previous ? 100 : Math.min(100, Math.max(0, ((xp - previous.xp) / span) * 100));

  const topPercent = Array.from(panel.querySelectorAll('*')).find(el =>
    /% to Level/i.test(el.textContent || '') && el.children.length === 0
  );
  if (topPercent) topPercent.textContent = next.xp <= xp ? 'All milestones reached' : `${Math.round(pct)}% to Level ${next.level}`;

  milestones.forEach(item => {
    const node = Array.from(panel.querySelectorAll('*')).find(el =>
      new RegExp(`Lv\\.\\s*${item.level}\\b`, 'i').test(el.textContent || '')
    );
    const milestone = node?.closest('li, .milestone, .level-node, div');
    if (!milestone) return;

    const achieved = xp >= item.xp;
    const active = item.level === currentLevel || (!achieved && item === next);
    milestone.classList.toggle('achieved', achieved);
    milestone.classList.toggle('active', active);
    milestone.classList.toggle('locked', !achieved);

    const iconText = milestone.querySelector('.check, .lock, .icon') || milestone.querySelector('*');
    if (iconText && iconText.children.length === 0 && /^[✓✔🔒]|\d+$/.test(iconText.textContent.trim())) {
      iconText.textContent = achieved ? '✓' : '🔒';
    }
  });

  const progress = panel.querySelector('.progress-fill, .milestone-progress, .level-progress-fill');
  if (progress) progress.style.width = `${pct}%`;
}

function updateRewardsChallenges(challenges) {
  const panel = document.getElementById('tab-challenges');
  if (!panel) return;

  let list = document.getElementById('challengeList') ||
    panel.querySelector('.challenge-list, .challenges-list');
  if (!list) {
    const heading = Array.from(panel.querySelectorAll('*')).find(el => /Active Challenges/i.test(el.textContent || ''));
    const card = heading?.closest('.card');
    if (card) {
      list = document.createElement('div');
      list.id = 'challengeList';
      card.appendChild(list);
    } else {
      list = panel;
    }
  }

  const rows = Array.isArray(challenges) ? challenges : [];
  if (!rows.length) {
    list.innerHTML = '<div class="challenge-item">No challenge data yet. Record transactions to begin.</div>';
    return;
  }

  list.innerHTML = rows.map(item => {
    const pct = item.target ? Math.min(100, Math.round((Number(item.progress || 0) / Number(item.target || 1)) * 100)) : 0;
    return `
      <div class="challenge-item ${item.completed ? 'complete' : ''}" data-type="${item.type || 'daily'}">
        <div class="ch-icon">
          <svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
        </div>
        <div class="ch-body">
          <div class="ch-type">${String(item.type || 'daily')}</div>
          <div class="ch-name">${item.title || 'Challenge'}</div>
          <div class="ch-desc">${item.description || ''}</div>
          <div class="ch-prog-bg"><div class="ch-prog-fill" style="width:${pct}%"></div></div>
        </div>
        <div class="ch-right">
          ${item.completed
            ? '<div class="ch-check"><svg fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path d="M20 6 9 17l-5-5"/></svg></div>'
            : `<div class="ch-xp">+${Number(item.xp || 0).toLocaleString()} XP</div>`}
        </div>
      </div>
    `;
  }).join('');
}

function updateWeeklyXpTrend(trend) {
  const chartTitle = Array.from(document.querySelectorAll('.card-title')).find(el =>
    /Weekly XP Trend/i.test(el.textContent || '')
  );
  const card = chartTitle?.closest('.card');
  if (!card || !trend?.values?.length) return;

  const maxXp = Math.max(...trend.values.map(row => Number(row.xp || 0)), 1);
  const bars = Array.from(card.querySelectorAll('.bar-chart .bar-wrap'));

  trend.values.forEach((row, index) => {
    const wrap = bars[index];
    if (!wrap) return;

    const bar = wrap.querySelector('.bar');
    const label = wrap.querySelector('.bar-lbl');
    const height = Math.max(12, Math.round((Number(row.xp || 0) / maxXp) * 84));

    if (bar) {
      bar.style.height = `${height}px`;
      bar.title = `${row.day}: ${Number(row.xp || 0).toLocaleString()} XP`;
      bar.classList.toggle('muted', Number(row.xp || 0) === 0);
    }

    if (label) label.textContent = row.day;
  });

  const summary = Array.from(card.querySelectorAll('div')).find(el =>
    /This week/i.test(el.textContent || '') && el.children.length === 0
  );
  if (summary) {
    summary.textContent = `This week · ${Number(trend.totalXp || 0).toLocaleString()} XP earned so far`;
  }
}

function timerRowByLabel(labelText) {
  return Array.from(document.querySelectorAll('*')).find(el =>
    el.children.length === 0 && new RegExp(labelText, 'i').test(el.textContent || '')
  )?.closest('div[style*="justify-content:space-between"], .timer-row, .challenge-timer');
}

function formatDuration(ms, includeDays = false) {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const hhmmss = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  return includeDays ? `${days}d ${hhmmss}` : hhmmss;
}

function nextUtcMidnight(now) {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1));
}

function nextUtcWeekStart(now) {
  const next = nextUtcMidnight(now);
  while (next.getUTCDay() !== 1) {
    next.setUTCDate(next.getUTCDate() + 1);
  }
  return next;
}

function nextEarthMonthEnd(now) {
  const year = now.getUTCMonth() > 4 || (now.getUTCMonth() === 4 && now.getUTCDate() > 31)
    ? now.getUTCFullYear() + 1
    : now.getUTCFullYear();
  return new Date(Date.UTC(year, 4, 31, 23, 59, 59));
}

function setTimerText(label, value) {
  const row = timerRowByLabel(label);
  const target = row?.querySelector('span:last-child');
  if (target) target.textContent = value;
}

function updateChallengeTimers() {
  const now = new Date();
  setTimerText('Daily challenges reset', formatDuration(nextUtcMidnight(now) - now));
  setTimerText('Weekly challenges reset', formatDuration(nextUtcWeekStart(now) - now, true));
  setTimerText('Earth Month ends', formatDuration(nextEarthMonthEnd(now) - now, true));
}

function updateRewardStore(storeItems) {
  if (!Array.isArray(storeItems) || !storeItems.length) return;

  const cards = document.querySelectorAll('#tab-store .reward-card');
  cards.forEach((card, index) => {
    const item = storeItems[index];
    if (!item) return;

    card.dataset.rewardId = item.id;
    card.dataset.cat = item.category || card.dataset.category || 'general';
    card.dataset.category = item.category || card.dataset.category || 'general';

    const title = card.querySelector('.reward-name, h3, strong');
    if (title) title.textContent = item.name;

    const cost = card.querySelector('.reward-cost, .cost');
    if (cost) cost.textContent = `${Number(item.xp_cost || 0).toLocaleString()} XP`;

    const button = card.querySelector('.btn-redeem');
    if (button) {
      button.onclick = () => redeemReward(button, item.name, item.xp_cost, item.id);
    }
  });
}

function updateRewardBadges(badges, earnedBadges) {
  if (!Array.isArray(badges) || !badges.length) return;

  const earnedCodes = new Set((earnedBadges || []).map(badge => badge.code || badge.name));
  document.querySelectorAll('#tab-badges .badge-item').forEach((badgeEl, index) => {
    const badge = badges[index];
    if (!badge) return;

    badgeEl.dataset.rarity = badge.rarity || 'common';
    badgeEl.classList.toggle('new', earnedCodes.has(badge.code) || earnedCodes.has(badge.name));
    badgeEl.onclick = () => showBadge(badge.name, badge.description || '', badge.rarity || 'common');

    const name = badgeEl.querySelector('.badge-name, strong');
    if (name) name.textContent = badge.name;
  });
}

function setActiveButton(activeButton, selector) {
  document.querySelectorAll(selector).forEach(button => button.classList.remove('active'));
  if (activeButton) activeButton.classList.add('active');
}

window.switchTab = function switchTab(tabName, button) {
  document.querySelectorAll('.tab-panel').forEach(panel => panel.classList.remove('active'));
  const panel = document.getElementById(`tab-${tabName}`);
  if (panel) panel.classList.add('active');
  setActiveButton(button, '.tabs .tab');
};

window.filterChallenges = function filterChallenges(type, button) {
  setActiveButton(button, '#tab-challenges .filter-tab');
  document.querySelectorAll('#tab-challenges .challenge-item').forEach(item => {
    item.style.display = type === 'all' || item.dataset.type === type ? '' : 'none';
  });
};

window.switchLeaderboard = function switchLeaderboard(type, button) {
  setActiveButton(button, '#tab-leaderboard .filter-tab');
  const view = rewardsLastData?.leaderboardViews?.[type] || rewardsLastData?.leaderboard || [];
  updateRewardsLeaderboard(view);

  const subtitles = {
    overall: 'Overall · All time',
    weekly: 'Rankings · This week',
    monthly: 'Rankings · This month',
    department: 'Department / zone rankings',
    improved: 'Most improved this month',
  };
  setText('lbSubtitle', subtitles[type] || button?.textContent?.trim() || type);
  if (type === 'department') updateDepartmentRankings(rewardsLastData?.departmentRankings || []);
  showToast('Leaderboard Updated', `${button?.textContent?.trim() || type} view selected`, true);
};

window.filterStore = function filterStore(type, button) {
  setActiveButton(button, '#tab-store .filter-tab');
  document.querySelectorAll('#tab-store .reward-card').forEach(card => {
    const category = card.dataset.category || card.dataset.cat || '';
    card.style.display = type === 'all' || category === type ? '' : 'none';
  });
};

window.filterBadges = function filterBadges(rarity, button) {
  setActiveButton(button, '#tab-badges .filter-tab');
  document.querySelectorAll('#tab-badges .badge-item').forEach(badge => {
    badge.style.display = rarity === 'all' || badge.dataset.rarity === rarity ? '' : 'none';
  });
};

window.openModal = function openModal(name) {
  const modal = document.getElementById(`${name}Modal`);
  if (modal) modal.classList.add('active');
};

window.closeModal = function closeModal(name) {
  const modal = document.getElementById(`${name}Modal`);
  if (modal) modal.classList.remove('active');
};

function ensureRewardsAdminPanel() {
  let modal = document.getElementById('adminModal') || document.getElementById('rewardsAdminModal');
  if (modal) return modal;

  modal = document.createElement('div');
  modal.id = 'adminModal';
  modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.42);z-index:9999;display:none;align-items:center;justify-content:center;padding:20px';
  modal.innerHTML = `
    <div class="modal-content" style="background:#fff;border-radius:16px;width:min(680px,94vw);max-height:88vh;overflow:auto;padding:22px;box-shadow:0 20px 60px rgba(0,0,0,.25)">
      <div style="display:flex;justify-content:space-between;align-items:center;gap:12px;margin-bottom:16px">
        <div>
          <h2 style="margin:0;font-family:Sora,sans-serif">Rewards Admin Panel</h2>
          <p style="margin:4px 0 0;color:#666">Manage XP and reward requests</p>
        </div>
        <button type="button" id="closeRewardsAdminPanel" style="border:1px solid #ddd;background:#fff;border-radius:10px;padding:8px 12px;cursor:pointer">Close</button>
      </div>

      <div style="display:grid;gap:10px;margin-bottom:18px">
        <label style="font-weight:700">XP Amount</label>
        <input id="adminXPAmount" type="number" placeholder="Example: 50" style="padding:11px 12px;border:1px solid #ddd;border-radius:10px">
        <div style="display:flex;gap:10px;flex-wrap:wrap">
          <button type="button" class="btn btn-primary" onclick="adminAwardXP()">Award XP</button>
          <button type="button" class="btn btn-ghost" onclick="adminDeductXP()">Deduct XP</button>
        </div>
      </div>

      <h3 style="font-family:Sora,sans-serif;margin:12px 0">Pending Redemptions</h3>
      <div id="adminRedemptions" style="display:grid;gap:10px"></div>
    </div>
  `;
  document.body.appendChild(modal);
  modal.querySelector('#closeRewardsAdminPanel').onclick = closeRewardsAdminPanel;
  modal.addEventListener('click', event => {
    if (event.target === modal) closeRewardsAdminPanel();
  });
  return modal;
}

function openRewardsAdminPanel() {
  const modal = ensureRewardsAdminPanel();
  modal.style.display = '';
  modal.classList.add('open');
  modal.classList.add('active');
  renderRewardRedemptions(rewardsRedemptions);
}

function closeRewardsAdminPanel() {
  const modal = document.getElementById('adminModal') || document.getElementById('rewardsAdminModal');
  if (!modal) return;
  modal.classList.remove('open');
  modal.classList.remove('active');
  modal.style.display = '';
}

window.openRewardsAdminPanel = openRewardsAdminPanel;
window.closeRewardsAdminPanel = closeRewardsAdminPanel;

const originalRewardsOpenModal = window.openModal;
const originalRewardsCloseModal = window.closeModal;

window.openModal = function openModal(id) {
  if (id === 'admin') {
    openRewardsAdminPanel();
    return;
  }
  if (typeof originalRewardsOpenModal === 'function') {
    originalRewardsOpenModal(id);
    return;
  }
  document.getElementById(`${id}Modal`)?.classList.add('open');
};

window.closeModal = function closeModal(id) {
  if (id === 'admin') {
    closeRewardsAdminPanel();
    return;
  }
  if (typeof originalRewardsCloseModal === 'function') {
    originalRewardsCloseModal(id);
    return;
  }
  document.getElementById(`${id}Modal`)?.classList.remove('open');
};

function wireRewardsAdminButton() {
  const button = findRewardsAdminButton();
  if (!button) return;

  button.style.display = '';
  button.style.cursor = 'pointer';
  if (button.dataset.rewardsAdminWired === 'true') return;
  button.dataset.rewardsAdminWired = 'true';
  button.onclick = event => {
    event.preventDefault();
    event.stopPropagation();
    openRewardsAdminPanel();
  };
  button.addEventListener('click', event => {
    event.preventDefault();
    event.stopPropagation();
    openRewardsAdminPanel();
  }, true);
}

window.showBadge = function showBadge(name, description, rarity) {
  setText('badgeModalName', name);
  setText('badgeModalDesc', description);
  setText('badgeModalRarity', rarity ? rarity.toUpperCase() : '');
  openModal('badge');
};

window.showToast = function showToast(title, message, isSuccess = true) {
  const container = document.getElementById('toastContainer');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast ${isSuccess ? '' : 'error'}`;
  toast.innerHTML = `
    <strong>${title}</strong>
    <span>${message}</span>`;
  container.appendChild(toast);

  setTimeout(() => toast.classList.add('show'), 20);
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 250);
  }, 3200);
};

window.addXP = async function addXP(amount, message) {
  if (!rewardsCurrentPickerId) {
    showToast('No Picker Found', 'Load rewards first, then try again.', false);
    return;
  }

  try {
    await rewardsPost('/rewards/add', {
      picker_id: rewardsCurrentPickerId,
      xp: Number(amount || 0),
      reason: message || 'Bonus XP',
    });
    await loadDatabaseRewards();
    showToast('XP Saved', message || `Added ${amount} XP`, true);
  } catch (err) {
    showToast('Could Not Save XP', err.message, false);
  }
};

window.claimBonus = async function claimBonus(button) {
  if (!rewardsCurrentPickerId) {
    showToast('No Picker Found', 'Load rewards first, then try again.', false);
    return;
  }

  try {
    await rewardsPost('/rewards/daily-checkin', { picker_id: rewardsCurrentPickerId });
    if (button) {
      button.disabled = true;
      button.textContent = 'Daily Check-in Claimed';
    }
    await loadDatabaseRewards();
    showToast('Daily Check-in Saved', 'Your daily check-in XP was saved.', true);
  } catch (err) {
    showToast('Could Not Save Check-in', err.message, false);
  }
};

window.redeemReward = async function redeemReward(button, rewardName, cost, rewardItemId) {
  const xpCost = Number(cost || 0);
  if (!rewardsCurrentPickerId) {
    showToast('No Picker Found', 'Load rewards first, then try again.', false);
    return;
  }

  if (rewardsCurrentXP < xpCost) {
    showToast('Not Enough XP', `${rewardName} costs ${xpCost.toLocaleString()} XP`, false);
    return;
  }

  try {
    await rewardsPost('/rewards/redeem', {
      picker_id: rewardsCurrentPickerId,
      reward_item_id: rewardItemId || button?.closest('.reward-card')?.dataset.rewardId || null,
      reward_name: rewardName,
      xp_cost: xpCost,
    });
    if (button) button.textContent = 'Requested';
    await loadDatabaseRewards();
    showToast('Reward Requested', `${rewardName} redemption was saved.`, true);
  } catch (err) {
    showToast('Could Not Redeem Reward', err.message, false);
  }
};

window.adminAwardXP = async function adminAwardXP() {
  const amount = Number(document.getElementById('adminXPAmount')?.value || 0);
  if (!amount) {
    showToast('Enter XP Amount', 'Please enter an amount first', false);
    return;
  }
  await addXP(amount, `Admin awarded ${amount.toLocaleString()} XP`);
};

window.adminDeductXP = async function adminDeductXP() {
  const amount = Number(document.getElementById('adminXPAmount')?.value || 0);
  await addXP(-Math.abs(amount), `Admin deducted ${amount.toLocaleString()} XP`);
};

window.approveRedemption = async function approveRedemption(button, rewardName, redemptionId) {
  const id = redemptionId || button?.closest('[data-redemption-id]')?.dataset.redemptionId;
  if (!id) {
    showToast('Missing Request', 'Could not find this redemption request.', false);
    return;
  }

  try {
    await rewardsPut(`/rewards/redemptions/${id}/status`, { status: 'approved' });
    await loadDatabaseRewards();
    showToast('Redemption Approved', `${rewardName || 'Reward'} was approved`, true);
  } catch (err) {
    showToast('Could Not Approve', err.message, false);
  }
};

window.rejectRedemption = async function rejectRedemption(button, redemptionId) {
  const id = redemptionId || button?.closest('[data-redemption-id]')?.dataset.redemptionId;
  if (!id) {
    showToast('Missing Request', 'Could not find this redemption request.', false);
    return;
  }

  try {
    await rewardsPut(`/rewards/redemptions/${id}/status`, { status: 'rejected' });
    await loadDatabaseRewards();
    showToast('Redemption Rejected', 'The request was rejected', false);
  } catch (err) {
    showToast('Could Not Reject', err.message, false);
  }
};

function updateRewardsLeaderboard(leaderboard) {
  const container = document.getElementById('leaderboardList');
  if (!container) return;

  container.innerHTML = leaderboard.slice(0, 10).map(entry => `
    <div class="lb-item ${entry.picker_id === rewardsCurrentPickerId ? 'me' : ''}">
      <span class="lb-rank ${entry.rank === 1 ? 'r1' : entry.rank === 2 ? 'r2' : entry.rank === 3 ? 'r3' : ''}">${entry.rank}</span>
      <div class="lb-avatar">${initials(entry.picker_name)}</div>
      <div class="lb-name">${entry.picker_name}${entry.picker_id === rewardsCurrentPickerId ? ' <span class="lb-you">YOU</span>' : ''}</div>
      <span class="lb-xp">${Number(entry.xp || 0).toLocaleString()} XP</span>
      <span class="lb-move">Lv ${entry.level || 1}</span>
    </div>`).join('') || '<div class="lb-item">No rewards data yet.</div>';
}

function updateDepartmentRankings(rankings) {
  const title = Array.from(document.querySelectorAll('.card-title')).find(el =>
    /Department Rankings/i.test(el.textContent || '')
  );
  const card = title?.closest('.card');
  if (!card) return;

  const rows = Array.isArray(rankings) ? rankings.slice(0, 5) : [];
  const existing = Array.from(card.children).filter(child => child !== title);
  existing.forEach(child => child.remove());

  const maxXp = Math.max(...rows.map(row => Number(row.xp || 0)), 1);
  const currentZone = rewardsCurrentEntry?.zone || '';

  const wrapper = document.createElement('div');
  wrapper.style.cssText = 'display:flex;flex-direction:column;gap:12px';
  wrapper.innerHTML = rows.length ? rows.map(row => `
    <div class="lb-item ${row.zone === currentZone ? 'me' : ''}">
      <span class="lb-rank ${row.rank === 1 ? 'r1' : row.rank === 2 ? 'r2' : row.rank === 3 ? 'r3' : ''}">${row.rank}</span>
      <div class="lb-name">
        ${row.zone || 'Unassigned'} ${row.zone === currentZone ? '<span class="lb-you">YOUR ZONE</span>' : ''}
        <div style="font-size:12px;color:var(--c-text-3);font-weight:400">${row.pickerCount} pickers · avg ${Number(row.avgXp || 0).toLocaleString()} XP</div>
      </div>
      <span class="lb-xp">${Number(row.xp || 0).toLocaleString()} XP</span>
      <span style="width:72px;height:4px;background:var(--c-border-light);border-radius:99px;overflow:hidden">
        <span style="display:block;height:100%;width:${Math.round((Number(row.xp || 0) / maxXp) * 100)}%;background:var(--c-green)"></span>
      </span>
    </div>
  `).join('') : '<div class="lb-item">No department data yet.</div>';

  card.appendChild(wrapper);
}

function updateCommunityStats(stats, entry) {
  const title = Array.from(document.querySelectorAll('.card-title')).find(el =>
    /Your Stats vs Community/i.test(el.textContent || '')
  );
  const card = title?.closest('.card');
  if (!card || !entry) return;

  const top = stats?.top || entry;
  const topXp = Math.max(Number(top.xp || 0), 1);
  const entryXp = Number(entry.xp || 0);
  const avgXp = Number(stats?.averageXp || 0);
  const pctVsTop = Math.min(100, Math.round((entryXp / topXp) * 100));
  const pctVsAvg = avgXp ? Math.round(((entryXp - avgXp) / avgXp) * 100) : 0;
  const next = (rewardsLastData?.leaderboard || []).find(row => Number(row.rank) < Number(entry.rank) && Number(row.xp) > entryXp);
  const needed = next ? Number(next.xp || 0) - entryXp : 0;

  Array.from(card.children).forEach(child => {
    if (child !== title) child.remove();
  });

  const wrapper = document.createElement('div');
  wrapper.innerHTML = `
    <div style="display:flex;justify-content:space-between;font-size:12px;color:var(--c-text-3);margin-bottom:4px">
      <span>XP vs #1 (${top.picker_name || 'Top picker'})</span>
      <span>${entryXp.toLocaleString()} / ${topXp.toLocaleString()}</span>
    </div>
    <div style="height:8px;background:var(--c-border-light);border-radius:99px;overflow:hidden;margin-bottom:14px">
      <div style="height:100%;width:${pctVsTop}%;background:linear-gradient(90deg,#1565c0,#6a1b9a);border-radius:99px"></div>
    </div>
    <div style="display:flex;justify-content:space-between;font-size:12px;color:var(--c-text-3);margin-bottom:4px">
      <span>Community Average</span>
      <span style="color:var(--c-green);font-weight:700">${pctVsAvg >= 0 ? '+' : ''}${pctVsAvg}% vs avg</span>
    </div>
    <div style="height:8px;background:var(--c-border-light);border-radius:99px;overflow:hidden;margin-bottom:14px">
      <div style="height:100%;width:${avgXp ? Math.min(100, Math.round((entryXp / avgXp) * 50)) : 0}%;background:var(--c-green);border-radius:99px"></div>
    </div>
    <div style="padding:12px;border:1px solid #90caf9;background:#e3f2fd;border-radius:var(--r-sm);font-size:13px;color:#0d47a1">
      ${next ? `You need <strong>${needed.toLocaleString()} XP</strong> to reach #${next.rank} (${next.picker_name}).` : 'You are at the top of the leaderboard.'}
    </div>
  `;
  card.appendChild(wrapper);
}

function updateRewardsTicker(leaderboard) {
  const inner = document.getElementById('tickerInner');
  if (!inner) return;

  const events = leaderboard.map(entry =>
    `${entry.picker_name} has ${Number(entry.xp || 0).toLocaleString()} XP from ${Number(entry.totalKg || 0).toLocaleString()} kg collected`
  );
  const doubled = [...events, ...events];

  inner.innerHTML = doubled.map(text => `<span style="padding-right:48px">${text}</span>`).join('');
}

function updateRewardsFeed(leaderboard) {
  const feed = document.getElementById('feedList');
  if (!feed) return;

  feed.innerHTML = leaderboard.slice(0, 8).map(entry => `
    <div class="feed-item">
      <div class="feed-dot xp"></div>
      <div class="feed-text">
        <strong>${entry.picker_name}</strong>
        <span>${Number(entry.totalKg || 0).toLocaleString()} kg collected · ${Number(entry.xp || 0).toLocaleString()} XP</span>
      </div>
      <span class="feed-time">${entry.lastActive || ''}</span>
    </div>`).join('');
}

function updateRewardsActivity(activity) {
  const feed = document.getElementById('feedList');
  if (!feed) return;
  rewardsDatabaseFeedReady = true;

  if (!Array.isArray(activity) || !activity.length) {
    feed.innerHTML = `
      <div class="feed-item">
        <div class="feed-dot xp"></div>
        <div class="feed-text">
          <strong>No rewards activity yet</strong>
          <span>Transactions, check-ins, and redemptions will appear here.</span>
        </div>
        <span class="feed-time"></span>
      </div>`;
    return;
  }

  feed.innerHTML = activity.slice(0, 10).map(item => `
    <div class="feed-item">
      <div class="feed-dot xp"></div>
      <div class="feed-text">
        <strong>${item.title || 'Rewards Activity'}</strong>
        <span>${item.description || ''}</span>
      </div>
      <span class="feed-time">${item.created_at ? new Date(item.created_at).toLocaleDateString() : ''}</span>
    </div>`).join('');
}

function findRewardsAdminButton() {
  return Array.from(document.querySelectorAll('button, a, [role="button"], .admin-panel-btn, .admin-btn, .topbar-action, .action-btn, div, span')).find(el => {
    const text = String(el.textContent || '').replace(/\s+/g, ' ').trim();
    if (!/admin panel/i.test(text)) return false;
    const rect = el.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
  });
}

function adminPanelElementFromEvent(event) {
  const path = typeof event.composedPath === 'function' ? event.composedPath() : [];
  const match = path.find(el => {
    if (!el || el.nodeType !== 1) return false;
    if (el === document.body || el === document.documentElement) return false;
    if (!el.matches?.('button, a, [role="button"], .topbar-btn, .admin-panel-btn, .admin-btn')) return false;
    return /admin panel/i.test(String(el.textContent || '').replace(/\s+/g, ' '));
  });

  if (!match) return null;
  return match.closest?.('button, a, [role="button"], .admin-panel-btn, .admin-btn, .topbar-action, .action-btn') || match;
}

function applyRewardsAdminAccess(canAdmin) {
  rewardsCanAdmin = Boolean(canAdmin);
  const button = findRewardsAdminButton();
  if (button) {
    button.style.display = rewardsCanAdmin ? '' : 'none';
    wireRewardsAdminButton();
  }

  document.querySelectorAll('.admin-only, #adminPanel, #adminModal').forEach(el => {
    if (el.id === 'adminModal') return;
    el.style.display = rewardsCanAdmin ? '' : 'none';
  });
}

function ensureRedemptionList() {
  const modal = document.getElementById('adminModal');
  if (!modal) return null;

  let host =
    document.getElementById('adminRedemptions') ||
    document.getElementById('redemptionRequests') ||
    modal.querySelector('.redemption-list');

  if (host) return host;

  const approvalTitle = Array.from(modal.querySelectorAll('.admin-title, h3, strong, div')).find(el =>
    /Pending Reward Approvals/i.test(el.textContent || '')
  );
  const approvalSection = approvalTitle?.closest('.admin-section');
  const existingList = approvalSection?.querySelector('div[style*="flex-direction:column"]');
  if (existingList) {
    existingList.id = 'adminRedemptions';
    return existingList;
  }

  const content = modal.querySelector('.modal-content') || modal;
  host = document.createElement('div');
  host.id = 'adminRedemptions';
  host.style.cssText = 'margin-top:18px;display:grid;gap:10px';
  content.appendChild(host);
  return host;
}

function renderRewardRedemptions(redemptions) {
  rewardsRedemptions = Array.isArray(redemptions) ? redemptions : [];
  const host = ensureRedemptionList();
  if (!host || !rewardsCanAdmin) return;

  const pending = rewardsRedemptions.filter(item => String(item.status || '').toLowerCase() === 'pending');
  if (!pending.length) {
    host.innerHTML = '<div style="padding:12px;border-radius:10px;background:#f7f7f7">No pending reward redemptions.</div>';
    return;
  }

  host.innerHTML = pending.map(item => `
    <div data-redemption-id="${item.id}" style="display:flex;align-items:center;justify-content:space-between;gap:12px;padding:12px;border:1px solid #e4e0d8;border-radius:10px;background:#fff">
      <div>
        <strong>${item.reward_name || 'Reward'}</strong>
        <div style="color:#666;font-size:14px">${Number(item.xp_cost || 0).toLocaleString()} XP - Picker ${item.picker_id || ''}</div>
      </div>
      <div style="display:flex;gap:8px">
        <button class="btn btn-primary" onclick="approveRedemption(this, '${escapeRewardAttr(item.reward_name || 'Reward')}', '${escapeRewardAttr(item.id)}')">Approve</button>
        <button class="btn btn-ghost" onclick="rejectRedemption(this, '${escapeRewardAttr(item.id)}')">Reject</button>
      </div>
    </div>
  `).join('');
}

async function loadDatabaseRewards() {
  if (!rewardsToken()) {
    window.location.href = '../AuthScreens/login.html';
    return;
  }

  try {
    const data = await rewardsFetch('/rewards');
    if (!data) return;
    rewardsLastData = data;

    applyRewardsAdminAccess(userCanAdminRewards(data));

    const leaderboard = data.leaderboard || [];
    const user = rewardsUser();
    const firstName = user.name?.split(' ')[0]?.toLowerCase() || '';
    const email = String(user.email || '').toLowerCase();
    const entry =
      leaderboard.find(row => String(row.picker_email || '').toLowerCase() === email) ||
      leaderboard.find(row => String(row.picker_name || '').toLowerCase().includes(firstName)) ||
      leaderboard[0] ||
      null;
    rewardsCurrentEntry = entry;

    updateRewardsProfile(entry, leaderboard);
    updateDailyStreakCard(entry, data.settings || {});
    updateLevelMilestones(entry, data.settings || {});
    updateRewardsChallenges(entry?.challenges || []);
    updateWeeklyXpTrend(entry?.weeklyXpTrend);
    updateRewardsLeaderboard(leaderboard);
    updateDepartmentRankings(data.departmentRankings || []);
    updateCommunityStats(data.communityStats || {}, entry);
    updateRewardsTicker(leaderboard);
    updateRewardStore(data.storeItems || []);
    updateRewardBadges(data.badges || [], entry?.badges || []);
    updateRewardsActivity(data.activity || []);
    renderRewardRedemptions(data.redemptions || []);
    if (!data.activity?.length) updateRewardsFeed(leaderboard);
  } catch (err) {
    console.error('Could not load database rewards:', err.message);
    showToast('Rewards Error', err.message, false);
  }
}

window.addEventListener('load', () => {
  wireRewardsAdminButton();
  updateChallengeTimers();
  setInterval(updateChallengeTimers, 1000);
  setTimeout(loadDatabaseRewards, 800);
});

document.addEventListener('DOMContentLoaded', wireRewardsAdminButton);

document.addEventListener('click', event => {
  const button = adminPanelElementFromEvent(event);
  if (!button) return;

  event.preventDefault();
  event.stopPropagation();
  event.stopImmediatePropagation();
  openRewardsAdminPanel();
}, true);

let rewardsAdminWireAttempts = 0;
const rewardsAdminWireTimer = setInterval(() => {
  wireRewardsAdminButton();
  rewardsAdminWireAttempts += 1;
  if (rewardsAdminWireAttempts > 30 || findRewardsAdminButton()) {
    clearInterval(rewardsAdminWireTimer);
  }
}, 500);
