/* ─────────────────────────────────────────────────────────
   suino3d.js — Suíno 3D realista no topo da página, com a
   telemetria (temperatura, peso, respiração…) flutuando em
   volta e ligada ao ponto exato do corpo onde fica o sensor.

   • Corpo gerado por código (js/suino3d/anatomia.js) — não
     depende de arquivo de modelo externo.
   • Interações: arrastar gira a câmera, a cabeça acompanha o
     ponteiro, passar o mouse no animal faz o rabo abanar,
     clicar num sensor aproxima a câmera e abre os detalhes.
   • As leituras de sensores biométricos são DEMONSTRATIVAS
     (o backend só registra entradas/saídas das baias).
   • Para de renderizar quando o topo sai da tela ou a aba fica
     oculta; respeita prefers-reduced-motion.
   ───────────────────────────────────────────────────────── */
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import {
  gerarGeometriaCorpo, normalCorpo, pontoNaPele,
  PIVO_CABECA, CASCOS, CHAO,
} from './suino3d/anatomia.js';

const palco = document.getElementById('stage');
const alvoGL = document.getElementById('stage-gl');

function avisarPronto() {
  window.dispatchEvent(new CustomEvent('suino3d:pronto'));
}

async function iniciar() {
  const ui = window.SuinoUI || { tick() {}, prefersReducedMotion: () => false };
  const movimentoReduzido = () => ui.prefersReducedMotion();
  const ponteiroFino = window.matchMedia('(hover: hover) and (pointer: fine)').matches;

  /* ══════════ RENDERIZADOR, CENA, CÂMERA ══════════ */
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.95;
  alvoGL.appendChild(renderer.domElement);

  const cena = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  cena.environment = pmrem.fromScene(new RoomEnvironment(renderer), 0.04).texture;
  pmrem.dispose();

  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 60);
  const ESCALA = 1.25;                       // 1 unidade local ≈ 0,8 m
  const centroOlhar = new THREE.Vector3(0.05, 0.62, 0);
  const direcaoInicial = new THREE.Vector3(0.66, 0.2, 0.72).normalize();
  camera.position.copy(centroOlhar).addScaledVector(direcaoInicial, 6);

  const controles = new OrbitControls(camera, renderer.domElement);
  controles.enableDamping = true;
  controles.dampingFactor = 0.06;
  controles.enableZoom = false;              // a roda do mouse continua rolando a página
  controles.enablePan = false;
  controles.minPolarAngle = 0.95;
  controles.maxPolarAngle = Math.PI / 2 - 0.02;
  controles.rotateSpeed = 0.55;
  controles.target.copy(centroOlhar);
  controles.enabled = ponteiroFino;          // no toque, arrastar rola a página
  renderer.domElement.style.touchAction = ponteiroFino ? 'none' : 'pan-y';

  /* ══════════ LUZ DE ESTÚDIO + CONTRALUZ "CAMPO" ══════════ */
  cena.add(new THREE.HemisphereLight(0xffeedd, 0x3a4520, 0.4));
  const luzPrincipal = new THREE.DirectionalLight(0xffe9d6, 1.9);
  luzPrincipal.position.set(3.2, 5.2, 3.4);
  luzPrincipal.castShadow = true;
  luzPrincipal.shadow.mapSize.set(1024, 1024);
  luzPrincipal.shadow.camera.left = -2.4; luzPrincipal.shadow.camera.right = 2.4;
  luzPrincipal.shadow.camera.top = 2.4; luzPrincipal.shadow.camera.bottom = -2.4;
  luzPrincipal.shadow.camera.near = 1; luzPrincipal.shadow.camera.far = 14;
  luzPrincipal.shadow.bias = -0.0004;
  luzPrincipal.shadow.normalBias = 0.02;
  cena.add(luzPrincipal);
  const contraluz = new THREE.DirectionalLight(0xe4ef8c, 2.0); // brilho lima no contorno
  contraluz.position.set(-3.5, 2.6, -3.2);
  cena.add(contraluz);
  const preenchimento = new THREE.DirectionalLight(0xc9dcff, 0.45);
  preenchimento.position.set(-4, 1.5, 3);
  cena.add(preenchimento);

  /* ══════════ CHÃO: sombra, sombra de contato, anéis de leitura ══════════ */
  const chao = new THREE.Mesh(new THREE.PlaneGeometry(14, 14), new THREE.ShadowMaterial({ opacity: 0.32 }));
  chao.rotation.x = -Math.PI / 2;
  chao.receiveShadow = true;
  cena.add(chao);

  const sombraContato = new THREE.Mesh(
    new THREE.PlaneGeometry(3.2, 1.7),
    new THREE.MeshBasicMaterial({ map: texturaRadial('rgba(12,16,4,0.85)', 'rgba(12,16,4,0)'), transparent: true, depthWrite: false, opacity: 0.6 }),
  );
  sombraContato.rotation.x = -Math.PI / 2;
  sombraContato.position.set(0.15, 0.004, 0);
  cena.add(sombraContato);

  const grade = new THREE.PolarGridHelper(2.7, 16, 6, 96, 0x9fb04c, 0x55622a);
  grade.material.transparent = true;
  grade.material.opacity = 0.28;
  grade.material.depthWrite = false;
  grade.position.y = 0.002;
  cena.add(grade);

  const materialAnel = new THREE.MeshBasicMaterial({ color: 0xd4de72, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide });
  const anelVarredura = new THREE.Mesh(new THREE.RingGeometry(0.985, 1, 128), materialAnel);
  anelVarredura.rotation.x = -Math.PI / 2;
  anelVarredura.position.y = 0.006;
  cena.add(anelVarredura);

  // Poeira no ar, iluminada pelo contraluz (bem sutil)
  const poeira = criarPoeira();
  cena.add(poeira);

  /* ══════════ O SUÍNO ══════════ */
  const suino = new THREE.Group();         // gira (balanço, rolagem, foco)
  suino.position.y = -CHAO * ESCALA;
  suino.scale.setScalar(ESCALA);
  cena.add(suino);

  const uniformes = {
    uCabeca: { value: new THREE.Vector2() },
    uResp: { value: 0 },
    uPivo: { value: PIVO_CABECA.clone() },
    uFareja: { value: 0 },
    uRelevo: { value: 0.32 },
  };

  const corpo = new THREE.Mesh(gerarGeometriaCorpo(120), materialPele(uniformes));
  corpo.castShadow = true;
  corpo.receiveShadow = true;
  corpo.customDepthMaterial = materialProfundidade(uniformes);
  suino.add(corpo);

  // Tudo que acompanha a cabeça gira em torno do pescoço (mesma rotação do shader)
  const cabeca = new THREE.Group();
  cabeca.position.copy(PIVO_CABECA);
  cabeca.rotation.order = 'YZX';
  suino.add(cabeca);
  const naCabeca = (obj, p) => { obj.position.copy(p).sub(PIVO_CABECA); cabeca.add(obj); return obj; };

  const pele = new THREE.Color().setRGB(0.91, 0.665, 0.585, THREE.SRGBColorSpace);

  // Orelhas eretas (Large White), levemente em concha e translúcidas
  const texOrelha = texturaOrelha();
  const matOrelha = new THREE.MeshPhysicalMaterial({
    map: texOrelha, roughness: 0.55, sheen: 0.8, sheenRoughness: 0.5, sheenColor: new THREE.Color('#ffd3c2'),
    side: THREE.DoubleSide, emissive: new THREE.Color('#6a2418'), emissiveIntensity: 0.22, envMapIntensity: 0.5,
  });
  const geoOrelha = geometriaOrelha(0.225, 0.2);
  const orelhas = [1, -1].map((lado) => {
    const base = new THREE.Object3D();
    const comp = new THREE.Vector3(0.3, 0.88, 0.36 * lado).normalize();
    const frente = new THREE.Vector3(1, 0.05, 0.55 * lado);
    frente.addScaledVector(comp, -frente.dot(comp)).normalize();
    const lateral = new THREE.Vector3().crossVectors(comp, frente);
    base.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(lateral, comp, frente));
    const malha = new THREE.Mesh(geoOrelha, matOrelha);
    malha.castShadow = true;
    base.add(malha);
    naCabeca(base, new THREE.Vector3(0.73, 0.195, 0.098 * lado));
    return { base, malha, lado, piscada: 0 };
  });

  // Brinco de identificação (RFID) na orelha voltada para a câmera
  const brinco = criarBrinco();
  brinco.position.set(0.034, 0.075, -0.0065);
  orelhas[0].malha.add(brinco);

  // Olhos: pequenos, escuros e úmidos, afundados na órbita
  const matOlho = new THREE.MeshPhysicalMaterial({ color: 0x140d0a, roughness: 0.25, clearcoat: 1, clearcoatRoughness: 0.12, envMapIntensity: 0.35 });
  const olhos = [1, -1].map((lado) => {
    const p = pontoNaPele(new THREE.Vector3(0.893, 0.128, 0.5 * lado), new THREE.Vector3(0, 0, -lado));
    const n = normalCorpo(p);
    const olho = new THREE.Mesh(new THREE.SphereGeometry(0.019, 24, 16), matOlho);
    olho.scale.set(1, 0.8, 1);
    naCabeca(olho, p.clone().addScaledVector(n, -0.011));
    return olho;
  });

  // Narinas no disco do focinho
  const matNarina = new THREE.MeshStandardMaterial({ color: 0x4a2620, roughness: 0.4 });
  const narinas = new THREE.Group();
  [1, -1].forEach((lado) => {
    const p = pontoNaPele(new THREE.Vector3(1.3, 0.005, 0.03 * lado), new THREE.Vector3(-1, 0, 0));
    const narina = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 12), matNarina);
    narina.scale.set(0.006, 0.017, 0.011);
    narina.position.copy(p).sub(PIVO_CABECA).add(new THREE.Vector3(-0.002, 0, 0));
    narina.rotation.x = 0.25 * lado;
    narinas.add(narina);
  });
  cabeca.add(narinas);

  // Cascos fendidos (duas unhas por pata)
  const matCasco = new THREE.MeshPhysicalMaterial({ color: 0x3e2d25, roughness: 0.42, clearcoat: 0.35, clearcoatRoughness: 0.4 });
  const geoUnha = new THREE.CylinderGeometry(0.04, 0.046, 0.066, 18);
  CASCOS.forEach((c) => {
    [-1, 1].forEach((lado) => {
      const unha = new THREE.Mesh(geoUnha, matCasco);
      unha.scale.set(1, 1, 0.56);
      unha.position.set(c.x + 0.006, CHAO + 0.033, c.z + lado * 0.018);
      unha.castShadow = true;
      suino.add(unha);
    });
  });

  // Rabo em espiral, afinando na ponta
  const rabo = criarRabo(pele);
  suino.add(rabo);

  /* ══════════ SENSORES (pontos no corpo) + CARTÕES ══════════ */
  const camadaHud = document.getElementById('stage-hud');
  const svgLinhas = document.getElementById('stage-lines');
  // pele: [origem fora do corpo, direção para dentro]. tela: posição do cartão
  // (fração do palco) em cada arranjo — amplo (desktop, palco = topo inteiro),
  // empilhado (tablet) e estreito (celular, só 4 cartões).
  const SENSORES = {
    temp:      { pele: [[0.86, 0.6, 0.02], [0, -1, 0]], cabeca: true, tela: { amplo: [0.86, 0.53], empilhado: [0.79, 0.17], estreito: [0.76, 0.1] } },
    brinco:    { objeto: brinco, normal: [0.3, 0.2, 1], tela: { amplo: [0.84, 0.69], empilhado: [0.87, 0.5], estreito: [0.24, 0.92] } },
    resp:      { pele: [[0.26, -0.04, 0.7], [0, 0, -1]], tela: { amplo: [0.74, 0.85], empilhado: [0.78, 0.85], estreito: [0.76, 0.92] } },
    peso:      { pele: [[-0.12, 0.8, 0.02], [0, -1, 0]], tela: { amplo: [0.27, 0.5], empilhado: [0.21, 0.17], estreito: [0.24, 0.1] } },
    gpd:       { pele: [[-0.5, 0.06, 0.7], [0, 0, -1]], tela: { amplo: [0.12, 0.64], empilhado: [0.13, 0.5], estreito: [0.5, 0.5] } },
    atividade: { pele: [[-0.47, -0.34, 0.7], [0, 0, -1]], tela: { amplo: [0.21, 0.79], empilhado: [0.22, 0.85], estreito: [0.5, 0.5] } },
  };
  // Onde o animal fica no palco e quanto do mundo precisa caber (meia altura/largura)
  const ARRANJOS = {
    amplo:     { centro: [0.5, 0.67], meiaA: 1.6, meiaL: 2.75 },
    empilhado: { centro: [0.5, 0.53], meiaA: 1.0, meiaL: 1.7 },
    estreito:  { centro: [0.5, 0.52], meiaA: 0.95, meiaL: 1.42 },
  };
  let arranjo = ARRANJOS.amplo, nomeArranjo = 'amplo';

  const sensores = [...document.querySelectorAll('#tele .tele-card')].map((el) => {
    const id = el.dataset.sensor;
    const def = SENSORES[id];
    if (!def) return null;
    let local, normal;
    if (def.objeto) {
      local = null; // calculado a cada quadro (o brinco balança com a orelha)
      normal = new THREE.Vector3(...def.normal).normalize();
    } else {
      local = pontoNaPele(new THREE.Vector3(...def.pele[0]), new THREE.Vector3(...def.pele[1]));
      normal = normalCorpo(local);
    }
    const ponto = document.createElement('span');
    ponto.className = 'tele-hot';
    ponto.dataset.sensor = id;
    camadaHud.appendChild(ponto);
    const linha = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    linha.dataset.sensor = id;
    svgLinhas.appendChild(linha);
    return {
      id, el, def, local, normal, ponto, linha,
      botao: el.querySelector('.tele-btn'),
      mundo: new THREE.Vector3(),
    };
  }).filter(Boolean);

  palco.classList.remove('is-fallback');
  palco.classList.add('is-3d');

  /* ══════════ ESTADO + INTERAÇÃO ══════════ */
  const estado = {
    respirando: true,
    girando: !movimentoReduzido(),
    sensoresVisiveis: true,
    focado: null,
    rpm: 32,
    sobreAnimal: false,
    abano: 0,          // energia do rabo (sobe quando você "faz carinho")
    pulo: 0,           // pulinho ao clicar no animal
    ponteiro: null,    // {x,y} normalizado no palco
    visivel: true,
  };

  const cabecaAtual = new THREE.Vector2(), cabecaAlvo = new THREE.Vector2();
  let guinadaBase = 0, guinadaAtual = 0, guinadaFoco = null;
  let distanciaBase = 6, distanciaAtual = 6;
  const alvoAtual = centroOlhar.clone(), alvoDesejado = centroOlhar.clone();
  const raycaster = new THREE.Raycaster();
  const vetorTmp = new THREE.Vector3(), vetorTmp2 = new THREE.Vector3();
  const plano = new THREE.Plane();

  function enquadrar() {
    const r = palco.getBoundingClientRect();
    const largura = Math.max(r.width, 1), altura = Math.max(r.height, 1);
    nomeArranjo = window.innerWidth > 1024 ? 'amplo' : largura < 600 ? 'estreito' : 'empilhado';
    arranjo = ARRANJOS[nomeArranjo];
    renderer.setSize(largura, altura, false);
    camera.aspect = largura / altura;
    // Desloca a imagem para o animal ficar no ponto "centro" do palco
    camera.setViewOffset(largura, altura, -(arranjo.centro[0] - 0.5) * largura, -(arranjo.centro[1] - 0.5) * altura, largura, altura);
    camera.updateProjectionMatrix();
    const t = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    distanciaBase = Math.max(arranjo.meiaA / t, arranjo.meiaL / (t * camera.aspect));
    palco.classList.toggle('is-narrow', nomeArranjo === 'estreito');
  }
  enquadrar();
  distanciaAtual = distanciaBase;
  new ResizeObserver(enquadrar).observe(palco);

  function posPonteiro(e) {
    const r = renderer.domElement.getBoundingClientRect();
    return { x: ((e.clientX - r.left) / r.width) * 2 - 1, y: -((e.clientY - r.top) / r.height) * 2 + 1 };
  }

  palco.addEventListener('pointermove', (e) => {
    if (e.pointerType !== 'mouse' && e.pointerType !== 'pen') return;
    estado.ponteiro = posPonteiro(e);
  }, { passive: true });
  palco.addEventListener('pointerleave', () => { estado.ponteiro = null; estado.sobreAnimal = false; palco.classList.remove('is-petting'); });

  // Clique no animal: pulinho + rabo abanando (só se não foi um arrasto)
  let inicioToque = null;
  renderer.domElement.addEventListener('pointerdown', (e) => { inicioToque = { x: e.clientX, y: e.clientY }; });
  renderer.domElement.addEventListener('pointerup', (e) => {
    if (!inicioToque || Math.hypot(e.clientX - inicioToque.x, e.clientY - inicioToque.y) > 6) return;
    raycaster.setFromCamera(posPonteiro(e), camera);
    if (raycaster.intersectObject(corpo, false).length) {
      if (!movimentoReduzido()) estado.pulo = 1;
      estado.abano = 1;
    } else if (estado.focado) {
      focar(null);
    }
  });

  // Cartões: clicar abre os detalhes e aproxima a câmera do sensor
  sensores.forEach((s) => {
    s.botao.addEventListener('click', () => focar(estado.focado === s ? null : s));
    s.el.addEventListener('pointerenter', () => s.ponto.classList.add('is-hover'));
    s.el.addEventListener('pointerleave', () => s.ponto.classList.remove('is-hover'));
  });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && estado.focado) focar(null, true); });

  function focar(sensor, devolverFoco) {
    const anterior = estado.focado;
    estado.focado = sensor;
    palco.classList.toggle('has-focus', !!sensor);
    sensores.forEach((s) => {
      const ativo = s === sensor;
      s.el.classList.toggle('is-active', ativo);
      s.ponto.classList.toggle('is-active', ativo);
      s.botao.setAttribute('aria-expanded', String(ativo));
    });
    if (!sensor && devolverFoco && anterior) anterior.botao.focus();
    if (sensor) {
      // Gira o animal até o sensor ficar de frente para a câmera
      const n = sensor.normal;
      const azCam = Math.atan2(camera.position.x - controles.target.x, camera.position.z - controles.target.z);
      const azN = Math.atan2(n.x, n.z);
      let alvo = azCam - azN;
      const atual = guinadaAtual;
      while (alvo - atual > Math.PI) alvo -= Math.PI * 2;
      while (alvo - atual < -Math.PI) alvo += Math.PI * 2;
      guinadaFoco = alvo;
    } else {
      guinadaFoco = null;
    }
  }

  // Botões de controle (adaptados do protótipo: respiração, rotação, visão)
  const botoes = {
    resp: document.getElementById('btn-respiracao'),
    giro: document.getElementById('btn-rotacao'),
    sensores: document.getElementById('btn-sensores'),
    resetar: document.getElementById('btn-resetar-visao'),
  };
  const sincronizarBotao = (botao, ligado, rotulo) => {
    if (!botao) return;
    botao.setAttribute('aria-pressed', String(ligado));
    const texto = botao.querySelector('[data-estado]');
    if (texto) texto.textContent = ligado ? rotulo[0] : rotulo[1];
  };
  sincronizarBotao(botoes.resp, estado.respirando, ['ativa', 'pausada']);
  sincronizarBotao(botoes.giro, estado.girando, ['ativo', 'pausado']);
  sincronizarBotao(botoes.sensores, estado.sensoresVisiveis, ['visíveis', 'ocultos']);
  botoes.resp?.addEventListener('click', () => { estado.respirando = !estado.respirando; sincronizarBotao(botoes.resp, estado.respirando, ['ativa', 'pausada']); });
  botoes.giro?.addEventListener('click', () => { estado.girando = !estado.girando; sincronizarBotao(botoes.giro, estado.girando, ['ativo', 'pausado']); });
  botoes.sensores?.addEventListener('click', () => {
    estado.sensoresVisiveis = !estado.sensoresVisiveis;
    palco.classList.toggle('sensors-off', !estado.sensoresVisiveis);
    if (!estado.sensoresVisiveis) focar(null);
    sincronizarBotao(botoes.sensores, estado.sensoresVisiveis, ['visíveis', 'ocultos']);
  });
  botoes.resetar?.addEventListener('click', () => {
    focar(null);
    guinadaBase = 0;
    camera.position.copy(controles.target).addScaledVector(direcaoInicial, distanciaAtual);
  });

  /* ══════════ LEITURAS (demonstração) ══════════ */
  const leituras = {
    temp: { v: 38.8, min: 38.5, max: 39.5, passo: 0.06, casas: 1, hist: [] },
    resp: { v: 32, min: 24, max: 40, passo: 1.2, casas: 0, hist: [] },
    peso: { v: 112.5, min: 0, max: 999, passo: 0.02, casas: 1, hist: [], tendencia: 0.01 },
    gpd: { v: 812, min: 700, max: 950, passo: 6, casas: 0, hist: [] },
    atividade: { v: 72, min: 40, max: 95, passo: 2.5, casas: 0, hist: [] },
  };
  const formatar = (v, casas) => v.toLocaleString('pt-BR', { minimumFractionDigits: casas, maximumFractionDigits: casas });
  function semear(l) { for (let i = 0; i < 24; i++) l.hist.push(l.v + (Math.random() - 0.5) * l.passo * 3); }
  Object.values(leituras).forEach(semear);

  function atualizarLeituras(destacar) {
    sensores.forEach((s) => {
      const l = leituras[s.id];
      if (!l) return;
      if (destacar) {
        l.v += (Math.random() - 0.5) * l.passo * 2 + (l.tendencia || 0);
        const meio = (l.min + l.max) / 2;
        l.v += (meio - l.v) * 0.04 * (l.max - l.min < 900 ? 1 : 0); // puxa de volta para a faixa
        l.hist.push(l.v); if (l.hist.length > 24) l.hist.shift();
      }
      const alvo = s.el.querySelector('[data-valor]');
      const texto = formatar(l.v, l.casas);
      if (alvo && alvo.textContent !== texto) { alvo.textContent = texto; if (destacar) ui.tick(alvo); }
      const barra = s.el.querySelector('[data-barra]');
      if (barra) barra.style.transform = `scaleX(${(l.v / 100).toFixed(3)})`;
      const linhaSpark = s.el.querySelector('.tele-spark path');
      if (linhaSpark) linhaSpark.setAttribute('d', sparkline(l.hist, 120, 30));
    });
    estado.rpm = leituras.resp.v;
  }
  atualizarLeituras(false);
  setInterval(() => { if (estado.visivel && !document.hidden) atualizarLeituras(true); }, 2600);

  /* ══════════ LAÇO DE ANIMAÇÃO ══════════ */
  const relogio = new THREE.Clock();
  let tempoResp = 0, proximaPiscada = 2, piscando = 0, proximoTremor = 3;
  let quadro = 0, rodando = false, idRaf = 0;
  const heroi = palco.closest('.hero') || palco;
  const quat = new THREE.Quaternion();

  function animar() {
    idRaf = requestAnimationFrame(animar);
    const dt = Math.min(relogio.getDelta(), 0.05);
    const t = relogio.elapsedTime;
    const calmo = movimentoReduzido();
    quadro++;

    // Respiração no ritmo da leitura (rpm → Hz)
    if (estado.respirando) tempoResp += dt * (estado.rpm / 60) * Math.PI * 2;
    uniformes.uResp.value = estado.respirando ? Math.sin(tempoResp) * (calmo ? 0.4 : 1) : uniformes.uResp.value * 0.9;

    // Balanço suave (em vez de giro completo: os sensores continuam legíveis)
    if (estado.girando && !estado.focado) guinadaBase += dt * 0.16;
    const rolagem = THREE.MathUtils.clamp(-heroi.getBoundingClientRect().top / Math.max(heroi.offsetHeight, 1), 0, 1);
    const alvoGuinada = guinadaFoco ?? (Math.sin(guinadaBase) * 0.55 + rolagem * (calmo ? 0 : 1.1));
    guinadaAtual += (alvoGuinada - guinadaAtual) * (1 - Math.exp(-dt * 3.2));
    suino.rotation.y = guinadaAtual;

    // Pulinho ao ser clicado + peso trocando de pata
    estado.pulo = Math.max(estado.pulo - dt * 1.8, 0);
    const pulo = Math.sin((1 - estado.pulo) * Math.PI) * estado.pulo;
    suino.position.y = -CHAO * ESCALA + pulo * 0.12;
    suino.rotation.z = calmo ? 0 : Math.sin(t * 0.7) * 0.008 + pulo * 0.04;

    // Cabeça acompanha o ponteiro; sem ponteiro, olha em volta devagar
    if (estado.ponteiro && !estado.focado) {
      raycaster.setFromCamera(estado.ponteiro, camera);
      const cabecaMundo = suino.localToWorld(vetorTmp.set(0.86, 0.1, 0));
      plano.setFromNormalAndCoplanarPoint(camera.getWorldDirection(vetorTmp2).negate(), cabecaMundo);
      if (raycaster.ray.intersectPlane(plano, vetorTmp2)) {
        const local = suino.worldToLocal(vetorTmp2).sub(PIVO_CABECA);
        cabecaAlvo.set(
          THREE.MathUtils.clamp(Math.atan2(-local.z, Math.max(local.x, 0.15)), -0.6, 0.6),
          THREE.MathUtils.clamp(Math.atan2(local.y - 0.04, Math.hypot(local.x, local.z)), -0.3, 0.32),
        );
      }
      // "Carinho": o ponteiro está sobre o animal?
      if (quadro % 3 === 0) {
        estado.sobreAnimal = raycaster.intersectObject(corpo, false).length > 0;
        palco.classList.toggle('is-petting', estado.sobreAnimal);
      }
    } else if (!calmo) {
      cabecaAlvo.set(Math.sin(t * 0.31) * 0.22 + Math.sin(t * 0.83) * 0.06, Math.sin(t * 0.47) * 0.06 - 0.03);
    } else {
      cabecaAlvo.set(0, 0);
    }
    cabecaAtual.lerp(cabecaAlvo, 1 - Math.exp(-dt * 4));
    uniformes.uCabeca.value.copy(cabecaAtual);
    cabeca.rotation.set(0, cabecaAtual.x, cabecaAtual.y);

    // Focinho farejando quando o ponteiro está perto
    const farejar = estado.ponteiro && !calmo ? 1 : 0.25;
    const fareja = Math.sin(t * 13) * 0.004 * farejar * (Math.sin(t * 1.3) > 0.2 ? 1 : 0.2);
    uniformes.uFareja.value = fareja;
    narinas.position.y = fareja;

    // Rabo: abana mais com carinho
    estado.abano = Math.max(estado.abano - dt * 0.35, estado.sobreAnimal ? 0.8 : 0.12);
    const ab = calmo ? 0.05 : estado.abano;
    rabo.rotation.y = Math.sin(t * (4 + ab * 10)) * 0.5 * ab;
    rabo.rotation.z = Math.sin(t * (3 + ab * 7) + 1) * 0.25 * ab;

    // Orelhas: leve oscilação + "abanadas" ocasionais
    if (!calmo && t > proximoTremor) {
      orelhas[Math.random() > 0.5 ? 0 : 1].piscada = 1;
      proximoTremor = t + 2.5 + Math.random() * 4;
    }
    orelhas.forEach((o, i) => {
      o.piscada = Math.max(o.piscada - dt * 3, 0);
      const flick = Math.sin(o.piscada * Math.PI * 3) * o.piscada * 0.35;
      o.malha.rotation.x = (calmo ? 0 : Math.sin(t * 0.9 + i) * 0.04) + flick + (estado.sobreAnimal ? -0.12 : 0);
      o.malha.rotation.z = flick * 0.4 * o.lado;
    });

    // Piscar
    if (t > proximaPiscada) { piscando = 1; proximaPiscada = t + 2.5 + Math.random() * 3.5; }
    piscando = Math.max(piscando - dt * 7, 0);
    const pisca = 1 - Math.sin(piscando * Math.PI) * 0.92;
    olhos.forEach((o) => { o.scale.y = 0.8 * pisca; });

    // Anel de varredura do sensor (a cada 4 s)
    const fase = (t % 4) / 4;
    const raio = 0.4 + fase * 2.3;
    anelVarredura.scale.setScalar(raio);
    materialAnel.opacity = calmo ? 0 : (1 - fase) * 0.45 * Math.min(fase * 8, 1);

    poeira.rotation.y = t * 0.02;
    poeira.material.opacity = 0.55 + Math.sin(t * 0.5) * 0.1;

    // Câmera: aproxima no foco, recua um pouco ao rolar
    alvoDesejado.copy(centroOlhar);
    let fatorDist = 1 - rolagem * 0.12;
    if (estado.focado) {
      const s = estado.focado;
      alvoDesejado.lerp(s.mundo, 0.55);
      fatorDist = 0.72;
    }
    alvoAtual.lerp(alvoDesejado, 1 - Math.exp(-dt * 3));
    distanciaAtual += (distanciaBase * fatorDist - distanciaAtual) * (1 - Math.exp(-dt * 3));
    const direcao = vetorTmp.subVectors(camera.position, controles.target).normalize();
    controles.target.copy(alvoAtual);
    camera.position.copy(alvoAtual).addScaledVector(direcao, distanciaAtual);
    controles.update();

    renderer.render(cena, camera);
    posicionarSensores();
  }

  /* Projeta os pontos da pele na tela e liga cada um ao seu cartão.
     Ponto virado para longe da câmera = apagado (está "atrás" do animal). */
  const camPos = new THREE.Vector3(), normalMundo = new THREE.Vector3();
  function posicionarSensores() {
    if (!estado.sensoresVisiveis) return;
    const largura = renderer.domElement.clientWidth, altura = renderer.domElement.clientHeight;
    camera.getWorldPosition(camPos);
    suino.getWorldQuaternion(quat);
    // Cartões flutuam: deriva leve com o giro do animal e com o ponteiro
    const derivaX = Math.sin(guinadaAtual) * 14 + (estado.ponteiro ? estado.ponteiro.x * 8 : 0);
    const derivaY = estado.ponteiro ? -estado.ponteiro.y * 6 : 0;

    sensores.forEach((s, i) => {
      if (s.def.objeto) {
        s.def.objeto.getWorldPosition(s.mundo);
      } else if (s.def.cabeca) {
        // ponto na pele da cabeça: aplica a rotação da cabeça
        vetorTmp.copy(s.local).sub(PIVO_CABECA).applyEuler(cabeca.rotation).add(PIVO_CABECA);
        suino.localToWorld(s.mundo.copy(vetorTmp));
      } else {
        suino.localToWorld(s.mundo.copy(s.local));
      }

      normalMundo.copy(s.normal).applyQuaternion(quat);
      const deFrente = normalMundo.dot(vetorTmp.subVectors(camPos, s.mundo).normalize());
      const visivel = THREE.MathUtils.smoothstep(deFrente, -0.2, 0.25);

      const p = vetorTmp.copy(s.mundo).project(camera);
      const px = (p.x * 0.5 + 0.5) * largura, py = (-p.y * 0.5 + 0.5) * altura;
      const [fx, fy] = s.def.tela[nomeArranjo];
      const flutua = Math.sin(relogio.elapsedTime * 0.9 + i * 1.7) * 4;
      const ax = fx * largura + derivaX, ay = fy * altura + derivaY + flutua;

      s.ponto.style.transform = `translate3d(${px.toFixed(1)}px, ${py.toFixed(1)}px, 0)`;
      s.ponto.style.opacity = (0.2 + visivel * 0.8).toFixed(2);
      s.linha.setAttribute('x1', px.toFixed(1)); s.linha.setAttribute('y1', py.toFixed(1));
      s.linha.setAttribute('x2', ax.toFixed(1)); s.linha.setAttribute('y2', ay.toFixed(1));
      s.linha.style.opacity = (0.15 + visivel * 0.7).toFixed(2);

      // Cartão "holográfico": inclina para o animal e recua quando o sensor está de costas
      const nx = (ax - px) / largura, ny = (ay - py) / altura;
      const escala = 0.9 + visivel * 0.1;
      s.el.style.transform =
        // ancorado pelo topo (ou pela base, na metade de baixo): os detalhes abrem para longe da borda
        `translate3d(${ax.toFixed(1)}px, ${ay.toFixed(1)}px, 0) translate(-50%, ${fy > 0.62 ? "calc(-100% + 42px)" : "-42px"}) ` +
        `perspective(900px) rotateY(${(-nx * 40).toFixed(2)}deg) rotateX(${(ny * 22).toFixed(2)}deg) scale(${escala.toFixed(3)})`;
      s.el.style.setProperty('--depth', (0.55 + visivel * 0.45).toFixed(2));
      s.el.style.zIndex = String(Math.round(visivel * 10) + (s === estado.focado ? 20 : 0));
    });
  }

  function ligar() {
    if (rodando) return;
    rodando = true;
    relogio.getDelta();
    idRaf = requestAnimationFrame(animar);
  }
  function desligar() { rodando = false; cancelAnimationFrame(idRaf); }

  new IntersectionObserver(([entrada]) => {
    estado.visivel = entrada.isIntersecting;
    if (estado.visivel && !document.hidden) ligar(); else desligar();
  }).observe(palco);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) desligar(); else if (estado.visivel) ligar();
  });

  if (location.search.includes('debug3d')) window.__suino3d = { camera, controles, suino, cena, estado, cabeca };

  // Primeiro quadro já pronto antes de revelar a página
  renderer.render(cena, camera);
  ligar();
  palco.classList.add('is-ready');
  avisarPronto();
}

