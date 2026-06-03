const API_URL = 'http://localhost:4000/api';

const materialSelect = document.getElementById('material-select');
const quantityInput = document.getElementById('quantity-input');
const payoutAmount = document.getElementById('payout-amount');
const payoutDetail = document.getElementById('payout-detail');
const prRate = document.getElementById('pr-rate');
const prWeight = document.getElementById('pr-weight');
const prTotal = document.getElementById('pr-total');
let dbMaterials = [];

function getToken() {
  return localStorage.getItem('token');
}

function authHeaders(extra = {}) {
  return { ...extra, 'Authorization': `Bearer ${getToken()}` };
}

function money(value) {
  return 'R ' + Number(value || 0).toFixed(2);
}

function getSelectedMaterial() {
  const option = materialSelect.options[materialSelect.selectedIndex];
  if (!option || !option.value) return { id: null, name: '', rate: 0 };

  return {
    id: option.value,
    name: option.dataset.name || option.textContent.split('-')[0].split('—')[0].trim(),
    rate: Number(option.dataset.rate || 0),
  };
}

function updatePayout() {
  const { name, rate } = getSelectedMaterial();
  const weight = parseFloat(quantityInput.value) || 0;
  const total = rate * weight;

  payoutAmount.textContent = money(total);
  prRate.textContent = rate ? `R ${rate} / kg` : '-';
  prWeight.textContent = weight ? `${weight} kg` : '- kg';
  prTotal.textContent = money(total);

  payoutDetail.textContent = rate && weight
    ? `${weight} kg x R${rate}/kg (${name})`
    : 'Select material and enter weight';
}

async function loadPickers() {
  const pickerSelect = document.getElementById('picker-select');

  try {
    const response = await fetch(`${API_URL}/admin/pickers`, {
      headers: authHeaders(),
    });

    if (response.status === 401) {
      window.location.href = '../AuthScreens/login.html';
      return;
    }

    if (!response.ok) throw new Error('Failed to load pickers');

    const data = await response.json();
    const pickers = data.pickers || [];

    pickerSelect.innerHTML = '<option value="">Select picker...</option>';

    if (!pickers.length) {
      pickerSelect.innerHTML = '<option value="">No pickers registered yet</option>';
      return;
    }

    pickers.forEach(picker => {
      const option = document.createElement('option');
      const name = picker.name || `${picker.first_name || ''} ${picker.last_name || ''}`.trim();

      option.value = picker.id;
      option.textContent = `${name} (${picker.id})`;
      option.dataset.name = name;
      option.dataset.phone = picker.phone || '';
      option.dataset.zone = picker.zone || picker.branch || '';

      pickerSelect.appendChild(option);
    });
  } catch (err) {
    console.error('Could not load pickers:', err.message);
    pickerSelect.innerHTML = '<option value="">Could not load pickers</option>';
  }
}

function materialColor(index) {
  return ['#3a9e3f', '#6dba4d', '#8dc98f', '#b2d9b4', '#d4ead5', '#1f6b23', '#66bb6a'][index % 7];
}

function renderRateCard(materials) {
  const rateCard = document.querySelector('.rate-card');
  if (!rateCard) return;

  rateCard.innerHTML = materials.map((material, index) => `
    <div class="rate-row">
      <div class="rate-mat"><div class="rate-dot" style="background:${materialColor(index)};"></div> ${material.name}</div>
      <div class="rate-price">R ${Number(material.pricePerKg || 0).toLocaleString('en-ZA')} / kg</div>
    </div>
  `).join('');
}

async function loadMaterials() {
  try {
    const response = await fetch(`${API_URL}/materials`, {
      headers: authHeaders(),
    });

    if (response.status === 401) {
      window.location.href = '../AuthScreens/login.html';
      return;
    }

    if (!response.ok) throw new Error('Failed to load materials');

    const data = await response.json();
    dbMaterials = (data.materials || []).filter(material => material.active !== false);

    materialSelect.innerHTML = '<option value="" disabled selected>Select material type</option>';

    if (!dbMaterials.length) {
      materialSelect.innerHTML = '<option value="">No materials found</option>';
      renderRateCard([]);
      updatePayout();
      return;
    }

    dbMaterials.forEach(material => {
      const option = document.createElement('option');
      option.value = material.id;
      option.textContent = `${material.name} — R ${Number(material.pricePerKg || 0).toLocaleString('en-ZA')}/kg`;
      option.dataset.name = material.name;
      option.dataset.rate = Number(material.pricePerKg || 0);
      materialSelect.appendChild(option);
    });

    renderRateCard(dbMaterials);
    updatePayout();
  } catch (err) {
    console.error('Could not load materials:', err.message);
    materialSelect.innerHTML = '<option value="">Could not load materials</option>';
  }
}

