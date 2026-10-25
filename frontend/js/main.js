/* ─────────────────────────────────────────────────────────
   main.js — Comportamentos compartilhados das páginas:
   tema, navegação, revelações, contadores e as interações
   (acordeão, abas). O movimento "de vitrine" fica em motion.js
   e o suíno 3D em suino3d.js. Tudo respeita
   prefers-reduced-motion.
   ───────────────────────────────────────────────────────── */
const root = document.documentElement;
const reduceMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
const prefersReducedMotion = () => reduceMotionQuery.matches;

/* Utilitários usados também por dashboard.js e historico.js */
window.SuinoUI = {
  prefersReducedMotion,
  // Destaca um valor que acabou de mudar (indicação de estado, ~260ms)
  tick(el) {
    if (!el || typeof el.animate !== 'function') return;
    const frames = prefersReducedMotion()
      ? [{ opacity: 0.4 }, { opacity: 1 }]
      : [{ opacity: 0.35, transform: 'translateY(6px)' }, { opacity: 1, transform: 'none' }];
    el.animate(frames, { duration: 260, easing: 'cubic-bezier(0.23, 1, 0.32, 1)' });
  },
};

/* ── ENTRADA ──
   Marca a página como pronta e lembra (na sessão) que a abertura já foi
   exibida: o pré-carregamento e a coreografia do topo (motion.js) rodam
   só na primeira visita; nas seguintes a página aparece direto. */
requestAnimationFrame(() => {
  root.classList.add('is-ready');
  try { sessionStorage.setItem('st-intro', '1'); } catch (e) { /* modo privado */ }
});

/* ── TEMA CLARO / ESCURO ──
   Claro é o padrão. A escolha fica salva e o <head> aplica o tema antes
   de pintar. A troca é um crossfade único (View Transition, 260ms). */
(function () {
  const botao = document.getElementById('theme-toggle');
  const meta = document.querySelector('meta[name="theme-color"]');
  const escuroAtivo = () => root.dataset.theme === 'dark';
  const sincronizarBotao = () => botao?.setAttribute('aria-pressed', String(escuroAtivo()));

  function aplicar(escuro) {
    if (escuro) root.dataset.theme = 'dark';
    else delete root.dataset.theme;
    if (meta) meta.content = escuro ? '#151a0c' : '#f4ede6';
    try { localStorage.setItem('st-tema', escuro ? 'escuro' : 'claro'); } catch (e) { /* modo privado */ }
    sincronizarBotao();
  }

  sincronizarBotao();
  botao?.addEventListener('click', () => {
    const escuro = !escuroAtivo();
    root.classList.add('theme-switching');
    const liberar = () => requestAnimationFrame(() => requestAnimationFrame(() => root.classList.remove('theme-switching')));
    if (typeof document.startViewTransition === 'function' && !prefersReducedMotion()) {
      document.startViewTransition(() => aplicar(escuro)).finished.finally(liberar);
    } else {
      aplicar(escuro);
      liberar();
    }
  });
})();

/* ── NAVBAR: borda ao rolar (um listener, um rAF) ── */
(function () {
  const navbar = document.getElementById('navbar');
  if (!navbar) return;
  let agendado = false;
  const atualizar = () => { agendado = false; navbar.classList.toggle('scrolled', window.scrollY > 8); };
  window.addEventListener('scroll', () => {
    if (!agendado) { agendado = true; requestAnimationFrame(atualizar); }
  }, { passive: true });
  atualizar();
})();

/* ── MENU MOBILE ── */
(function () {
  const botao = document.querySelector('.nav-toggle');
  const menu = document.getElementById('nav-menu');
  if (!botao || !menu) return;

  function definirAberto(aberto, devolverFoco) {
    menu.classList.toggle('open', aberto);
    botao.setAttribute('aria-expanded', String(aberto));
    botao.setAttribute('aria-label', aberto ? 'Fechar menu' : 'Abrir menu');
    if (!aberto && devolverFoco) botao.focus();
  }

  botao.addEventListener('click', () => definirAberto(!menu.classList.contains('open')));
  menu.addEventListener('click', (e) => { if (e.target.closest('a')) definirAberto(false); });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && menu.classList.contains('open')) definirAberto(false, true);
  });
  document.addEventListener('click', (e) => {
    if (menu.classList.contains('open') && !menu.contains(e.target) && !botao.contains(e.target)) definirAberto(false);
  });
  window.matchMedia('(min-width: 1025px)').addEventListener('change', (e) => { if (e.matches) definirAberto(false); });
})();

/* ── REVELAÇÕES NO SCROLL (uma vez por elemento) ── */
(function () {
  const alvos = document.querySelectorAll('.reveal, .phases');
  if (!('IntersectionObserver' in window)) {
    alvos.forEach((el) => el.classList.add('in-view'));
    return;
  }
  // threshold 0 + margem: funciona para elementos de qualquer altura
  // (um limiar percentual nunca dispara em blocos mais altos que a tela)
  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add('in-view');
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0, rootMargin: '0px 0px -12% 0px' });
  alvos.forEach((el) => observer.observe(el));
})();

