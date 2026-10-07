/** Animasi muncul saat elemen masuk layar (scroll reveal). */
import { useEffect } from 'react';

/* ---------- animasi muncul saat terlihat (scroll reveal) ---------- */
const REVEAL_SEL = [
  '.page-head', '.hero > *', '.track-form', '.pub-intro', '.panel', '.stat', '.todo-card', '.help-card', '.todo-item',
  '.app-card', '.panel tbody tr', '.pick-card', '.svc-card', '.cta-navy', '.steps-list li', '.f-row', '.decision-item', '.task-box', '.home-head',
  'section', '.tabs', '.segmented', '.wizard', '.m-row', '.list-group-item', '.finding', '.choice',
].join(',');

/**
 * Memberi animasi muncul (fade + naik) pada kartu, baris tabel, dll. di dalam ref saat masuk layar.
 * Aman untuk React StrictMode (efek dijalankan 2x saat dev): elemen yang belum sempat tampil dipulihkan saat cleanup.
 */
export function useReveal(ref) {
  useEffect(() => {
    const root = ref.current;
    if (!root || !('IntersectionObserver' in window)) return undefined;
    if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return undefined;
    const pending = new Set();
    const timers = [];
    let batch = 0; let reset;
    const finish = (el) => { el.classList.remove('rv', 'in'); el.style.transitionDelay = ''; pending.delete(el); };
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (!e.isIntersecting) return;
        const el = e.target;
        io.unobserve(el);
        el.style.transitionDelay = `${Math.min(batch, 8) * 45}ms`;
        batch += 1;
        clearTimeout(reset); reset = setTimeout(() => { batch = 0; }, 150);
        requestAnimationFrame(() => el.classList.add('in'));
        timers.push(setTimeout(() => finish(el), 950));
      });
    }, { rootMargin: '0px 0px -4% 0px', threshold: 0.01 });
    const scan = () => root.querySelectorAll(REVEAL_SEL).forEach((el) => {
      if (el.dataset.rv) return;
      el.dataset.rv = '1';
      if (el.closest('.ui-modal') || !el.getClientRects().length) return; // tersembunyi (mis. tabel di HP): tanpa animasi
      el.classList.add('rv');
      pending.add(el);
      io.observe(el);
    });
    scan();
    const mo = new MutationObserver(scan);
    mo.observe(root, { childList: true, subtree: true });
    // pengaman: apa pun yang belum tampil setelah 2,5 detik langsung ditampilkan
    const failsafe = setInterval(() => pending.forEach((el) => {
      const r = el.getBoundingClientRect();
      if (r.top < window.innerHeight && r.bottom > 0 && !el.classList.contains('in')) { el.classList.add('in'); timers.push(setTimeout(() => finish(el), 700)); }
    }), 2500);
    return () => {
      io.disconnect(); mo.disconnect(); clearTimeout(reset); clearInterval(failsafe); timers.forEach(clearTimeout);
      pending.forEach((el) => { el.classList.remove('rv', 'in'); el.style.transitionDelay = ''; delete el.dataset.rv; });
      pending.clear();
    };
  }, [ref]);
}
