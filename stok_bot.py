import os, time, re, json, datetime, threading
from difflib import SequenceMatcher
import urllib.request
from http.server import BaseHTTPRequestHandler, HTTPServer

# ==========================================
# ⚙️ BOT AYARLARI
# ==========================================
HEDEF_FIRMA = "LAVİN OTEL"

SUPABASE_URL = "https://qckafgpwbcapskunrwjm.supabase.co"
SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFja2FmZ3B3YmNhcHNrdW5yd2ptIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODk0OTEyOTEsImV4cCI6MjEwNTA2NzI5MX0.sHQIWHCeifTCKAxV_fI7WE1esxoB1XK_bkGLj9D1NLQ"

HEADERS = {
    "apikey": SUPABASE_KEY,
    "Authorization": f"Bearer {SUPABASE_KEY}",
    "Content-Type": "application/json",
    "Prefer": "resolution=merge-duplicates"
}

def get_cloud_db(target_key):
    try:
        url = f"{SUPABASE_URL}/rest/v1/app_kv?select=key,value"
        req = urllib.request.Request(url, headers=HEADERS)
        with urllib.request.urlopen(req, timeout=5) as response:
            if response.status == 200:
                rows = json.loads(response.read().decode())
                for row in rows:
                    if row.get('key') == target_key:
                        return row.get('value', {"list": []})
    except: pass
    return {"list": []}

def set_cloud_db(target_key, val_dict):
    try:
        url = f"{SUPABASE_URL}/rest/v1/app_kv?on_conflict=key"
        data = json.dumps({"key": target_key, "value": val_dict}).encode('utf-8')
        req = urllib.request.Request(url, data=data, headers=HEADERS, method="POST")
        urllib.request.urlopen(req, timeout=5)
    except: pass

def firma_ve_urunleri_getir(firma_adi):
    try:
        urun_data = get_cloud_db(f"company_{firma_adi.upper()}_products")
        products = urun_data.get("list", [])
        if products: return firma_adi.upper(), products
    except: pass
    return firma_adi.upper(), []

CURRENT_COMPANY, PRODUCTS = firma_ve_urunleri_getir(HEDEF_FIRMA)

# --- TÜRKÇE VE YAZIM DÜZELTME MOTORU ---
def tr_temizle(metin):
    if not metin: return ""
    return metin.replace('İ','i').replace('I','i').replace('ı','i').replace('Ş','s').replace('ş','s').replace('Ü','u').replace('ü','u').replace('Ö','o').replace('ö','o').replace('Ç','c').replace('ç','c').replace('Ğ','g').replace('ğ','g').lower().strip()

SES_DUZELTMELER = {"cars berk": "carlsberg", "karsberg": "carlsberg", "şarj bek": "carlsberg", "twork": "tuborg", "tughborg": "tuborg", "tüp org": "tuborg", "borç": "tuborg", "fs": "efes", "efs": "efes", "f20": "efes", "redbıl": "redbull", "ifise": "ofise", "ifis": "ofis", "ofiten": "ofisten", "bafdan": "bardan", "bafda": "barda"}
SAYI_CEVIRICI = {"bir": "1", "iki": "2", "üç": "3", "üc": "3", "dört": "4", "dort": "4", "beş": "5", "bes": "5", "altı": "6", "alti": "6", "yedi": "7", "sekiz": "8", "dokuz": "9", "on": "10"}
KATEGORILER = {"bira": ["tuborg", "efes", "carlsberg"], "rakı": ["yeni rakı", "yeni raki", "efe gold", "beylerbeyi", "tekirdağ"], "şarap": ["senfoni", "trio", "nodus", "rozebella"], "votka": ["istanblue", "absolut"], "viski": ["chivas", "jack daniels"], "tekila": ["olmega"], "cin": ["gordons"], "içecek": ["redbull"]}
MARKALAR = ["yeni rakı", "yeni raki", "efe gold", "beylerbeyi göbek", "beylerbeyi", "tekirdağ altın seri", "chivas regal", "chivas", "jack daniels", "senfoni", "trio", "nodus", "rozebella", "istanblue", "absolut", "olmega", "gordons", "tuborg", "efes", "carlsberg", "redbull"]

