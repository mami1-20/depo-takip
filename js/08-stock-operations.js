
// Tip-toleransli id esitligi (DB bigint <-> input string)
function sameId(a, b) { if (a === undefined || a === null || b === undefined || b === null) return false; return String(a) === String(b); }
// ============================================================
// STOCK OPERATIONS - Sepet, hizli islem, stok
// ============================================================



function minimizeCriticalAlertCard() { isCriticalCardMinimized = !isCriticalCardMinimized; renderStock(); }


function restoreCriticalAlertCard() { isCriticalCardMinimized = false; renderStock(); }



function openQuickTxModal(prodId) {
if (!currentUser || currentUser.role === 'görüntüleyen') return;
let prod = products.find(p => sameId(p.id, prodId));
if (!prod) return;
let idEl = document.getElementById('quickTxProdId');
if (idEl) idEl.value = prodId;
let nameEl = document.getElementById('quickTxProdName');
if (nameEl) nameEl.textContent = prod.name;
let infoEl = document.getElementById('quickTxDepotInfo');
if (infoEl) infoEl.textContent = `📍 Depo: ${currentViewDepot} (${prod.group})`;
let descEl = document.getElementById('quickDescInput');
if (descEl) descEl.value = '';
let qtyEl = document.getElementById('quickQtyInput');
if (qtyEl) qtyEl.value = '1';
setQuickTxType('ÇIKIŞ');
syncQuickTxLimits();
openModal('quickTxModal');
}


function closeQuickTxModal() {}



function setQuickTxType(type) {
quickTxType = type;
let btnOut = document.getElementById('quickBtnOut');
let btnIn = document.getElementById('quickBtnIn');
let btnTrans = document.getElementById('quickBtnTrans');
if (btnOut) btnOut.className = 'type-btn' + (type === 'ÇIKIŞ' ? ' active-out' : '');
if (btnIn) btnIn.className = 'type-btn' + (type === 'GİRİŞ' ? ' active-in' : '');
if (btnTrans) btnTrans.className = 'type-btn' + (type === 'TRANSFER' ? ' active-trans' : '');

let targetWrapper = document.getElementById('quickTargetDepotWrapper');
if (type === 'TRANSFER') {
if (targetWrapper) targetWrapper.style.display = 'block';
let tDepot = document.getElementById('quickTargetDepot');
if (tDepot) tDepot.innerHTML = depots.filter(d => d !== currentViewDepot).map(d => `<option value="${d}">${d}</option>`).join('');
} else {
if (targetWrapper) targetWrapper.style.display = 'none';
}
syncQuickTxLimits();
}



function syncQuickTxLimits() {
let prodIdEl = document.getElementById('quickTxProdId');
if (!prodIdEl) return;
let prodId = prodIdEl.value;
let currentSt = getCurrentStock(prodId, currentViewDepot);
let qtyInput = document.getElementById('quickQtyInput');
let qtyLabel = document.getElementById('quickQtyLabel');
if (quickTxType === 'ÇIKIŞ' || quickTxType === 'TRANSFER') {
if (qtyInput) qtyInput.setAttribute('max', currentSt);
if (qtyLabel) qtyLabel.textContent = `Miktar (Mevcut: ${currentSt})`;
if (qtyInput && parseInputFloat(qtyInput.value) > currentSt) qtyInput.value = currentSt > 0 ? currentSt : 1;
} else {
if (qtyInput) qtyInput.removeAttribute('max');
if (qtyLabel) qtyLabel.textContent = `Miktar (Mevcut: ${currentSt})`;
}
}



function saveQuickTransaction() {
if (!currentUser || currentUser.role === 'görüntüleyen') return;
let prodIdEl = document.getElementById('quickTxProdId');
let qtyEl = document.getElementById('quickQtyInput');
let descEl = document.getElementById('quickDescInput');
if (!prodIdEl || !qtyEl) return;

let prodId = prodIdEl.value;
let qty = parseInputFloat(qtyEl.value);
let desc = sanitizeText(descEl ? descEl.value.trim() : '');
let prod = products.find(p => sameId(p.id, prodId));
if (!prod || qty <= 0) { showToast("Eksik", "Miktar girin.", true); return; }

let trNow = getTurkeyDateNow();
let dateStr = `${trNow.day}.${trNow.month}.${trNow.year} ${trNow.timeStr}`;
let userSignature = `👤 ${currentUser.username}`;

if (quickTxType === 'TRANSFER') {
let targetDepotEl = document.getElementById('quickTargetDepot');
let targetDepot = targetDepotEl ? targetDepotEl.value : depots[0];
if (prod.allowedDepots && !prod.allowedDepots.includes(targetDepot)) {
showToast("Hata", `Bu ürün ${targetDepot} deposunda bulunmamaktadır!`, true);
return;
}
let currentStock = getCurrentStock(prodId, currentViewDepot);
if (qty > currentStock) { showToast("Yetersiz", "Stok yetersiz.", true); return; }
transactions.push({ date: dateStr, depot: currentViewDepot, prodId: prod.id, prodName: prod.name, type: 'TRANSFER', qty: qty, desc: `➔ ${targetDepot} [${userSignature}]` });
transactions.push({ date: dateStr, depot: targetDepot, prodId: prod.id, prodName: prod.name, type: 'TRANSFER', qty: qty, desc: `⬅ ${currentViewDepot} [${userSignature}]` });
} else {
if (quickTxType === 'ÇIKIŞ' && qty > getCurrentStock(prodId, currentViewDepot)) { showToast("Yetersiz", "Stok yetersiz.", true); return; }
transactions.push({ date: dateStr, depot: currentViewDepot, prodId: prod.id, prodName: prod.name, type: quickTxType, qty: qty, desc: (desc ? `Hızlı: ${desc}` : 'Hızlı İşlem') + ` [${userSignature}]` });
}

saveTransactionsToCloud();
closeModal('quickTxModal');
closeQuickTxModal();
renderStock();
showToast("Başarılı", "İşlem kaydedildi.");
}



