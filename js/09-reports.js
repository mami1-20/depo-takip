// ============================================================
// REPORTS - Rapor ekrani, filtreleme, disa aktarma, sekmeler
// ============================================================



function openExportModal(format) {
if (!isLogged) return;
currentExportFormat = format;
let titleEl = document.getElementById('exportModalTitle');
if (titleEl) titleEl.textContent = format === 'xlsx' ? '📥 Excel Raporu Depo Seçimi' : '📥 PDF Raporu Depo Seçimi';

let listContainer = document.getElementById('exportDepotsCheckboxList');
if (listContainer) {
listContainer.innerHTML = depots.map(d => `
<label style="display:flex; align-items:center; gap:6px; font-size:11px; font-weight:700; cursor:pointer; background:var(--card); padding:6px 8px; border-radius:6px; border:1px solid var(--border);">
<input type="checkbox" class="export-depot-chk" value="${d}" checked style="width:14px; height:14px; accent-color:var(--primary);">
<span>📍 ${d}</span>
</label>
`).join('');
}
openModal('exportDepotModal');
}



function toggleAllExportDepots(status) {
document.querySelectorAll('.export-depot-chk').forEach(chk => chk.checked = status);
}



function executeMultiDepotExport() {
let selectedDepots = [];
document.querySelectorAll('.export-depot-chk:checked').forEach(chk => selectedDepots.push(chk.value));
if (selectedDepots.length === 0) { showToast("Seçim Yok", "En az bir depo seçmelisiniz.", true); return; }
closeModal('exportDepotModal');

let activeProds = products.filter(p => p.active !== false);
if (activeProds.length === 0) { showToast("Bilgi", "Ürün yok.", true); return; }

if (currentExportFormat === 'xlsx') {
let header = ["Kategori", "Ürün Adı", ...selectedDepots, "Toplam Stok"];
let rowsData = [header];

let lastGroup = null;
activeProds.forEach(p => {
if (lastGroup !== null && lastGroup !== p.group) {
rowsData.push([`--- ${p.group} ---`, ...Array(selectedDepots.length + 1).fill("")]);
} else if (lastGroup === null) {
rowsData.push([`--- ${p.group} ---`, ...Array(selectedDepots.length + 1).fill("")]);
}
lastGroup = p.group;

let row = ['', p.name];
let rowTotal = 0;
selectedDepots.forEach(d => {
let stock = (p.allowedDepots && !p.allowedDepots.includes(d)) ? 0 : getCurrentStock(p.id, d);
row.push(stock);
rowTotal = roundNum(rowTotal + stock);
});
row.push(rowTotal);
rowsData.push(row);
});

let ws = {};
let range = { s: { c: 0, r: 0 }, e: { c: header.length - 1, r: rowsData.length - 1 } };

rowsData.forEach((row, rIdx) => {
let isHeader = (rIdx === 0);
let isCategory = (row[0] && String(row[0]).startsWith('---'));

row.forEach((cellVal, cIdx) => {
let cellRef = XLSX.utils.encode_cell({ r: rIdx, c: cIdx });
let cell = { v: cellVal, t: typeof cellVal === 'number' ? 'n' : 's' };

if (isHeader) {
cell.s = {
font: { bold: true, color: { rgb: "FFFFFF" } },
fill: { fgColor: { rgb: "2563EB" } },
alignment: { horizontal: "center", vertical: "center" }
};
} else if (isCategory) {
cell.s = {
font: { bold: true, color: { rgb: "1E3A8A" } },
fill: { fgColor: { rgb: "E0E7FF" } },
alignment: { horizontal: "left", vertical: "center" }
};
} else {
cell.s = {
font: { color: { rgb: "0F172A" } },
alignment: { horizontal: cIdx >= 2 ? "right" : "left", vertical: "center" }
};
}
ws[cellRef] = cell;
});
});

ws['!ref'] = XLSX.utils.encode_range(range);

let colWidths = [];
rowsData.forEach(row => {
row.forEach((cellVal, colIdx) => {
let len = cellVal ? String(cellVal).length : 10;
if (!colWidths[colIdx] || len > colWidths[colIdx]) {
colWidths[colIdx] = len;
}
});
});
ws['!cols'] = colWidths.map(w => ({ wch: Math.min(Math.max(w + 3, 10), 24) }));

let wb = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(wb, ws, "Coklu_Depo_Stok");
let trNow = getTurkeyDateNow();
XLSX.writeFile(wb, `Stok_Raporu_${trNow.day}.${trNow.month}.${trNow.year}.xlsx`);
showToast("Başarılı", "Çoklu depo Excel raporu indirildi.");
} else {
const { jsPDF } = window.jspdf;
let doc = new jsPDF('portrait', 'mm', 'a4');
let trNow = getTurkeyDateNow();

let firstDepot = selectedDepots[0] || '';
let otherDepots = selectedDepots.slice(1);
let depotTitleStr = firstDepot + (otherDepots.length > 0 ? ' - ' + otherDepots.join(' - ') : '');

doc.setFont("helvetica", "bold"); doc.setFontSize(12);
doc.text(cleanTurkishChars(`${currentCompany || 'DEPO'} ${depotTitleStr} STOK RAPORU`), 14, 12);
doc.setFontSize(8); doc.setFont("helvetica", "normal");
doc.text(`Tarih: ${trNow.shortDate} ${trNow.timeStr}`, 14, 17);

let headRow = ['Kategori', 'Urun Adi', ...selectedDepots.map(d => cleanTurkishChars(d)), 'Toplam'];
let tableData = [];

let lastGroup = null;
activeProds.forEach(p => {
if (lastGroup !== null && lastGroup !== p.group) {
tableData.push([`--- ${cleanTurkishChars(p.group)} ---`, ...Array(selectedDepots.length + 1).fill('')]);
} else if (lastGroup === null) {
tableData.push([`--- ${cleanTurkishChars(p.group)} ---`, ...Array(selectedDepots.length + 1).fill('')]);
}
lastGroup = p.group;

let row = ['', cleanTurkishChars(p.name)];
let rowTotal = 0;
selectedDepots.forEach(d => {
let stock = (p.allowedDepots && !p.allowedDepots.includes(d)) ? 0 : getCurrentStock(p.id, d);
row.push(stock);
rowTotal = roundNum(rowTotal + stock);
});
row.push(rowTotal);
tableData.push(row);
});

doc.autoTable({
startY: 20,
head: [headRow],
body: tableData,
theme: 'grid',
headStyles: { fillColor: [37, 99, 235], fontSize: 8, cellPadding: 2, fontStyle: 'bold' },
styles: { fontSize: 8, cellPadding: 2, overflow: 'linebreak' },
didParseCell: function (data) {
let rowVal = data.row.raw[0];
if (rowVal && String(rowVal).startsWith('---')) {
data.cell.colSpan = headRow.length;
data.cell.styles.fillColor = [224, 231, 255];
data.cell.styles.textColor = [30, 58, 138];
data.cell.styles.fontStyle = 'bold';
data.cell.styles.halign = 'left';
}
},
columnStyles: {
0: { cellWidth: 45 },
1: { cellWidth: 'auto' }
},
margin: { left: 14, right: 14, top: 20, bottom: 10 }
});

doc.save(`Stok_Raporu_${trNow.day}.${trNow.month}.${trNow.year}.pdf`);
showToast("Başarılı", "PDF raporu indirildi.");
}
}



