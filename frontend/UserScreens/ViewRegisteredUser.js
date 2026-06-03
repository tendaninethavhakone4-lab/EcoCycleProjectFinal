const API_URL = 'http://localhost:4000/api';

let allPickers = [];
let allTransactions = [];

function getToken() {
  return localStorage.getItem('token');
}

function authHeaders() {
  return { 'Authorization': `Bearer ${getToken()}` };
}

function money(value) {
  return 'R ' + Number(value || 0).toLocaleString('en-ZA', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
}

function kg(value) {
  return Number(value || 0).toLocaleString('en-ZA') + ' kg';
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

async function loadPickers() {
  try {
    const [pickersData, txData] = await Promise.all([
      fetchJson('/admin/pickers'),
      fetchJson('/transactions'),
    ]);

    if (!pickersData || !txData) return;

    allPickers = pickersData.pickers || [];
    allTransactions = txData.transactions || [];

    populateZoneFilter(allPickers);
    updateStats(allPickers, allTransactions);
    renderTable(allPickers);
  } catch (err) {
    console.error('Could not load pickers:', err.message);
    const empty = document.getElementById('emptyState');
    if (empty) empty.style.display = 'block';
  }
}

function updateStats(pickers, transactions) {
  const statValues = document.querySelectorAll('.stat-value');
  const activePickers = pickers.filter(p => (p.status || 'active') === 'active').length;
  const totalKg = transactions.reduce((sum, t) => sum + Number(t.quantity || t.weight || 0), 0);
  const totalPaid = transactions.reduce((sum, t) => sum + Number(t.total || t.amount || 0), 0);

  if (statValues[0]) statValues[0].textContent = pickers.length.toLocaleString();
  if (statValues[1]) statValues[1].textContent = activePickers.toLocaleString();
  if (statValues[2]) statValues[2].textContent = kg(totalKg);
  if (statValues[3]) statValues[3].textContent = money(totalPaid);

  const statSubs = document.querySelectorAll('.stat-sub');
  if (statSubs[0]) statSubs[0].textContent = 'Registered';
  if (statSubs[1]) statSubs[1].textContent = 'Active pickers';
  if (statSubs[2]) statSubs[2].textContent = 'All time';
  if (statSubs[3]) statSubs[3].textContent = 'All time';
}

function populateZoneFilter(pickers) {
  const select = document.getElementById('zoneFilter');
  if (!select) return;

  const selected = select.value;
  const zones = [...new Set(pickers.map(p => p.zone || p.branch).filter(Boolean))].sort();

  select.innerHTML = '<option value="">All Zones</option>' +
    zones.map(zone => `<option value="${zone}">${zone}</option>`).join('');

  if (zones.includes(selected)) select.value = selected;
}

function renderTable(data) {
  const tbody = document.getElementById('tableBody');
  const empty = document.getElementById('emptyState');
  const countLabel = document.getElementById('pickerCount');

  if (countLabel) {
    countLabel.textContent = data.length + ' picker' + (data.length !== 1 ? 's' : '');
  }

  if (!tbody || !empty) return;

  if (data.length === 0) {
    tbody.innerHTML = '';
    empty.style.display = 'block';
    return;
  }

  empty.style.display = 'none';

  tbody.innerHTML = data.map(p => {
    const name = p.name || `${p.first_name || ''} ${p.last_name || ''}`.trim() || 'Unnamed picker';
    const initials = name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();
    const status = p.status || 'active';
    const joined = p.created_at ? p.created_at.split('T')[0] : (p.joined || '-');
    const zone = p.zone || p.branch || '-';

    return `
      <tr>
        <td>
          <div class="picker-cell">
            <div class="picker-avatar">${initials}</div>
            <div>
              <div class="picker-name">${name}</div>
              <div class="picker-id">${p.id}</div>
            </div>
          </div>
        </td>
        <td><span class="zone-pill">${zone}</span></td>
        <td><span class="material-tag">${p.material || p.primary_material || '-'}</span></td>
        <td>${p.phone || '-'}</td>
        <td>${joined}</td>
        <td>
          <div class="status-wrap">
            <div class="status-dot ${status}"></div>
            <span class="status-text ${status}">${status.charAt(0).toUpperCase() + status.slice(1)}</span>
          </div>
        </td>
        <td>
          <div class="action-btns">
            <button class="icon-btn" title="View profile" onclick="viewPicker('${p.id}')">
              <svg fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
            </button>
            <button class="icon-btn danger" title="Remove picker" onclick="confirmRemove('${p.id}', '${name.replace(/'/g, "\\'")}')">
              <svg fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg>
            </button>
          </div>
        </td>
      </tr>`;
  }).join('');
}

function applyFilters() {
  const search = (document.getElementById('searchInput')?.value || '').toLowerCase();
  const zone = document.getElementById('zoneFilter')?.value || '';

  const filtered = allPickers.filter(p => {
    const name = p.name || `${p.first_name || ''} ${p.last_name || ''}`.trim();
    const pickerZone = p.zone || p.branch || '';
    const matchSearch = !search ||
      name.toLowerCase().includes(search) ||
      String(p.id || '').toLowerCase().includes(search) ||
      pickerZone.toLowerCase().includes(search);
    const matchZone = !zone || pickerZone === zone;
    return matchSearch && matchZone;
  });

  renderTable(filtered);
}

function filterTable() {
  applyFilters();
}

function filterZone() {
  applyFilters();
}

function viewPicker(id) {
  const p = allPickers.find(x => x.id === id);
  if (!p) return;
  const name = p.name || `${p.first_name || ''} ${p.last_name || ''}`.trim();
  toast('Profile', 'Picker Profile', `${name} - ${p.zone || p.branch || '-'} - ${p.phone || '-'}`);
}

function confirmRemove(id, name) {
  const overlay = document.getElementById('modalOverlay');
  const title = document.getElementById('modalTitle');
  const msg = document.getElementById('modalMsg');
  const btn = document.getElementById('modalConfirmBtn');

  if (title) title.textContent = 'Remove Picker?';
  if (msg) msg.textContent = `${name} will be removed from the system.`;
  if (btn) btn.onclick = () => removePicker(id, name);

  overlay.classList.add('open');
}

function closeModal() {
  document.getElementById('modalOverlay').classList.remove('open');
}

async function removePicker(id, name) {
  closeModal();

  try {
    const response = await fetch(`${API_URL}/admin/pickers/${id}`, {
      method: 'DELETE',
      headers: authHeaders(),
    });

    if (!response.ok) {
      const data = await response.json();
      toast('Error', 'Error', data.error || 'Failed to remove picker.');
      return;
    }

    allPickers = allPickers.filter(p => p.id !== id);
    updateStats(allPickers, allTransactions);
    applyFilters();
    toast('Removed', 'Picker Removed', `${name} has been removed from the system.`);
  } catch (err) {
    toast('Error', 'Error', 'Could not connect to the server.');
  }
}

function toast(icon, title, msg) {
  const t = document.getElementById('toast');
  const tIcon = document.getElementById('toastIcon');
  const tTitle = document.getElementById('toastTitle');
  const tMsg = document.getElementById('toastMsg');

  if (tIcon) tIcon.textContent = icon;
  if (tTitle) tTitle.textContent = title;
  if (tMsg) tMsg.textContent = msg;

  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 3500);
}

document.addEventListener('DOMContentLoaded', () => {
  if (!getToken()) {
    window.location.href = '../AuthScreens/login.html';
    return;
  }

  const overlay = document.getElementById('modalOverlay');
  if (overlay) {
    overlay.addEventListener('click', e => {
      if (e.target === e.currentTarget) closeModal();
    });
  }

  loadPickers();

  const logoutBtn = document.querySelector('.topbar-logout');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', () => {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '../AuthScreens/login.html';
    });
  }
});