
// Tip-toleransli id esitligi (DB bigint <-> input string)
function sameId(a, b) { if (a === undefined || a === null || b === undefined || b === null) return false; return String(a) === String(b); }
// ============================================================
// PRODUCTS - Urun, kategori ve Excel ice aktarma
// ============================================================



function downloadExcelTemplate() {
let headers = ["Kategori", "Ürün Adı"];
depots.forEach(d => headers.push(`${d} Stok`));
depots.forEach(d => headers.push(`${d} Kritik`));

let sampleRow = ["İÇECEKLER", "Çay"];
depots.forEach(() => sampleRow.push(10));
depots.forEach(() => sampleRow.push(5));

let wsData = [headers, sampleRow];
let ws = XLSX.utils.aoa_to_sheet(wsData);
let wb = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(wb, ws, "Stok_Sablonu");
XLSX.writeFile(wb, `${currentCompany || 'Firma'}_Stok_Sablonu.xlsx`);
showToast("Başarılı", "Örnek şablon indirildi.");
}



function handleExcelProductUpload(event) {
let file = event.target.files[0];
if (!file) return;

let reader = new FileReader();
reader.onload = function(e) {
try {
let data = new Uint8Array(e.target.result);
let workbook = XLSX.read(data, { type: 'array' });
let firstSheetName = workbook.SheetNames[0];
let worksheet = workbook.Sheets[firstSheetName];
let jsonRows = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

if (jsonRows.length < 2) {
showToast("Hata", "Excel dosyası boş veya geçersiz format.", true);
return;
}

let headers = jsonRows[0].map(h => String(h || '').trim());
let katIdx = headers.findIndex(h => turkishNormalize(h).includes('kategori') || turkishNormalize(h).includes('grup'));
let urunIdx = headers.findIndex(h => turkishNormalize(h).includes('urun') || turkishNormalize(h).includes('ad'));

if (katIdx === -1) katIdx = 0;
if (urunIdx === -1) urunIdx = 1;

let stockCols = [];
let criticCols = {};

headers.forEach((h, idx) => {
let hNorm = turkishNormalize(h);
if (idx > 1 && !hNorm.includes('toplam')) {
if (hNorm.includes('kritik')) {
let dName = h.replace(/kritik/gi, '').trim().toUpperCase();
criticCols[dName] = idx;
} else {
let dName = h.replace(/stok/gi, '').trim().toUpperCase();
stockCols.push({ name: dName, index: idx });
}
}
});

if (stockCols.length > 0) {
depots = stockCols.map(s => s.name);
}

let newProducts = [];
let currentCategory = "GENEL";

for (let r = 1; r < jsonRows.length; r++) {
let row = jsonRows[r];
if (!row || row.length === 0) continue;

let col0 = sanitizeText(String(row[katIdx] || ''));
let col1 = sanitizeText(String(row[urunIdx] || ''));

if (col0.startsWith('---') || (col0 !== '' && col1 === '')) {
let cleanCat = col0.replace(/-/g, '').trim();
if (cleanCat) currentCategory = sanitizeText(cleanCat.toUpperCase());
continue;
}

let prodName = col1 || col0;
if (!prodName || prodName.startsWith('---')) continue;

if (col0 !== '' && col1 !== '' && col0.toUpperCase() !== currentCategory) {
currentCategory = sanitizeText(col0.toUpperCase());
prodName = col1;
}

let openingsObj = {};
let allowedDepotsList = [];
stockCols.forEach(sc => {
let val = parseInputFloat(row[sc.index]);
openingsObj[sc.name] = val;
if (val > 0) {
allowedDepotsList.push(sc.name);
}
});
if (allowedDepotsList.length === 0) {
allowedDepotsList = [...depots];
}

let criticalsObj = {};
Object.keys(criticCols).forEach(dName => {
criticalsObj[dName] = parseInputFloat(row[criticCols[dName]]);
});

newProducts.push({
id: 'p_' + Date.now() + '_' + Math.floor(Math.random() * 10000),
group: currentCategory,
name: prodName,
openings: openingsObj,
criticals: criticalsObj,
allowedDepots: allowedDepotsList,
active: true
});
}

if (newProducts.length === 0) {
showToast("Hata", "Yüklenecek ürün bulunamadı.", true);
return;
}

products = newProducts;
saveProductsToCloud();
saveConfigToCloud();
renderStock();
showToast("Başarılı", `${newProducts.length} ürün yüklendi!`);
event.target.value = '';
} catch (err) {
showToast("Hata", "Excel okunurken hata oluştu.", true);
event.target.value = '';
}
};
reader.readAsArrayBuffer(file);
}



