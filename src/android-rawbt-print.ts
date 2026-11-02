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

function money(value: unknown): string {
  return Number(value || 0).toLocaleString('id-ID');
}

function makeCanvas(): { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D } {
  const canvas = document.createElement('canvas');
  canvas.width = PAPER_DOTS;
  canvas.height = 1;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('Canvas 2D tidak tersedia pada browser ini.');
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#000';
  ctx.textBaseline = 'top';
  return { canvas, ctx };
}

function renderReceipt(receipt: ReceiptData, variant: 'pengirim' | 'penerima' | 'internal'): HTMLCanvasElement {
  const { canvas, ctx } = makeCanvas();
  let y = 22;

  const setFont = (size: number, weight = 700) => {
    ctx.font = `${weight} ${size}px monospace`;
  };

  const center = (text: string, size = 24, weight = 700, gap = 7) => {
    setFont(size, weight);
    const lines = wrapText(ctx, text, CONTENT_WIDTH);
    for (const line of lines) {
      ctx.fillText(line, Math.max(LEFT, (PAPER_DOTS - ctx.measureText(line).width) / 2), y);
      y += size + gap;
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

  const textBlock = (text: string, size = 23, weight = 700, gap = 5) => {
    setFont(size, weight);
    for (const line of wrapText(ctx, text, CONTENT_WIDTH)) {
      ctx.fillText(line, LEFT, y);
      y += size + gap;
    }
  };

  const row = (label: string, value: unknown) => {
    const content = `${label} ${String(value ?? '-')}`;
    textBlock(content, 22, 700, 5);
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
  center('Jl. MT Haryono 76 Semarang', 18, 700, 3);
  center('Telp. (024) 3549652 | WA: 08179175780', 18, 700, 5);
  rule(10);

  textBlock(`RESI: ${receipt.id || '-'}`, 23, 900, 5);
  textBlock(`Tgl: ${receipt.date || '-'}   Waktu: ${receipt.time || '-'}`, 19, 700, 5);
  center(String(receipt.destinationCity || '-').toUpperCase(), 28, 900, 5);
  rule(12);

  const senderContact = variant === 'penerima'
    ? receipt.senderName
    : `${receipt.senderName || '-'} (${receipt.senderPhone || '-'})`;
  row('PENGIRIM:', senderContact);
  if (receipt.senderAddress) row('Alamat pengirim:', receipt.senderAddress);
  row('PENERIMA:', `${receipt.receiverName || '-'} (${receipt.receiverPhone || '-'})`);
  row('Alamat penerima:', receipt.receiverAddress || '-');
  sectionEnd();

  row('Tujuan:', receipt.destinationCity || '-');
  row('Layanan:', receipt.serviceType || '-');
  if (receipt.weight || receipt.length) {
    row('Fisik:', `${receipt.weight ? `${receipt.weight}kg` : ''} ${receipt.length ? `(${receipt.length}x${receipt.width}x${receipt.height}cm)` : ''}`);
  }
  row('Colli:', receipt.colli ?? 1);
  sectionEnd();

  const shippingCost = Number(receipt.shippingCost) || 0;
  const calo = Number(receipt.calo) || 0;
  const st = Number(receipt.st) || 0;
  const internalNet = shippingCost - calo;
  const netIncome = internalNet - st;

  if (variant === 'pengirim') {
    center(`TOTAL ONGKIR: Rp ${money(shippingCost)}`, 25, 900, 5);
  } else if (variant === 'penerima') {
    textBlock('Tanda tangan penerima:', 20, 700, 5);
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
    textBlock(`Pendapatan Bersih: Rp ${money(netIncome)}`, 23, 900, 5);
  }

  rule(12);
  center('Jika dalam waktu 7 hari tidak ada pengaduan', 17, 700, 3);
  center('dan pengirim, dianggap telah diterima', 17, 700, 3);
  center('dengan baik/betul.', 17, 700, 3);

  y += 18;
  canvas.height = Math.max(1, Math.ceil(y));
  // Resizing canvas clears its drawing context, so redraw using an offscreen copy.
  const finalCanvas = document.createElement('canvas');
  finalCanvas.width = PAPER_DOTS;
  finalCanvas.height = canvas.height;
  const finalCtx = finalCanvas.getContext('2d');
  if (!finalCtx) throw new Error('Canvas 2D tidak tersedia.');
  finalCtx.fillStyle = '#fff';
  finalCtx.fillRect(0, 0, PAPER_DOTS, finalCanvas.height);
  finalCtx.drawImage(canvas, 0, 0);
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
 * Returns false outside Android. On Android, launches the installed RawBT app.
 * The payload is one print job containing the three note variants in sequence.
 */
export function printReceiptViaRawBt(receipt: ReceiptData): boolean {
  if (!isAndroid()) return false;

  try {
    const bytes: number[] = [0x1b, 0x40]; // ESC @ initialize printer
    const variants = ['pengirim', 'penerima', 'internal'] as const;
    variants.forEach((variant, index) => {
      appendRasterCommand(bytes, renderReceipt(receipt, variant));
      if (index < variants.length - 1) bytes.push(0x1b, 0x64, 0x04); // feed 4 lines between notes
    });
    bytes.push(0x1b, 0x64, 0x04); // final feed; no cutter command is assumed

    const payload = toBase64(bytes);
    const fallback = encodeURIComponent(window.location.href);
    const intentUrl = `intent:base64,${payload}#Intent;scheme=rawbt;package=ru.a402d.rawbtprinter;S.browser_fallback_url=${fallback};end;`;
    window.location.href = intentUrl;
    return true;
  } catch (error) {
    console.error('RawBT direct print failed:', error);
    return false;
  }
}