/* ══════════════════════════════════════════════
   MATERIAIS
══════════════════════════════════════════════ */
const GLSL_DEFORMACAO = /* glsl */ `
uniform vec2 uCabeca; uniform float uResp; uniform vec3 uPivo; uniform float uFareja;
mat3 stRotY(float a) { float c = cos(a), s = sin(a); return mat3(c, 0., -s, 0., 1., 0., s, 0., c); }
mat3 stRotZ(float a) { float c = cos(a), s = sin(a); return mat3(c, s, 0., -s, c, 0., 0., 0., 1.); }
mat3 stRotCabeca(vec3 p) { float w = smoothstep(0.44, 0.72, p.x); return stRotY(uCabeca.x * w) * stRotZ(uCabeca.y * w); }
`;
const GLSL_VERTICE = /* glsl */ `
vec3 transformed = vec3(position);
// Respiração: o tronco expande para os lados e a barriga desce um pouco
float wTronco = smoothstep(-0.72, -0.3, position.x) * (1.0 - smoothstep(0.3, 0.58, position.x)) * smoothstep(-0.45, -0.1, position.y);
transformed.z *= 1.0 + uResp * 0.028 * wTronco;
transformed.y -= uResp * 0.012 * wTronco * smoothstep(0.05, -0.25, position.y);
transformed.y += uFareja * smoothstep(0.9, 1.0, position.x);
transformed = uPivo + stRotCabeca(position) * (transformed - uPivo);
`;

