/**
 * Android-only RawBT direct print transport.
 *
 * This module is intentionally isolated from the browser/desktop print renderer.
 * It rasterizes receipt text to ESC/POS GS v 0 images and launches RawBT via its
 * documented Android intent URI. It does not touch Firebase or the desktop path.
 */
type ReceiptData = Record<string, any>;

const PAPER_DOTS = 576; // Common 80 mm / 203 dpi ESC/POS print width.
const LEFT = 24;
const RIGHT = 24;
const CONTENT_WIDTH = PAPER_DOTS - LEFT - RIGHT;
const INK_THRESHOLD = 180;

function isAndroid(): boolean {
  return /Android/i.test(navigator.userAgent);
}


function numberToIndonesianWords(value: unknown): string {
  const number = Math.floor(Number(value));
  if (!Number.isFinite(number) || number < 0) return 'nol';
  if (number === 0) return 'nol';
  const units = ['', 'satu', 'dua', 'tiga', 'empat', 'lima', 'enam', 'tujuh', 'delapan', 'sembilan'];
  const spell = (n: number): string => {
    if (n < 10) return units[n];
    if (n === 10) return 'sepuluh';
    if (n === 11) return 'sebelas';
    if (n < 20) return `${units[n - 10]} belas`;
    if (n < 100) return `${units[Math.floor(n / 10)]} puluh${n % 10 ? ` ${spell(n % 10)}` : ''}`;
    if (n < 200) return `seratus${n % 100 ? ` ${spell(n % 100)}` : ''}`;
    if (n < 1000) return `${units[Math.floor(n / 100)]} ratus${n % 100 ? ` ${spell(n % 100)}` : ''}`;
    if (n < 2000) return `seribu${n % 1000 ? ` ${spell(n % 1000)}` : ''}`;
    if (n < 1000000) return `${spell(Math.floor(n / 1000))} ribu${n % 1000 ? ` ${spell(n % 1000)}` : ''}`;
    if (n < 1000000000) return `${spell(Math.floor(n / 1000000))} juta${n % 1000000 ? ` ${spell(n % 1000000)}` : ''}`;
    if (n < 1000000000000) return `${spell(Math.floor(n / 1000000000))} miliar${n % 1000000000 ? ` ${spell(n % 1000000000)}` : ''}`;
    return `${spell(Math.floor(n / 1000000000000))} triliun${n % 1000000000000 ? ` ${spell(n % 1000000000000)}` : ''}`;
  };
  return spell(number);
}
function formatColli(value: unknown): string {
  const number = Math.floor(Number(value ?? 1));
  const safeNumber = Number.isFinite(number) && number >= 0 ? number : 1;
  return `${safeNumber} (${numberToIndonesianWords(safeNumber)})`;
}

function money(value: unknown): string {
  return Number(value || 0).toLocaleString('id-ID');
}

function makeCanvas(): { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D } {
  const canvas = document.createElement('canvas');
  canvas.width = PAPER_DOTS;
  canvas.height = 4096;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('Canvas 2D tidak tersedia pada browser ini.');
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#000';
  ctx.textBaseline = 'alphabetic';
  return { canvas, ctx };
}

