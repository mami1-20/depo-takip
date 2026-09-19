
try {
let savedUser = localStorage.getItem('sys_logged_user');
if (savedUser) {
try {
  var __bootStyle = document.createElement('style');
  __bootStyle.textContent = `#loginBoxCard { display: none !important; }
/* === AI BÖLÜMÜ CSS SINIFLARI === */
.ai-cat-label { font-size:10px; font-weight:800; margin-bottom:4px; flex-shrink:0; }
.ai-cat-success { color:var(--success); }
.ai-cat-transfer { color:var(--transfer); }
.ai-empty { font-size:10px; color:var(--muted); margin-bottom:8px; padding:4px; flex-shrink:0; }
.ai-row { display:flex; justify-content:space-between; align-items:center; background:var(--card); padding:5px 8px; border-radius:6px; border:1.5px solid var(--border); margin-bottom:4px; flex-shrink:0; }
.ai-prod-name { font-size:11px; color:var(--text); }
.ai-prod-group { font-size:9px; color:var(--muted); display:block; }
.ai-prod-warn { font-size:9px; color:var(--warning); display:block; }
.ai-prod-danger { font-size:9px; color:var(--danger); display:block; }
.ai-prod-transfer { font-size:9px; color:var(--transfer); display:block; }
.ai-row-actions { display:flex; align-items:center; gap:6px; }
.ai-close-btn { height:22px; width:22px; padding:0; font-size:10px; }
.ai-badge { font-size:11px; padding:2px 8px; border-radius:4px; font-weight:800; }
.ai-badge-success { background:rgba(16,185,129,0.12); color:var(--success); }
.ai-badge-danger { background:rgba(239,68,68,0.12); color:var(--danger); }
.ai-badge-danger-light { background:rgba(239,68,68,0.15); color:var(--danger); font-weight:bold; padding:2px 6px; font-size:9px; }
.ai-badge-warning { background:rgba(245,158,11,0.15); color:var(--warning); font-weight:bold; padding:2px 6px; font-size:9px; }
.ai-badge-transfer { background:rgba(139,92,246,0.12); color:var(--transfer); }
.ai-acc { margin-top:8px; border-radius:8px; overflow:hidden; background:var(--card); flex-shrink:0; }
.ai-acc-warning { border:1.5px solid var(--warning); margin-top:8px; }
.ai-acc-danger { border:1.5px solid var(--danger); margin-top:6px; }
.ai-acc-transfer { border:1.5px solid var(--transfer); margin-top:8px; }
.ai-acc-header { padding:8px 10px; font-size:10px; font-weight:800; cursor:pointer; display:flex; justify-content:space-between; align-items:center; }
.ai-acc-header-warning { background:rgba(245,158,11,0.1); color:var(--warning); }
.ai-acc-header-danger { background:rgba(239,68,68,0.1); color:var(--danger); }
.ai-acc-header-transfer { background:rgba(139,92,246,0.1); color:var(--transfer); }
.ai-acc-body { display:none; padding:6px; flex-direction:column; gap:4px; background:var(--bg); }
.ai-acc-body-form { gap:6px; }
.ai-missing-card { background:var(--card); padding:8px; border-radius:8px; border:1.5px solid var(--border); display:flex; flex-direction:column; gap:5px; }
.ai-missing-header { display:flex; align-items:center; justify-content:space-between; }
.ai-missing-label { display:flex; align-items:center; gap:6px; cursor:pointer; margin:0; flex:1; }
.ai-missing-label input[type="checkbox"] { width:14px; height:14px; accent-color:var(--primary); }
.ai-missing-label-transfer input[type="checkbox"] { accent-color:var(--transfer); }
.ai-missing-fields { display:none; flex-direction:column; gap:5px; background:var(--bg); padding:6px; border-radius:6px; border:1.5px solid var(--border); }
.ai-missing-row { display:flex; gap:5px; align-items:center; flex-wrap:wrap; }
.ai-missing-select, .ai-missing-new-cat { min-width:120px; }
@media (max-width: 480px) {
  .ai-missing-select, .ai-missing-new-cat { flex:1 1 100%; }
  .ai-missing-crit { flex:0 0 70px; }
  .ai-missing-add-btn { flex:1 1 auto; }
}
.ai-missing-select { flex:1; height:28px; font-size:10px; padding:0 4px; }
.ai-missing-new-cat { flex:1; height:28px; font-size:10px; display:none; }
.ai-missing-crit-label { font-size:9px; color:var(--danger); font-weight:bold; }
.ai-missing-crit-transfer { color:var(--transfer); }
.ai-missing-crit { width:60px; height:26px; font-size:10px; text-align:center; }
.ai-missing-add-btn { flex:1; height:26px; font-size:9px; }
.ai-missing-add-transfer { background:var(--transfer); box-shadow:0 2px 6px rgba(139,92,246,0.25); }
.ai-date-display { margin-bottom:6px; flex-shrink:0; height:32px; font-size:11px; }
.ai-date-label { font-size:10px; color:var(--muted); }
.ai-date-text { color:var(--text); font-weight:700; }
.custom-date-display { display: flex; align-items: center; gap: 6px; padding: 0 10px; background: var(--input-bg); border: 1.5px solid var(--border); border-radius: 8px; cursor: pointer; color: var(--muted); transition: border-color 0.2s; }
.custom-date-display:hover { border-color: var(--primary); }
.custom-date-display input[type="hidden"] { display: none; }
.modal-calendar { z-index: 10000 !important; }`;
  document.head.appendChild(__bootStyle);
} catch(__e) {}
let parsed = JSON.parse(savedUser);
if (parsed && parsed.company) {
document.addEventListener('DOMContentLoaded', () => {
let logoEl = document.getElementById('pageHeaderLogo');
if (logoEl) logoEl.textContent = `📦 ${parsed.company.toUpperCase()}`;
});
}
}
let savedTheme = localStorage.getItem('sys_theme_v1');
if (savedTheme === 'light') {
document.documentElement.setAttribute('data-theme', 'light');
} else {
document.documentElement.setAttribute('data-theme', 'dark');
}
} catch(e) {}