function getCurrentStock(prodId, depotName) {
let prod = products.find(p => sameId(p.id, prodId) || p.name === prodId);
if (!prod) return 0;
let realId = prod.id || prodId;
let opening = prod.openings && prod.openings[depotName] !== undefined ? parseInputFloat(prod.openings[depotName]) : 0;
let inQty = 0, outQty = 0;
transactions.forEach(t => {
let tId = t.prodId || t.productId;
let tName = t.prodName || t.name;
if ((tId === realId || tName === prod.name) && t.depot === depotName) {
if (t.type === 'GIRIS' || t.type === 'GİRİŞ') inQty = roundNum(inQty + parseInputFloat(t.qty));
if (t.type === 'CIKIS' || t.type === 'ÇIKIŞ') outQty = roundNum(outQty + parseInputFloat(t.qty));
}
});
return roundNum(opening + inQty - outQty);
}



function getProductCriticalLimit(prod, depotName) {
let prodObj = typeof prod === 'string' ? products.find(p => p.id === prod || p.name === prod) : prod;
if (!prodObj) return 0;
if (prodObj.criticals && prodObj.criticals[depotName] !== undefined) return parseInputFloat(prodObj.criticals[depotName]);
if (prodObj.critical !== undefined) return parseInputFloat(prodObj.critical);
return 0;
}



function openCategoryModal() {
if (!currentUser || currentUser.role === 'görüntüleyen') return;
tempCategoryProducts = JSON.parse(JSON.stringify(products));
openCategoryPanels.clear();
renderCategoryModalList();
openModal('categoryModal');
}



function cancelCategoryModal() {
tempCategoryProducts = [];
openCategoryPanels.clear();
closeModal('categoryModal');
}



async function saveCategoryModalChanges() {
if (!tempCategoryProducts || tempCategoryProducts.length === 0) {
closeModal('categoryModal');
return;
}
products = JSON.parse(JSON.stringify(tempCategoryProducts));
tempCategoryProducts = [];
openCategoryPanels.clear();

await saveProductsToCloud();
await saveConfigToCloud();
renderStock();
closeModal('categoryModal');
showToast("Başarılı", "Kategori ve depo değişiklikleri kaydedildi.");
}



