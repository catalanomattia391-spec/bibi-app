// api/gemini.js
//
// Funzione serverless (Vercel) che fa da proxy sicuro verso Google Gemini.
// La chiave API vive SOLO qui, letta da una variabile d'ambiente lato
// server: non è MAI presente nel codice HTML/JS inviato al browser.
//
// CONFIGURAZIONE SU VERCEL:
// 1. Carica questo progetto (index.html + cartella api/) su Vercel.
// 2. Vai su Project Settings -> Environment Variables.
// 3. Aggiungi una variabile chiamata GEMINI_API_KEY con il valore
//    della tua chiave Gemini (quella che mi hai condiviso in chat:
//    NON va mai scritta qui nel codice, solo nel pannello Vercel).
// 4. Fai il redeploy del progetto: da quel momento /api/gemini
//    funziona automaticamente, senza altre modifiche.
//
// Se preferisci Netlify al posto di Vercel, la stessa logica va
// adattata al formato "exports.handler" delle Netlify Functions:
// la parte che chiama Gemini resta identica, cambia solo l'involucro.

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Metodo non consentito' });
    return;
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    res.status(500).json({ error: 'GEMINI_API_KEY non configurata sul server' });
    return;
  }

  const { systemInstruction, contents } = req.body || {};

  if (!Array.isArray(contents) || contents.length === 0) {
    res.status(400).json({ error: 'Richiesta non valida: contents mancante' });
    return;
  }

  try {
    const geminiRes = await fetch(
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=' + apiKey,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          systemInstruction: systemInstruction ? { parts: [{ text: systemInstruction }] } : undefined,
          contents: contents,
          generationConfig: {
            temperature: 0.9,
            maxOutputTokens: 500
          }
        })
      }
    );

    if (!geminiRes.ok) {
      const errText = await geminiRes.text();
      console.error('Errore API Gemini:', geminiRes.status, errText);
      res.status(502).json({ error: 'Errore dal servizio AI' });
      return;
    }

    const data = await geminiRes.json();
    const reply =
      data &&
      data.candidates &&
      data.candidates[0] &&
      data.candidates[0].content &&
      data.candidates[0].content.parts &&
      data.candidates[0].content.parts[0] &&
      data.candidates[0].content.parts[0].text;

    if (!reply) {
      res.status(502).json({ error: 'Risposta AI vuota' });
      return;
    }

    res.status(200).json({ reply: reply });
  } catch (err) {
    console.error('Errore proxy Gemini:', err);
    res.status(500).json({ error: 'Errore interno del server' });
  }
}
