import { handleCors } from '../_shared/cors.ts';
import { getServiceClient } from '../_shared/supabase.ts';
import { jsonResponse, errorResponse } from '../_shared/response.ts';
import { checkRateLimit } from '../_shared/rate-limit.ts';

// ---------------------------------------------------------------------------
// Prompt Gemini per estrazione dati scontrino
// ---------------------------------------------------------------------------
const GEMINI_PROMPT = `Sei un sistema di estrazione dati da scontrini e ricevute fiscali italiane.
Analizza l'immagine allegata ed estrai i dati richiesti.

REGOLE FONDAMENTALI:
1. Restituisci ESCLUSIVAMENTE un oggetto JSON valido, senza markdown, senza commenti, senza testo aggiuntivo, senza wrapper \`\`\`json.
2. Se un campo non è leggibile o non presente, usa null per i numeri e stringa vuota "" per i testi.
3. NON inventare mai dati. Se non sei sicuro, metti null e confidence bassa.
4. Se l'immagine non è uno scontrino/ricevuta, imposta document_type su "non_ricevuta" e tutti gli altri campi a null/vuoto.
5. Data in formato YYYY-MM-DD, ora in formato HH:MM.
6. Importi numerici puliti (es. 12.50, non "€12,50"). Converti virgola decimale italiana in punto.
7. Valuta come codice ISO a 3 lettere (EUR, USD, ecc.).
8. Per il campo confidence, assegna un valore da 0.0 a 1.0 per ogni campo chiave.

Schema JSON richiesto:
{
  "receipt_date": "YYYY-MM-DD o stringa vuota",
  "receipt_time": "HH:MM o stringa vuota",
  "vendor_name": "nome esercizio commerciale",
  "vendor_vat_number": "P.IVA se visibile",
  "total_amount": 0.00,
  "currency": "EUR",
  "vat_amount": 0.00,
  "document_type": "scontrino|ricevuta_fiscale|fattura|nota_credito|non_ricevuta|altro",
  "receipt_number": "numero documento se presente",
  "payment_method": "contanti|carta_credito|carta_debito|bancomat|satispay|altro|stringa vuota",
  "items": [
    {
      "description": "nome articolo/servizio",
      "quantity": 1,
      "unit_price": 0.00,
      "total": 0.00
    }
  ],
  "raw_text": "trascrizione completa del testo visibile sullo scontrino",
  "confidence": {
    "receipt_date": 0.0,
    "receipt_time": 0.0,
    "vendor_name": 0.0,
    "total_amount": 0.0,
    "items": 0.0
  }
}`;

