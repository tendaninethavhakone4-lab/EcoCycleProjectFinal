  // Generate bar chart
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const thisYear = [11200, 12400, 13800, 15200, 14600, 16400, 17100, 15800, 16900, 17400, 18200, 18472];
  const lastYear = [9800, 10200, 11400, 12800, 13200, 14100, 13900, 14600, 15200, 14800, 15600, 16100];
  const max = Math.max(...thisYear, ...lastYear);
  const chart = document.getElementById('barChart');
  chart.innerHTML = months.map((m, i) => `
    <div class="bar-col">
      <div class="bar-wrap">
        <div class="bar secondary" style="height:${(lastYear[i]/max)*100}%"></div>
        <div class="bar primary" style="height:${(thisYear[i]/max)*100}%"></div>
      </div>
      <div class="bar-lbl">${m}</div>
    </div>
  `).join('');
 
  // Period selector
  document.querySelectorAll('.period-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.period-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
    });
  });