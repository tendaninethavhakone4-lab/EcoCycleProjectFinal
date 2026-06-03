const API_URL = 'http://localhost:4000/api';

function getToken() {
  return localStorage.getItem('token');
}

function getValue(id) {
  return document.getElementById(id)?.value.trim() || '';
}

function normalizePhone(value) {
  return value.replace(/\s+/g, '');
}

async function registerPicker() {
  const fname = getValue('fname');
  const lname = getValue('lname');
  const phone = normalizePhone(getValue('phone'));
  const zone = getValue('zone');
  const btn = document.querySelector('.btn-primary');

  if (!fname || !lname || !phone || !zone) {
    showToast('Please enter first name, last name, phone number, and assigned zone.', false);
    return;
  }

  btn.disabled = true;
  btn.innerHTML = 'Registering...';

  try {
    const response = await fetch(`${API_URL}/admin/pickers`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${getToken()}`,
      },
      body: JSON.stringify({
        first_name: fname,
        last_name: lname,
        name: `${fname} ${lname}`,
        phone,
        zone,
        material: getValue('material') || 'Mixed / General',
        address: getValue('address'),
        payment: getValue('payment'),
        notes: getValue('notes'),
        gender: getValue('gender'),
        id_number: getValue('idnum'),
        dob: getValue('dob'),
        bank_account: getValue('bankaccount'),
      }),
    });

    const data = await response.json();

    if (response.status === 401) {
      showToast('Session expired. Please log in again.', false);
      setTimeout(() => window.location.href = '../AuthScreens/login.html', 2000);
      return;
    }

    if (!response.ok) {
      showToast(data.error || 'Registration failed. Please try again.', false);
      return;
    }

    showToast(`${data.picker.name} registered successfully! ID: ${data.picker.id}`);
    clearForm();
  } catch (err) {
    showToast('Could not connect to the server. Make sure the backend is running.', false);
  } finally {
    btn.disabled = false;
    btn.innerHTML = `
      <svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24"><path d="M20 6 9 17l-5-5"/></svg>
      Register Picker`;
  }
}

function clearForm() {
  ['fname', 'lname', 'idnum', 'phone', 'address', 'notes', 'bankaccount', 'dob']
    .forEach(id => { document.getElementById(id).value = ''; });
  ['gender', 'zone', 'material', 'payment']
    .forEach(id => { document.getElementById(id).value = ''; });
}

function showToast(msg, success = true) {
  const t = document.getElementById('toast');
  t.style.background = success ? '#3a9e3f' : '#e53935';
  document.getElementById('toast-msg').textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 3500);
}

document.addEventListener('DOMContentLoaded', () => {
  if (!getToken()) {
    window.location.href = '../AuthScreens/login.html';
    return;
  }

  const logoutBtn = document.querySelector('.topbar-logout');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', () => {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '../AuthScreens/login.html';
    });
  }
});