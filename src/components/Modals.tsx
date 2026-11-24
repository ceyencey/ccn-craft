import {
  createUserWithEmailAndPassword,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  updateProfile,
} from 'firebase/auth';
import { useEffect, useState } from 'react';
import {
  assetUrl,
  BAG_VARIANTS,
  BagProduct,
  CartItem,
  InvoiceRecord,
  PRODUCTS,
  QRIS_IMAGE,
  rp,
  WA_NUMBER,
} from '../data/ccnData';
import { auth, googleProvider } from '../firebase';
import { renderReceiptCanvas } from '../utils/receiptCanvas';
import { RiwayatPesanan } from './RiwayatPesanan';

export interface UserOrder {
  no: string;
  t: number;
  m: string;
  d: string;
  status?: string;
  items: CartItem[];
  inv: InvoiceRecord | null;
}

export interface AuthUser {
  uid: string;
  name: string;
  email: string;
  emailVerified: boolean;
  addr: string;
  orders: UserOrder[];
}

function mapAuthError(err: unknown): string {
  const code = (err as { code?: string })?.code || '';
  if (code === 'auth/email-already-in-use')
    return 'Email ini sudah terdaftar. Silakan masuk dengan email tersebut.';
  if (code === 'auth/invalid-email') return 'Format email tidak valid.';
  if (code === 'auth/weak-password') return 'Kata sandi terlalu lemah (minimal 6 karakter).';
  if (
    code === 'auth/invalid-credential' ||
    code === 'auth/wrong-password' ||
    code === 'auth/user-not-found'
  ) {
    return 'Email atau kata sandi salah.';
  }
  if (code === 'auth/too-many-requests')
    return 'Terlalu banyak percobaan. Tunggu sebentar lalu coba lagi.';
  if (code === 'auth/popup-closed-by-user') return 'Login Google dibatalkan.';
  if (code === 'auth/popup-blocked')
    return 'Popup browser diblokir. Izinkan popup untuk masuk dengan Google.';
  if (code === 'auth/operation-not-allowed' || code === 'auth/configuration-not-found') {
    return 'Provider Email/Kata Sandi belum diaktifkan di Firebase Console (Authentication → Sign-in method → aktifkan Email/Password). Untuk langsung masuk sekarang, gunakan tombol Masuk dengan Google.';
  }
  return err instanceof Error ? err.message : 'Autentikasi gagal. Silakan coba lagi.';
}

/* ==================== AUTH MODAL ==================== */
interface AuthModalProps {
  open: boolean;
  initialMode: 'login' | 'reg';
  fromCheckout?: boolean;
  user: AuthUser | null;
  onClose: () => void;
  onAuthCompleted: (msg: string, opts?: { name?: string; addr?: string }) => void;
  onRefreshVerification: () => Promise<boolean>;
  onSaveProfile: (name: string, addr: string) => Promise<void>;
  onLogout: () => Promise<void>;
  onReorder: (order: UserOrder) => void;
  onTrackOrder: (no: string) => void;
  onOpenInvoice: (inv: InvoiceRecord) => void;
}

