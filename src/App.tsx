import { onAuthStateChanged, signOut } from 'firebase/auth';
import { EyeOff, KeyRound, Lock, ShieldCheck } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AdminDashboard } from './components/AdminDashboard';
import { EffectsLayer } from './components/EffectsLayer';
import { MascotWidget } from './components/MascotWidget';
import {
  AuthModal,
  AuthUser,
  CartModal,
  InvoiceModal,
  ProductDetailModal,
  ReceiptZoomModal,
  UserOrder,
} from './components/Modals';
import { TeamZoomSection } from './components/TeamZoomSection';
import {
  ARTICLES,
  assetUrl,
  BAG_VARIANTS,
  BagProduct,
  CartItem,
  DEFAULT_FAQS,
  DEFAULT_SITE_CONFIG,
  FaqItemData,
  INITIAL_FORUM,
  InvoiceRecord,
  ORDER_STAGES,
  PAGE_IDS,
  PageId,
  PRODUCTS,
  QRIS_IMAGE,
  QUIZ_QUESTIONS,
  rp,
  SiteConfigData,
  TrackOrderRecord,
  VIDEO_TUTORIALS,
} from './data/ccnData';
import {
  auth,
  CatalogProductDoc,
  createForumPostDoc,
  ensureUserProfile,
  ForumPostDoc,
  isAdminEmail,
  saveUserOrderDoc,
  subscribeCatalogProducts,
  subscribeFaqItems,
  subscribeForumPosts,
  subscribeSiteConfig,
  subscribeUserOrders,
  updateUserProfileDoc,
} from './firebase';
import { renderReceiptCanvas } from './utils/receiptCanvas';

const CART_KEY = 'ccn_cart';
const WISH_KEY = 'ccn_wish';
const FORUM_KEY = 'ccn_bag_forum';
const TRACK_KEY = 'ccn_bag_track';

const DEMO_T0 = Date.now() - 70000;
const DEMO_ORDERS: Record<string, TrackOrderRecord> = {
  'CCN-123456': {
    ts: DEMO_T0,
    name: 'Pembeli Contoh',
    total: 220000,
    method: 'QRIS',
    items: [
      'Sage Blossom Crochet Bag – Ukuran Standar ×1',
      'Floral Patchwork Tote – Ukuran Standar ×1',
    ],
  },
  'CCN-000001': {
    ts: DEMO_T0 - 1e7,
    name: 'Pembeli Contoh',
    total: 120000,
    method: 'E-Wallet (GoPay / DANA)',
    items: ['Vintage Cherry Crochet Bag – Ukuran Standar ×1'],
  },
};

function readHashPage(): PageId {
  const h = (window.location.hash || '').slice(1) as PageId;
  return PAGE_IDS.includes(h) ? h : 'beranda';
}

