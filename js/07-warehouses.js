// ============================================================
// WAREHOUSES - Depo yonetimi
// ============================================================



function updateDepotUI() {
let tabContainer = document.getElementById('depotTabsContainer');
if (tabContainer) {
tabContainer.innerHTML = depots.map(d => `<button class="tab-btn ${d === currentViewDepot ? 'active' : ''}" onclick="switchDepot('${d}')">📍 ${d}</button>`).join('');
}
let txDepotSel = document.getElementById('txDepot');
if (txDepotSel) {
let prevVal = txDepotSel.value || depots[0];
txDepotSel.innerHTML = depots.map(d => `<option value="${d}">${d}</option>`).join('');
txDepotSel.value = depots.includes(prevVal) ? prevVal : depots[0];
}
let targetDepotSel = document.getElementById('targetDepot');
if (targetDepotSel && txDepotSel) {
let prevTarget = targetDepotSel.value;
targetDepotSel.innerHTML = depots.filter(d => d !== txDepotSel.value).map(d => `<option value="${d}">${d}</option>`).join('');
if (depots.includes(prevTarget) && prevTarget !== txDepotSel.value) targetDepotSel.value = prevTarget;
}
if (!depots.includes(currentViewDepot)) currentViewDepot = depots[0];
}



function openDepotModal() {
if (!currentUser || currentUser.role === 'görüntüleyen') return;
let container = document.getElementById('depotInputsContainer');
if (!container) return;

container.innerHTML = depots.map(d => `
<div class="depot-mgmt-block" style="background:var(--bg); padding:8px 10px; border-radius:8px; border:1.5px solid var(--border); display:flex; gap:5px; align-items:center;">
<input type="text" class="depot-name-input" value="${d}" placeholder="Depo Adı" style="flex:1; height:34px; font-size:11px; font-weight:bold;">
<button type="button" class="btn btn-danger btn-sm" style="height:34px; padding:0 8px;" onclick="confirmRemoveDepot(this)">🗑️ Sil</button>
</div>
`).join('');

openModal('depotModal');
}


function closeDepotModal() {}



function addDepotField() {
let container = document.getElementById('depotInputsContainer');
if (!container) return;
let div = document.createElement('div');
div.className = "depot-mgmt-block";
div.style.cssText = "background:var(--bg); padding:8px 10px; border-radius:8px; border:1.5px solid var(--border); display:flex; gap:5px; align-items:center;";
div.innerHTML = `
<input type="text" class="depot-name-input" value="" placeholder="Yeni Depo Adı" style="flex:1; height:34px; font-size:11px; font-weight:bold;">
<button type="button" class="btn btn-danger btn-sm" style="height:34px; padding:0 8px;" onclick="confirmRemoveDepot(this)">🗑️ Sil</button>
`;
container.appendChild(div);
}



function confirmRemoveDepot(btn) {
let container = document.getElementById('depotInputsContainer');
if (container && container.querySelectorAll('.depot-mgmt-block').length <= 1) { showToast("Hata", "En az 1 depo kalmalı.", true); return; }
showCustomConfirm("Bu depoyu silmek istediğinize emin misiniz?", () => {
btn.closest('.depot-mgmt-block').remove();
showToast("Silindi", "Depo kaldırıldı.");
});
}



function saveDepotNames() {
let newDepots = [];
document.querySelectorAll('.depot-mgmt-block').forEach(block => {
let nameInput = block.querySelector('.depot-name-input');
let dName = nameInput ? sanitizeText(nameInput.value.trim().toUpperCase()) : '';
if (dName && !newDepots.includes(dName)) { newDepots.push(dName); }
});

if (newDepots.length === 0) { showToast("Hata", "Geçerli depo adı girin.", true); return; }
depots = newDepots;

products.forEach(p => {
if (!p.openings) p.openings = {}; if (!p.criticals) p.criticals = {};
let no = {}, nc = {};
depots.forEach(d => { 
no[d] = p.openings[d] !== undefined ? parseInputFloat(p.openings[d]) : 0; 
nc[d] = p.criticals[d] !== undefined ? parseInputFloat(p.criticals[d]) : 0; 
});
p.openings = no; p.criticals = nc; 
if (!p.allowedDepots) p.allowedDepots = [...depots];
});

saveConfigToCloud(); saveProductsToCloud(); updateDepotUI(); closeModal('depotModal'); closeDepotModal(); renderStock();
showToast("Başarılı", "Depolar güncellendi.");
}



function switchDepot(depotName) { currentViewDepot = depotName; updateDepotUI(); renderStock(); }
