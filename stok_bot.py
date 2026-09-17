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
    
    depolar = set(d.upper() for d in cfg_data.get("depots", [])) if isinstance(cfg_data, dict) and "depots" in cfg_data else set()
    for p in urun_data: depolar.update(k.upper() for k in p.get("openings", {}).keys())
    if not depolar: depolar.update(["BAR", "OFİS"])
    
    return urun_data, sorted(list(depolar))

def sayi_formatla(num): 
    return int(num) if float(num) % 1 == 0 else float(num)

def depo_stok_hesapla(urun_id, depo, products, txs):
    nd = depo.upper()
    acilis = sum(float(v) for p in products if p["id"] == urun_id for k, v in p.get("openings", {}).items() if k.upper() == nd)
    in_q = sum(float(t.get("qty", 0)) for t in txs if t.get("prodId") == urun_id and t.get("depot", "").upper() == nd and t.get("type") in ["GİRİŞ", "GIRIS"])
    out_q = sum(float(t.get("qty", 0)) for t in txs if t.get("prodId") == urun_id and t.get("depot", "").upper() == nd and t.get("type") in ["ÇIKIŞ", "CIKIS"])
    return acilis + in_q - out_q

# ==========================================
# 🧠 NLP MOTORU VE ZEKİ EŞLEŞTİRME
# ==========================================
SES_DUZELTMELER = {"cars berk": "carlsberg", "karsberg": "carlsberg", "twork": "tuborg", "tughborg": "tuborg", "tüp org": "tuborg", "borç": "tuborg", "fs": "efes", "redbıl": "redbull", "ifise": "ofise", "bafdan": "bardan"}
SAYI_CEVIRICI = {"bir": "1", "iki": "2", "üç": "3", "üc": "3", "dört": "4", "beş": "5", "altı": "6", "yedi": "7", "sekiz": "8", "dokuz": "9", "on": "10", "yarım": "0.5"}

def metni_temizle(metin):
    metin = metin.replace('İ','i').replace('I','i').lower().strip()
    for yanlis, dogru in SES_DUZELTMELER.items(): metin = re.sub(rf'\b{yanlis}\b', dogru, metin)
    for kelime, rakam in SAYI_CEVIRICI.items(): metin = re.sub(rf'\b{kelime}\b', rakam, metin)
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
    
    islem_turu = "BİLGİ" 
    if any(w in metin for w in ["ekle", "giris", "artir", "alim", "geldi", "aldim", "yap"]): islem_turu = "GİRİŞ"
    if any(w in metin for w in ["cikis", "sat", "satis", "sattim", "satti", "satildi", "eksilt", "gitti", "ver", "dus"]): islem_turu = "ÇIKIŞ"
    if any(w in metin for w in ["aktar", "transfer", "gecir", "gonder", "tasi"]): islem_turu = "TRANSFER"
    
    hedef_depo = aktif_depolar[0] if aktif_depolar else "BAR"
    for depo in aktif_depolar:
        depo_temiz = depo.lower()
        if depo_temiz in metin:
            hedef_depo = depo
            metin = metin.replace(depo_temiz, "") 

    for w in ["giris", "cikis", "transfer", "ekle", "sat", "yap", "tane", "adet", "satis", "sattim", "satti", "satildi", "eksilt", "gitti", "ver", "dus"]:
        metin = re.sub(rf'\b{w}\b', '', metin)

    parcalar = re.split(r'\n|,|\bve\b', metin)
    sepet = []

    for parca in parcalar:
        parca = parca.strip()
        if len(parca) < 2: continue

        boyut_match = re.search(r'\b(\d+(?:[\.,]\d+)?)\s*(cl|cc|lik|luk)\b', parca)
        kesin_boyut = float(boyut_match.group(1).replace(',', '.')) if boyut_match else None
        if boyut_match: parca = parca.replace(boyut_match.group(0), "")

        kalan_sayilar = re.findall(r'\b(\d+(?:[\.,]\d+)?)\b', parca)
        kalan_float_sayilar = [float(s.replace(',', '.')) for s in kalan_sayilar]
        kalan_metin = re.sub(r'\b\d+(?:[\.,]\d+)?\b', '', parca).strip()

        nihai_adet, nihai_boyut = 1.0, kesin_boyut

        if len(kalan_float_sayilar) == 1:
            s = kalan_float_sayilar[0]
            if s in hacim_havuzu and not kesin_boyut: nihai_boyut = s
            else: nihai_adet = s
        elif len(kalan_float_sayilar) >= 2:
            nihai_adet = kalan_float_sayilar[0]
            if not kesin_boyut: nihai_boyut = kalan_float_sayilar[1]

        en_iyi_urun, en_yuksek_skor = None, 0.0
        for p in products:
            p_name_temiz = p["name"].lower()
            skor = SequenceMatcher(None, kalan_metin, p_name_temiz).ratio()
            
            for uw in [w for w in kalan_metin.split() if len(w) > 2]:
                if uw in p_name_temiz: skor += 0.35
                
            if nihai_boyut:
                b_str = str(nihai_boyut).replace(".0", "")
                if b_str in p_name_temiz: skor += 0.5
                else: skor -= 0.6
                
            if skor > en_yuksek_skor:
                en_yuksek_skor = skor
                en_iyi_urun = p

        if en_iyi_urun and en_yuksek_skor > 0.35:
            mevcut_item = next((item for item in sepet if item["urun_id"] == en_iyi_urun["id"]), None)
            if mevcut_item: mevcut_item["miktar"] += float(nihai_adet)
            else: sepet.append({"urun_id": en_iyi_urun["id"], "urun_adi": en_iyi_urun["name"], "miktar": float(nihai_adet)})

    if not sepet: return {"status": "hata", "mesaj": "Ürünler tam anlaşılamadı. Lütfen kontrol edip tekrar yazın."}
    return {"status": "onay_bekliyor", "islem_turu": islem_turu, "hedef_depo": hedef_depo.upper(), "sepet": sepet}

