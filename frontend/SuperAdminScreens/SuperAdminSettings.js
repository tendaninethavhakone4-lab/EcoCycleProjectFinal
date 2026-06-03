function showSection(id) {
  // Hide all
  document.querySelectorAll('[id^="section-"]').forEach(el => el.style.display = 'none');
  // Show target
  const el = document.getElementById('section-' + id);
  if (el) el.style.display = 'block';
  // Update nav
  document.querySelectorAll('.settings-nav-item').forEach(item => {
    item.classList.remove('active');
    if (item.getAttribute('onclick') && item.getAttribute('onclick').includes(`'${id}'`)) {
      item.classList.add('active');
    }
  });
}
// Period btns
document.querySelectorAll('.period-btn')?.forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.period-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
  });
})