function renderCategoryModalList() {
let container = document.getElementById('categoryModalListContainer');
if (!container) return;
let categories = [...new Set(tempCategoryProducts.map(p => p.group))].sort();

if (categories.length === 0) {
container.innerHTML = '<div style="font-size:11px; color:var(--muted); text-align:center; padding:12px;">Kategori yok.</div>';
return;
}

container.innerHTML = categories.map(cat => {
let catProducts = tempCategoryProducts.filter(p => p.group === cat);
let collapseId = 'cat_prods_' + cat.replace(/[^a-zA-Z0-9]/g, '_');
let isOpen = openCategoryPanels.has(collapseId);

let prodsListHtml = catProducts.map(p => {
let depotBadges = depots.map(d => {
let isAllowed = (!p.allowedDepots || p.allowedDepots.includes(d));
return isAllowed ? 
`<span style="font-size:10px; background:rgba(16,185,129,0.15); color:var(--success); padding:3px 8px; border-radius:6px; display:inline-flex; align-items:center; gap:4px; font-weight:700;">📍 ${d} <button type="button" style="background:none; border:none; color:var(--danger); cursor:pointer; font-weight:bold; font-size:13px; line-height:1; margin-left:3px;" onclick="removeProductFromDepot('${p.id}', '${d}')" title="Bu ürünü ${d} deposundan sil">×</button></span>` :
`<span style="font-size:10px; background:var(--border); color:var(--muted); padding:3px 8px; border-radius:6px; display:inline-flex; align-items:center; gap:4px; font-weight:700;">🚫 ${d} <button type="button" style="background:none; border:none; color:var(--success); cursor:pointer; font-weight:bold; font-size:12px; line-height:1; margin-left:3px;" onclick="addProductToDepot('${p.id}', '${d}')" title="Bu ürünü ${d} deposuna ekle">+</button></span>`;
}).join('');

return `
<div style="background:var(--card); padding:8px 10px; border-radius:8px; border:1.5px solid var(--border); display:flex; justify-content:space-between; align-items:center; gap:8px;">
<div style="flex:1; font-size:11px; font-weight:700; color:var(--text);">${p.name}</div>
<div style="display:flex; gap:5px; flex-wrap:wrap; justify-content:flex-end;">${depotBadges}</div>
</div>
`;
}).join('');

return `
<div style="background:var(--card); padding:10px; border-radius:10px; border:1.5px solid var(--border); display:flex; flex-direction:column; gap:6px;">
<div style="display:flex; align-items:center; gap:6px;">
<input type="text" value="${cat}" style="flex:1; height:34px; font-size:12px; padding:4px 8px; font-weight:bold; color:var(--text); background:var(--input-bg); border:1.5px solid var(--border); border-radius:8px;" onchange="renameCategory('${cat}', sanitizeText(this.value))">
<button type="button" class="btn btn-outline btn-sm" style="height:34px; font-size:11px; padding:0 10px; white-space:nowrap;" onclick="toggleCategoryDepotsPanel('${collapseId}')">📦 Ürünleri Yönet (${catProducts.length})</button>
<button type="button" class="btn btn-danger btn-sm" style="height:34px; width:34px; padding:0; font-size:12px;" onclick="showCustomConfirm('${cat} kategorisi ve içindeki ürünler tamamen silinsin mi?', () => deleteEntireCategory('${cat}'))" title="Kategoriyi Sil">🗑️</button>
</div>
<div id="${collapseId}" style="display:${isOpen ? 'flex' : 'none'}; flex-direction:column; gap:5px; background:var(--bg); padding:8px; border-radius:8px; border:1.5px solid var(--border); max-height:240px; overflow-y:auto;">
<div style="font-size:10px; font-weight:800; color:var(--muted); margin-bottom:3px;">Ürünlerin Depo Bağlantıları:</div>
${prodsListHtml}
</div>
</div>
`;
}).join('');
}



function toggleCategoryDepotsPanel(panelId) {
let panel = document.getElementById(panelId);
if (!panel) return;
if (openCategoryPanels.has(panelId)) {
openCategoryPanels.delete(panelId);
panel.style.display = 'none';
} else {
openCategoryPanels.add(panelId);
panel.style.display = 'flex';
}
}



function removeProductFromDepot(prodId, depotName) {
let p = tempCategoryProducts.find(x => sameId(x.id, prodId));
if (!p) return;
if (!p.allowedDepots) {
p.allowedDepots = [...depots];
}
p.allowedDepots = p.allowedDepots.filter(d => d !== depotName);
renderCategoryModalList();
}



function addProductToDepot(prodId, depotName) {
let p = tempCategoryProducts.find(x => sameId(x.id, prodId));
if (!p) return;
if (!p.allowedDepots) {
p.allowedDepots = [...depots];
}
if (!p.allowedDepots.includes(depotName)) {
p.allowedDepots.push(depotName);
}
renderCategoryModalList();
}



function renameCategory(oldName, newNameVal) {
let newName = sanitizeText(newNameVal.trim().toUpperCase());
if (!newName || oldName === newName) return;
if (tempCategoryProducts.some(p => p.group === newName)) {
showToast("Hata", "Bu isimde başka kategori var.", true);
renderCategoryModalList();
return;
}
tempCategoryProducts.forEach(p => { if (p.group === oldName) p.group = newName; });
renderCategoryModalList();
}



function deleteEntireCategory(catName) {
if (!currentUser || currentUser.role !== 'admin') return;
tempCategoryProducts = tempCategoryProducts.filter(p => p.group !== catName);
renderCategoryModalList();
}



function openEditProductModal() {
if (!currentUser || currentUser.role === 'görüntüleyen') {
showToast("Yetki Yok", "Yetkiniz yok.", true);
return;
}
let searchInput = document.getElementById('productMgmtSearch');
if (searchInput) searchInput.value = '';
renderProductManagementTable();
openModal('editProductModal');
}