function exportCriticalXlsx() {
if (!isLogged) return;
let criticalItems = [];
products.forEach(p => {
if (p.active === false) return;
if (p.allowedDepots && !p.allowedDepots.includes(currentViewDepot)) return;
let stock = getCurrentStock(p.id, currentViewDepot);
let limit = getProductCriticalLimit(p, currentViewDepot);
if (limit > 0 && stock <= limit) criticalItems.push({ group: p.group, name: p.name, stock: stock });
});

if (criticalItems.length === 0) { showToast("Bilgi", "Kritik ürün yok."); return; }

let header = ["Kategori", "Ürün Adı", `Mevcut Stok (${currentViewDepot})`];
let rowsData = [header];

let lastGroup = null;
criticalItems.forEach(c => {
if (lastGroup !== null && lastGroup !== c.group) {
rowsData.push([`--- ${c.group} ---`, "", ""]);
} else if (lastGroup === null) {
rowsData.push([`--- ${c.group} ---`, "", ""]);
}
lastGroup = c.group;

rowsData.push(["", c.name, c.stock]);
});

let ws = {};
let range = { s: { c: 0, r: 0 }, e: { c: header.length - 1, r: rowsData.length - 1 } };

rowsData.forEach((row, rIdx) => {
let isHeader = (rIdx === 0);
let isCategory = (row[0] && String(row[0]).startsWith('---'));

row.forEach((cellVal, cIdx) => {
let cellRef = XLSX.utils.encode_cell({ r: rIdx, c: cIdx });
let cell = { v: cellVal, t: typeof cellVal === 'number' ? 'n' : 's' };

if (isHeader) {
cell.s = {
font: { bold: true, color: { rgb: "FFFFFF" } },
fill: { fgColor: { rgb: "EF4444" } },
alignment: { horizontal: "center", vertical: "center" }
};
} else if (isCategory) {
cell.s = {
font: { bold: true, color: { rgb: "1E3A8A" } },
fill: { fgColor: { rgb: "FEE2E2" } },
alignment: { horizontal: "left", vertical: "center" }
};
} else {
cell.s = {
font: { color: { rgb: "0F172A" } },
alignment: { horizontal: cIdx === 2 ? "right" : "left", vertical: "center" }
};
}
ws[cellRef] = cell;
});
});

ws['!ref'] = XLSX.utils.encode_range(range);

let colWidths = [];
rowsData.forEach(row => {
row.forEach((cellVal, colIdx) => {
let len = cellVal ? String(cellVal).length : 10;
if (!colWidths[colIdx] || len > colWidths[colIdx]) {
colWidths[colIdx] = len;
}
});
});
ws['!cols'] = colWidths.map(w => ({ wch: Math.min(Math.max(w + 3, 10), 24) }));

let wb = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(wb, ws, "Kritik_Stoklar");
let trNow = getTurkeyDateNow();
XLSX.writeFile(wb, `Kritik_Stoklar_${currentViewDepot}_${trNow.day}.${trNow.month}.${trNow.year}.xlsx`);
showToast("Başarılı", "Kritik Excel indirildi.");
}



