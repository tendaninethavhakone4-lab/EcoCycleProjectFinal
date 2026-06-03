const API_URL = 'http://localhost:4000/api';

function getToken() {
  return localStorage.getItem('token');
}

const CO2_PER_KG = 0.00166;
const TREES_PER_KG = 0.05;
const WATER_PER_KG = 37.9;
const ENERGY_PER_KG = 4.5;
const ANNUAL_GOAL_KG = 20000;

Chart.defaults.font.family = "'DM Sans', sans-serif";

const tip = {
  backgroundColor: '#fff',
  borderColor: '#ebebeb',
  borderWidth: 1,
  titleColor: '#1a1a1a',
  bodyColor: '#7a7a7a',
  padding: 12,
  cornerRadius: 10,
};

let co2Chart = null;
let wasteDonut = null;
let weeklyBar = null;

function formatKg(value) {
  return Number(value || 0).toLocaleString('en-ZA') + ' kg';
}

function formatTonnes(value) {
  return Number(value || 0).toFixed(1) + ' t';
}

function formatLitres(value) {
  return Number(value || 0).toLocaleString('en-ZA') + ' L';
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

async function loadEnvironmentalData() {
  try {
    const [txnData, summary] = await Promise.all([
      fetchJson('/transactions'),
      fetchJson('/transactions/summary'),
    ]);

    if (!txnData || !summary) return;

    const transactions = txnData.transactions || [];
    const totalKg = Number(summary.totalKg || 0);
    const totalCO2 = totalKg * CO2_PER_KG;
    const totalTrees = Math.round(totalKg * TREES_PER_KG);
    const totalWater = Math.round(totalKg * WATER_PER_KG);
    const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const thisWeekKg = transactions
      .filter(t => new Date(t.created_at) >= oneWeekAgo)
      .reduce((sum, t) => sum + Number(t.quantity || 0), 0);

    updateHero(thisWeekKg, totalCO2, totalTrees);
    updateImpactCards(totalKg, totalCO2, totalTrees, totalWater);
    updateGoal(totalKg);
    updateMilestones(totalKg);
    updateCO2Chart(transactions);
    updateWasteDonut(summary.byMaterial || {});
    updateWeeklyBar(transactions);
    updateMaterialTable(summary.byMaterial || {});
  } catch (err) {
    console.error('Could not load environmental data:', err.message);
  }
}

function updateHero(thisWeekKg, totalCO2, totalTrees) {
  const hsVals = document.querySelectorAll('.hs-val');
  if (hsVals[0]) hsVals[0].textContent = formatKg(thisWeekKg);
  if (hsVals[1]) hsVals[1].textContent = formatTonnes(totalCO2);
  if (hsVals[2]) hsVals[2].textContent = totalTrees.toLocaleString('en-ZA');
}

function updateImpactCards(totalKg, totalCO2, totalTrees, totalWater) {
  const values = document.querySelectorAll('.impact-card .value');
  if (values[0]) values[0].textContent = formatKg(totalKg);
  if (values[1]) values[1].textContent = formatTonnes(totalCO2);
  if (values[2]) values[2].textContent = totalTrees.toLocaleString('en-ZA');
  if (values[3]) values[3].textContent = formatLitres(totalWater);

  const captions = document.querySelectorAll('.impact-card .caption');
  if (captions[0]) captions[0].textContent = 'All-time total';
  if (captions[1]) captions[1].textContent = 'Based on recycled weight';
  if (captions[2]) captions[2].textContent = 'Trees equivalent';
  if (captions[3]) captions[3].textContent = 'Through recycling';
}

function updateGoal(totalKg) {
  const pct = Math.min(100, Math.round((totalKg / ANNUAL_GOAL_KG) * 100));
  const remaining = Math.max(0, ANNUAL_GOAL_KG - totalKg);
  const ringText = document.querySelector('.ring-svg text');
  const ringKg = document.querySelector('.ring-pct');
  const ringTitle = document.querySelector('.ring-info h3');
  const ringParas = document.querySelectorAll('.ring-info p');
  const circle = document.querySelector('.ring-svg circle[stroke="#3a9e3f"]');

  if (ringText) ringText.textContent = `${pct}%`;
  if (ringKg) ringKg.textContent = formatKg(totalKg);
  if (ringTitle) ringTitle.textContent = `2026 Target: ${formatKg(ANNUAL_GOAL_KG)}`;
  if (ringParas[0]) ringParas[0].textContent = 'collected so far';
  if (ringParas[1]) ringParas[1].innerHTML = `<strong style="color:var(--primary);">${formatKg(remaining)}</strong> remaining to reach the annual goal.`;
  if (circle) circle.setAttribute('stroke-dashoffset', String(314 - (314 * pct / 100)));
}

function updateMilestones(totalKg) {
  const milestones = document.querySelectorAll('.milestone');
  const levels = [5000, 10000, 20000];

  milestones.forEach((card, index) => {
    const level = levels[index];
    const achieved = totalKg >= level;
    const pct = Math.min(100, Math.round((totalKg / level) * 100));
    const remaining = Math.max(0, level - totalKg);

    card.classList.toggle('achieved', achieved);
    card.classList.toggle('next', !achieved);

    const val = card.querySelector('.m-val');
    const label = card.querySelector('.m-lbl');
    const badge = card.querySelector('.m-badge');

    if (val) val.textContent = formatKg(level);
    if (label) label.textContent = achieved
      ? `${formatKg(level)} milestone reached`
      : `${formatKg(level)} target - ${formatKg(remaining)} remaining`;
    if (badge) badge.textContent = achieved ? 'Achieved' : `In progress - ${pct}%`;
  });
}

function updateCO2Chart(transactions) {
  const monthlyMap = {};
  transactions.forEach(t => {
    const month = new Date(t.created_at).toLocaleString('en-ZA', { month: 'short' });
    monthlyMap[month] = (monthlyMap[month] || 0) + (Number(t.quantity || 0) * CO2_PER_KG);
  });

  const ctx = document.getElementById('co2Chart')?.getContext('2d');
  if (!ctx) return;

  if (co2Chart) co2Chart.destroy();
  co2Chart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: Object.keys(monthlyMap),
      datasets: [{
        label: 'CO2 Avoided (t)',
        data: Object.values(monthlyMap).map(v => Number(v.toFixed(2))),
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
        y: { grid: { color: 'rgba(0,0,0,.05)' }, border: { display: false }, ticks: { callback: v => v + 't' } },
      },
    },
  });
}

