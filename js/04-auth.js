// ============================================================
// AUTH - Giris, kayit, sifre sifirlama, oturum  (GERCEK SUPABASE AUTH)
// ============================================================
// Degisiklik: düz metin sifre karsilastirmasi (pin === pinInput) KALDIRILDI.
// Artik giris Supabase Auth ile e-posta + sifre uzerinden yapilir.
// Kullanici adi profillerden bulunur; sifre asla uygulamada tutulmaz.

function showRegisterScreen() {
  let l = document.getElementById('loginBoxCard'); if (l) l.style.display = 'none';
  let f = document.getElementById('forgotBoxCard'); if (f) f.style.display = 'none';
  let r = document.getElementById('registerBoxCard'); if (r) r.style.display = 'block';
}

function showLoginScreen() {
  let r = document.getElementById('registerBoxCard'); if (r) r.style.display = 'none';
  let f = document.getElementById('forgotBoxCard'); if (f) f.style.display = 'none';
  let l = document.getElementById('loginBoxCard'); if (l) l.style.display = 'block';
}

function showForgotScreen() {
  let l = document.getElementById('loginBoxCard'); if (l) l.style.display = 'none';
  let r = document.getElementById('registerBoxCard'); if (r) r.style.display = 'none';
  let f = document.getElementById('forgotBoxCard'); if (f) f.style.display = 'block';
}

// ---------- GIRIS (e-posta + sifre -> Supabase Auth) ----------
async function verifyLogin() {
  let uInp = document.getElementById('userInput');
  let pInp = document.getElementById('pinInput');
  if (!uInp || !pInp) return;
  // userInput alani artik E-POSTA kabul eder (label guncellenecek)
  let emailInput = uInp.value.trim().toLowerCase();
  let passInput = pInp.value.trim();

  if (!emailInput || !passInput) {
    showToast("Eksik", "Lütfen e-posta ve şifrenizi girin.", true);
    return;
  }

  try {
    const { data, error } = await _supabase.auth.signInWithPassword({
      email: emailInput,
      password: passInput
    });
    if (error) {
      showToast("Hata", "E-posta veya şifre yanlış.", true);
      return;
    }
    if (!data || !data.user) {
      showToast("Hata", "Giriş doğrulanamadı.", true);
      return;
    }
    await loadProfileAndEnter(data.user);
  } catch (e) {
    showToast("Hata", "Giriş sırasında bir problem oluştu.", true);
  }
}

// ---------- PROFIL YUKLE + GIRIS YAP ----------
async function loadProfileAndEnter(authUser) {
  let { data: prof, error } = await _supabase.from('profiles')
    .select('id, username, company_id, role, is_super_admin, active')
    .eq('id', authUser.id).single();

  if (error || !prof) {
    showToast("Hata", "Kullanıcı profili bulunamadı.", true);
    await _supabase.auth.signOut();
    return;
  }
  if (prof.active === false) {
    showToast("Pasif", "Hesap devre dışı bırakılmış.", true);
    await _supabase.auth.signOut();
    return;
  }

  // Firma adini coz
  let compName = 'GENEL';
  if (prof.company_id) {
    let { data: comp } = await _supabase.from('companies').select('name').eq('id', prof.company_id).single();
    if (comp && comp.name) compName = comp.name;
  }

  let foundUser = {
    id: prof.id,
    email: authUser.email,
    username: prof.username,
    role: prof.is_super_admin ? 'admin' : prof.role,
    isSuperAdmin: !!prof.is_super_admin,
    active: prof.active !== false,
    company: compName,
    companyId: prof.company_id || null
  };

  await proceedLogin(foundUser);
}

// ---------- OTURUM ----------
function saveCurrentUser() {
  try {
    // Sifre/link saklanmaz; yalnizca gorunum bilgisi.
    let safe = currentUser ? {
      id: currentUser.id, username: currentUser.username, role: currentUser.role,
      isSuperAdmin: currentUser.isSuperAdmin, company: currentUser.company,
      companyId: currentUser.companyId, email: currentUser.email
    } : null;
    localStorage.setItem('sys_logged_user', JSON.stringify(safe));
    localStorage.setItem('sys_cached_company', currentCompany || '');
  } catch (e) {}
}