function openCustomPicker(inputId) {
activeCalendarInputId = inputId;
let currentVal = document.getElementById(inputId).value;
let d = currentVal ? new Date(currentVal) : new Date();
if (isNaN(d.getTime())) d = new Date();
currentCalYear = d.getFullYear(); currentCalMonth = d.getMonth();
renderCustomCalendar();
}


function closeCustomCalendar() { activeCalendarInputId = null; }



function changeCalMonth(direction) {
currentCalMonth += direction;
if (currentCalMonth > 11) { currentCalMonth = 0; currentCalYear++; }
else if (currentCalMonth < 0) { currentCalMonth = 11; currentCalYear--; }
renderCustomCalendar();
}



function renderCustomCalendar() {
const monthNames = ["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran", "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"];
let labelEl = document.getElementById('calMonthYearLabel');
if (labelEl) labelEl.textContent = `${monthNames[currentCalMonth]} ${currentCalYear}`;
let grid = document.getElementById('calDaysGrid');
if (!grid) return;
grid.innerHTML = '';
let firstDayIndex = new Date(currentCalYear, currentCalMonth, 1).getDay();
let startDay = (firstDayIndex === 0) ? 6 : firstDayIndex - 1;
let totalDays = new Date(currentCalYear, currentCalMonth + 1, 0).getDate();
for (let i = 0; i < startDay; i++) grid.appendChild(document.createElement('div'));

let trNow = getTurkeyDateNow();
let todayStr = trNow.isoDate;
let targetInputVal = activeCalendarInputId ? document.getElementById(activeCalendarInputId).value : '';

for (let day = 1; day <= totalDays; day++) {
let mStr = String(currentCalMonth + 1).padStart(2, '0');
let dStr = String(day).padStart(2, '0');
let dateFormatted = `${currentCalYear}-${mStr}-${dStr}`;
let cell = document.createElement('div');
cell.textContent = day;
cell.style.cssText = "padding: 6px 0; font-size: 11px; font-weight: 700; border-radius: 6px; cursor: pointer; transition: background 0.1s, color 0.1s;";
let isFuture = dateFormatted > todayStr;
if (isFuture) { cell.style.color = "var(--muted)"; cell.style.cursor = "not-allowed"; cell.style.opacity = "0.3"; }
else if (dateFormatted === targetInputVal) { cell.style.background = "var(--primary)"; cell.style.color = "#fff"; }
else if (dateFormatted === todayStr) { cell.style.border = "1.5px solid var(--primary)"; cell.style.color = "var(--primary)"; cell.style.background = "var(--bg)"; }
else { cell.style.background = "var(--bg)"; cell.style.color = "var(--text)"; }
if (!isFuture) {
cell.onmouseover = () => { if (dateFormatted !== targetInputVal) cell.style.background = "var(--border)"; };
cell.onmouseout = () => { if (dateFormatted !== targetInputVal) cell.style.background = 'var(--bg)'; };
cell.onclick = () => selectCustomDate(dateFormatted);
}
grid.appendChild(cell);
}
}



function selectCustomDate(dateStr) {
if (!activeCalendarInputId) return;
let trNow = getTurkeyDateNow();
if (dateStr > trNow.isoDate) { showToast("Geçersiz", "Gelecek tarih seçilemez.", true); return; }

if (activeCalendarInputId === 'endDate') {
let startVal = document.getElementById('startDate').value;
if (startVal && dateStr < startVal) {
showToast("Geçersiz", "Bitiş tarihi başlangıçtan küçük olamaz.", true);
return;
}
} else if (activeCalendarInputId === 'startDate') {
let endVal = document.getElementById('endDate').value;
if (endVal && dateStr > endVal) {
showToast("Geçersiz", "Başlangıç tarihi bitişten büyük olamaz.", true);
return;
}
}
// AI modal tarihleri için sadece gelecek tarih engeli yeterli (yukarıda zaten kontrol ediliyor)

let inp = document.getElementById(activeCalendarInputId);
if (inp) inp.value = dateStr;
let p = dateStr.split('-');
let displayEl = document.getElementById(activeCalendarInputId === 'txDateInput' ? 'txDateText' : (activeCalendarInputId === 'startDate' ? 'startDateText' : (activeCalendarInputId === 'endDate' ? 'endDateText' : (activeCalendarInputId === 'aiCameraDateInput' ? 'aiCameraDateText' : (activeCalendarInputId === 'aiInvoiceDateInput' ? 'aiInvoiceDateText' : (activeCalendarInputId === 'aiTransferDateInput' ? 'aiTransferDateText' : (activeCalendarInputId === 'aiMainDateInput' ? 'aiMainDateText' : 'endDateText')))))));
if (displayEl) { displayEl.textContent = `${p[2]}.${p[1]}.${p[0]}`; displayEl.style.color = "var(--text)"; }
closeModal('customCalendarModal');
closeCustomCalendar();
}



