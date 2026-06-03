const API_URL = 'http://localhost:4000/api';

Chart.defaults.font.family = "'DM Sans', sans-serif";
Chart.defaults.color = '#7a7a7a';

const tip = {
  backgroundColor: '#fff',
  borderColor: '#ebebeb',
  borderWidth: 1,
  titleColor: '#1a1a1a',
  bodyColor: '#7a7a7a',
  padding: 12,
  cornerRadius: 10,
};

let revenueChart = null;
let materialChart = null;
let currentTransactions = [];

function getToken() {
  return localStorage.getItem('token');
}

function money(value, decimals = 2) {
  return 'R ' + Number(value || 0).toLocaleString('en-ZA', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

function number(value) {
  return Number(value || 0).toLocaleString('en-ZA');
}

async function fetchJson(path) {
  const response = await fetch(`${API_URL}${path}`, {
    headers: { 'Authorization': `Bearer ${getToken()}` },
  });

  if (response.status === 401) {
    window.location.href = '../AuthScreens/login.html';
    return null;
  }

  if (!response.ok) throw new Error(`Request failed: ${path}`);
  return response.json();
}

async function loadIncomeData() {
  try {
    const [txnData, summary, pickersData] = await Promise.all([
      fetchJson('/transactions'),
      fetchJson('/transactions/summary'),
      fetchJson('/admin/pickers'),
    ]);

    if (!txnData || !summary || !pickersData) return;

    const transactions = txnData.transactions || [];
    const pickers = pickersData.pickers || [];
    currentTransactions = transactions;

    updateHero(transactions, summary, pickers);
    updateStatCards(transactions, summary);
    updateRevenueChart(transactions, 'monthly');
    updateMaterialChart(summary.byMaterial || {});
    updateZoneIncome(transactions);
    updateMaterialIncome(summary.byMaterial || {});
    updateTopEarners(transactions, pickers);
  } catch (err) {
    console.error('Could not load income data:', err.message);
  }
}

function updateHero(transactions, summary, pickers) {
  const total = Number(summary.totalPayouts || 0);
  const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const thisWeek = transactions.filter(t => new Date(t.created_at) >= oneWeekAgo);
  const weekTotal = thisWeek.reduce((sum, t) => sum + Number(t.total || 0), 0);
  const paidPickers = new Set(transactions.map(t => t.picker_id).filter(Boolean)).size;
  const avgPerPicker = paidPickers ? total / paidPickers : 0;

  const heroAmount = document.querySelector('.hero-amount');
  const heroCaption = document.querySelector('.hero-caption');
  const heroStats = document.querySelectorAll('.hero-stat .hs-val');

  if (heroAmount) heroAmount.textContent = money(total, 0);
  if (heroCaption) heroCaption.textContent = `${new Date().toLocaleString('en-ZA', { month: 'long', year: 'numeric' })} - ${pickers.length} pickers`;
  if (heroStats[0]) heroStats[0].textContent = money(weekTotal, 0);
  if (heroStats[1]) heroStats[1].textContent = number(paidPickers);
  if (heroStats[2]) heroStats[2].textContent = money(avgPerPicker, 0);
}

function updateStatCards(transactions, summary) {
  const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const oneMonthAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const thisWeek = transactions.filter(t => new Date(t.created_at) >= oneWeekAgo);
  const thisMonth = transactions.filter(t => new Date(t.created_at) >= oneMonthAgo);
  const weekTotal = thisWeek.reduce((s, t) => s + Number(t.total || 0), 0);
  const monthTotal = thisMonth.reduce((s, t) => s + Number(t.total || 0), 0);
  const pending = transactions.filter(t => (t.status || '').toLowerCase() === 'pending');
  const pendingTotal = pending.reduce((s, t) => s + Number(t.total || 0), 0);
  const avgPerTxn = transactions.length ? Number(summary.totalPayouts || 0) / transactions.length : 0;

  const values = document.querySelectorAll('.stat-card .value');
  if (values[0]) values[0].textContent = money(weekTotal);
  if (values[1]) values[1].textContent = money(monthTotal);
  if (values[2]) values[2].textContent = money(pendingTotal);
  if (values[3]) values[3].textContent = money(avgPerTxn);

  const captions = document.querySelectorAll('.stat-card .caption');
  if (captions[0]) captions[0].textContent = `${thisWeek.length} transactions this week`;
  if (captions[1]) captions[1].textContent = `${thisMonth.length} transactions this month`;
  if (captions[2]) captions[2].textContent = `${pending.length} pending transactions`;
  if (captions[3]) captions[3].textContent = `Across ${transactions.length} transactions`;
}

function updateRevenueChart(transactions, mode = 'monthly') {
  const incomeMap = {};

  transactions.forEach(t => {
    const date = new Date(t.created_at);
    const label = mode === 'weekly'
      ? `Week ${Math.ceil(date.getDate() / 7)}`
      : date.toLocaleString('en-ZA', { month: 'short' });
    incomeMap[label] = (incomeMap[label] || 0) + Number(t.total || 0);
  });

  const ctx = document.getElementById('revenueChart')?.getContext('2d');
  if (!ctx) return;

  if (revenueChart) revenueChart.destroy();
  revenueChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: Object.keys(incomeMap),
      datasets: [{
        label: 'Revenue (R)',
        data: Object.values(incomeMap),
        borderColor: '#3a9e3f',
        borderWidth: 2.5,
        pointBackgroundColor: '#3a9e3f',
        pointRadius: 4,
        tension: 0.4,
        fill: true,
        backgroundColor: (ctx) => {
          const g = ctx.chart.ctx.createLinearGradient(0, 0, 0, 240);
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
        y: { grid: { color: 'rgba(0,0,0,.05)' }, border: { display: false }, ticks: { callback: v => 'R ' + v.toLocaleString() } },
      },
    },
  });
}

function updateMaterialChart(byMaterial) {
  const labels = Object.keys(byMaterial);
  const data = labels.map(m => byMaterial[m].total || 0);
  const ctx = document.getElementById('materialChart')?.getContext('2d');
  if (!ctx) return;

  if (materialChart) materialChart.destroy();
  materialChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: 'Revenue (R)',
        data,
        backgroundColor: ['rgba(58,158,63,.85)', 'rgba(58,158,63,.7)', 'rgba(58,158,63,.55)', 'rgba(58,158,63,.4)', 'rgba(58,158,63,.25)'],
        borderRadius: 10,
        borderSkipped: false,
        hoverBackgroundColor: '#3a9e3f',
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false }, tooltip: tip },
      scales: {
        x: { grid: { display: false }, border: { display: false } },
        y: { grid: { color: 'rgba(0,0,0,.05)' }, border: { display: false }, ticks: { callback: v => 'R ' + v.toLocaleString() } },
      },
    },
  });
}