/* ── ARQUITETURA: os pacotes só se movem quando o diagrama está visível ── */
(function () {
  const arch = document.getElementById('arch-diagram');
  if (!arch || !('IntersectionObserver' in window)) return;
  let visivel = false;
  const sincronizar = () => arch.classList.toggle('is-playing', visivel && !document.hidden && !prefersReducedMotion());
  new IntersectionObserver(([entry]) => { visivel = entry.isIntersecting; sincronizar(); }, { threshold: 0.2 }).observe(arch);
  document.addEventListener('visibilitychange', sincronizar);
  reduceMotionQuery.addEventListener('change', sincronizar);
})();

/* ── CONTADORES ── */
(function () {
  const contadores = document.querySelectorAll('.counter');
  if (!contadores.length || prefersReducedMotion() || !('IntersectionObserver' in window)) return;

  function animar(el) {
    const alvo = parseInt(el.dataset.target, 10);
    const inicio = performance.now();
    const passo = (agora) => {
      const t = Math.min((agora - inicio) / 1200, 1);
      el.textContent = Math.round((1 - Math.pow(1 - t, 3)) * alvo);
      if (t < 1) requestAnimationFrame(passo);
    };
    requestAnimationFrame(passo);
  }

  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) { animar(entry.target); observer.unobserve(entry.target); }
    });
  }, { threshold: 0.5 });
  contadores.forEach((el) => { el.textContent = '0'; observer.observe(el); });
})();

/* ── LINK ATIVO NA NAVEGAÇÃO ── */
(function () {
  const secoes = document.querySelectorAll('section[id]');
  const links = document.querySelectorAll('.nav-link[href^="#"]');
  if (!secoes.length || !links.length || !('IntersectionObserver' in window)) return;
  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      links.forEach((link) => {
        const ativo = link.getAttribute('href') === '#' + entry.target.id;
        link.classList.toggle('active', ativo);
        if (ativo) link.setAttribute('aria-current', 'true');
        else link.removeAttribute('aria-current');
      });
    });
  }, { rootMargin: '-45% 0px -50% 0px' });
  secoes.forEach((s) => observer.observe(s));
})();

/* ── ACORDEÃO (um item aberto por vez) ── */
document.querySelectorAll('[data-accordion]').forEach((acc) => {
  acc.addEventListener('click', (e) => {
    const botao = e.target.closest('.acc-trigger');
    if (!botao) return;
    const item = botao.closest('.acc-item');
    const abrir = !item.classList.contains('open');
    acc.querySelectorAll('.acc-item.open').forEach((outro) => {
      if (outro !== item) {
        outro.classList.remove('open');
        outro.querySelector('.acc-trigger').setAttribute('aria-expanded', 'false');
      }
    });
    item.classList.toggle('open', abrir);
    botao.setAttribute('aria-expanded', String(abrir));
  });
});

/* ── ABAS (padrão ARIA, setas do teclado) ──
   O indicador é uma barra só, recortada com clip-path até a aba ativa. */
document.querySelectorAll('[data-tabs]').forEach((caixa) => {
  const lista = caixa.querySelector('[role="tablist"]');
  const abas = [...caixa.querySelectorAll('[role="tab"]')];
  const indicador = caixa.querySelector('.tab-indicator');

  function posicionar(aba) {
    if (!indicador) return;
    const largura = lista.scrollWidth;
    indicador.style.width = largura + 'px';
    const esquerda = aba.offsetLeft;
    const direita = largura - (esquerda + aba.offsetWidth);
    indicador.style.clipPath = `inset(0 ${direita}px 0 ${esquerda}px)`;
  }

  function selecionar(aba, focar) {
    abas.forEach((a) => {
      const ativa = a === aba;
      a.setAttribute('aria-selected', String(ativa));
      a.tabIndex = ativa ? 0 : -1;
      document.getElementById(a.getAttribute('aria-controls')).hidden = !ativa;
    });
    posicionar(aba);
    if (focar) aba.focus();
    if (lista.scrollWidth > lista.clientWidth) {
      aba.scrollIntoView({ block: 'nearest', inline: 'center', behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
    }
  }

  lista.addEventListener('click', (e) => {
    const aba = e.target.closest('[role="tab"]');
    if (aba) selecionar(aba);
  });
  lista.addEventListener('keydown', (e) => {
    const i = abas.indexOf(document.activeElement);
    if (i < 0) return;
    const destino = { ArrowRight: i + 1, ArrowLeft: i - 1, Home: 0, End: abas.length - 1 }[e.key];
    if (destino === undefined) return;
    e.preventDefault();
    selecionar(abas[(destino + abas.length) % abas.length], true);
  });

  // Posição inicial sem animação
  const inicial = abas.find((a) => a.getAttribute('aria-selected') === 'true') || abas[0];
  if (indicador) {
    indicador.style.transition = 'none';
    posicionar(inicial);
    indicador.getBoundingClientRect();
    indicador.style.transition = '';
  }
  window.addEventListener('resize', () => {
    posicionar(abas.find((a) => a.getAttribute('aria-selected') === 'true') || abas[0]);
  });
  // As fontes mudam a largura das abas quando terminam de carregar
  document.fonts?.ready.then(() => posicionar(abas.find((a) => a.getAttribute('aria-selected') === 'true') || abas[0]));
});
