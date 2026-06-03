(function () {
  const DEFAULT_ACCENT = '#3a9e3f';

  function hexFromRgb(value) {
    if (!value || String(value).startsWith('#')) return value || DEFAULT_ACCENT;
    const parts = String(value).match(/\d+/g);
    if (!parts || parts.length < 3) return DEFAULT_ACCENT;
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

  function rgbToHex(color) {
    return `#${[color.r, color.g, color.b]
      .map(value => Math.max(0, Math.min(255, Math.round(value))).toString(16).padStart(2, '0'))
      .join('')}`;
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

  function savedAppearance() {
    try {
      return JSON.parse(localStorage.getItem('ecocycle-section-appearance') || '{}');
    } catch {
      return {};
    }
  }

  function preferenceValue(saved, names, fallback) {
    for (const name of names) {
      if (saved[name] !== undefined && saved[name] !== null && saved[name] !== '') return saved[name];
    }
    return fallback;
  }

  function setVar(name, value) {
    document.documentElement.style.setProperty(name, value);
  }

  function ensureStyle(id) {
    let style = document.getElementById(id);
    if (!style) {
      style = document.createElement('style');
      style.id = id;
      document.head.appendChild(style);
    }
    return style;
  }

  function clearPageBackground() {
    document.body.style.background = '';
  }

  function applyTheme(mode) {
    const selectedMode = mode === 'System Default'
      ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'Dark' : 'Light')
      : mode;
    const darkStyle = ensureStyle('employee-appearance-theme-style');

    if (selectedMode === 'Dark') {
      document.documentElement.dataset.employeeTheme = 'dark';
      setVar('--bg', '#151a16');
      setVar('--c-page', '#151a16');
      setVar('--page', '#151a16');
      setVar('--background', '#151a16');
      setVar('--white', '#202720');
      setVar('--c-white', '#202720');
      setVar('--card', '#202720');
      setVar('--surface', '#202720');
      setVar('--text', '#f3f5f0');
      setVar('--c-text', '#f3f5f0');
      setVar('--text-dark', '#f3f5f0');
      setVar('--c-text-2', '#d4dacd');
      setVar('--c-text-3', '#aeb8aa');
      setVar('--text-mid', '#d4dacd');
      setVar('--text-soft', '#aeb8aa');
      setVar('--muted', '#aeb8aa');
      setVar('--border', '#344036');
      setVar('--c-border', '#344036');
      setVar('--c-border-light', '#2b352d');
      setVar('--border-input', '#445047');
      document.body.style.background = '#151a16';
      darkStyle.textContent = `
        html[data-employee-theme="dark"] body,
        html[data-employee-theme="dark"] .main-content,
        html[data-employee-theme="dark"] .content,
        html[data-employee-theme="dark"] main {
          background: #151a16 !important;
          color: #f3f5f0 !important;
        }
        html[data-employee-theme="dark"] .topbar,
        html[data-employee-theme="dark"] .sidebar,
        html[data-employee-theme="dark"] .settings-sidebar,
        html[data-employee-theme="dark"] .settings-nav,
        html[data-employee-theme="dark"] .card,
        html[data-employee-theme="dark"] .stat-card,
        html[data-employee-theme="dark"] .section-card,
        html[data-employee-theme="dark"] .settings-card,
        html[data-employee-theme="dark"] .form-card,
        html[data-employee-theme="dark"] .table-card,
        html[data-employee-theme="dark"] .picker-directory,
        html[data-employee-theme="dark"] .transactions-card,
        html[data-employee-theme="dark"] .chart-card,
        html[data-employee-theme="dark"] .impact-card,
        html[data-employee-theme="dark"] .income-card,
        html[data-employee-theme="dark"] .panel {
          background: #202720 !important;
          color: #f3f5f0 !important;
          border-color: #344036 !important;
        }
        html[data-employee-theme="dark"] h1,
        html[data-employee-theme="dark"] h2,
        html[data-employee-theme="dark"] h3,
        html[data-employee-theme="dark"] h4,
        html[data-employee-theme="dark"] strong,
        html[data-employee-theme="dark"] label,
        html[data-employee-theme="dark"] .ecocycle-wordmark,
        html[data-employee-theme="dark"] .setting-label,
        html[data-employee-theme="dark"] .card-title,
        html[data-employee-theme="dark"] .stat-value {
          color: #f3f5f0 !important;
        }
        html[data-employee-theme="dark"] p,
        html[data-employee-theme="dark"] small,
        html[data-employee-theme="dark"] .muted,
        html[data-employee-theme="dark"] .page-header p,
        html[data-employee-theme="dark"] .setting-desc,
        html[data-employee-theme="dark"] .stat-sub,
        html[data-employee-theme="dark"] .ecocycle-sub,
        html[data-employee-theme="dark"] .nav-item {
          color: #aeb8aa !important;
        }
        html[data-employee-theme="dark"] input,
        html[data-employee-theme="dark"] select,
        html[data-employee-theme="dark"] textarea,
        html[data-employee-theme="dark"] .search-input,
        html[data-employee-theme="dark"] .filter-select {
          background: #151a16 !important;
          color: #f3f5f0 !important;
          border-color: #445047 !important;
        }
        html[data-employee-theme="dark"] table,
        html[data-employee-theme="dark"] thead,
        html[data-employee-theme="dark"] tbody,
        html[data-employee-theme="dark"] tr,
        html[data-employee-theme="dark"] td,
        html[data-employee-theme="dark"] th {
          background-color: #202720 !important;
          color: #f3f5f0 !important;
          border-color: #344036 !important;
        }
        html[data-employee-theme="dark"] .nav-item.active,
        html[data-employee-theme="dark"] .nav-item.active span,
        html[data-employee-theme="dark"] .nav-item.active svg {
          color: #ffffff !important;
          stroke: #ffffff !important;
        }
      `;
    } else {
      document.documentElement.dataset.employeeTheme = 'light';
      setVar('--bg', '#f5ede0');
      setVar('--c-page', '#f5ede0');
      setVar('--page', '#f5ede0');
      setVar('--background', '#f5ede0');
      setVar('--white', '#ffffff');
      setVar('--c-white', '#ffffff');
      setVar('--card', '#ffffff');
      setVar('--surface', '#ffffff');
      setVar('--text', '#1a1a1a');
      setVar('--c-text', '#1a1a1a');
      setVar('--text-dark', '#1a1a1a');
      setVar('--c-text-2', '#4a4a44');
      setVar('--c-text-3', '#7a7a70');
      setVar('--text-mid', '#4a4a44');
      setVar('--text-soft', '#7a7a70');
      setVar('--muted', '#7a7a70');
      setVar('--border', '#ebebeb');
      setVar('--c-border', '#e2dfd8');
      setVar('--c-border-light', '#f0ede8');
      setVar('--border-input', '#dfe7dd');
      clearPageBackground();
      darkStyle.textContent = '';
    }
  }

  function applyAccent(color) {
    const accent = hexFromRgb(color || localStorage.getItem('ecocycle-accent-color') || DEFAULT_ACCENT);
    const accentDark = mixColor(accent, '#000000', 0.35);
    const accentLight = mixColor(accent, '#ffffff', 0.35);
    const accentBg = mixColor(accent, '#ffffff', 0.86);
    const accentBorder = mixColor(accent, '#ffffff', 0.58);

    setVar('--green', accent);
    setVar('--green-dark', accentDark);
    setVar('--green-light', accentLight);
    setVar('--green-bg', accentBg);
    setVar('--green-border', accentBorder);
    setVar('--primary', accent);
    setVar('--primary-dark', accentDark);
    setVar('--primary-light', accentLight);
    setVar('--primary-bg', accentBg);
    setVar('--primary-pale', accentBg);
    setVar('--primary-tint', accentBg);
    setVar('--primary-accent', accentBorder);
    setVar('--c-green', accent);
    setVar('--c-green-dark', accentDark);
    setVar('--c-green-light', accentLight);
    setVar('--c-green-bg', accentBg);
    setVar('--c-green-border', accentBorder);
    setVar('--accent', accent);
    setVar('--accent-dark', accentDark);
    setVar('--accent-light', accentLight);
    setVar('--accent-bg', accentBg);

    ensureStyle('employee-appearance-accent-style').textContent = `
      .brand-icon,
      .ecocycle-logo .brand-icon {
        background: linear-gradient(135deg, ${accent}, ${accentDark}) !important;
        box-shadow: 0 3px 10px ${accent}55 !important;
      }
      .ecocycle-wordmark .eco,
      .eco {
        color: ${accent} !important;
      }
      .nav-item.active {
        background: ${accent} !important;
      }
      .nav-item:hover {
        color: ${accent} !important;
        background: ${accentBg} !important;
      }
      .nav-item.active,
      .nav-item.active span,
      .nav-item.active svg {
        color: #ffffff !important;
        stroke: #ffffff !important;
      }
      .topbar-logout:hover {
        color: ${accent} !important;
        border-color: ${accentBorder} !important;
        background: ${accentBg} !important;
      }
    `;
  }

  function applyFontSize(size) {
    const sizes = { Small: '14px', Medium: '16px', Large: '17px' };
    document.documentElement.style.fontSize = sizes[size] || sizes.Medium;
  }

  function applyCompactView(enabled) {
    document.documentElement.dataset.compactView = enabled ? 'true' : 'false';
  }

  function applyAnimations(enabled) {
    let style = document.getElementById('employee-appearance-animation-style');
    if (!style) {
      style = document.createElement('style');
      style.id = 'employee-appearance-animation-style';
      document.head.appendChild(style);
    }
    style.textContent = enabled
      ? ''
      : '*,*::before,*::after{transition:none!important;animation:none!important;scroll-behavior:auto!important}';
  }

  function applyEmployeeAppearance() {
    const saved = savedAppearance();
    const colourMode = preferenceValue(saved, ['colourMode', 'select-0', 'SELECT-0'], 'Light');
    const fontSize = preferenceValue(saved, ['fontSize', 'select-1', 'SELECT-1'], 'Medium');
    const compactView = Boolean(preferenceValue(saved, ['compactView', 'checkbox-0', 'CHECKBOX-0'], false));
    const animations = preferenceValue(saved, ['animations', 'checkbox-1', 'CHECKBOX-1'], true) !== false;

    applyTheme(colourMode);
    applyAccent(localStorage.getItem('ecocycle-accent-color'));
    applyFontSize(fontSize);
    applyCompactView(compactView);
    applyAnimations(animations);
  }

  window.applyEmployeeAppearance = applyEmployeeAppearance;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', applyEmployeeAppearance);
  } else {
    applyEmployeeAppearance();
  }

  window.addEventListener('storage', event => {
    if (event.key === 'ecocycle-section-appearance' || event.key === 'ecocycle-accent-color') {
      applyEmployeeAppearance();
    }
  });
})();
