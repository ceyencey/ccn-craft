export type PageId =
  | 'beranda'
  | 'tentang'
  | 'produk'
  | 'belajar'
  | 'forum'
  | 'kelompok'
  | 'lacak'
  | 'admin';

export const PAGE_IDS: PageId[] = [
  'beranda',
  'tentang',
  'produk',
  'belajar',
  'forum',
  'kelompok',
  'lacak',
  'admin',
];

export function assetUrl(path: string): string {
  if (!path || /^(https?:|data:|blob:)/i.test(path)) return path;
  const base = import.meta.env.BASE_URL || '/';
  const normalizedBase = base.endsWith('/') ? base : `${base}/`;
  if (normalizedBase !== '/' && path.startsWith(normalizedBase)) return path;
  const normalizedPath = path.replace(/^\/+/, '');
  return `${normalizedBase}${normalizedPath}`;
}

export const ADMIN_EMAIL = 'www.charlesindigo@gmail.com';
export const WA_NUMBER = '6285156249864';
export const DANA_NUMBER = '085156249864';
export const DANA_DISPLAY = '0851-5624-9864';
export const DANA_OWNER_NAME = 'CCN (Creative Craft Nation)';
export const DANA_DEEP_LINK = 'https://link.dana.id/';
export const QRIS_IMAGE = assetUrl(
  '/assets/aistudio/WhatsApp_Image_2026-11-21_at_17.04.15_4815362e.jpeg'
);
export const MASCOT_IMAGE = assetUrl('/assets/ccn/yarn-mascot.png');

export interface SiteConfigData {
  announcement: string;
  heroPill: string;
  heroTitle: string;
  heroSubtitle: string;
  aboutSummary: string;
  visi: string;
  tujuan: string;
  whatsapp: string;
  socialHandle: string;
  footerText: string;
}

export const DEFAULT_SITE_CONFIG: SiteConfigData = {
  announcement: '',
  heroPill: 'Koleksi Tas Kerajinan Tangan',
  heroTitle: 'Ekspresikan gayamu dengan tas handmade.',
  heroSubtitle:
    'Creative Craft Nation: tas kerajinan tangan dengan desain menarik dan unik. Stylish, berkualitas, memiliki nilai estetika, serta ramah di kantong.',
  aboutSummary:
    'CCN (Creative Craft Nation) adalah bisnis yang bergerak di bidang penjualan tas kerajinan tangan dengan berbagai pilihan desain menarik dan unik. Produk yang ditawarkan dibuat dengan mengutamakan kreativitas, kualitas, dan nilai seni, mulai dari desain minimalis hingga modern. Kami berkomitmen menyediakan tas kerajinan tangan yang stylish, berkualitas, memiliki nilai estetika, serta ramah di kantong.',
  visi: 'Menjadi merek tas kerajinan tangan pilihan yang menghadirkan produk berkualitas, kreatif, dan memiliki desain unik sesuai dengan karakter serta kebutuhan setiap pengguna.',
  tujuan:
    'Tujuan utama pembuatan dan penjualan tas kerajinan tangan adalah untuk menyediakan produk aksesori yang tidak hanya memiliki fungsi sebagai tempat menyimpan dan membawa barang, tetapi juga dapat meningkatkan nilai estetika serta memberikan kesempatan kepada pengguna untuk mengekspresikan gaya dan kreativitas mereka. Produk tas dibuat dengan mengutamakan kualitas, keunikan desain, dan harga yang terjangkau.',
  whatsapp: WA_NUMBER,
  socialHandle: '@ccn.id · @ccn.craft',
  footerText: '© 2026 CCN (Creative Craft Nation) · Tugas Kelompok',
};

export interface FaqItemData {
  id: string;
  question: string;
  answer: string;
  sortOrder: number;
  active: boolean;
}