async function proceedLogin(foundUser) {
  isLogged = true;
  currentUser = foundUser;
  currentCompany = foundUser.company || 'GENEL';
  saveCurrentUser();
  appTitleText = `📦 ${currentCompany}`;
  updateAppTitleUI();
  updateAuthAreaUI();
  await initCompanyData(currentCompany);

  resetInactivityTimer();

  let layoutContainer = document.getElementById('appLayoutContainer');
  if (layoutContainer) layoutContainer.classList.add('logged-in-layout');

  let loginCard = document.getElementById('loginBoxCard');
  if (loginCard) loginCard.style.display = 'none';
  let prot = document.getElementById('protectedAppContent');
  if (prot) prot.style.display = 'flex';
  let authA = document.getElementById('authArea');
  if (authA) authA.style.display = 'flex';
  let botNav = document.getElementById('mobileBottomNav');
  if (botNav) botNav.style.display = 'flex';
  let sideBar = document.getElementById('desktopSidebar');
  if (sideBar && window.innerWidth >= 900) sideBar.style.display = 'flex';

  let trNow = getTurkeyDateNow();
  selectCustomDateForInit('txDateInput', trNow.isoDate);

  let superCard = document.getElementById('superAdminGlobalCard');
  if (currentUser.isSuperAdmin) {
    if (superCard) superCard.style.display = 'block';
    await renderSuperAdminPanel();
  } else {
    if (superCard) superCard.style.display = 'none';
  }

  let adminCards = document.querySelectorAll('.admin-only-card');
  if (currentUser.role === 'admin') { adminCards.forEach(c => c.style.display = 'block'); }
  else { adminCards.forEach(c => c.style.display = 'none'); }

  // Goruntuleyen kisitlarini uygula
  try { applyRoleRestrictions(); } catch (e) {}
}

function logout() {
  isLogged = false; currentUser = null; currentCompany = null;
  clearTimeout(inactivityTimer);
  if (realTimeSubscription) { try { _supabase.removeChannel(realTimeSubscription); } catch(e){} realTimeSubscription = null; }
  try {
    localStorage.removeItem('sys_logged_user');
    localStorage.removeItem('sys_cached_company');
    sessionStorage.removeItem('sys_welcome_shown');
    sessionStorage.removeItem('sys_active_page');
    _supabase.auth.signOut();
  } catch (e) {}
  location.reload();
}

// ---------- YENI FIRMA KAYDI (Auth + RPC) ----------
async function registerNewCompany() {
  let companyName = sanitizeText(document.getElementById('regCompanyInput').value.trim().toUpperCase());
  let uname = sanitizeText(document.getElementById('regUserInput').value.trim().toLowerCase());
  let email = document.getElementById('regEmailInput').value.trim();
  let upin = document.getElementById('regPinInput').value.trim();

  if (!companyName || !uname || !email || !upin) {
    showToast("Eksik", "Lütfen tüm alanları eksiksiz doldurun.", true); return;
  }
  if (upin.length < 6) {
    showToast("Şifre Kısa", "Şifre en az 6 karakter olmalıdır.", true); return;
  }

  showToast("İşlem Sürüyor", "Firma oluşturuluyor...");

  try {
    // 1) Firma olustur (varsa getirir)
    let { data: companyId, error: cErr } = await _supabase.rpc('create_company', { p_name: companyName });
    if (cErr) { showToast("Hata", cErr.message, true); return; }

    // 2) Auth kullanicisi olustur; profil tetikleyici otomatik satir acar
    const { data: authData, error: authError } = await _supabase.auth.signUp({
      email: email,
      password: upin,
      options: {
        data: { username: uname, company_id: String(companyId), role: 'admin' },
        emailRedirectTo: window.location.origin
      }
    });

    if (authError) {
      if (authError.message.toLowerCase().includes("rate limit")) {
        showToast("Kota Aşıldı", "Supabase e-posta kotası aşıldı.", true);
      } else {
        showToast("Kayıt Hatası", authError.message, true);
      }
      return;
    }
    if (!authData || !authData.user) {
      showToast("Hata", "Kullanıcı oluşturulamadı.", true); return;
    }

    // 3) Profili firma + admin olarak garanti altina al
    await _supabase.from('profiles').update({
      company_id: companyId, role: 'admin', username: uname, active: true
    }).eq('id', authData.user.id);

    await _supabase.auth.signOut();
    showToast("Başarılı", "Firma oluşturuldu. Giriş yapabilirsiniz.");
    showLoginScreen();
  } catch (err) {
    showToast("Hata", "Kayıt sırasında bir problem oluştu.", true);
  }
}

// ---------- E-POSTA ONAYI / SIFRE SIFIRLAMA ----------
async function resendCurrentEmailVerification() {
  let uInp = document.getElementById('userInput');
  let emailInput = uInp ? uInp.value.trim().toLowerCase() : '';
  if (!emailInput) { showToast("Eksik", "Önce e-posta adresinizi girin.", true); return; }
  try {
    const { error } = await _supabase.auth.resend({ type: 'signup', email: emailInput, options: { emailRedirectTo: window.location.origin } });
    if (error) showToast("Hata", error.message, true);
    else showToast("Gönderildi", `${emailInput} adresine onay linki gönderildi.`);
  } catch (e) { showToast("Hata", "Gönderilemedi.", true); }
}

