// ============================================================
// BOOTSTRAP - Olay dinleyicileri ve baslangic kodu (EN SON YUKLENIR)
// ============================================================



let toastTimeout;



document.addEventListener('keydown', (e) => {
if (e.key === 'Escape') {
document.querySelectorAll('.modal').forEach(m => m.style.display = 'none');
}
});



['mousemove', 'mousedown', 'keypress', 'touchstart', 'scroll', 'click'].forEach(evt => {
window.addEventListener(evt, resetInactivityTimer, { passive: true });
});



window.addEventListener('resize', () => {
let pages = document.querySelectorAll('.app-page');
pages.forEach(p => {
if (!p.classList.contains('active-page')) p.style.display = 'none';
});
});



document.addEventListener("DOMContentLoaded", async function() {
initTheme();
// Oturum geri yukleme: Supabase oturumu varsa dogrudan uygulamaya gir.
if (typeof restoreSession === 'function') {
  let restored = await restoreSession();
  if (restored) return;
}
initCloudGlobalData();

let savedUser = localStorage.getItem('sys_logged_user');
if (savedUser) {
try {
let parsedUser = JSON.parse(savedUser);
if (parsedUser && parsedUser.username) {
proceedLogin(parsedUser);
}
} catch(e) {}
}

let manageBtn = document.getElementById('manageProductsBtn');
if (manageBtn) {
manageBtn.addEventListener('click', function(e) {
e.preventDefault();
openEditProductModal();
});
}

let passwordBtn = document.getElementById('openPasswordModalBtn');
if (passwordBtn) {
passwordBtn.addEventListener('click', function(e) {
e.preventDefault();
openPasswordModal();
});
}

let userMgmtBtn = document.getElementById('openUserMgmtModalBtn');
if (userMgmtBtn) {
userMgmtBtn.addEventListener('click', function(e) {
e.preventDefault();
renderUserManagement();
openModal('userManagementModal');
});
}
});



document.addEventListener('click', function(e) {
let searchBox = document.getElementById('productSearchInput');
let listEl = document.getElementById('productSuggestionsList');
if (searchBox && listEl && !searchBox.contains(e.target) && !listEl.contains(e.target)) listEl.style.display = 'none';
});
