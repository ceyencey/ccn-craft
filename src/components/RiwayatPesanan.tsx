import { CheckCircle2, Clock, PackageCheck, ReceiptText, RefreshCw, RotateCcw, Search, ShoppingBag } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { InvoiceRecord, rp } from '../data/ccnData';
import { OperationType, StoredOrderDoc, handleFirestoreError, subscribeUserOrders } from '../firebase';
import { UserOrder } from './Modals';

interface RiwayatPesananProps {
  uid: string;
  emailVerified: boolean;
  onReorder: (order: UserOrder) => void;
  onTrackOrder: (no: string) => void;
  onOpenInvoice: (inv: InvoiceRecord) => void;
}

type StatusTone = 'paid' | 'pending' | 'process';

interface StatusMeta {
  label: string;
  tone: StatusTone;
}

function getOrderStatusMeta(status?: string, method?: string): StatusMeta {
  const raw = (status || '').trim();
  const lower = raw.toLowerCase();

  if (
    lower.includes('sudah dibayar') ||
    lower.includes('dibayar') ||
    lower.includes('lunas') ||
    lower.includes('tiba') ||
    lower.includes('selesai')
  ) {
    return { label: raw || 'Sudah dibayar', tone: 'paid' };
  }

  if (lower.includes('dikemas') || lower.includes('dikirim') || lower.includes('proses')) {
    return { label: raw, tone: 'process' };
  }

  if (lower.includes('menunggu')) {
    return { label: raw, tone: 'pending' };
  }

  if (method === 'QRIS') {
    return { label: 'Sudah dibayar (QRIS)', tone: 'paid' };
  }

  return { label: raw || 'Menunggu pembayaran', tone: 'pending' };
}

function toUserOrder(d: StoredOrderDoc): UserOrder {
  const status =
    d.status || (d.method === 'QRIS' ? 'Sudah dibayar (QRIS)' : 'Menunggu pembayaran');
  return {
    no: d.no,
    t: d.total,
    m: d.method,
    d: d.date,
    status,
    items: d.items,
    inv: {
      no: d.no,
      date: d.date,
      name: d.name,
      addr: d.addr,
      method: d.method,
      status,
      items: d.items,
      sub: d.sub,
      disc: d.disc,
      total: d.total,
    },
  };
}

