// ============================================================
// UTILS - Tema, modal, format, dogrulama, gomulu select, sayfa gecisi, akordeon
// ============================================================



function sanitizeText(str) {
if (!str) return '';
return String(str)
.replace(/['"\\<>{}[]\$&]/g, '')
.replace(/\s+/g, ' ')
.trim();
}


function showToast(title, message, isError = false) {
let t = document.getElementById('toastNotice');
if (!t) return;
let iconEl = document.getElementById('toastIcon');
let titleEl = document.getElementById('toastTitle');
titleEl.textContent = title;
titleEl.style.color = isError ? '#f87171' : '#38bdf8';
iconEl.textContent = isError ? '❌' : '✅';
document.getElementById('toastMsg').textContent = message;
t.classList.add('active');
clearTimeout(toastTimeout);
toastTimeout = setTimeout(() => { t.classList.remove('active'); }, 3000);
}



function showCustomConfirm(msg, onConfirmCallback) {
let modal = document.getElementById('customConfirmModal');
let msgEl = document.getElementById('customConfirmMsg');
let okBtn = document.getElementById('customConfirmOkBtn');
if (!modal || !msgEl || !okBtn) return;
msgEl.textContent = msg;
let newOkBtn = okBtn.cloneNode(true);
okBtn.parentNode.replaceChild(newOkBtn, okBtn);
newOkBtn.addEventListener('click', () => {
closeModal('customConfirmModal');
if (onConfirmCallback) onConfirmCallback();
});
openModal('customConfirmModal');
}



function requestAdminPasswordForAction(actionType) {
if (!currentUser || currentUser.role !== 'admin') {
showToast("Yetki Yok", "Bu işlem için admin yetkisi gerekiyor.", true);
return;
}
pendingAdminAction = actionType;
let pinInp = document.getElementById('adminActionPinInput');
if (pinInp) pinInp.value = '';
let titleEl = document.getElementById('adminPromptActionTitle');
if (titleEl) {
titleEl.textContent = actionType === 'deleteAllProducts' ? '⚠️ Tüm Ürünleri Sil (Şifre Onayı)' : '⚠️ Firmayı Tamamen Sil (Şifre Onayı)';
}
openModal('adminPasswordPromptModal');
setTimeout(() => { if(pinInp) pinInp.focus(); }, 100);
}



function verifyAdminPasswordAndExecute() {
let pinInp = document.getElementById('adminActionPinInput');
if (!pinInp) return;
let enteredPin = pinInp.value.trim();

if (!enteredPin || enteredPin !== currentUser.pin) {
showToast("Hata", "Şifre yanlış! İşlem iptal edildi.", true);
return;
}

closeModal('adminPasswordPromptModal');
let action = pendingAdminAction;
pendingAdminAction = null;

if (action === 'deleteAllProducts') {
confirmDeleteAllProducts();
} else if (action === 'deleteCompany') {
confirmDeleteCompany();
}
}



function cleanTurkishChars(str) {
if (!str) return '';
return String(str)
.replace(/İ/g, 'I').replace(/ı/g, 'i')
.replace(/Ş/g, 'S').replace(/ş/g, 's')
.replace(/Ğ/g, 'G').replace(/ğ/g, 'g')
.replace(/Ü/g, 'U').replace(/ü/g, 'u')
.replace(/Ö/g, 'O').replace(/ö/g, 'o')
.replace(/Ç/g, 'C').replace(/ç/g, 'c');
}



function turkishNormalize(str) {
if (!str) return '';
return str.toLowerCase()
.replace(/ç/g, 'c').replace(/ğ/g, 'g').replace(/ı/g, 'i')
.replace(/i/g, 'i').replace(/ö/g, 'o').replace(/ş/g, 's')
.replace(/ü/g, 'u').replace(/İ/g, 'i').replace(/I/g, 'i');
}



function roundNum(val, decimals = 2) { return Number(Math.round(val + 'e' + decimals) + 'e-' + decimals); }


function parseInputFloat(val) {
if (!val && val !== 0) return 0;
let normalized = String(val).replace(',', '.');
let num = parseFloat(normalized);
return isNaN(num) ? 0 : roundNum(num);
}



function validateInputLimitLive(input) {
if (currentTxType === 'GİRİŞ') return;
let maxAttr = input.getAttribute('max');
if (maxAttr === null) return;
let maxVal = parseFloat(maxAttr);
let currentVal = parseInputFloat(input.value);
if (currentVal > maxVal) {
showToast("Maksimum Sınır", `Depoda en fazla ${maxVal} mevcut.`, true);
input.value = maxVal;
}
}



function checkCapsLock(e, warningId) {
let isCapsLock = e.getModifierState && e.getModifierState('CapsLock');
let el = document.getElementById(warningId);
if (el) el.style.display = isCapsLock ? 'block' : 'none';
}


function hideCaps(warningId) { 
let el = document.getElementById(warningId);
if (el) el.style.display = 'none'; 
}


function clearOtherCaps(activeInputId) {
if (activeInputId === 'userInput') {
let el = document.getElementById('pinCapsLockWarning');
if (el) el.style.display = 'none';
} else {
let el = document.getElementById('userCapsLockWarning');
if (el) el.style.display = 'none';
}
}



function togglePasswordVisibility() {
let pinInput = document.getElementById('pinInput');
let btn = event.currentTarget;
if (pinInput.type === 'password') { pinInput.type = 'text'; btn.textContent = '🔒 Gizle'; }
else { pinInput.type = 'password'; btn.textContent = '👁️ Göster'; }
}



function handleLoginEnter(e) { if (e.key === 'Enter') verifyLogin(); }



function getTurkeyDateNow() {
try {
let options = { timeZone: "Europe/Istanbul", year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false };
let formatter = new Intl.DateTimeFormat([], options);
let parts = formatter.formatToParts(new Date());
let p = {};
parts.forEach(obj => p[obj.type] = obj.value);
return { year: p.year, month: p.month, day: p.day, hour: p.hour, minute: p.minute, isoDate: `${p.year}-${p.month}-${p.day}`, shortDate: `${p.day}.${p.month}.${p.year}`, timeStr: `${p.hour}:${p.minute}` };
} catch(e) {
let now = new Date();
let iso = now.toISOString().split('T')[0];
let parts = iso.split('-');
return { year: parts[0], month: parts[1], day: parts[2], hour: String(now.getHours()).padStart(2, '0'), minute: String(now.getMinutes()).padStart(2, '0'), isoDate: iso, shortDate: `${parts[2]}.${parts[1]}.${parts[0]}`, timeStr: `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}` };
}
}



function initTheme() {
let savedTheme = localStorage.getItem('sys_theme_v1');
if (savedTheme) {
setTheme(savedTheme, false);
} else {
let tr = getTurkeyDateNow();
let trHour = parseInt(tr.hour, 10);
if (trHour >= 19 || trHour < 7) {
setTheme('dark', false);
} else {
setTheme('light', false);
}
}
}



function setTheme(themeName, save = true) {
let body = document.getElementById('pageBody');
let btn = document.getElementById('themeToggleBtn');
if (themeName === 'light') {
if (body) body.setAttribute('data-theme', 'light');
document.documentElement.setAttribute('data-theme', 'light');
if (btn) btn.textContent = '🌙';
if (save) localStorage.setItem('sys_theme_v1', 'light');
} else {
if (body) body.setAttribute('data-theme', 'dark');
document.documentElement.setAttribute('data-theme', 'dark');
if (btn) btn.textContent = '☀️';
if (save) localStorage.setItem('sys_theme_v1', 'dark');
}
}



function toggleTheme() {
let body = document.getElementById('pageBody');
let currentTheme = body ? body.getAttribute('data-theme') : 'dark';
if (currentTheme === 'light') {
setTheme('dark');
} else {
setTheme('light');
}
}



function openModal(modalId) {
let m = document.getElementById(modalId);
if (!m) return;
if (modalId === 'customCalendarModal' && m.parentNode !== document.body) {
    document.body.appendChild(m); // takvim daima en son (en ustte) acilsin
}
m.style.display = 'flex';
}


function closeModal(modalId) {
let m = document.getElementById(modalId);
if (m) m.style.display = 'none';
}



function debounce(func, delay) {
let timeoutId;
return function(...args) {
clearTimeout(timeoutId);
timeoutId = setTimeout(() => func.apply(this, args), delay);
};
}



function changeQty(inputId, amount) {
let input = document.getElementById(inputId);
if (!input) return;
let currentValue = parseInputFloat(input.value);
let min = parseFloat(input.getAttribute('min')) || 0;
let max = input.getAttribute('max') !== null ? parseFloat(input.getAttribute('max')) : null;
let newValue = roundNum(currentValue + amount);
if (max !== null && newValue > max) { 
showToast("Maksimum Sınır", `Depoda en fazla ${max} mevcut.`, true); 
input.value = max; 
return; 
}
if (newValue < min) newValue = min;
input.value = newValue;
}



function resetInactivityTimer() {
if (!isLogged) return;
clearTimeout(inactivityTimer);
inactivityTimer = setTimeout(() => {
if (isLogged) {
showToast("Oturum Kapandı", "5 dakika işlem yapılmadığı için güvenlik amaçlı çıkış yapıldı.", true);
logout();
}
}, INACTIVITY_LIMIT_MS);
}



function switchPage(pageId) {
try {
sessionStorage.setItem('sys_active_page', pageId);
  try { if (pageId === 'rapor') enhancerApplyToIds(['reportDepotFilter', 'reportTypeFilter']); } catch(e) {}
} catch(e) {}

let pages = document.querySelectorAll('.app-page');
let navItems = document.querySelectorAll('.mobile-bottom-nav .nav-item');
let sideItems = document.querySelectorAll('.desktop-sidebar .nav-item');

pages.forEach(p => {
p.classList.remove('active-page');
p.style.display = 'none';
});
navItems.forEach(n => n.classList.remove('active'));
sideItems.forEach(s => s.classList.remove('active'));

let targetPage = document.getElementById('page-' + pageId);
if (targetPage) {
targetPage.classList.add('active-page');
targetPage.style.display = 'flex';
}

let btnIdx = 0;
if (pageId === 'islem') btnIdx = 1;
else if (pageId === 'rapor') btnIdx = 2;
else if (pageId === 'yonetim') btnIdx = 3;

let mobBtn = document.querySelectorAll('.mobile-bottom-nav .nav-item')[btnIdx];
if (mobBtn) mobBtn.classList.add('active');

let sideBtn = document.querySelectorAll('.desktop-sidebar .nav-item')[btnIdx];
if (sideBtn) sideBtn.classList.add('active');

if (pageId === 'islem') {
setTimeout(() => {
let pSearch = document.getElementById('productSearchInput');
if (pSearch) { pSearch.focus(); pSearch.select(); }
}, 100);
} else if (pageId === 'rapor') {
setTimeout(() => { filterReport(false); }, 150);
}
}



// ==========================================
// 🧠 AI ASİSTAN VE HIZLI GÖRÜNTÜ SIKIŞTIRMA MİMARİSİ (KÖPRÜ FONKSİYONLARI İLE)
// ==========================================

// --- KÖPRÜ FONKSİYONLARI (Tekrarları önler) ---
function formatTrDate(dateInputId) {
    let trNow = getTurkeyDateNow();
    let customDate = null;
    if (dateInputId) {
        let dateInput = document.getElementById(dateInputId);
        if (dateInput && dateInput.value) customDate = dateInput.value;
    }
    if (customDate) {
        let p = customDate.split('-');
        return `${p[2]}.${p[1]}.${p[0]} ${trNow.timeStr}`;
    }
    return `${trNow.day}.${trNow.month}.${trNow.year} ${trNow.timeStr}`;
}



function getUserSignature() {
    return `👤 ${currentUser.username}`;
}



function getDepotValue(selectId, fallback) {
    let el = document.getElementById(selectId);
    return (el && el.value) ? el.value : fallback;
}



// ==== TEMAYA UYUMLU GOMULU SELECT SURUCU ====
function enhancerInitialize(selectEl) {
  if (!selectEl || selectEl.dataset.usaiEnhanced === '1') return null;
  selectEl.dataset.usaiEnhanced = '1';
  selectEl.classList.add('usai-native-hidden');
  let wrap = document.createElement('div'); wrap.className = 'usai-select-wrap';
  let btn = document.createElement('div'); btn.className = 'usai-select-btn';
  let label = document.createElement('span'); label.className = 'usai-select-label';
  let caret = document.createElement('span'); caret.className = 'usai-caret'; caret.textContent = '\u25be';
  btn.appendChild(label); btn.appendChild(caret);
  let panel = document.createElement('div'); panel.className = 'usai-select-panel';
  wrap.appendChild(btn); wrap.appendChild(panel);
  selectEl.parentNode.insertBefore(wrap, selectEl.nextSibling);
  function currentLabel() { let opt = selectEl.options[selectEl.selectedIndex]; return opt ? opt.textContent : (selectEl.value || ''); }
  function rebuild() {
    label.textContent = currentLabel();
    panel.innerHTML = '';
    Array.from(selectEl.options).forEach(function (opt, i) {
      let d = document.createElement('div');
      d.className = 'usai-select-opt' + (i === selectEl.selectedIndex ? ' sel' : '');
      d.textContent = opt.textContent;
      d.onclick = function (ev) { ev.stopPropagation(); selectEl.selectedIndex = i; selectEl.dispatchEvent(new Event('change', { bubbles: true })); label.textContent = currentLabel(); panel.classList.remove('open'); panel.querySelectorAll('.usai-select-opt').forEach(function (x, j) { x.classList.toggle('sel', j === i); }); };
      panel.appendChild(d);
    });
  }
  btn.onclick = function (ev) { ev.stopPropagation(); document.querySelectorAll('.usai-select-panel.open').forEach(function (p) { if (p !== panel) p.classList.remove('open'); }); rebuild(); panel.classList.toggle('open'); };
  document.addEventListener('click', function () { panel.classList.remove('open'); });
  let mo = new MutationObserver(rebuild); mo.observe(selectEl, { childList: true });
  selectEl.__usaiRefresh = rebuild;
  return { wrap: wrap, refresh: rebuild };
}


function enhancerApplyToIds(ids) { ids.forEach(function (id) { let el = document.getElementById(id); if (el && el.tagName === 'SELECT') enhancerInitialize(el); }); }




// Akordeon başlığı: her zaman görünür. count=0 ise "kayıt yok" notu gösterir.
function renderAccordionHeader(bodyId, title, count, tone) {
  let color = tone === 'danger' ? 'var(--danger)' : (tone === 'transfer' ? 'var(--transfer)' : 'var(--warning)');
  let bg = tone === 'danger' ? 'rgba(239,68,68,0.1)' : (tone === 'transfer' ? 'rgba(139,92,246,0.1)' : 'rgba(245,158,11,0.1)');
  let empty = count === 0;
  let onclick = empty ? '' : " onclick=\"toggleAccordion('" + bodyId + "')\"";
  return '<div style="margin-top:8px; border:1.5px solid ' + color + '; border-radius:8px; overflow:hidden; background:var(--card); flex-shrink:0;">' +
    '<div style="background:' + bg + '; padding:8px 10px; font-size:10px; font-weight:800; color:' + color + '; cursor:' + (empty ? 'default' : 'pointer') + '; display:flex; justify-content:space-between; align-items:center; opacity:' + (empty ? '0.65' : '1') + ';"' + onclick + '>' +
      '<span>' + title + ' (' + count + ')</span>' +
      '<span>' + (empty ? '' : '▼') + '</span>' +
    '</div>' +
    (empty ? '<div style="padding:7px 10px; font-size:10px; color:var(--muted); background:var(--bg);">Bu kategoride ürün yok.</div>' : '') +
  '</div>';
}



function toggleAccordion(bodyId) { let b = document.getElementById(bodyId); if (!b) return; b.style.display = (b.style.display === 'none' || b.style.display === '') ? 'flex' : 'none'; }
