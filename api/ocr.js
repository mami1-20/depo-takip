import { GoogleGenAI } from '@google/genai';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { imageBase64 } = req.body;
    if (!imageBase64) {
      return res.status(400).json({ error: 'Fotoğraf gönderilmedi.' });
    }

    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, '');

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [
        {
          inlineData: {
            data: base64Data,
            mimeType: 'image/jpeg'
          }
        },
        {
          text: "Bu fatura veya satış listesi fotoğrafındaki ürünleri ve yanlarındaki adetleri (miktarları) dikkatlice oku. Sadece şu JSON formatında cevap ver ve başka hiçbir açıklama yazma: [{\"name\": \"Ürün Adı\", \"qty\": 2}]"
        }
      ]
    });

    let rawText = response.text.trim();
    rawText = rawText.replace(/```json/g, '').replace(/```/g, '').trim();
    
    const items = JSON.parse(rawText);

    return res.status(200).json({ success: true, items });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Gemini OCR hatası: ' + error.message });
  }
}
