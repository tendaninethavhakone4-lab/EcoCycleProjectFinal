const API_BASE = 'http://localhost:4000';

let pendingAction = null;

function getToken() {
  return localStorage.getItem('token');
}

function getUser() {
  try {
    return JSON.parse(localStorage.getItem('user') || '{}');
  } catch {
    return {};
  }
}

function setUser(user) {
  localStorage.setItem('user', JSON.stringify(user || {}));
}

function toast(icon, title, msg) {
  const t = document.getElementById('toast');
  const tIcon = document.getElementById('toastIcon');
  const tTitle = document.getElementById('toastTitle');
  const tMsg = document.getElementById('toastMsg');

  if (tIcon) tIcon.textContent = icon || '';
  if (tTitle) tTitle.textContent = title || '';
  if (tMsg) tMsg.textContent = msg || '';
  if (!t) return;

  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 3500);
}

async function apiRequest(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${getToken()}`,
      ...(options.headers || {}),
    },
  });

  const data = await response.json().catch(() => ({}));
  if (response.status === 401) {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.href = '../AuthScreens/login.html';
    return null;
  }

  if (!response.ok) throw new Error(data.error || 'Request failed.');
  return data;
}

function showSection(id, el) {
  document.querySelectorAll('.settings-section').forEach(section => section.classList.remove('visible'));
  document.querySelectorAll('.snav-item').forEach(item => {
    item.classList.remove('active');
    item.style.backgroundColor = '';
    item.style.color = '';
  });

  const section = document.getElementById(`section-${id}`);
  if (section) section.classList.add('visible');
  if (el) el.classList.add('active');
}

function initials(name) {
  return String(name || 'EcoCycle')
    .split(' ')
    .filter(Boolean)
    .map(part => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

function fillUserInfo(user) {
  const nameField = document.getElementById('profileName');
  const emailField = document.getElementById('profileEmail');
  const phoneField = document.getElementById('profilePhone');
  const displayName = document.getElementById('profileDisplayName');
  const avatarCircle = document.querySelector('.avatar-circle');
  const subTitle = document.querySelector('.sn-sub');

  if (nameField) nameField.value = user.name || '';
  if (emailField) emailField.value = user.email || '';
  if (phoneField) phoneField.value = user.phone || '';
  if (displayName) displayName.textContent = user.name || '';
  const photoUrl = user.photo_url || user.photo || '';
  if (avatarCircle && !photoUrl) avatarCircle.textContent = initials(user.name);
  if (subTitle) subTitle.textContent = `${user.branch || 'Employee'} - ${user.role || 'employee'}`;

  if (photoUrl && avatarCircle) {
    avatarCircle.innerHTML = `<img src="${photoUrl}" style="width:72px;height:72px;border-radius:50%;object-fit:cover;" alt="Profile photo">`;
  }
}

async function loadUserInfo() {
  const localUser = getUser();
  fillUserInfo(localUser);

  try {
    const data = await apiRequest('/api/auth/me');
    if (data?.user) {
      const merged = { ...localUser, ...data.user };
      setUser(merged);
      fillUserInfo(merged);
    }
  } catch (err) {
    toast('!', 'Could Not Load Profile', err.message);
  }
}

async function saveProfile() {
  const name = document.getElementById('profileName')?.value.trim();
  const email = document.getElementById('profileEmail')?.value.trim();
  const phone = document.getElementById('profilePhone')?.value.trim();
  const btn = document.querySelector('button[onclick="saveProfile()"]');

  if (!name || !email) {
    toast('!', 'Missing fields', 'Name and email are required.');
    return;
  }

  if (btn) {
    btn.disabled = true;
    btn.textContent = 'Saving...';
  }

  try {
    const data = await apiRequest('/api/auth/profile', {
      method: 'PUT',
      body: JSON.stringify({ name, email, phone }),
    });

    const user = { ...getUser(), ...(data.user || {}), name, email, phone };
    setUser(user);
    fillUserInfo(user);
    toast('OK', 'Profile Saved', 'Your profile was updated in the database.');
  } catch (err) {
    toast('!', 'Could Not Save Profile', err.message);
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.textContent = 'Save Changes';
    }
  }
}

function getPasswordInputs() {
  const inputs = Array.from(document.querySelectorAll('#section-security input[type="password"]'));
  return {
    currentPwd: inputs[0],
    newPwd: inputs[1],
    confirmPwd: inputs[2],
  };
}

function updateStrength(value) {
  const val = value || '';
  const colors = ['#f44336', '#ff9800', '#ffc107', '#4caf50'];
  const labels = ['Too short', 'Weak', 'Medium', 'Strong'];
  let score = 0;

  if (val.length >= 6) score += 1;
  if (val.length >= 10) score += 1;
  if (/[A-Z]/.test(val) && /[0-9]/.test(val)) score += 1;
  if (/[^A-Za-z0-9]/.test(val)) score += 1;

  ['s1', 's2', 's3', 's4'].forEach((id, index) => {
    const el = document.getElementById(id);
    if (el) el.style.background = index < score ? colors[Math.max(0, score - 1)] : '#e0e8e0';
  });

  const label = document.getElementById('strengthLabel');
  if (label) label.textContent = val.length === 0 ? 'Enter a new password' : labels[Math.max(0, score - 1)];
}

async function changePassword() {
  const { currentPwd, newPwd, confirmPwd } = getPasswordInputs();
  const currentPassword = currentPwd?.value || '';
  const newPassword = newPwd?.value || '';
  const confirmPassword = confirmPwd?.value || '';
  const btn = Array.from(document.querySelectorAll('#section-security .btn-primary'))
    .find(button => button.textContent.trim().includes('Update Password'));

  if (!currentPassword || !newPassword || !confirmPassword) {
    toast('!', 'Missing fields', 'Please fill in all password fields.');
    return;
  }

  if (newPassword.length < 8) {
    toast('!', 'Password too short', 'New password must be at least 8 characters.');
    return;
  }

  if (newPassword !== confirmPassword) {
    toast('!', 'Passwords do not match', 'Please repeat the same new password.');
    return;
  }

  if (btn) {
    btn.disabled = true;
    btn.textContent = 'Saving...';
  }

  try {
    await apiRequest('/api/auth/change-password', {
      method: 'POST',
      body: JSON.stringify({ currentPassword, newPassword }),
    });

    currentPwd.value = '';
    newPwd.value = '';
    confirmPwd.value = '';
    updateStrength('');
    toast('OK', 'Password Changed', 'Your password was updated in the database.');
  } catch (err) {
    toast('!', 'Could Not Change Password', err.message);
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.textContent = 'Update Password';
    }
  }
}

function setAvatarPreview(src) {
  const avatarCircle = document.querySelector('.avatar-circle');
  if (avatarCircle) {
    avatarCircle.innerHTML = `<img src="${src}" style="width:72px;height:72px;border-radius:50%;object-fit:cover;" alt="Profile photo">`;
  }
}

async function uploadProfilePhoto(dataUrl, file) {
  const data = await apiRequest('/api/auth/profile/photo', {
    method: 'POST',
    body: JSON.stringify({
      image: dataUrl,
      fileName: file?.name || 'profile-photo',
    }),
  });

  const user = { ...getUser(), ...(data.user || {}), photo: data.photo_url, photo_url: data.photo_url };
  setUser(user);
  fillUserInfo(user);
  return data.photo_url;
}

function handlePhotoChange(input) {
  if (!input.files || !input.files[0]) return;
  const file = input.files[0];

  if (!file.type.startsWith('image/')) {
    toast('!', 'Invalid File', 'Please choose an image file.');
    input.value = '';
    return;
  }

  if (file.size > 2 * 1024 * 1024) {
    toast('!', 'Photo Too Large', 'Please choose an image smaller than 2 MB.');
    input.value = '';
    return;
  }

  const reader = new FileReader();
  reader.onload = async event => {
    const dataUrl = event.target.result;
    setAvatarPreview(dataUrl);
    toast('...', 'Uploading Photo', 'Saving your photo to Supabase...');

    try {
      const photoUrl = await uploadProfilePhoto(dataUrl, file);
      setAvatarPreview(photoUrl);
      toast('OK', 'Photo Uploaded', 'Your profile photo was saved to Supabase.');
    } catch (err) {
      fillUserInfo(getUser());
      toast('!', 'Could Not Upload Photo', err.message);
    } finally {
      input.value = '';
    }
  };
  reader.readAsDataURL(file);
}

function openPhotoUpload() {
  let input = document.getElementById('profilePhotoInput');
  if (!input) {
    input = document.createElement('input');
    input.type = 'file';
    input.id = 'profilePhotoInput';
    input.accept = 'image/*';
    input.style.display = 'none';
    input.addEventListener('change', () => handlePhotoChange(input));
    document.body.appendChild(input);
  }

  input.click();
}

function saveLocalPreferences(sectionId, title) {
  const section = document.getElementById(sectionId);
  if (!section) return;

  const values = {};
  section.querySelectorAll('input, select').forEach((field, index) => {
    const key = field.id || field.name || `${field.type || field.tagName}-${index}`;
    values[key] = field.type === 'checkbox' ? field.checked : field.value;
  });

  localStorage.setItem(`ecocycle-${sectionId}`, JSON.stringify(values));
  if (sectionId === 'section-appearance') applyAppearanceSettings();
  toast('OK', title, 'These preferences were saved on this browser.');
}

function restoreLocalPreferences() {
  document.querySelectorAll('.settings-section').forEach(section => {
    const saved = JSON.parse(localStorage.getItem(`ecocycle-${section.id}`) || '{}');
    section.querySelectorAll('input, select').forEach((field, index) => {
      const key = field.id || field.name || `${field.type || field.tagName}-${index}`;
      if (!(key in saved)) return;
      if (field.type === 'checkbox') field.checked = saved[key];
      else field.value = saved[key];
    });
  });
}

function setSwatch(el) {
  document.querySelectorAll('.swatch').forEach(swatch => swatch.classList.remove('active'));
  el.classList.add('active');
  localStorage.setItem('ecocycle-accent-color', getComputedStyle(el).backgroundColor);
  applyAppearanceSettings();
  toast('OK', 'Accent Colour Changed', 'Accent colour applied.');
}

function getAppearanceControls() {
  const section = document.getElementById('section-appearance');
  const selects = Array.from(section?.querySelectorAll('select') || []);
  const toggles = Array.from(section?.querySelectorAll('input[type="checkbox"]') || []);

  return {
    section,
    colourMode: selects[0],
    fontSize: selects[1],
    compactView: toggles[0],
    animations: toggles[1],
  };
}

function hexFromRgb(value) {
  if (!value || value.startsWith('#')) return value || '#4caf50';
  const parts = value.match(/\d+/g);
  if (!parts || parts.length < 3) return '#4caf50';
  return `#${parts.slice(0, 3).map(part => Number(part).toString(16).padStart(2, '0')).join('')}`;
}

