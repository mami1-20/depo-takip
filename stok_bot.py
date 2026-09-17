import os, time, re, json, datetime, threading
from difflib import SequenceMatcher
import urllib.request
from http.server import BaseHTTPRequestHandler, HTTPServer

# ==========================================
# ⚙️ BOT AYARLARI VE BULUT BAĞLANTISI
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

# --- VERİTABANI YARDIMCI FONKSİYONLARI ---
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

def firma_verilerini_getir(firma_adi):
    urun_data = get_cloud_db(f"company_{firma_adi.upper()}_products").get("list", [])
    cfg_data = get_cloud_db(f"company_{firma_adi.upper()}_config")
    
    # Depoları dinamik olarak topla (Supabase'den okur)
    depolar = set(d.upper() for d in cfg_data.get("depots", [])) if isinstance(cfg_data, dict) and "depots" in cfg_data else set()
    for p in urun_data:
        depolar.update(k.upper() for k in p.get("openings", {}).keys())
    
    if not depolar: depolar.update(["BAR", "OFİS", "DEPO 1", "DEPO 2"])
    
    return urun_data, sorted(list(depolar))

# ==========================================
# 🧠 NLP MOTORU VE ZEKİ EŞLEŞTİRME
# ==========================================

# Yazım yanlışlarını tolere eden sözlük
SES_DUZELTMELER = {"cars berk": "carlsberg", "karsberg": "carlsberg", "şarj bek": "carlsberg", "twork": "tuborg", "tughborg": "tuborg", "tüp org": "tuborg", "borç": "tuborg", "fs": "efes", "efs": "efes", "f20": "efes", "redbıl": "redbull", "ifise": "ofise", "ifis": "ofis", "ofiten": "ofisten", "bafdan": "bardan", "bafda": "barda"}
SAYI_CEVIRICI = {"bir": "1", "iki": "2", "üç": "3", "üc": "3", "dört": "4", "dort": "4", "beş": "5", "bes": "5", "altı": "6", "alti": "6", "yedi": "7", "sekiz": "8", "dokuz": "9", "on": "10", "yarım": "0.5", "yarim": "0.5"}

def metni_temizle(metin):
    metin = metin.replace('İ','i').replace('I','i').lower().strip()
    for yanlis, dogru in SES_DUZELTMELER.items(): 
        metin = re.sub(rf'\b{yanlis}\b', dogru, metin)
    for kelime, rakam in SAYI_CEVIRICI.items(): 
        metin = re.sub(rf'\b{kelime}\b', rakam, metin)
    return metin

def dinamik_hacim_havuzu_olustur(products):
    hacimler = set()
    for p in products:
        bulunanlar = re.findall(r'\b(\d+(?:[\.,]\d+)?)\b', p.get("name", ""))
        for b in bulunanlar:
            b_float = float(b.replace(',', '.'))
            if 10 <= b_float <= 200: hacimler.add(b_float)
    return hacimler

