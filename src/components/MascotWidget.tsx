import { useCallback, useEffect, useRef, useState } from 'react';
import { MASCOT_IMAGE, MASCOT_QUICK_QUESTIONS, PageId, WA_NUMBER } from '../data/ccnData';

interface MascotWidgetProps {
  currentPage: PageId;
  cartOpen: boolean;
}

export function MascotWidget({ currentPage, cartOpen }: MascotWidgetProps) {
  const [hidden, setHidden] = useState(false);
  const [wbOpen, setWbOpen] = useState(false);
  const [wbReady, setWbReady] = useState(false);
  const [showHint, setShowHint] = useState(false);
  const [animClass, setAnimClass] = useState<'hop' | 'wave' | ''>('');
  const [onRight, setOnRight] = useState(false);
  const [wbPos, setWbPos] = useState({ left: 12, bottom: 140, tx: '40px' });
  const [layoutMetrics, setLayoutMetrics] = useState(() => ({
    vw: typeof document !== 'undefined' ? document.documentElement.clientWidth : 1024,
    compact:
      typeof window !== 'undefined'
        ? window.matchMedia('(max-width: 760px), (hover: none)').matches
        : false,
  }));

  const mcRef = useRef<HTMLDivElement>(null);
  const mciRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const wbRef = useRef<HTMLDivElement>(null);
  const prevPageRef = useRef<PageId>(currentPage);
  const animTimerRef = useRef<number | undefined>(undefined);
  const readyTimerRef = useRef<number | undefined>(undefined);

  const triggerAnim = useCallback((kind: 'hop' | 'wave') => {
    setAnimClass('');
    window.clearTimeout(animTimerRef.current);
    requestAnimationFrame(() => {
      setAnimClass(kind);
      animTimerRef.current = window.setTimeout(() => setAnimClass(''), 1800);
    });
  }, []);

  useEffect(() => {
    document.body.classList.toggle('mcoff', hidden);
    return () => document.body.classList.remove('mcoff');
  }, [hidden]);

  useEffect(() => {
    document.body.classList.toggle('mcright', onRight && !hidden);
    return () => document.body.classList.remove('mcright');
  }, [onRight, hidden]);

  useEffect(() => {
    const updateMetrics = () => {
      setLayoutMetrics({
        vw: document.documentElement.clientWidth,
        compact: window.matchMedia('(max-width: 760px), (hover: none)').matches,
      });
    };
    updateMetrics();
    window.addEventListener('resize', updateMetrics);
    return () => window.removeEventListener('resize', updateMetrics);
  }, []);

  // Move mascot left/right when switching pages
  useEffect(() => {
    if (prevPageRef.current !== currentPage) {
      prevPageRef.current = currentPage;
      setWbOpen(false);
      setWbReady(false);
      setOnRight((prev) => {
        const next = !prev;
        if (!hidden) triggerAnim('wave');
        return next;
      });
    }
  }, [currentPage, hidden, triggerAnim]);

  // Initial chat hint bubble after 8s
  useEffect(() => {
    const t = window.setTimeout(() => {
      if (!wbOpen && !hidden) {
        setShowHint(true);
        window.setTimeout(() => setShowHint(false), 4700);
      }
    }, 8000);
    return () => window.clearTimeout(t);
  }, [hidden, wbOpen]);

  // Physics loop for scroll velocity, cursor look, and cart opacity
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion:reduce)').matches) return;
    let vel = 0;
    let dist = 0;
    let last = window.scrollY;
    let mx = -999;
    let my = -999;
    let scrollTimer = 0;
    let raf = 0;

    const onScroll = () => {
      const y = window.scrollY;
      const d = y - last;
      vel += d;
      dist += Math.abs(d);
      last = y;
      window.clearTimeout(scrollTimer);
      scrollTimer = window.setTimeout(() => {
        if (!hidden && dist > 60) triggerAnim('hop');
        dist = 0;
      }, 180);
    };
    const onMove = (e: MouseEvent) => {
      mx = e.clientX;
      my = e.clientY;
    };

    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('mousemove', onMove, { passive: true });

    const tick = () => {
      const mc = mcRef.current;
      const mci = mciRef.current;
      const pu = imgRef.current;
      if (mc && mci && pu) {
        const r = mc.getBoundingClientRect();
        const cx = r.left + r.width / 2;
        const cy = r.top + r.height / 2;
        vel *= 0.88;
        const ty = Math.max(-26, Math.min(26, -vel * 0.5));
        const rot = Math.max(-14, Math.min(14, vel * 0.25));
        mci.style.transform = `translateY(${ty}px) rotate(${rot}deg)`;

        const dx = mx - cx;
        const dy = my - cy;
        const d = Math.sqrt(dx * dx + dy * dy) || 1;
        const k = (Math.min(d, 200) / 200) * 3.5;
        pu.style.transform = `translate(${(dx / d) * k}px,${(dy / d) * k}px)`;

        const op = cartOpen ? 0 : wbOpen || d < 62 || d >= 130 ? 1 : 0.25;
        mc.style.opacity = String(op);
      }
      raf = requestAnimationFrame(tick);
    };
    tick();

    return () => {
      cancelAnimationFrame(raf);
      window.clearTimeout(scrollTimer);
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('mousemove', onMove);
    };
  }, [cartOpen, hidden, triggerAnim, wbOpen]);

  const placeBubble = useCallback(() => {
    const mc = mcRef.current;
    const wb = wbRef.current;
    if (!mc || !wb) return;
    const r = mc.getBoundingClientRect();
    const vw = document.documentElement.clientWidth;
    const w = wb.offsetWidth || 300;
    const l = Math.max(12, Math.min(r.left + r.width / 2 - w / 2, vw - w - 12));
    const tx = Math.max(20, Math.min(r.left + r.width / 2 - l - 9, w - 40));
    setWbPos({
      left: l,
      bottom: window.innerHeight - r.top + 12,
      tx: `${tx}px`,
    });
  }, []);

  const openBubble = () => {
    if (wbOpen) {
      closeBubble();
      return;
    }
    triggerAnim('hop');
    setWbOpen(true);
    setWbReady(false);
    setShowHint(false);
    requestAnimationFrame(placeBubble);
    window.clearTimeout(readyTimerRef.current);
    readyTimerRef.current = window.setTimeout(() => {
      setWbReady(true);
      requestAnimationFrame(placeBubble);
    }, 900);
  };

  const closeBubble = useCallback(() => {
    window.clearTimeout(readyTimerRef.current);
    setWbOpen(false);
    setWbReady(false);
  }, []);

  useEffect(() => {
    if (!wbOpen) return;
    const onDocClick = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        wbRef.current &&
        !wbRef.current.contains(target) &&
        mcRef.current &&
        !mcRef.current.contains(target)
      ) {
        closeBubble();
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeBubble();
    };
    document.addEventListener('click', onDocClick);
    window.addEventListener('keydown', onKey);
    window.addEventListener('resize', closeBubble);
    return () => {
      document.removeEventListener('click', onDocClick);
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('resize', closeBubble);
    };
  }, [wbOpen, closeBubble]);

  const makeWaLink = (text: string) =>
    `https://wa.me/${WA_NUMBER}?text=${encodeURIComponent(
      `${text} (Dari halaman ${currentPage})`
    )}`;

  const mcWidth = layoutMetrics.compact ? 72 : 96;
  const edgeGap = 16;
  const leftPx = onRight ? Math.max(edgeGap, layoutMetrics.vw - mcWidth - edgeGap) : edgeGap;

  return (
    <>
      <div
        ref={wbRef}
        className={`wb${wbOpen ? ' on' : ''}${wbReady ? ' rd' : ''}`}
        id="wb"
        role="dialog"
        aria-label="Chat WhatsApp CCN"
        style={
          {
            left: `${wbPos.left}px`,
            bottom: `${wbPos.bottom}px`,
            '--tx': wbPos.tx,
          } as React.CSSProperties
        }
      >
        <div className="wbh">
          <img
            className="wbav"
            id="wbav"
            src={MASCOT_IMAGE}
            alt="Maskot Benang CCN"
            referrerPolicy="no-referrer"
          />
          <div className="wbt">
            <b>Maskot Benang CCN</b>
            <span>
              <i />
              Online · membalas cepat
            </span>
          </div>
          <button
            type="button"
            className="wbx"
            id="wbx"
            aria-label="Tutup"
            onClick={closeBubble}
          >
            &times;
          </button>
        </div>
        <div className="wbb">
          <div className="wbm wbty">
            <span />
            <span />
            <span />
          </div>
          <div className="wbm wbmsg">
            Halo! Aku maskot benang CCN. Ada yang bisa kubantu soal tas kerajinan tangan?
          </div>
          <div className="wbq" id="wbq">
            {MASCOT_QUICK_QUESTIONS.map(([label, message], k) => (
              <a
                key={label}
                className="wbqa"
                style={{ '--i': k } as React.CSSProperties}
                target="_blank"
                rel="noopener noreferrer"
                href={makeWaLink(message)}
              >
                {label}
              </a>
            ))}
          </div>
        </div>
        <div className="wbf">
          <a
            className="wbgo"
            id="wbgo"
            target="_blank"
            rel="noopener noreferrer"
            href={makeWaLink('Halo CCN, saya ingin bertanya tentang tas kerajinan tangan.')}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
            </svg>
            Mulai chat di WhatsApp
          </a>
        </div>
      </div>

      <div
        ref={mcRef}
        className={`mc${hidden ? ' off' : ''}${wbOpen ? ' wopen' : ''}${
          showHint ? ' hint' : ''
        }${onRight ? ' right' : ''}`}
        id="mc"
        style={{ left: `${leftPx}px` }}
      >
        <button
          className="mct"
          id="mct"
          type="button"
          aria-label={hidden ? 'Tampilkan maskot' : 'Sembunyikan maskot'}
          title={hidden ? 'Tampilkan maskot' : 'Sembunyikan maskot'}
          onClick={() => {
            setHidden((h) => !h);
            closeBubble();
          }}
        >
          {hidden ? '+' : '×'}
        </button>
        <span className="mchint">Chat aku yuk!</span>
        <div
          className={`mcb${animClass ? ' ' + animClass : ''}`}
          role="button"
          tabIndex={0}
          aria-label="Chat WhatsApp dengan maskot CCN"
          onClick={openBubble}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              openBubble();
            }
          }}
        >
          <div className="mci" ref={mciRef}>
            <span className="mcwa" aria-hidden="true">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
              </svg>
            </span>
            <img
              ref={imgRef}
              className="mcimg"
              alt="Maskot Benang CCN"
              draggable={false}
              src={MASCOT_IMAGE}
              referrerPolicy="no-referrer"
            />
          </div>
        </div>
      </div>
    </>
  );
}