function selectCustomDateForInit(inputId, dateStr) {
let inputEl = document.getElementById(inputId);
if(inputEl) inputEl.value = dateStr;
let displayEl = document.getElementById(inputId === 'txDateInput' ? 'txDateText' : (inputId === 'startDate' ? 'startDateText' : 'endDateText'));
if (displayEl) { let p = dateStr.split('-'); displayEl.textContent = `${p[2]}.${p[1]}.${p[0]}`; displayEl.style.color = "var(--text)"; }
}



function initDefaultReportDates() {
let trNow = getTurkeyDateNow();
selectCustomDateForInit('startDate', `${trNow.year}-${trNow.month}-01`);
selectCustomDateForInit('endDate', trNow.isoDate);
}



function setQuickDate(type) {
let trNow = getTurkeyDateNow();
if (type === 'thisMonth') { selectCustomDateForInit('startDate', `${trNow.year}-${trNow.month}-01`); selectCustomDateForInit('endDate', trNow.isoDate); }
else { selectCustomDateForInit('startDate', '2023-01-01'); selectCustomDateForInit('endDate', trNow.isoDate); }
filterReport(true);
}



function openReportSheet() {
  if (!isLogged) return;
  try { switchPage('rapor'); } catch(e) {}
  filterReport(false);
}



function closeReportSheet() { closeCustomCalendar(); }



function reportSwitchTab(tab) {
  reportActiveTab = tab;
  document.querySelectorAll('.report-tab').forEach(function (b) { b.classList.toggle('active', b.getAttribute('data-tab') === tab); });
  let consumed = document.getElementById('reportConsumedPanel');
  let listEl = document.getElementById('reportList');
  if (tab === 'consumed') {
    if (listEl) listEl.style.display = 'none';
    if (consumed) consumed.style.display = 'block';
    reportRenderConsumedSheet();
  } else {
    if (listEl) listEl.style.display = 'flex';
    if (consumed) consumed.style.display = 'none';
    let f = document.getElementById('reportTypeFilter');
    if (f) { f.value = (tab === 'in' ? 'GİRİŞ' : tab === 'out' ? 'ÇIKIŞ' : tab === 'transfer' ? 'TRANSFER' : ''); }
    filterReport(false);
    reportRenderFilteredList();
  }
}



function reportApplyProductFilter() {
  let inp = document.getElementById('reportProductSearch');
  reportProductQuery = inp ? inp.value.trim().toLowerCase() : '';
  reportRenderFilteredList();
}



function reportRenderFilteredList() {
  let listEl = document.getElementById('reportList');
  if (!listEl) return;
  let isAdmin = currentUser && currentUser.role === 'admin';
  let data = reportFilteredAll || [];
  if (reportProductQuery) {
    data = data.filter(function (item) { let nm = (item.t.prodName || item.t.name || '').toLowerCase(); return nm.indexOf(reportProductQuery) !== -1; });
  }
  let cnt = document.getElementById('reportListCount');
  if (cnt) cnt.textContent = data.length + ' işlem';
  if (currentUser && currentUser.role === 'görüntüleyen') {
    listEl.innerHTML = '<div style="font-size:11px; color:var(--muted); text-align:center; padding:8px;">Yetkiniz yok.</div>';
    return;
  }
  if (data.length === 0) { listEl.innerHTML = '<div style="font-size:11px; color:var(--muted); text-align:center; padding:14px;">İşlem yok.</div>'; return; }
  listEl.innerHTML = data.map(function (item) {
    let isIn = (item.t.type === 'GİRİŞ' || item.t.type === 'GIRIS');
    let isTr = (item.t.type === 'TRANSFER');
    let typeColor = isIn ? 'var(--success)' : (isTr ? 'var(--transfer)' : 'var(--danger)');
    let typeIcon = isIn ? '➕' : (isTr ? '⇄' : '➖');
    let typeBg = isIn ? 'rgba(16,185,129,0.12)' : (isTr ? 'rgba(139,92,246,0.12)' : 'rgba(239,68,68,0.12)');
    return '<div style="display:flex; align-items:center; gap:8px; padding:8px 10px; border:1.5px solid var(--border); border-radius:9px; background:var(--card);">' +
      (isAdmin ? '<input type="checkbox" class="report-tx-chk" data-index="' + item.idx + '" onchange="reportUpdateSelectedCount()" style="width:15px; height:15px; accent-color:var(--primary); flex-shrink:0;">' : '') +
      '<div style="width:26px; height:26px; border-radius:7px; background:' + typeBg + '; color:' + typeColor + '; display:flex; align-items:center; justify-content:center; font-size:12px; flex-shrink:0;">' + typeIcon + '</div>' +
      '<div style="flex:1; overflow:hidden;"><div style="display:flex; align-items:center; gap:5px; flex-wrap:wrap;">' +
        '<b style="font-size:11.5px; color:var(--text);">' + (item.t.prodName || item.t.name || 'Ürün') + '</b>' +
        '<span style="font-size:8px; color:var(--primary); background:rgba(37,99,235,0.1); padding:1px 5px; border-radius:4px;">' + item.t.depot + '</span>' +
        (item.t.targetDepot ? '<span style="font-size:8px; color:var(--transfer); background:rgba(139,92,246,0.1); padding:1px 5px; border-radius:4px;">➔ ' + item.t.targetDepot + '</span>' : '') +
      '</div><div style="font-size:9px; color:var(--muted); margin-top:3px;">' + item.t.date + (item.t.desc ? ' • ' + item.t.desc : '') + '</div></div>' +
      '<div style="text-align:right; flex-shrink:0;"><div style="font-size:14px; font-weight:800; color:' + typeColor + ';">' + (isIn ? '+' : (isTr ? '' : '-')) + item.t.qty + '</div>' +
      (isAdmin ? '<button class="btn btn-danger btn-sm" style="height:24px; width:24px; padding:0; font-size:10px; margin-top:3px;" onclick="reportDeleteSingle(' + item.idx + ')">🗑️</button>' : '') + '</div></div>';
  }).join('');
}