function addToCart() {
if (!currentUser || currentUser.role === 'görüntüleyen') return;
let prodSelectEl = document.getElementById('prodSelect');
let qtyEl = document.getElementById('qtyInput');
let depotEl = document.getElementById('txDepot');
if (!prodSelectEl || !qtyEl || !depotEl) return;

let prodId = prodSelectEl.value;
let qty = parseInputFloat(qtyEl.value);
let sourceDepot = depotEl.value;
if (!prodId || qty <= 0) { showToast("Eksik", "Ürün ve miktar seçin.", true); return; }

let prod = products.find(p => sameId(p.id, prodId));
if (!prod) return;

let targetDepotEl = document.getElementById('targetDepot');
let targetDepot = (currentTxType === 'TRANSFER' && targetDepotEl) ? targetDepotEl.value : '';

if (currentTxType === 'TRANSFER') {
if (sourceDepot === targetDepot) { showToast("Hata", "Aynı depo seçilemez.", true); return; }
if (prod.allowedDepots && !prod.allowedDepots.includes(targetDepot)) {
showToast("Bulunamadı", `${prod.name} ürünü ${targetDepot} deposunda bulunmamaktadır!`, true);
return;
}
}

if (currentTxType === 'ÇIKIŞ' || currentTxType === 'TRANSFER') {
let currentStock = getCurrentStock(prodId, sourceDepot);
let alreadyInCart = currentCart.filter(item => sameId(item.prodId, prodId) && item.depot === sourceDepot).reduce((sum, item) => sum + item.qty, 0);
if ((qty + alreadyInCart) > currentStock) { showToast("Yetersiz", "Stok yetersiz.", true); return; }
}

currentCart.push({ id: 'cart_' + Date.now(), prodId: prod.id, prodName: prod.name, group: prod.group, depot: sourceDepot, targetDepot: targetDepot, type: currentTxType, qty: qty });
renderCart();

let pSearch = document.getElementById('productSearchInput');
if (pSearch) { pSearch.value = ''; setTimeout(() => { pSearch.focus(); pSearch.select(); }, 50); }
let pSelect = document.getElementById('prodSelect');
if (pSelect) pSelect.value = '';
if (qtyEl) qtyEl.value = '1';
showToast("Eklendi", `${prod.name} sepete eklendi.`);
}



function removeFromCart(id) { currentCart = currentCart.filter(item => item.id !== id); renderCart(); }



function changeCartQty(id, amount) {
let item = currentCart.find(i => i.id === id);
if (!item) return;
let newQty = roundNum(item.qty + amount);
if (newQty <= 0) { removeFromCart(id); return; }

if (item.type === 'ÇIKIŞ' || item.type === 'TRANSFER') {
let currentStock = getCurrentStock(item.prodId, item.depot);
if (newQty > currentStock) { showToast("Yetersiz", "Depo mevcudu aşıldı.", true); return; }
}
item.qty = newQty;
renderCart();
}



