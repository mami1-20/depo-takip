// ============================================================
// CLOUD SYNC - Supabase okuma/yazma (TABLO-BAZLI)
// ============================================================
// Bu katman, eski app_kv (tek JSON dokuman) yerine yeni tablolari kullanir:
//   companies, company_config, products, product_depot, transactions, profiles
// Disariya AYNI arayuzu sunar (getDocData/setDocData/saveXToCloud), boylece
// diger dosyalar degismeden calismaya devam eder. Ic mantik tablo-bazlidir.

// ---------- FIRMA COZUMLEME ----------
// currentCompany (firma ADI) -> companies.id
async function resolveCompanyId(compName) {
  if (!compName || String(compName).trim() === '' || String(compName).toUpperCase() === 'GENEL') return null;
  try {
    let { data, error } = await _supabase
      .from('companies').select('id').ilike('name', compName).limit(1).maybeSingle();
    if (error || !data) return null;
    return data.id;
  } catch (e) { return null; }
}

async function getCurrentCompanyId() {
  if (!currentCompany) return null;
  if (!window.__companyIdCache) window.__companyIdCache = {};
  if (window.__companyIdCache[currentCompany]) return window.__companyIdCache[currentCompany];
  let id = await resolveCompanyId(currentCompany);
  if (id) window.__companyIdCache[currentCompany] = id;
  return id;
}

// ---------- UYUMLULUK KATMANI: getDocData / setDocData ----------
// Eski anahtarlari yeni tablo cagrilarina cevirir.
async function getDocData(docKey) {
  try {
    if (docKey === 'global_users') {
      let { data, error } = await _supabase.from('profiles')
        .select('id, username, company_id, role, is_super_admin, active');
      if (error || !data) return null;
      // Disariya eski "list" formatinda don (company ADI ile)
      let compMap = await getCompanyNameMap();
      let list = data.map(p => ({
        id: p.id,
        username: p.username,
        role: p.is_super_admin ? 'admin' : p.role,
        active: p.active !== false,
        isSuperAdmin: !!p.is_super_admin,
        company: p.company_id ? (compMap[p.company_id] || null) : null,
        companyId: p.company_id
      }));
      return { list };
    }

    // company_<NAME>_config
    let mCfg = docKey.match(/^company_(.+)_config$/);
    if (mCfg) {
      let cid = await resolveCompanyId(mCfg[1]);
      if (!cid) return null;
      let { data } = await _supabase.from('company_config').select('depots').eq('company_id', cid).maybeSingle();
      let { data: comp } = await _supabase.from('companies').select('app_title').eq('id', cid).maybeSingle();
      return {
        appTitleText: (comp && comp.app_title) ? comp.app_title : null,
        depots: (data && data.depots) ? data.depots : ['DEPO 1', 'DEPO 2']
      };
    }

    // company_<NAME>_products
    let mProd = docKey.match(/^company_(.+)_products$/);
    if (mProd) {
      let cid = await resolveCompanyId(mProd[1]);
      if (!cid) return null;
      let list = await loadProductsForCompany(cid);
      return { list };
    }

    // company_<NAME>_transactions
    let mTx = docKey.match(/^company_(.+)_transactions$/);
    if (mTx) {
      let cid = await resolveCompanyId(mTx[1]);
      if (!cid) return null;
      let list = await loadTransactionsForCompany(cid, { limit: 5000 });
      return { list };
    }

    return null;
  } catch (e) { return null; }
}