function renderReceipt(receipt: ReceiptData, variant: 'pengirim' | 'penerima' | 'internal'): HTMLCanvasElement {
  const { canvas, ctx } = makeCanvas();
  let y = 22;

  // Perbesar tipografi umum secara bertahap untuk keterbacaan (+18%).
  // Ukuran nama kota diatur terpisah agar tetap sekitar 2x ukuran sebelumnya.
  const setFont = (size: number, weight = 700, scale = 1.18) => {
    ctx.font = `${weight} ${size * scale}px monospace`;
  };

  const center = (text: string, size = 24, weight = 400, gap = 7) => {
    setFont(size, weight);
    const lines = wrapText(ctx, text, CONTENT_WIDTH);
    for (const line of lines) {
      const metrics = ctx.measureText(line);
      const ascent = metrics.actualBoundingBoxAscent || size * 0.8;
      const descent = metrics.actualBoundingBoxDescent || size * 0.2;
      const lineHeight = Math.max(size + 4, ascent + descent + 4);
      ctx.fillText(line, Math.max(LEFT, (PAPER_DOTS - metrics.width) / 2), y + ascent);
      y += lineHeight + gap;
    }
  };

  const rule = (gap = 12) => {
    y += 3;
    ctx.fillRect(LEFT, y, CONTENT_WIDTH, 2);
    y += gap;
  };

  const wrapText = (context: CanvasRenderingContext2D, text: string, maxWidth: number): string[] => {
    const words = String(text ?? '').split(/\s+/).filter(Boolean);
    if (!words.length) return [''];
    const lines: string[] = [];
    let line = '';
    for (const word of words) {
      const candidate = line ? `${line} ${word}` : word;
      if (context.measureText(candidate).width <= maxWidth || !line) {
        line = candidate;
      } else {
        lines.push(line);
        line = word;
      }
    }
    if (line) lines.push(line);
    return lines;
  };

  const textBlock = (text: string, size = 23, weight = 400, gap = 5) => {
    setFont(size, weight);
    for (const line of wrapText(ctx, text, CONTENT_WIDTH)) {
      const metrics = ctx.measureText(line);
      const ascent = metrics.actualBoundingBoxAscent || size * 0.8;
      const descent = metrics.actualBoundingBoxDescent || size * 0.2;
      const lineHeight = Math.max(size + 4, ascent + descent + 4);
      ctx.fillText(line, LEFT, y + ascent);
      y += lineHeight + gap;
    }
  };

  const boxedCity = (value: unknown) => {
    const city = String(value ?? '-').toUpperCase();
    const fontSize = 56; // 2x ukuran nama kota sebelumnya (28px).
    const horizontalPadding = 18;
    const verticalPadding = 10;
    const borderWidth = 3;
    const maxTextWidth = CONTENT_WIDTH - (horizontalPadding + borderWidth) * 2;

    setFont(fontSize, 900, 1);
    let metrics = ctx.measureText(city);

    // Nama kota panjang tetap dibatasi pada area cetak, tanpa memotong teks.
    if (metrics.width > maxTextWidth) {
      const fittedSize = Math.max(18, fontSize * (maxTextWidth / metrics.width));
      setFont(fittedSize, 900, 1);
      metrics = ctx.measureText(city);
    }

    const ascent = metrics.actualBoundingBoxAscent || fontSize * 0.8;
    const descent = metrics.actualBoundingBoxDescent || fontSize * 0.2;
    const boxWidth = Math.min(
      CONTENT_WIDTH,
      Math.ceil(metrics.width + (horizontalPadding + borderWidth) * 2)
    );
    const boxHeight = Math.ceil(ascent + descent + verticalPadding * 2 + borderWidth * 2);
    const boxX = (PAPER_DOTS - boxWidth) / 2;

    ctx.lineWidth = borderWidth;
    ctx.strokeRect(
      boxX + borderWidth / 2,
      y + borderWidth / 2,
      boxWidth - borderWidth,
      boxHeight - borderWidth
    );
    ctx.fillText(city, (PAPER_DOTS - metrics.width) / 2, y + borderWidth + verticalPadding + ascent);
    y += boxHeight + 10;
  };

  const row = (label: string, value: unknown, boldLabel = true) => {
    const labelText = `${label} `;
    const valueText = String(value ?? '-');
    setFont(22, boldLabel ? 700 : 400);
    const labelWidth = ctx.measureText(labelText).width;
    setFont(22, 400);
    const words = valueText.split(/\\s+/).filter(Boolean);
    const lines: string[] = [];
    let line = '';
    for (const word of words) {
      const candidate = line ? `${line} ${word}` : word;
      const maxWidth = lines.length === 0 ? Math.max(40, CONTENT_WIDTH - labelWidth) : CONTENT_WIDTH;
      if (ctx.measureText(candidate).width <= maxWidth || !line) line = candidate;
      else { lines.push(line); line = word; }
    }
    if (line) lines.push(line);
    if (!lines.length) lines.push('-');
    for (let index = 0; index < lines.length; index += 1) {
      setFont(22, 400);
      const metrics = ctx.measureText(lines[index]);
      const ascent = metrics.actualBoundingBoxAscent || 22 * 0.8;
      const descent = metrics.actualBoundingBoxDescent || 22 * 0.2;
      const lineHeight = Math.max(22 + 4, ascent + descent + 4);
      if (index === 0) {
        setFont(22, boldLabel ? 700 : 400);
        ctx.fillText(labelText, LEFT, y + ascent);
        setFont(22, 400);
        ctx.fillText(lines[index], LEFT + labelWidth, y + ascent);
      } else ctx.fillText(lines[index], LEFT, y + ascent);
      y += lineHeight + 5;
    }
  };

  const sectionEnd = () => {
    y += 5;
    rule(13);
  };

  const titles = {
    pengirim: 'NOTA PENGIRIM',
    penerima: 'NOTA PENERIMA',
    internal: 'NOTA INTERNAL / ARSIP'
  };

  center(titles[variant], 22, 700, 5);
  center('MATARAM76', 34, 900, 3);
  center('agen pengangkutan paket cepat', 20, 700, 3);
  center('Jl. MT Haryono 76 Semarang', 18, 400, 3);
  center('Telp. (024) 3549652 | WA: 08179175780', 18, 400, 5);
  rule(10);

  textBlock(`RESI: ${receipt.id || '-'}`, 23, 900, 5);
  row('Tgl:', receipt.date || '-', true);
  row('Waktu:', receipt.time || '-', true);
  boxedCity(receipt.destinationCity || '-');
  rule(12);

  const senderContact = variant === 'penerima'
    ? receipt.senderName
    : `${receipt.senderName || '-'} (${receipt.senderPhone || '-'})`;
  textBlock('PENGIRIM', 22, 900, 3);
  textBlock(senderContact, 22, 400, 5);
  if (receipt.senderAddress) {
    textBlock('ALAMAT PENGIRIM', 22, 900, 3);
    textBlock(receipt.senderAddress, 22, 400, 5);
  }
  y += 12; // Satu baris kosong sebagai pemisah pengirim dan penerima.
  textBlock('PENERIMA', 22, 900, 3);
  textBlock(`${receipt.receiverName || '-'} (${receipt.receiverPhone || '-'})`, 22, 400, 5);
  textBlock('ALAMAT PENERIMA', 22, 900, 3);
  textBlock(receipt.receiverAddress || '-', 22, 400, 5);
  sectionEnd();

  row('Tujuan:', receipt.destinationCity || '-');
  row('Layanan:', receipt.serviceType || '-');
  if (receipt.weight || receipt.length) {
    row('Fisik:', `${receipt.weight ? `${receipt.weight}kg` : ''} ${receipt.length ? `(${receipt.length}x${receipt.width}x${receipt.height}cm)` : ''}`);
  }
  row('Colli:', formatColli(receipt.colli ?? 1));
  sectionEnd();

  const shippingCost = Number(receipt.shippingCost) || 0;
  const calo = Number(receipt.calo) || 0;
  const st = Number(receipt.st) || 0;
  const internalNet = shippingCost - calo;
  const netIncome = internalNet - st;

  if (variant === 'pengirim') {
    center(`TOTAL ONGKIR: Rp ${money(shippingCost)}`, 25, 900, 5);
  } else if (variant === 'penerima') {
    textBlock('Tanda tangan penerima:', 20, 400, 5);
    y += 110;
    rule(10);
  } else {
    row('Ongkir:', `Rp ${money(shippingCost)}`);
    if (calo > 0) row('Calo:', `- Rp ${money(calo)}`);
    row('LB:', receipt.lb || '-');
    rule(8);
    row('HASIL:', `Rp ${money(internalNet)}`);
    row('ST:', `Rp ${money(st)}`);
    row('Sopir:', receipt.sopir || '-');
    rule(8);
    textBlock(`Pendapatan Bersih: Rp ${money(netIncome)}`, 23, 400, 5);
  }

  rule(12);
  center('Jika dalam waktu 7 hari tidak ada pengaduan', 17, 400, 3);
  center('dan pengirim, dianggap telah diterima', 17, 400, 3);
  center('dengan baik/betul.', 17, 400, 3);

  y += 18;
  // Crop to the actual rendered content; do not transmit the 4096px work canvas.
  const contentHeight = Math.max(1, Math.ceil(y + 8));
  if (contentHeight > canvas.height) {
    throw new Error('Nota melebihi batas area raster sementara.');
  }
  const finalCanvas = document.createElement('canvas');
  finalCanvas.width = PAPER_DOTS;
  finalCanvas.height = contentHeight;
  const finalCtx = finalCanvas.getContext('2d');
  if (!finalCtx) throw new Error('Canvas 2D tidak tersedia.');
  finalCtx.drawImage(canvas, 0, 0, PAPER_DOTS, contentHeight, 0, 0, PAPER_DOTS, contentHeight);
  return finalCanvas;
}