function renderCart() {
let container = document.getElementById('cartListContainer');
let badge = document.getElementById('cartCountBadge');
if (badge) badge.textContent = `${currentCart.length} Ürün`;
if (!container) return;
container.innerHTML = currentCart.length === 0 ? '<div style="font-size:11px; color:var(--muted); text-align:center; padding:6px;">Sepet boş.</div>' : currentCart.map(item => `
<div style="display:flex; justify-content:space-between; align-items:center; background:var(--card); padding:5px 7px; border-radius:6px; border:1.5px solid var(--border);">
<div><span style="font-size:9px; font-weight:800; color:var(--primary);">${item.group} • ${item.depot}</span><div style="font-size:11px; font-weight:700;">${item.prodName}</div></div>
<div style="display:flex; align-items:center; gap:3px;">
<button type="button" class="btn btn-outline btn-sm" style="width:20px; height:20px; padding:0; font-size:10px;" onclick="changeCartQty('${item.id}', -1)">-</button>
<span style="font-size:11px; font-weight:900; min-width:16px; text-align:center;">${item.qty}</span>
<button type="button" class="btn btn-outline btn-sm" style="width:20px; height:20px; padding:0; font-size:10px;" onclick="changeCartQty('${item.id}', 1)">+</button>
<button type="button" class="btn btn-danger btn-sm" style="width:20px; height:20px; padding:0; margin-left:3px; font-size:10px;" onclick="removeFromCart('${item.id}')">×</button>
</div>
</div>
`).join('');
}



async function saveCartTransactions() {
if (!currentUser || currentUser.role === 'görüntüleyen') return;
if (currentCart.length === 0) { showToast("Boş", "Sepet boş.", true); return; }

let descEl = document.getElementById('descInput');
let generalDesc = sanitizeText(descEl ? descEl.value.trim() : '');
let trNow = getTurkeyDateNow();
let customDateValEl = document.getElementById('txDateInput');
let customDateVal = customDateValEl ? customDateValEl.value : '';
let dateStr = customDateVal ? ('0'+new Date(customDateVal).getDate()).slice(-2)+'.'+('0'+(new Date(customDateVal).getMonth()+1)).slice(-2)+'.'+new Date(customDateVal).getFullYear()+' '+trNow.timeStr : `${trNow.day}.${trNow.month}.${trNow.year} ${trNow.timeStr}`;
let userSignature = `👤 ${currentUser.username}`;
let newTransactions = [];

for (let item of currentCart) {
if (item.type === 'TRANSFER') {
let prod = products.find(p => sameId(p.id, item.prodId));
if (prod && prod.allowedDepots && !prod.allowedDepots.includes(item.targetDepot)) {
showToast("Hata", `${prod.name} ürünü ${item.targetDepot} deposunda bulunmamaktadır!`, true);
return;
}
}
}

currentCart.forEach(item => {
let finalDesc = (generalDesc ? generalDesc : '') + ` [${userSignature}]`;
if (item.type === 'TRANSFER') {
newTransactions.push({ date: dateStr, depot: item.depot, prodId: item.prodId, prodName: item.prodName, type: 'TRANSFER', qty: item.qty, desc: `➔ ${item.targetDepot} [${userSignature}]` });
newTransactions.push({ date: dateStr, depot: item.targetDepot, prodId: item.prodId, prodName: item.prodName, type: 'TRANSFER', qty: item.qty, desc: `⬅ ${item.depot} [${userSignature}]` });
} else {
newTransactions.push({ date: dateStr, depot: item.depot, prodId: item.prodId, prodName: item.prodName, type: item.type, qty: item.qty, desc: finalDesc });
}
});

transactions.push(...newTransactions);
await saveTransactionsToCloud();
currentCart = []; renderCart();
if (descEl) descEl.value = '';
renderStock();
showToast("Başarılı", "Sepet depoya kaydedildi.");
}


const debouncedRenderStock = debounce(() => { renderStock(); }, 150);



