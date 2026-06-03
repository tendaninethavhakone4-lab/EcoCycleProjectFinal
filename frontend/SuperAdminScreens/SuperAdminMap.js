const regions = [
  { id: 'soweto', name: 'Soweto', emoji: '🏘️', lat: -26.265, lng: 27.854, pickers: 64, kg: 4210, target: 5400, depots: 3, status: 'warning', color: '#F59E0B' },
  { id: 'alexandra', name: 'Alexandra', emoji: '🌇', lat: -26.104, lng: 28.096, pickers: 41, kg: 3140, target: 4800, depots: 2, status: 'warning', color: '#F59E0B' },
  { id: 'germiston', name: 'Germiston', emoji: '🏭', lat: -26.218, lng: 28.168, pickers: 58, kg: 5620, target: 5500, depots: 4, status: 'good', color: '#2E7D32' },
  { id: 'tembisa', name: 'Tembisa', emoji: '🌿', lat: -25.997, lng: 28.227, pickers: 37, kg: 2870, target: 5300, depots: 2, status: 'alert', color: '#E53935' },
  { id: 'diepsloot', name: 'Diepsloot', emoji: '🏡', lat: -25.932, lng: 28.013, pickers: 28, kg: 1840, target: 3200, depots: 1, status: 'good', color: '#2E7D32' },
  { id: 'orange-farm', name: 'Orange Farm', emoji: '🌾', lat: -26.483, lng: 27.898, pickers: 19, kg: 792, target: 2000, depots: 2, status: 'alert', color: '#E53935' },
];
 
const depots = [
  { name: 'Soweto Main Depot', lat: -26.272, lng: 27.870, capacity: '12t', today: '3.2t' },
  { name: 'Germiston Central', lat: -26.225, lng: 28.175, capacity: '18t', today: '5.6t' },
  { name: 'Alexandra Depot', lat: -26.110, lng: 28.103, capacity: '8t', today: '2.1t' },
  { name: 'Tembisa East', lat: -26.002, lng: 28.235, capacity: '10t', today: '1.8t' },
  { name: 'Diepsloot North', lat: -25.940, lng: 28.020, capacity: '6t', today: '0.9t' },
  { name: 'Orange Farm Depot', lat: -26.490, lng: 27.910, capacity: '7t', today: '0.4t' },
];
 
// Picker clusters (simulated active pickers)
const pickerClusters = [
  { lat: -26.260, lng: 27.860, count: 18 },
  { lat: -26.270, lng: 27.845, count: 12 },
  { lat: -26.110, lng: 28.100, count: 9 },
  { lat: -26.228, lng: 28.162, count: 22 },
  { lat: -25.998, lng: 28.230, count: 11 },
  { lat: -25.945, lng: 28.015, count: 7 },
  { lat: -26.485, lng: 27.905, count: 5 },
];
 
// Init map centred on Johannesburg
const map = L.map('map', { zoomControl: false }).setView([-26.195, 28.034], 11);
 
L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
  attribution: '©OpenStreetMap, ©CartoDB',
  subdomains: 'abcd', maxZoom: 19
}).addTo(map);
 
// Custom zoom control
L.control.zoom({ position: 'bottomright' }).addTo(map);
 
// Helper: create SVG icon
function makeIcon(color, size = 38, label = '') {
  const svg = `<svg width="${size}" height="${size+8}" viewBox="0 0 38 46" xmlns="http://www.w3.org/2000/svg">
    <filter id="shadow"><feDropShadow dx="0" dy="2" stdDeviation="2" flood-opacity="0.2"/></filter>
    <circle cx="19" cy="19" r="16" fill="${color}" filter="url(#shadow)" opacity="0.18"/>
    <circle cx="19" cy="19" r="11" fill="${color}"/>
    <circle cx="19" cy="19" r="6" fill="white" opacity="0.9"/>
    <polygon points="19,34 14,28 24,28" fill="${color}"/>
    ${label ? `<text x="19" y="22" text-anchor="middle" fill="${color}" font-size="7" font-weight="700" font-family="Sora,sans-serif">${label}</text>` : ''}
  </svg>`;
  return L.divIcon({ html: svg, iconSize: [size, size+8], iconAnchor: [size/2, size+8], className: '' });
}
 