async function sendPasswordResetEmail() {
  let emailInput = document.getElementById('forgotEmailInput');
  if (!emailInput) return;
  let email = emailInput.value.trim().toLowerCase();
  if (!email) { showToast("Eksik", "E-posta girin.", true); return; }
  try {
    const { error } = await _supabase.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin });
    if (error) showToast("Hata", error.message, true);
    else { showToast("Gönderildi", "Sıfırlama bağlantısı yollandı."); showLoginScreen(); }
  } catch (err) { showToast("Hata", "Gönderilemedi.", true); }
}

// ---------- HESAP AYARLARI ----------
async function saveNewUsername() {
  let inp = document.getElementById('newUsernameInput');
  if (!inp || !currentUser) return;
  let val = sanitizeText(inp.value.trim().toLowerCase());
  if (!val) return;
  await _supabase.from('profiles').update({ username: val }).eq('id', currentUser.id);
  currentUser.username = val;
  saveCurrentUser();
  updateAuthAreaUI();
  showToast("Başarılı", "Kullanıcı adı güncellendi.");
}

async function saveNewEmail() {
  let eInp = document.getElementById('newEmailInput');
  if (!eInp || !currentUser) return;
  let val = eInp.value.trim().toLowerCase();
  if (!val) return;
  const { error } = await _supabase.auth.updateUser({ email: val });
  if (error) { showToast("Hata", error.message, true); return; }
  currentUser.email = val;
  saveCurrentUser();
  showToast("Başarılı", "E-posta güncellendi (onay gerekebilir).");
}

async function saveNewPassword() {
  let eInp = document.getElementById('oldPassInput');
  let n1 = document.getElementById('newPassInput');
  let n2 = document.getElementById('newPassInputRepeat');
  if (!n1) return;
  let p1 = n1.value.trim();
  let p2 = n2 ? n2.value.trim() : p1;
  if (!p1) { showToast("Eksik", "Yeni şifre girin.", true); return; }
  if (p1.length < 6) { showToast("Şifre Kısa", "Şifre en az 6 karakter olmalıdır.", true); return; }
  if (p1 !== p2) { showToast("Uyuşmuyor", "Şifreler uyuşmuyor.", true); return; }
  const { error } = await _supabase.auth.updateUser({ password: p1 });
  if (error) { showToast("Hata", error.message, true); return; }
  if (n1) n1.value = ''; if (n2) n2.value = '';
  showToast("Başarılı", "Şifre güncellendi.");
}

function openPasswordModal() {
  ['oldPassInput','newPassInput','newPassInputRepeat'].forEach(id => {
    let el = document.getElementById(id); if (el) el.value = '';
  });
  openModal('passwordModal');
}
function closePasswordModal() { closeModal('passwordModal'); }

// ---------- GORUNTULEYEN KISITLARI ----------
function applyRoleRestrictions() {
  if (!currentUser) return;
  let isViewer = currentUser.role === 'görüntüleyen';
  let newProdBtn = document.getElementById('newProductBtn');
  if (newProdBtn) newProdBtn.style.display = isViewer ? 'none' : 'inline-flex';
  let navIslem = document.getElementById('navItemIslem');
  if (navIslem) navIslem.style.display = isViewer ? 'none' : 'flex';
  let sideIslem = document.getElementById('sidebarItemIslem');
  if (sideIslem) sideIslem.style.display = isViewer ? 'none' : 'flex';
}

// ---------- OTURUM GERI YUKLEME (sayfa acilisinda) ----------
async function restoreSession() {
  try {
    const { data } = await _supabase.auth.getSession();
    if (data && data.session && data.session.user) {
      await loadProfileAndEnter(data.session.user);
      return true;
    }
  } catch (e) {}
  return false;
}


// ---------- UST KOSEDE KULLANICI ALANI ----------
function updateAuthAreaUI() {
  let area = document.getElementById('authArea');
  if (!isLogged || !area || !currentUser) return;
  area.innerHTML = '<div style="display:flex; align-items:center; gap:5px;">' +
    '<span style="font-size:11px; font-weight:700; color:var(--text);">' + currentUser.username + '</span>' +
    '<button class="btn btn-danger btn-sm" style="height:26px; font-size:10px; padding:2px 6px;" onclick="logout()">Çıkış</button></div>';
  let compDisp = document.getElementById('settingsCompanyDisplay');
  if (compDisp) compDisp.textContent = currentCompany;
  let compInp = document.getElementById('settingsCompanyNameInput');
  if (compInp) compInp.value = currentCompany;
}
