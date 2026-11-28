import { useEffect, useState } from 'react';
import { PageId, WA_NUMBER } from '../data/ccnData';

interface EffectsLayerProps {
  currentPage: PageId;
}

export function EffectsLayer({ currentPage }: EffectsLayerProps) {
  const [showIntro, setShowIntro] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    const rm = window.matchMedia('(prefers-reduced-motion:reduce)').matches;
    let seen = false;
    try {
      seen = sessionStorage.getItem('ccn_intro') === '1';
    } catch {
      seen = false;
    }
    return !rm && !seen;
  });
  const [introFade, setIntroFade] = useState(false);
  const [introOut, setIntroOut] = useState(false);
  const [showTop, setShowTop] = useState(false);

  // Intro lifecycle
  useEffect(() => {
    if (!showIntro) return;
    try {
      sessionStorage.setItem('ccn_intro', '1');
    } catch {
      // ignore storage failure
    }
    document.body.classList.add('lock');
    let done = false;

    const closeIntro = () => {
      if (done) return;
      done = true;
      setIntroFade(true);
      setTimeout(() => setIntroOut(true), 260);
      setTimeout(() => {
        setShowIntro(false);
        document.body.classList.remove('lock');
      }, 1150);
    };

    const timer = window.setTimeout(closeIntro, 2600);
    const introEl = document.getElementById('intro');
    introEl?.addEventListener('click', closeIntro);

    return () => {
      window.clearTimeout(timer);
      introEl?.removeEventListener('click', closeIntro);
      document.body.classList.remove('lock');
    };
  }, [showIntro]);

  // Particle canvas
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion:reduce)').matches) return;
    const canvas = document.createElement('canvas');
    canvas.id = 'pt';
    canvas.setAttribute('aria-hidden', 'true');
    document.body.appendChild(canvas);
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      canvas.remove();
      return;
    }

    let W = 0;
    let H = 0;
    let dpr = 1;
    let ps: { x: number; y: number; vx: number; vy: number; r: number; z: number; s: boolean }[] = [];
    let mx = -999;
    let my = -999;
    let acc = '99,102,241';
    let last = window.scrollY;
    let tc = 0;
    let raf = 0;

    const readCol = () => {
      const v = getComputedStyle(document.documentElement).getPropertyValue('--ac').trim();
      const m = /^#([0-9a-f]{6})$/i.exec(v);
      if (m) {
        const n = parseInt(m[1], 16);
        acc = ((n >> 16) & 255) + ',' + ((n >> 8) & 255) + ',' + (n & 255);
      }
    };

    const init = () => {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      W = window.innerWidth;
      H = window.innerHeight;
      canvas.width = W * dpr;
      canvas.height = H * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      let n = Math.max(18, Math.min(70, Math.round((W * H) / 20000)));
      if (W < 760) n = Math.min(n, 30);
      ps = [];
      for (let i = 0; i < n; i++) {
        ps.push({
          x: Math.random() * W,
          y: Math.random() * H,
          vx: (Math.random() - 0.5) * 0.35,
          vy: (Math.random() - 0.5) * 0.35,
          r: 1.2 + Math.random() * 2,
          z: 0.4 + Math.random() * 0.6,
          s: Math.random() < 0.3,
        });
      }
    };

    const onMouseMove = (e: MouseEvent) => {
      mx = e.clientX;
      my = e.clientY;
    };
    const onMouseLeave = () => {
      mx = -999;
      my = -999;
    };
    const onScroll = () => {
      const d = window.scrollY - last;
      last = window.scrollY;
      for (let i = 0; i < ps.length; i++) {
        const p = ps[i];
        p.y -= d * 0.25 * p.z;
        if (p.y < -10) p.y += H + 20;
        else if (p.y > H + 10) p.y -= H + 20;
      }
    };

    window.addEventListener('resize', init);
    window.addEventListener('mousemove', onMouseMove, { passive: true });
    document.addEventListener('mouseleave', onMouseLeave);
    window.addEventListener('scroll', onScroll, { passive: true });

    const loop = () => {
      raf = requestAnimationFrame(loop);
      if (document.hidden) return;
      if (++tc % 120 === 1) readCol();
      ctx.clearRect(0, 0, W, H);
      for (let i = 0; i < ps.length; i++) {
        const p = ps[i];
        const dx = p.x - mx;
        const dy = p.y - my;
        const d = Math.sqrt(dx * dx + dy * dy);
        if (d < 130 && d > 0) {
          const k = ((130 - d) / 130) * 0.9;
          p.x += (dx / d) * k;
          p.y += (dy / d) * k;
        }
        p.x += p.vx * p.z;
        p.y += p.vy * p.z;
        if (p.x < -10) p.x = W + 10;
        else if (p.x > W + 10) p.x = -10;
        if (p.y < -10) p.y = H + 10;
        else if (p.y > H + 10) p.y = -10;

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, 6.2832);
        ctx.fillStyle = `rgba(${p.s ? '14,165,233' : acc},${0.25 + p.z * 0.4})`;
        ctx.fill();

        for (let j = i + 1; j < ps.length; j++) {
          const q = ps[j];
          const ex = p.x - q.x;
          const ey = p.y - q.y;
          const dd = ex * ex + ey * ey;
          if (dd < 14400) {
            ctx.beginPath();
            ctx.moveTo(p.x, p.y);
            ctx.lineTo(q.x, q.y);
            ctx.strokeStyle = `rgba(${acc},${0.16 * (1 - dd / 14400)})`;
            ctx.lineWidth = 1;
            ctx.stroke();
          }
        }
        if (d < 160) {
          ctx.beginPath();
          ctx.moveTo(p.x, p.y);
          ctx.lineTo(mx, my);
          ctx.strokeStyle = `rgba(${acc},${0.22 * (1 - d / 160)})`;
          ctx.lineWidth = 1;
          ctx.stroke();
        }
      }
    };

    readCol();
    init();
    loop();

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', init);
      window.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseleave', onMouseLeave);
      window.removeEventListener('scroll', onScroll);
      canvas.remove();
    };
  }, []);

  // Cursor glow
  useEffect(() => {
    if (!window.matchMedia('(hover:hover)').matches) return;
    const g = document.createElement('div');
    g.className = 'glow';
    document.body.appendChild(g);
    let x = 0;
    let y = 0;
    let cx = 0;
    let cy = 0;
    let on = false;
    let raf = 0;

    const onMove = (e: MouseEvent) => {
      x = e.clientX;
      y = e.clientY;
      if (!on) {
        cx = x;
        cy = y;
        on = true;
        g.style.opacity = '1';
      }
    };
    const onLeave = () => {
      g.style.opacity = '0';
      on = false;
    };

    window.addEventListener('mousemove', onMove, { passive: true });
    document.addEventListener('mouseleave', onLeave);

    const tick = () => {
      cx += (x - cx) * 0.15;
      cy += (y - cy) * 0.15;
      g.style.transform = `translate(${cx - 150}px,${cy - 150}px)`;
      raf = requestAnimationFrame(tick);
    };
    tick();

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseleave', onLeave);
      g.remove();
    };
  }, []);

  // Cursor-following Liquid Glass specular coordinates on buttons & controls
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion:reduce)').matches) return;
    const TARGET_SELECTOR =
      '.btn, .fchip, .hbt, .at, .rp-ref, .rp-fbtn, .adm-preset, .opt, .fab, .links a';

    const updatePointer = (e: PointerEvent) => {
      const target = (e.target as Element | null)?.closest?.(TARGET_SELECTOR) as HTMLElement | null;
      if (!target) return;
      const rect = target.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      target.style.setProperty('--mx', `${(e.clientX - rect.left).toFixed(1)}px`);
      target.style.setProperty('--my', `${(e.clientY - rect.top).toFixed(1)}px`);
    };

    window.addEventListener('pointermove', updatePointer, { passive: true });
    window.addEventListener('pointerdown', updatePointer, { passive: true });
    return () => {
      window.removeEventListener('pointermove', updatePointer);
      window.removeEventListener('pointerdown', updatePointer);
    };
  }, []);

  // Scroll to top FAB visibility
  useEffect(() => {
    const onScroll = () => setShowTop(window.scrollY > 400);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const tagline = 'Creative Craft Nation'.split('');
  const waFabHref = `https://wa.me/${WA_NUMBER}?text=${encodeURIComponent(
    `Halo CCN, saya ingin bertanya tentang tas kerajinan tangan. (Dari halaman ${currentPage})`
  )}`;

  return (
    <>
      {showIntro && (
        <div
          id="intro"
          aria-hidden="true"
          className={`${introFade ? 'fade' : ''} ${introOut ? 'out' : ''}`.trim()}
        >
          <div className="ip ip-t" />
          <div className="ip ip-b" />
          <div className="il">
            <div className="ib">
              <i className="b1" />
              <i className="b2" />
            </div>
            <div className="ic">
              <div className="ilw">
                <div className="ring" />
                <div className="ring r2" />
                <div className="lg ilogo" role="img" aria-label="Logo CCN" />
              </div>
              <div className="itag" id="itag">
                {tagline.map((ch, idx) => (
                  <span key={idx} style={{ animationDelay: `${1.1 + idx * 0.04}s` }}>
                    {ch}
                  </span>
                ))}
              </div>
              <div className="ibar">
                <i />
              </div>
            </div>
            <div className="iskip">Ketuk untuk melewati</div>
          </div>
        </div>
      )}

      <div className="fabs">
        <button
          type="button"
          className={`fab fab-up${showTop ? ' show' : ''}`}
          id="totop"
          aria-label="Kembali ke atas"
          title="Kembali ke atas"
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
        >
          <svg
            viewBox="0 0 24 24"
            width="20"
            height="20"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.4"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M12 19V5M5 12l7-7 7 7" />
          </svg>
        </button>
        <a
          className="fab fab-wa"
          id="wab"
          href={waFabHref}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Tanya lewat WhatsApp"
          title="Tanya lewat WhatsApp"
        >
          <svg viewBox="0 0 24 24" width="28" height="28" fill="currentColor">
            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
          </svg>
        </a>
      </div>
    </>
  );
}