function makeDepotIcon() {
  const svg = `<svg width="34" height="34" viewBox="0 0 34 34" xmlns="http://www.w3.org/2000/svg">
    <rect x="5" y="5" width="24" height="24" rx="6" fill="#F59E0B" opacity="0.15"/>
    <rect x="9" y="9" width="16" height="16" rx="4" fill="#F59E0B"/>
    <text x="17" y="22" text-anchor="middle" fill="white" font-size="10" font-weight="700">D</text>
  </svg>`;
  return L.divIcon({ html: svg, iconSize: [34, 34], iconAnchor: [17, 34], className: '' });
}
 
function makePickerIcon(count) {
  const col = count > 15 ? '#1565C0' : count > 8 ? '#1976D2' : '#42A5F5';
  const size = count > 15 ? 44 : count > 8 ? 38 : 32;
  const svg = `<svg width="${size}" height="${size}" viewBox="0 0 44 44" xmlns="http://www.w3.org/2000/svg">
    <circle cx="22" cy="22" r="${size/2-4}" fill="${col}" opacity="0.15"/>
    <circle cx="22" cy="22" r="${size/2-8}" fill="${col}"/>
    <text x="22" y="27" text-anchor="middle" fill="white" font-size="12" font-weight="700" font-family="Sora,sans-serif">${count}</text>
  </svg>`;
  return L.divIcon({ html: svg, iconSize: [size, size], iconAnchor: [size/2, size/2], className: '' });
}
 
const regionMarkers = [];
const depotMarkers = [];
const pickerMarkers = [];
 
// Add region markers
regions.forEach(r => {
  const pct = Math.round((r.kg / r.target) * 100);
  const marker = L.marker([r.lat, r.lng], { icon: makeIcon(r.color, 44) })
    .bindPopup(`
      <div class="popup-title">${r.emoji} ${r.name}</div>
      <div class="popup-row"><span>Active Pickers</span><span>${r.pickers}</span></div>
      <div class="popup-row"><span>Collected Today</span><span>${(r.kg/30).toFixed(0)} kg</span></div>
      <div class="popup-row"><span>Monthly Total</span><span>${r.kg.toLocaleString()} kg</span></div>
      <div class="popup-row"><span>Target Progress</span><span>${pct}%</span></div>
      <div class="popup-row"><span>Depots</span><span>${r.depots}</span></div>
    `, { maxWidth: 220 })
    .addTo(map);
  marker._regionId = r.id;
  marker.on('click', () => showDetail(r));
  regionMarkers.push(marker);
});
 
// Add depot markers
depots.forEach(d => {
  const marker = L.marker([d.lat, d.lng], { icon: makeDepotIcon() })
    .bindPopup(`
      <div class="popup-title">📦 ${d.name}</div>
      <div class="popup-row"><span>Capacity</span><span>${d.capacity}</span></div>
      <div class="popup-row"><span>Today's Volume</span><span>${d.today}</span></div>
    `, { maxWidth: 200 })
    .addTo(map);
  depotMarkers.push(marker);
});
 
// Add picker clusters
pickerClusters.forEach(p => {
  const marker = L.marker([p.lat, p.lng], { icon: makePickerIcon(p.count) })
    .bindTooltip(`${p.count} active pickers`, { direction: 'top' })
    .addTo(map);
  pickerMarkers.push(marker);
});
 