export const DEFAULT_FAQS: FaqItemData[] = [
  {
    id: 'faq_1',
    question: 'Berapa lama pengiriman?',
    answer:
      'Pesanan dikirim lewat ekspedisi. Estimasi 1–3 hari kerja untuk kota besar dan 3–5 hari kerja untuk daerah lain.',
    sortOrder: 1,
    active: true,
  },
  {
    id: 'faq_2',
    question: 'Apakah semua tas CCN dibuat secara handmade?',
    answer:
      'Ya. Setiap tas dibuat dengan keterampilan tangan, mulai dari teknik rajut, simpul tali macrame, hingga kombinasi potongan kain perca pilihan.',
    sortOrder: 2,
    active: true,
  },
  {
    id: 'faq_3',
    question: 'Bagaimana jika produk cacat atau tidak sesuai?',
    answer:
      'Hubungi kami lewat WhatsApp maksimal 7 hari setelah barang diterima, sertakan foto produk, untuk penukaran.',
    sortOrder: 3,
    active: true,
  },
  {
    id: 'faq_4',
    question: 'Metode pembayaran apa yang tersedia?',
    answer:
      'QRIS resmi CCN dan E-Wallet DANA (0851-5624-9864) dengan nomor pesanan yang diterbitkan setelah pembayaran selesai, serta opsi virtual account bank dan kartu debit/kredit.',
    sortOrder: 4,
    active: true,
  },
  {
    id: 'faq_5',
    question: 'Bagaimana cara memakai kode voucher?',
    answer: 'Masukkan kode CCN10 di keranjang untuk diskon 10% pembelian pertama.',
    sortOrder: 5,
    active: true,
  },
  {
    id: 'faq_6',
    question: 'Kapan pesanan saya mulai diproses?',
    answer:
      'Pesanan baru diproses setelah struk pembelian kami terima lewat WhatsApp. Jika lupa melampirkannya, kirim saja gambarnya di chat yang sama atau buka lagi lewat tombol Struk di Akun Saya.',
    sortOrder: 6,
    active: true,
  },
];

export const rp = (n: number): string => 'Rp ' + n.toLocaleString('id-ID');

export interface BagColorOption {
  name: string;
  hex: string;
}

export interface BagProduct {
  id: number;
  name: string;
  desc: string;
  price: number;
  oldPrice?: number;
  category: 'Tas Rajut' | 'Simpul Tali' | 'Kain Perca';
  badge?: 'Terlaris' | 'Baru' | 'Diskon';
  popularity: number;
  image: string;
  tint: string;
  colors: BagColorOption[];
  material: string;
  technique: string;
  dimensions: string;
  features: string[];
}

export const BAG_VARIANTS = [
  'Ukuran Standar',
  'Standar + Furing Resleting',
  'Standar + Tali Panjang',
] as const;

export const PRODUCTS: BagProduct[] = [
  {
    id: 0,
    name: 'Floral Patchwork Tote',
    desc: 'Tas dari kombinasi berbagai potongan kain dengan motif dan warna yang menarik.',
    price: 85000,
    category: 'Kain Perca',
    popularity: 88,
    image: '/assets/aistudio/image_0f62634e.png',
    tint: '#d97757',
    colors: [
      { name: 'Motif Bunga Hangat', hex: '#d97757' },
      { name: 'Pastel Taman', hex: '#c4b5fd' },
      { name: 'Terracotta Klasik', hex: '#b45309' },
    ],
    material: 'Kain katun perca pilihan dengan lapisan dalam lembut',
    technique: 'Jahit patchwork dan aplikasi bunga timbul handmade',
    dimensions: '32 × 28 × 10 cm',
    features: ['Ramah lingkungan', 'Motif floral unik', 'Ringan dan muat banyak'],
  },
  {
    id: 1,
    name: 'Natural Macrame Bag',
    desc: 'Tas handmade dengan teknik simpul tali yang memberikan kesan natural, unik, dan stylish.',
    price: 95000,
    category: 'Simpul Tali',
    popularity: 90,
    image: '/assets/aistudio/image_39081197.png',
    tint: '#78553a',
    colors: [
      { name: 'Cokelat Kayu', hex: '#78553a' },
      { name: 'Krem Alami', hex: '#d6c7b2' },
      { name: 'Caramel', hex: '#a16207' },
    ],
    material: 'Tali katun macrame 4mm berkualitas kuat',
    technique: 'Anyaman simpul tali macrame dengan gantungan tassel',
    dimensions: '26 × 20 × 8 cm',
    features: ['Tahan lama', 'Tekstur anyaman rapi', 'Gantungan tassel manis'],
  },
  {
    id: 2,
    name: 'Sweet Ribbon Crochet Bag',
    desc: 'Tas rajut dengan hiasan pita besar dan bunga-bunga kecil yang memberikan kesan manis dan feminin.',
    price: 140000,
    category: 'Tas Rajut',
    popularity: 92,
    image: '/assets/aistudio/image_f87f5b61.png',
    tint: '#f472b6',
    colors: [
      { name: 'Pink Cream', hex: '#f472b6' },
      { name: 'Peach Cream', hex: '#fb923c' },
      { name: 'Lavender Cream', hex: '#a78bfa' },
    ],
    material: 'Benang rajut milk cotton & polyester halus',
    technique: 'Rajutan tangan dengan aplikasi pita besar dan bunga kecil',
    dimensions: '27 × 22 × 9 cm',
    features: ['Tepian bergelombang', 'Hiasan pita 3D', 'Nyaman dijinjing'],
  },
  {
    id: 3,
    name: 'Sage Blossom Crochet Bag',
    desc: 'Tas rajut handmade dengan perpaduan warna sage green dan cream, dihiasi bunga-bunga rajut dan pita cantik yang memberikan kesan natural, fresh, dan elegan.',
    price: 150000,
    category: 'Tas Rajut',
    badge: 'Terlaris',
    popularity: 98,
    image: '/assets/aistudio/image_00e9978d.png',
    tint: '#84a98c',
    colors: [
      { name: 'Sage Green & Cream', hex: '#84a98c' },
      { name: 'Olive & Ivory', hex: '#6b705c' },
      { name: 'Mint & Cream', hex: '#6ee7b7' },
    ],
    material: 'Benang katun rajut premium dengan label kulit sintetik Handmade',
    technique: 'Rajutan granny floral dan aksen pita pom-pom',
    dimensions: '29 × 24 × 10 cm',
    features: ['Desain eksklusif CCN', 'Detail bunga rajut penuh', 'Cocok untuk hangout & hadiah'],
  },
  {
    id: 4,
    name: 'Vintage Cherry Crochet Bag',
    desc: 'Tas rajut dengan kombinasi warna cokelat dan cream, dilengkapi motif bunga kotak-kotak dan hiasan cerry yang memberikan kesan vintage, manis, dan unik.',
    price: 120000,
    category: 'Tas Rajut',
    badge: 'Baru',
    popularity: 94,
    image: '/assets/aistudio/image_6d448df5.png',
    tint: '#9c6644',
    colors: [
      { name: 'Cokelat & Cream', hex: '#9c6644' },
      { name: 'Espresso & Oat', hex: '#582f0e' },
    ],
    material: 'Benang rajut katun tebal bertekstur kokoh',
    technique: 'Motif granny square bunga kotak-kotak dan gantungan ceri rajut',
    dimensions: '26 × 22 × 9 cm',
    features: ['Gaya vintage klasik', 'Hiasan ceri rajut lepas-pasang', 'Pegangan empuk dan kuat'],
  },
];