function reportUpdateSelectedCount() {
  let n = document.querySelectorAll('.report-tx-chk:checked').length;
  let el = document.getElementById('reportSelectedCount');
  if (el) el.textContent = n + ' seçili';
}



function reportDeleteSingle(idx) {
  if (!currentUser || currentUser.role !== 'admin') { showToast('Yetki Yok', 'Bu işlem için admin yetkisi gerekli.', true); return; }
  showCustomConfirm('Bu işlemi silmek istediğinize emin misiniz?', async function () {
    transactions.splice(idx, 1);
    await saveTransactionsToCloud();
    renderStock(); filterReport(false); reportRenderFilteredList();
    showToast('Silindi', 'İşlem kaldırıldı.');
  });
}



function reportRenderConsumedSheet() {
  let el = document.getElementById('topConsumedListSheet');
  if (!el) return;
  let consumptionMap = {};
  (reportFilteredAll || []).forEach(function (item) {
    if (item.t.type === 'ÇIKIŞ' || item.t.type === 'CIKIS') {
      let name = item.t.prodName || item.t.name || 'Ürün';
      consumptionMap[name] = roundNum((consumptionMap[name] || 0) + parseInputFloat(item.t.qty));
    }
  });
  let sorted = Object.entries(consumptionMap).sort(function (a, b) { return b[1] - a[1]; });
  if (sorted.length === 0) { el.innerHTML = '<span style="color:var(--muted);">Tüketilen ürün yok.</span>'; return; }
  let max = sorted[0][1] || 1;
  el.innerHTML = sorted.map(function (row, i) {
    let pct = Math.round((row[1] / max) * 100);
    return '<div style="background:var(--bg); padding:6px 8px; border-radius:7px;"><div style="display:flex; justify-content:space-between; align-items:center;">' +
      '<span style="font-size:11px;">' + (i + 1) + '. <b>' + row[0] + '</b></span>' +
      '<span style="color:var(--danger); font-weight:800; font-size:11px;">' + row[1] + ' Çıkış</span></div>' +
      '<div style="height:4px; background:var(--border); border-radius:3px; margin-top:4px; overflow:hidden;"><div style="height:100%; width:' + pct + '%; background:var(--danger);"></div></div></div>';
  }).join('');
}



function reportRenderPreviewList() {
  let el = document.getElementById('reportListPreview');
  if (!el) return;
  let cnt = document.getElementById('reportListCount');
  let data = (reportFilteredAll || []).slice(0, 40);
  if (cnt) cnt.textContent = (reportFilteredAll || []).length + ' işlem';
  el.innerHTML = data.length === 0 ? '<div style="font-size:11px; color:var(--muted); text-align:center; padding:10px;">Sonuç yok. Raporu getirin.</div>' : data.map(function (item) {
    let isIn = (item.t.type === 'GİRİŞ' || item.t.type === 'GIRIS');
    let isTr = (item.t.type === 'TRANSFER');
    let col = isIn ? 'var(--success)' : (isTr ? 'var(--transfer)' : 'var(--danger)');
    return '<div style="display:flex; justify-content:space-between; align-items:center; gap:8px; padding:6px 9px; border:1.5px solid var(--border); border-radius:8px; background:var(--card);"><div style="overflow:hidden;"><b style="font-size:11px;">' + (item.t.prodName || item.t.name || 'Ürün') + '</b><div style="font-size:9px; color:var(--muted); margin-top:2px;">' + item.t.date + ' • ' + item.t.depot + '</div></div><div style="font-size:12px; font-weight:800; color:' + col + '; flex-shrink:0;">' + (isIn ? '+' : (isTr ? '' : '-')) + item.t.qty + '</div></div>';
  }).join('');
}



function reportExportFiltered() {
  let data = reportFilteredAll || [];
  if (reportProductQuery) data = data.filter(function (item) { let nm = (item.t.prodName || item.t.name || '').toLowerCase(); return nm.indexOf(reportProductQuery) !== -1; });
  if (data.length === 0) { showToast('Bilgi', 'Aktarılacak veri yok.'); return; }
  let rows = [['Tarih', 'Depo', 'Ürün', 'Tür', 'Miktar', 'Açıklama']];
  data.forEach(function (item) { rows.push([item.t.date, item.t.depot, (item.t.prodName || item.t.name || ''), item.t.type, item.t.qty, item.t.desc || '']); });
  let ws = XLSX.utils.aoa_to_sheet(rows);
  let wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Rapor');
  XLSX.writeFile(wb, 'rapor_' + Date.now() + '.xlsx');
  showToast('Başarılı', data.length + ' işlem Excel olarak indirildi.');
}