function injetarDeformacao(shader) {
  shader.vertexShader = shader.vertexShader
    .replace('#include <common>', `#include <common>\n${GLSL_DEFORMACAO}\nvarying vec3 vLocal;`)
    .replace('#include <beginnormal_vertex>', 'vec3 objectNormal = stRotCabeca(position) * vec3(normal);\n#ifdef USE_TANGENT\nvec3 objectTangent = vec3(tangent.xyz);\n#endif')
    .replace('#include <begin_vertex>', `${GLSL_VERTICE}\nvLocal = position;`);
}

function materialPele(uniformes) {
  const m = new THREE.MeshPhysicalMaterial({
    vertexColors: true, roughness: 0.62, metalness: 0,
    sheen: 0.4, sheenRoughness: 0.6, sheenColor: new THREE.Color('#ffc9b4'),
    clearcoat: 0.04, clearcoatRoughness: 0.6, envMapIntensity: 0.42,
    emissive: new THREE.Color('#4a140c'), emissiveIntensity: 0.14, // um pouco de "subsuperfície"
  });
  m.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniformes);
    injetarDeformacao(shader);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>
uniform float uRelevo;
varying vec3 vLocal;
float stHash(vec3 p) { p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
float stRuido(vec3 x) {
  vec3 i = floor(x); vec3 f = fract(x); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(stHash(i), stHash(i + vec3(1,0,0)), f.x), mix(stHash(i + vec3(0,1,0)), stHash(i + vec3(1,1,0)), f.x), f.y),
             mix(mix(stHash(i + vec3(0,0,1)), stHash(i + vec3(1,0,1)), f.x), mix(stHash(i + vec3(0,1,1)), stHash(i + vec3(1,1,1)), f.x), f.y), f.z);
}
vec3 stPerturbar(vec3 posSup, vec3 nSup, vec2 dH, float lado) {
  vec3 sx = normalize(dFdx(posSup)); vec3 sy = normalize(dFdy(posSup));
  vec3 r1 = cross(sy, nSup); vec3 r2 = cross(nSup, sx);
  float det = dot(sx, r1) * lado;
  vec3 grad = sign(det) * (dH.x * r1 + dH.y * r2);
  return normalize(abs(det) * nSup - grad);
}`)
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
{
  // Poros e pelos finos + rugas do focinho e da papada
  float alt = stRuido(vLocal * 150.0) * 0.5 + stRuido(vLocal * 42.0) * 0.5;
  float focinho = smoothstep(0.9, 0.95, vLocal.x) * (1.0 - smoothstep(0.995, 1.01, vLocal.x));
  alt += sin(vLocal.x * 320.0 + sin(vLocal.y * 36.0) * 2.0) * 0.45 * focinho;
  float papada = smoothstep(0.5, 0.58, vLocal.x) * (1.0 - smoothstep(0.66, 0.74, vLocal.x)) * smoothstep(0.02, -0.12, vLocal.y);
  alt += sin(vLocal.x * 180.0 + vLocal.z * 20.0) * 0.4 * papada;
  normal = stPerturbar(-vViewPosition, normal, vec2(dFdx(alt), dFdy(alt)) * uRelevo, faceDirection);
}`);
  };
  m.customProgramCacheKey = () => 'suino-pele';
  return m;
}

