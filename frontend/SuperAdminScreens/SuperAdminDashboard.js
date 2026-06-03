// Animate region bars on load
window.addEventListener('load', () => {
  document.querySelectorAll('.region-bar').forEach(bar => {
    const target = bar.style.width;
    bar.style.width = '0';
    setTimeout(() => { bar.style.width = target; }, 400);
  });
});

function handleLogout() {
    alert("You have been logged out!");
}

// Attach event to button
document.getElementById("logoutBtn").addEventListener("click", handleLogout);