function hexToRgb(hex) {
  const clean = hexFromRgb(hex).replace('#', '');
  return {
    r: parseInt(clean.slice(0, 2), 16),
    g: parseInt(clean.slice(2, 4), 16),
    b: parseInt(clean.slice(4, 6), 16),
  };
}

function rgbToHex({ r, g, b }) {
  return `#${[r, g, b].map(value => Math.max(0, Math.min(255, Math.round(value))).toString(16).padStart(2, '0')).join('')}`;
}

function mixColor(hex, targetHex, amount) {
  const color = hexToRgb(hex);
  const target = hexToRgb(targetHex);
  return rgbToHex({
    r: color.r + (target.r - color.r) * amount,
    g: color.g + (target.g - color.g) * amount,
    b: color.b + (target.b - color.b) * amount,
  });
}

function applyTheme(mode) {
  const selectedMode = mode === 'System Default'
    ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'Dark' : 'Light')
    : mode;

  const root = document.documentElement;
  if (selectedMode === 'Dark') {
    root.style.setProperty('--bg', '#151a16');
    root.style.setProperty('--c-page', '#151a16');
    root.style.setProperty('--white', '#202720');
    root.style.setProperty('--c-white', '#202720');
    root.style.setProperty('--text', '#f3f5f0');
    root.style.setProperty('--c-text', '#f3f5f0');
    root.style.setProperty('--c-text-2', '#d4dacd');
    root.style.setProperty('--c-text-3', '#aeb8aa');
    root.style.setProperty('--border', '#344036');
    root.style.setProperty('--c-border', '#344036');
    root.style.setProperty('--c-border-light', '#2b352d');
    document.body.style.background = '#151a16';
  } else {
    root.style.setProperty('--bg', '#f5ede0');
    root.style.setProperty('--c-page', '#f5ede0');
    root.style.setProperty('--white', '#ffffff');
    root.style.setProperty('--c-white', '#ffffff');
    root.style.setProperty('--text', '#1a1a1a');
    root.style.setProperty('--c-text', '#1a1a1a');
    root.style.setProperty('--c-text-2', '#4a4a44');
    root.style.setProperty('--c-text-3', '#7a7a70');
    root.style.setProperty('--border', '#ebebeb');
    root.style.setProperty('--c-border', '#e2dfd8');
    root.style.setProperty('--c-border-light', '#f0ede8');
    document.body.style.background = '#f5ede0';
  }
}

