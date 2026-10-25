/* ─────────────────────────────────────────────────────────
   motion.js — Animações de apresentação do site:
   pré-carregamento, rolagem suave (Lenis), letras que surgem em
   ordem aleatória (GSAP SplitText), rastro de pixels no topo,
   palavras que acendem ao rolar e fotos com parallax/recorte.

   Tudo é opcional: se o GSAP ou o Lenis não carregarem (sem
   internet), o site continua funcionando com as revelações
   simples do main.js. Respeita prefers-reduced-motion.
   ───────────────────────────────────────────────────────── */
(function () {
  const root = document.documentElement;
  const consultaReduzir = window.matchMedia('(prefers-reduced-motion: reduce)');
  const reduzir = () => consultaReduzir.matches;
  const ponteiroFino = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  const temGsap = typeof window.gsap !== 'undefined' && typeof window.ScrollTrigger !== 'undefined';
  const temSplit = temGsap && typeof window.SplitText !== 'undefined';
  const primeiraVisita = !root.classList.contains('intro-done');
  const navbar = document.getElementById('navbar');
  const alturaNav = () => (navbar ? navbar.offsetHeight : 72);

  if (temGsap) gsap.registerPlugin(ScrollTrigger, ...(temSplit ? [SplitText] : []));

  /* ── ROLAGEM SUAVE (Lenis) ── */
  let lenis = null;
  if (window.Lenis && !reduzir()) {
    lenis = new Lenis({ lerp: 0.1, smoothWheel: true, wheelMultiplier: 1 });
    window.lenis = lenis;
    if (temGsap) {
      lenis.on('scroll', ScrollTrigger.update);
      gsap.ticker.add((t) => lenis.raf(t * 1000));
      gsap.ticker.lagSmoothing(0);
    } else {
      const quadro = (t) => { lenis.raf(t); requestAnimationFrame(quadro); };
      requestAnimationFrame(quadro);
    }
    // Âncoras internas também deslizam (descontando a barra de navegação)
    document.addEventListener('click', (e) => {
      const link = e.target.closest('a[href^="#"]');
      if (!link || link.classList.contains('skip-link')) return;
      const id = link.getAttribute('href');
      if (id.length < 2) return;
      const alvo = document.querySelector(id);
      if (!alvo) return;
      e.preventDefault();
      lenis.scrollTo(alvo, { offset: -alturaNav() + 1, duration: 1.2 });
      history.pushState(null, '', id);
    });
  }

  /* ── PRÉ-CARREGAMENTO (1ª visita da sessão) ──
     Avança sozinho, espera o 3D e as imagens, e nunca segura mais de 6 s. */
  const pre = document.getElementById('preloader');
  function preCarregar() {
    if (!pre) return Promise.resolve();
    if (!primeiraVisita || reduzir()) { pre.remove(); return Promise.resolve(); }
    lenis?.stop();
    const contador = document.getElementById('preloader-count');
    const barra = document.getElementById('preloader-bar');
    let pronto3d = !document.getElementById('stage');
    let carregado = document.readyState === 'complete';
    window.addEventListener('suino3d:pronto', () => { pronto3d = true; }, { once: true });
    window.addEventListener('load', () => { carregado = true; }, { once: true });
    const inicio = performance.now();
    let atual = 0, anterior = inicio;
    return new Promise((resolver) => {
      function passo(agora) {
        const t = agora - inicio;
        const dt = Math.min(agora - anterior, 100) / 1000;
        anterior = agora;
        let alvo = Math.min(68, t / 14) + (pronto3d ? 16 : 0) + (carregado ? 16 : 0);
        if (t > 6000) alvo = 100;
        atual += (alvo - atual) * (1 - Math.exp(-dt * 9)); // independe da taxa de quadros
        if (alvo === 100 && 100 - atual < 0.6) atual = 100;
        contador.textContent = Math.round(atual);
        barra.style.transform = `scaleX(${(atual / 100).toFixed(3)})`;
        if (atual > 99.4 && t > 900) {
          contador.textContent = '100';
          pre.classList.add('is-leaving');
          setTimeout(() => { pre.remove(); lenis?.start(); resolver(); }, 650);
          return;
        }
        requestAnimationFrame(passo);
      }
      requestAnimationFrame(passo);
    });
  }

  /* ── SUÍNO 3D: se não carregar em 6 s (sem internet/WebGL), mostra a foto ── */
  const palco = document.getElementById('stage');
  if (palco) setTimeout(() => { if (!palco.classList.contains('is-3d')) palco.classList.add('is-fallback'); }, 6000);

  // O SplitText precisa das fontes finais para medir as letras
  const fontes = document.fonts ? document.fonts.ready : Promise.resolve();

  /* ── ENTRADA DO TOPO ── */
  const tituloHero = document.querySelector('[data-split="hero"]');
  Promise.all([preCarregar(), fontes]).then(() => {
    root.classList.add('hero-in');
    if (tituloHero && temSplit && primeiraVisita && !reduzir()) {
      const s = SplitText.create(tituloHero, { type: 'words, chars', charsClass: 'ch', wordsClass: 'wd' });
      gsap.from(s.chars, { autoAlpha: 0, yPercent: 30, duration: 0.5, ease: 'power2.out', stagger: { each: 0.025, from: 'random' } });
    }
  });

  /* ── NAVEGAÇÃO: muda de tom sobre seções escuras ── */
  (function () {
    if (!navbar) return;
    const escuras = [...document.querySelectorAll('[data-nav="dark"]')];
    let agendado = false;
    function verificar() {
      agendado = false;
      const y = alturaNav() / 2;
      const sobre = escuras.some((el) => { const r = el.getBoundingClientRect(); return r.top <= y && r.bottom >= y; });
      navbar.classList.toggle('on-dark', sobre);
    }
    const agendar = () => { if (!agendado) { agendado = true; requestAnimationFrame(verificar); } };
    window.addEventListener('scroll', agendar, { passive: true });
    window.addEventListener('resize', agendar);
    lenis?.on('scroll', agendar);
    verificar();
  })();

  /* ── RASTRO DE PIXELS NO TOPO (cores do campo, como na referência) ── */
  (function () {
    const hero = document.querySelector('.hero');
    const tela = document.getElementById('hero-trail');
    if (!hero || !tela || !ponteiroFino) return;
    const ctx = tela.getContext('2d');
    const PARADAS = [[0, [212, 222, 114]], [0.43, [136, 158, 57]], [0.97, [49, 61, 26]]];
    const ENTRA = 100, FICA = 300, SAI = 300;
    const acesas = new Map();
    let cel = 48, colunas = 0, linhas = 0, raf = 0;

    function corEm(p) {
      for (let i = 0; i < PARADAS.length - 1; i++) {
        const [p0, c0] = PARADAS[i], [p1, c1] = PARADAS[i + 1];
        if (p <= p1 || i === PARADAS.length - 2) {
          const t = Math.min(Math.max((p - p0) / (p1 - p0), 0), 1);
          return `rgb(${c0.map((c, k) => Math.round(c + (c1[k] - c) * t)).join(',')})`;
        }
      }
      return 'rgb(49,61,26)';
    }
    function medir() {
      const dpr = Math.min(window.devicePixelRatio, 2);
      const w = hero.offsetWidth, h = hero.offsetHeight;
      tela.width = Math.round(w * dpr); tela.height = Math.round(h * dpr);
      tela.style.width = w + 'px'; tela.style.height = h + 'px';
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      cel = Math.max(40, w * 0.05);
      colunas = Math.ceil(w / cel); linhas = Math.ceil(h / cel);
    }
    function desenhar(agora) {
      ctx.clearRect(0, 0, tela.width, tela.height);
      acesas.forEach((t0, idx) => {
        const idade = agora - t0;
        if (idade > ENTRA + FICA + SAI) { acesas.delete(idx); return; }
        const a = idade < ENTRA ? idade / ENTRA : idade < ENTRA + FICA ? 1 : 1 - (idade - ENTRA - FICA) / SAI;
        const c = idx % colunas, l = Math.floor(idx / colunas);
        ctx.globalAlpha = a * 0.42;
        ctx.fillStyle = corEm(c / colunas);
        ctx.fillRect(c * cel + 0.5, l * cel + 0.5, cel - 1, cel - 1);
      });
      ctx.globalAlpha = 1;
      raf = acesas.size ? requestAnimationFrame(desenhar) : 0;
    }
    hero.addEventListener('pointermove', (e) => {
      if (reduzir() || e.pointerType !== 'mouse') return;
      if (e.target.closest('.tele-card, .stage-controls, .btn, .live-card')) return;
      const r = hero.getBoundingClientRect();
      const c = Math.floor((e.clientX - r.left) / cel), l = Math.floor((e.clientY - r.top) / cel);
      if (c < 0 || l < 0 || c >= colunas || l >= linhas) return;
      acesas.set(l * colunas + c, performance.now());
      if (!raf) raf = requestAnimationFrame(desenhar);
    }, { passive: true });
    medir();
    new ResizeObserver(medir).observe(hero);
  })();

  if (!temGsap) return;

  /* ── TÍTULOS: letras surgem em ordem aleatória ao entrar na tela ── */
  if (temSplit && !reduzir()) fontes.then(() => {
    document.querySelectorAll('[data-split]:not([data-split="hero"])').forEach((el) => {
      const s = SplitText.create(el, { type: 'words, chars', charsClass: 'ch', wordsClass: 'wd' });
      gsap.set(s.chars, { autoAlpha: 0 });
      ScrollTrigger.create({
        trigger: el, start: 'top 88%', once: true,
        onEnter: () => gsap.to(s.chars, { autoAlpha: 1, duration: 0.4, ease: 'power2.out', stagger: { each: 0.018, from: 'random' } }),
      });
    });
  });

  /* ── MANIFESTO: cada palavra acende conforme a rolagem ── */
  if (temSplit && !reduzir()) fontes.then(() => document.querySelectorAll('[data-scrub-words]').forEach((el) => {
    const s = SplitText.create(el, { type: 'words', wordsClass: 'wd' });
    gsap.fromTo(s.words, { opacity: 0.16 }, {
      opacity: 1, ease: 'none', stagger: 0.1,
      scrollTrigger: { trigger: el, start: 'top 82%', end: 'bottom 50%', scrub: true },
    });
  }));

  if (reduzir()) return;

  /* ── FOTOS: recorte que abre + parallax por dentro da moldura ── */
  document.querySelectorAll('[data-clip]').forEach((el) => {
    gsap.fromTo(el, { clipPath: 'inset(10% 7% 10% 7% round 28px)' }, {
      clipPath: 'inset(0% 0% 0% 0% round 28px)', ease: 'none',
      scrollTrigger: { trigger: el, start: 'top 95%', end: 'top 40%', scrub: true },
    });
  });
  document.querySelectorAll('[data-parallax]').forEach((el) => {
    const f = parseFloat(el.dataset.parallax) || 0.1;
    gsap.fromTo(el, { yPercent: -f * 100 }, {
      yPercent: f * 100, ease: 'none',
      scrollTrigger: { trigger: el.parentElement, start: 'top bottom', end: 'bottom top', scrub: true },
    });
  });

  /* ── FAIXA DO CAMPO: a foto "assenta" (zoom out) e abre até as bordas ── */
  document.querySelectorAll('[data-band]').forEach((el) => {
    const img = el.querySelector('img');
    gsap.timeline({ scrollTrigger: { trigger: el.parentElement, start: 'top bottom', end: 'top top', scrub: true } })
      .fromTo(el, { clipPath: 'inset(8% 6% 0% 6% round 32px)' }, { clipPath: 'inset(0% 0% 0% 0% round 0px)', ease: 'none' }, 0)
      .fromTo(img, { scale: 1.28 }, { scale: 1, ease: 'none' }, 0);
  });

  /* ── TOPO: o texto sobe e esmaece enquanto o suíno gira (ver suino3d.js) ── */
  const topo = document.querySelector('.hero-top');
  if (topo) {
    gsap.to(topo, {
      yPercent: -35, opacity: 0.15, ease: 'none',
      scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: true },
    });
  }

  window.addEventListener('load', () => ScrollTrigger.refresh());
})();
