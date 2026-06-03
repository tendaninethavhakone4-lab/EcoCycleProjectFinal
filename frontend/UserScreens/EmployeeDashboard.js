const API_URL = 'http://localhost:4000/api';

let lineChartInstance = null;
let donutChartInstance = null;

function getToken() {
  return localStorage.getItem('token');
}

function getUser() {
  return JSON.parse(localStorage.getItem('user') || '{}');
}

function authHeaders() {
  return { 'Authorization': `Bearer ${getToken()}` };
}

function money(value) {
  return 'R ' + Number(value || 0).toLocaleString('en-ZA', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function kg(value) {
  return Number(value || 0).toLocaleString('en-ZA') + ' kg';
}

function timeAgo(dateValue) {
  const date = new Date(dateValue);
  const seconds = Math.max(0, Math.floor((Date.now() - date.getTime()) / 1000));
  if (seconds < 60) return 'Just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hr${hours === 1 ? '' : 's'} ago`;
  const days = Math.floor(hours / 24);
  return `${days} day${days === 1 ? '' : 's'} ago`;
}

async function fetchJson(path) {
  const response = await fetch(`${API_URL}${path}`, { headers: authHeaders() });
  if (response.status === 401) {
    window.location.href = '../AuthScreens/login.html';
    return null;
  }
  if (!response.ok) throw new Error(`Request failed: ${path}`);
  return response.json();
}

async function loadDashboard() {
  try {
    const [summary, pickersData, txData] = await Promise.all([
      fetchJson('/transactions/summary'),
      fetchJson('/admin/pickers'),
      fetchJson('/transactions'),
    ]);

    if (!summary || !pickersData || !txData) return;

    const values = document.querySelectorAll('.stat-card-left .value');
    if (values[0]) values[0].textContent = Number(summary.totalTransactions || 0).toLocaleString();
    if (values[1]) values[1].textContent = kg(summary.totalKg || 0);
    if (values[2]) values[2].textContent = money(summary.totalPayouts || 0);

    const captions = document.querySelectorAll('.stat-card-left .caption');
    if (captions[0]) captions[0].textContent = `${pickersData.pickers?.length || 0} active pickers`;
    if (captions[1]) captions[1].textContent = 'Total recycled';
    if (captions[2]) captions[2].textContent = 'Total paid out';

    renderCharts(summary, txData.transactions || []);
    renderRecentTransactions(txData.transactions || []);
  } catch (err) {
    console.error('Could not load dashboard data:', err.message);
  }
}

function renderCharts(summary, transactions) {
  const monthlyMap = {};
  transactions.forEach(t => {
    const month = new Date(t.created_at).toLocaleString('en-ZA', { month: 'short' });
    monthlyMap[month] = (monthlyMap[month] || 0) + Number(t.quantity || 0);
  });

  const tip = {
    backgroundColor: '#fff',
    borderColor: '#ebebeb',
    borderWidth: 1,
    titleColor: '#1a1a1a',
    bodyColor: '#7a7a7a',
    padding: 12,
    cornerRadius: 10,
  };

  const lineCanvas = document.getElementById('lineChart');
  if (lineCanvas) {
    if (lineChartInstance) lineChartInstance.destroy();
    lineChartInstance = new Chart(lineCanvas, {
      type: 'line',
      data: {
        labels: Object.keys(monthlyMap),
        datasets: [{
          label: 'kg collected',
          data: Object.values(monthlyMap),
          borderColor: '#3a9e3f',
          borderWidth: 2.5,
          pointBackgroundColor: '#3a9e3f',
          pointRadius: 4,
          tension: 0.4,
          fill: true,
          backgroundColor: (ctx) => {
            const g = ctx.chart.ctx.createLinearGradient(0, 0, 0, 200);
            g.addColorStop(0, 'rgba(58,158,63,.15)');
            g.addColorStop(1, 'rgba(58,158,63,0)');
            return g;
          },
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false }, tooltip: tip },
        scales: {
          x: { grid: { display: false }, border: { display: false } },
          y: {
            grid: { color: 'rgba(0,0,0,.05)' },
            border: { display: false },
            ticks: { callback: v => v + ' kg' },
          },
        },
      },
    });
  }

  const byMaterial = summary.byMaterial || {};
  const labels = Object.keys(byMaterial);
  const data = labels.map(m => byMaterial[m].kg || 0);

  const donutCanvas = document.getElementById('donutChart');
  if (donutCanvas) {
    if (donutChartInstance) donutChartInstance.destroy();
    donutChartInstance = new Chart(donutCanvas, {
      type: 'doughnut',
      data: {
        labels,
        datasets: [{
          data,
          backgroundColor: ['#3a9e3f', '#5dbb62', '#1f5c22', '#8dc98f', '#c5e8c6'],
          borderWidth: 0,
          hoverOffset: 8,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '70%',
        plugins: {
          legend: {
            position: 'bottom',
            labels: { boxWidth: 12, padding: 16, usePointStyle: true, pointStyle: 'circle' },
          },
          tooltip: { ...tip, callbacks: { label: ctx => ` ${ctx.label}: ${ctx.parsed} kg` } },
        },
      },
    });
  }
}

function renderRecentTransactions(transactions) {
  const recentSection = [...document.querySelectorAll('.section-card')]
    .find(section => section.querySelector('.section-title')?.textContent.trim() === 'Recent Transactions');

  if (!recentSection) return;

  [...recentSection.querySelectorAll('.activity-item')].forEach(item => item.remove());

  if (!transactions.length) {
    const empty = document.createElement('div');
    empty.className = 'activity-item';
    empty.innerHTML = `
      <div class="activity-left">
        <div>
          <h4>No transactions yet</h4>
          <p>Recorded transactions will appear here.</p>
        </div>
      </div>`;
    recentSection.appendChild(empty);
    return;
  }

  transactions.slice(0, 4).forEach(txn => {
    const item = document.createElement('div');
    item.className = 'activity-item';
    item.innerHTML = `
      <div class="activity-left">
        <div class="activity-icon">
          <svg fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
        </div>
        <div>
          <h4>${txn.picker_name || txn.picker_id} - ${txn.material || 'Material'}</h4>
          <p>${txn.zone || txn.branch || 'No zone'} · Recorded by ${txn.recorded_by || 'Employee'}</p>
        </div>
      </div>
      <div class="activity-right">
        <div class="amount">${Number(txn.quantity || 0)} kg · ${money(txn.total)}</div>
        <div class="time">${timeAgo(txn.created_at)}</div>
      </div>`;
    recentSection.appendChild(item);
  });
}

document.addEventListener('DOMContentLoaded', () => {
  if (!getToken()) {
    window.location.href = '../AuthScreens/login.html';
    return;
  }

  const user = getUser();
  const greeting = document.querySelector('.greeting, h1, .page-title');
  if (greeting && user.name) {
    greeting.textContent = `Welcome back, ${user.name.split(' ')[0]}!`;
  }

  loadDashboard();

  const logoutBtn = document.querySelector('.topbar-logout, #logoutBtn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', () => {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '../AuthScreens/login.html';
    });
  }
});