def nlp_siparis_cozumle(kullanici_metni, products, aktif_depolar):
    metin = metni_temizle(kullanici_metni)
    hacim_havuzu = dinamik_hacim_havuzu_olustur(products)
    
    # 1. İşlem Türü ve Depo Tespiti
    islem_turu = "GİRİŞ"
    if any(w in metin for w in ["cikis", "sat", "eksilt", "gitti", "ver"]): islem_turu = "ÇIKIŞ"
    elif any(w in metin for w in ["aktar", "transfer", "gecir", "gonder", "tasi"]): islem_turu = "TRANSFER"

    hedef_depo = aktif_depolar[0] if aktif_depolar else "BAR"
    for depo in aktif_depolar:
        depo_temiz = depo.lower()
        if depo_temiz in metin:
            hedef_depo = depo
            metin = metin.replace(depo_temiz, "") # Bulunan depoyu metinden sil ki ürüne karışmasın
            
    # Hızlı işlem etiketlerini metinden temizle
    for w in ["giris", "cikis", "transfer", "ekle", "sat", "yap", "tane", "adet"]:
        metin = re.sub(rf'\b{w}\b', '', metin)

    # 2. Metni Parçalara Ayırma ve Hacim Analizi
    parcalar = re.split(r'\n|,|\bve\b', metin)
    sepet = []

    for parca in parcalar:
        parca = parca.strip()
        if len(parca) < 2: continue

        # Kalkan 1: "cl", "lik" yazılıysa kesin boyuttur
        boyut_match = re.search(r'\b(\d+(?:[\.,]\d+)?)\s*(cl|cc|lik|luk)\b', parca)
        kesin_boyut = float(boyut_match.group(1).replace(',', '.')) if boyut_match else None
        if boyut_match: parca = parca.replace(boyut_match.group(0), "")

        # Kalan rakamları topla
        kalan_sayilar = re.findall(r'\b(\d+(?:[\.,]\d+)?)\b', parca)
        kalan_float_sayilar = [float(s.replace(',', '.')) for s in kalan_sayilar]
        
        # Sayıları temizle, geriye saf ürün ismi kalsın
        kalan_metin = re.sub(r'\b\d+(?:[\.,]\d+)?\b', '', parca).strip()

        nihai_adet = 1.0
        nihai_boyut = kesin_boyut

        # Dedektif Kuralı: Rakam neyi ifade ediyor?
        if len(kalan_float_sayilar) == 1:
            s = kalan_float_sayilar[0]
            if s in hacim_havuzu and not kesin_boyut: nihai_boyut = s
            else: nihai_adet = s
        elif len(kalan_float_sayilar) >= 2:
            nihai_adet = kalan_float_sayilar[0]
            if not kesin_boyut: nihai_boyut = kalan_float_sayilar[1]

        # 3. DNA Eşleştirme Motoru (Fuzzy Search)
        en_iyi_urun = None
        en_yuksek_skor = 0.0
        
        for p in products:
            p_name_temiz = p["name"].lower()
            skor = SequenceMatcher(None, kalan_metin, p_name_temiz).ratio()
            
            # İçindeki kelimeler tutuyorsa bonus
            for uw in [w for w in kalan_metin.split() if len(w) > 2]:
                if uw in p_name_temiz: skor += 0.35
                
            # Boyut eşleşiyorsa (Hayat Kurtaran Filtre)
            if nihai_boyut:
                b_str = str(nihai_boyut).replace(".0", "")
                if b_str in p_name_temiz: skor += 0.5
                else: skor -= 0.6
                
            if skor > en_yuksek_skor:
                en_yuksek_skor = skor
                en_iyi_urun = p

        # Eşleşme başarılıysa sepete at (Skor barajı: 0.35)
        if en_iyi_urun and en_yuksek_skor > 0.35:
            sepet.append({
                "urun_id": en_iyi_urun["id"],
                "urun_adi": en_iyi_urun["name"],
                "miktar": float(nihai_adet)
            })

    # Eğer metin anlaşılamadıysa iptal et
    if not sepet:
        return {"status": "hata", "mesaj": "Ürünler tam olarak anlaşılamadı. Lütfen kontrol edip tekrar yazın."}

    return {
        "status": "onay_bekliyor",
        "islem_turu": islem_turu,
        "hedef_depo": hedef_depo.upper(),
        "sepet": sepet
    }

# ==========================================
# 💾 STOK KAYIT İŞLEMCİSİ (ONAY SONRASI)
# ==========================================
def kesin_stok_kaydi_yap(onaylanmis_veri):
    islem_turu = onaylanmis_veri.get("islem_turu")
    hedef_depo = onaylanmis_veri.get("hedef_depo")
    sepet = onaylanmis_veri.get("sepet", [])
    
    txs_data = get_cloud_db(f"company_{HEDEF_FIRMA}_transactions")
    txs = txs_data.get("list", [])
    date_str = datetime.datetime.now().strftime("%d.%m.%Y %H:%M")
    imza = f"🤖 Akıllı Asistan Onaylı"

    for item in sepet:
        txs.append({
            "id": "stok_" + str(int(datetime.datetime.now().timestamp() * 1000)), 
            "date": date_str, 
            "depot": hedef_depo, 
            "prodId": item["urun_id"], 
            "prodName": item["urun_adi"], 
            "type": islem_turu, 
            "qty": float(item["miktar"]), 
            "desc": imza
        })
        time.sleep(0.01) # ID'lerin çakışmaması için milisaniye bekle
        
    set_cloud_db(f"company_{HEDEF_FIRMA}_transactions", {"list": txs})
    return "✅ Stok işlemi başarıyla kaydedildi."