function renderStock() {
if (!isLogged) return;
updateDepotUI();
let rawSearch = document.getElementById('searchInput')?.value || '';
let searchWords = turkishNormalize(rawSearch.trim()).split(/\s+/);
let html = '', criticalItems = [];

products.forEach(p => {
if (p.active === false) return;
if (p.allowedDepots && !p.allowedDepots.includes(currentViewDepot)) return;

let stock = getCurrentStock(p.id, currentViewDepot);
let critLimit = getProductCriticalLimit(p, currentViewDepot);
let isCritical = (critLimit > 0) && (stock <= critLimit);
if (isCritical) criticalItems.push({ name: p.name, qty: stock, limit: critLimit });

if (rawSearch.trim() !== "") {
let targetText = turkishNormalize(p.name + " " + p.group);
if (!searchWords.every(w => targetText.includes(w))) return;
}

html += `
<div class="stock-row" onclick="openQuickTxModal('${p.id}')">
<div class="stock-left"><span class="stock-group">${p.group}</span><span class="stock-name">${p.name}</span></div>
<div class="stock-right"><span class="stock-count">${stock}</span><span class="badge ${isCritical ? 'badge-warn' : 'badge-ok'}">${isCritical ? 'Kritik (' + critLimit + ')' : 'Yeterli'}</span></div>
</div>
`;
});

let stockListEl = document.getElementById('stockList');
if (stockListEl) stockListEl.innerHTML = html || '<div style="text-align:center; color:var(--muted); padding:10px;">Ürün bulunamadı.</div>';

let alertCard = document.getElementById('criticalAlertCard');
let alertList = document.getElementById('criticalAlertList');
let restoreBtn = document.getElementById('restoreCriticalBtn');
let restoreBadge = document.getElementById('restoreCriticalBadge');
let alertTitle = document.getElementById('criticalAlertTitle');
let exportCritBtn = document.getElementById('exportCriticalXlsxBtn');

if (criticalItems.length > 0) {
if (restoreBadge) restoreBadge.textContent = criticalItems.length;
if (alertTitle) alertTitle.textContent = `⚠️ Kritik Stok Uyarıları (${criticalItems.length})`;
if (exportCritBtn && currentUser && currentUser.role !== 'görüntüleyen') exportCritBtn.style.display = 'inline-block';

if (isCriticalCardMinimized) {
if (alertCard) alertCard.style.display = 'none';
if (restoreBtn) restoreBtn.style.display = 'block';
} else {
if (alertCard) alertCard.style.display = 'block';
if (restoreBtn) restoreBtn.style.display = 'none';
if (alertList) alertList.innerHTML = criticalItems.map(c => `<div style="display:flex; justify-content:space-between; background:var(--card); padding:5px 8px; border-radius:6px; border:1.5px solid var(--border);"><span><b>${c.name}</b></span><span style="color:var(--danger); font-weight:800;">Kalan: ${c.qty}</span></div>`).join('');
}
} else {
if (alertCard) alertCard.style.display = 'none';
if (restoreBtn) restoreBtn.style.display = 'none';
}
}



function setTxType(type) {
currentTxType = type;
let bOut = document.getElementById('btnOut');
let bIn = document.getElementById('btnIn');
let bTrans = document.getElementById('btnTrans');
if (bOut) bOut.className = 'type-btn' + (type === 'ÇIKIŞ' ? ' active-out' : '');
if (bIn) bIn.className = 'type-btn' + (type === 'GİRİŞ' ? ' active-in' : '');
if (bTrans) bTrans.className = 'type-btn' + (type === 'TRANSFER' ? ' active-trans' : '');

let targetWrapper = document.getElementById('targetDepotWrapper');
let lblTxDepot = document.getElementById('lblTxDepot');
let srcDepotBox = document.getElementById('srcDepotBox');
if (type === 'TRANSFER') { 
if (lblTxDepot) lblTxDepot.textContent = 'Kaynak Depo'; 
if (targetWrapper) targetWrapper.style.display = 'block'; 
if (srcDepotBox) srcDepotBox.classList.remove('full'); 
} else { 
if (lblTxDepot) lblTxDepot.textContent = 'Depo'; 
if (targetWrapper) targetWrapper.style.display = 'none'; 
if (srcDepotBox) srcDepotBox.classList.add('full'); 
}
syncMaxLimit();
}



const debouncedFilterSuggestions = debounce(() => { filterProductSuggestions(); }, 150);



function filterProductSuggestions() {
let pSearch = document.getElementById('productSearchInput');
let rawQuery = pSearch ? pSearch.value : '';
let normalizedQuery = turkishNormalize(rawQuery.trim());
let listEl = document.getElementById('productSuggestionsList');
if (!listEl) return;
if (normalizedQuery.length === 0) { listEl.style.display = 'none'; return; }
let searchWords = normalizedQuery.split(/\s+/);
let txDepotEl = document.getElementById('txDepot');
let depotVal = txDepotEl ? txDepotEl.value : depots[0];
let activeProds = products.filter(p => p.active !== false && (!p.allowedDepots || p.allowedDepots.includes(depotVal)));
let matched = activeProds.filter(p => searchWords.every(w => turkishNormalize(p.name + " " + p.group).includes(w)));
if (matched.length === 0) { listEl.innerHTML = '<div style="padding:8px; font-size:11px; color:var(--muted); text-align:center;">Ürün yok</div>'; listEl.style.display = 'block'; return; }
listEl.innerHTML = matched.map(p => `<div class="suggestion-item" onclick="selectProductFromSearch('${p.id}', '${p.name.replace(/'/g, "\\'")}')"><span><b>${p.name}</b></span><span style="font-size:9px; color:var(--primary);">${p.group}</span></div>`).join('');
listEl.style.display = 'block';
}



function selectProductFromSearch(prodId, prodName) {
let pSearch = document.getElementById('productSearchInput');
let pSelect = document.getElementById('prodSelect');
let qInput = document.getElementById('qtyInput');
let listEl = document.getElementById('productSuggestionsList');
if (pSearch) pSearch.value = prodName;
if (pSelect) pSelect.value = prodId;
syncMaxLimit();
if (listEl) listEl.style.display = 'none';
if (qInput) { qInput.focus(); qInput.select(); }
}