function materialProfundidade(uniformes) {
  const m = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking });
  m.onBeforeCompile = (shader) => { Object.assign(shader.uniforms, uniformes); injetarDeformacao(shader); };
  m.customProgramCacheKey = () => 'suino-profundidade';
  return m;
}

/* ══════════════════════════════════════════════
   PEÇAS DO CORPO
══════════════════════════════════════════════ */
function geometriaOrelha(comprimento, largura) {
  const g = new THREE.PlaneGeometry(1, 1, 14, 22);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const u = p.getX(i) * 2;          // -1..1 de borda a borda
    const v = p.getY(i) + 0.5;        // 0 na base, 1 na ponta
    const perfil = Math.pow(Math.max(1 - Math.pow(v, 1.6), 0), 0.75) * (0.82 + 0.45 * Math.sin(Math.PI * v * 0.8));
    const x = u * perfil * largura * 0.5;
    const y = v * comprimento;
    const concha = -(1 - u * u) * perfil * largura * 0.17 * Math.sin(Math.PI * Math.min(v * 1.15, 1));
    const curva = v * v * comprimento * 0.3;  // a ponta tomba para a frente
    p.setXYZ(i, x, y, concha + curva);
  }
  g.computeVertexNormals();
  return g;
}

function texturaOrelha() {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const ctx = c.getContext('2d');
  const grad = ctx.createLinearGradient(0, 256, 0, 0);
  grad.addColorStop(0, '#e9aa9a');
  grad.addColorStop(0.6, '#f0b7a6');
  grad.addColorStop(1, '#f4c6b6');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 256, 256);
  // Veias saindo da base e se ramificando até a ponta
  ctx.strokeStyle = 'rgba(196, 98, 92, 0.42)';
  ctx.lineCap = 'round';
  const galho = (x, y, ang, comp, larg) => {
    if (comp < 10 || larg < 0.5) return;
    const x2 = x + Math.sin(ang) * comp, y2 = y - Math.cos(ang) * comp;
    ctx.lineWidth = larg;
    ctx.beginPath(); ctx.moveTo(x, y);
    ctx.quadraticCurveTo(x + Math.sin(ang + 0.3) * comp * 0.5, y - Math.cos(ang + 0.3) * comp * 0.5, x2, y2);
    ctx.stroke();
    galho(x2, y2, ang - 0.35 - Math.random() * 0.2, comp * 0.72, larg * 0.7);
    galho(x2, y2, ang + 0.3 + Math.random() * 0.2, comp * 0.68, larg * 0.66);
  };
  galho(118, 256, -0.08, 70, 3.2);
  galho(140, 256, 0.12, 62, 2.6);
  // Borda um pouco mais escura
  const borda = ctx.createRadialGradient(128, 150, 60, 128, 150, 150);
  borda.addColorStop(0, 'rgba(0,0,0,0)');
  borda.addColorStop(1, 'rgba(150,70,60,0.22)');
  ctx.fillStyle = borda;
  ctx.fillRect(0, 0, 256, 256);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function criarBrinco() {
  const forma = new THREE.Shape();
  const w = 0.042, h = 0.05, r = 0.012;
  forma.moveTo(-w / 2 + r, -h / 2);
  forma.lineTo(w / 2 - r, -h / 2); forma.quadraticCurveTo(w / 2, -h / 2, w / 2, -h / 2 + r);
  forma.lineTo(w / 2, h / 2 - r); forma.quadraticCurveTo(w / 2, h / 2, w / 2 - r, h / 2);
  forma.lineTo(-w / 2 + r, h / 2); forma.quadraticCurveTo(-w / 2, h / 2, -w / 2, h / 2 - r);
  forma.lineTo(-w / 2, -h / 2 + r); forma.quadraticCurveTo(-w / 2, -h / 2, -w / 2 + r, -h / 2);
  const geo = new THREE.ExtrudeGeometry(forma, { depth: 0.004, bevelEnabled: true, bevelThickness: 0.0015, bevelSize: 0.0015, bevelSegments: 2, curveSegments: 6 });
  const grupo = new THREE.Group();
  const placa = new THREE.Mesh(geo, new THREE.MeshPhysicalMaterial({ color: 0xe9b824, roughness: 0.35, clearcoat: 0.6, clearcoatRoughness: 0.2 }));
  placa.position.y = -0.028;
  placa.castShadow = true;
  const pino = new THREE.Mesh(new THREE.CylinderGeometry(0.007, 0.007, 0.012, 16), new THREE.MeshStandardMaterial({ color: 0xc89a12, roughness: 0.4 }));
  pino.rotation.x = Math.PI / 2;
  grupo.add(placa, pino);
  return grupo;
}