function updateSparkbarSection(title, rows) {
  const section = [...document.querySelectorAll('.section-card')]
    .find(card => card.querySelector('.section-title')?.textContent.trim() === title);
  if (!section) return;

  [...section.querySelectorAll('.sparkbar-row')].forEach(row => row.remove());

  const max = Math.max(...rows.map(row => row.value), 1);
  rows.slice(0, 5).forEach(row => {
    const item = document.createElement('div');
    item.className = 'sparkbar-row';
    item.innerHTML = `
      <span class="sparkbar-label">${row.label}</span>
      <div class="sparkbar-track"><div class="sparkbar-fill" style="width:${Math.round((row.value / max) * 100)}%"></div></div>
      <span class="sparkbar-val">${money(row.value, 0)}</span>`;
    section.appendChild(item);
  });
}

function updateZoneIncome(transactions) {
  const map = {};
  transactions.forEach(t => {
    const zone = t.zone || t.branch || 'Unassigned';
    map[zone] = (map[zone] || 0) + Number(t.total || 0);
  });

  updateSparkbarSection('Income by Zone', Object.entries(map)
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value));
}

function updateMaterialIncome(byMaterial) {
  updateSparkbarSection('Income by Material Type', Object.entries(byMaterial)
    .map(([label, stats]) => ({ label, value: Number(stats.total || 0) }))
    .sort((a, b) => b.value - a.value));
}

function updateTopEarners(transactions, pickers) {
  const tbody = document.querySelector('.table-wrap tbody');
  if (!tbody) return;

  const pickerMap = new Map(pickers.map(p => [p.id, p]));
  const totals = new Map();

  transactions.forEach(t => {
    if (!totals.has(t.picker_id)) {
      const picker = pickerMap.get(t.picker_id) || {};
      totals.set(t.picker_id, {
        id: t.picker_id,
        name: t.picker_name || picker.name || t.picker_id || 'Unknown picker',
        zone: t.zone || picker.zone || picker.branch || '-',
        materialCounts: {},
        transactions: 0,
        kg: 0,
        earned: 0,
        status: t.status || 'completed',
      });
    }

    const row = totals.get(t.picker_id);
    row.transactions += 1;
    row.kg += Number(t.quantity || 0);
    row.earned += Number(t.total || 0);
    row.materialCounts[t.material] = (row.materialCounts[t.material] || 0) + 1;
    if ((t.status || '').toLowerCase() === 'pending') row.status = 'pending';
  });

  const rows = [...totals.values()].sort((a, b) => b.earned - a.earned).slice(0, 5);

  if (!rows.length) {
    tbody.innerHTML = `<tr><td colspan="7">No picker income data yet.</td></tr>`;
    return;
  }

  tbody.innerHTML = rows.map(row => {
    const initials = row.name.split(' ').map(part => part[0]).slice(0, 2).join('').toUpperCase();
    const primaryMaterial = Object.entries(row.materialCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || '-';
    const statusText = row.status === 'pending' ? 'Pending' : row.status === 'review' ? 'Review' : 'Paid';
    const badgeClass = statusText === 'Pending' ? 'badge-amber' : statusText === 'Review' ? 'badge-blue' : 'badge-green';

    return `
      <tr>
        <td><div class="picker-cell"><div class="picker-avatar">${initials}</div><div><div class="picker-name">${row.name}</div><div class="picker-id">${row.id}</div></div></div></td>
        <td>${row.zone}</td>
        <td>${primaryMaterial}</td>
        <td>${row.transactions}</td>
        <td>${number(row.kg)} kg</td>
        <td><strong>${money(row.earned, 0)}</strong></td>
        <td><span class="badge ${badgeClass}">${statusText}</span></td>
      </tr>`;
  }).join('');
}

function setTab(button, mode) {
  document.querySelectorAll('.ftab').forEach(tab => tab.classList.remove('active'));
  button.classList.add('active');
  updateRevenueChart(currentTransactions, mode);
}

document.addEventListener('DOMContentLoaded', () => {
  if (!getToken()) {
    window.location.href = '../AuthScreens/login.html';
    return;
  }

  loadIncomeData();

  const logoutBtn = document.querySelector('.topbar-logout');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', () => {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '../AuthScreens/login.html';
    });
  }
});