def metni_temizle(metin):
    metin = tr_temizle(metin)
    if metin.endswith(" bir"): metin = metin[:-4] + " bira"
    metin = metin.replace("tane bir ", "tane bira ")
    for yanlis, dogru in SES_DUZELTMELER.items(): metin = re.sub(rf'\b{yanlis}\b', dogru, metin)
    for kelime, rakam in SAYI_CEVIRICI.items(): metin = re.sub(rf'\b{kelime}\b', rakam, metin)
    return metin

def boyutlari_gizle(metin):
    metin = metin.replace("yuzluk", " SIZE100 ").replace("yüzlük", " SIZE100 ").replace("ellilik", " SIZE50 ").replace("yetmislik", " SIZE70 ").replace("yetmişlik", " SIZE70 ")
    ekler = r"(lik|lık|luk|lük|li|lı|lu|lü|cl|cc)"
    for size in ["20", "35", "50", "70", "75", "100"]: metin = re.sub(rf"\b{size}\s*{ekler}\b", f" SIZE{size} ", metin)
    metin = re.sub(rf"\b37[\.,]?5\s*{ekler}\b", " SIZE37 ", metin)
    rakilar = r"(rakı|raki|efe|gold|beylerbeyi|göbek|gobek|tekirdağ|tekirdag|seri)"
    for size in ["20", "35", "50", "70", "100"]: metin = re.sub(rf"\b{rakilar}\s+{size}\b", rf"\1 SIZE{size} ", metin)
    return metin

def boyutlari_gerigetir(metin):
    return metin.replace("SIZE20", "20 cl").replace("SIZE35", "35 cl").replace("SIZE37", "37.5 cl").replace("SIZE50", "50 cl").replace("SIZE70", "70 cl").replace("SIZE75", "75 cl").replace("SIZE100", "100 cl")

def sayi_formatla(num): return int(num) if float(num) % 1 == 0 else float(num)

# --- TARİH VE STOK MOTORU ---
def tarih_cozumle(komut):
    simdi = datetime.datetime.now()
    if any(w in komut for w in ["dun", "bir gun once"]): return (simdi - datetime.timedelta(days=1)).strftime("%d.%m.%Y %H:%M"), None
    match_gecen_ay = re.search(r'gecen\s+ayin\s+(\d+)', komut)
    if match_gecen_ay:
        hg = int(match_gecen_ay.group(1))
        yil, ay = simdi.year, simdi.month - 1
        if ay == 0: ay, yil = 12, yil - 1
        import calendar
        _, sg = calendar.monthrange(yil, ay)
        if hg > sg: return None, f"Geçen ay ({ay}. ay) sadece {sg} çekiyor patron!"
        return f"{hg:02d}.{ay:02d}.{yil} {simdi.strftime('%H:%M')}", None
    match_bu_ay = re.search(r'(?:ayin\s+)?(\d+)(?:\'?si|\'?ü|\'?i|\'?u)?', komut)
    if match_bu_ay and ("ayin" in komut or "tarih" in komut):
        hg = int(match_bu_ay.group(1))
        import calendar
        _, sg = calendar.monthrange(simdi.year, simdi.month)
        if hg > sg or hg > simdi.day: return None, "Geçersiz gün seçtiniz patron."
        return f"{hg:02d}.{simdi.month:02d}.{simdi.year} {simdi.strftime('%H:%M')}", None
    return simdi.strftime("%d.%m.%Y %H:%M"), None

def urun_bul(komut):
    komut_filtreli = komut
    for g in ["kaç", "kac", "adet", "tane", "var", "elimizde", "toplam", "ofiste", "barda", "depoda", "sat", "satış", "satis", "sattım", "sattim", "sattı", "satıldı", "ekle", "giriş", "giris", "çıkış", "cikis", "yap", "aktar", "transfer", "dun", "gecen", "ayin"]:
        komut_filtreli = re.sub(rf'\b{g}\b', '', komut_filtreli)
    komut_urun_isim = re.sub(r'\b(\d+(?:[\.,]\d+)?)\b', '', komut_filtreli.replace("'", "").strip()).strip()
    if len(komut_urun_isim) < 2: return None
    en_iyi, en_yuksek = None, 0.0
    for p in PRODUCTS:
        p_name = tr_temizle(p["name"])
        skor = SequenceMatcher(None, komut_urun_isim, p_name).ratio() + (sum(1 for kw in [w for w in p_name.split() if len(w) > 1] if kw in komut_urun_isim) * 0.45)
        if skor > en_yuksek: en_yuksek, en_iyi = skor, p
    return en_iyi if en_yuksek > 0.35 else None