function criarRabo(corPele) {
  const base = new THREE.Vector3(-0.688, 0.17, 0);
  const pontos = [];
  for (let i = 0; i <= 28; i++) {
    const t = i / 28;
    const a = t * Math.PI * 2.5;
    const r = 0.034 * (1 - 0.35 * t);
    pontos.push(new THREE.Vector3(
      -0.02 - 0.06 * t - Math.sin(a) * r * 0.55,
      -0.1 * t + (Math.cos(a) - 1) * r,
      Math.sin(a) * r * 0.9,
    ));
  }
  const curva = new THREE.CatmullRomCurve3(pontos);
  const segmentos = 64, radiais = 10;
  const geo = new THREE.TubeGeometry(curva, segmentos, 0.015, radiais, false);
  // afina até a ponta
  const pos = geo.attributes.position;
  const centro = new THREE.Vector3(), v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    const anel = Math.floor(i / (radiais + 1));
    const t = anel / segmentos;
    curva.getPointAt(t, centro);
    v.fromBufferAttribute(pos, i).sub(centro).multiplyScalar(1 - 0.6 * t).add(centro);
    pos.setXYZ(i, v.x, v.y, v.z);
  }
  geo.computeVertexNormals();
  const mat = new THREE.MeshPhysicalMaterial({ color: corPele, roughness: 0.6, sheen: 0.7, sheenColor: new THREE.Color('#ffd6c4') });
  const malha = new THREE.Mesh(geo, mat);
  malha.castShadow = true;
  const grupo = new THREE.Group();
  grupo.position.copy(base);
  grupo.add(malha);
  return grupo;
}