# ==========================================
# 💾 ANA İŞLEMCİ: KESİN KAYIT (ONAY SONRASI)
# ==========================================
def kesin_stok_kaydi_yap(onaylanmis_veri, products):
    islem_turu = onaylanmis_veri.get("islem_turu")
    hedef_depo = onaylanmis_veri.get("hedef_depo")
    sepet = onaylanmis_veri.get("sepet", [])
    
    txs_data = get_cloud_db(f"company_{HEDEF_FIRMA}_transactions")
    txs = txs_data.get("list", [])
    date_str = datetime.datetime.now().strftime("%d.%m.%Y %H:%M")
    imza = f"🤖 Onaylı İşlem"

    detay_mesajlari, hata_mesajlari = [], []

    for item in sepet:
        mevcut_stok = depo_stok_hesapla(item["urun_id"], hedef_depo, products, txs)

        if islem_turu == "ÇIKIŞ" and mevcut_stok < float(item["miktar"]):
            hata_mesajlari.append(f"Yetersiz Stok! ({item['urun_adi']} için {sayi_formatla(mevcut_stok)} adet var)")
            continue

        txs.append({
            "id": "stok_" + str(int(datetime.datetime.now().timestamp() * 1000)), 
            "date": date_str, "depot": hedef_depo, "prodId": item["urun_id"], 
            "prodName": item["urun_adi"], "type": islem_turu, "qty": float(item["miktar"]), "desc": imza
        })
        time.sleep(0.01)

        yeni_stok = mevcut_stok + float(item["miktar"]) if islem_turu == "GİRİŞ" else mevcut_stok - float(item["miktar"])
        detay_mesajlari.append(f"{sayi_formatla(item['miktar'])} {item['urun_adi']} (Kalan: {sayi_formatla(yeni_stok)})")

    if hata_mesajlari: return "❌ İşlem İptal Edildi: " + " | ".join(hata_mesajlari)

    set_cloud_db(f"company_{HEDEF_FIRMA}_transactions", {"list": txs})
    
    islem_etiketi = "GİRİŞ YAPILDI" if islem_turu == "GİRİŞ" else "ÇIKIŞ YAPILDI"
    if islem_turu == "TRANSFER": islem_etiketi = "TRANSFER EDİLDİ"
    return f"✅ [{hedef_depo}] {islem_etiketi}: " + ", ".join(detay_mesajlari)

