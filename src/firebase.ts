import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, User } from 'firebase/auth';
import {
  collection,
  collectionGroup,
  deleteDoc,
  doc,
  getDoc,
  getDocFromServer,
  getFirestore,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  where,
} from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';
import {
  ADMIN_EMAIL,
  BagProduct,
  FaqItemData,
  InvoiceRecord,
  SiteConfigData,
} from './data/ccnData';

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error('Please check your Firebase configuration.');
    }
  }
}

void testConnection();

export interface UserProfileData {
  uid: string;
  name: string;
  email: string;
  addr: string;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

function clampStr(val: string, maxLen: number): string {
  return val.trim().slice(0, maxLen);
}

export async function ensureUserProfile(
  fbUser: User,
  fallbackName?: string,
  fallbackAddr?: string
): Promise<UserProfileData | null> {
  if (!fbUser.emailVerified || !fbUser.email) {
    return null;
  }

  const path = `users/${fbUser.uid}`;
  const ref = doc(db, 'users', fbUser.uid);

  let snap;
  try {
    snap = await getDoc(ref);
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
  }

  if (snap.exists()) {
    const data = snap.data() as UserProfileData;
    return {
      uid: fbUser.uid,
      name: data.name || fbUser.displayName || fbUser.email.split('@')[0],
      email: data.email || fbUser.email,
      addr: data.addr || '',
      createdAt: data.createdAt,
      updatedAt: data.updatedAt,
    };
  }

  const rawName = fallbackName || fbUser.displayName || fbUser.email.split('@')[0] || 'Pelanggan CCN';
  const safeName = clampStr(rawName, 120);
  const finalName = safeName.length >= 2 ? safeName : 'Pelanggan CCN';
  const safeEmail = clampStr(fbUser.email, 200);
  const safeAddr = clampStr(fallbackAddr || '', 500);

  const payload = {
    uid: fbUser.uid,
    name: finalName,
    email: safeEmail,
    addr: safeAddr,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  try {
    await setDoc(ref, payload);
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }

  return {
    uid: fbUser.uid,
    name: finalName,
    email: safeEmail,
    addr: safeAddr,
  };
}

export async function updateUserProfileDoc(
  uid: string,
  name: string,
  addr: string
): Promise<{ name: string; addr: string }> {
  const safeName = clampStr(name, 120);
  if (safeName.length < 2) {
    throw new Error('Nama minimal 2 karakter.');
  }
  const safeAddr = clampStr(addr, 500);
  const path = `users/${uid}`;

  try {
    await updateDoc(doc(db, 'users', uid), {
      name: safeName,
      addr: safeAddr,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }

  return { name: safeName, addr: safeAddr };
}

export async function saveUserOrderDoc(uid: string, inv: InvoiceRecord): Promise<void> {
  const path = `users/${uid}/orders/${inv.no}`;
  const boundedItems = inv.items.slice(0, 20).map((it) => ({
    k: clampStr(it.k, 120) || 'item',
    n: clampStr(it.n, 200) || 'Produk CCN',
    p: Math.max(0, Number(it.p) || 0),
    q: Math.max(1, Math.round(Number(it.q) || 1)),
  }));

  const safeName = clampStr(inv.name, 120);
  const safeAddr = clampStr(inv.addr, 500);

  const payload = {
    userId: uid,
    no: inv.no,
    date: clampStr(inv.date, 80),
    name: safeName.length >= 2 ? safeName : 'Pembeli CCN',
    addr: safeAddr.length >= 3 ? safeAddr : '-',
    method: inv.method,
    status:
      inv.status ||
      (inv.method === 'QRIS'
        ? 'Sudah dibayar (QRIS)'
        : inv.method === 'E-Wallet DANA'
          ? 'Sudah dibayar (DANA)'
          : 'Menunggu pembayaran'),
    items: boundedItems,
    sub: Math.max(0, Number(inv.sub) || 0),
    disc: Math.max(0, Number(inv.disc) || 0),
    total: Math.max(0, Number(inv.total) || 0),
    createdAt: serverTimestamp(),
  };

  try {
    await setDoc(doc(db, 'users', uid, 'orders', inv.no), payload);
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export interface StoredOrderDoc extends InvoiceRecord {
  userId: string;
  createdAt?: Timestamp;
}

export function subscribeUserOrders(
  uid: string,
  onOrders: (orders: StoredOrderDoc[]) => void,
  onError?: (err: unknown) => void
): () => void {
  const path = `users/${uid}/orders`;
  const q = query(collection(db, 'users', uid, 'orders'), where('userId', '==', uid));

  return onSnapshot(
    q,
    (snapshot) => {
      const list: StoredOrderDoc[] = snapshot.docs
        .map((d) => {
          const raw = d.data() as StoredOrderDoc;
          return {
            userId: raw.userId,
            no: raw.no || d.id,
            date: raw.date,
            name: raw.name,
            addr: raw.addr,
            method: raw.method,
            status: raw.status,
            items: Array.isArray(raw.items) ? raw.items : [],
            sub: raw.sub,
            disc: raw.disc,
            total: raw.total,
            createdAt: raw.createdAt,
          };
        })
        .sort((a, b) => {
          const ta = a.createdAt?.toMillis?.() ?? 0;
          const tb = b.createdAt?.toMillis?.() ?? 0;
          return tb - ta;
        });
      onOrders(list);
    },
    (error) => {
      if (onError) onError(error);
      else handleFirestoreError(error, OperationType.LIST, path);
    }
  );
}

export function isAdminEmail(
  email?: string | null,
  emailVerified?: boolean | null
): boolean {
  return Boolean(emailVerified && email && email.trim().toLowerCase() === ADMIN_EMAIL);
}

export function subscribeSiteConfig(onConfig: (cfg: Partial<SiteConfigData> | null) => void): () => void {
  const path = 'site_config/main';
  return onSnapshot(
    doc(db, 'site_config', 'main'),
    (snap) => {
      if (!snap.exists()) {
        onConfig(null);
        return;
      }
      onConfig(snap.data() as Partial<SiteConfigData>);
    },
    (error) => {
      console.warn('SiteConfig listener:', error);
      onConfig(null);
    }
  );
}

export async function saveSiteConfig(cfg: SiteConfigData): Promise<void> {
  const path = 'site_config/main';
  const payload = {
    announcement: clampStr(cfg.announcement, 200),
    heroPill: clampStr(cfg.heroPill, 80) || 'Koleksi Tas Kerajinan Tangan',
    heroTitle: clampStr(cfg.heroTitle, 140) || 'Ekspresikan gayamu dengan tas handmade.',
    heroSubtitle: clampStr(cfg.heroSubtitle, 400) || 'Creative Craft Nation.',
    aboutSummary: clampStr(cfg.aboutSummary, 1000) || 'CCN (Creative Craft Nation).',
    visi: clampStr(cfg.visi, 600) || 'Visi CCN',
    tujuan: clampStr(cfg.tujuan, 1200) || 'Tujuan CCN',
    whatsapp: cfg.whatsapp.replace(/[^0-9]/g, '').slice(0, 25) || '6285156249864',
    socialHandle: clampStr(cfg.socialHandle, 100) || '@ccn.id',
    footerText: clampStr(cfg.footerText, 140) || '© 2026 CCN (Creative Craft Nation)',
    updatedAt: serverTimestamp(),
  };

  try {
    await setDoc(doc(db, 'site_config', 'main'), payload);
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export interface CatalogProductDoc {
  docId: string;
  id: number;
  name: string;
  desc: string;
  price: number;
  oldPrice: number;
  category: BagProduct['category'];
  badge: '' | 'Terlaris' | 'Baru' | 'Diskon';
  image: string;
  material: string;
  technique: string;
  dimensions: string;
  active: boolean;
}

export function subscribeCatalogProducts(
  isAdminView: boolean,
  onProducts: (items: CatalogProductDoc[]) => void
): () => void {
  const q = isAdminView
    ? query(collection(db, 'site_products'), where('active', 'in', [true, false]))
    : query(collection(db, 'site_products'), where('active', '==', true));

  return onSnapshot(
    q,
    (snap) => {
      const list: CatalogProductDoc[] = snap.docs
        .map((d) => {
          const raw = d.data() as Omit<CatalogProductDoc, 'docId'>;
          return {
            docId: d.id,
            id: Number(raw.id) || 0,
            name: raw.name || '',
            desc: raw.desc || '',
            price: Number(raw.price) || 0,
            oldPrice: Number(raw.oldPrice) || 0,
            category: raw.category || 'Tas Rajut',
            badge: (raw.badge || '') as CatalogProductDoc['badge'],
            image: raw.image || '/assets/aistudio/image_00e9978d.png',
            material: raw.material || 'Bahan kerajinan tangan pilihan',
            technique: raw.technique || 'Buatan tangan',
            dimensions: raw.dimensions || '28 × 22 × 9 cm',
            active: raw.active !== false,
          };
        })
        .sort((a, b) => a.id - b.id);
      onProducts(list);
    },
    (error) => {
      console.warn('Products listener:', error);
    }
  );
}

export async function saveCatalogProduct(
  docId: string,
  prod: Omit<CatalogProductDoc, 'docId'>
): Promise<void> {
  const safeDocId = docId.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 128) || `prod_${prod.id}`;
  const path = `site_products/${safeDocId}`;
  const payload = {
    id: Math.max(0, Math.round(Number(prod.id) || 0)),
    name: clampStr(prod.name, 120) || 'Tas CCN',
    desc: clampStr(prod.desc, 500) || 'Tas kerajinan tangan CCN',
    price: Math.max(1000, Math.round(Number(prod.price) || 85000)),
    oldPrice: Math.max(0, Math.round(Number(prod.oldPrice) || 0)),
    category: prod.category,
    badge: prod.badge || '',
    image: clampStr(prod.image, 500) || '/assets/aistudio/image_00e9978d.png',
    material: clampStr(prod.material, 300) || 'Bahan kerajinan pilihan',
    technique: clampStr(prod.technique, 300) || 'Buatan tangan',
    dimensions: clampStr(prod.dimensions, 100) || '28 × 22 × 9 cm',
    active: Boolean(prod.active),
    updatedAt: serverTimestamp(),
  };

  try {
    await setDoc(doc(db, 'site_products', safeDocId), payload);
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function deleteCatalogProduct(docId: string): Promise<void> {
  const path = `site_products/${docId}`;
  try {
    await deleteDoc(doc(db, 'site_products', docId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export function subscribeFaqItems(
  isAdminView: boolean,
  onFaqs: (items: FaqItemData[]) => void
): () => void {
  const q = isAdminView
    ? query(collection(db, 'faq_items'), where('active', 'in', [true, false]))
    : query(collection(db, 'faq_items'), where('active', '==', true));

  return onSnapshot(
    q,
    (snap) => {
      const list: FaqItemData[] = snap.docs
        .map((d) => {
          const raw = d.data() as Omit<FaqItemData, 'id'>;
          return {
            id: d.id,
            question: raw.question || '',
            answer: raw.answer || '',
            sortOrder: Number(raw.sortOrder) || 0,
            active: raw.active !== false,
          };
        })
        .sort((a, b) => a.sortOrder - b.sortOrder);
      onFaqs(list);
    },
    (error) => {
      console.warn('FAQ listener:', error);
    }
  );
}

export async function saveFaqItem(faq: FaqItemData): Promise<void> {
  const safeId = faq.id.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 128) || `faq_${Date.now()}`;
  const path = `faq_items/${safeId}`;
  const payload = {
    question: clampStr(faq.question, 200) || 'Pertanyaan',
    answer: clampStr(faq.answer, 1000) || 'Jawaban',
    sortOrder: Number(faq.sortOrder) || 1,
    active: Boolean(faq.active),
    updatedAt: serverTimestamp(),
  };

  try {
    await setDoc(doc(db, 'faq_items', safeId), payload);
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function deleteFaqItem(faqId: string): Promise<void> {
  const path = `faq_items/${faqId}`;
  try {
    await deleteDoc(doc(db, 'faq_items', faqId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export interface ForumPostDoc {
  id: string;
  authorUid: string;
  n: string;
  q: string;
  a: string;
  visible: boolean;
  createdAt?: Timestamp;
}

export function subscribeForumPosts(
  isAdminView: boolean,
  onPosts: (items: ForumPostDoc[]) => void
): () => void {
  const q = isAdminView
    ? query(collection(db, 'forum_posts'), where('visible', 'in', [true, false]))
    : query(collection(db, 'forum_posts'), where('visible', '==', true));

  return onSnapshot(
    q,
    (snap) => {
      const list: ForumPostDoc[] = snap.docs
        .map((d) => {
          const raw = d.data() as Omit<ForumPostDoc, 'id'>;
          return {
            id: d.id,
            authorUid: raw.authorUid || '',
            n: raw.n || '',
            q: raw.q || '',
            a: raw.a || '',
            visible: raw.visible !== false,
            createdAt: raw.createdAt,
          };
        })
        .sort((a, b) => (b.createdAt?.toMillis?.() ?? 0) - (a.createdAt?.toMillis?.() ?? 0));
      onPosts(list);
    },
    (error) => {
      console.warn('Forum listener:', error);
    }
  );
}

export async function createForumPostDoc(uid: string, n: string, qText: string): Promise<void> {
  const postId = `fp_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const path = `forum_posts/${postId}`;
  const payload = {
    authorUid: uid,
    n: clampStr(n, 80) || 'Pengunjung',
    q: clampStr(qText, 500),
    a: '',
    visible: true,
    createdAt: serverTimestamp(),
  };

  try {
    await setDoc(doc(db, 'forum_posts', postId), payload);
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function updateForumReplyDoc(
  postId: string,
  a: string,
  visible: boolean
): Promise<void> {
  const path = `forum_posts/${postId}`;
  try {
    await updateDoc(doc(db, 'forum_posts', postId), {
      a: clampStr(a, 1000),
      visible: Boolean(visible),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function deleteForumPostDoc(postId: string): Promise<void> {
  const path = `forum_posts/${postId}`;
  try {
    await deleteDoc(doc(db, 'forum_posts', postId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export function subscribeAdminOrders(
  onOrders: (orders: StoredOrderDoc[]) => void,
  onError?: (err: unknown) => void
): () => void {
  const path = 'orders (collectionGroup)';
  return onSnapshot(
    collectionGroup(db, 'orders'),
    (snapshot) => {
      const list: StoredOrderDoc[] = snapshot.docs
        .map((d) => {
          const raw = d.data() as StoredOrderDoc;
          return {
            userId: raw.userId,
            no: raw.no || d.id,
            date: raw.date,
            name: raw.name,
            addr: raw.addr,
            method: raw.method,
            status: raw.status,
            items: Array.isArray(raw.items) ? raw.items : [],
            sub: raw.sub,
            disc: raw.disc,
            total: raw.total,
            createdAt: raw.createdAt,
          };
        })
        .sort((a, b) => (b.createdAt?.toMillis?.() ?? 0) - (a.createdAt?.toMillis?.() ?? 0));
      onOrders(list);
    },
    (error) => {
      if (onError) onError(error);
      else handleFirestoreError(error, OperationType.LIST, path);
    }
  );
}

export async function updateAdminOrderStatus(
  userId: string,
  orderNo: string,
  status: string
): Promise<void> {
  const path = `users/${userId}/orders/${orderNo}`;
  try {
    await updateDoc(doc(db, 'users', userId, 'orders', orderNo), { status });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

