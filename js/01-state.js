// ============================================================
// STATE - Global durum degiskenleri
// ============================================================



let pendingAdminAction = null;



let appTitleText = '📦 DEPO TAKİP';


let depots = ['DEPO 1', 'DEPO 2'];


let products = [];


let transactions = [];


let systemUsers = [{ username: 'admin', pin: '1234', role: 'admin', active: true, company: 'GENEL', email: 'admin@depotakip.com' }, { username: 'mami', pin: 'mami2020', role: 'admin', active: true, company: 'BAR', email: 'mami@depotakip.com' }];



let currentViewDepot = depots[0];


let currentTxType = 'ÇIKIŞ';


let isLogged = false;


let currentUser = null;


let currentCompany = null;


let tempReorderProducts = [];


let draggedIndex = null;


let quickTxType = 'ÇIKIŞ';


let isCriticalCardMinimized = true;


let currentCart = [];


let activeCalendarInputId = null;


let currentCalYear = new Date().getFullYear();


let currentCalMonth = new Date().getMonth();


let currentExportFormat = 'xlsx';


let isPasswordRecoveryMode = false;



// --- HAREKETSİZLİK OTOMATİK ÇIKIŞ (5 DAKİKA) ---
let inactivityTimer = null;


const INACTIVITY_LIMIT_MS = 5 * 60 * 1000;



let tempCategoryProducts = [];


let openCategoryPanels = new Set();



// ===== RAPOR PANELI KONTROLLERI =====
let reportActiveTab = 'all';


let reportProductQuery = '';


let reportFilteredAll = [];



let lastFilteredTransactions = [];



// --- AI ASİSTAN DEĞİŞKENLERİ ---
let activeAiActionType = '';



// --- 📸 AI OKUT / ÇIKIŞ ---
let validOutItems = [];


let insufficientOutItems = [];


let missingOutItems = [];



// --- 🧾 FATURA GİRİŞİ ---
let validInvoiceItems = [];


let missingInvoiceItems = [];



// --- 🔄 AI TRANSFER ---
let validTransferItems = [];


let insufficientTransferItems = [];


let activationTransferItems = [];


let missingSourceTransferItems = [];
