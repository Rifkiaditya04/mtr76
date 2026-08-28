const RECEIPT_PRINT_STYLE_ID = 'mataram76-print-receipt-styles';

const nativeDocumentWrite = Document.prototype.write;
const nativeAppendChild = Node.prototype.appendChild;

function injectReceiptPrintStyles(doc: Document): void {
  if (!doc.querySelector('.receipt')) return;
  if (doc.getElementById(RECEIPT_PRINT_STYLE_ID)) return;

  const style = doc.createElement('style');
  style.id = RECEIPT_PRINT_STYLE_ID;
  style.textContent = `
    /* Hanya berlaku pada dokumen nota yang benar-benar dicetak. Layar aplikasi tidak terpengaruh. */
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

    /* Jalur ReceiptContent pada Ctrl+P/modal. */
    .receipt-thermal {
      font-size: 13.5px !important;
      line-height: 1.22 !important;
      font-weight: 700 !important;
    }
    .receipt-thermal .text-\\[10px\\] { font-size: 13px !important; }
    .receipt-thermal .text-\\[9px\\] { font-size: 11px !important; }
    .receipt-thermal .text-xs { font-size: 13.5px !important; }
    .receipt-thermal .text-lg { font-size: 21px !important; }
    .receipt-thermal .text-2xl { font-size: 26px !important; }
  `;

  (doc.head || doc.documentElement).appendChild(style);
}

function tryInjectIntoIframe(frame: HTMLIFrameElement): void {
  try {
    const doc = frame.contentDocument;
    if (doc) injectReceiptPrintStyles(doc);
  } catch (error) {
    console.warn('Mataram76 iframe print style injection failed:', error);
  }
}

// PrintReceiptDirectly membuat iframe tersembunyi. Document.prototype.write milik
// parent window tidak berlaku pada Document milik iframe, sehingga kita juga
// menangkap event load iframe dan menyuntikkan style langsung ke dokumen print.
Node.prototype.appendChild = function patchedAppendChild<T extends Node>(this: Node, child: T): T {
  const result = nativeAppendChild.call(this, child);

  if (child instanceof HTMLIFrameElement) {
    child.addEventListener('load', () => tryInjectIntoIframe(child), { passive: true });
    setTimeout(() => tryInjectIntoIframe(child), 0);
  }

  return result;
};

Document.prototype.write = function patchedDocumentWrite(this: Document, ...args: string[]): void {
  nativeDocumentWrite.apply(this, args);
  try {
    const isReceiptPrint = args.some(
      (html) => typeof html === 'string' &&
        (html.includes('class="receipt"') || html.includes('class="receipt-page"'))
    );
    if (isReceiptPrint) injectReceiptPrintStyles(this);
  } catch (error) {
    console.warn('Mataram76 print style injection failed:', error);
  }
};