function applyAccent(color) {
  const accent = hexFromRgb(color || localStorage.getItem('ecocycle-accent-color') || '#4caf50');
  const accentDark = mixColor(accent, '#000000', 0.35);
  const accentLight = mixColor(accent, '#ffffff', 0.35);
  const accentBg = mixColor(accent, '#ffffff', 0.86);
  const accentBorder = mixColor(accent, '#ffffff', 0.58);
  const root = document.documentElement;

  root.style.setProperty('--green', accent);
  root.style.setProperty('--green-dark', accentDark);
  root.style.setProperty('--green-light', accentLight);
  root.style.setProperty('--green-bg', accentBg);
  root.style.setProperty('--green-border', accentBorder);
  root.style.setProperty('--primary', accent);
  root.style.setProperty('--primary-bg', accentBg);
  root.style.setProperty('--c-green', accent);
  root.style.setProperty('--c-green-dark', accentDark);
  root.style.setProperty('--c-green-light', accentLight);
  root.style.setProperty('--c-green-bg', accentBg);
  root.style.setProperty('--c-green-border', accentBorder);
  root.style.setProperty('--accent', accent);

  const brandIcon = document.querySelector('.brand-icon');
  if (brandIcon) {
    brandIcon.style.background = `linear-gradient(135deg, ${accent}, ${accentDark})`;
    brandIcon.style.boxShadow = `0 3px 10px ${accent}55`;
  }
}