export function AuthModal({
  open,
  initialMode,
  fromCheckout,
  user,
  onClose,
  onAuthCompleted,
  onRefreshVerification,
  onSaveProfile,
  onLogout,
  onReorder,
  onTrackOrder,
  onOpenInvoice,
}: AuthModalProps) {
  const [mode, setMode] = useState<'login' | 'reg'>(initialMode);
  const [tab, setTab] = useState<'profil' | 'pesanan'>('profil');
  const [msg, setMsg] = useState<{ text: string; ok: boolean }>({ text: '', ok: false });
  const [busy, setBusy] = useState(false);

  // Login fields
  const [le, setLe] = useState('');
  const [lp, setLp] = useState('');

  // Reg fields
  const [rn, setRn] = useState('');
  const [re, setRe] = useState('');
  const [rpInput, setRpInput] = useState('');
  const [ra, setRa] = useState('');

  // Profile fields
  const [pn, setPn] = useState('');
  const [pa, setPa] = useState('');

  useEffect(() => {
    if (open) {
      setMode(initialMode);
      setTab('profil');
      setMsg({ text: '', ok: false });
    }
  }, [open, initialMode]);

  useEffect(() => {
    if (open && user) {
      setPn(user.name);
      setPa(user.addr || '');
    }
  }, [open, user?.uid, user?.name, user?.addr]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  const handleGoogleSignIn = async () => {
    setBusy(true);
    setMsg({ text: '', ok: false });
    try {
      const cred = await signInWithPopup(auth, googleProvider);
      const first = (cred.user.displayName || cred.user.email || '').split(' ')[0];
      onAuthCompleted(`Berhasil masuk dengan email ${cred.user.email || first}.`);
    } catch (err) {
      setMsg({ text: mapAuthError(err), ok: false });
    } finally {
      setBusy(false);
    }
  };

  const handleLogin = async () => {
    const email = le.trim().toLowerCase();
    if (!email || !lp) {
      setMsg({ text: 'Isi email dan kata sandi.', ok: false });
      return;
    }
    setBusy(true);
    setMsg({ text: '', ok: false });
    try {
      const cred = await signInWithEmailAndPassword(auth, email, lp);
      setLe('');
      setLp('');
      if (!cred.user.emailVerified) {
        setMsg({
          text: 'Akun ditemukan, tetapi email belum terverifikasi. Silakan cek kotak masuk emailmu.',
          ok: false,
        });
      } else {
        onAuthCompleted(`Selamat datang kembali, ${(cred.user.displayName || email).split(' ')[0]}!`);
      }
    } catch (err) {
      setMsg({ text: mapAuthError(err), ok: false });
    } finally {
      setBusy(false);
    }
  };

  const handleResetPassword = async () => {
    const email = le.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setMsg({ text: 'Masukkan alamat email di atas untuk mengirim tautan reset kata sandi.', ok: false });
      return;
    }
    setBusy(true);
    try {
      await sendPasswordResetEmail(auth, email);
      setMsg({ text: `Tautan reset kata sandi telah dikirim ke ${email}.`, ok: true });
    } catch (err) {
      setMsg({ text: mapAuthError(err), ok: false });
    } finally {
      setBusy(false);
    }
  };

  const handleRegister = async () => {
    const name = rn.trim();
    const email = re.trim().toLowerCase();
    const addr = ra.trim();
    if (name.length < 2) {
      setMsg({ text: 'Isi nama lengkap (minimal 2 karakter).', ok: false });
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setMsg({ text: 'Format email belum benar.', ok: false });
      return;
    }
    if (rpInput.length < 6) {
      setMsg({ text: 'Kata sandi minimal 6 karakter.', ok: false });
      return;
    }

    setBusy(true);
    setMsg({ text: '', ok: false });
    try {
      const cred = await createUserWithEmailAndPassword(auth, email, rpInput);
      await updateProfile(cred.user, { displayName: name });
      await sendEmailVerification(cred.user);
      setRn('');
      setRe('');
      setRpInput('');
      setRa('');
      onAuthCompleted(
        `Akun dibuat! Tautan verifikasi dikirim ke ${email}.`,
        { name, addr }
      );
      setMsg({
        text: `Tautan verifikasi sudah dikirim ke ${email}. Silakan buka emailmu lalu verifikasi.`,
        ok: true,
      });
    } catch (err) {
      setMsg({ text: mapAuthError(err), ok: false });
    } finally {
      setBusy(false);
    }
  };

  const handleResendVerification = async () => {
    if (!auth.currentUser) return;
    setBusy(true);
    try {
      await sendEmailVerification(auth.currentUser);
      setMsg({
        text: `Email verifikasi dikirim ulang ke ${auth.currentUser.email}. Cek kotak masuk atau folder spam.`,
        ok: true,
      });
    } catch (err) {
      setMsg({ text: mapAuthError(err), ok: false });
    } finally {
      setBusy(false);
    }
  };

  const handleCheckVerified = async () => {
    setBusy(true);
    try {
      const ok = await onRefreshVerification();
      if (ok) {
        setMsg({ text: 'Email berhasil diverifikasi! Akun siap digunakan.', ok: true });
      } else {
        setMsg({
          text: 'Email belum terverifikasi. Pastikan kamu sudah mengklik tautan verifikasi di email.',
          ok: false,
        });
      }
    } finally {
      setBusy(false);
    }
  };

  const handleSaveProfile = async () => {
    const name = pn.trim();
    if (name.length < 2) {
      setMsg({ text: 'Nama minimal 2 karakter.', ok: false });
      return;
    }
    setBusy(true);
    try {
      await onSaveProfile(name, pa.trim());
      setMsg({ text: 'Profil tersimpan ke akunmu.', ok: true });
    } catch (err) {
      setMsg({
        text: err instanceof Error ? err.message : 'Gagal menyimpan profil.',
        ok: false,
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className={`modal${open ? ' on' : ''}`}
      id="am"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="card" style={{ maxWidth: 430, position: 'relative' }}>
        <button
          className="btn o"
          type="button"
          onClick={onClose}
          style={{ position: 'absolute', top: 12, right: 12, padding: '6px 12px' }}
        >
          Tutup
        </button>
        <div id="amb">
          {!user ? (
            <>
              <div
                className="lg"
                style={{ width: 96, aspectRatio: '360/219', margin: '0 auto 10px', display: 'block' }}
                role="img"
                aria-label="Logo CCN"
              />
              {fromCheckout && (
                <p
                  className="tag"
                  style={{
                    margin: '0 0 10px',
                    padding: '8px 10px',
                    borderRadius: 10,
                    background: 'var(--ac2)',
                    color: 'var(--tx)',
                    textAlign: 'center',
                  }}
                >
                  Masuk atau daftar dengan email untuk melanjutkan checkout pesananmu.
                </p>
              )}
              <button
                type="button"
                className="btn o"
                disabled={busy}
                onClick={handleGoogleSignIn}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  marginBottom: 12,
                }}
              >
                <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
                  <path
                    fill="#EA4335"
                    d="M12 10.2v3.9h5.4c-.2 1.3-1.5 3.9-5.4 3.9-3.3 0-5.9-2.7-5.9-6s2.7-6 5.9-6c1.9 0 3.1.8 3.8 1.5l2.6-2.5C16.7 3.5 14.6 2.6 12 2.6 6.8 2.6 2.6 6.8 2.6 12s4.2 9.4 9.4 9.4c5.4 0 9-3.8 9-9.1 0-.6-.1-1.1-.2-1.6H12z"
                  />
                </svg>
                Masuk / Daftar dengan Google (Email)
              </button>
              <div
                className="tag"
                style={{ textAlign: 'center', margin: '0 0 10px', opacity: 0.85 }}
              >
                — atau gunakan Email &amp; Kata Sandi —
              </div>
              <div className="atabs" style={{ justifyContent: 'center', marginBottom: 14 }}>
                <button
                  type="button"
                  className={`at${mode === 'login' ? ' on' : ''}`}
                  onClick={() => {
                    setMode('login');
                    setMsg({ text: '', ok: false });
                  }}
                >
                  Masuk
                </button>
                <button
                  type="button"
                  className={`at${mode === 'reg' ? ' on' : ''}`}
                  onClick={() => {
                    setMode('reg');
                    setMsg({ text: '', ok: false });
                  }}
                >
                  Daftar
                </button>
              </div>
              {mode === 'reg' ? (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    void handleRegister();
                  }}
                >
                  <label>Nama lengkap</label>
                  <input value={rn} onChange={(e) => setRn(e.target.value)} autoComplete="name" />
                  <label>Email</label>
                  <input
                    type="email"
                    value={re}
                    onChange={(e) => setRe(e.target.value)}
                    autoComplete="email"
                  />
                  <label>Kata sandi (min. 6 karakter)</label>
                  <input
                    type="password"
                    value={rpInput}
                    onChange={(e) => setRpInput(e.target.value)}
                    autoComplete="new-password"
                  />
                  <label>Alamat pengiriman (opsional)</label>
                  <textarea rows={2} value={ra} onChange={(e) => setRa(e.target.value)} />
                  <p className={`amsg${msg.ok ? ' ok' : ''}`}>{msg.text}</p>
                  <button className="btn" style={{ width: '100%' }} type="submit" disabled={busy}>
                    {busy ? 'Memproses...' : 'Buat Akun Email'}
                  </button>
                </form>
              ) : (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    void handleLogin();
                  }}
                >
                  <label>Email</label>
                  <input
                    type="email"
                    value={le}
                    onChange={(e) => setLe(e.target.value)}
                    autoComplete="email"
                  />
                  <label>Kata sandi</label>
                  <input
                    type="password"
                    value={lp}
                    onChange={(e) => setLp(e.target.value)}
                    autoComplete="current-password"
                  />
                  <p className={`amsg${msg.ok ? ' ok' : ''}`}>{msg.text}</p>
                  <button className="btn" style={{ width: '100%' }} type="submit" disabled={busy}>
                    {busy ? 'Memproses...' : 'Masuk dengan Email'}
                  </button>
                  <div style={{ textAlign: 'right', marginTop: 8 }}>
                    <button
                      type="button"
                      className="tag"
                      onClick={() => void handleResetPassword()}
                      style={{
                        background: 'none',
                        border: 0,
                        color: 'var(--ac)',
                        cursor: 'pointer',
                        padding: 0,
                      }}
                    >
                      Lupa kata sandi?
                    </button>
                  </div>
                </form>
              )}
              <div
                style={{
                  marginTop: 12,
                  padding: '10px 12px',
                  borderRadius: 12,
                  background: 'var(--bg)',
                  border: '1px solid var(--bd)',
                  fontSize: 12,
                  color: 'var(--mu)',
                }}
              >
                <b style={{ color: 'var(--tx)', display: 'block', marginBottom: 4 }}>
                  Keamanan Email &amp; Kata Sandi Terjaga
                </b>
                Kata sandi dienkripsi langsung oleh sistem autentikasi Google Firebase (HTTPS &amp; hashing satu arah), tidak pernah disimpan sebagai teks biasa, dan <b>tidak dapat dilihat oleh admin maupun pembuat website</b>. Masuk atau daftar bersifat opsional saat melihat-lihat, dan wajib saat checkout.
              </div>
            </>
          ) : !user.emailVerified ? (
            <div style={{ paddingTop: 12 }}>
              <div
                className="lg"
                style={{ width: 84, aspectRatio: '360/219', margin: '0 auto 12px', display: 'block' }}
                role="img"
                aria-label="Logo CCN"
              />
              <span className="pill">Menunggu Verifikasi Email</span>
              <h3 style={{ margin: '4px 0 6px' }}>Verifikasi Email Kamu</h3>
              <p className="tag" style={{ marginBottom: 12 }}>
                Kami mengirim tautan verifikasi ke <b>{user.email}</b>. Buka kotak masuk atau folder spam email kamu, klik tautan tersebut, lalu tekan tombol di bawah ini untuk mengaktifkan akun &amp; checkout.
              </p>
              {msg.text && <p className={`amsg${msg.ok ? ' ok' : ''}`}>{msg.text}</p>}
              <button
                type="button"
                className="btn"
                style={{ width: '100%', marginBottom: 8 }}
                disabled={busy}
                onClick={() => void handleCheckVerified()}
              >
                {busy ? 'Memeriksa...' : 'Saya Sudah Verifikasi Email'}
              </button>
              <button
                type="button"
                className="btn o"
                style={{ width: '100%', marginBottom: 8 }}
                disabled={busy}
                onClick={() => void handleResendVerification()}
              >
                Kirim Ulang Email Verifikasi
              </button>
              <button
                type="button"
                className="btn o"
                style={{ width: '100%' }}
                disabled={busy}
                onClick={() => void onLogout()}
              >
                Keluar / Ganti Akun
              </button>
            </div>
          ) : (
            <>
              <div
                className="row"
                style={{ justifyContent: 'flex-start', gap: 12, margin: '0 70px 12px 0' }}
              >
                <span
                  className="av"
                  style={{ width: 48, height: 48, fontSize: 20, margin: 0, flex: 'none' }}
                >
                  {user.name.charAt(0).toUpperCase()}
                </span>
                <div style={{ minWidth: 0 }}>
                  <b>{user.name}</b>
                  <br />
                  <span className="tag">{user.email}</span>
                </div>
              </div>
              <div className="atabs" style={{ marginBottom: 12 }}>
                <button
                  type="button"
                  className={`at${tab === 'profil' ? ' on' : ''}`}
                  onClick={() => {
                    setTab('profil');
                    setMsg({ text: '', ok: false });
                  }}
                >
                  Profil
                </button>
                <button
                  type="button"
                  className={`at${tab === 'pesanan' ? ' on' : ''}`}
                  onClick={() => {
                    setTab('pesanan');
                    setMsg({ text: '', ok: false });
                  }}
                >
                  Riwayat Pesanan ({user.orders.length})
                </button>
              </div>
              {tab === 'profil' ? (
                <>
                  <label>Nama</label>
                  <input value={pn} onChange={(e) => setPn(e.target.value)} />
                  <label>Alamat pengiriman</label>
                  <textarea rows={3} value={pa} onChange={(e) => setPa(e.target.value)} />
                  <p className={`amsg${msg.ok ? ' ok' : ''}`}>{msg.text}</p>
                  <button
                    className="btn"
                    type="button"
                    disabled={busy}
                    onClick={() => void handleSaveProfile()}
                  >
                    Simpan
                  </button>{' '}
                  <button
                    className="btn o"
                    type="button"
                    disabled={busy}
                    onClick={() => void onLogout()}
                  >
                    Keluar
                  </button>
                </>
              ) : (
                <RiwayatPesanan
                  uid={user.uid}
                  emailVerified={user.emailVerified}
                  onReorder={onReorder}
                  onTrackOrder={onTrackOrder}
                  onOpenInvoice={onOpenInvoice}
                />
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/* ==================== PRODUCT DETAIL MODAL ==================== */
interface ProductDetailModalProps {
  product: BagProduct | null;
  wishlist: string[];
  onClose: () => void;
  onSelectProduct: (id: number) => void;
  onToggleWish: (name: string) => void;
  onAddToCart: (product: BagProduct, variant: string, colorName: string) => void;
}

export function ProductDetailModal({
  product,
  wishlist,
  onClose,
  onSelectProduct,
  onToggleWish,
  onAddToCart,
}: ProductDetailModalProps) {
  const [colorIdx, setColorIdx] = useState(0);
  const [variant, setVariant] = useState<string>(BAG_VARIANTS[0]);

  useEffect(() => {
    setColorIdx(0);
    setVariant(BAG_VARIANTS[0]);
  }, [product?.id]);

  useEffect(() => {
    if (!product) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [product, onClose]);

  const activeColor = product?.colors[colorIdx] || product?.colors[0];
  const isWish = product ? wishlist.includes(product.name) : false;
  const similar = product
    ? PRODUCTS.filter((q) => q.id !== product.id)
        .sort((a, b) => Math.abs(a.price - product.price) - Math.abs(b.price - product.price))
        .slice(0, 3)
    : [];

  return (
    <div
      className={`modal${product ? ' on' : ''}`}
      id="pd"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="card" style={{ maxWidth: 880, position: 'relative' }}>
        <button
          className="btn o"
          type="button"
          onClick={onClose}
          style={{ position: 'absolute', top: 12, right: 12, padding: '6px 12px', zIndex: 2 }}
        >
          Tutup
        </button>
        {product && (
          <div id="pdb" style={{ paddingTop: 34 }}>
            <div className="pdg">
              <div
                className="pdi"
                id="pdi"
                style={
                  {
                    '--pt': `color-mix(in srgb, ${activeColor?.hex || product.tint} 30%, var(--card))`,
                  } as React.CSSProperties
                }
              >
                <img src={assetUrl(product.image)} alt={product.name} className="bag-pd" />
                {product.badge && (
                  <span className={`bd bd-${product.badge}`} style={{ top: 14, left: 14 }}>
                    {product.badge}
                  </span>
                )}
              </div>
              <div>
                <span className="pill">{product.category}</span>
                <h2 style={{ margin: '10px 0 4px' }}>{product.name}</h2>
                <div>
                  <span className="price" style={{ fontSize: 22 }}>
                    {rp(product.price)}
                  </span>
                  {product.oldPrice && <s className="tag">{rp(product.oldPrice)}</s>}
                </div>
                <p className="tag" style={{ margin: '6px 0 14px' }}>
                  {product.desc}
                </p>
                <b>
                  Nuansa Warna: <span>{activeColor?.name}</span>
                </b>
                <div className="sws">
                  {product.colors.map((c, idx) => (
                    <button
                      key={c.name}
                      type="button"
                      className={`sw${idx === colorIdx ? ' on' : ''}`}
                      style={{ background: c.hex }}
                      aria-label={c.name}
                      title={c.name}
                      onClick={() => setColorIdx(idx)}
                    />
                  ))}
                </div>
                <label>Pilihan Varian</label>
                <select value={variant} onChange={(e) => setVariant(e.target.value)}>
                  {BAG_VARIANTS.map((v) => (
                    <option key={v} value={v}>
                      {v}
                    </option>
                  ))}
                </select>
                <div className="row" style={{ margin: '6px 0 16px', gap: 10 }}>
                  <button
                    className="btn"
                    style={{ flex: 1 }}
                    type="button"
                    onClick={() => {
                      onAddToCart(product, variant, activeColor?.name || 'Standar');
                      onClose();
                    }}
                  >
                    + Tambah ke Keranjang
                  </button>
                  <button
                    className={`hbt${isWish ? ' on' : ''}`}
                    type="button"
                    aria-label="Simpan ke favorit"
                    style={{ position: 'static', flex: 'none' }}
                    onClick={() => onToggleWish(product.name)}
                  >
                    <svg viewBox="0 0 24 24" width="18" height="18">
                      <path d="M12 21s-7.5-4.6-9.5-9.3C1 8 3.2 5 6.3 5c1.9 0 3.4 1 4.2 2.4h3C14.3 6 15.8 5 17.7 5 20.8 5 23 8 21.5 11.7 19.5 16.4 12 21 12 21z" />
                    </svg>
                  </button>
                </div>
                <table className="spec">
                  <tbody>
                    <tr>
                      <td>Material</td>
                      <td>{product.material}</td>
                    </tr>
                    <tr>
                      <td>Teknik</td>
                      <td>{product.technique}</td>
                    </tr>
                    <tr>
                      <td>Ukuran</td>
                      <td>{product.dimensions}</td>
                    </tr>
                    <tr>
                      <td>Fitur</td>
                      <td>{product.features.join(', ')}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            <h3 style={{ margin: '22px 0 10px' }}>Produk serupa</h3>
            <div className="simg">
              {similar.map((s) => (
                <div key={s.id} className="sim" onClick={() => onSelectProduct(s.id)}>
                  <img src={assetUrl(s.image)} alt={s.name} className="bag-sim" />
                  <b style={{ fontSize: 13, display: 'block' }}>{s.name}</b>
                  <div className="price" style={{ fontSize: 13 }}>
                    {rp(s.price)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ==================== CART MODAL ==================== */
interface CartModalProps {
  open: boolean;
  cart: CartItem[];
  user: AuthUser | null;
  onClose: () => void;
  onRemoveItem: (index: number) => void;
  onOpenAuthLogin: () => void;
  onCheckoutComplete: (inv: InvoiceRecord) => void | Promise<void>;
  onOpenInvoice: (inv: InvoiceRecord) => void;
  onOpenZoomImage: (dataUrl: string, fileName: string, title?: string, caption?: string) => void;
  onToast: (msg: string) => void;
}

interface PendingQrisOrder {
  name: string;
  addr: string;
  sub: number;
  disc: number;
  total: number;
  items: CartItem[];
}

export function CartModal({
  open,
  cart,
  user,
  onClose,
  onRemoveItem,
  onOpenAuthLogin,
  onCheckoutComplete,
  onOpenInvoice,
  onOpenZoomImage,
  onToast,
}: CartModalProps) {
  const [voucherInput, setVoucherInput] = useState('');
  const [appliedVoucher, setAppliedVoucher] = useState('');
  const [voucherMsg, setVoucherMsg] = useState('');
  const [cname, setCname] = useState('');
  const [cadr, setCadr] = useState('');
  const [payMethod, setPayMethod] = useState('QRIS');
  const [checkoutError, setCheckoutError] = useState('');
  const [qrisPending, setQrisPending] = useState<PendingQrisOrder | null>(null);
  const [completedInv, setCompletedInv] = useState<InvoiceRecord | null>(null);
  const [receiptUrl, setReceiptUrl] = useState<string>('');
  const [copyStatus, setCopyStatus] = useState('');

  useEffect(() => {
    if (open) {
      setQrisPending(null);
      setCompletedInv(null);
      setReceiptUrl('');
      setCheckoutError('');
      setCopyStatus('');
      if (user) {
        setCname((prev) => prev || user.name);
        setCadr((prev) => prev || user.addr || '');
      }
    }
  }, [open, user]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  const subtotal = cart.reduce((s, c) => s + c.p * c.q, 0);
  const discVoucher = appliedVoucher === 'CCN10' ? Math.round(subtotal * 0.1) : 0;
  const grandTotal = Math.max(0, subtotal - discVoucher);

  const applyVoucher = () => {
    const code = voucherInput.trim().toUpperCase();
    if (code === 'CCN10') {
      setAppliedVoucher('CCN10');
      setVoucherMsg('Voucher CCN10 dipakai: diskon 10% untuk pembelian pertama.');
    } else {
      setAppliedVoucher('');
      setVoucherMsg(code ? 'Kode voucher tidak valid. Coba CCN10.' : '');
    }
  };

  const finalizeOrder = async (payload: {
    name: string;
    addr: string;
    method: string;
    status: string;
    items: CartItem[];
    sub: number;
    disc: number;
    total: number;
  }) => {
    const no = 'CCN-' + Date.now().toString().slice(-6);
    const inv: InvoiceRecord = {
      no,
      date: new Date().toLocaleString('id-ID', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      }),
      name: payload.name,
      addr: payload.addr,
      method: payload.method,
      status: payload.status,
      items: payload.items,
      sub: payload.sub,
      disc: payload.disc,
      total: payload.total,
    };

    setQrisPending(null);
    setCompletedInv(inv);
    setAppliedVoucher('');
    setVoucherInput('');
    setVoucherMsg('');
    onCheckoutComplete(inv);

    const canvas = await renderReceiptCanvas(inv);
    setReceiptUrl(canvas.toDataURL('image/png'));
    return no;
  };

  const handleCheckout = async () => {
    setCheckoutError('');
    if (!cart.length) {
      setCheckoutError('Keranjang masih kosong.');
      onToast('Keranjang masih kosong.');
      return;
    }
    if (!user || !user.emailVerified) {
      const errMsg = !user
        ? 'Wajib masuk dengan akun email terlebih dahulu sebelum checkout.'
        : 'Verifikasi email kamu terlebih dahulu sebelum checkout.';
      setCheckoutError(errMsg);
      onToast(errMsg);
      onOpenAuthLogin();
      return;
    }
    const name = cname.trim();
    const addr = cadr.trim();
    if (name.length < 2 || addr.length < 3) {
      setCheckoutError('Isi nama (min. 2 huruf) dan alamat pengiriman lengkap dulu.');
      onToast('Isi nama dan alamat pengiriman dulu.');
      return;
    }

    if (payMethod === 'QRIS') {
      setQrisPending({
        name,
        addr,
        sub: subtotal,
        disc: discVoucher,
        total: grandTotal,
        items: cart.map((c) => ({ ...c })),
      });
      return;
    }

    await finalizeOrder({
      name,
      addr,
      method: payMethod,
      status: 'Menunggu pembayaran',
      items: cart.map((c) => ({ ...c })),
      sub: subtotal,
      disc: discVoucher,
      total: grandTotal,
    });
  };

  const handleConfirmQrisPaid = async () => {
    if (!qrisPending) return;
    const no = await finalizeOrder({
      name: qrisPending.name,
      addr: qrisPending.addr,
      method: 'QRIS',
      status: 'Sudah dibayar (QRIS)',
      items: qrisPending.items,
      sub: qrisPending.sub,
      disc: qrisPending.disc,
      total: qrisPending.total,
    });
    onToast(`Pembayaran QRIS berhasil! Nomor pesanan ${no} diterbitkan.`);
  };

  const handleCopyReceipt = async () => {
    if (!completedInv) return;
    try {
      const canvas = await renderReceiptCanvas(completedInv);
      canvas.toBlob(async (blob) => {
        if (!blob) return;
        try {
          await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
          setCopyStatus('Gambar disalin. Tempel di chat WhatsApp.');
        } catch {
          setCopyStatus('Tidak bisa menyalin otomatis. Tekan lama atau klik kanan gambar untuk menyimpannya.');
        }
      }, 'image/png');
    } catch {
      setCopyStatus('Tidak bisa menyalin otomatis. Klik kanan gambar untuk menyimpannya.');
    }
  };

  const paymentGuide = (m: string) => {
    if (m === 'QRIS')
      return 'Pembayaran melalui QRIS resmi CCN telah dikonfirmasi dan nomor pesanan sudah diterbitkan secara otomatis.';
    if (m.startsWith('E-Wallet'))
      return 'Kamu akan diarahkan ke aplikasi GoPay atau DANA untuk konfirmasi (contoh).';
    if (m.startsWith('Virtual'))
      return 'Nomor virtual account dibuat khusus untuk transaksi ini: 8801 2345 6789 0123 (contoh).';
    return 'Kamu akan diarahkan ke halaman pembayaran kartu yang aman (contoh).';
  };

  const waOrderHref = completedInv
    ? `https://wa.me/${WA_NUMBER}?text=${encodeURIComponent(
        `Halo CCN, saya ingin konfirmasi pesanan ${completedInv.no}\nNama: ${completedInv.name}\nAlamat: ${completedInv.addr}\nTotal: ${rp(
          completedInv.total
        )}\nPembayaran: ${completedInv.method}\n(Struk pembelian saya lampirkan di chat ini)`
      )}`
    : '#';

  return (
    <div
      className={`modal${open ? ' on' : ''}`}
      id="cm"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="card">
        <div className="row">
          <h3 style={{ margin: 0 }}>Keranjang &amp; Pembayaran</h3>
          <button className="btn o" type="button" onClick={onClose}>
            Tutup
          </button>
        </div>

        {!completedInv && !qrisPending && (
          <>
            <div id="ci" style={{ margin: '12px 0' }}>
              {cart.length ? (
                <>
                  {cart.map((c, i) => (
                    <div className="row" key={c.k} style={{ marginBottom: 6 }}>
                      <span>
                        {c.n} ×{c.q}
                      </span>
                      <span style={{ whiteSpace: 'nowrap' }}>
                        {rp(c.p * c.q)}{' '}
                        <button
                          className="btn o"
                          type="button"
                          style={{ padding: '4px 10px' }}
                          onClick={() => onRemoveItem(i)}
                        >
                          ✕
                        </button>
                      </span>
                    </div>
                  ))}
                  <hr style={{ borderColor: 'var(--bd)', margin: '10px 0' }} />
                  <div className="row">
                    <span>Subtotal</span>
                    <span>{rp(subtotal)}</span>
                  </div>
                  {discVoucher > 0 && (
                    <div className="row">
                      <span>Diskon CCN10 (10%)</span>
                      <span>-{rp(discVoucher)}</span>
                    </div>
                  )}
                  <div className="row" style={{ marginTop: 4 }}>
                    <b>Total</b>
                    <b>{rp(grandTotal)}</b>
                  </div>
                </>
              ) : (
                <p className="tag">Keranjang masih kosong.</p>
              )}
            </div>

            <div id="co">
              {!user || !user.emailVerified ? (
                <div
                  className="card"
                  style={{
                    background: 'var(--bg)',
                    borderColor: 'var(--ac)',
                    marginTop: 4,
                  }}
                >
                  <b>
                    {!user
                      ? 'Masuk dengan Email untuk Checkout'
                      : 'Verifikasi Email untuk Checkout'}
                  </b>
                  <p className="tag" style={{ margin: '6px 0 12px' }}>
                    {!user
                      ? 'Melihat-lihat produk dan menambah ke keranjang tidak memerlukan akun. Untuk menyelesaikan checkout dan pembayaran, kamu wajib masuk atau daftar menggunakan akun email terlebih dahulu.'
                      : `Akun ${user.email} belum terverifikasi. Buka tautan verifikasi di email kamu lalu konfirmasi untuk melanjutkan checkout.`}
                  </p>
                  <button
                    type="button"
                    className="btn"
                    style={{ width: '100%' }}
                    onClick={onOpenAuthLogin}
                  >
                    {!user ? 'Masuk / Daftar dengan Email' : 'Buka Verifikasi Email'}
                  </button>
                </div>
              ) : (
                <>
                  <p className="tag" id="chint" style={{ margin: '0 0 8px' }}>
                    Checkout sebagai <b>{user.name}</b> ({user.email}).
                  </p>

                  <label>Kode voucher</label>
                  <div className="row" style={{ marginBottom: 6 }}>
                    <input
                      value={voucherInput}
                      onChange={(e) => setVoucherInput(e.target.value)}
                      placeholder="Contoh: CCN10"
                      style={{ margin: 0 }}
                    />
                    <button className="btn o" type="button" onClick={applyVoucher}>
                      Pakai
                    </button>
                  </div>
                  {voucherMsg && (
                    <p
                      className="tag"
                      style={{ margin: '0 0 8px', color: appliedVoucher ? '#16a34a' : '#dc2626' }}
                    >
                      {voucherMsg}
                    </p>
                  )}
                  <p className="tag" style={{ margin: '0 0 8px' }}>
                    Gunakan kode <b>CCN10</b> untuk mendapatkan diskon 10% pembelian pertama.
                  </p>

                  <label>Nama</label>
                  <input value={cname} onChange={(e) => setCname(e.target.value)} />
                  <label>Alamat pengiriman</label>
                  <textarea rows={2} value={cadr} onChange={(e) => setCadr(e.target.value)} />
                  <label>Metode pembayaran</label>
                  <select value={payMethod} onChange={(e) => setPayMethod(e.target.value)}>
                    <option>QRIS</option>
                    <option>E-Wallet (GoPay / DANA)</option>
                    <option>Virtual Account (transfer bank)</option>
                    <option>Kartu Debit/Kredit</option>
                  </select>

                  {checkoutError && <p className="amsg">{checkoutError}</p>}

                  <button
                    className="btn"
                    style={{ width: '100%' }}
                    type="button"
                    onClick={handleCheckout}
                  >
                    {payMethod === 'QRIS' ? 'Lanjut ke Pembayaran QRIS' : 'Bayar Sekarang'}
                  </button>
                  <p className="tag" style={{ marginTop: 8 }}>
                    {payMethod === 'QRIS'
                      ? 'Khusus QRIS: pindai QRIS resmi CCN terlebih dahulu. Nomor pesanan akan diterbitkan otomatis setelah pembayaran QRIS selesai.'
                      : 'Catatan: metode selain QRIS bersifat simulasi. Untuk transaksi nyata, hubungkan ke payment gateway.'}
                  </p>
                </>
              )}
            </div>
          </>
        )}

        {qrisPending && !completedInv && (
          <div style={{ marginTop: 12 }}>
            <div className="card">
              <div className="row" style={{ marginBottom: 8 }}>
                <b>Pembayaran QRIS Resmi CCN</b>
                <span className="pill">Belum Ada No. Pesanan</span>
              </div>
              <p className="tag" style={{ margin: '0 0 10px' }}>
                Nomor pesanan <b>belum diterbitkan</b> sebelum kamu membayar lewat QRIS. Pindai kode QRIS di bawah ini sebesar <b>{rp(qrisPending.total)}</b>, lalu klik tombol konfirmasi setelah selesai membayar agar nomor pesanan diterbitkan otomatis.
              </p>
              <div
                style={{
                  background: '#fff',
                  borderRadius: 14,
                  padding: 14,
                  border: '1px solid var(--bd)',
                  textAlign: 'center',
                  marginBottom: 12,
                }}
              >
                <img
                  src={QRIS_IMAGE}
                  alt="Kode QRIS Resmi CCN"
                  style={{
                    display: 'block',
                    width: '100%',
                    maxWidth: 260,
                    margin: '0 auto',
                    borderRadius: 10,
                  }}
                />
                <div
                  style={{
                    color: '#1c1917',
                    fontWeight: 700,
                    fontSize: 15,
                    marginTop: 10,
                  }}
                >
                  Total Tagihan: {rp(qrisPending.total)}
                </div>
                <div style={{ color: '#6b6560', fontSize: 12, marginTop: 2 }}>
                  Pembeli: {qrisPending.name}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
                <button
                  type="button"
                  className="btn o"
                  onClick={() =>
                    onOpenZoomImage(
                      QRIS_IMAGE,
                      'qris-ccn.jpeg',
                      'Kode QRIS Resmi CCN',
                      'Pindai atau unduh kode QRIS resmi CCN untuk menyelesaikan pembayaran.'
                    )
                  }
                >
                  Perbesar / Unduh QRIS
                </button>
              </div>
              <button
                className="btn"
                style={{ width: '100%' }}
                type="button"
                onClick={handleConfirmQrisPaid}
              >
                Saya Sudah Bayar via QRIS
              </button>
              <button
                className="btn o"
                style={{ width: '100%', marginTop: 8 }}
                type="button"
                onClick={() => setQrisPending(null)}
              >
                Kembali ke Keranjang
              </button>
            </div>
          </div>
        )}

        {completedInv && (
          <div id="rs" style={{ marginTop: 12 }}>
            <div className="card">
              <b>
                {completedInv.method === 'QRIS'
                  ? `Pembayaran QRIS berhasil, ${completedInv.name}!`
                  : `Pesanan diterima, ${completedInv.name}!`}
              </b>
              <p>
                No. pesanan: <b>{completedInv.no}</b>
                <br />
                Metode: {completedInv.method}
                <br />
                Status: <b>{completedInv.status || 'Menunggu pembayaran'}</b>
                <br />
                Total: <b>{rp(completedInv.total)}</b>
              </p>
              <p className="tag">{paymentGuide(completedInv.method)}</p>
              <p>
                Langkah terakhir: kirim konfirmasi ke WhatsApp kami, lalu lampirkan struk gambar di bawah ini.
              </p>
              <a
                className="btn"
                target="_blank"
                rel="noopener noreferrer"
                href={waOrderHref}
              >
                Konfirmasi via WhatsApp
              </a>{' '}
              <button
                className="btn o"
                type="button"
                onClick={() => onOpenInvoice(completedInv)}
              >
                Lihat &amp; Cetak Struk
              </button>
            </div>

            <div className="card dsi" style={{ marginTop: 12 }}>
              <b>Struk pesananmu (gambar)</b>
              <p className="tag" style={{ margin: '4px 0 0' }}>
                Lampirkan struk ini di chat WhatsApp bersama pesan konfirmasi.
              </p>
              {receiptUrl ? (
                <>
                  <img src={receiptUrl} alt="Struk pesanan CCN" />
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                    <button type="button" className="btn o" onClick={handleCopyReceipt}>
                      Salin gambar
                    </button>
                    <button
                      type="button"
                      className="btn o"
                      onClick={() =>
                        onOpenZoomImage(
                          receiptUrl,
                          `struk-${completedInv.no}.png`,
                          `Struk Pesanan ${completedInv.no}`
                        )
                      }
                    >
                      Perbesar gambar
                    </button>
                    {copyStatus && <span className="tag">{copyStatus}</span>}
                  </div>
                </>
              ) : (
                <p className="tag" style={{ margin: '8px 0' }}>
                  Membuat struk...
                </p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ==================== INVOICE MODAL ==================== */
interface InvoiceModalProps {
  invoice: InvoiceRecord | null;
  onClose: () => void;
  onViewImage: (inv: InvoiceRecord) => void;
}

export function InvoiceModal({ invoice, onClose, onViewImage }: InvoiceModalProps) {
  useEffect(() => {
    if (!invoice) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [invoice, onClose]);

  const waShareHref = invoice
    ? `https://wa.me/?text=${encodeURIComponent(
        `STRUK PEMBELIAN CCN\nNo. ${invoice.no}\n${invoice.date}\n\nPembeli: ${
          invoice.name
        }\n${invoice.items.map((i) => `- ${i.n} x${i.q} = ${rp(i.p * i.q)}`).join('\n')}${
          invoice.disc ? `\nDiskon CCN10: -${rp(invoice.disc)}` : ''
        }\nTotal: ${rp(invoice.total)}\nPembayaran: ${invoice.method}`
      )}`
    : '#';

  return (
    <div
      className={`modal${invoice ? ' on' : ''}`}
      id="iv"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="card" id="ivc">
        {invoice && (
          <>
            <div id="ivb">
              <div className="ivh">
                <div className="lg" role="img" aria-label="Logo CCN" style={{ width: 120, aspectRatio: '360/219' }} />
                <div style={{ textAlign: 'right' }}>
                  <b style={{ fontSize: 18, letterSpacing: '.08em' }}>STRUK PEMBELIAN</b>
                  <br />
                  <span>No. {invoice.no}</span>
                  <br />
                  <span className="tag">{invoice.date}</span>
                </div>
              </div>
              <div className="ivm">
                <div>
                  <span className="tag">Penjual</span>
                  <br />
                  <b>CCN (Creative Craft Nation)</b>
                  <br />
                  <span className="tag">WhatsApp 0851-5624-9864</span>
                </div>
                <div>
                  <span className="tag">Pembeli</span>
                  <br />
                  <b>{invoice.name}</b>
                  <br />
                  <span className="tag">{invoice.addr || '-'}</span>
                </div>
              </div>
              <table className="ivt">
                <thead>
                  <tr>
                    <th>Produk</th>
                    <th className="r">Jml</th>
                    <th className="r">Harga</th>
                    <th className="r">Subtotal</th>
                  </tr>
                </thead>
                <tbody>
                  {invoice.items.map((it, idx) => (
                    <tr key={idx}>
                      <td>{it.n}</td>
                      <td className="r">{it.q}</td>
                      <td className="r">{rp(it.p)}</td>
                      <td className="r">{rp(it.p * it.q)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="ivs">
                <div className="row">
                  <span>Subtotal</span>
                  <span>{rp(invoice.sub)}</span>
                </div>
                {invoice.disc > 0 && (
                  <div className="row">
                    <span>Diskon CCN10</span>
                    <span>-{rp(invoice.disc)}</span>
                  </div>
                )}
                <div className="row ivtot">
                  <b>Total</b>
                  <b>{rp(invoice.total)}</b>
                </div>
              </div>
              <div className="ivm" style={{ marginTop: 14 }}>
                <div>
                  <span className="tag">Metode pembayaran</span>
                  <br />
                  <b>{invoice.method}</b>
                </div>
                <div>
                  <span className="tag">Status</span>
                  <br />
                  <b>
                    {invoice.status ||
                      (invoice.method === 'QRIS' ? 'Sudah dibayar (QRIS)' : 'Menunggu pembayaran')}
                  </b>
                </div>
              </div>
              <p className="tag" style={{ textAlign: 'center', margin: '18px 0 0' }}>
                Terima kasih telah berbelanja di CCN (Creative Craft Nation). Struk ini dibuat otomatis oleh website.
              </p>
            </div>
            <div className="ivact" style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 18 }}>
              <button
                className="btn"
                type="button"
                onClick={() => {
                  try {
                    window.print();
                  } catch {
                    // ignore print error
                  }
                }}
              >
                Cetak / Simpan PDF
              </button>
              <button className="btn o" type="button" onClick={() => onViewImage(invoice)}>
                Struk sebagai gambar
              </button>
              <a
                className="btn o"
                id="ivwa"
                href={waShareHref}
                target="_blank"
                rel="noopener noreferrer"
              >
                Bagikan lewat WhatsApp
              </a>
              <button className="btn o" type="button" onClick={onClose}>
                Tutup
              </button>
            </div>
            <p className="tag ivact" style={{ margin: '10px 0 0' }}>
              Tombol Cetak membuka jendela cetak browser; pilih &ldquo;Simpan sebagai PDF&rdquo; untuk menyimpannya. Jika tidak muncul, tekan Ctrl+P (Cmd+P di Mac) saat struk terbuka.
            </p>
          </>
        )}
      </div>
    </div>
  );
}

/* ==================== IMAGE ZOOM MODAL (FOR RECEIPT & QRIS) ==================== */
interface ReceiptZoomModalProps {
  dataUrl: string | null;
  fileName: string;
  title?: string;
  caption?: string;
  onClose: () => void;
}

export function ReceiptZoomModal({
  dataUrl,
  fileName,
  title,
  caption,
  onClose,
}: ReceiptZoomModalProps) {
  const [msg, setMsg] = useState('');

  useEffect(() => {
    setMsg('');
  }, [dataUrl]);

  useEffect(() => {
    if (!dataUrl) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [dataUrl, onClose]);

  const handleDownload = () => {
    if (!dataUrl) return;
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = fileName;
    a.click();
    setMsg('Gambar berhasil diunduh.');
  };

  return (
    <div
      className={`modal${dataUrl ? ' on' : ''}`}
      id="dm"
      style={{ zIndex: 26 }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="card" style={{ maxWidth: 560, position: 'relative' }}>
        <button
          className="btn o"
          type="button"
          onClick={onClose}
          style={{ position: 'absolute', top: 12, right: 12, padding: '6px 12px', zIndex: 2 }}
        >
          Tutup
        </button>
        {dataUrl && (
          <div id="dmb" style={{ paddingTop: 34 }}>
            {title && <h3 style={{ margin: '0 0 10px' }}>{title}</h3>}
            <img
              src={dataUrl}
              alt={title || 'Struk pesanan CCN'}
              style={{
                display: 'block',
                width: '100%',
                borderRadius: 12,
                border: '1px solid var(--bd)',
                background: '#fff',
              }}
            />
            <p className="tag" style={{ margin: '10px 0' }}>
              {caption ||
                'Di HP: tekan lama gambar lalu pilih Simpan atau Bagikan. Di laptop: klik kanan gambar atau unduh untuk dilampirkan di chat WhatsApp penjual.'}
            </p>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
              <button type="button" className="btn" onClick={handleDownload}>
                Unduh Gambar
              </button>
              {msg && <span className="tag">{msg}</span>}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
