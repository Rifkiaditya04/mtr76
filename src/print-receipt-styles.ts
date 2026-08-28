const RECEIPT_PRINT_STYLE_ID = 'mataram76-print-receipt-styles';

const nativeDocumentWrite = Document.prototype.write;

function injectReceiptPrintStyles(doc: Document): void {
  if (!doc.querySelector('.receipt')) return;
  if (doc.getElementById(RECEIPT_PRINT_STYLE_ID)) return;

  const style = doc.createElement('style');
  style.id = RECEIPT_PRINT_STYLE_ID;
  style.textContent = `
    /* Override hanya untuk HTML nota yang dicetak melalui iframe. Layar aplikasi tidak terpengaruh. */
    .receipt {
      font-size: 13.5px !important;
      line-height: 1.22 !important;
      font-weight: 700 !important;
    }
    .label { font-size: 13px !important; font-weight: 700 !important; }
    .brand { font-size: 21px !important; font-weight: 900 !important; }
    .sub { font-size: 11px !important; }
    .tiny { font-size: 11px !important; }
    .resi { font-size: 15px !important; font-weight: 700 !important; }
    .city { font-size: 26px !important; font-weight: 900 !important; }
    .row { font-size: 13px !important; line-height: 1.2 !important; }
    .bold { font-size: 13.5px !important; font-weight: 700 !important; }
    .total { font-size: 15px !important; font-weight: 700 !important; }
    .internal { font-size: 13px !important; line-height: 1.22 !important; }
    .result { font-size: 13.5px !important; font-weight: 700 !important; }
    .net { font-size: 14px !important; font-weight: 700 !important; }
    .footer { font-size: 9.5px !important; line-height: 1.15 !important; font-weight: 700 !important; }

    /* Paksa ukuran pada elemen nota yang menggunakan class Tailwind langsung. */
    .receipt .text-\\[10px\\] { font-size: 13px !important; }
    .receipt .text-\\[9px\\] { font-size: 11px !important; }
    .receipt .text-xs { font-size: 13.5px !important; }
    .receipt .text-lg { font-size: 21px !important; }
    .receipt .text-2xl { font-size: 26px !important; }
  `;

  (doc.head || doc.documentElement).appendChild(style);
}

Document.prototype.write = function patchedDocumentWrite(this: Document, ...args: string[]): void {
  const isReceiptPrint = args.some(
    (html) => typeof html === 'string' &&
      (html.includes('class="receipt"') || html.includes('class="receipt-page"'))
  );

  nativeDocumentWrite.apply(this, args);

  try {
    if (isReceiptPrint) {
      injectReceiptPrintStyles(this);
    }
  } catch (error) {
    console.warn('Mataram76 print style injection failed:', error);
  }
};