function applyFontSize(size) {
  const sizes = {
    Small: '14px',
    Medium: '16px',
    Large: '18px',
  };
  document.documentElement.style.fontSize = sizes[size] || sizes.Medium;
}

function applyCompactView(enabled) {
  document.querySelectorAll('.setting-row').forEach(row => {
    row.style.paddingTop = enabled ? '12px' : '';
    row.style.paddingBottom = enabled ? '12px' : '';
  });
  document.querySelectorAll('.card').forEach(card => {
    card.style.marginBottom = enabled ? '12px' : '';
  });
}

function applyAnimations(enabled) {
  let style = document.getElementById('ecocycle-animation-setting');
  if (!style) {
    style = document.createElement('style');
    style.id = 'ecocycle-animation-setting';
    document.head.appendChild(style);
  }

  style.textContent = enabled
    ? ''
    : '*, *::before, *::after { transition: none !important; animation: none !important; }';
}

function applyAppearanceSettings() {
  const { colourMode, fontSize, compactView, animations } = getAppearanceControls();

  document.querySelectorAll('.snav-item').forEach(item => {
    item.style.backgroundColor = '';
    item.style.color = '';
  });
  document.querySelectorAll('.nav-item, .btn-primary').forEach(item => {
    item.style.backgroundColor = '';
  });

  applyTheme(colourMode?.value || 'Light');
  applyAccent(localStorage.getItem('ecocycle-accent-color'));
  applyFontSize(fontSize?.value || 'Medium');
  applyCompactView(Boolean(compactView?.checked));
  applyAnimations(animations ? animations.checked : true);
}

