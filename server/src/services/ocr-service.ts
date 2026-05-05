import Tesseract from 'tesseract.js';
import sharp from 'sharp';
import path from 'path';

export async function extractTextFromImage(imagePath: string) {
  try {
    // Resize image to max 1500px width before OCR
    const metadata = await sharp(imagePath).metadata();
    const width = metadata.width || 0;
    
    let resizedBuffer: Buffer;
    if (width > 1500) {
      resizedBuffer = await sharp(imagePath).resize({ width: 1500 }).toBuffer();
    } else {
      resizedBuffer = await sharp(imagePath).toBuffer();
    }

    // Run OCR
    const { data: { text, confidence } } = await Tesseract.recognize(
      resizedBuffer,
      'eng',
      { logger: () => {} } // Suppress logger output
    );

    const fullText = text;
    let extractedAmount: string | null = null;
    let extractedDate: string | null = null;
    let extractedMerchant: string | null = null;

    // Amount extraction
    const amountRegex = /(?:total|amount|grand total|net amount|to pay)[\s\S]{0,50}?(\$|₹|rs\.?|inr)?\s*([\d,]+\.?\d{0,2})/i;
    const amountMatch = fullText.match(amountRegex);
    if (amountMatch) {
      extractedAmount = `${amountMatch[1] || ''} ${amountMatch[2]}`.trim();
    }

    // Date extraction
    const dateRegex = /(?:date|dated)?[^\d]*(0?[1-9]|[12][0-9]|3[01])[\/\.\-\s](0?[1-9]|1[012]|[a-zA-Z]{3,9})[\/\.\-\s]((?:19|20)\d\d|\d\d)/i;
    const dateMatch = fullText.match(dateRegex);
    if (dateMatch) {
      extractedDate = `${dateMatch[1]}/${dateMatch[2]}/${dateMatch[3]}`; // keep simple formatting
    }

    // Merchant extraction
    const lines = fullText.split('\n').map((l: string) => l.trim()).filter((l: string) => l.length > 2);
    // Take the first capitalized line from the top 5 lines that looks like a business name
    for (let i = 0; i < Math.min(5, lines.length); i++) {
      const line = lines[i];
      if (line.length >= 3 && line.length <= 40 && /^[A-Z]/.test(line)) {
        extractedMerchant = line;
        break;
      }
    }

    return { 
      fullText, 
      extractedAmount, 
      extractedDate, 
      extractedMerchant, 
      confidence 
    };
  } catch (error) {
    console.error('OCR failed:', error);
    return { 
      fullText: null, 
      extractedAmount: null, 
      extractedDate: null, 
      extractedMerchant: null, 
      confidence: 0 
    };
  }
}