function reportQuickOpen(period) {
  reportQuickDate(period);
}



function reportQuickDate(period) {
  let trNow = getTurkeyDateNow();
  try {
    if (period === 'today') { selectCustomDateForInit('startDate', trNow.isoDate); selectCustomDateForInit('endDate', trNow.isoDate); }
    else if (period === 'thisMonth') { selectCustomDateForInit('startDate', trNow.year + '-' + trNow.month + '-01'); selectCustomDateForInit('endDate', trNow.isoDate); }
    else if (period === 'lastMonth') {
      let y = trNow.year, mo = parseInt(trNow.month, 10) - 1;
      if (mo < 1) { mo = 12; y = y - 1; }
      let mm = String(mo).padStart(2, '0');
      let lastDay = new Date(y, mo, 0).getDate();
      selectCustomDateForInit('startDate', y + '-' + mm + '-01');
      selectCustomDateForInit('endDate', y + '-' + mm + '-' + String(lastDay).padStart(2, '0'));
    }
    else { selectCustomDateForInit('startDate', '2023-01-01'); selectCustomDateForInit('endDate', trNow.isoDate); }
  } catch (e) {}
  filterReport(false);
  reportRenderFilteredList();
}



function reportExportConsumedPreview(format) {
  if (format === 'pdf') { exportConsumptionPdf(); } else { exportConsumptionExcel(); }
}



function reportExportFilteredPdf() {
  let data = reportFilteredAll || [];
  if (reportProductQuery) data = data.filter(function (item) { let nm = (item.t.prodName || item.t.name || '').toLowerCase(); return nm.indexOf(reportProductQuery) !== -1; });
  if (data.length === 0) { showToast('Bilgi', 'Aktarılacak veri yok.'); return; }
  const { jsPDF } = window.jspdf;
  let doc = new jsPDF('landscape', 'mm', 'a4');
  doc.setFont('helvetica', 'bold'); doc.setFontSize(12);
  doc.text(cleanTurkishChars((currentCompany || 'DEPO') + ' - ISLEM RAPORU'), 14, 12);
  let body = data.map(function (item) { return [cleanTurkishChars(item.t.date || ''), cleanTurkishChars(item.t.depot || ''), cleanTurkishChars(item.t.prodName || item.t.name || ''), cleanTurkishChars(item.t.type || ''), String(item.t.qty), cleanTurkishChars(item.t.desc || '')]; });
  doc.autoTable({ startY: 18, head: [['Tarih', 'Depo', 'Urun', 'Tur', 'Miktar', 'Aciklama']], body: body, theme: 'grid', styles: { fontSize: 8 } });
  doc.save('rapor_' + Date.now() + '.pdf');
  showToast('Başarılı', data.length + ' işlem PDF olarak indirildi.');
}