function appendRasterCommand(output: number[], canvas: HTMLCanvasElement): void {
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('Gagal membaca raster nota.');
  const widthBytes = Math.ceil(canvas.width / 8);
  const height = canvas.height;
  const pixels = ctx.getImageData(0, 0, canvas.width, height).data;

  // GS v 0, mode 0: normal-density raster bit image.
  output.push(0x1d, 0x76, 0x30, 0x00);
  output.push(widthBytes & 0xff, (widthBytes >> 8) & 0xff);
  output.push(height & 0xff, (height >> 8) & 0xff);

  for (let row = 0; row < height; row += 1) {
    for (let byteColumn = 0; byteColumn < widthBytes; byteColumn += 1) {
      let packed = 0;
      for (let bit = 0; bit < 8; bit += 1) {
        const x = byteColumn * 8 + bit;
        if (x >= canvas.width) continue;
        const offset = (row * canvas.width + x) * 4;
        const luminance = (pixels[offset] * 299 + pixels[offset + 1] * 587 + pixels[offset + 2] * 114) / 1000;
        if (luminance < INK_THRESHOLD && pixels[offset + 3] > 127) packed |= (0x80 >> bit);
      }
      output.push(packed);
    }
  }
}

function toBase64(bytes: number[]): string {
  let binary = '';
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.slice(i, i + chunkSize));
  }
  return btoa(binary);
}

/**
 * Sends exactly one receipt variant to RawBT as one independent print job.
 * The caller owns the Android preview/decision sequence between variants.
 */
export function printReceiptViaRawBt(
  receipt: ReceiptData,
  variant: 'pengirim' | 'penerima' | 'internal'
): boolean {
  if (!isAndroid()) return false;

  try {
    const bytes: number[] = [0x1b, 0x40]; // ESC @ initialize printer
    appendRasterCommand(bytes, renderReceipt(receipt, variant));
    bytes.push(0x1b, 0x64, 0x04); // final feed; no cutter command is assumed

    const payload = toBase64(bytes);
    // Keep Android on the RawBT route; never fall back to browser print preview.
    const intentUrl = `intent:base64,${payload}#Intent;scheme=rawbt;package=ru.a402d.rawbtprinter;end;`;
    window.location.href = intentUrl;
    return true;
  } catch (error) {
    console.error('RawBT direct print failed:', error);
    window.alert(`Gagal menyiapkan nota untuk RawBT: ${error instanceof Error ? error.message : String(error)}`);
    return false;
  }
}