function updateWasteDonut(byMaterial) {
  const labels = Object.keys(byMaterial);
  const data = labels.map(m => byMaterial[m].kg || 0);
  const total = data.reduce((sum, value) => sum + value, 0);
  const pcts = data.map(value => total > 0 ? Math.round((value / total) * 100) : 0);
  const ctx = document.getElementById('wasteDonut')?.getContext('2d');
  if (!ctx) return;

  if (wasteDonut) wasteDonut.destroy();
  wasteDonut = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels,
      datasets: [{
        data: pcts,
        backgroundColor: ['#3a9e3f', '#5dbb62', '#1f5c22', '#8dc98f', '#c5e8c6'],
        borderWidth: 0,
        hoverOffset: 8,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '68%',
      plugins: {
        legend: { position: 'bottom', labels: { boxWidth: 11, padding: 14, usePointStyle: true, pointStyle: 'circle' } },
        tooltip: { ...tip, callbacks: { label: ctx => ` ${ctx.label}: ${ctx.parsed}%` } },
      },
    },
  });
}

function updateWeeklyBar(transactions) {
  const weeklyMap = {};
  transactions.forEach(t => {
    const weekNum = Math.floor((Date.now() - new Date(t.created_at).getTime()) / (7 * 24 * 60 * 60 * 1000));
    const label = weekNum === 0 ? 'This week' : `${weekNum}w ago`;
    weeklyMap[label] = (weeklyMap[label] || 0) + Number(t.quantity || 0);
  });

  const entries = Object.entries(weeklyMap).reverse().slice(0, 5);
  const ctx = document.getElementById('weeklyBar')?.getContext('2d');
  if (!ctx) return;

  if (weeklyBar) weeklyBar.destroy();
  weeklyBar = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: entries.map(entry => entry[0]),
      datasets: [{
        label: 'kg collected',
        data: entries.map(entry => entry[1]),
        backgroundColor: ['rgba(58,158,63,.4)', 'rgba(58,158,63,.55)', 'rgba(58,158,63,.55)', 'rgba(58,158,63,.7)', 'rgba(58,158,63,.9)'],
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
        y: { grid: { color: 'rgba(0,0,0,.05)' }, border: { display: false }, ticks: { callback: v => v + ' kg' } },
      },
    },
  });
}

function updateMaterialTable(byMaterial) {
  const tbody = document.querySelector('.table-wrap tbody');
  if (!tbody) return;

  const rows = Object.entries(byMaterial)
    .map(([material, stats]) => {
      const kg = Number(stats.kg || 0);
      const co2 = kg * CO2_PER_KG;
      const water = kg * WATER_PER_KG;
      const energy = kg * ENERGY_PER_KG;
      return { material, kg, co2, water, energy };
    })
    .sort((a, b) => b.kg - a.kg);

  if (!rows.length) {
    tbody.innerHTML = '<tr><td colspan="6">No environmental impact data yet.</td></tr>';
    return;
  }

  tbody.innerHTML = rows.map(row => {
    const level = row.kg >= 500 ? 'Very High' : row.kg >= 200 ? 'High' : row.kg >= 50 ? 'Medium' : 'Moderate';
    const badge = level === 'Very High' || level === 'High' ? 'badge-green' : level === 'Medium' ? 'badge-blue' : 'badge-purple';

    return `
      <tr>
        <td><strong>${row.material}</strong></td>
        <td>${formatKg(row.kg)}</td>
        <td>${formatTonnes(row.co2)}</td>
        <td>${formatLitres(Math.round(row.water))}</td>
        <td>${Math.round(row.energy).toLocaleString('en-ZA')} kWh</td>
        <td><span class="badge ${badge}">${level}</span></td>
      </tr>`;
  }).join('');
}

document.addEventListener('DOMContentLoaded', () => {
  if (!getToken()) {
    window.location.href = '../AuthScreens/login.html';
    return;
  }

  loadEnvironmentalData();

  const logoutBtn = document.querySelector('.topbar-logout');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', () => {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '../AuthScreens/login.html';
    });
  }
});