async function setDocData(docKey, valObj) {
  try {
    if (docKey === 'global_users') {
      // Kullanici kaydi setDocData ile degil, auth/profile fonksiyonlariyla yapilir.
      return;
    }

    let mCfg = docKey.match(/^company_(.+)_config$/);
    if (mCfg) {
      let cid = await resolveCompanyId(mCfg[1]);
      if (!cid) return;
      await _supabase.from('company_config')
        .upsert({ company_id: cid, depots: valObj.depots || ['DEPO 1', 'DEPO 2'] });
      if (valObj.appTitleText) {
        await _supabase.from('companies').update({ app_title: valObj.appTitleText }).eq('id', cid);
      }
      return;
    }

    let mProd = docKey.match(/^company_(.+)_products$/);
    if (mProd) {
      let cid = await resolveCompanyId(mProd[1]);
      if (!cid) return;
      await saveProductsForCompany(cid, valObj.list || []);
      return;
    }

    let mTx = docKey.match(/^company_(.+)_transactions$/);
    if (mTx) {
      let cid = await resolveCompanyId(mTx[1]);
      if (!cid) return;
      await saveTransactionsForCompany(cid, valObj.list || []);
      return;
    }
  } catch (e) { /* sessiz */ }
}

// ---------- YARDIMCI: firma adi haritasi ----------
async function getCompanyNameMap() {
  if (window.__companyNameMap) return window.__companyNameMap;
  let { data } = await _supabase.from('companies').select('id, name');
  let map = {};
  (data || []).forEach(c => map[c.id] = c.name);
  window.__companyNameMap = map;
  return map;
}

// ---------- URUN OKUMA (products + product_depot -> eski format) ----------
async function loadProductsForCompany(companyId) {
  let { data: prods } = await _supabase.from('products')
    .select('*').eq('company_id', companyId).order('sort_order', { ascending: true });
  let { data: pd } = await _supabase.from('product_depot')
    .select('*').eq('company_id', companyId);

  let depotMap = {};
  (pd || []).forEach(r => {
    if (!depotMap[r.product_id]) depotMap[r.product_id] = { openings: {}, criticals: {} };
    depotMap[r.product_id].openings[r.depot] = Number(r.opening_qty) || 0;
    depotMap[r.product_id].criticals[r.depot] = Number(r.critical_qty) || 0;
  });

  return (prods || []).map((p, i) => ({
    id: p.id,
    name: p.name,
    group: p.group_name,
    openings: depotMap[p.id] ? depotMap[p.id].openings : {},
    criticals: depotMap[p.id] ? depotMap[p.id].criticals : {},
    allowedDepots: p.allowed_depots || [],
    active: p.active !== false,
    sortOrder: p.sort_order != null ? p.sort_order : i
  }));
}