async function filterReport(showNotif = true) {
if (!isLogged) return;
let startVal = document.getElementById('startDate').value;
let endVal = document.getElementById('endDate').value;
if (!startVal || !endVal) return;

let startDate = new Date(startVal); startDate.setHours(0,0,0,0);
let endDate = new Date(endVal); endDate.setHours(23,59,59,999);
if (startDate > endDate) { if(showNotif) showToast("Hata", "Başlangıç bitişten büyük olamaz.", true); return; }

let depotFilter = '';
let depotSel = document.getElementById('reportDepotFilter');
if (depotSel) depotFilter = depotSel.value;
let typeFilter = '';
let typeSel = document.getElementById('reportTypeFilter');
if (typeSel) typeFilter = typeSel.value;

// Depo filtre dropdown'ını doldur (ilk açılışta)
if (depotSel && depotSel.options.length <= 1 && depots && depots.length > 0) {
    depots.forEach(d => {
        let opt = document.createElement('option');
        opt.value = d; opt.textContent = d;
        depotSel.appendChild(opt);
    });
    if (depotFilter) depotSel.value = depotFilter;
}

// ---- SUNUCU TARAFLI SORGU: yalnizca secilen araligi cek ----
let cid = await getCompanyIdSafe(currentCompany);
let remote = [];
if (cid) {
  remote = await loadTransactionsForCompany(cid, {
    from: startDate.toISOString(),
    to: endDate.toISOString(),
    depot: depotFilter || undefined,
    type: typeFilter || undefined,
    limit: 5000
  });
}
// Bellekteki listeye geri yaz (diger ekranlar da kullanir)
transactions = remote;

let filteredWithIndex = remote.map((t, idx) => ({ t, idx }));

lastFilteredTransactions = filteredWithIndex;
reportFilteredAll = filteredWithIndex;
if (typeof reportRenderFilteredList === 'function') reportRenderFilteredList();
if (typeof reportApplyProductFilter === 'function' && document.getElementById('reportProductSearch')) reportApplyProductFilter();
if (typeof reportRenderPreviewList === 'function') reportRenderPreviewList();

// Özet hesapla
let totalIn = 0, totalOut = 0, totalTransfer = 0, consumptionMap = {};
filteredWithIndex.forEach(item => {
let t = item.t;
let q = parseInputFloat(t.qty);
if (t.type === 'GİRİŞ' || t.type === 'GIRIS') totalIn = roundNum(totalIn + q);
if (t.type === 'ÇIKIŞ' || t.type === 'CIKIS') {
totalOut = roundNum(totalOut + q);
let pName = t.prodName || t.name || 'Bilinmeyen Ürün';
consumptionMap[pName] = roundNum((consumptionMap[pName] || 0) + q);
}
if (t.type === 'TRANSFER') totalTransfer = roundNum(totalTransfer + q);
});

let sumInEl = document.getElementById('sumIn');
let sumOutEl = document.getElementById('sumOut');
let sumCountEl = document.getElementById('sumCount');
if (sumInEl) sumInEl.textContent = '+' + totalIn;
if (sumOutEl) sumOutEl.textContent = '-' + totalOut;
if (sumCountEl) sumCountEl.textContent = filteredWithIndex.length;

let sortedConsumed = Object.entries(consumptionMap).sort((a,b) => b[1] - a[1]);

let isAdmin = currentUser && currentUser.role === 'admin';
let bulkBar = document.getElementById('reportBulkBar');
if (bulkBar) bulkBar.style.display = (isAdmin && filteredWithIndex.length > 0) ? 'flex' : 'none';

let listCountEl = document.getElementById('reportListCount');
if (listCountEl) listCountEl.textContent = filteredWithIndex.length + ' işlem';

let repList = document.getElementById('reportList');
if (repList) {
if (currentUser && currentUser.role === 'görüntüleyen') {
repList.innerHTML = '<div style="font-size:11px; color:var(--muted); text-align:center; padding:8px;">Yetkiniz yok.</div>';
} else {
repList.innerHTML = filteredWithIndex.length === 0 ? '<div style="font-size:11px; color:var(--muted); text-align:center; padding:8px;">İşlem yok.</div>' : filteredWithIndex.map(item => {
let typeColor = (item.t.type === 'GİRİŞ' || item.t.type === 'GIRIS') ? 'var(--success)' : (item.t.type === 'TRANSFER' ? 'var(--transfer)' : 'var(--danger)');
let typeIcon = (item.t.type === 'GİRİŞ' || item.t.type === 'GIRIS') ? '➕' : (item.t.type === 'TRANSFER' ? '⇄' : '➖');
let typeBg = (item.t.type === 'GİRİŞ' || item.t.type === 'GIRIS') ? 'rgba(16,185,129,0.12)' : (item.t.type === 'TRANSFER' ? 'rgba(139,92,246,0.12)' : 'rgba(239,68,68,0.12)');
return `<div style="display:flex; align-items:center; gap:6px; padding:6px 8px; border:1.5px solid var(--border); border-radius:8px; background:var(--card);">${isAdmin ? `<input type="checkbox" class="report-tx-chk" data-index="${item.idx}" style="width:14px; height:14px; accent-color:var(--primary); flex-shrink:0;">` : ''}<div style="flex:1; overflow:hidden;"><div style="display:flex; align-items:center; gap:4px;"><b style="font-size:11px; color:var(--text);">${item.t.prodName || item.t.name || 'Ürün'}</b><span style="font-size:8px; color:var(--primary); background:rgba(37,99,235,0.1); padding:1px 4px; border-radius:3px;">${item.t.depot}</span></div><div style="font-size:9px; color:var(--muted); margin-top:2px;">${item.t.date}${item.t.desc ? ' • ' + item.t.desc : ''}</div></div><div style="display:flex; align-items:center; gap:4px; flex-shrink:0;"><span style="font-size:10px; font-weight:800; padding:3px 8px; border-radius:5px; background:${typeBg}; color:${typeColor};">${typeIcon} ${item.t.qty}</span>${isAdmin ? `<button class="btn btn-danger btn-sm" style="height:22px; width:22px; padding:0; font-size:9px;" onclick="showCustomConfirm('İşlem silinsin mi?', () => deleteTransaction(${item.idx}))">🗑️</button>` : ''}</div></div>`;
}).join('');
}
}
if (showNotif) { showToast("Başarılı", "Rapor getirildi."); }
}

function toggleReportSelectAll(checked) {
document.querySelectorAll('.report-tx-chk').forEach(chk => { chk.checked = checked; });
}



async function bulkDeleteTransactions() {
let checkboxes = document.querySelectorAll('.report-tx-chk:checked');
if (checkboxes.length === 0) { showToast("Bilgi", "Silinecek işlem seçilmedi.", true); return; }
if (!currentUser || currentUser.role !== 'admin') { showToast("Yetki Yok", "Bu işlem için admin yetkisi gerekli.", true); return; }

let indices = [];
checkboxes.forEach(chk => { let idx = parseInt(chk.getAttribute('data-index'), 10); if (!isNaN(idx)) indices.push(idx); });
// Büyükten küçüğe sırala — splice bozulmasın
indices.sort((a, b) => b - a);

for (let idx of indices) {
transactions.splice(idx, 1);
}
await saveTransactionsToCloud();
renderStock();
filterReport(false);
showToast("Silindi", indices.length + " işlem kaldırıldı.");
}