// Build region list
const regionList = document.getElementById('regionList');
regions.forEach(r => {
  const pct = Math.round((r.kg / r.target) * 100);
  const div = document.createElement('div');
  div.className = 'region-row';
  div.dataset.regionId = r.id;
  div.innerHTML = `
    <div class="region-avatar" style="background:${r.color}22">${r.emoji}</div>
    <div class="region-info">
      <div class="region-info-name">${r.name}</div>
      <div class="region-info-sub">${r.pickers} pickers · ${r.depots} depots</div>
      <div class="progress-mini"><div class="progress-mini-fill" style="width:${pct}%;background:${r.color}"></div></div>
    </div>
    <div>
      <div class="region-kg">${(r.kg/1000).toFixed(1)}t</div>
      <div class="region-kg-lbl">${pct}%</div>
    </div>
  `;
  div.addEventListener('click', () => {
    document.querySelectorAll('.region-row').forEach(el => el.classList.remove('selected'));
    div.classList.add('selected');
    map.flyTo([r.lat, r.lng], 13, { duration: 1 });
    showDetail(r);
  });
  regionList.appendChild(div);
});
 
const mockPickers = {
  soweto: [['Sipho N.', 142], ['Thandi M.', 98], ['Bongani K.', 87], ['Nomsa P.', 76]],
  alexandra: [['Lebo T.', 124], ['Moses D.', 91], ['Zanele G.', 68]],
  germiston: [['Johan S.', 198], ['Mpho L.', 167], ['Thabo R.', 145], ['Fikile N.', 132]],
  tembisa: [['Nkosi B.', 88], ['Priya S.', 72], ['Amos T.', 61]],
  diepsloot: [['Fatima A.', 94], ['Rendani M.', 78]],
  'orange-farm': [['Carlos V.', 52], ['Beauty M.', 39]],
};
 
function showDetail(r) {
  const pct = Math.round((r.kg / r.target) * 100);
  const card = document.getElementById('detailCard');
  const pickers = mockPickers[r.id] || [];
  card.className = 'detail-card visible';
  card.innerHTML = `
    <div class="detail-card-name">${r.emoji} ${r.name}</div>
    <div class="detail-card-sub">Region Detail · ${r.pickers} active pickers</div>
    <div class="detail-grid">
      <div class="detail-stat"><div class="detail-stat-label">Monthly kg</div><div class="detail-stat-val" style="color:${r.color}">${r.kg.toLocaleString()}</div></div>
      <div class="detail-stat"><div class="detail-stat-label">Target</div><div class="detail-stat-val">${pct}%</div></div>
      <div class="detail-stat"><div class="detail-stat-label">Depots</div><div class="detail-stat-val">${r.depots}</div></div>
      <div class="detail-stat"><div class="detail-stat-label">Status</div><div class="detail-stat-val" style="font-size:12px;color:${r.color}">${r.status === 'good' ? '✓ On Track' : r.status === 'warning' ? '⚠ Behind' : '✗ At Risk'}</div></div>
    </div>
    <div style="font-size:12px;font-weight:600;color:var(--text-soft);margin-bottom:8px;text-transform:uppercase;letter-spacing:0.5px">Top Pickers Today</div>
    ${pickers.map(([name, kg]) => `
      <div class="picker-row">
        <div class="picker-avatar">${name[0]}</div>
        <div class="picker-name">${name}</div>
        <div class="picker-kg">${kg} kg</div>
      </div>
    `).join('')}
  `;
}
 
// Filter buttons
document.querySelectorAll('.map-filter-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.map-filter-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    const f = btn.dataset.filter;
    regionMarkers.forEach(m => f === 'all' || f === 'hotspots' ? map.addLayer(m) : map.removeLayer(m));
    depotMarkers.forEach(m => f === 'all' || f === 'depots' ? map.addLayer(m) : map.removeLayer(m));
    pickerMarkers.forEach(m => f === 'all' || f === 'pickers' ? map.addLayer(m) : map.removeLayer(m));
  });
});
 
// Layer toggle (tile style)
const tiles = [
  'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
  'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
  'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
];
let currentTile = null;
document.querySelectorAll('.layer-btn').forEach((btn, i) => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.layer-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    if (currentTile) map.removeLayer(currentTile);
    currentTile = L.tileLayer(tiles[i], { attribution: '©OpenStreetMap', subdomains: 'abcd', maxZoom: 19 }).addTo(map);
    currentTile.bringToBack();
  });
});