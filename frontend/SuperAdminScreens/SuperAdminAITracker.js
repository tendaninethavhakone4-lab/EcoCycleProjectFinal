// ── Chart.js – 4-Week Trend Analysis ──────────────────────────────────────
 
const weeks = ["Week 1", "Week 2", "Week 3", "Week 4"];
 
const materials = [
  {
    label: "Plastic (kg)",
    color: "#3a9e3f",
    data: [2800, 3050, 3200, 3420],
  },
  {
    label: "Paper (kg)",
    color: "#8d6e63",
    data: [2100, 2200, 2320, 2420],
  },
  {
    label: "Metal (kg)",
    color: "#546e7a",
    data: [1620, 1740, 1900, 2060],
  },
  {
    label: "Glass (kg)",
    color: "#b0bec5",
    data: [820, 830, 840, 840],
  },
  {
    label: "Cardboard (kg)",
    color: "#ef9a9a",
    data: [540, 530, 520, 510],
  },
];
 
// Build Chart.js datasets
const datasets = materials.map((m) => ({
  label: m.label,
  data: m.data,
  borderColor: m.color,
  backgroundColor: "transparent",
  pointBackgroundColor: m.color,
  pointRadius: 4,
  pointHoverRadius: 6,
  borderWidth: 2,
  tension: 0.3,
}));
 
// Render chart
const ctx = document.getElementById("trendChart").getContext("2d");
new Chart(ctx, {
  type: "line",
  data: {
    labels: weeks,
    datasets,
  },
  options: {
    responsive: true,
    maintainAspectRatio: false,
    interaction: {
      mode: "index",
      intersect: false,
    },
    plugins: {
      legend: {
        display: false, // We render our own legend below
      },
      tooltip: {
        backgroundColor: "#fff",
        titleColor: "#1a1a1a",
        bodyColor: "#7a7a7a",
        borderColor: "#ebebeb",
        borderWidth: 1,
        padding: 12,
        boxPadding: 5,
        callbacks: {
          label: (ctx) => `  ${ctx.dataset.label}: ${ctx.parsed.y.toLocaleString()} kg`,
        },
      },
    },
    scales: {
      x: {
        grid: { display: false },
        ticks: {
          color: "#7a7a7a",
          font: { family: "DM Sans", size: 12 },
        },
        border: { display: false },
      },
      y: {
        beginAtZero: true,
        grid: { color: "#f0f0f0" },
        ticks: {
          color: "#7a7a7a",
          font: { family: "DM Sans", size: 12 },
          callback: (v) => v.toLocaleString(),
        },
        border: { display: false },
      },
    },
  },
});
 
// ── Build custom legend ──────────────────────────────────────────────────────
const legendEl = document.getElementById("chartLegend");
materials.forEach((m) => {
  const item = document.createElement("div");
  item.className = "legend-item";
  item.innerHTML = `
    <div class="legend-dot" style="background:${m.color}"></div>
    <span>${m.label}</span>
  `;
  legendEl.appendChild(item);
});