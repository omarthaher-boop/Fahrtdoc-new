import * as FileSystem from 'expo-file-system/legacy';
import Constants from 'expo-constants';
import type { ExpenseCategory } from '@/types/expense';

export interface AnalysisResult {
  merchant: string;
  amount: number;
  date: string;
  category: ExpenseCategory;
  description: string;
  confidence: {
    merchant: number;
    amount: number;
    date: number;
    category: number;
  };
}

const emptyFallback = (): AnalysisResult => ({
  merchant: '',
  amount: 0,
  date: new Date().toISOString().split('T')[0],
  category: 'sonstiges',
  description: '',
  confidence: { merchant: 0, amount: 0, date: 0, category: 0 },
});

function getApiKey(): string {
  return (
    process.env.EXPO_PUBLIC_ANTHROPIC_API_KEY ??
    (Constants.expoConfig?.extra as { anthropicApiKey?: string } | undefined)?.anthropicApiKey ??
    ''
  );
}

export async function analyzeReceipt(imageUri: string): Promise<AnalysisResult> {
  const apiKey = getApiKey();

  if (!apiKey) {
    console.error('❌ ANTHROPIC API KEY fehlt! Setze EXPO_PUBLIC_ANTHROPIC_API_KEY.');
    return emptyFallback();
  }

  console.log('🔍 Starte Beleganalyse...');
  console.log('📍 Image URI:', imageUri.slice(0, 60));

  let base64: string;
  try {
    base64 = await FileSystem.readAsStringAsync(imageUri, {
      encoding: FileSystem.EncodingType.Base64,
    });
    console.log('📄 Base64 Länge:', base64.length);
  } catch (err) {
    console.error('❌ Bild konnte nicht gelesen werden:', err);
    return emptyFallback();
  }

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 1024,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'image',
                source: { type: 'base64', media_type: 'image/jpeg', data: base64 },
              },
              {
                type: 'text',
                text: `Analysiere diesen Kassenbon/Beleg und extrahiere folgende Informationen als JSON.
Antworte NUR mit validem JSON, kein weiterer Text, keine Markdown-Backticks:
{
  "merchant": "Name des Händlers oder Unternehmens",
  "amount": 0.00,
  "date": "YYYY-MM-DD",
  "category": "kraftstoff|wartung|parkgebuehr|sonstiges",
  "description": "kurze Beschreibung (max 60 Zeichen)",
  "confidence": {
    "merchant": 0,
    "amount": 0,
    "date": 0,
    "category": 0
  }
}
Kategorieregeln:
- "kraftstoff" wenn Tankstelle, Benzin, Diesel, Strom (Laden), LPG
- "wartung" wenn Werkstatt, Reparatur, Ölwechsel, TÜV, Reifenwechsel, Service
- "parkgebuehr" wenn Parkhaus, Parkplatz, Parkuhr, Vignette
- "sonstiges" für alles andere (Versicherung, Steuer, Zubehör)
Falls ein Feld nicht erkennbar ist, verwende sinnvolle Standardwerte.`,
              },
            ],
          },
        ],
      }),
    });

    console.log('📡 API Response Status:', response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ API Fehler:', response.status, errorText);
      return emptyFallback();
    }

    const data = (await response.json()) as { content?: { text?: string }[] };
    const text = data.content?.[0]?.text ?? '';
    console.log('📝 Rohantwort:', text.slice(0, 200));

    const clean = text.replace(/```json/g, '').replace(/```/g, '').trim();
    const parsed = JSON.parse(clean) as AnalysisResult;
    console.log('✅ Erfolgreich geparst — Betrag:', parsed.amount, '| Kategorie:', parsed.category);
    return parsed;

  } catch (err) {
    console.error('❌ Analyse fehlgeschlagen:', err);
    return emptyFallback();
  }
}
