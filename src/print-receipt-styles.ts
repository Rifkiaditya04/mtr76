const RECEIPT_PRINT_STYLE_ID = 'mataram76-print-receipt-styles';

const nativeDocumentWrite = Document.prototype.write;

function injectReceiptPrintStyles(doc: Document): void {
  if (!doc.querySelector('.receipt')) return;
  if (doc.getElementById(RECEIPT_PRINT_STYLE_ID)) return;

  const style = doc.createElement('style');
  style.id = RECEIPT_PRINT_STYLE_ID;
  style.textContent = `
    /* Hanya berlaku di dokumen iframe khusus cetak. Tampilan aplikasi tidak berubah. */
    .receipt {
      font-size: 13.5px;
      line-height: 1.22;
      font-weight: 700;
    }
    .label { font-size: 13px; font-weight: 700; }
    .brand { font-size: 21px; font-weight: 900; }
    .sub, .tiny { font-size: 11px; }
    .resi { font-size: 15px; font-weight: 700; }
    .city { font-size: 26px; font-weight: 900; }
    .row { font-size: 13px; line-height: 1.2; }
    .bold { font-size: 13px; font-weight: 700; }
    .total { font-size: 15px; font-weight: 700; }
    .internal { font-size: 13px; line-height: 1.22; }
    .result { font-size: 13.5px; font-weight: 700; }
    .net { font-size: 14px; font-weight: 700; }
    .footer { font-size: 9.5px; line-height: 1.15; font-weight: 700; }
  `;

  (doc.head || doc.documentElement).appendChild(style);
}

Document.prototype.write = function patchedDocumentWrite(this: Document, ...args: string[]): void {
  nativeDocumentWrite.apply(this, args);
  try {
    if (args.some((html) => typeof html === 'string' && html.includes('class=\"receipt\"'))) {
      injectReceiptPrintStyles(this);
    }
  } catch (error) {
    console.warn('Mataram76 print style injection failed:', error);
  }
};