// ---------------------------------------------------------------------------
// Helper: parse robusto JSON dalla risposta Gemini
// ---------------------------------------------------------------------------
function parseGeminiJson(rawText: string): unknown {
  // Tentativo 1: parse diretto
  try {
    return JSON.parse(rawText);
  } catch { /* continua */ }

  // Tentativo 2: estrai da wrapper markdown ```json ... ```
  const jsonMatch = rawText.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (jsonMatch) {
    return JSON.parse(jsonMatch[1].trim());
  }

  // Tentativo 3: cerca primo { ... } nella stringa
  const braceMatch = rawText.match(/\{[\s\S]*\}/);
  if (braceMatch) {
    return JSON.parse(braceMatch[0]);
  }

  throw new Error('Nessun JSON trovato nella risposta Gemini');
}

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------
Deno.serve(async (req: Request) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  const allowed = await checkRateLimit(req, 'analyze-receipt');
  if (!allowed) {
    return errorResponse(req, 'Troppe richieste. Attendi un minuto e riprova', 429, 'RATE_LIMIT_EXCEEDED');
  }

  try {
    const body = await req.json();
    const { image_path } = body;

    if (!image_path || typeof image_path !== 'string') {
      return errorResponse(req, 'image_path mancante o non valido', 400, 'IMAGE_PATH_MISSING');
    }

    // 1. Scarica immagine da Storage
    const supabase = getServiceClient();
    const { data: fileData, error: downloadError } = await supabase.storage
      .from('receipts-images')
      .download(image_path);

    if (downloadError || !fileData) {
      console.error('Download error:', downloadError);
      return errorResponse(req, 'Immagine non trovata', 404, 'IMAGE_NOT_FOUND');
    }

    // 2. Converti in base64
    const arrayBuffer = await fileData.arrayBuffer();
    const uint8 = new Uint8Array(arrayBuffer);

    // Chunk base64 per evitare stack overflow su immagini grandi
    let base64 = '';
    const chunkSize = 0x8000;
    for (let i = 0; i < uint8.length; i += chunkSize) {
      base64 += String.fromCharCode(...uint8.subarray(i, i + chunkSize));
    }
    base64 = btoa(base64);

    // Determina MIME type dal path
    const mimeType = image_path.endsWith('.png')
      ? 'image/png'
      : image_path.endsWith('.webp')
      ? 'image/webp'
      : 'image/jpeg';

    // 3. Chiama Gemini
    let geminiModel = Deno.env.get('GEMINI_MODEL') || 'gemini-flash-latest';
    if (geminiModel === 'gemini-2.5-flash' || geminiModel === 'gemini-1.5-flash') {
      geminiModel = 'gemini-flash-latest';
    }
    const geminiApiKey = Deno.env.get('GEMINI_API_KEY');

    if (!geminiApiKey) {
      console.error('GEMINI_API_KEY non configurata');
      return errorResponse(req, 'Configurazione AI mancante', 500, 'GEMINI_NOT_CONFIGURED');
    }

    const cleanGeminiUrl = "https://generativelanguage.googleapis.com/v1beta/models/" + geminiModel + ":generateContent?key=" + geminiApiKey;

    const geminiResponse = await fetch(cleanGeminiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              { text: GEMINI_PROMPT },
              {
                inline_data: {
                  mime_type: mimeType,
                  data: base64,
                },
              },
            ],
          },
        ],
        generationConfig: {
          temperature: 0.1, // bassa per estrazione precisa
          maxOutputTokens: 4096,
          responseMimeType: 'application/json',
        },
      }),
      signal: AbortSignal.timeout(30_000), // timeout 30 secondi
    });

    if (!geminiResponse.ok) {
      const errText = await geminiResponse.text();
      console.error('Gemini API error:', geminiResponse.status, errText);
      return errorResponse(req, "Errore durante l'analisi AI", 502, 'GEMINI_ERROR');
    }

    const geminiResult = await geminiResponse.json();

    // 4. Estrai e valida JSON dalla risposta
    let extractedData: Record<string, unknown>;
    try {
      const rawText = geminiResult.candidates?.[0]?.content?.parts?.[0]?.text || '';
      extractedData = parseGeminiJson(rawText) as Record<string, unknown>;
    } catch (parseError) {
      console.error('JSON parse error:', parseError);
      console.error('Raw Gemini response:', JSON.stringify(geminiResult));
      return errorResponse(
        req,
        'Impossibile leggere i dati dallo scontrino. Riprova con una foto più nitida',
        422,
        'JSON_PARSE_ERROR',
      );
    }

    // 5. Validazione struttura minima — assicura campi chiave esistano
    const requiredFields = ['receipt_date', 'vendor_name', 'total_amount', 'document_type'];
    for (const field of requiredFields) {
      if (!(field in extractedData)) {
        extractedData[field] = null;
      }
    }

    if (!extractedData.confidence || typeof extractedData.confidence !== 'object') {
      extractedData.confidence = {};
    }

    if (!Array.isArray(extractedData.items)) {
      extractedData.items = [];
    }

    // 6. Aggiungi raw response per debug (verrà salvato in raw_ai_response)
    extractedData._raw_ai_response = geminiResult;

    console.log(`Analyzed: ${image_path}, doc_type: ${extractedData.document_type}`);

    return jsonResponse(req, extractedData);
  } catch (err: unknown) {
    console.error('analyze-receipt error:', err);

    const error = err as { name?: string };
    if (error.name === 'TimeoutError' || error.name === 'AbortError') {
      return errorResponse(req, "L'analisi ha impiegato troppo tempo. Riprova", 504, 'GEMINI_TIMEOUT');
    }

    return errorResponse(req, 'Errore interno del server', 500, 'INTERNAL_ERROR');
  }
});
