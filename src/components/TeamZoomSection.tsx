import { useCallback, useEffect, useRef } from 'react';
import { assetUrl, TEAM_MEMBERS } from '../data/ccnData';

export function TeamZoomSection() {
  const activeZoomRef = useRef<{
    src: HTMLElement;
    cl: HTMLElement;
    a: Animation;
    g: { s: number; dx: number; dy: number; cx: number; cy: number; h: number };
    closing?: boolean;
  } | null>(null);
  const overlayRef = useRef<HTMLDivElement | null>(null);

  const closeZ = useCallback(() => {
    const cur = activeZoomRef.current;
    const ov = overlayRef.current;
    if (!cur || cur.closing || !ov) return;
    cur.closing = true;
    ov.classList.remove('on');
    cur.a.cancel();
    const rm = window.matchMedia('(prefers-reduced-motion:reduce)').matches;
    const P = 'perspective(1400px) ';
    const b = cur.cl.animate(
      [
        {
          transform: `${P}translate(${cur.g.dx}px,${cur.g.dy}px) rotateY(0deg) scale(${cur.g.s})`,
        },
        { transform: `${P}translate(0px,0px) rotateY(-360deg) scale(1)` },
      ],
      {
        duration: rm ? 1 : 750,
        easing: 'cubic-bezier(.5,0,.2,1)',
        fill: 'forwards',
      }
    );
    b.onfinish = () => {
      cur.cl.remove();
      cur.src.style.visibility = '';
      document.body.classList.remove('lock');
      activeZoomRef.current = null;
    };
  }, []);

  const openZ = useCallback(
    (src: HTMLElement, name: string, nim: string, role: string, col: string) => {
      if (activeZoomRef.current) return;
      const ov = overlayRef.current;
      if (!ov) return;
      const rm = window.matchMedia('(prefers-reduced-motion:reduce)').matches;
      const P = 'perspective(1400px) ';
      const r = src.getBoundingClientRect();
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const s = Math.min((vh * 0.54) / r.height, (vw * 0.8) / r.width, 1.62);
      const cx = vw / 2;
      const cy = vh / 2 - 18;
      const g = {
        s,
        dx: cx - (r.left + r.width / 2),
        dy: cy - (r.top + r.height / 2),
        cx,
        cy,
        h: r.height * s,
      };

      const cl = src.cloneNode(true) as HTMLElement;
      cl.classList.remove('rv', 'in', 'mid');
      cl.removeAttribute('tabindex');
      cl.removeAttribute('role');
      cl.style.position = 'fixed';
      cl.style.left = `${r.left}px`;
      cl.style.top = `${r.top}px`;
      cl.style.width = `${r.width}px`;
      cl.style.height = `${r.height}px`;
      cl.style.margin = '0';
      cl.style.zIndex = '51';
      cl.style.transition = 'none';
      cl.style.transitionDelay = '0s';
      cl.style.transformOrigin = '50% 50%';
      cl.style.willChange = 'transform';

      document.body.appendChild(cl);
      src.style.visibility = 'hidden';

      const zg = ov.querySelector('.zg') as HTMLElement | null;
      const cap = ov.querySelector('.zcap') as HTMLElement | null;
      if (cap) {
        const bEl = cap.querySelector('b');
        const spanEl = cap.querySelector('span');
        if (bEl) bEl.textContent = name;
        if (spanEl) spanEl.textContent = `${role} · NIM ${nim}`;
        cap.style.top = `${Math.min(vh - 96, g.cy + g.h / 2 + 20)}px`;
      }
      if (zg) {
        zg.style.background = `radial-gradient(circle,${col} 0%,transparent 62%)`;
        zg.style.top = `${g.cy}px`;
        zg.classList.remove('pop');
        void zg.offsetWidth;
        zg.classList.add('pop');
      }

      document.body.classList.add('lock');
      ov.classList.add('on');

      const kf: Keyframe[] = [
        {
          transform: `${P}translate(0px,0px) rotateY(0deg) scale(1)`,
          offset: 0,
          easing: 'cubic-bezier(.45,0,.25,1)',
        },
        {
          transform: `${P}translate(${g.dx * 0.1}px,${g.dy * 0.1 - 26}px) rotateY(360deg) scale(1.12)`,
          offset: 0.52,
          easing: 'cubic-bezier(.2,.9,.2,1)',
        },
        {
          transform: `${P}translate(${g.dx}px,${g.dy}px) rotateY(360deg) scale(${g.s})`,
          offset: 1,
        },
      ];

      const a = cl.animate(kf, { duration: rm ? 1 : 1350, fill: 'forwards' });
      if (!rm) {
        const cs = ['#ffffff', '#fde68a', col];
        for (let i = 0; i < 18; i++) {
          const p = document.createElement('span');
          p.className = 'zp';
          p.style.left = `${g.cx - 4}px`;
          p.style.top = `${g.cy - 4}px`;
          p.style.background = cs[i % 3];
          document.body.appendChild(p);
          const ang = Math.random() * Math.PI * 2;
          const dist = 130 + Math.random() * 170;
          const an = p.animate(
            [
              { transform: 'translate(0px,0px) scale(1)', opacity: 1 },
              {
                transform: `translate(${Math.cos(ang) * dist}px,${Math.sin(ang) * dist}px) scale(.2)`,
                opacity: 0,
              },
            ],
            {
              duration: 900 + Math.random() * 400,
              delay: 700,
              easing: 'cubic-bezier(.1,.7,.3,1)',
              fill: 'both',
            }
          );
          an.onfinish = () => p.remove();
        }
      }

      cl.addEventListener('click', closeZ);
      activeZoomRef.current = { src, cl, a, g };
    },
    [closeZ]
  );

  useEffect(() => {
    const ov = document.createElement('div');
    ov.id = 'zo';
    ov.innerHTML =
      '<div class="zg"></div><button type="button" class="zx" aria-label="Tutup">&times;</button><div class="zcap"><b></b><span></span><small>Ketuk di mana saja untuk menutup</small></div>';
    ov.addEventListener('click', closeZ);
    document.body.appendChild(ov);
    overlayRef.current = ov;

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeZ();
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('hashchange', closeZ);
    window.addEventListener('resize', closeZ);

    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('hashchange', closeZ);
      window.removeEventListener('resize', closeZ);
      if (activeZoomRef.current) {
        activeZoomRef.current.cl.remove();
        document.body.classList.remove('lock');
      }
      ov.remove();
    };
  }, [closeZ]);

  return (
    <div className="tgrid">
      {TEAM_MEMBERS.map((member) => (
        <div
          key={member.nim}
          className={`tc${member.mid ? ' mid' : ''}`}
          style={
            {
              '--c1': member.c1,
              '--c2': member.c2,
            } as React.CSSProperties
          }
          tabIndex={0}
          role="button"
          aria-label={`Lihat ${member.name} (${member.role})`}
          onClick={(e) =>
            openZ(e.currentTarget, member.name, member.nim, member.role, member.c1)
          }
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              openZ(e.currentTarget, member.name, member.nim, member.role, member.c1);
            }
          }}
        >
          <div className="tbag-handle" aria-hidden="true">
            <svg viewBox="0 0 120 46" fill="none">
              <path
                d="M22 44 C22 10, 98 10, 98 44"
                stroke="rgba(255,255,255,0.45)"
                strokeWidth="12"
                strokeLinecap="round"
              />
              <path
                d="M22 44 C22 10, 98 10, 98 44"
                stroke="var(--c2)"
                strokeWidth="8"
                strokeLinecap="round"
              />
              <path
                d="M22 44 C22 10, 98 10, 98 44"
                stroke="rgba(255,255,255,0.62)"
                strokeWidth="2.2"
                strokeDasharray="4 4"
                strokeLinecap="round"
              />
            </svg>
          </div>
          <div className="tpatch" aria-hidden="true">
            <span>HANDMADE</span>
          </div>
          <div className="tr">
            {member.photo ? (
              <img
                src={assetUrl(member.photo)}
                alt={`Foto ${member.name}`}
                draggable={false}
                style={{
                  objectPosition: member.photoPos || '50% 25%',
                  transform: member.photoZoom ? `scale(${member.photoZoom})` : undefined,
                  transformOrigin: member.photoOrigin || member.photoPos || '50% 25%',
                }}
              />
            ) : (
              member.initials
            )}
          </div>
          <div className="tn">{member.name}</div>
          <div className="trole">{member.role}</div>
          <div className="tnim">{member.nim}</div>
          <div className="lg tlg" role="img" aria-label="Logo CCN" />
        </div>
      ))}
    </div>
  );
}
