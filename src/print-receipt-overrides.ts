const nativeWindowPrint = Window.prototype.print;

const RECEIPT_PRINT_STYLE_ID = 'mataram76-receipt-print-overrides';

function applyReceiptPrintStyles(printWindow: Window): void {
  const doc = printWindow.document;
  const receipt = doc.querySelector<HTMLElement>('.receipt');
  const thermalReceipts = doc.querySelectorAll<HTMLElement>('.receipt-thermal');

  if (!receipt && thermalReceipts.length === 0) {
    return;
  }

  let style = doc.getElementById(RECEIPT_PRINT_STYLE_ID) as HTMLStyleElement | null;
  if (!style) {
    style = doc.createElement('style');
    style.id = RECEIPT_PRINT_STYLE_ID;
    doc.head.appendChild(style);
  }

  style.textContent = `
    /* Print-only typography: layar/aplikasi utama tidak terpengaruh. */
    html, body {
      color: #000 !important;
      background: #fff !important;
    }

    .receipt {
      font-size: 13.5px !important;
      line-height: 1.22 !important;
      font-weight: 700 !important;
    }
    .label {
      font-size: 13px !important;
      font-weight: 700 !important;
    }
    .brand {
      font-size: 21px !important;
      font-weight: 900 !important;
    }
    .sub {
      font-size: 11px !important;
    }
    .tiny {
      font-size: 11px !important;
    }
    .resi {
      font-size: 15px !important;
      font-weight: 700 !important;
    }
    .city {
      font-size: 26px !important;
      font-weight: 900 !important;
    }
    .row {
      font-size: 13px !important;
      line-height: 1.2 !important;
    }
    .bold {
      font-size: 13px !important;
      font-weight: 700 !important;
    }
    .total {
      font-size: 15px !important;
      font-weight: 700 !important;
    }
    .internal {
      font-size: 13px !important;
      line-height: 1.22 !important;
    }
    .result {
      font-size: 13.5px !important;
      font-weight: 700 !important;
    }
    .net {
      font-size: 14px !important;
      font-weight: 700 !important;
    }
    .footer {
      font-size: 9.5px !important;
      line-height: 1.15 !important;
      font-weight: 700 !important;
    }

    /* Jalur Ctrl+P dari modal lama: tetap 1 nota = 1 halaman. */
    .receipt-thermal {
      font-size: 13.5px !important;
      line-height: 1.22 !important;
      font-weight: 700 !important;
      page-break-after: always !important;
      break-after: page !important;
      page-break-inside: avoid !important;
      break-inside: avoid !important;
      min-height: 80mm !important;
    }
    .receipt-thermal .text-xs {
      font-size: 13px !important;
    }
    .receipt-thermal .text-lg {
      font-size: 21px !important;
    }
    .receipt-thermal .text-2xl {
      font-size: 26px !important;
    }
    .receipt-thermal .text-\[9px\] {
      font-size: 11px !important;
    }
    .receipt-thermal .text-\[10px\] {
      font-size: 13px !important;
    }
    .receipt-thermal .text-\[11px\] {
      font-size: 13.5px !important;
    }
  `;

  if (receipt) {
    const pxToMm = 25.4 / 96;
    const measuredHeightMm = receipt.getBoundingClientRect().height * pxToMm;

    let pageHeightMm = Math.min(
      80,
      Math.max(25, Math.ceil((measuredHeightMm + 0.6) * 10) / 10),
    );

    if (measuredHeightMm > 79) {
      const scale = Math.max(0.78, 79 / measuredHeightMm);
      receipt.style.fontSize = `${13.5 * scale}px`;
      pageHeightMm = Math.min(
        80,
        Math.max(
          25,
          Math.ceil((receipt.getBoundingClientRect().height * pxToMm + 0.6) * 10) / 10,
        ),
      );
    }

    style.textContent += `\n    @page { size: 80mm ${pageHeightMm}mm !important; margin: 0 !important; }\n  `;
  }
}

Window.prototype.print = function patchedMataram76Print(this: Window): void {
  try {
    applyReceiptPrintStyles(this);
  } catch (error) {
    console.warn('Mataram76 print style override failed:', error);
  }

  nativeWindowPrint.call(this);
};