function wireAppearanceControls() {
  const { colourMode, fontSize, compactView, animations, section } = getAppearanceControls();
  if (!section) return;

  [colourMode, fontSize, compactView, animations].forEach(control => {
    if (!control) return;
    control.addEventListener('change', () => {
      saveLocalPreferences('section-appearance', 'Appearance Saved');
    });
  });

  document.querySelectorAll('#section-appearance .swatch').forEach(swatch => {
    swatch.addEventListener('click', () => setSwatch(swatch));
  });

  const savedAccent = localStorage.getItem('ecocycle-accent-color');
  if (savedAccent) {
    const savedHex = hexFromRgb(savedAccent);
    document.querySelectorAll('#section-appearance .swatch').forEach(swatch => {
      const swatchHex = hexFromRgb(getComputedStyle(swatch).backgroundColor);
      swatch.classList.toggle('active', swatchHex.toLowerCase() === savedHex.toLowerCase());
    });
  }

  applyAppearanceSettings();
}

function confirmAction(action, title, desc) {
  pendingAction = action;
  const modalTitle = document.getElementById('modalTitle');
  const modalMsg = document.getElementById('modalMsg');
  const overlay = document.getElementById('modalOverlay');

  if (modalTitle) modalTitle.textContent = title;
  if (modalMsg) modalMsg.textContent = desc;
  if (overlay) overlay.classList.add('open');
}

function logoutToLogin() {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  window.location.href = '../AuthScreens/login.html';
}

async function executeAction() {
  const action = pendingAction;
  closeModal();

  try {
    if (action === 'deactivate') {
      await apiRequest('/api/auth/account/deactivate', { method: 'POST', body: '{}' });
      toast('OK', 'Account Deactivated', 'You will be signed out now.');
      setTimeout(logoutToLogin, 1200);
    } else if (action === 'delete') {
      await apiRequest('/api/auth/account/delete-request', { method: 'POST', body: '{}' });
      toast('OK', 'Deletion Requested', 'Your request was saved for admin review.');
      setTimeout(logoutToLogin, 1400);
    } else if (action === 'reset-rewards') {
      const data = await apiRequest('/api/auth/account/reset-rewards', { method: 'POST', body: '{}' });
      toast('OK', 'Rewards Reset', data?.message || 'Rewards were reset.');
    }
  } catch (err) {
    toast('!', 'Action Failed', err.message);
  } finally {
    pendingAction = null;
  }
}

function closeModal() {
  const overlay = document.getElementById('modalOverlay');
  if (overlay) overlay.classList.remove('open');
}

function wireButtons() {
  const { newPwd } = getPasswordInputs();
  if (newPwd) newPwd.addEventListener('input', () => updateStrength(newPwd.value));

  const passwordButton = Array.from(document.querySelectorAll('#section-security .btn-primary'))
    .find(button => button.textContent.trim().includes('Update Password'));
  if (passwordButton) {
    passwordButton.onclick = changePassword;
  }

  const photoButton = Array.from(document.querySelectorAll('button'))
    .find(button => button.textContent.trim().includes('Change Photo'));
  if (photoButton) {
    photoButton.onclick = openPhotoUpload;
  }

  const confirmBtn = document.getElementById('modalConfirmBtn');
  if (confirmBtn) confirmBtn.onclick = executeAction;

  const overlay = document.getElementById('modalOverlay');
  if (overlay) {
    overlay.addEventListener('click', event => {
      if (event.target === event.currentTarget) closeModal();
    });
  }

  const preferenceButtons = [
    ['section-notifications', 'Notification Settings Saved'],
    ['section-appearance', 'Appearance Saved'],
    ['section-language', 'Region Settings Saved'],
    ['section-privacy', 'Privacy Settings Saved'],
  ];

  preferenceButtons.forEach(([sectionId, title]) => {
    const button = document.querySelector(`#${sectionId} .btn-primary`);
    if (button && !button.getAttribute('onclick')?.includes('saveProfile')) {
      button.onclick = () => saveLocalPreferences(sectionId, title);
    }
  });

  wireAppearanceControls();
}

document.addEventListener('DOMContentLoaded', () => {
  if (!getToken()) {
    window.location.href = '../AuthScreens/login.html';
    return;
  }

  restoreLocalPreferences();
  wireButtons();
  loadUserInfo();

  const logoutBtn = document.querySelector('.topbar-logout');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', () => {
      logoutToLogin();
    });
  }
});