# ==========================================
# ☁️ BULUT DİNLEME DÖNGÜSÜ
# ==========================================
def process_bot_queue():
    print(f"🚀 {HEDEF_FIRMA} // ZEKİ NLP ASİSTANI AKTİF VE DİNLİYOR ☁️💼")
    while True:
        try:
            queue_data = get_cloud_db(f"company_{HEDEF_FIRMA}_bot_queue")
            commands = queue_data.get("list", [])
            degisiklik_var = False
            
            PRODUCTS, AKTIF_DEPOLAR = firma_verilerini_getir(HEDEF_FIRMA)
            
            for cmd_obj in commands:
                # 1. FAZ: Yeni mesaj geldi, analiz et ve ONAY KARTI (JSON) oluştur
                if cmd_obj.get("status") == "bekliyor":
                    print(f"📥 Yeni Komut Analiz Ediliyor: {cmd_obj['cmd']}")
                    analiz_sonucu = nlp_siparis_cozumle(cmd_obj["cmd"], PRODUCTS, AKTIF_DEPOLAR)
                    
                    # Ön yüzün okuması için formatlı JSON verisi string olarak basılır
                    cmd_obj["reply"] = json.dumps(analiz_sonucu, ensure_ascii=False)
                    
                    if analiz_sonucu["status"] == "hata":
                        cmd_obj["status"] = "tamamlandi" # Hata varsa işlemi bitir, ekranda mesajı göster
                    else:
                        cmd_obj["status"] = "onay_bekliyor" # Onay kartını göstermek için statüyü bekleterek askıya al
                        
                    degisiklik_var = True

                # 2. FAZ: Kullanıcı arayüzde (uygulamada) ONAYLA tuşuna bastı
                elif cmd_obj.get("status") == "onaylandi":
                    print(f"📥 Sepet Onaylandı, Veritabanına Kesin Kayıt Yapılıyor...")
                    
                    # Ön yüzden (Onay Kartından) dönen güncel JSON verisini yükle
                    onayli_veri = json.loads(cmd_obj["reply"])
                    sonuc_mesaji = kesin_stok_kaydi_yap(onayli_veri)
                    
                    cmd_obj["status"] = "tamamlandi"
                    # Kullanıcıya başarı mesajını ilet
                    cmd_obj["reply"] = json.dumps({"status": "tamamlandi", "mesaj": sonuc_mesaji}, ensure_ascii=False)
                    degisiklik_var = True

            if degisiklik_var:
                set_cloud_db(f"company_{HEDEF_FIRMA}_bot_queue", {"list": commands})
                
            time.sleep(2)
        except Exception as e:
            print(f"Hata: {e}")
            time.sleep(5)

# ==========================================
# 🌐 WEB SUNUCUSU (Uygulamanın Ayakta Kalması İçin)
# ==========================================
class DummyHandler(BaseHTTPRequestHandler):
    def do_GET(self):
        self.send_response(200)
        self.send_header("Content-type", "text/html; charset=utf-8")
        self.end_headers()
        html_content = f"<html><body><h1>🚀 Kurumsal Stok Asistanı 7/24 Aktif!</h1><p>Firma: <b>{HEDEF_FIRMA}</b></p><p>Sistem kusursuz çalışıyor.</p></body></html>"
        self.wfile.write(html_content.encode('utf-8'))

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