function exportConsumptionExcel() {
if (!isLogged) return;
let consumptionMap = {};
lastFilteredTransactions.forEach(item => {
if (item.t.type === 'ÇIKIŞ' || item.t.type === 'CIKIS') {
let name = item.t.prodName || item.t.name || 'Ürün';
consumptionMap[name] = roundNum((consumptionMap[name] || 0) + parseInputFloat(item.t.qty));
}
});
let sortedConsumed = Object.entries(consumptionMap).sort((a,b) => b[1] - a[1]);
if (sortedConsumed.length === 0) { showToast("Bilgi", "Veri yok."); return; }
let groupedByCat = {};
sortedConsumed.forEach(([name, qty]) => {
let prod = products.find(p => p.name.toLowerCase() === name.toLowerCase());
let cat = prod ? prod.group : "DİĞER";
if (!groupedByCat[cat]) groupedByCat[cat] = [];
groupedByCat[cat].push({ name, qty });
});
let header = ["Kategori", "Ürün Adı", "Toplam Çıkış"];
let rowsData = [header];
Object.keys(groupedByCat).sort().forEach(cat => {
rowsData.push([`--- ${cat} ---`, "", ""]);
groupedByCat[cat].forEach(item => { rowsData.push(["", item.name, item.qty]); });
});
let ws = {};
let range = { s: { c: 0, r: 0 }, e: { c: header.length - 1, r: rowsData.length - 1 } };
rowsData.forEach((row, rIdx) => {
let isHeader = (rIdx === 0);
let isCategory = (row[0] && String(row[0]).startsWith('---'));
row.forEach((cellVal, cIdx) => {
let cellRef = XLSX.utils.encode_cell({ r: rIdx, c: cIdx });
let cell = { v: cellVal, t: typeof cellVal === 'number' ? 'n' : 's' };
if (isHeader) { cell.s = { font: { bold: true, color: { rgb: "FFFFFF" } }, fill: { fgColor: { rgb: "2563EB" } }, alignment: { horizontal: "center" } }; }
else if (isCategory) { cell.s = { font: { bold: true, color: { rgb: "1E3A8A" } }, fill: { fgColor: { rgb: "E0E7FF" } }, alignment: { horizontal: "left" } }; }
ws[cellRef] = cell;
});
});
ws['!ref'] = XLSX.utils.encode_range(range);
let wb = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(wb, ws, "Tuketilenler");
let trNow = getTurkeyDateNow();
XLSX.writeFile(wb, `Tuketilenler_${trNow.day}.${trNow.month}.${trNow.year}.xlsx`);
showToast("Başarılı", "Excel indirildi.");
}



function exportConsumptionPdf() {
if (!isLogged) return;
let consumptionMap = {};
lastFilteredTransactions.forEach(item => {
if (item.t.type === 'ÇIKIŞ' || item.t.type === 'CIKIS') {
let name = item.t.prodName || item.t.name || 'Ürün';
consumptionMap[name] = roundNum((consumptionMap[name] || 0) + parseInputFloat(item.t.qty));
}
});
let sortedConsumed = Object.entries(consumptionMap).sort((a,b) => b[1] - a[1]);
if (sortedConsumed.length === 0) { showToast("Bilgi", "Veri yok."); return; }
let groupedByCat = {};
sortedConsumed.forEach(([name, qty]) => {
let prod = products.find(p => p.name.toLowerCase() === name.toLowerCase());
let cat = prod ? prod.group : "DİĞER";
if (!groupedByCat[cat]) groupedByCat[cat] = [];
groupedByCat[cat].push({ name, qty });
});
const { jsPDF } = window.jspdf;
let doc = new jsPDF('portrait', 'mm', 'a4');
let trNow = getTurkeyDateNow();
doc.setFont("helvetica", "bold"); doc.setFontSize(12);
doc.text(cleanTurkishChars(`${currentCompany || 'DEPO'} - TÜKETİLENLER`), 14, 12);
let headRow = ['Kategori', 'Urun Adi', 'Toplam Cikis'];
let tableData = [];
Object.keys(groupedByCat).sort().forEach(cat => {
tableData.push([`--- ${cleanTurkishChars(cat)} ---`, '', '']);
groupedByCat[cat].forEach(item => { tableData.push(['', cleanTurkishChars(item.name), item.qty]); });
});
doc.autoTable({
startY: 18, head: [headRow], body: tableData, theme: 'grid',
headStyles: { fillColor: [37, 99, 235], fontSize: 8, fontStyle: 'bold' },
styles: { fontSize: 8, cellPadding: 2 },
didParseCell: function (data) {
let rowVal = data.row.raw[0];
if (rowVal && String(rowVal).startsWith('---')) {
data.cell.colSpan = headRow.length;
data.cell.styles.fillColor = [224, 231, 255];
data.cell.styles.textColor = [30, 58, 138];
data.cell.styles.fontStyle = 'bold';
}
}
});
doc.save(`Tuketilenler_${trNow.day}.${trNow.month}.${trNow.year}.pdf`);
showToast("Başarılı", "PDF indirildi.");
}



async function deleteTransaction(index) {
if (!currentUser || currentUser.role !== 'admin') return;
transactions.splice(index, 1);
await saveTransactionsToCloud();
renderStock(); filterReport(false);
showToast("Silindi", "İşlem kaldırıldı.");
}