def tum_depolari_bul():
    txs, cfg = get_cloud_db(f"company_{CURRENT_COMPANY}_transactions").get("list", []), get_cloud_db(f"company_{CURRENT_COMPANY}_config")
    depolar = set(d.upper() for d in cfg.get("depots", [])) if isinstance(cfg, dict) and "depots" in cfg else set()
    for p in PRODUCTS: depolar.update(k.upper() for k in p.get("openings", {}).keys())
    for t in txs:
        if t.get("depot"): depolar.add(t.get("depot").upper())
    if not depolar: depolar.update(["DEPO 1", "DEPO 2"])
    dl = sorted(list(depolar))
    ilk = cfg["depots"][0].upper() if isinstance(cfg, dict) and "depots" in cfg and cfg["depots"] else ("BAR" if "BAR" in dl else None)
    if ilk and ilk in dl:
        dl.remove(ilk)
        dl.insert(0, ilk)
    return dl

def depo_stok_hesapla(urun_id, depo):
    nd = tr_temizle(depo).upper()
    txs = get_cloud_db(f"company_{CURRENT_COMPANY}_transactions").get("list", [])
    acilis = sum(float(v) for p in PRODUCTS if p["id"] == urun_id for k, v in p.get("openings", {}).items() if tr_temizle(k).upper() == nd)
    in_q = sum(float(t.get("qty", 0)) for t in txs if t.get("prodId") == urun_id and tr_temizle(t.get("depot", "")).upper() == nd and t.get("type") == "GİRİŞ")
    out_q = sum(float(t.get("qty", 0)) for t in txs if t.get("prodId") == urun_id and tr_temizle(t.get("depot", "")).upper() == nd and t.get("type") == "ÇIKIŞ")
    return acilis + in_q - out_q

def stok_islem_yap(urun_id, miktar, depo, islem="giris", ozel_tarih=None, aciklama=None):
    nd = tr_temizle(depo).upper()
    txs_data = get_cloud_db(f"company_{CURRENT_COMPANY}_transactions")
    txs = txs_data.get("list", [])
    date_str = ozel_tarih if ozel_tarih else datetime.datetime.now().strftime("%d.%m.%Y %H:%M")
    imza = f"🤖 {CURRENT_COMPANY} Bot"
    desc = f"{aciklama} [{imza}]" if aciklama else imza
    urun_adi = next((p["name"] for p in PRODUCTS if p["id"] == urun_id), "")
    txs.append({"id": "stok_" + str(int(datetime.datetime.now().timestamp() * 1000)), "date": date_str, "depot": nd, "prodId": urun_id, "prodName": urun_adi, "type": "GİRİŞ" if islem == "giris" else "ÇIKIŞ", "qty": float(miktar), "desc": desc})
    set_cloud_db(f"company_{CURRENT_COMPANY}_transactions", {"list": txs})