function closeEditProductModal() {
saveProductsToCloud();
renderStock();
}



function renderProductManagementTable() {
let container = document.getElementById('productMgmtTableContainer');
if (!container) return;
let rawSearch = document.getElementById('productMgmtSearch')?.value || '';
let searchWords = turkishNormalize(rawSearch.trim()).split(/\s+/);

let existingGroups = [...new Set(products.map(p => p.group))].sort();

let filteredProds = products.filter(p => {
if (!rawSearch.trim()) return true;
let targetText = turkishNormalize(p.name + " " + p.group);
return searchWords.every(w => targetText.includes(w));
});

if (filteredProds.length === 0) {
container.innerHTML = '<div style="font-size:11px; color:var(--muted); text-align:center; padding:12px;">Ürün bulunamadı.</div>';
return;
}

container.innerHTML = filteredProds.map(p => {
let isActive = p.active !== false;
let groupOptions = existingGroups.map(g => `<option value="${g}" ${p.group === g ? 'selected' : ''}>${g}</option>`).join('');
let safeProdName = (p.name || '').replace(/'/g, "&#39;").replace(/"/g, "&quot;");

return `
<div style="background:var(--card); padding:8px; border-radius:10px; border:1.5px solid var(--border); display:flex; flex-direction:column; gap:6px;" data-id="${p.id}">
<div style="display:flex; gap:5px; align-items:center; flex-wrap:wrap;">
<select class="mgmt-group" style="flex:1; min-width:85px; height:34px; font-size:11px; padding:0 4px;" onchange="checkMgmtGroupChange(this); autoSaveProduct('${p.id}')">
${groupOptions}
<option value="__NEW__">➕ Yeni...</option>
</select>
<input type="text" class="mgmt-new-group" placeholder="Yeni Kategori" style="flex:1; min-width:75px; height:34px; font-size:11px; display:none;" onblur="autoSaveProduct('${p.id}')">
<input type="text" class="mgmt-name" value="${p.name}" placeholder="Ürün Adı" style="flex:1.5; min-width:100px; height:34px; font-size:11px;" onchange="autoSaveProduct('${p.id}')">
<div style="display:flex; gap:4px; align-items:center;">
<button type="button" class="btn ${isActive ? 'btn-success' : 'btn-danger'} btn-sm" style="height:34px; font-size:10px; font-weight:800; padding:0 10px;" onclick="toggleMgmtProductStatus('${p.id}')">${isActive ? 'AKTİF' : 'PASİF'}</button>
${currentUser.role === 'admin' ? `<button type="button" class="btn btn-danger btn-sm" style="height:34px; font-size:11px; padding:0 8px;" onclick="showCustomConfirm('${safeProdName} silinsin mi?', () => deleteMgmtProduct('${p.id}'))">🗑️</button>` : ''}
</div>
</div>
<div style="display:flex; flex-direction:column; gap:4px; background:var(--bg); padding:6px; border-radius:6px; border:1.5px solid var(--border);">
${depots.map(d => {
let critVal = p.criticals && p.criticals[d] !== undefined ? p.criticals[d] : (p.critical !== undefined ? p.critical : 0);
let isAllowed = (!p.allowedDepots || p.allowedDepots.includes(d));
return `<div style="display:flex; justify-content:space-between; align-items:center; gap:5px;">
 <span style="font-size:10px; font-weight:800; color:var(--primary); min-width:55px;">📍 ${d}</span>
 <div style="display:flex; gap:5px; align-items:center;">
   <span style="font-size:9px; color:var(--danger);">Kritik:</span><input type="number" class="mgmt-critical" data-depot="${d}" value="${critVal}" step="any" style="width:60px; height:26px; font-size:10px; text-align:center;" ${!isAllowed ? 'disabled' : ''} onchange="autoSaveProduct('${p.id}')">
   <button type="button" class="btn ${isAllowed ? 'btn-danger' : 'btn-success'} btn-sm" style="height:26px; font-size:9px; padding:0 6px;" onclick="toggleProductDepotAccess('${p.id}', '${d}')">${isAllowed ? 'Depodan Kaldır' : 'Depoya Ekle'}</button>
 </div>
</div>`;
}).join('')}
</div>
</div>
`;
}).join('');
}



function toggleProductDepotAccess(prodId, depotName) {
let p = products.find(x => sameId(x.id, prodId));
if (!p) return;
if (!p.allowedDepots) p.allowedDepots = [...depots];
if (p.allowedDepots.includes(depotName)) {
p.allowedDepots = p.allowedDepots.filter(d => d !== depotName);
} else {
p.allowedDepots.push(depotName);
}
saveProductsToCloud();
renderProductManagementTable();
renderStock();
}



function checkMgmtGroupChange(selectEl) {
let newGroupInput = selectEl.parentElement.querySelector('.mgmt-new-group');
if (selectEl.value === '__NEW__') {
newGroupInput.style.display = 'block';
newGroupInput.focus();
} else {
newGroupInput.style.display = 'none';
newGroupInput.value = '';
}
}



function autoSaveProduct(prodId) {
let rowEl = document.querySelector(`[data-id="${prodId}"]`);
if (!rowEl) return;
let p = products.find(x => sameId(x.id, prodId));
if (!p) return;

let groupSelectVal = rowEl.querySelector('.mgmt-group').value;
let newGroupInputVal = sanitizeText(rowEl.querySelector('.mgmt-new-group').value.trim().toUpperCase());
let group = (groupSelectVal === '__NEW__') ? newGroupInputVal : groupSelectVal;
let name = sanitizeText(rowEl.querySelector('.mgmt-name').value.trim());

if (!group || !name) return;

p.group = group;
p.name = name;
if (!p.openings) p.openings = {};
if (!p.criticals) p.criticals = {};

rowEl.querySelectorAll('.mgmt-critical').forEach(inp => {
p.criticals[inp.getAttribute('data-depot')] = parseInputFloat(inp.value);
});

saveProductsToCloud();
renderStock();
}



function toggleMgmtProductStatus(prodId) {
let p = products.find(x => sameId(x.id, prodId));
if (p) {
p.active = p.active === false ? true : false;
saveProductsToCloud();
renderProductManagementTable();
renderStock();
}
}



function deleteMgmtProduct(prodId) {
if (!currentUser || currentUser.role !== 'admin') return;
products = products.filter(x => x.id !== prodId);
saveProductsToCloud();
renderProductManagementTable();
renderStock();
}



function syncMaxLimit() {
let prodSelectEl = document.getElementById('prodSelect');
let sourceDepotEl = document.getElementById('txDepot');
let qtyInput = document.getElementById('qtyInput');
let qtyLabel = document.getElementById('qtyLabel');
if (!prodSelectEl || !sourceDepotEl || !qtyInput) return;

let prodId = prodSelectEl.value;
let sourceDepot = sourceDepotEl.value;

if (currentTxType === 'TRANSFER') {
let tDepot = document.getElementById('targetDepot');
if (tDepot) {
let prevTarget = tDepot.value;
tDepot.innerHTML = depots.filter(d => d !== sourceDepot).map(d => `<option value="${d}">${d}</option>`).join('');
if (depots.includes(prevTarget) && prevTarget !== sourceDepot) tDepot.value = prevTarget;
}
}
if ((currentTxType === 'ÇIKIŞ' || currentTxType === 'TRANSFER') && prodId) {
let currentStock = getCurrentStock(prodId, sourceDepot);
qtyInput.setAttribute('max', currentStock);
if (qtyLabel) qtyLabel.textContent = `Miktar (Mevcut: ${currentStock})`;
if (parseInputFloat(qtyInput.value) > currentStock) qtyInput.value = currentStock > 0 ? currentStock : 1;
} else {
qtyInput.removeAttribute('max');
if (qtyLabel) qtyLabel.textContent = 'Miktar';
}
}



function openProductOrderModal() {
if (!currentUser || currentUser.role === 'görüntüleyen') return;
tempReorderProducts = JSON.parse(JSON.stringify(products));
renderProductOrderList();
openModal('productOrderModal');
}


function closeProductOrderModal() {}



function renderProductOrderList() {
let container = document.getElementById('sortableProductList');
if (!container) return;
container.innerHTML = tempReorderProducts.map((p, origIdx) => `
<div style="display:flex; justify-content:space-between; align-items:center; background:var(--card); padding:6px 8px; border-radius:7px; border:1.5px solid var(--border); gap:6px;">
<div style="flex:1; font-size:11px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">[<b>${p.group}</b>] ${p.name}</div>
<div style="display:flex; align-items:center; gap:4px;">
<span style="font-size:9px; color:var(--muted);">Sıra:</span>
<input type="number" min="1" max="${tempReorderProducts.length}" value="${origIdx + 1}" style="width:50px; height:28px; font-size:11px; text-align:center; font-weight:800;" onchange="changeProductOrderIndex(${origIdx}, this.value)">
</div>
</div>
`).join('');
}



function changeProductOrderIndex(oldIdx, newPosVal) {
let newPos = parseInt(newPosVal, 10);
if (isNaN(newPos)) return;
newPos = newPos - 1;
if (newPos < 0) newPos = 0;
if (newPos >= tempReorderProducts.length) newPos = tempReorderProducts.length - 1;

let item = tempReorderProducts.splice(oldIdx, 1)[0];
tempReorderProducts.splice(newPos, 0, item);
renderProductOrderList();
}



function reverseProductOrder() { tempReorderProducts.reverse(); renderProductOrderList(); }


function saveReorderedProducts() { products = JSON.parse(JSON.stringify(tempReorderProducts)); saveProductsToCloud(); closeModal('productOrderModal'); closeProductOrderModal(); renderStock(); showToast("Başarılı", "Sıralama kaydedildi."); }



function openMultiProductModal() {
if (currentUser.role === 'görüntüleyen') return;
let groups = [...new Set(products.filter(p => p.active !== false).map(p => p.group))];
let gSelect = document.getElementById('multiProdGroupSelect');
if (gSelect) {
gSelect.innerHTML = '<option value="">Kategori Seçiniz...</option>' + groups.map(g => `<option value="${g}">${g}</option>`).join('') + '<option value="__NEW__">➕ Yeni Kategori Ekle...</option>';
}
let gWrap = document.getElementById('multiNewGroupWrapper');
if (gWrap) gWrap.style.display = 'none';
let dynRows = document.getElementById('multiProductsDynamicRows');
if (dynRows) dynRows.innerHTML = '';
addDynamicProductInputRow();
openModal('multiProductModal');
}


function closeMultiProductModal() {}



function checkMultiGroupSelection(el) { 
let w = document.getElementById('multiNewGroupWrapper');
if (w) {
if (el.value === '__NEW__') {
w.style.display = 'block';
setTimeout(() => { let newCatInput = document.getElementById('multiNewGroupInput'); if (newCatInput) { newCatInput.focus(); newCatInput.select(); } }, 100);
} else {
w.style.display = 'none';
let newCatInput = document.getElementById('multiNewGroupInput');
if (newCatInput) newCatInput.value = '';
}
}
}



function addDynamicProductInputRow() {
let container = document.getElementById('multiProductsDynamicRows');
if (!container) return;
let rowId = 'dyn_row_' + Date.now();
let div = document.createElement('div');
div.id = rowId;
div.className = 'dyn-product-card';

let depotsCheckboxesHtml = depots.map(d => `
<div style="display:flex; flex-direction:column; gap:3px; background:var(--card); padding:5px; border-radius:6px; border:1.5px solid var(--border);">
<label style="display:flex; align-items:center; gap:4px; font-size:10px; font-weight:800; color:var(--primary); cursor:pointer;">
<input type="checkbox" class="dyn-depot-chk" data-depot="${d}" onchange="toggleDynDepotFields('${rowId}', '${d}', this.checked)" style="width:12px; height:12px; accent-color:var(--primary);">
<span>📍 ${d}</span>
</label>
<div id="${rowId}_depot_${d}_fields" style="display:none; flex-direction:column; gap:3px; margin-top:2px;">
<div style="display:flex; gap:3px; align-items:center;">
<span style="font-size:8px; color:var(--muted); width:32px;">Açılış:</span>
<input type="number" class="dyn-prod-opening" data-depot="${d}" value="1" step="any" style="height:24px; font-size:10px; text-align:center; flex:1;">
</div>
<div style="display:flex; gap:3px; align-items:center;">
<span style="font-size:8px; color:var(--danger); width:32px;">Kritik:</span>
<input type="number" class="dyn-prod-critical" data-depot="${d}" value="0" step="any" style="height:24px; font-size:10px; text-align:center; flex:1;">
</div>
</div>
</div>
`).join('');

div.style.cssText = "background:var(--card); padding:8px; border-radius:8px; border:1.5px solid var(--border); display:flex; flex-direction:column; gap:6px;";
div.innerHTML = `
<div style="display:flex; gap:5px; align-items:center;">
<input type="text" class="dyn-prod-name" placeholder="Ürün adı..." style="flex:1; height:32px; font-size:11px; font-weight:bold;" oninput="this.value=sanitizeText(this.value)">
<button type="button" class="btn btn-danger btn-sm" style="height:32px; padding:0 8px; font-size:10px;" onclick="document.getElementById('${rowId}').remove()" title="Kaldır">🗑️</button>
</div>
<div style="font-size:9px; font-weight:800; color:var(--muted);">Hangi depolarda olsun?:</div>
<div style="display:grid; grid-template-columns: repeat(${depots.length > 2 ? 2 : depots.length}, 1fr); gap:4px;">
${depotsCheckboxesHtml}
</div>
`;
container.appendChild(div);

setTimeout(() => {
let nameInp = div.querySelector('.dyn-prod-name');
if (nameInp) nameInp.focus();
container.scrollTop = container.scrollHeight;
}, 50);
}



function toggleDynDepotFields(rowId, depotName, isChecked) {
let fieldsEl = document.getElementById(`${rowId}_depot_${depotName}_fields`);
if (!fieldsEl) return;
fieldsEl.style.display = isChecked ? 'flex' : 'none';
}



async function saveMultipleNewProductsWithQuantities() {
if (currentUser.role === 'görüntüleyen') return;
let gSelEl = document.getElementById('multiProdGroupSelect');
let gNewEl = document.getElementById('multiNewGroupInput');
let gSel = gSelEl ? gSelEl.value : '';
let group = sanitizeText((gSel === '__NEW__' && gNewEl) ? gNewEl.value.trim().toUpperCase() : gSel);
if (!group) { showToast("Eksik", "Kategori seçin veya girin.", true); return; }

let added = 0;
document.querySelectorAll('#multiProductsDynamicRows > div').forEach(row => {
let nameInput = row.querySelector('.dyn-prod-name');
let name = sanitizeText(nameInput ? nameInput.value.trim() : '');
if (name) {
let openingsObj = {}, criticalsObj = {}, allowedDepotsList = [];
row.querySelectorAll('.dyn-depot-chk').forEach(chk => {
let dName = chk.getAttribute('data-depot');
if (chk.checked) {
allowedDepotsList.push(dName);
let openInp = row.querySelector(`.dyn-prod-opening[data-depot="${dName}"]`);
let critInp = row.querySelector(`.dyn-prod-critical[data-depot="${dName}"]`);
openingsObj[dName] = openInp ? parseInputFloat(openInp.value) : 0;
criticalsObj[dName] = critInp ? parseInputFloat(critInp.value) : 0;
} else {
openingsObj[dName] = 0;
criticalsObj[dName] = 0;
}
});

if (allowedDepotsList.length > 0) {
products.push({ 
id: 'p_' + Date.now() + '_' + Math.floor(Math.random()*1000), 
group: group, 
name: name, 
openings: openingsObj, 
criticals: criticalsObj, 
allowedDepots: allowedDepotsList, 
active: true 
});
added++;
}
}
});

if (added === 0) { showToast("Uyarı", "En az bir ürün adı ve depo seçimi yapın.", true); return; }
await saveProductsToCloud();
closeModal('multiProductModal');
closeMultiProductModal();
renderStock();
showToast("Başarılı", `${added} ürün eklendi.`);
}



function findProductByName(isim) {
    if (!isim) return null;
    return products.find(p => p.name && (turkishNormalize(p.name).includes(turkishNormalize(isim)) || turkishNormalize(isim).includes(turkishNormalize(p.name))));
}



function freshCategoryOptions() {
    let groups = [...new Set(products.map(p => p.group))].sort();
    return `<option value="">Kategori Seçiniz...</option>` + groups.map(g => `<option value="${g}">${g}</option>`).join('') + `<option value="__NEW__">➕ Yeni Kategori...</option>`;
}