export interface ArticleItem {
  title: string;
  body: string;
}

export const ARTICLES: ArticleItem[] = [
  {
    title: 'Cara Membuat Tas Rajut Simple untuk Pemula',
    body: 'Siapkan benang katun atau polyester dan hakpen ukuran 4.0 mm. Mulai dengan membuat tusuk rantai (chain) sepanjang 25 cm sebagai alas tas, lalu lanjutkan dengan tusuk tunggal (single crochet) melingkar hingga mencapai tinggi tas yang diinginkan. Tambahkan dua tali pegangan rajut dan hiasan pita atau bunga kecil agar tampilan semakin manis.',
  },
  {
    title: 'Teknik Dasar Simpul Tali Macrame & Kain Perca',
    body: 'Untuk tas macrame simple, cukup kuasai dua simpul dasar: lark’s head knot untuk memasang tali pada ring atau pegangan, dan square knot secara bergantian untuk membentuk badan tas. Sementara pada tas kain perca (patchwork), potong kain berbentuk persegi sama sisi, jahit sambung dengan kampuh 1 cm, lalu lapisi furing agar tas kuat membawa barang harian.',
  },
  {
    title: '5 Tips Merawat Tas Kerajinan Tangan Agar Awet',
    body: 'Cuci tas rajut atau macrame secara manual dengan air dingin dan sabun lembut tanpa memerasnya terlalu keras. Jemur dengan cara diangin-anginkan di tempat teduh sambil merapikan bentuk tas agar tidak melar. Simpan di tempat kering dan beri isian kertas tisu saat tidak digunakan.',
  },
];

export interface VideoTutorial {
  id: string;
  title: string;
  subtitle: string;
  bgClass: 'vt1' | 'vt2';
  youtubeId: string;
  youtubeUrl: string;
}

export const VIDEO_TUTORIALS: VideoTutorial[] = [
  {
    id: 'yt1',
    title: 'Video Panduan Membuat Tas Kerajinan #1',
    subtitle: 'Klik untuk tonton langsung di YouTube',
    bgClass: 'vt1',
    youtubeId: '5EMBgcUIvsA',
    youtubeUrl: 'https://youtu.be/5EMBgcUIvsA?si=jFl_fgnxw36YZfZ6',
  },
  {
    id: 'yt2',
    title: 'Video Panduan Membuat Tas Kerajinan #2',
    subtitle: 'Klik untuk tonton langsung di YouTube',
    bgClass: 'vt2',
    youtubeId: '0i57znuCSYE',
    youtubeUrl: 'https://youtu.be/0i57znuCSYE?si=1y57maAe25N-ZyQn',
  },
];

export interface QuizQuestion {
  question: string;
  answer: string;
  options: string[];
}