# ==========================================
# 🤖 ANA KOMUT İŞLEYİCİ
# ==========================================
def process_command(user_input):
    global PRODUCTS, CURRENT_COMPANY
    CURRENT_COMPANY, PRODUCTS = firma_ve_urunleri_getir(HEDEF_FIRMA)
    cmd_lower = metni_temizle(user_input)
    cmd_islenen = boyutlari_gizle(cmd_lower)

    cozulen_tarih, tarih_hata = tarih_cozumle(cmd_lower)
    if tarih_hata: return tarih_hata

    aktif_depolar = tum_depolari_bul()
    is_transfer = any(w in cmd_islenen for w in ["aktar", "transfer", "gecir"])
    from_depot, to_depot = None, None
    
    if is_transfer:
        bulunanlar = []
        words = cmd_islenen.split()
        for i, w in enumerate(words):
            for d in aktif_depolar:
                if w.startswith(tr_temizle(d)) and not any(d == e[1] for e in bulunanlar):
                    bulunanlar.append((i, d))
        if len(bulunanlar) >= 2:
            bulunanlar.sort(key=lambda x: x[0])
            from_depot, to_depot = bulunanlar[0][1], bulunanlar[1][1]
        elif len(bulunanlar) == 1:
            td, tk = bulunanlar[0][1], words[bulunanlar[0][0]]
            if tk.endswith(('e', 'a', 'ya', 'ye')):
                to_depot, from_depot = td, [d for d in aktif_depolar if tr_temizle(d) != tr_temizle(td)][0]
            else:
                from_depot, to_depot = td, [d for d in aktif_depolar if tr_temizle(d) != tr_temizle(td)][0]

    secilen_depo = aktif_depolar[0] if aktif_depolar else "DEPO 1"
    for d in aktif_depolar:
        if any(k.startswith(tr_temizle(d)) for k in cmd_islenen.split()):
            secilen_depo = d
            break

    is_toplam = "toplam" in cmd_islenen or "hepsi" in cmd_islenen
    is_ekle = any(w in cmd_islenen for w in ["ekle", "giris", "artir", "alim", "geldi", "aldim"])
    is_cikis = any(w in cmd_islenen for w in ["sat", "satis", "sattim", "satti", "satildi", "cikis", "eksilt", "gitti", "ver"])

    eslesen_marka = next((m for m in MARKALAR if re.search(rf'\b{m}\b', cmd_lower)), None)
    eslesen_kategori, eslesen_keywords = None, []
    if not eslesen_marka:
        for kat, keywords in KATEGORILER.items():
            if re.search(rf'\b{kat}\b', cmd_lower): eslesen_kategori, eslesen_keywords = kat, keywords; break
    
    if (eslesen_marka or eslesen_kategori) and not is_transfer and not is_ekle and not is_cikis:
        kat_urunleri = [p for p in PRODUCTS if eslesen_marka in tr_temizle(p["name"])] if eslesen_marka else [p for p in PRODUCTS if any(kw in tr_temizle(p["name"]) for kw in eslesen_keywords)]
        grup_adi = (eslesen_marka or eslesen_kategori).title()
        if kat_urunleri:
            detaylar, genel_toplam = [], 0
            for u in kat_urunleri:
                t = sum(depo_stok_hesapla(u["id"], d) for d in aktif_depolar) if is_toplam else depo_stok_hesapla(u["id"], secilen_depo)
                if t > 0: detaylar.append(f"{sayi_formatla(t)} adet {u['name']}"); genel_toplam += t
            return f"Patron, bu depoda hiç {grup_adi} kalmamış." if genel_toplam == 0 else f"{'Tüm depolar' if is_toplam else secilen_depo.upper()} toplam {sayi_formatla(genel_toplam)} {grup_adi}: " + ", ".join(detaylar)
        return f"Stoklarda {grup_adi} bulamadım."

    items = []
    parts = re.split(r'\b(\d+(?:[\.,]\d+)?)\b', cmd_islenen) 
    if len(parts) > 1:
        for i in range(1, len(parts), 2):
            try:
                qty = float(parts[i].replace(',', '.'))
                urun = urun_bul(boyutlari_gerigetir(parts[i+1] if i+1 < len(parts) else ""))
                if urun: items.append({"prod": urun, "qty": qty})
            except: pass
                
    if not items:
        urun = urun_bul(boyutlari_gerigetir(cmd_islenen))
        if urun:
            sayilar = re.findall(r'\b(\d+(?:[\.,]\d+)?)\b', cmd_islenen)
            items.append({"prod": urun, "qty": float(sayilar[0].replace(',', '.')) if sayilar else 1})

    if not items: return "Talebinizi anlayamadım."
    detay_mesajlari, hata_mesajlari = [], []
    
    if is_transfer:
        if not from_depot or not to_depot or tr_temizle(from_depot) == tr_temizle(to_depot): return "Talebinizi anlayamadım."
        for item in items:
            mevcut = depo_stok_hesapla(item["prod"]["id"], from_depot)
            if mevcut < item["qty"]: hata_mesajlari.append(f"{from_depot.upper()} deposunda yeterli {item['prod']['name']} yok. Mevcut: {sayi_formatla(mevcut)} adet")
            elif item["qty"] > 0:
                stok_islem_yap(item["prod"]["id"], item["qty"], from_depot, "cikis", cozulen_tarih, f"Transfer -> {to_depot.upper()}")
                stok_islem_yap(item["prod"]["id"], item["qty"], to_depot, "giris", cozulen_tarih, f"Transfer <- {from_depot.upper()}")
                detay_mesajlari.append(f"{sayi_formatla(item['qty'])} {item['prod']['name']}")
        if hata_mesajlari: return ". ".join(hata_mesajlari)
        return f"{from_depot.upper()} -> {to_depot.upper()} aktarıldı ({cozulen_tarih.split()[0]}): " + ", ".join(detay_mesajlari)
                
    elif is_ekle:
        for item in items:
            stok_islem_yap(item["prod"]["id"], item["qty"], secilen_depo, "giris", cozulen_tarih, None)
            detay_mesajlari.append(f"{sayi_formatla(item['qty'])} {item['prod']['name']} (Kalan: {sayi_formatla(depo_stok_hesapla(item['prod']['id'], secilen_depo))})")
        return f"({secilen_depo.upper()}) eklendi [{cozulen_tarih.split()[0]}]: " + ", ".join(detay_mesajlari)
        
    elif is_cikis:
        for item in items:
            mevcut = depo_stok_hesapla(item["prod"]["id"], secilen_depo)
            if mevcut < item["qty"]: hata_mesajlari.append(f"Deponuzda yeterli {item['prod']['name']} yok. Mevcut: {sayi_formatla(mevcut)} adet")
            elif item["qty"] > 0:
                stok_islem_yap(item["prod"]["id"], item["qty"], secilen_depo, "cikis", cozulen_tarih, None)
                detay_mesajlari.append(f"{sayi_formatla(item['qty'])} {item['prod']['name']} (Kalan: {sayi_formatla(depo_stok_hesapla(item['prod']['id'], secilen_depo))})")
        if hata_mesajlari: return ". ".join(hata_mesajlari)
        return f"({secilen_depo.upper()}) çıkışı [{cozulen_tarih.split()[0]}]: " + ", ".join(detay_mesajlari)
        
    elif is_toplam:
        for item in items:
            toplam = sum(depo_stok_hesapla(item["prod"]["id"], d) for d in aktif_depolar)
            detay_mesajlari.append(f"{sayi_formatla(toplam)} {item['prod']['name']}")
        return "Toplam: " + ", ".join(detay_mesajlari)
    else:
        for item in items:
            adet = depo_stok_hesapla(item["prod"]["id"], secilen_depo)
            detay_mesajlari.append(f"{sayi_formatla(adet)} {item['prod']['name']}")
        return f"({secilen_depo.upper()}): " + ", ".join(detay_mesajlari)