function texturaRadial(centro, borda) {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, centro);
  g.addColorStop(1, borda);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function criarPoeira() {
  const n = 140;
  const pos = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2, r = 0.8 + Math.random() * 2.4;
    pos[i * 3] = Math.cos(a) * r;
    pos[i * 3 + 1] = Math.random() * 2.4;
    pos[i * 3 + 2] = Math.sin(a) * r;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const mat = new THREE.PointsMaterial({
    size: 0.03, map: texturaRadial('rgba(255,248,214,1)', 'rgba(255,248,214,0)'),
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.6, color: 0xf3f0c4,
  });
  return new THREE.Points(geo, mat);
}

function sparkline(valores, w, h) {
  const min = Math.min(...valores), max = Math.max(...valores);
  const amp = max - min || 1;
  return valores.map((v, i) => {
    const x = (i / (valores.length - 1)) * w;
    const y = h - 2 - ((v - min) / amp) * (h - 4);
    return `${i ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`;
  }).join(' ');
}

/* Inicia só depois que o módulo inteiro foi avaliado (as constantes de shader acima já existem) */
if (palco && alvoGL) iniciar().catch((erro) => {
  console.warn('Suíno 3D indisponível — mostrando a versão em foto.', erro);
  palco.classList.add('is-fallback');
  avisarPronto();
});
