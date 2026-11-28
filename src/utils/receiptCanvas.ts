import { assetUrl, InvoiceRecord, rp } from '../data/ccnData';

function rr(
  x: CanvasRenderingContext2D,
  a: number,
  b: number,
  w: number,
  h: number,
  r: number
) {
  x.beginPath();
  x.moveTo(a + r, b);
  x.arcTo(a + w, b, a + w, b + h, r);
  x.arcTo(a + w, b + h, a, b + h, r);
  x.arcTo(a, b + h, a, b, r);
  x.arcTo(a, b, a + w, b, r);
  x.closePath();
}

function loadLogo(): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = assetUrl('/assets/ccn/logo.png');
  });
}

export async function renderReceiptCanvas(v: InvoiceRecord): Promise<HTMLCanvasElement> {
  const im = await loadLogo();
  const W = 900;
  const pad = 60;
  const SF = 'system-ui, sans-serif';
  const measurer = document.createElement('canvas').getContext('2d');

  function wrap(text: string, maxW: number, font: string): string[] {
    if (!measurer) return [text];
    measurer.font = font;
    const words = String(text).split(' ');
    const lines: string[] = [];
    let cur = '';
    words.forEach((w) => {
      const next = cur ? cur + ' ' + w : w;
      if (measurer.measureText(next).width > maxW && cur) {
        lines.push(cur);
        cur = w;
      } else {
        cur = next;
      }
    });
    lines.push(cur);
    return lines;
  }

  const rows = v.items.map((it) => ({
    it,
    ls: wrap(it.n, 370, '600 23px ' + SF),
  }));
  const addr = wrap(v.addr || '-', 300, '21px ' + SF);
  const y0 = 250;
  const partyH = Math.max(100, 70 + addr.length * 28);
  const tableTop = y0 + partyH + 40;
  const rowsH = rows.reduce((a, r) => a + Math.max(r.ls.length * 30, 30) + 28, 0);
  const totTop = tableTop + 56 + rowsH + 24;
  const discLines = v.disc ? 1 : 0;
  const H = totTop + (110 + discLines * 40) + 190 + 130;

  const cv = document.createElement('canvas');
  cv.width = W;
  cv.height = H;
  const x = cv.getContext('2d')!;

  x.fillStyle = '#ececf3';
  x.fillRect(0, 0, W, H);

  x.save();
  x.shadowColor = 'rgba(0,0,0,.12)';
  x.shadowBlur = 30;
  x.shadowOffsetY = 10;
  rr(x, 30, 30, W - 60, H - 60, 28);
  x.fillStyle = '#fff';
  x.fill();
  x.restore();

  if (im) {
    const lw = 190;
    x.drawImage(im, pad, 62, lw, Math.round((lw * im.height) / im.width));
  }

  x.textAlign = 'right';
  x.fillStyle = '#1c1917';
  x.font = '800 34px ' + SF;
  x.fillText('STRUK PEMBELIAN', W - pad, 102);
  x.font = '600 26px ' + SF;
  x.fillText('No. ' + v.no, W - pad, 144);
  x.fillStyle = '#6b6560';
  x.font = '21px ' + SF;
  x.fillText(v.date, W - pad, 178);

  x.fillStyle = '#1c1917';
  x.fillRect(pad, 208, W - 2 * pad, 4);

  x.textAlign = 'left';
  x.fillStyle = '#6b6560';
  x.font = '20px ' + SF;
  x.fillText('Penjual', pad, y0 + 12);
  x.fillText('Pembeli', pad + 480, y0 + 12);

  x.fillStyle = '#1c1917';
  x.font = '800 24px ' + SF;
  x.fillText('CCN (Creative Craft Nation)', pad, y0 + 48);
  x.fillText(v.name, pad + 480, y0 + 48);

  x.fillStyle = '#6b6560';
  x.font = '21px ' + SF;
  x.fillText('WhatsApp 0851-5624-9864', pad, y0 + 80);
  addr.forEach((l, i) => x.fillText(l, pad + 480, y0 + 80 + i * 28));

  x.fillStyle = '#1c1917';
  x.font = '800 19px ' + SF;
  x.fillText('PRODUK', pad, tableTop + 30);
  x.textAlign = 'right';
  x.fillText('JML', pad + 440, tableTop + 30);
  x.fillText('HARGA', pad + 620, tableTop + 30);
  x.fillText('SUBTOTAL', W - pad, tableTop + 30);
  x.fillRect(pad, tableTop + 44, W - 2 * pad, 3);

  let y = tableTop + 56;
  rows.forEach((r) => {
    x.textAlign = 'left';
    x.fillStyle = '#1c1917';
    x.font = '600 23px ' + SF;
    r.ls.forEach((l, i) => x.fillText(l, pad, y + 24 + i * 30));
    x.textAlign = 'right';
    x.fillText(String(r.it.q), pad + 440, y + 24);
    x.fillText(rp(r.it.p), pad + 620, y + 24);
    x.fillText(rp(r.it.p * r.it.q), W - pad, y + 24);
    const h = Math.max(r.ls.length * 30, 30) + 28;
    y += h;
    x.fillStyle = '#e7e5e4';
    x.fillRect(pad, y - 12, W - 2 * pad, 2);
  });

  let ty = totTop + 20;
  x.font = '23px ' + SF;
  x.fillStyle = '#1c1917';
  x.textAlign = 'left';
  x.fillText('Subtotal', pad + 380, ty);
  x.textAlign = 'right';
  x.fillText(rp(v.sub), W - pad, ty);

  if (v.disc) {
    ty += 40;
    x.textAlign = 'left';
    x.fillText('Diskon CCN10 (10%)', pad + 380, ty);
    x.textAlign = 'right';
    x.fillText('-' + rp(v.disc), W - pad, ty);
  }

  ty += 22;
  x.fillRect(pad + 380, ty, W - pad - (pad + 380), 3);
  ty += 44;
  x.font = '800 32px ' + SF;
  x.textAlign = 'left';
  x.fillText('Total', pad + 380, ty);
  x.textAlign = 'right';
  x.fillText(rp(v.total), W - pad, ty);

  ty += 70;
  x.textAlign = 'left';
  x.fillStyle = '#6b6560';
  x.font = '20px ' + SF;
  x.fillText('Metode pembayaran', pad, ty);
  x.fillText('Status', pad + 480, ty);
  ty += 36;
  x.fillStyle = '#1c1917';
  x.font = '800 25px ' + SF;
  x.fillText(v.method, pad, ty);
  x.font = '800 22px ' + SF;
  x.fillText(
    v.status ||
      (v.method === 'QRIS'
        ? 'Sudah dibayar (QRIS)'
        : v.method === 'E-Wallet DANA'
          ? 'Sudah dibayar (DANA)'
          : 'Menunggu pembayaran'),
    pad + 480,
    ty
  );

  x.textAlign = 'center';
  x.fillStyle = '#6b6560';
  x.font = '20px ' + SF;
  x.fillText('Terima kasih telah berbelanja di CCN (Creative Craft Nation).', W / 2, H - 110);
  x.font = '17px ' + SF;
  x.fillText(
    'Struk ini dibuat otomatis oleh website CCN dan dilampirkan untuk konfirmasi WhatsApp.',
    W / 2,
    H - 80
  );

  return cv;
}