async function loadRecentTransactions() {
  const list = document.getElementById('recent-list');
  if (!list) return;

  try {
    const response = await fetch(`${API_URL}/transactions`, {
      headers: authHeaders(),
    });

    if (!response.ok) throw new Error('Failed to load recent transactions');

    const data = await response.json();
    const transactions = data.transactions || [];

    list.innerHTML = '';

    if (!transactions.length) {
      list.innerHTML = `
        <div class="history-item">
          <div class="hi-left"><h4>No transactions yet</h4><p>Saved transactions will appear here.</p></div>
          <div class="hi-right"><div class="amount">R 0.00</div><div class="time">-</div></div>
        </div>`;
      return;
    }

    transactions.slice(0, 3).forEach(txn => addRecentTransaction(txn, false));
  } catch (err) {
    console.error('Could not load recent transactions:', err.message);
  }
}

function addRecentTransaction(txn, prepend = true) {
  const list = document.getElementById('recent-list');
  if (!list) return;

  const item = document.createElement('div');
  item.className = 'history-item';
  item.innerHTML = `
    <div class="hi-left">
      <h4>${txn.picker_name || txn.picker_id}</h4>
      <p>${txn.material} - ${Number(txn.quantity || 0)} kg</p>
    </div>
    <div class="hi-right">
      <div class="amount">${money(txn.total)}</div>
      <div class="time">${prepend ? 'Just now' : new Date(txn.created_at).toLocaleDateString('en-ZA')}</div>
    </div>`;

  if (prepend) {
    list.insertBefore(item, list.firstChild);
  } else {
    list.appendChild(item);
  }
}

function resetForm() {
  document.getElementById('transaction-form').reset();
  document.getElementById('date-input').value = new Date().toISOString().split('T')[0];
  updatePayout();
}

function showToast(msg, success = true) {
  const t = document.getElementById('toast');
  t.style.background = success ? '#3a9e3f' : '#e53935';
  document.getElementById('toast-msg').textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 3500);
}

materialSelect.addEventListener('change', updatePayout);
quantityInput.addEventListener('input', updatePayout);

document.getElementById('transaction-form').addEventListener('submit', async function (e) {
  e.preventDefault();

  const pickerSelect = document.getElementById('picker-select');
  const picker_id = pickerSelect.value;
  const selectedPicker = pickerSelect.options[pickerSelect.selectedIndex];
  const picker_name = selectedPicker?.dataset.name || selectedPicker?.textContent || '';
  const picker_phone = selectedPicker?.dataset.phone || '';
  const zone = document.getElementById('zone-select').value || selectedPicker?.dataset.zone || '';
  const { id: material_id, name: material, rate } = getSelectedMaterial();
  const quantity = parseFloat(quantityInput.value);
  const notes = document.getElementById('notes-input')?.value || '';
  const date = document.getElementById('date-input').value;
  const submitBtn = document.querySelector('[type="submit"]');

  if (!picker_id || !material_id || !material || !rate || !quantity || quantity <= 0) {
    showToast('Please choose a picker, material, and valid weight.', false);
    return;
  }

  submitBtn.disabled = true;
  submitBtn.textContent = 'Saving...';

  try {
    const response = await fetch(`${API_URL}/transactions`, {
      method: 'POST',
      headers: authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ picker_id, picker_name, picker_phone, material_id, material, quantity, zone, notes, date }),
    });

    const data = await response.json();

    if (response.status === 401) {
      showToast('Session expired. Please log in again.', false);
      setTimeout(() => window.location.href = '../AuthScreens/login.html', 2000);
      return;
    }

    if (!response.ok) {
      showToast(data.error || 'Transaction failed. Please try again.', false);
      return;
    }

    addRecentTransaction(data.transaction);
    showToast(`Transaction saved - ${money(data.transaction.total)} payout for ${picker_name}`);
    resetForm();
  } catch (err) {
    showToast('Could not connect to the server. Make sure the backend is running.', false);
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = 'Save Transaction';
  }
});

document.addEventListener('DOMContentLoaded', () => {
  if (!getToken()) {
    window.location.href = '../AuthScreens/login.html';
    return;
  }

  document.getElementById('date-input').value = new Date().toISOString().split('T')[0];
  updatePayout();
  loadMaterials();
  loadPickers();
  loadRecentTransactions();

  const logoutBtn = document.querySelector('.topbar-logout');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', () => {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '../AuthScreens/login.html';
    });
  }
});