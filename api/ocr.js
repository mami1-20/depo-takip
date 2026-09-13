export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ success: false, error: `Method ${req.method} Not Allowed` });
  }

  try {
    const { imageBase64 } = req.body;
    if (!imageBase64) {
      return res.status(400).json({ success: false, error: 'Fotoğraf verisi bulunamadı.' });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ success: false, error: 'GEMINI_API_KEY çevre değişkeni eksik.' });
    }

    const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, '');

    // Standart kararlı endpoint
    const geminiRes = await fetch(`https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                inline_data: {
                  mime_type: "image/jpeg",
                  data: base64Data
                }
              },
              {
                text: "Bu fatura veya liste fotoğrafındaki ürünleri ve yanlarındaki adetleri dikkatlice oku. Sadece şu JSON formatında cevap ver, başka hiçbir açıklama veya metin ekleme: [{\"name\": \"Ürün Adı\", \"qty\": 2}]"
              }
            ]
          }
        ]
      })
    });

    const data = await geminiRes.json();
    
    if (!geminiRes.ok || !data.candidates || data.candidates.length === 0) {
      console.error('Gemini API Detaylı Hata:', JSON.stringify(data));
      const errorMsg = data.error?.message || 'Bilinmeyen Gemini API hatası';
      return res.status(500).json({ success: false, error: `Gemini Hatası: ${errorMsg}` });
    }

    let rawText = data.candidates[0].content.parts[0].text;
    rawText = rawText.replace(/```json/g, '').replace(/```/g, '').trim();
    
    const items = JSON.parse(rawText);

    return res.status(200).json({ success: true, items });
  } catch (error) {
    console.error('Sunucu İç Hatası:', error);
    return res.status(500).json({ success: false, error: 'Sunucu hatası: ' + error.message });
  }
}