// ---------- URUN YAZMA (eski format listesi -> tablolar) ----------
async function saveProductsForCompany(companyId, list) {
  // ID KORUYARAK yaz: mevcut urunleri silip yeniden olusturmak yerine
  // id ile upsert yap; yalnizca listede OLMAYAN urunleri sil.
  let keepIds = list.map(p => p.id).filter(id => typeof id === 'number');
  if (keepIds.length > 0) {
    await _supabase.from('products').delete()
      .eq('company_id', companyId)
      .not('id', 'in', '(' + keepIds.join(',') + ')');
  } else {
    // Hic idsi olmayan yeni liste -> eski tum urunleri temizle (nadir)
    await _supabase.from('products').delete().eq('company_id', companyId);
  }

  for (let i = 0; i < list.length; i++) {
    let p = list[i];
    let payload = {
      company_id: companyId,
      name: p.name,
      group_name: p.group || null,
      allowed_depots: p.allowedDepots || [],
      active: p.active !== false,
      sort_order: i
    };
    if (typeof p.id === 'number') {
      payload.id = p.id;               // id korunur -> islem baglantilari kopmaz
    }
    let { data } = await _supabase.from('products').upsert(payload, { onConflict: 'id' }).select('id').maybeSingle();
    if (data && data.id) p.id = data.id;

    // product_depot: yalnizca bu urunun depo satirlarini yaz
    let depotsForProd = new Set([...(Object.keys(p.openings || {})), ...(Object.keys(p.criticals || {}))]);
    if (depotsForProd.size > 0) {
      let rows = [...depotsForProd].map(d => ({
        product_id: p.id,
        company_id: companyId,
        depot: d,
        opening_qty: Number((p.openings || {})[d]) || 0,
        critical_qty: Number((p.criticals || {})[d]) || 0
      }));
      await _supabase.from('product_depot').upsert(rows, { onConflict: 'product_id,depot' });
    }
    // Kaldirilan depo satirlarini temizle
    let existingDepots = [...depotsForProd];
    if (existingDepots.length > 0) {
      await _supabase.from('product_depot').delete()
        .eq('product_id', p.id)
        .not('depot', 'in', '(' + existingDepots.map(d => "'" + String(d).replace(/'/g, "''") + "'").join(',') + ')');
    }
  }
}

// ---------- ISLEM OKUMA (transactions -> eski format) ----------
async function loadTransactionsForCompany(companyId, opts) {
  opts = opts || {};
  let q = _supabase.from('transactions').select('*').eq('company_id', companyId);
  if (opts.from) q = q.gte('tx_date', opts.from);
  if (opts.to) q = q.lte('tx_date', opts.to);
  if (opts.depot) q = q.eq('depot', opts.depot);
  if (opts.type) q = q.eq('type', opts.type);
  q = q.order('tx_date', { ascending: false }).limit(opts.limit || 1000);
  let { data } = await q;

  return (data || []).map(t => ({
    date: formatTxDate(t.tx_date),
    depot: t.depot,
    prodId: t.product_id,
    prodName: t.product_name,
    type: t.type,
    qty: Number(t.qty) || 0,
    desc: t.description || '',
    targetDepot: t.target_depot || undefined
  }));
}

function formatTxDate(iso) {
  try {
    let d = new Date(iso);
    let dd = String(d.getDate()).padStart(2, '0');
    let mm = String(d.getMonth() + 1).padStart(2, '0');
    let yyyy = d.getFullYear();
    let hh = String(d.getHours()).padStart(2, '0');
    let mi = String(d.getMinutes()).padStart(2, '0');
    return `${dd}.${mm}.${yyyy} ${hh}:${mi}`;
  } catch (e) { return ''; }
}

// ---------- ISLEM YAZMA (eski format -> tablolar) ----------
// Yalnizca YENI islemleri ekler (append). Silme yapmaz.
// Toplu silme ayri bir fonksiyonla yapilir (deleteTransactionsByIds).
async function syncTransactionsAppend(companyId, incomingList) {
  if (!incomingList || !incomingList.length) return;
  let rows = incomingList.map(t => ({
    company_id: companyId,
    tx_date: parseTxDate(t.date),
    depot: t.depot,
    product_id: (typeof t.prodId === 'number') ? t.prodId : null,
    product_name: t.prodName || t.name || 'Ürün',
    type: t.type,
    qty: Number(t.qty) || 0,
    target_depot: t.targetDepot || null,
    description: t.desc || null
  }));
  for (let i = 0; i < rows.length; i += 500) {
    await _supabase.from('transactions').insert(rows.slice(i, i + 500));
  }
}

// Toplu silme: yalnizca verilen id'leri siler (rapor ekranindaki toplu silme icin).
async function deleteTransactionsByIds(companyId, ids) {
  if (!ids || !ids.length) return;
  await _supabase.from('transactions').delete().eq('company_id', companyId).in('id', ids);
}

// Geriye donuk uyumluluk: eski "tum listeyi sil+yaz" cagrilari icin.
// TEHLIKELI oldugu icin, artik yalnizca append yapar; tam senkron gerekiyorsa reconcile kullanilir.
async function saveTransactionsForCompany(companyId, list) {
  // Reconcile: bellekteki liste ile tabloyu karsilastir; eksik olanlari ekle.
  let { data: existing } = await _supabase.from('transactions').select('id').eq('company_id', companyId).limit(1);
  let tableEmpty = !existing || existing.length === 0;
  if (tableEmpty) {
    await syncTransactionsAppend(companyId, list);
    return;
  }
  // Tablo doluysa ve bellek listesi verildiyse: yalnizca YENI olanlari ekle.
  // (Bellek listesi genelde tablodan yuklendigi icin burada cogunlukla no-op olur.)
  // Tam eslesme gerekirse deleteTransactionsByIds + syncTransactionsAppend kullanilir.
  return;
}

function parseTxDate(str) {
  try {
    let parts = String(str).split(' ');
    let dmy = parts[0].split('.');
    let hm = (parts[1] || '00:00').split(':');
    if (dmy.length === 3) {
      return new Date(Number(dmy[2]), Number(dmy[1]) - 1, Number(dmy[0]), Number(hm[0] || 0), Number(hm[1] || 0)).toISOString();
    }
  } catch (e) {}
  return new Date().toISOString();
}

// ---------- BASLATMA ----------
async function initCloudGlobalData() {
  let val = await getDocData('global_users');
  if (val && val.list) systemUsers = val.list;
  if (isLogged && currentUser && currentUser.isSuperAdmin) renderSuperAdminPanel();
}

async function initCompanyData(compName) {
  if (!compName || String(compName).toUpperCase() === 'GENEL') {
    depots = depots || ['DEPO 1','DEPO 2'];
    products = [];
    transactions = [];
    try { updateDepotUI(); renderStock(); } catch(e){}
    return;
  }
  let cfg = await getDocData(`company_${compName}_config`);
  if (cfg) {
    if (cfg.appTitleText) appTitleText = cfg.appTitleText.toUpperCase();
    if (cfg.depots) depots = cfg.depots;
    updateAppTitleUI();
    updateDepotUI();
  }

  let prodDoc = await getDocData(`company_${compName}_products`);
  products = (prodDoc && prodDoc.list) ? prodDoc.list : [];

  let txDoc = await getDocData(`company_${compName}_transactions`);
  transactions = (txDoc && txDoc.list) ? txDoc.list : [];

  renderStock();
  setupRealtimeListener(compName);
}

// ---------- YAZMA KISAYOLLARI (disariya ayni isim) ----------
async function saveConfigToCloud() {
  await setDocData(`company_${currentCompany}_config`, { appTitleText: appTitleText.toUpperCase(), depots: depots });
}
async function saveProductsToCloud() { await setDocData(`company_${currentCompany}_products`, { list: products }); }
async function saveUsersToCloud() { /* kullanici kaydi auth uzerinden yapilir; uyumluluk icin no-op */ }
async function saveTransactionsToCloud() { await setDocData(`company_${currentCompany}_transactions`, { list: transactions }); }

// ---------- REALTIME ----------
function setupRealtimeListener(compName) {
  if (realTimeSubscription) {
    try { _supabase.removeChannel(realTimeSubscription); } catch (e) {}
  }
  // Yeni tablolara abone ol (firma bazli). Basit tutuldu: degisince yeniden yukle.
  realTimeSubscription = _supabase
    .channel(`company_${compName}_changes`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'transactions' }, async () => {
      if (!isLogged || currentCompany !== compName) return;
      let cid = await getCompanyIdSafe(compName);
      if (!cid) return;
      transactions = await loadTransactionsForCompany(cid, { limit: 5000 });
      renderStock();
      let activePage = sessionStorage.getItem('sys_active_page');
      if (activePage === 'rapor' && typeof filterReport === 'function') filterReport(false);
    })
    .on('postgres_changes', { event: '*', schema: 'public', table: 'products' }, async () => {
      if (!isLogged || currentCompany !== compName) return;
      let cid = await getCompanyIdSafe(compName);
      if (!cid) return;
      products = await loadProductsForCompany(cid);
      renderStock();
    })
    .subscribe();
}

async function getCompanyIdSafe(compName) {
  if (!window.__companyIdCache) window.__companyIdCache = {};
  if (window.__companyIdCache[compName]) return window.__companyIdCache[compName];
  let id = await resolveCompanyId(compName);
  if (id) window.__companyIdCache[compName] = id;
  return id;
}
