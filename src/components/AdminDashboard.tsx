import {
  CheckCircle2,
  ExternalLink,
  HelpCircle,
  LayoutDashboard,
  MessageSquare,
  Package,
  Plus,
  RotateCcw,
  Save,
  ShieldAlert,
  ShoppingBag,
  Trash2,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import {
  ADMIN_EMAIL,
  assetUrl,
  BagProduct,
  DEFAULT_FAQS,
  DEFAULT_SITE_CONFIG,
  FaqItemData,
  PRODUCTS,
  rp,
  SiteConfigData,
} from '../data/ccnData';
import {
  CatalogProductDoc,
  deleteCatalogProduct,
  deleteFaqItem,
  deleteForumPostDoc,
  ForumPostDoc,
  saveCatalogProduct,
  saveFaqItem,
  saveSiteConfig,
  StoredOrderDoc,
  subscribeAdminOrders,
  subscribeCatalogProducts,
  subscribeFaqItems,
  subscribeForumPosts,
  updateAdminOrderStatus,
  updateForumReplyDoc,
} from '../firebase';
import { AuthUser } from './Modals';

interface AdminDashboardProps {
  user: AuthUser | null;
  isAdmin: boolean;
  siteConfig: SiteConfigData;
  onOpenAuth: () => void;
  onExitAdmin: () => void;
  onToast: (msg: string) => void;
}

type AdminTab = 'konten' | 'produk' | 'pesanan' | 'faq';

const ORDER_STATUS_OPTIONS = [
  'Menunggu pembayaran',
  'Sudah dibayar (QRIS)',
  'Sudah dibayar (DANA)',
  'Dibayar',
  'Dikemas',
  'Dikirim',
  'Tiba',
] as const;

const PRESET_IMAGES = [
  { label: 'Patchwork Tote', url: '/assets/aistudio/image_0f62634e.png' },
  { label: 'Macrame Bag', url: '/assets/aistudio/image_39081197.png' },
  { label: 'Ribbon Crochet', url: '/assets/aistudio/image_f87f5b61.png' },
  { label: 'Sage Blossom', url: '/assets/aistudio/image_00e9978d.png' },
  { label: 'Vintage Cherry', url: '/assets/aistudio/image_6d448df5.png' },
];

export function AdminDashboard({
  user,
  isAdmin,
  siteConfig,
  onOpenAuth,
  onExitAdmin,
  onToast,
}: AdminDashboardProps) {
  const [tab, setTab] = useState<AdminTab>('konten');
  const [saving, setSaving] = useState(false);

  // Tab 1: Website content state
  const [cfg, setCfg] = useState<SiteConfigData>(siteConfig);
  useEffect(() => {
    setCfg(siteConfig);
  }, [siteConfig]);

  // Tab 2: Catalog products from Firestore
  const [dbProducts, setDbProducts] = useState<CatalogProductDoc[]>([]);
  const [editingProd, setEditingProd] = useState<CatalogProductDoc | null>(null);

  // Tab 3: Customer orders across all users
  const [orders, setOrders] = useState<StoredOrderDoc[]>([]);
  const [ordersErr, setOrdersErr] = useState('');
  const [orderFilter, setOrderFilter] = useState<string>('Semua');

  // Tab 4: FAQ & Forum
  const [dbFaqs, setDbFaqs] = useState<FaqItemData[]>([]);
  const [editingFaq, setEditingFaq] = useState<FaqItemData | null>(null);
  const [forumPosts, setForumPosts] = useState<ForumPostDoc[]>([]);
  const [replyDrafts, setReplyDrafts] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!isAdmin) return;
    const unsubProds = subscribeCatalogProducts(true, setDbProducts);
    const unsubFaqs = subscribeFaqItems(true, setDbFaqs);
    const unsubForum = subscribeForumPosts(true, (posts) => {
      setForumPosts(posts);
      setReplyDrafts((prev) => {
        const next = { ...prev };
        posts.forEach((p) => {
          if (next[p.id] === undefined) next[p.id] = p.a || '';
        });
        return next;
      });
    });
    const unsubOrders = subscribeAdminOrders(
      (list) => {
        setOrders(list);
        setOrdersErr('');
      },
      () => {
        setOrdersErr('Gagal memuat daftar pesanan pelanggan.');
      }
    );

    return () => {
      unsubProds();
      unsubFaqs();
      unsubForum();
      unsubOrders();
    };
  }, [isAdmin]);

  const effectiveProducts = useMemo<CatalogProductDoc[]>(() => {
    if (dbProducts.length > 0) return dbProducts;
    return PRODUCTS.map((p) => ({
      docId: `prod_${p.id}`,
      id: p.id,
      name: p.name,
      desc: p.desc,
      price: p.price,
      oldPrice: p.oldPrice || 0,
      category: p.category,
      badge: p.badge || '',
      image: p.image,
      material: p.material,
      technique: p.technique,
      dimensions: p.dimensions,
      active: true,
    }));
  }, [dbProducts]);

  const effectiveFaqs = useMemo<FaqItemData[]>(() => {
    if (dbFaqs.length > 0) return dbFaqs;
    return DEFAULT_FAQS;
  }, [dbFaqs]);

  const filteredOrders = useMemo(() => {
    if (orderFilter === 'Semua') return orders;
    return orders.filter((o) => (o.status || 'Menunggu pembayaran') === orderFilter);
  }, [orders, orderFilter]);

  const totalRevenue = useMemo(
    () => orders.reduce((sum, o) => sum + (Number(o.total) || 0), 0),
    [orders]
  );

  if (!user || !isAdmin) {
    return (
      <div className="w adm-gate-wrap">
        <div className="card adm-gate">
          <div className="adm-gate-ico" aria-hidden="true">
            <ShieldAlert size={28} />
          </div>
          <h2>Dashboard Khusus Admin CCN</h2>
          <p className="tag" style={{ maxWidth: 460, margin: '8px auto 16px' }}>
            {!user
              ? `Halaman ini dilindungi. Silakan masuk menggunakan akun admin terverifikasi (${ADMIN_EMAIL}) untuk mengubah konten website, katalog tas, FAQ, dan status pesanan pelanggan.`
              : `Akun saat ini (${user.email}) tidak memiliki izin admin. Silakan masuk dengan akun admin (${ADMIN_EMAIL}) yang terverifikasi.`}
          </p>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
            <button type="button" className="btn" onClick={onOpenAuth}>
              {user ? 'Ganti ke Akun Admin' : 'Masuk Sebagai Admin'}
            </button>
            <button type="button" className="btn o" onClick={onExitAdmin}>
              Kembali ke Toko
            </button>
          </div>
        </div>
      </div>
    );
  }

  const handleSaveSiteConfig = async () => {
    setSaving(true);
    try {
      await saveSiteConfig(cfg);
      onToast('Perubahan tampilan & konten website berhasil disimpan!');
    } catch {
      onToast('Gagal menyimpan pengaturan website. Periksa koneksi & izin admin.');
    } finally {
      setSaving(false);
    }
  };

  const handleResetSiteConfig = async () => {
    setSaving(true);
    try {
      setCfg(DEFAULT_SITE_CONFIG);
      await saveSiteConfig(DEFAULT_SITE_CONFIG);
      onToast('Konten website dikembalikan ke pengaturan awal.');
    } catch {
      onToast('Gagal mereset pengaturan website.');
    } finally {
      setSaving(false);
    }
  };

  const handleSeedProducts = async () => {
    setSaving(true);
    try {
      await Promise.all(
        PRODUCTS.map((p) =>
          saveCatalogProduct(`prod_${p.id}`, {
            id: p.id,
            name: p.name,
            desc: p.desc,
            price: p.price,
            oldPrice: p.oldPrice || 0,
            category: p.category,
            badge: p.badge || '',
            image: p.image,
            material: p.material,
            technique: p.technique,
            dimensions: p.dimensions,
            active: true,
          })
        )
      );
      onToast('5 produk awal berhasil disinkronkan ke Firestore.');
    } catch {
      onToast('Gagal menyinkronkan produk.');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveProduct = async () => {
    if (!editingProd) return;
    if (editingProd.name.trim().length < 2) {
      onToast('Nama produk minimal 2 karakter.');
      return;
    }
    setSaving(true);
    try {
      await saveCatalogProduct(editingProd.docId, {
        id: editingProd.id,
        name: editingProd.name,
        desc: editingProd.desc,
        price: editingProd.price,
        oldPrice: editingProd.oldPrice,
        category: editingProd.category,
        badge: editingProd.badge,
        image: editingProd.image,
        material: editingProd.material,
        technique: editingProd.technique,
        dimensions: editingProd.dimensions,
        active: editingProd.active,
      });
      setEditingProd(null);
      onToast('Produk tas berhasil disimpan ke Firestore!');
    } catch {
      onToast('Gagal menyimpan produk.');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteProduct = async (docId: string) => {
    setSaving(true);
    try {
      await deleteCatalogProduct(docId);
      if (editingProd?.docId === docId) setEditingProd(null);
      onToast('Produk dihapus dari Firestore.');
    } catch {
      onToast('Gagal menghapus produk.');
    } finally {
      setSaving(false);
    }
  };

  const handleSeedFaqs = async () => {
    setSaving(true);
    try {
      await Promise.all(DEFAULT_FAQS.map((f) => saveFaqItem(f)));
      onToast('Daftar FAQ bawaan berhasil disinkronkan ke Firestore.');
    } catch {
      onToast('Gagal menyinkronkan FAQ.');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveFaq = async () => {
    if (!editingFaq) return;
    if (editingFaq.question.trim().length < 3 || editingFaq.answer.trim().length < 3) {
      onToast('Pertanyaan dan jawaban minimal 3 karakter.');
      return;
    }
    setSaving(true);
    try {
      await saveFaqItem(editingFaq);
      setEditingFaq(null);
      onToast('FAQ berhasil disimpan!');
    } catch {
      onToast('Gagal menyimpan FAQ.');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteFaq = async (id: string) => {
    setSaving(true);
    try {
      await deleteFaqItem(id);
      if (editingFaq?.id === id) setEditingFaq(null);
      onToast('Item FAQ dihapus.');
    } catch {
      onToast('Gagal menghapus FAQ.');
    } finally {
      setSaving(false);
    }
  };

  const handleOrderStatusChange = async (userId: string, orderNo: string, nextStatus: string) => {
    try {
      await updateAdminOrderStatus(userId, orderNo, nextStatus);
      onToast(`Status pesanan ${orderNo} diperbarui ke "${nextStatus}".`);
    } catch {
      onToast(`Gagal memperbarui status pesanan ${orderNo}.`);
    }
  };

  return (
    <div className="w adm-wrap">
      <div className="adm-topbar">
        <div>
          <span className="pill">
            <LayoutDashboard size={13} aria-hidden="true" /> Mode Admin · {user.email}
          </span>
          <h2 style={{ marginTop: 8 }}>Dashboard Admin CCN</h2>
          <p className="sub" style={{ marginBottom: 0 }}>
            Kelola konten website, produk tas handmade, FAQ, forum, dan status pesanan pelanggan secara langsung.
          </p>
        </div>
        <button type="button" className="btn o" onClick={onExitAdmin}>
          <ExternalLink size={15} aria-hidden="true" /> Lihat Website Toko
        </button>
      </div>

      <div className="adm-stats">
        <div className="card adm-stat">
          <span className="tag">Total Pesanan</span>
          <b>{orders.length}</b>
        </div>
        <div className="card adm-stat">
          <span className="tag">Total Nilai Transaksi</span>
          <b>{rp(totalRevenue)}</b>
        </div>
        <div className="card adm-stat">
          <span className="tag">Produk Aktif</span>
          <b>{effectiveProducts.filter((p) => p.active).length}</b>
        </div>
        <div className="card adm-stat">
          <span className="tag">Pertanyaan Forum</span>
          <b>{forumPosts.length}</b>
        </div>
      </div>

      <div className="adm-tabs" role="tablist" aria-label="Menu Admin">
        <button
          type="button"
          className={`at${tab === 'konten' ? ' on' : ''}`}
          onClick={() => setTab('konten')}
        >
          <LayoutDashboard size={15} aria-hidden="true" /> Konten Website
        </button>
        <button
          type="button"
          className={`at${tab === 'produk' ? ' on' : ''}`}
          onClick={() => setTab('produk')}
        >
          <ShoppingBag size={15} aria-hidden="true" /> Produk Tas ({effectiveProducts.length})
        </button>
        <button
          type="button"
          className={`at${tab === 'pesanan' ? ' on' : ''}`}
          onClick={() => setTab('pesanan')}
        >
          <Package size={15} aria-hidden="true" /> Pesanan ({orders.length})
        </button>
        <button
          type="button"
          className={`at${tab === 'faq' ? ' on' : ''}`}
          onClick={() => setTab('faq')}
        >
          <HelpCircle size={15} aria-hidden="true" /> FAQ &amp; Forum
        </button>
      </div>

      {/* TAB 1: WEBSITE CONTENT */}
      {tab === 'konten' && (
        <div className="card adm-panel">
          <h3>Edit Konten &amp; Identitas Website</h3>
          <p className="tag" style={{ marginTop: 0 }}>
            Perubahan yang disimpan di sini akan langsung tampil secara real-time di halaman Beranda, Tentang, dan Footer pengunjung.
          </p>

          <div className="adm-grid2">
            <div>
              <label>Banner Pengumuman Atas (opsional)</label>
              <input
                value={cfg.announcement}
                onChange={(e) => setCfg({ ...cfg, announcement: e.target.value })}
                placeholder="Contoh: Promo Pembelian Pertama — Gunakan kode CCN10!"
              />

              <label>Label Pill Hero (Beranda)</label>
              <input
                value={cfg.heroPill}
                onChange={(e) => setCfg({ ...cfg, heroPill: e.target.value })}
              />

              <label>Judul Utama Hero (Beranda)</label>
              <input
                value={cfg.heroTitle}
                onChange={(e) => setCfg({ ...cfg, heroTitle: e.target.value })}
              />

              <label>Subjudul Hero</label>
              <textarea
                rows={3}
                value={cfg.heroSubtitle}
                onChange={(e) => setCfg({ ...cfg, heroSubtitle: e.target.value })}
              />

              <label>Nomor WhatsApp Admin (format 628...)</label>
              <input
                value={cfg.whatsapp}
                onChange={(e) => setCfg({ ...cfg, whatsapp: e.target.value })}
                placeholder="6285156249864"
              />
            </div>

            <div>
              <label>Deskripsi Tentang CCN</label>
              <textarea
                rows={4}
                value={cfg.aboutSummary}
                onChange={(e) => setCfg({ ...cfg, aboutSummary: e.target.value })}
              />

              <label>Visi CCN</label>
              <textarea
                rows={3}
                value={cfg.visi}
                onChange={(e) => setCfg({ ...cfg, visi: e.target.value })}
              />

              <label>Tujuan CCN</label>
              <textarea
                rows={3}
                value={cfg.tujuan}
                onChange={(e) => setCfg({ ...cfg, tujuan: e.target.value })}
              />

              <div className="adm-grid2" style={{ gap: 10 }}>
                <div>
                  <label>Akun Media Sosial</label>
                  <input
                    value={cfg.socialHandle}
                    onChange={(e) => setCfg({ ...cfg, socialHandle: e.target.value })}
                  />
                </div>
                <div>
                  <label>Teks Footer</label>
                  <input
                    value={cfg.footerText}
                    onChange={(e) => setCfg({ ...cfg, footerText: e.target.value })}
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="adm-actions">
            <button
              type="button"
              className="btn"
              disabled={saving}
              onClick={() => void handleSaveSiteConfig()}
            >
              <Save size={15} aria-hidden="true" />{' '}
              {saving ? 'Menyimpan...' : 'Simpan Perubahan Website'}
            </button>
            <button
              type="button"
              className="btn o"
              disabled={saving}
              onClick={() => void handleResetSiteConfig()}
            >
              <RotateCcw size={15} aria-hidden="true" /> Reset Default
            </button>
          </div>
        </div>
      )}

      {/* TAB 2: CATALOG PRODUCTS */}
      {tab === 'produk' && (
        <div className="card adm-panel">
          <div className="adm-panel-hd">
            <div>
              <h3>Kelola Produk Tas</h3>
              <p className="tag" style={{ margin: 0 }}>
                Ubah harga, deskripsi, badge promo, atau tambah koleksi tas baru secara langsung.
              </p>
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {dbProducts.length === 0 && (
                <button
                  type="button"
                  className="btn o"
                  disabled={saving}
                  onClick={() => void handleSeedProducts()}
                >
                  Sinkronkan 5 Produk Awal
                </button>
              )}
              <button
                type="button"
                className="btn"
                onClick={() => {
                  const maxId = effectiveProducts.reduce((m, p) => Math.max(m, p.id), -1);
                  const nextId = maxId + 1;
                  setEditingProd({
                    docId: `prod_${nextId}_${Date.now()}`,
                    id: nextId,
                    name: '',
                    desc: '',
                    price: 100000,
                    oldPrice: 0,
                    category: 'Tas Rajut',
                    badge: 'Baru',
                    image: PRESET_IMAGES[0].url,
                    material: 'Benang katun rajut pilihan',
                    technique: 'Rajut tangan handmade',
                    dimensions: '28 × 22 × 9 cm',
                    active: true,
                  });
                }}
              >
                <Plus size={15} aria-hidden="true" /> Tambah Tas Baru
              </button>
            </div>
          </div>

          {editingProd && (
            <div className="adm-editor">
              <h4>{editingProd.name ? `Edit: ${editingProd.name}` : 'Tambah Tas Baru'}</h4>
              <div className="adm-grid2">
                <div>
                  <label>Nama Produk</label>
                  <input
                    value={editingProd.name}
                    onChange={(e) => setEditingProd({ ...editingProd, name: e.target.value })}
                    placeholder="Contoh: Pastel Daisy Crochet Tote"
                  />

                  <div className="adm-grid2" style={{ gap: 10 }}>
                    <div>
                      <label>Harga (Rp)</label>
                      <input
                        type="number"
                        min={1000}
                        step={1000}
                        value={editingProd.price}
                        onChange={(e) =>
                          setEditingProd({ ...editingProd, price: Number(e.target.value) || 0 })
                        }
                      />
                    </div>
                    <div>
                      <label>Harga Coret (opsional, 0 = tidak ada)</label>
                      <input
                        type="number"
                        min={0}
                        step={1000}
                        value={editingProd.oldPrice}
                        onChange={(e) =>
                          setEditingProd({
                            ...editingProd,
                            oldPrice: Number(e.target.value) || 0,
                          })
                        }
                      />
                    </div>
                  </div>

                  <div className="adm-grid2" style={{ gap: 10 }}>
                    <div>
                      <label>Kategori</label>
                      <select
                        value={editingProd.category}
                        onChange={(e) =>
                          setEditingProd({
                            ...editingProd,
                            category: e.target.value as BagProduct['category'],
                          })
                        }
                      >
                        <option value="Tas Rajut">Tas Rajut</option>
                        <option value="Simpul Tali">Simpul Tali</option>
                        <option value="Kain Perca">Kain Perca</option>
                      </select>
                    </div>
                    <div>
                      <label>Badge</label>
                      <select
                        value={editingProd.badge}
                        onChange={(e) =>
                          setEditingProd({
                            ...editingProd,
                            badge: e.target.value as CatalogProductDoc['badge'],
                          })
                        }
                      >
                        <option value="">Tanpa Badge</option>
                        <option value="Terlaris">Terlaris</option>
                        <option value="Baru">Baru</option>
                        <option value="Diskon">Diskon</option>
                      </select>
                    </div>
                  </div>

                  <label>Deskripsi</label>
                  <textarea
                    rows={3}
                    value={editingProd.desc}
                    onChange={(e) => setEditingProd({ ...editingProd, desc: e.target.value })}
                  />
                </div>

                <div>
                  <label>Foto Produk (URL atau pilih galeri CCN)</label>
                  <input
                    value={editingProd.image}
                    onChange={(e) => setEditingProd({ ...editingProd, image: e.target.value })}
                  />
                  <div className="adm-presets">
                    {PRESET_IMAGES.map((img) => (
                      <button
                        key={img.url}
                        type="button"
                        className={`adm-preset${editingProd.image === img.url ? ' on' : ''}`}
                        onClick={() => setEditingProd({ ...editingProd, image: img.url })}
                      >
                        {img.label}
                      </button>
                    ))}
                  </div>

                  <label>Bahan</label>
                  <input
                    value={editingProd.material}
                    onChange={(e) => setEditingProd({ ...editingProd, material: e.target.value })}
                  />

                  <label>Teknik</label>
                  <input
                    value={editingProd.technique}
                    onChange={(e) =>
                      setEditingProd({ ...editingProd, technique: e.target.value })
                    }
                  />

                  <div className="adm-grid2" style={{ gap: 10 }}>
                    <div>
                      <label>Dimensi</label>
                      <input
                        value={editingProd.dimensions}
                        onChange={(e) =>
                          setEditingProd({ ...editingProd, dimensions: e.target.value })
                        }
                      />
                    </div>
                    <div>
                      <label>Status Tampil</label>
                      <select
                        value={editingProd.active ? '1' : '0'}
                        onChange={(e) =>
                          setEditingProd({ ...editingProd, active: e.target.value === '1' })
                        }
                      >
                        <option value="1">Aktif (Tampil di Toko)</option>
                        <option value="0">Disembunyikan</option>
                      </select>
                    </div>
                  </div>
                </div>
              </div>

              <div className="adm-actions">
                <button
                  type="button"
                  className="btn"
                  disabled={saving}
                  onClick={() => void handleSaveProduct()}
                >
                  <Save size={15} aria-hidden="true" />{' '}
                  {saving ? 'Menyimpan...' : 'Simpan Produk'}
                </button>
                <button type="button" className="btn o" onClick={() => setEditingProd(null)}>
                  Batal
                </button>
              </div>
            </div>
          )}

          <div className="adm-prod-list">
            {effectiveProducts.map((p) => (
              <div className="adm-prod-row" key={p.docId}>
                <img src={assetUrl(p.image)} alt={p.name} className="adm-prod-img" />
                <div style={{ flex: 1, minWidth: 180 }}>
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                    <b>{p.name}</b>
                    <span className="tag">· {p.category}</span>
                    {!p.active && <span className="rp-status pending">Disembunyikan</span>}
                    {p.badge && <span className="rp-status paid">{p.badge}</span>}
                  </div>
                  <div style={{ marginTop: 2 }}>
                    <b>{rp(p.price)}</b>{' '}
                    {p.oldPrice > 0 && <s className="tag">{rp(p.oldPrice)}</s>}
                  </div>
                  <p className="tag" style={{ margin: '4px 0 0' }}>
                    {p.desc}
                  </p>
                </div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    className="btn o"
                    onClick={() => setEditingProd({ ...p })}
                  >
                    Edit
                  </button>
                  {dbProducts.some((d) => d.docId === p.docId) && (
                    <button
                      type="button"
                      className="btn o"
                      aria-label={`Hapus ${p.name}`}
                      onClick={() => void handleDeleteProduct(p.docId)}
                    >
                      <Trash2 size={14} aria-hidden="true" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 3: ORDERS */}
      {tab === 'pesanan' && (
        <div className="card adm-panel">
          <div className="adm-panel-hd">
            <div>
              <h3>Daftar Pesanan Pelanggan</h3>
              <p className="tag" style={{ margin: 0 }}>
                Perbarui status pembayaran atau pengiriman — perubahan langsung muncul di Riwayat Pesanan pelanggan.
              </p>
            </div>
          </div>

          <div className="rp-filters" style={{ marginBottom: 14 }}>
            {(['Semua', ...ORDER_STATUS_OPTIONS] as const).map((st) => (
              <button
                key={st}
                type="button"
                className={`rp-fbtn${orderFilter === st ? ' on' : ''}`}
                onClick={() => setOrderFilter(st)}
              >
                {st}
              </button>
            ))}
          </div>

          {ordersErr ? (
            <p className="amsg">{ordersErr}</p>
          ) : filteredOrders.length === 0 ? (
            <div className="rp-empty">
              <Package size={24} aria-hidden="true" />
              <p className="tag">Belum ada pesanan pelanggan pada filter ini.</p>
            </div>
          ) : (
            <div className="rp-list">
              {filteredOrders.map((o) => {
                const curStatus =
                  o.status ||
                  (o.method === 'QRIS'
                    ? 'Sudah dibayar (QRIS)'
                    : o.method === 'E-Wallet DANA'
                      ? 'Sudah dibayar (DANA)'
                      : 'Menunggu pembayaran');
                const isPaid =
                  curStatus.includes('Sudah dibayar') ||
                  curStatus === 'Dibayar' ||
                  curStatus === 'Tiba';
                const isProcess = curStatus === 'Dikemas' || curStatus === 'Dikirim';
                return (
                  <div className="od rp-card" key={`${o.userId}-${o.no}`}>
                    <div className="rp-top" style={{ flexWrap: 'wrap' }}>
                      <div>
                        <b className="rp-no">{o.no}</b>{' '}
                        <span className="tag">· {o.date}</span>
                        <div style={{ marginTop: 4, fontSize: 13 }}>
                          <b>{o.name}</b> — <span className="tag">{o.addr}</span>
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                        <span
                          className={`rp-status ${
                            isPaid ? 'paid' : isProcess ? 'process' : 'pending'
                          }`}
                        >
                          <CheckCircle2 size={13} aria-hidden="true" />
                          {curStatus}
                        </span>
                        <select
                          aria-label={`Ubah status pesanan ${o.no}`}
                          value={curStatus}
                          style={{ width: 'auto', margin: 0, padding: '6px 10px', fontSize: 13 }}
                          onChange={(e) =>
                            void handleOrderStatusChange(o.userId, o.no, e.target.value)
                          }
                        >
                          {ORDER_STATUS_OPTIONS.map((opt) => (
                            <option key={opt} value={opt}>
                              {opt}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div className="rp-items">
                      {o.items.map((it, idx) => (
                        <div className="rp-item" key={idx}>
                          <span>
                            {it.n} <b>×{it.q}</b>
                          </span>
                          <span className="tag">{rp(it.p * it.q)}</span>
                        </div>
                      ))}
                    </div>

                    <div className="rp-meta">
                      <div>
                        <span className="tag">Total</span>
                        <div className="rp-total">{rp(o.total)}</div>
                      </div>
                      <span className="rp-method">{o.method}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB 4: FAQ & FORUM */}
      {tab === 'faq' && (
        <div className="two">
          <div className="card adm-panel">
            <div className="adm-panel-hd">
              <div>
                <h3>Kelola FAQ</h3>
                <p className="tag" style={{ margin: 0 }}>
                  Tambah atau ubah pertanyaan umum di halaman Beranda.
                </p>
              </div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {dbFaqs.length === 0 && (
                  <button
                    type="button"
                    className="btn o"
                    disabled={saving}
                    onClick={() => void handleSeedFaqs()}
                  >
                    Sinkronkan FAQ Awal
                  </button>
                )}
                <button
                  type="button"
                  className="btn"
                  onClick={() =>
                    setEditingFaq({
                      id: `faq_${Date.now()}`,
                      question: '',
                      answer: '',
                      sortOrder: effectiveFaqs.length + 1,
                      active: true,
                    })
                  }
                >
                  <Plus size={14} aria-hidden="true" /> Tambah FAQ
                </button>
              </div>
            </div>

            {editingFaq && (
              <div className="adm-editor">
                <label>Pertanyaan</label>
                <input
                  value={editingFaq.question}
                  onChange={(e) => setEditingFaq({ ...editingFaq, question: e.target.value })}
                />
                <label>Jawaban</label>
                <textarea
                  rows={3}
                  value={editingFaq.answer}
                  onChange={(e) => setEditingFaq({ ...editingFaq, answer: e.target.value })}
                />
                <div className="adm-grid2" style={{ gap: 10 }}>
                  <div>
                    <label>Urutan</label>
                    <input
                      type="number"
                      value={editingFaq.sortOrder}
                      onChange={(e) =>
                        setEditingFaq({ ...editingFaq, sortOrder: Number(e.target.value) || 1 })
                      }
                    />
                  </div>
                  <div>
                    <label>Status</label>
                    <select
                      value={editingFaq.active ? '1' : '0'}
                      onChange={(e) =>
                        setEditingFaq({ ...editingFaq, active: e.target.value === '1' })
                      }
                    >
                      <option value="1">Tampilkan</option>
                      <option value="0">Sembunyikan</option>
                    </select>
                  </div>
                </div>
                <div className="adm-actions">
                  <button
                    type="button"
                    className="btn"
                    disabled={saving}
                    onClick={() => void handleSaveFaq()}
                  >
                    Simpan FAQ
                  </button>
                  <button type="button" className="btn o" onClick={() => setEditingFaq(null)}>
                    Batal
                  </button>
                </div>
              </div>
            )}

            <div className="rp-list">
              {effectiveFaqs.map((f) => (
                <div className="od rp-card" key={f.id}>
                  <div className="row" style={{ gap: 8 }}>
                    <b>{f.question}</b>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button
                        type="button"
                        className="btn o"
                        style={{ padding: '4px 10px', fontSize: 12 }}
                        onClick={() => setEditingFaq({ ...f })}
                      >
                        Edit
                      </button>
                      {dbFaqs.some((d) => d.id === f.id) && (
                        <button
                          type="button"
                          className="btn o"
                          style={{ padding: '4px 10px', fontSize: 12 }}
                          onClick={() => void handleDeleteFaq(f.id)}
                        >
                          <Trash2 size={12} aria-hidden="true" />
                        </button>
                      )}
                    </div>
                  </div>
                  <p className="tag" style={{ margin: '6px 0 0' }}>
                    {f.answer}
                  </p>
                </div>
              ))}
            </div>
          </div>

          <div className="card adm-panel">
            <h3>
              <MessageSquare size={17} style={{ verticalAlign: 'middle', marginRight: 6 }} />
              Balas Forum Tanya Jawab
            </h3>
            <p className="tag" style={{ marginTop: 0 }}>
              Pertanyaan yang masuk lewat Forum oleh akun terverifikasi dapat dibalas langsung dari sini.
            </p>
            {forumPosts.length === 0 ? (
              <div className="rp-empty">
                <MessageSquare size={22} aria-hidden="true" />
                <p className="tag">Belum ada pertanyaan baru dari pelanggan di Firestore.</p>
              </div>
            ) : (
              <div className="rp-list">
                {forumPosts.map((fp) => (
                  <div className="od rp-card" key={fp.id}>
                    <div className="row">
                      <b>{fp.n}</b>
                      <span className={`rp-status ${fp.a ? 'paid' : 'pending'}`}>
                        {fp.a ? 'Sudah dijawab' : 'Menunggu jawaban'}
                      </span>
                    </div>
                    <p style={{ margin: '6px 0' }}>{fp.q}</p>
                    <label>Jawaban Tim CCN</label>
                    <textarea
                      rows={2}
                      value={replyDrafts[fp.id] ?? fp.a}
                      onChange={(e) =>
                        setReplyDrafts((prev) => ({ ...prev, [fp.id]: e.target.value }))
                      }
                      placeholder="Tulis balasan resmi tim CCN..."
                    />
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      <button
                        type="button"
                        className="btn"
                        style={{ padding: '6px 12px', fontSize: 12.5 }}
                        onClick={async () => {
                          try {
                            await updateForumReplyDoc(
                              fp.id,
                              replyDrafts[fp.id] ?? fp.a,
                              fp.visible
                            );
                            onToast('Balasan forum disimpan.');
                          } catch {
                            onToast('Gagal menyimpan balasan forum.');
                          }
                        }}
                      >
                        Kirim Balasan
                      </button>
                      <button
                        type="button"
                        className="btn o"
                        style={{ padding: '6px 12px', fontSize: 12.5 }}
                        onClick={async () => {
                          try {
                            await deleteForumPostDoc(fp.id);
                            onToast('Postingan forum dihapus.');
                          } catch {
                            onToast('Gagal menghapus postingan.');
                          }
                        }}
                      >
                        <Trash2 size={13} aria-hidden="true" /> Hapus
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
