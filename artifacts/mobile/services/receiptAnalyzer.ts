// HINWEIS: EXPO_PUBLIC_ANTHROPIC_API_KEY in .env setzen für KI-Beleg-Analyse
import * as FileSystem from 'expo-file-system/legacy';
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

const fallbackResult = (): AnalysisResult => ({
  merchant: 'Unbekannt',
  amount: 0,
  date: new Date().toISOString().split('T')[0],
  category: 'sonstiges',
  description: 'Beleg konnte nicht analysiert werden',
  confidence: { merchant: 0, amount: 0, date: 0, category: 0 },
});

export async function analyzeReceipt(imageUri: string): Promise<AnalysisResult> {
  const apiKey = process.env.EXPO_PUBLIC_ANTHROPIC_API_KEY ?? '';
  if (!apiKey) return fallbackResult();

  let base64: string;
  try {
    base64 = await FileSystem.readAsStringAsync(imageUri, {
      encoding: FileSystem.EncodingType.Base64,
    });
  } catch {
    return fallbackResult();
  }

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-opus-4-5',
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
Antworte NUR mit validem JSON, kein weiterer Text:
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

  if (!response.ok) throw new Error('API-Fehler beim Analysieren des Belegs');

  const data = (await response.json()) as { content?: { text?: string }[] };
  const text = data.content?.[0]?.text ?? '{}';

  try {
    const clean = text.replace(/```json|```/g, '').trim();
    return JSON.parse(clean) as AnalysisResult;
  } catch {
    return fallbackResult();
  }
}