# ==========================================
# ☁️ BULUT DİNLEME DÖNGÜSÜ & WEB SUNUCUSU
# ==========================================
def process_bot_queue():
    print(f"🚀 {CURRENT_COMPANY} // BULUT STOK BOT AKTİF VE DİNLİYOR ☁️🤖")
    while True:
        try:
            queue_data = get_cloud_db(f"company_{CURRENT_COMPANY}_bot_queue")
            commands = queue_data.get("list", [])
            pending = [c for c in commands if c.get("status") == "bekliyor"]
            
            for cmd_obj in pending:
                user_cmd = cmd_obj["cmd"]
                print(f"📥 Siteden Komut Geldi: {user_cmd}")
                
                reply_msg = process_command(user_cmd)
                print(f"📤 Cevap: {reply_msg}")
                
                cmd_obj["status"] = "tamamlandi"
                cmd_obj["reply"] = reply_msg
                set_cloud_db(f"company_{CURRENT_COMPANY}_bot_queue", {"list": commands})
                
            time.sleep(3) # Siteden gelenleri 3 saniyede bir kontrol et
        except Exception as e:
            time.sleep(5)

class DummyHandler(BaseHTTPRequestHandler):
    def do_GET(self):
        self.send_response(200)
        self.send_header("Content-type", "text/html")
        self.end_headers()
        self.wfile.write(b"Bot 7/24 Aktif ve Calisiyor!")

def run_server():
    port = int(os.environ.get("PORT", 8080))
    server = HTTPServer(("0.0.0.0", port), DummyHandler)
    print(f"🌐 Bulut Web Sunucusu Başlatıldı (Port: {port})")
    server.serve_forever()

if __name__ == "__main__":
    t = threading.Thread(target=process_bot_queue)
    t.daemon = True
    t.start()
    run_server()
EOF