export default function App() {
  const [page, setPage] = useState<PageId>(readHashPage);
  const [headerScrolled, setHeaderScrolled] = useState(false);

  // Toast
  const [toastMsg, setToastMsg] = useState('');
  const [toastVisible, setToastVisible] = useState(false);
  const toastTimer = useRef<number | undefined>(undefined);
  const showToast = useCallback((msg: string) => {
    setToastMsg(msg);
    setToastVisible(true);
    window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToastVisible(false), 2800);
  }, []);

  // Firebase Auth & Firestore User State
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const pendingRegInfo = useRef<{ name?: string; addr?: string }>({});
  const reopenCartAfterAuth = useRef(false);

  const syncSignedInUser = useCallback(async () => {
    const fbUser = auth.currentUser;
    if (!fbUser) {
      setCurrentUser(null);
      return false;
    }

    const baseName =
      pendingRegInfo.current.name ||
      fbUser.displayName ||
      (fbUser.email ? fbUser.email.split('@')[0] : 'Pelanggan');

    if (!fbUser.emailVerified) {
      setCurrentUser({
        uid: fbUser.uid,
        name: baseName,
        email: fbUser.email || '',
        emailVerified: false,
        addr: pendingRegInfo.current.addr || '',
        orders: [],
      });
      return false;
    }

    try {
      const profile = await ensureUserProfile(
        fbUser,
        pendingRegInfo.current.name,
        pendingRegInfo.current.addr
      );
      pendingRegInfo.current = {};
      setCurrentUser((prev) => ({
        uid: fbUser.uid,
        name: profile?.name || baseName,
        email: profile?.email || fbUser.email || '',
        emailVerified: true,
        addr: profile?.addr || prev?.addr || '',
        orders: prev?.uid === fbUser.uid ? prev.orders : [],
      }));
    } catch (err) {
      console.error('Failed to sync profile:', err);
      setCurrentUser((prev) => ({
        uid: fbUser.uid,
        name: baseName,
        email: fbUser.email || '',
        emailVerified: true,
        addr: prev?.addr || '',
        orders: prev?.uid === fbUser.uid ? prev.orders : [],
      }));
    }
    return true;
  }, []);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (fbUser) => {
      setAuthReady(true);
      if (!fbUser) {
        setCurrentUser(null);
        return;
      }
      void syncSignedInUser();
    });
    return () => unsub();
  }, [syncSignedInUser]);

  useEffect(() => {
    if (!authReady || !currentUser?.uid || !currentUser.emailVerified) return;
    const unsub = subscribeUserOrders(
      currentUser.uid,
      (docs) => {
        const mapped: UserOrder[] = docs.map((d) => ({
          no: d.no,
          t: d.total,
          m: d.method,
          d: d.date,
          status: d.status,
          items: d.items,
          inv: {
            no: d.no,
            date: d.date,
            name: d.name,
            addr: d.addr,
            method: d.method,
            status: d.status,
            items: d.items,
            sub: d.sub,
            disc: d.disc,
            total: d.total,
          },
        }));
        setCurrentUser((prev) => (prev && prev.uid === currentUser.uid ? { ...prev, orders: mapped } : prev));
      },
      (err) => {
        console.error('Order listener error:', err);
      }
    );
    return () => unsub();
  }, [authReady, currentUser?.uid, currentUser?.emailVerified]);

  // Wishlist
  const [wishlist, setWishlist] = useState<string[]>(() => {
    try {
      const w = JSON.parse(localStorage.getItem(WISH_KEY) || '[]');
      return Array.isArray(w) ? w : [];
    } catch {
      return [];
    }
  });

  const toggleWishlist = useCallback((name: string) => {
    setWishlist((prev) => {
      const next = prev.includes(name) ? prev.filter((x) => x !== name) : [...prev, name];
      try {
        localStorage.setItem(WISH_KEY, JSON.stringify(next));
      } catch {
        // ignore
      }
      return next;
    });
  }, []);

  // Cart
  const [cart, setCart] = useState<CartItem[]>(() => {
    try {
      const c = JSON.parse(localStorage.getItem(CART_KEY) || '[]');
      return Array.isArray(c) ? c : [];
    } catch {
      return [];
    }
  });
  const [cartBump, setCartBump] = useState(false);

  const persistCart = useCallback((next: CartItem[]) => {
    setCart(next);
    try {
      localStorage.setItem(CART_KEY, JSON.stringify(next));
    } catch {
      // ignore
    }
    setCartBump(false);
    requestAnimationFrame(() => setCartBump(true));
  }, []);

  // Live CMS state from Firestore (falls back seamlessly to defaults)
  const [siteConfig, setSiteConfig] = useState<SiteConfigData>(DEFAULT_SITE_CONFIG);
  const [cmsProducts, setCmsProducts] = useState<CatalogProductDoc[] | null>(null);
  const [cmsFaqs, setCmsFaqs] = useState<FaqItemData[] | null>(null);
  const [cmsForumPosts, setCmsForumPosts] = useState<ForumPostDoc[]>([]);

  const isAdmin = isAdminEmail(currentUser?.email, currentUser?.emailVerified);

  useEffect(() => {
    const unsubCfg = subscribeSiteConfig((remote) => {
      if (!remote) {
        setSiteConfig(DEFAULT_SITE_CONFIG);
      } else {
        setSiteConfig({ ...DEFAULT_SITE_CONFIG, ...remote });
      }
    });
    const unsubProds = subscribeCatalogProducts(false, (items) => {
      setCmsProducts(items.length > 0 ? items : null);
    });
    const unsubFaqs = subscribeFaqItems(false, (items) => {
      setCmsFaqs(items.length > 0 ? items : null);
    });
    const unsubForum = subscribeForumPosts(false, (items) => {
      setCmsForumPosts(items);
    });

    return () => {
      unsubCfg();
      unsubProds();
      unsubFaqs();
      unsubForum();
    };
  }, []);

  const liveProducts = useMemo<BagProduct[]>(() => {
    if (!cmsProducts) return PRODUCTS;
    return cmsProducts.map((cp) => {
      const base = PRODUCTS.find((p) => p.id === cp.id);
      return {
        id: cp.id,
        name: cp.name,
        desc: cp.desc,
        price: cp.price,
        oldPrice: cp.oldPrice > 0 ? cp.oldPrice : undefined,
        category: cp.category,
        badge: cp.badge || undefined,
        popularity: base?.popularity ?? 90,
        image: assetUrl(cp.image),
        tint: base?.tint ?? '#4f46e5',
        colors: base?.colors ?? [{ name: 'Warna Standar', hex: '#4f46e5' }],
        material: cp.material,
        technique: cp.technique,
        dimensions: cp.dimensions,
        features: base?.features ?? ['Kerajinan tangan CCN', 'Kualitas rapi', 'Unik & stylish'],
      };
    });
  }, [cmsProducts]);

  const liveFaqs = useMemo<FaqItemData[]>(() => {
    return cmsFaqs && cmsFaqs.length > 0 ? cmsFaqs : DEFAULT_FAQS;
  }, [cmsFaqs]);

  // Product filters & variants per card
  const [searchQuery, setSearchQuery] = useState('');
  const [sortOrder, setSortOrder] = useState<'p' | 'lo' | 'hi' | 'az'>('p');
  const [selectedCategory, setSelectedCategory] = useState<string>('Semua');
  const [cardVariants, setCardVariants] = useState<Record<number, string>>({});

  const categories = useMemo(() => {
    const uniqueCats = Array.from(new Set(liveProducts.map((p) => p.category)));
    return ['Semua', ...uniqueCats, 'Favorit'];
  }, [liveProducts]);

  const filteredProducts = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const list = liveProducts.filter((p) => {
      const catMatch =
        selectedCategory === 'Semua' ||
        (selectedCategory === 'Favorit'
          ? wishlist.includes(p.name)
          : p.category === selectedCategory);
      const qMatch = `${p.name} ${p.desc} ${p.category}`.toLowerCase().includes(q);
      return catMatch && qMatch;
    });

    return list.sort((a, b) => {
      if (sortOrder === 'lo') return a.price - b.price;
      if (sortOrder === 'hi') return b.price - a.price;
      if (sortOrder === 'az') return a.name.localeCompare(b.name);
      return b.popularity - a.popularity;
    });
  }, [liveProducts, searchQuery, sortOrder, selectedCategory, wishlist]);

  // Modals state
  const [authModal, setAuthModal] = useState<{
    open: boolean;
    mode: 'login' | 'reg';
    fromCheckout?: boolean;
  }>({
    open: false,
    mode: 'login',
    fromCheckout: false,
  });
  const [detailProduct, setDetailProduct] = useState<BagProduct | null>(null);
  const [cartOpen, setCartOpen] = useState(false);
  const [activeInvoice, setActiveInvoice] = useState<InvoiceRecord | null>(null);
  const [zoomReceipt, setZoomReceipt] = useState<{
    url: string;
    file: string;
    title?: string;
    caption?: string;
  } | null>(null);

  // Learning articles & quiz
  const [openArticles, setOpenArticles] = useState<Record<number, boolean>>({});
  const [quizIdx, setQuizIdx] = useState(0);
  const [quizScore, setQuizScore] = useState(0);
  const [quizPicked, setQuizPicked] = useState<number | null>(null);

  // Forum
  const [forumPosts, setForumPosts] = useState(() => {
    try {
      const s = localStorage.getItem(FORUM_KEY);
      if (s) {
        const parsed = JSON.parse(s);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch {
      // ignore
    }
    return INITIAL_FORUM;
  });
  const [forumName, setForumName] = useState('');
  const [forumQuestion, setForumQuestion] = useState('');
  const [forumErr, setForumErr] = useState('');

  useEffect(() => {
    if (currentUser && !forumName) {
      setForumName(currentUser.name);
    }
  }, [currentUser, forumName]);

  // Order Tracker
  const [trackedOrders, setTrackedOrders] = useState<Record<string, TrackOrderRecord>>(() => {
    try {
      return JSON.parse(localStorage.getItem(TRACK_KEY) || '{}') || {};
    } catch {
      return {};
    }
  });
  const [trackInput, setTrackInput] = useState('');
  const [trackCode, setTrackCode] = useState<string | null>(null);
  const [trackRecord, setTrackRecord] = useState<TrackOrderRecord | null>(null);
  const [trackSearched, setTrackSearched] = useState(false);
  const [tickNow, setTickNow] = useState(Date.now());

  useEffect(() => {
    if (!trackRecord) return;
    const id = window.setInterval(() => setTickNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [trackRecord]);

  // Routing & scroll behaviors
  useEffect(() => {
    const onHashChange = () => {
      setPage(readHashPage());
      window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
    };
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  useEffect(() => {
    const onScroll = () => setHeaderScrolled(window.scrollY > 10);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Scroll reveal animation matching original HTML (safe across page revisits & tall cards)
  useEffect(() => {
    if (page === 'admin') return;

    const els = Array.from(
      document.querySelectorAll<HTMLElement>(
        '[data-pg].show .hero>div:first-child>*, [data-pg].show .hero>.ph, [data-pg].show .w>h2, [data-pg].show .w>.sub, [data-pg].show .w>h3, [data-pg].show .card, [data-pg].show .tc'
      )
    );

    const timers: number[] = [];
    const observed: HTMLElement[] = [];

    const reveal = (t: HTMLElement) => {
      if (t.dataset.s === 'in') {
        t.classList.remove('rv', 'in');
        t.style.transitionDelay = '';
        return;
      }
      t.dataset.s = 'in';
      t.classList.add('rv', 'in');
      const tid = window.setTimeout(() => {
        t.classList.remove('rv', 'in');
        t.style.transitionDelay = '';
      }, 1400);
      timers.push(tid);
    };

    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          const t = e.target as HTMLElement;
          if ((e.isIntersecting || e.intersectionRatio >= 0.02) && t.dataset.s !== 'in') {
            reveal(t);
            io.unobserve(t);
          }
        });
      },
      { threshold: 0.01 }
    );

    const vh = window.innerHeight || 800;
    els.forEach((h) => {
      if (
        h.closest('.modal') ||
        h.closest('#fl') ||
        h.closest('[data-pg="admin"]') ||
        h.classList.contains('pn')
      ) {
        return;
      }
      if (h.dataset.s === 'in') {
        h.classList.remove('rv', 'in');
        h.style.transitionDelay = '';
        return;
      }
      const rect = h.getBoundingClientRect();
      if (rect.top < vh * 0.96 && rect.bottom > 0) {
        const idx = h.parentNode ? Array.prototype.indexOf.call(h.parentNode.children, h) : 0;
        h.style.transitionDelay = `${Math.min(idx, 6) * 80}ms`;
        h.classList.add('rv');
        requestAnimationFrame(() => reveal(h));
        return;
      }
      const idx = h.parentNode ? Array.prototype.indexOf.call(h.parentNode.children, h) : 0;
      h.style.transitionDelay = `${Math.min(idx, 6) * 80}ms`;
      h.classList.add('rv');
      observed.push(h);
      io.observe(h);
    });

    return () => {
      io.disconnect();
      timers.forEach((id) => window.clearTimeout(id));
      observed.forEach((h) => {
        if (h.dataset.s !== 'in') {
          h.classList.remove('rv', 'in');
          h.style.transitionDelay = '';
        }
      });
    };
  }, [page]);

  const navigateTo = (target: PageId) => {
    if (window.location.hash !== `#${target}`) {
      window.location.hash = `#${target}`;
    } else {
      setPage(target);
      window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
    }
  };

  const addBagToCart = (product: BagProduct, variant: string, colorName?: string) => {
    const key = `${product.id}|${variant}|${colorName || ''}`;
    const label = colorName
      ? `${product.name} – ${variant} (${colorName})`
      : `${product.name} – ${variant}`;
    const next = [...cart];
    const existing = next.find((c) => c.k === key);
    if (existing) existing.q += 1;
    else next.push({ k: key, n: label, p: product.price, q: 1 });
    persistCart(next);
    setCartOpen(true);
  };

  const handleCheckoutComplete = async (inv: InvoiceRecord) => {
    // Save to track history (QRIS payments are already paid upon confirmation)
    const newTrack: TrackOrderRecord = {
      ts: inv.method === 'QRIS' ? Date.now() - 31000 : Date.now(),
      name: inv.name,
      total: inv.total,
      method: inv.method,
      items: inv.items.map((i) => `${i.n} ×${i.q}`),
    };
    const nextTracks = { ...trackedOrders, [inv.no]: newTrack };
    setTrackedOrders(nextTracks);
    try {
      localStorage.setItem(TRACK_KEY, JSON.stringify(nextTracks));
    } catch {
      // ignore
    }

    // Save to Firestore user orders when authenticated with verified email
    if (currentUser && currentUser.emailVerified) {
      try {
        await saveUserOrderDoc(currentUser.uid, inv);
      } catch (err) {
        console.error('Failed saving order to Firestore:', err);
      }
    }

    persistCart([]);
  };

  const handleTrackLookup = (rawCode: string) => {
    let norm = rawCode.trim().toUpperCase().replace(/\s/g, '');
    if (/^\d{6}$/.test(norm)) norm = `CCN-${norm}`;
    setTrackSearched(true);
    setTrackCode(norm);
    setTickNow(Date.now());

    if (!norm) {
      setTrackRecord(null);
      return;
    }

    if (trackedOrders[norm]) {
      setTrackRecord(trackedOrders[norm]);
      return;
    }
    if (DEMO_ORDERS[norm]) {
      setTrackRecord(DEMO_ORDERS[norm]);
      return;
    }
    if (currentUser) {
      const found = currentUser.orders.find((o) => o.no === norm);
      if (found) {
        setTrackRecord({
          ts: Date.now() - 1e9,
          name: currentUser.name,
          total: found.t,
          method: found.m,
          items: found.items.map((c) => `${c.n} ×${c.q}`),
        });
        return;
      }
    }
    setTrackRecord(null);
  };

  const handleAnswerQuiz = (optIndex: number) => {
    if (quizPicked !== null) return;
    const q = QUIZ_QUESTIONS[quizIdx];
    setQuizPicked(optIndex);
    if (q.options[optIndex] === q.answer) {
      setQuizScore((s) => s + 1);
    }
    window.setTimeout(() => {
      setQuizPicked(null);
      setQuizIdx((i) => i + 1);
    }, 1100);
  };

  const handlePostQuestion = async () => {
    const n = forumName.trim();
    const q = forumQuestion.trim();
    if (!n || !q) {
      setForumErr('Isi nama dan pertanyaan terlebih dahulu.');
      showToast('Isi nama dan pertanyaan terlebih dahulu.');
      return;
    }
    setForumErr('');
    if (currentUser?.emailVerified) {
      try {
        await createForumPostDoc(currentUser.uid, n, q);
        setForumQuestion('');
        showToast('Pertanyaan tersimpan dan menunggu balasan Tim CCN.');
        return;
      } catch {
        // Fallback to local state if offline
      }
    }
    const next = [{ n, q, a: '' }, ...forumPosts];
    setForumPosts(next);
    try {
      localStorage.setItem(FORUM_KEY, JSON.stringify(next));
    } catch {
      // ignore
    }
    setForumQuestion('');
    showToast('Pertanyaan berhasil dikirim ke forum.');
  };

  const totalCartQty = cart.reduce((s, c) => s + c.q, 0);

  // Tracking derived values
  const elapsedSec = trackRecord ? Math.max(0, (tickNow - trackRecord.ts) / 1000) : 0;
  const currentStage = trackRecord ? Math.min(4, Math.floor(elapsedSec / 30)) : 0;
  const etaDate = trackRecord
    ? new Date(trackRecord.ts + 3 * 864e5).toLocaleDateString('id-ID', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
      })
    : '';
  const resiNumber = trackCode ? `CCNX${trackCode.replace(/\D/g, '')}ID` : '';

  return (
    <>
      <EffectsLayer currentPage={page} />
      <MascotWidget currentPage={page} cartOpen={cartOpen} />

      <div id="toast" role="status" className={toastVisible ? 'on' : ''}>
        {toastMsg}
      </div>

      {/* MODALS */}
      <AuthModal
        open={authModal.open}
        initialMode={authModal.mode}
        fromCheckout={authModal.fromCheckout}
        user={currentUser}
        onClose={() => {
          reopenCartAfterAuth.current = false;
          setAuthModal((prev) => ({ ...prev, open: false, fromCheckout: false }));
        }}
        onAuthCompleted={(msg, opts) => {
          if (opts) pendingRegInfo.current = opts;
          showToast(msg);
          void syncSignedInUser().then((verified) => {
            if (verified && reopenCartAfterAuth.current) {
              reopenCartAfterAuth.current = false;
              setAuthModal((prev) => ({ ...prev, open: false, fromCheckout: false }));
              setCartOpen(true);
            }
          });
        }}
        onRefreshVerification={async () => {
          if (!auth.currentUser) return false;
          await auth.currentUser.reload();
          const verified = await syncSignedInUser();
          if (verified) {
            showToast('Email terverifikasi! Selamat berbelanja di CCN.');
            if (reopenCartAfterAuth.current) {
              reopenCartAfterAuth.current = false;
              setAuthModal((prev) => ({ ...prev, open: false, fromCheckout: false }));
              setCartOpen(true);
            }
          }
          return verified;
        }}
        onSaveProfile={async (name, addr) => {
          if (!currentUser || !currentUser.emailVerified) return;
          const saved = await updateUserProfileDoc(currentUser.uid, name, addr);
          setCurrentUser((prev) =>
            prev ? { ...prev, name: saved.name, addr: saved.addr } : prev
          );
          showToast('Profil tersimpan.');
        }}
        onLogout={async () => {
          await signOut(auth);
          reopenCartAfterAuth.current = false;
          setAuthModal((prev) => ({ ...prev, open: false, fromCheckout: false }));
          showToast('Kamu sudah keluar.');
        }}
        onReorder={(order) => {
          const next = [...cart];
          order.items.forEach((it) => {
            const existing = next.find((c) => c.k === it.k);
            if (existing) existing.q += it.q;
            else next.push({ ...it });
          });
          persistCart(next);
          setAuthModal((prev) => ({ ...prev, open: false, fromCheckout: false }));
          setCartOpen(true);
          showToast('Produk ditambahkan ke keranjang.');
        }}
        onTrackOrder={(no) => {
          setAuthModal((prev) => ({ ...prev, open: false, fromCheckout: false }));
          setCartOpen(false);
          setTrackInput(no);
          navigateTo('lacak');
          handleTrackLookup(no);
        }}
        onOpenInvoice={(inv) => {
          setAuthModal((prev) => ({ ...prev, open: false, fromCheckout: false }));
          setActiveInvoice(inv);
        }}
      />

      <ProductDetailModal
        product={detailProduct}
        wishlist={wishlist}
        onClose={() => setDetailProduct(null)}
        onSelectProduct={(id) => {
          const found = liveProducts.find((p) => p.id === id) || null;
          setDetailProduct(found);
        }}
        onToggleWish={toggleWishlist}
        onAddToCart={addBagToCart}
      />

      <CartModal
        open={cartOpen}
        cart={cart}
        user={currentUser}
        onClose={() => setCartOpen(false)}
        onRemoveItem={(idx) => {
          const next = [...cart];
          next.splice(idx, 1);
          persistCart(next);
        }}
        onOpenAuthLogin={() => {
          reopenCartAfterAuth.current = true;
          setCartOpen(false);
          setAuthModal({ open: true, mode: 'login', fromCheckout: true });
        }}
        onCheckoutComplete={handleCheckoutComplete}
        onOpenInvoice={(inv) => setActiveInvoice(inv)}
        onOpenZoomImage={(url, file, title, caption) =>
          setZoomReceipt({ url, file, title, caption })
        }
        onToast={showToast}
      />

      <InvoiceModal
        invoice={activeInvoice}
        onClose={() => setActiveInvoice(null)}
        onViewImage={async (inv) => {
          const canvas = await renderReceiptCanvas(inv);
          setZoomReceipt({
            url: canvas.toDataURL('image/png'),
            file: `struk-${inv.no}.png`,
            title: `Struk Pesanan ${inv.no}`,
          });
        }}
      />

      <ReceiptZoomModal
        dataUrl={zoomReceipt?.url || null}
        fileName={zoomReceipt?.file || 'struk-ccn.png'}
        title={zoomReceipt?.title}
        caption={zoomReceipt?.caption}
        onClose={() => setZoomReceipt(null)}
      />

      {/* HEADER */}
      <header className={headerScrolled ? 'sc' : ''}>
        <div className="w">
          <nav>
            <a
              href="#beranda"
              className="logo"
              aria-label="CCN (Creative Craft Nation)"
              onClick={(e) => {
                e.preventDefault();
                navigateTo('beranda');
              }}
            >
              <span className="lg" style={{ width: 72, height: 44 }} />
            </a>
            <div className="links">
              {(
                [
                  ['beranda', 'Beranda'],
                  ['tentang', 'Tentang'],
                  ['produk', 'Produk'],
                  ['belajar', 'Belajar'],
                  ['forum', 'Forum'],
                  ['kelompok', 'Kelompok'],
                  ['lacak', 'Lacak Pesanan'],
                ] as [PageId, string][]
              ).map(([id, label]) => (
                <a
                  key={id}
                  href={`#${id}`}
                  className={page === id ? 'on' : ''}
                  onClick={(e) => {
                    e.preventDefault();
                    navigateTo(id);
                  }}
                >
                  {label}
                </a>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              {isAdmin && (
                <button
                  className={`btn ${page === 'admin' ? '' : 'o'}`}
                  type="button"
                  onClick={() => navigateTo('admin')}
                >
                  Admin
                </button>
              )}
              <button
                className="btn o"
                id="abt"
                type="button"
                onClick={() => setAuthModal({ open: true, mode: 'login', fromCheckout: false })}
              >
                {currentUser ? (
                  <>
                    <span className="av">{currentUser.name.charAt(0).toUpperCase()}</span>
                    {currentUser.emailVerified ? currentUser.name.split(' ')[0] : 'Verifikasi'}
                  </>
                ) : (
                  'Masuk'
                )}
              </button>
              <button
                className="btn o"
                id="wbt"
                type="button"
                aria-label="Lihat favorit"
                onClick={() => {
                  setSelectedCategory('Favorit');
                  setSearchQuery('');
                  navigateTo('produk');
                }}
              >
                ♥ <span id="wn">{wishlist.length}</span>
              </button>
              <button className="btn o" type="button" onClick={() => setCartOpen(true)}>
                Keranjang (<span id="cn" className={cartBump ? 'bump' : ''}>{totalCartQty}</span>)
              </button>
            </div>
          </nav>
        </div>
      </header>

      {siteConfig.announcement.trim() && page !== 'admin' && (
        <div className="adm-banner" role="status">
          <div className="w">{siteConfig.announcement}</div>
        </div>
      )}

      <main>
        {/* ==================== BERANDA ==================== */}
        <section data-pg="beranda" className={page === 'beranda' ? 'show' : ''}>
          <div className="w hero">
            <div>
              <span className="pill">{siteConfig.heroPill}</span>
              <h1>{siteConfig.heroTitle}</h1>
              <p>{siteConfig.heroSubtitle}</p>
              <p>
                <a
                  className="btn"
                  href="#produk"
                  onClick={(e) => {
                    e.preventDefault();
                    navigateTo('produk');
                  }}
                >
                  Belanja Sekarang
                </a>{' '}
                <a
                  className="btn o"
                  href="#belajar"
                  onClick={(e) => {
                    e.preventDefault();
                    navigateTo('belajar');
                  }}
                >
                  Pelajari Cara Membuat
                </a>
              </p>
            </div>
            <div className="ph" style={{ height: 300 }}>
              <img
                src={assetUrl('/assets/aistudio/image_00e9978d.png')}
                alt="Tas Rajut Handmade CCN"
                className="bag-hero float"
              />
            </div>
          </div>
        </section>

        <section data-pg="beranda" className={page === 'beranda' ? 'show' : ''}>
          <div className="w">
            <h2>Kenapa memilih CCN?</h2>
            <p className="sub">Tiga alasan tas kerajinan tanganmu layak dari kami.</p>
            <div className="grid">
              <div className="card">
                <h3>Kreativitas &amp; desain unik</h3>
                <p>
                  Dari tas rajut bunga, teknik simpul tali macrame, hingga kombinasi kain perca yang sesuai karakter pengguna.
                </p>
              </div>
              <div className="card">
                <h3>Kualitas &amp; harga terjangkau</h3>
                <p>
                  Dibuat dengan ketelitian dan keterampilan tangan, bernilai seni tinggi, serta ramah di kantong.
                </p>
              </div>
              <div className="card">
                <h3>Belanja mudah</h3>
                <p>
                  Pilih desain tas, masukkan keranjang, lalu bayar lewat QRIS, e-wallet, virtual account, atau kartu.
                </p>
              </div>
            </div>
            <p style={{ marginTop: 24 }}>
              <a
                className="btn"
                href="#produk"
                onClick={(e) => {
                  e.preventDefault();
                  navigateTo('produk');
                }}
              >
                Lihat Semua Produk
              </a>{' '}
              <a
                className="btn o"
                href="#tentang"
                onClick={(e) => {
                  e.preventDefault();
                  navigateTo('tentang');
                }}
              >
                Kenali CCN
              </a>
            </p>
          </div>
        </section>

        <section
          data-pg="beranda"
          className={page === 'beranda' ? 'show' : ''}
          style={{ background: 'var(--card)' }}
        >
          <div className="w">
            <h2>Cara Memesan</h2>
            <p className="sub">Empat langkah mudah untuk memiliki tas kerajinan tangan impianmu.</p>
            <div
              className="grid"
              style={{ gridTemplateColumns: 'repeat(auto-fill,minmax(200px,1fr))' }}
            >
              <div className="card">
                <div className="st">1</div>
                <b>Pilih produk</b>
                <p className="tag">
                  Tentukan desain tas kerajinan tangan dan varian pilihan di halaman Produk.
                </p>
              </div>
              <div className="card">
                <div className="st">2</div>
                <b>Masukkan keranjang</b>
                <p className="tag">
                  Periksa pesanan dan pakai kode voucher CCN10 untuk diskon 10% pembelian pertama.
                </p>
              </div>
              <div className="card">
                <div className="st">3</div>
                <b>Isi data &amp; bayar</b>
                <p className="tag">
                  Lengkapi nama dan alamat, lalu bayar. Khusus QRIS, nomor pesanan terbit otomatis setelah pembayaran selesai.
                </p>
              </div>
              <div className="card">
                <div className="st">4</div>
                <b>Konfirmasi WhatsApp</b>
                <p className="tag">
                  Kirim konfirmasi lalu lampirkan struk. Pesanan baru diproses setelah struk kami terima.
                </p>
              </div>
            </div>
          </div>
        </section>

        <section data-pg="beranda" className={page === 'beranda' ? 'show' : ''}>
          <div className="w">
            <h2>Pertanyaan Umum &amp; Kontak</h2>
            <p className="sub">Jawaban singkat sebelum kamu memesan.</p>
            <div className="two">
              <div className="card">
                {liveFaqs.map((faq) => (
                  <details key={faq.id}>
                    <summary>{faq.question}</summary>
                    <p>{faq.answer}</p>
                  </details>
                ))}
              </div>
              <div className="card">
                <h3>Hubungi Kami</h3>
                <p>
                  <b>WhatsApp Business</b>
                  <br />
                  <a
                    href={`https://wa.me/${siteConfig.whatsapp}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ color: 'var(--ac)' }}
                  >
                    {siteConfig.whatsapp}
                  </a>
                </p>
                <p>
                  <b>Instagram &amp; TikTok</b>
                  <br />
                  {siteConfig.socialHandle}
                </p>
                <p>
                  <a
                    className="btn"
                    href={`https://wa.me/${siteConfig.whatsapp}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Chat via WhatsApp
                  </a>
                </p>
              </div>
            </div>

            <div className="card sec-faq" id="keamanan-privasi">
              <div className="sec-faq-hd">
                <span className="sec-faq-ico" aria-hidden="true">
                  <ShieldCheck size={22} />
                </span>
                <div>
                  <h3>Keamanan &amp; Privasi (Security &amp; Privacy)</h3>
                  <p className="tag">
                    Perlindungan akun pelanggan dengan standar keamanan Google Firebase agar kamu tenang saat masuk dan berbelanja.
                  </p>
                </div>
              </div>

              <div className="sec-pillars">
                <div className="sec-pil">
                  <div className="sec-pil-t">
                    <Lock size={16} aria-hidden="true" />
                    <b>Firebase Client-Side SDK</b>
                  </div>
                  <p className="tag">
                    Proses login dan pendaftaran berjalan langsung lewat SDK resmi Google Firebase melalui koneksi terenkripsi HTTPS, tanpa perantara server kustom.
                  </p>
                </div>
                <div className="sec-pil">
                  <div className="sec-pil-t">
                    <KeyRound size={16} aria-hidden="true" />
                    <b>Hashing Kata Sandi Satu Arah</b>
                  </div>
                  <p className="tag">
                    Kata sandi diacak menggunakan algoritma kriptografi satu arah (salted hashing) sehingga tidak pernah disimpan dalam bentuk teks asli (plaintext).
                  </p>
                </div>
                <div className="sec-pil">
                  <div className="sec-pil-t">
                    <EyeOff size={16} aria-hidden="true" />
                    <b>Zero Access bagi Admin</b>
                  </div>
                  <p className="tag">
                    Admin dan pembuat website memiliki akses nol (0%) terhadap kredensial pengguna dan tidak dapat melihat kata sandi siapa pun.
                  </p>
                </div>
              </div>

              <div className="sec-faq-list">
                <details open>
                  <summary>
                    Apakah admin atau pembuat website bisa melihat email dan kata sandi saya?
                  </summary>
                  <p>
                    Tidak bisa sama sekali. Sistem masuk menggunakan <b>client-side SDK resmi Firebase Authentication</b> milik Google, sehingga kata sandi kamu langsung dikirim melalui saluran terenkripsi ke sistem autentikasi Google—bukan ke database teks biasa. Admin maupun pembuat website memiliki <b>zero access</b> terhadap kata sandi asli (plaintext) pengguna.
                  </p>
                </details>
                <details>
                  <summary>
                    Bagaimana cara kata sandi saya dilindungi di dalam sistem?
                  </summary>
                  <p>
                    Setiap kata sandi otomatis melewati proses <b>hashing kriptografi satu arah</b> (menggunakan algoritma scrypt beserta salt unik) sebelum diverifikasi atau disimpan oleh Google Firebase. Proses satu arah ini membuat kata sandi tidak dapat dibalikkan kembali ke teks aslinya oleh siapa pun, termasuk pengelola website.
                  </p>
                </details>
                <details>
                  <summary>
                    Apakah aman jika saya masuk menggunakan tombol Masuk dengan Google?
                  </summary>
                  <p>
                    Sangat aman. Autentikasi ditangani langsung oleh layar izin resmi Google (OAuth). Kata sandi akun Google kamu tidak pernah dibagikan atau dikirim ke website CCN—kami hanya menerima informasi dasar profil (nama, email, dan ID pengguna terverifikasi) untuk memproses pesananmu.
                  </p>
                </details>
              </div>
            </div>
          </div>
        </section>

        {/* ==================== TENTANG ==================== */}
        <section
          data-pg="tentang"
          className={page === 'tentang' ? 'show' : ''}
          style={{ background: 'var(--card)' }}
        >
          <div className="w">
            <h2>Tentang CCN</h2>
            <p className="sub">
              Nama Bisnis: <b>CCN (Creative Craft Nation)</b>
              <br />
              {siteConfig.aboutSummary}
            </p>
            <div className="two">
              <div className="card">
                <h3>Visi</h3>
                <p>{siteConfig.visi}</p>
                <h3>Tujuan</h3>
                <p>{siteConfig.tujuan}</p>
                <p style={{ marginBottom: 0 }}>
                  Selain itu, bisnis ini bertujuan untuk melestarikan kreativitas dan keterampilan kerajinan tangan, meningkatkan nilai jual produk lokal, serta menciptakan peluang usaha yang inovatif dan berdaya saing di pasar industri kerajinan tangan.
                </p>
              </div>
              <div className="card">
                <h3>Misi</h3>
                <ul>
                  <li>Menyediakan tas kerajinan tangan dengan desain yang menarik, unik, dan beragam.</li>
                  <li>Menawarkan produk berkualitas dengan harga yang terjangkau.</li>
                  <li>Mengutamakan kreativitas dan keterampilan dalam setiap proses pembuatan produk.</li>
                  <li>Memberikan pelayanan yang ramah dan responsif kepada pelanggan.</li>
                  <li>Memanfaatkan media digital untuk memperluas pemasaran produk.</li>
                  <li>Menjaga kepuasan dan kepercayaan pelanggan melalui kualitas produk dan pelayanan terbaik.</li>
                </ul>
              </div>
            </div>
          </div>
        </section>

        <section data-pg="tentang" className={page === 'tentang' ? 'show' : ''}>
          <div className="w">
            <h2>Logo &amp; Karya Kerajinan</h2>
            <p className="sub">Identitas visual CCN dan filosofi di balik setiap tas handmade kami.</p>
            <div className="two">
              <div className="card">
                <div
                  className="lg"
                  role="img"
                  aria-label="Logo CCN"
                  style={{ width: 180, height: 110, marginBottom: 12 }}
                />
                <h3>Logo CCN</h3>
                <p>
                  CCN (Creative Craft Nation) merupakan nama usaha yang bergerak di bidang pembuatan dan penjualan tas kerajinan tangan. Nama ini dipilih untuk menggambarkan usaha yang mengutamakan kreativitas, inovasi, dan keunikan dalam menciptakan produk tas yang menarik, berkualitas, serta memiliki nilai estetika dan sesuai dengan gaya serta kebutuhan penggunanya.
                </p>
              </div>
              <div className="card">
                <div className="ph">
                  <img
                    src={assetUrl('/assets/aistudio/image_f87f5b61.png')}
                    alt="Tas Rajut Handmade CCN"
                    className="bag-img"
                  />
                </div>
                <h3>Kualitas &amp; Estetika Handmade</h3>
                <p>
                  Setiap tas dibuat dari bahan pilihan—mulai dari benang rajut lembut, tali macrame yang kuat, hingga kain perca penuh motif—agar nyaman dipakai sehari-hari sekaligus menonjolkan gaya personalmu.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* ==================== PRODUK ==================== */}
        <section data-pg="produk" className={page === 'produk' ? 'show' : ''}>
          <div className="w">
            <h2>Desain Tas &amp; Harga</h2>
            <p className="sub">Pilih desain tas kerajinan tangan favoritmu, lalu tambahkan ke keranjang.</p>
            <div className="fbar">
              <input
                id="fs"
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Cari tas, misalnya: rajut, pita, macrame, kain..."
                aria-label="Cari produk"
              />
              <select
                id="fo"
                value={sortOrder}
                onChange={(e) => setSortOrder(e.target.value as 'p' | 'lo' | 'hi' | 'az')}
                aria-label="Urutkan produk"
              >
                <option value="p">Urutkan: Terpopuler</option>
                <option value="lo">Harga terendah</option>
                <option value="hi">Harga tertinggi</option>
                <option value="az">Nama A–Z</option>
              </select>
            </div>
            <div className="chips2" id="fc">
              {categories.map((c) => (
                <button
                  key={c}
                  type="button"
                  className={`fchip${selectedCategory === c ? ' on' : ''}`}
                  onClick={() => setSelectedCategory(c)}
                >
                  {c === 'Favorit' ? `♥ Favorit (${wishlist.length})` : c}
                </button>
              ))}
            </div>
            <p className="tag" id="fnc" style={{ margin: '0 0 14px' }}>
              {filteredProducts.length} produk ditampilkan
            </p>
            <div className="grid" id="pg">
              {filteredProducts.length ? (
                filteredProducts.map((p, idx) => {
                  const isWish = wishlist.includes(p.name);
                  const chosenVariant = cardVariants[p.id] || BAG_VARIANTS[0];
                  return (
                    <div
                      key={p.id}
                      className="card pn"
                      style={{ animationDelay: `${idx * 60}ms` }}
                      onClick={(e) => {
                        const t = e.target as HTMLElement;
                        if (t.closest('button,select,a')) return;
                        setDetailProduct(p);
                      }}
                    >
                      <div className="ph">
                        {p.badge && <span className={`bd bd-${p.badge}`}>{p.badge}</span>}
                        <button
                          type="button"
                          className={`hbt${isWish ? ' on' : ''}`}
                          aria-label="Simpan ke favorit"
                          aria-pressed={isWish}
                          onClick={() => toggleWishlist(p.name)}
                        >
                          <svg viewBox="0 0 24 24" width="18" height="18">
                            <path d="M12 21s-7.5-4.6-9.5-9.3C1 8 3.2 5 6.3 5c1.9 0 3.4 1 4.2 2.4h3C14.3 6 15.8 5 17.7 5 20.8 5 23 8 21.5 11.7 19.5 16.4 12 21 12 21z" />
                          </svg>
                        </button>
                        <img src={assetUrl(p.image)} alt={p.name} className="bag-img" />
                      </div>
                      <b>{p.name}</b>
                      <p className="tag">{p.desc}</p>
                      <p className="dl">Lihat detail →</p>
                      <select
                        value={chosenVariant}
                        onChange={(e) =>
                          setCardVariants((prev) => ({ ...prev, [p.id]: e.target.value }))
                        }
                        aria-label={`Varian ${p.name}`}
                      >
                        {BAG_VARIANTS.map((v) => (
                          <option key={v} value={v}>
                            {v}
                          </option>
                        ))}
                      </select>
                      <div className="row">
                        <span>
                          <span className="price">{rp(p.price)}</span>
                          {p.oldPrice && <s className="tag">{rp(p.oldPrice)}</s>}
                        </span>
                        <button
                          className="btn"
                          type="button"
                          onClick={() => addBagToCart(p, chosenVariant)}
                        >
                          + Keranjang
                        </button>
                      </div>
                    </div>
                  );
                })
              ) : (
                <p className="tag" style={{ gridColumn: '1/-1' }}>
                  {selectedCategory === 'Favorit' && !wishlist.length
                    ? 'Belum ada favorit. Tekan ikon hati pada produk untuk menyimpannya.'
                    : 'Produk tidak ditemukan. Coba kata kunci atau kategori lain.'}
                </p>
              )}
            </div>
          </div>
        </section>

        <section data-pg="produk" className={page === 'produk' ? 'show' : ''}>
          <div className="w">
            <h2>Sistem Pembayaran</h2>
            <p className="sub">
              Untuk menerima pembayaran sungguhan, website perlu dihubungkan dengan penyedia payment gateway. Pilihan yang dapat dipertimbangkan:
            </p>
            <div
              className="grid"
              style={{ gridTemplateColumns: 'repeat(auto-fill,minmax(240px,1fr))' }}
            >
              <div className="card">
                <h3 className="ph3">
                  <span className="pi">
                    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2">
                      <rect x="3" y="3" width="7" height="7" />
                      <rect x="14" y="3" width="7" height="7" />
                      <rect x="3" y="14" width="7" height="7" />
                      <path d="M14 14h3v3h-3zM20 14v7M14 20h3" />
                    </svg>
                  </span>
                  QRIS Resmi CCN
                </h3>
                <p>
                  Pelanggan memindai kode QRIS resmi CCN untuk membayar lewat aplikasi pembayaran yang mendukung QRIS. Nomor pesanan terbit otomatis setelah pembayaran selesai.
                </p>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                  <span className="chip" style={{ background: '#D7263D' }}>
                    QRIS
                  </span>
                  <button
                    type="button"
                    className="btn o"
                    style={{ padding: '6px 12px', fontSize: 13 }}
                    onClick={() =>
                      setZoomReceipt({
                        url: QRIS_IMAGE,
                        file: 'qris-ccn.jpeg',
                        title: 'Kode QRIS Resmi CCN',
                        caption:
                          'Kode QRIS resmi CCN (Creative Craft Nation). Gunakan saat checkout metode QRIS agar nomor pesanan diterbitkan otomatis setelah pembayaran.',
                      })
                    }
                  >
                    Lihat Kode QRIS
                  </button>
                </div>
              </div>
              <div className="card">
                <h3 className="ph3">
                  <span className="pi">
                    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M3 7h16a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2zM3 7V6a2 2 0 0 1 2-2h12M16 14h3" />
                    </svg>
                  </span>
                  E-wallet
                </h3>
                <p>
                  Mendukung metode dompet digital yang tersedia pada penyedia pembayaran, seperti GoPay atau DANA sesuai konfigurasi.
                </p>
                <div className="chips">
                  <span className="chip" style={{ background: '#00AED6' }}>
                    GoPay
                  </span>
                  <span className="chip" style={{ background: '#118EEA' }}>
                    DANA
                  </span>
                </div>
              </div>
              <div className="card">
                <h3 className="ph3">
                  <span className="pi">
                    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M3 10l9-6 9 6M5 10v8M9 10v8M15 10v8M19 10v8M3 20h18" />
                    </svg>
                  </span>
                  Virtual account
                </h3>
                <p>
                  Pembeli membayar melalui transfer bank menggunakan nomor virtual account yang dibuat untuk transaksi.
                </p>
                <div className="chips">
                  <span className="chip" style={{ background: '#0060AF' }}>
                    BCA
                  </span>
                  <span className="chip" style={{ background: '#003D79' }}>
                    Mandiri
                  </span>
                  <span className="chip" style={{ background: '#00529C' }}>
                    BRI
                  </span>
                </div>
              </div>
              <div className="card">
                <h3 className="ph3">
                  <span className="pi">
                    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2">
                      <rect x="2" y="5" width="20" height="14" rx="2" />
                      <path d="M2 10h20M6 15h4" />
                    </svg>
                  </span>
                  Kartu debit/kredit
                </h3>
                <p>
                  Dapat diaktifkan apabila didukung oleh penyedia pembayaran dan telah memenuhi persyaratan mereka.
                </p>
                <div className="chips">
                  <span
                    className="chip"
                    style={{
                      background: '#fff',
                      color: '#1A1F71',
                      border: '1px solid #d6d3d1',
                      fontStyle: 'italic',
                    }}
                  >
                    VISA
                  </span>
                  <span
                    className="chip"
                    style={{
                      background: '#fff',
                      color: '#1c1917',
                      border: '1px solid #d6d3d1',
                    }}
                  >
                    <svg width="24" height="15" viewBox="0 0 24 15">
                      <circle cx="8" cy="7.5" r="7" fill="#EB001B" />
                      <circle cx="16" cy="7.5" r="7" fill="#F79E1B" fillOpacity=".9" />
                    </svg>
                    mastercard
                  </span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ==================== BELAJAR ==================== */}
        <section
          data-pg="belajar"
          className={page === 'belajar' ? 'show' : ''}
          style={{ background: 'var(--card)' }}
        >
          <div className="w">
            <h2>Materi Pembelajaran</h2>
            <p className="sub">
              Panduan cara membuat tas kerajinan yang simple, artikel kreatif, dan kuis interaktif.
            </p>
            <h3>Video &amp; Panduan Langkah</h3>
            <div className="grid">
              {VIDEO_TUTORIALS.map((vt) => (
                <a
                  key={vt.id}
                  href={vt.youtubeUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="card"
                  style={{ display: 'block', cursor: 'pointer' }}
                >
                  <div className={`vid ${vt.bgClass}`} style={{ position: 'relative' }}>
                    <img
                      src={`https://i.ytimg.com/vi/${vt.youtubeId}/hqdefault.jpg`}
                      alt={vt.title}
                      style={{
                        position: 'absolute',
                        inset: 0,
                        width: '100%',
                        height: '100%',
                        objectFit: 'cover',
                      }}
                      onError={(e) => {
                        e.currentTarget.style.display = 'none';
                      }}
                    />
                    <span
                      style={{
                        position: 'relative',
                        zIndex: 1,
                        width: 58,
                        height: 40,
                        borderRadius: 12,
                        background: 'rgba(220, 38, 38, 0.92)',
                        display: 'grid',
                        placeItems: 'center',
                        fontSize: 20,
                        color: '#fff',
                        boxShadow: '0 6px 18px rgba(0, 0, 0, 0.35)',
                      }}
                    >
                      ▶
                    </span>
                  </div>
                  <b>{vt.title}</b>
                  <p className="tag" style={{ marginBottom: 0 }}>
                    {vt.subtitle} →
                  </p>
                </a>
              ))}
            </div>
            <h3 style={{ marginTop: 24 }}>Artikel</h3>
            <div className="grid" id="ar">
              {ARTICLES.map((art, i) => {
                const isOpen = !!openArticles[i];
                return (
                  <div className="card" key={art.title}>
                    <b>{art.title}</b>
                    {isOpen && <p className="tag">{art.body}</p>}
                    <button
                      className="btn o"
                      type="button"
                      onClick={() =>
                        setOpenArticles((prev) => ({ ...prev, [i]: !prev[i] }))
                      }
                    >
                      Baca / Tutup
                    </button>
                  </div>
                );
              })}
            </div>
            <h3 style={{ marginTop: 24 }}>Kuis Interaktif</h3>
            <div className="card" id="quiz">
              {quizIdx < QUIZ_QUESTIONS.length ? (
                <>
                  <span className="tag">
                    Soal {quizIdx + 1}/{QUIZ_QUESTIONS.length}
                  </span>
                  <p>
                    <b>{QUIZ_QUESTIONS[quizIdx].question}</b>
                  </p>
                  {QUIZ_QUESTIONS[quizIdx].options.map((opt, j) => {
                    const isCorrectOpt = opt === QUIZ_QUESTIONS[quizIdx].answer;
                    let cls = 'opt';
                    if (quizPicked !== null) {
                      if (isCorrectOpt) cls = 'opt ok';
                      else if (j === quizPicked) cls = 'opt no';
                    }
                    return (
                      <button
                        key={opt}
                        className={cls}
                        type="button"
                        disabled={quizPicked !== null}
                        onClick={() => handleAnswerQuiz(j)}
                      >
                        {opt}
                      </button>
                    );
                  })}
                </>
              ) : (
                <>
                  <b>
                    Skor kamu: {quizScore}/{QUIZ_QUESTIONS.length}
                  </b>
                  <p style={{ marginTop: 10, marginBottom: 0 }}>
                    <button
                      className="btn"
                      type="button"
                      onClick={() => {
                        setQuizIdx(0);
                        setQuizScore(0);
                        setQuizPicked(null);
                      }}
                    >
                      Ulangi
                    </button>
                  </p>
                </>
              )}
            </div>
          </div>
        </section>

        {/* ==================== FORUM ==================== */}
        <section data-pg="forum" className={page === 'forum' ? 'show' : ''}>
          <div className="w">
            <h2>Forum Tanya Jawab</h2>
            <p className="sub">
              Masukkan nama dan pertanyaan seputar tas kerajinan CCN, nanti tim CCN akan membantu menjawabnya.
            </p>
            <div className="two">
              <div className="card">
                <label>Nama</label>
                <input
                  id="fn"
                  value={forumName}
                  onChange={(e) => setForumName(e.target.value)}
                  placeholder="Nama kamu"
                />
                <label>Pertanyaan</label>
                <textarea
                  id="fq"
                  rows={3}
                  value={forumQuestion}
                  onChange={(e) => setForumQuestion(e.target.value)}
                  placeholder="Tulis pertanyaan..."
                />
                {forumErr && <p className="amsg">{forumErr}</p>}
                <button className="btn" type="button" onClick={handlePostQuestion}>
                  Kirim Pertanyaan
                </button>
              </div>
              <div id="fl">
                {[...cmsForumPosts, ...forumPosts].map((f, idx) => (
                  <div className="card" style={{ marginBottom: 12 }} key={'id' in f ? f.id : idx}>
                    <b>{f.n}</b>: {f.q}
                    <p className="tag" style={{ margin: '6px 0 0' }}>
                      {f.a ? `💬 Tim CCN: ${f.a}` : 'Menunggu jawaban Tim CCN…'}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* ==================== LACAK PESANAN ==================== */}
        <section data-pg="lacak" className={page === 'lacak' ? 'show' : ''}>
          <div className="w">
            <h2>Lacak Pesanan</h2>
            <p className="sub">Masukkan nomor pesanan untuk melihat status pengirimannya.</p>
            <div className="card" style={{ maxWidth: 720 }}>
              <label htmlFor="tkn">Nomor pesanan</label>
              <div className="row" style={{ gap: 8 }}>
                <input
                  id="tkn"
                  value={trackInput}
                  onChange={(e) => setTrackInput(e.target.value)}
                  placeholder="Contoh: CCN-123456"
                  style={{ margin: 0 }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleTrackLookup(trackInput);
                    }
                  }}
                />
                <button
                  className="btn"
                  id="tkb"
                  type="button"
                  onClick={() => handleTrackLookup(trackInput)}
                >
                  Lacak
                </button>
              </div>
              <p className="tag" style={{ margin: '10px 0 0' }}>
                Belum punya nomor? Coba nomor contoh{' '}
                <a
                  href="#lacak"
                  onClick={(e) => {
                    e.preventDefault();
                    setTrackInput('CCN-123456');
                    handleTrackLookup('CCN-123456');
                  }}
                  style={{ color: 'var(--ac)', fontWeight: 600 }}
                >
                  CCN-123456
                </a>
                . Pesanan yang kamu buat di web ini juga bisa dilacak.
              </p>
            </div>
            <div id="tkr" style={{ maxWidth: 720, marginTop: 18 }}>
              {trackSearched && !trackCode && (
                <div className="card">
                  <b>Masukkan nomor pesanan dulu.</b>
                </div>
              )}
              {trackSearched && trackCode && !trackRecord && (
                <div className="card">
                  <b>Nomor pesanan tidak ditemukan.</b>
                  <p className="tag" style={{ margin: '6px 0 0' }}>
                    Periksa kembali nomornya (contoh: CCN-123456). Yang dapat dilacak: pesanan yang dibuat di browser ini, pesanan di akunmu, dan nomor contoh.
                  </p>
                </div>
              )}
              {trackRecord && trackCode && (
                <div className="card">
                  <div className="row" style={{ flexWrap: 'wrap', gap: 8 }}>
                    <div>
                      <span className="tag">Nomor pesanan</span>
                      <br />
                      <b style={{ fontSize: 20 }}>{trackCode}</b>
                    </div>
                    <span className="pill" id="tks">
                      {ORDER_STAGES[currentStage][0]}
                    </span>
                  </div>
                  <div className="stp">
                    <div
                      className="fill"
                      id="tkf"
                      style={{ width: `${(currentStage / 4) * 80}%` }}
                    />
                    {ORDER_STAGES.map(([label], i) => {
                      const isDone = currentStage === 4 || i < currentStage;
                      const isCur = !isDone && i === currentStage;
                      return (
                        <div
                          key={label}
                          className={`sti${isDone ? ' done' : isCur ? ' cur' : ''}`}
                        >
                          <i>{isDone ? '✓' : i + 1}</i>
                          {label}
                        </div>
                      );
                    })}
                  </div>
                  <p id="tkd" style={{ margin: '14px 0 4px', fontWeight: 600 }}>
                    {ORDER_STAGES[currentStage][1]}
                  </p>
                  <p className="tag" id="tkc" style={{ margin: '0 0 14px' }}>
                    {currentStage < 4
                      ? `Tahap berikutnya (${ORDER_STAGES[currentStage + 1][0]}) dalam ${Math.ceil(
                          30 - (elapsedSec % 30)
                        )} detik.`
                      : 'Pesanan selesai.'}
                  </p>
                  <table className="spec">
                    <tbody>
                      <tr>
                        <td>Pembeli</td>
                        <td>{trackRecord.name}</td>
                      </tr>
                      <tr>
                        <td>Barang</td>
                        <td>
                          {trackRecord.items.map((item, i) => (
                            <div key={i}>{item}</div>
                          ))}
                        </td>
                      </tr>
                      <tr>
                        <td>Total</td>
                        <td>{rp(trackRecord.total)}</td>
                      </tr>
                      <tr>
                        <td>Pembayaran</td>
                        <td>{trackRecord.method}</td>
                      </tr>
                      <tr>
                        <td>Estimasi tiba</td>
                        <td>{etaDate}</td>
                      </tr>
                      <tr>
                        <td>No. resi</td>
                        <td>
                          {currentStage >= 3
                            ? `${resiNumber} (contoh)`
                            : 'Belum tersedia, muncul setelah pesanan dikirim'}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                  <p className="tag" style={{ margin: '14px 0 0' }}>
                    Simulasi: status berpindah otomatis setiap 30 detik agar mudah dicoba. Pada toko sungguhan, tahap ini diperbarui oleh admin atau ekspedisi.
                  </p>
                </div>
              )}
            </div>
          </div>
        </section>

        {/* ==================== KELOMPOK ==================== */}
        <section data-pg="kelompok" className={page === 'kelompok' ? 'show' : ''}>
          <div className="w">
            <h2>Tim di Balik CCN</h2>
            <p className="sub">
              Tiga anggota kelompok yang membangun Creative Craft Nation. Klik salah satu kartu untuk melihatnya lebih dekat.
            </p>
            <TeamZoomSection />
          </div>
        </section>

        {/* ==================== ADMIN DASHBOARD ==================== */}
        <section data-pg="admin" className={page === 'admin' ? 'show' : ''}>
          <AdminDashboard
            user={currentUser}
            isAdmin={isAdmin}
            siteConfig={siteConfig}
            onOpenAuth={() => setAuthModal({ open: true, mode: 'login', fromCheckout: false })}
            onExitAdmin={() => navigateTo('beranda')}
            onToast={showToast}
          />
        </section>
      </main>

      <footer>
        <div className="w">{siteConfig.footerText}</div>
      </footer>
    </>
  );
}
