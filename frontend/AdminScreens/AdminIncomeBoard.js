
 
/* ─── STAT CARDS DATA ────────────────────────────────────── */
const stats = [
  {
    label:   "Total Revenue",
    value:   "R 1.2M",
    caption: "All time",
    green:   false,
    icon: `<polyline points="1 4 1 10 7 10"/>
           <polyline points="23 20 23 14 17 14"/>
           <path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 0 1 3.51 15"/>`
  },
  {
    label:   "Monthly Revenue",
    value:   "R 342,580",
    caption: "April 2026",
    green:   false,
    icon: `<rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
           <line x1="16" y1="2" x2="16" y2="6"/>
           <line x1="8"  y1="2" x2="8"  y2="6"/>
           <line x1="3"  y1="10" x2="21" y2="10"/>`
  },
  {
    label:   "Active Centres",
    value:   "12",
    caption: "Operational",
    green:   false,
    icon: `<rect x="2" y="3" width="20" height="14" rx="2" ry="2"/>
           <line x1="8"  y1="21" x2="16" y2="21"/>
           <line x1="12" y1="17" x2="12" y2="21"/>`
  },
  {
    label:   "Revenue Growth",
    value:   "+24%",
    caption: "vs last month",
    green:   true,
    icon: `<polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/>
           <polyline points="17 6 23 6 23 12"/>`
  }
];
 
 
/* ─── BUILD STAT CARDS ───────────────────────────────────── */
const statsRow = document.getElementById("statsRow");
 
stats.forEach(function(s) {
  const card = document.createElement("div");
  card.className = "stat-card";
 
  card.innerHTML = `
    <div class="stat-card-left">
      <h4>${s.label}</h4>
      <div class="value ${s.green ? 'green' : ''}">${s.value}</div>
      <div class="caption">${s.caption}</div>
    </div>
    <div class="stat-icon">
      <svg viewBox="0 0 24 24">${s.icon}</svg>
    </div>
  `;
 
  statsRow.appendChild(card);
});
 
 
/* ─── REVENUE BY CENTRE DATA ─────────────────────────────── */
const centres = [
  { name: "Johannesburg Central", amount: "R 98,450", pct: 100 },
  { name: "Pretoria East",        amount: "R 76,230", pct: 77  },
  { name: "Cape Town South",      amount: "R 68,900", pct: 70  },
  { name: "Durban North",         amount: "R 52,100", pct: 53  },
  { name: "Port Elizabeth",       amount: "R 46,900", pct: 47  }
];
 
 
/* ─── BUILD BAR CHART ────────────────────────────────────── */
const centreChart = document.getElementById("centreChart");
 
centres.forEach(function(c) {
  const row = document.createElement("div");
  row.className = "bar-row";
 
  row.innerHTML = `
    <div class="bar-label">
      <span>${c.name}</span>
      <span>${c.amount}</span>
    </div>
    <div class="bar-track">
      <div class="bar-fill" style="width: ${c.pct}%"></div>
    </div>
  `;
 
  centreChart.appendChild(row);
});
 
 
/* ─── REVENUE BY MATERIAL DATA ───────────────────────────── */
const materials = [
  { name: "Metal",     amount: "R 125,840", dotClass: "dot-dark"    },
  { name: "Plastic",   amount: "R 98,650",  dotClass: "dot-mid"     },
  { name: "Paper",     amount: "R 65,420",  dotClass: "dot-light"   },
  { name: "Cardboard", amount: "R 34,230",  dotClass: "dot-lighter" },
  { name: "Glass",     amount: "R 18,440",  dotClass: "dot-pale"    }
];
 
 
/* ─── BUILD MATERIAL LIST ────────────────────────────────── */
const materialChart = document.getElementById("materialChart");
 
materials.forEach(function(m) {
  const row = document.createElement("div");
  row.className = "material-row";
 
  row.innerHTML = `
    <div class="material-left">
      <div class="dot ${m.dotClass}"></div>
      <span>${m.name}</span>
    </div>
    <span class="material-amount">${m.amount}</span>
  `;
 
  materialChart.appendChild(row);
});