# ==========================================
# ☁️ BULUT DİNLEME DÖNGÜSÜ (2 AŞAMALI YAPI)
# ==========================================
def process_bot_queue():
    print(f"🚀 {HEDEF_FIRMA} // ZEKİ ASİSTAN (2 AŞAMALI ONAY SİSTEMİ) AKTİF ☁️")
    while True:
        try:
            queue_data = get_cloud_db(f"company_{HEDEF_FIRMA}_bot_queue")
            commands = queue_data.get("list", [])
            degisiklik_var = False
            
            PRODUCTS, AKTIF_DEPOLAR = firma_verilerini_getir(HEDEF_FIRMA)
            txs_verisi_cache = None
            
            for cmd_obj in commands:
                # FAZ 1: Kullanıcı yeni mesaj attı
                if cmd_obj.get("status") == "bekliyor":
                    analiz = nlp_siparis_cozumle(cmd_obj["cmd"], PRODUCTS, AKTIF_DEPOLAR)
                    
                    if analiz["status"] == "hata":
                        cmd_obj["status"] = "tamamlandi"
                        cmd_obj["reply"] = analiz["mesaj"]
                    
                    # Kullanıcı sadece bilgi/stok sorduysa, arayüz onayına sokmadan direkt cevap ver
                    elif analiz["islem_turu"] == "BİLGİ":
                        if not txs_verisi_cache: txs_verisi_cache = get_cloud_db(f"company_{HEDEF_FIRMA}_transactions").get("list", [])
                        detaylar = []
                        for item in analiz["sepet"]:
                            mevcut = depo_stok_hesapla(item["urun_id"], analiz["hedef_depo"], PRODUCTS, txs_verisi_cache)
                            detaylar.append(f"{sayi_formatla(mevcut)} adet {item['urun_adi']}")
                        
                        cmd_obj["status"] = "tamamlandi"
                        cmd_obj["reply"] = f"ℹ️ [{analiz['hedef_depo']}] Stok Durumu: " + ", ".join(detaylar)
                    
                    # Giriş / Çıkış işlemiyse ön yüze onay JSON'u gönder ve beklemeye geç
                    else:
                        cmd_obj["status"] = "onay_bekliyor"
                        cmd_obj["reply"] = json.dumps(analiz, ensure_ascii=False)
                        
                    degisiklik_var = True

                # FAZ 2: Uygulamadan onay (yeşil buton) tıklandı
                elif cmd_obj.get("status") == "onaylandi":
                    onayli_veri = json.loads(cmd_obj["reply"])
                    sonuc_mesaji = kesin_stok_kaydi_yap(onayli_veri, PRODUCTS)
                    
                    cmd_obj["status"] = "tamamlandi"
                    cmd_obj["reply"] = sonuc_mesaji
                    degisiklik_var = True

            if degisiklik_var:
                set_cloud_db(f"company_{HEDEF_FIRMA}_bot_queue", {"list": commands})
                
            time.sleep(2)
        except Exception as e:
            time.sleep(5)

# ==========================================
# 🌐 WEB SUNUCUSU
# ==========================================
class DummyHandler(BaseHTTPRequestHandler):
    def do_GET(self):
        self.send_response(200)
        self.send_header("Content-type", "text/html; charset=utf-8")
        self.end_headers()
        html_content = f"<html><body><h1>🚀 Zeki Stok Asistanı (Onay Sistemi) Aktif!</h1></body></html>"
        self.wfile.write(html_content.encode('utf-8'))

def run_server():
    port = int(os.environ.get("PORT", 8080))
    server = HTTPServer(("0.0.0.0", port), DummyHandler)
    server.serve_forever()

if __name__ == "__main__":
    t = threading.Thread(target=process_bot_queue)
    t.daemon = True
    t.start()
    run_server()