export const QUIZ_QUESTIONS: QuizQuestion[] = [
  {
    question: 'Simpul dasar yang paling sering digunakan untuk membentuk badan tas macrame adalah?',
    answer: 'Square knot (simpul datar)',
    options: [
      'Simpul mati biasa',
      'Square knot (simpul datar)',
      'Jahit obras mesin',
    ],
  },
  {
    question: 'Teknik menggabungkan berbagai potongan kain bermotif menjadi satu permukaan tas disebut?',
    answer: 'Patchwork (kain perca)',
    options: [
      'Sablon plastisol',
      'Patchwork (kain perca)',
      'Bordir digital',
    ],
  },
  {
    question: 'Cara paling aman mencuci dan merawat tas rajut handmade agar tidak melar adalah?',
    answer: 'Cuci lembut dengan tangan dan jemur di tempat teduh',
    options: [
      'Masuk mesin pengering suhu tinggi',
      'Disikat keras dengan pemutih',
      'Cuci lembut dengan tangan dan jemur di tempat teduh',
    ],
  },
];

export interface ForumEntry {
  n: string;
  q: string;
  a: string;
}

export const INITIAL_FORUM: ForumEntry[] = [
  {
    n: 'Rina',
    q: 'Apakah tas rajut Sage Blossom muat untuk membawa dompet, HP, dan botol minum kecil?',
    a: 'Muat banget! Ukurannya 29 × 24 × 10 cm dan rajutannya cukup kokoh untuk perlengkapan harian.',
  },
  {
    n: 'Dimas',
    q: 'Berapa lama pengiriman tas kerajinan ke Bandung?',
    a: 'Sekitar 1–2 hari kerja setelah pesanan dikonfirmasi melalui WhatsApp.',
  },
];

export interface TeamMember {
  name: string;
  nim: string;
  role: string;
  initials: string;
  c1: string;
  c2: string;
  mid?: boolean;
  photo?: string;
  photoPos?: string;
  photoZoom?: number;
  photoOrigin?: string;
}

export const TEAM_MEMBERS: TeamMember[] = [
  {
    name: 'Chintya L. Sihotang',
    nim: '2531010',
    role: 'OWNER',
    initials: 'CLS',
    c1: '#818cf8',
    c2: '#4f46e5',
    photo: '/assets/aistudio/foto_chintya__c6083ddc.jpeg',
    photoPos: '50% 22%',
    photoZoom: 1.06,
    photoOrigin: '50% 26%',
  },
  {
    name: 'Chrisyen J.V.',
    nim: '2531003',
    role: 'OWNER DEVELOPER',
    initials: 'CJV',
    c1: '#38bdf8',
    c2: '#0369a1',
    mid: true,
    photo: '/assets/aistudio/foto_ceyen2_3705b94c.jpg',
    photoPos: '49% 28%',
    photoZoom: 1.24,
    photoOrigin: '49% 32%',
  },
  {
    name: 'Nadya D. Tambunan',
    nim: '2531008',
    role: 'OWNER',
    initials: 'NDT',
    c1: '#f472b6',
    c2: '#be185d',
    photo: '/assets/aistudio/foto_nadya_bb58dacc.jpeg',
    photoPos: '52% 54%',
    photoZoom: 2.2,
    photoOrigin: '52% 54%',
  },
];

export interface CartItem {
  k: string;
  n: string;
  p: number;
  q: number;
}

export interface InvoiceRecord {
  no: string;
  date: string;
  name: string;
  addr: string;
  method: string;
  status?: string;
  items: CartItem[];
  sub: number;
  disc: number;
  bundleDisc?: number;
  total: number;
}

export interface TrackOrderRecord {
  ts: number;
  name: string;
  total: number;
  method: string;
  items: string[];
}

export const ORDER_STAGES: [string, string][] = [
  ['Dibuat', 'Pesanan kamu sudah kami terima dan menunggu pembayaran.'],
  ['Dibayar', 'Pembayaran sudah dikonfirmasi. Pesanan masuk antrean pengemasan.'],
  ['Dikemas', 'Tas kerajinan tangan sedang dikemas dengan aman oleh tim CCN.'],
  ['Dikirim', 'Pesanan dalam perjalanan bersama kurir menuju alamatmu.'],
  ['Tiba', 'Pesanan sudah tiba. Terima kasih sudah berbelanja di CCN!'],
];

export const MASCOT_QUICK_QUESTIONS: [string, string][] = [
  [
    'Tanya produk & harga tas',
    'Halo CCN, saya ingin bertanya tentang koleksi tas kerajinan tangan dan harganya.',
  ],
  [
    'Cara memesan tas CCN',
    'Halo CCN, bagaimana cara memesan tas kerajinan tangan di website?',
  ],
  [
    'Cara pakai kode voucher CCN10',
    'Halo CCN, bagaimana cara memakai kode voucher diskon 10% (CCN10)?',
  ],
  [
    'Pengiriman & perawatan tas',
    'Halo CCN, bagaimana estimasi pengiriman dan cara merawat tas handmade?',
  ],
];
