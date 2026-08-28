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
      font-size: 13.5px !important;
      line-height: 1.22 !important;
      font-weight: 700 !important;
    }
    .label { font-size: 13px !important; font-weight: 700 !important; }
    .brand { font-size: 21px !important; font-weight: 900 !important; }
    .sub, .tiny { font-size: 11px !important; }
    .resi { font-size: 15px !important; font-weight: 700 !important; }
    .city { font-size: 26px !important; font-weight: 900 !important; }
    .row { font-size: 13px !important; line-height: 1.2 !important; }
    .bold { font-size: 13px !important; font-weight: 700 !important; }
    .total { font-size: 15px !important; font-weight: 700 !important; }
    .internal { font-size: 13px !important; line-height: 1.22 !important; }
    .result { font-size: 13.5px !important; font-weight: 700 !important; }
    .net { font-size: 14px !important; font-weight: 700 !important; }
    .footer { font-size: 9.5px !important; line-height: 1.15 !important; font-weight: 700 !important; }
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
