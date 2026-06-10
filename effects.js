/* ECHELON — ambient effects
   Deliberately subtle: a faint drifting network, gentle scroll reveals,
   and count-up stats. Honors prefers-reduced-motion. No interaction, no noise. */
(function () {
    const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    /* ── 1. Faint network background ───────────────────────── */
    function initNetwork() {
        const canvas = document.createElement('canvas');
        canvas.className = 'fx-canvas';
        document.body.prepend(canvas);
        const ctx = canvas.getContext('2d');
        let w, h, dpr, maxDist, nodes = [];

        function size() {
            dpr = Math.min(window.devicePixelRatio || 1, 2);
            w = canvas.width = innerWidth * dpr;
            h = canvas.height = innerHeight * dpr;
            canvas.style.width = innerWidth + 'px';
            canvas.style.height = innerHeight + 'px';
            maxDist = 140 * dpr;
            const count = Math.min(Math.round(innerWidth * innerHeight / 26000), 60);
            nodes = [];
            for (let i = 0; i < count; i++) {
                nodes.push({
                    x: Math.random() * w,
                    y: Math.random() * h,
                    vx: (Math.random() - 0.5) * 0.10 * dpr,
                    vy: (Math.random() - 0.5) * 0.10 * dpr
                });
            }
        }
        size();
        addEventListener('resize', size);

        let running = !reduce, raf;

        function frame() {
            ctx.clearRect(0, 0, w, h);
            for (const n of nodes) {
                n.x += n.vx; n.y += n.vy;
                if (n.x < 0 || n.x > w) n.vx *= -1;
                if (n.y < 0 || n.y > h) n.vy *= -1;
            }
            for (let i = 0; i < nodes.length; i++) {
                for (let j = i + 1; j < nodes.length; j++) {
                    const a = nodes[i], b = nodes[j];
                    const dx = a.x - b.x, dy = a.y - b.y;
                    const d = Math.hypot(dx, dy);
                    if (d < maxDist) {
                        ctx.strokeStyle = 'rgba(14,165,233,' + ((1 - d / maxDist) * 0.10).toFixed(3) + ')';
                        ctx.lineWidth = dpr * 0.6;
                        ctx.beginPath();
                        ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y);
                        ctx.stroke();
                    }
                }
            }
            ctx.fillStyle = 'rgba(14,165,233,0.32)';
            for (const n of nodes) {
                ctx.beginPath();
                ctx.arc(n.x, n.y, dpr * 1.1, 0, Math.PI * 2);
                ctx.fill();
            }
            if (running) raf = requestAnimationFrame(frame);
        }

        frame();
        if (!reduce) {
            document.addEventListener('visibilitychange', () => {
                running = !document.hidden;
                if (running) frame(); else cancelAnimationFrame(raf);
            });
        }
    }

    /* ── 2. Gentle scroll reveals ──────────────────────────── */
    function initReveals() {
        const els = [...document.querySelectorAll('.section, .diagram-frame, .compare-section, .portal-section')];
        if (!els.length) return;
        if (reduce || !('IntersectionObserver' in window)) {
            els.forEach(el => el.classList.add('reveal', 'in'));
            return;
        }
        const io = new IntersectionObserver((entries) => {
            entries.forEach(e => {
                if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
            });
        }, { threshold: 0.12, rootMargin: '0px 0px -8% 0px' });

        els.forEach(el => {
            if (el.getBoundingClientRect().top < innerHeight * 0.92) {
                el.classList.add('reveal', 'in');   // already on screen — no flash
            } else {
                el.classList.add('reveal');
                io.observe(el);
            }
        });
    }

    /* ── 3. Count-up stats ─────────────────────────────────── */
    function initCounters() {
        const els = [...document.querySelectorAll('[data-count]')];
        if (!els.length) return;

        const fmt = (v, f) => { v = Math.round(v); return f === 'comma' ? v.toLocaleString('en-US') : String(v); };
        const setFinal = el => { el.textContent = fmt(parseFloat(el.dataset.count), el.dataset.format); };

        if (reduce) { els.forEach(setFinal); return; }

        function run(el) {
            const target = parseFloat(el.dataset.count), dur = 1100, t0 = performance.now();
            (function step(now) {
                const t = Math.min((now - t0) / dur, 1);
                el.textContent = fmt(target * (1 - Math.pow(1 - t, 3)), el.dataset.format);
                if (t < 1) requestAnimationFrame(step); else setFinal(el);
            })(t0);
        }
        if (!('IntersectionObserver' in window)) { els.forEach(run); return; }
        const io = new IntersectionObserver((entries) => {
            entries.forEach(e => { if (e.isIntersecting) { run(e.target); io.unobserve(e.target); } });
        }, { threshold: 0.5 });
        els.forEach(el => { el.textContent = fmt(0, el.dataset.format); io.observe(el); });
    }

    function start() { initNetwork(); initReveals(); initCounters(); }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
    else start();
})();