export function RiwayatPesanan({
  uid,
  emailVerified,
  onReorder,
  onTrackOrder,
  onOpenInvoice,
}: RiwayatPesananProps) {
  const [orders, setOrders] = useState<UserOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  const [filter, setFilter] = useState<'all' | StatusTone>('all');
  const [retrySeed, setRetrySeed] = useState(0);

  useEffect(() => {
    if (!uid || !emailVerified) {
      setOrders([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setErrorMsg('');

    const unsub = subscribeUserOrders(
      uid,
      (docs) => {
        setOrders(docs.map(toUserOrder));
        setLoading(false);
        setErrorMsg('');
      },
      (err) => {
        setLoading(false);
        setErrorMsg('Gagal memuat riwayat pesanan dari Firestore.');
        try {
          handleFirestoreError(err, OperationType.LIST, `users/${uid}/orders`);
        } catch {
          // Structured error logged via handleFirestoreError; keep UI resilient with retry option
        }
      }
    );

    return () => unsub();
  }, [uid, emailVerified, retrySeed]);

  const counts = useMemo(() => {
    let paid = 0;
    let pending = 0;
    orders.forEach((o) => {
      const meta = getOrderStatusMeta(o.status, o.m);
      if (meta.tone === 'paid' || meta.tone === 'process') paid += 1;
      else pending += 1;
    });
    return { all: orders.length, paid, pending };
  }, [orders]);

  const filteredOrders = useMemo(() => {
    if (filter === 'all') return orders;
    return orders.filter((o) => {
      const tone = getOrderStatusMeta(o.status, o.m).tone;
      if (filter === 'paid') return tone === 'paid' || tone === 'process';
      return tone === 'pending';
    });
  }, [orders, filter]);

  return (
    <div className="rp-wrap">
      <div className="rp-head">
        <div>
          <h4 className="rp-title">Riwayat Pesanan</h4>
          <p className="tag">Daftar transaksi tersimpan di akunmu (sinkron otomatis dengan Firestore).</p>
        </div>
        <button
          type="button"
          className="rp-ref"
          title="Muat ulang riwayat pesanan"
          onClick={() => setRetrySeed((s) => s + 1)}
        >
          <RefreshCw size={14} className={loading ? 'rp-spin' : ''} aria-hidden="true" />
          <span>Segarkan</span>
        </button>
      </div>

      {!loading && !errorMsg && orders.length > 0 && (
        <div className="rp-filters" role="tablist" aria-label="Filter status pesanan">
          <button
            type="button"
            className={`rp-fbtn${filter === 'all' ? ' on' : ''}`}
            onClick={() => setFilter('all')}
          >
            Semua ({counts.all})
          </button>
          <button
            type="button"
            className={`rp-fbtn${filter === 'paid' ? ' on' : ''}`}
            onClick={() => setFilter('paid')}
          >
            Lunas / Diproses ({counts.paid})
          </button>
          <button
            type="button"
            className={`rp-fbtn${filter === 'pending' ? ' on' : ''}`}
            onClick={() => setFilter('pending')}
          >
            Menunggu ({counts.pending})
          </button>
        </div>
      )}

      {loading ? (
        <div className="rp-state" role="status">
          <RefreshCw size={18} className="rp-spin" aria-hidden="true" />
          <span>Memuat riwayat pesanan dari Firestore...</span>
        </div>
      ) : errorMsg ? (
        <div className="rp-state err" role="alert">
          <p>{errorMsg}</p>
          <button
            type="button"
            className="btn o"
            onClick={() => setRetrySeed((s) => s + 1)}
          >
            Coba Lagi
          </button>
        </div>
      ) : filteredOrders.length === 0 ? (
        <div className="rp-empty">
          <ShoppingBag size={24} aria-hidden="true" />
          <p className="tag">
            {orders.length === 0
              ? 'Belum ada riwayat pesanan. Pesanan yang kamu selesaikan akan otomatis tersimpan di sini.'
              : 'Tidak ada pesanan pada filter status ini.'}
          </p>
        </div>
      ) : (
        <div className="rp-list">
          {filteredOrders.map((o) => {
            const statusMeta = getOrderStatusMeta(o.status, o.m);
            const StatusIcon =
              statusMeta.tone === 'paid'
                ? CheckCircle2
                : statusMeta.tone === 'process'
                  ? PackageCheck
                  : Clock;

            return (
              <div className="od rp-card" key={o.no}>
                <div className="rp-top">
                  <div>
                    <b className="rp-no">{o.no}</b>
                    <div className="tag rp-date">{o.d}</div>
                  </div>
                  <span
                    className={`rp-status ${statusMeta.tone}`}
                    aria-label={`Status pesanan: ${statusMeta.label}`}
                  >
                    <span className="rp-dot" aria-hidden="true" />
                    <StatusIcon size={13} aria-hidden="true" />
                    <span>{statusMeta.label}</span>
                  </span>
                </div>

                <div className="rp-items">
                  {o.items.map((c, idx) => (
                    <div className="rp-item" key={`${o.no}-${c.k}-${idx}`}>
                      <span>
                        {c.n} <b>×{c.q}</b>
                      </span>
                      <span className="tag">{rp(c.p * c.q)}</span>
                    </div>
                  ))}
                </div>

                <div className="rp-meta">
                  <div>
                    <span className="tag">Total bayar</span>
                    <div className="rp-total">{rp(o.t)}</div>
                  </div>
                  <span className="rp-method">{o.m}</span>
                </div>

                <div className="rp-actions">
                  <button className="btn o" type="button" onClick={() => onReorder(o)}>
                    <RotateCcw size={13} aria-hidden="true" /> Pesan lagi
                  </button>
                  <button className="btn o" type="button" onClick={() => onTrackOrder(o.no)}>
                    <Search size={13} aria-hidden="true" /> Lacak
                  </button>
                  {o.inv && (
                    <button
                      className="btn o"
                      type="button"
                      onClick={() => onOpenInvoice(o.inv!)}
                    >
                      <ReceiptText size={13} aria-hidden="true" /> Struk
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
