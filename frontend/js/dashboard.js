/* ─────────────────────────────────────────────────────────
   dashboard.js — Liga a seção #dashboard do index.html aos
   dados reais vindos do backend (API REST + WebSocket).

   Se você for hospedar o frontend separado do backend, troque
   API_BASE por algo como "http://localhost:3000".

   Os elementos são atualizados no lugar (e não recriados), para
   que barras e medidores animem a partir do valor anterior.
   ───────────────────────────────────────────────────────── */
(function () {
  const API_BASE = "";
  const NOMES_BAIAS = ["A", "B", "C", "D"];
  const ui = window.SuinoUI || { tick() {}, prefersReducedMotion: () => false };

  // ── Referências dos elementos ──
  const el = {
    heroTotal: document.getElementById("hero-live-total"),
    liveDot: document.getElementById("dash-live-dot"),
    liveTexto: document.getElementById("dash-live-texto"),

    totalCurral: document.getElementById("dash-total-curral"),
    totalSub: document.getElementById("dash-total-sub"),
    miniChart: document.getElementById("dash-mini-chart"),
    miniChartEixo: document.getElementById("dash-mini-chart-eixo"),
    baiasLista: document.getElementById("dash-baias-lista"),

    entradasHoje: document.getElementById("dash-entradas-hoje"),
    entradasBadge: document.getElementById("dash-entradas-badge"),
    entradasBarra: document.getElementById("dash-entradas-barra"),
    entradasLegenda: document.getElementById("dash-entradas-legenda"),

    saidasHoje: document.getElementById("dash-saidas-hoje"),
    saidasBadge: document.getElementById("dash-saidas-badge"),
    saidasBarra: document.getElementById("dash-saidas-barra"),
    saidasLegenda: document.getElementById("dash-saidas-legenda"),

    alertasContagem: document.getElementById("dash-alertas-contagem"),
    alertasLista: document.getElementById("dash-alertas-lista"),
    alertasCard: document.getElementById("dash-alertas-card"),

    ultimoEvento: document.getElementById("dash-ultimo-evento"),

    btnSimularEntrada: document.getElementById("dash-btn-simular-entrada"),
    btnSimularSaida: document.getElementById("dash-btn-simular-saida"),
  };

  // Se a seção não existir nesta página, não faz nada (evita erros em outras páginas)
  if (!el.totalCurral) return;

  function formatarHora(timestampSql) {
    if (!timestampSql) return "—";
    // "2026-08-09 20:35:39" -> Date local
    const d = new Date(timestampSql.replace(" ", "T"));
    if (isNaN(d.getTime())) return timestampSql;
    return d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  }

  function definirConexao(texto, aoVivo) {
    if (el.liveTexto) el.liveTexto.textContent = texto;
    if (el.liveDot) el.liveDot.classList.toggle("live-dot--muted", !aoVivo);
  }

  // Escreve um número + sufixo e destaca o número se ele mudou
  function definirNumero(alvo, valor, sufixoHtml) {
    const anterior = alvo.dataset.valor;
    alvo.innerHTML = `${valor}${sufixoHtml}`;
    alvo.dataset.valor = String(valor);
    if (anterior !== undefined && anterior !== String(valor)) ui.tick(alvo);
  }

  function definirEscala(barra, fracao, eixo) {
    const f = Math.max(0, Math.min(fracao, 1));
    barra.style.transform = `${eixo}(${f})`;
  }

  // ── Planta do galpão: cada baia tem `capacidade` vagas; cada animal no
  // curral ocupa uma vaga. Baias são atualizadas no lugar: só o suíno que
  // entrou (ou saiu) anima, pela porteira do corredor. ──
  const SVG_PORCO = `<svg viewBox="0 0 32 22" aria-hidden="true"><use href="#i-pig"/></svg>`;
  let primeiraRenderBaias = true;

  function criarBaia(b) {
    const baia = document.createElement("article");
    baia.className = "pen";
    baia.dataset.baia = b.nome;
    baia.tabIndex = 0;
    baia.innerHTML = `<div class="pen-head">
        <span class="ear-tag" aria-hidden="true">${b.nome}</span>
        <span class="pen-name">Baia ${b.nome}</span>
        <span class="pen-count"><b class="pen-total">0</b><small> / ${b.capacidade}</small></span>
      </div>
      <div class="pen-floor" aria-hidden="true"></div>
      <div class="pen-meter"><div class="pen-meter-fill"></div></div>
      <div class="pen-foot"><span>Ocupação</span><span class="sensor-row-val">0%</span></div>`;
    return baia;
  }

  function ajustarVagas(baia, capacidade, ocupadas, animar) {
    const piso = baia.querySelector(".pen-floor");
    const vagas = Math.max(capacidade, 0);
    while (piso.children.length < vagas) {
      const vaga = document.createElement("span");
      vaga.className = "slot";
      piso.appendChild(vaga);
    }
    while (piso.children.length > vagas) piso.lastElementChild.remove();

    const reduzir = ui.prefersReducedMotion();
    [...piso.children].forEach((vaga, i) => {
      const porco = vaga.querySelector("svg:not(.is-leaving)");
      if (i < ocupadas && !porco) {
        vaga.innerHTML = SVG_PORCO;
        if (animar) {
          const novo = vaga.firstElementChild;
          novo.classList.add("is-arriving");
          novo.addEventListener("animationend", () => novo.classList.remove("is-arriving"), { once: true });
        }
      } else if (i >= ocupadas && porco) {
        if (!animar || reduzir) { porco.remove(); return; }
        porco.classList.remove("is-arriving");
        porco.classList.add("is-leaving");
        porco.addEventListener("animationend", () => porco.remove(), { once: true });
      }
    });
  }

  function renderizarBaias(baias) {
    if (!el.baiasLista.querySelector(".pen")) el.baiasLista.innerHTML = "";

    baias.forEach((b) => {
      let baia = el.baiasLista.querySelector(`.pen[data-baia="${b.nome}"]`);
      if (!baia) {
        baia = criarBaia(b);
        el.baiasLista.appendChild(baia);
      }

      const pct = b.capacidade > 0 ? Math.round((b.totalAtual / b.capacidade) * 100) : 0;
      baia.dataset.nivel = pct >= 100 ? "critico" : pct >= 85 ? "atencao" : "ok";
      baia.setAttribute("aria-label", `Baia ${b.nome}: ${b.totalAtual} de ${b.capacidade} vagas ocupadas (${pct}%)`);

      const total = baia.querySelector(".pen-total");
      if (total.textContent !== String(b.totalAtual) && !primeiraRenderBaias) ui.tick(total);
      total.textContent = b.totalAtual;

      const valor = baia.querySelector(".sensor-row-val");
      valor.textContent = `${pct}%${pct >= 100 ? " · lotada" : ""}`;

      ajustarVagas(baia, b.capacidade, Math.min(b.totalAtual, b.capacidade), !primeiraRenderBaias);
      definirEscala(baia.querySelector(".pen-meter-fill"), pct / 100, "scaleX");
    });

    el.baiasLista.querySelectorAll(".pen").forEach((baia) => {
      if (!baias.some((b) => b.nome === baia.dataset.baia)) baia.remove();
    });
    primeiraRenderBaias = false;
  }

  // ── Alertas (chaveados por baia: só alertas novos entram com animação) ──
  function renderizarAlertas(alertas) {
    definirNumero(
      el.alertasContagem,
      alertas.length,
      `<span class="suffix"> alerta${alertas.length === 1 ? "" : "s"}</span>`
    );
    el.alertasCard.dataset.alerta = alertas.length > 0 ? "sim" : "nao";

    if (alertas.length === 0) {
      el.alertasLista.innerHTML = `<div class="alerta-vazio">Nenhuma baia próxima da capacidade máxima.</div>`;
      return;
    }

    el.alertasLista.querySelector(".alerta-vazio")?.remove();
    const chaves = new Set();

    alertas.forEach((a) => {
      const chave = a.baia || a.mensagem;
      chaves.add(chave);
      let item = el.alertasLista.querySelector(`.alerta-item[data-chave="${CSS.escape(chave)}"]`);
      if (!item) {
        item = document.createElement("div");
        item.dataset.chave = chave;
        item.innerHTML = `<div class="alerta-nivel"></div><div class="alerta-msg"></div>`;
        item.className = "alerta-item is-new";
        item.addEventListener("animationend", () => item.classList.remove("is-new"), { once: true });
      }
      const critico = a.nivel === "critico";
      item.classList.toggle("alerta-item--critico", critico);
      item.querySelector(".alerta-nivel").textContent = critico ? "Crítico · baia lotada" : "Atenção · quase lotada";
      item.querySelector(".alerta-msg").textContent = a.mensagem;
      el.alertasLista.appendChild(item); // mantém a ordem vinda do servidor
    });

    el.alertasLista.querySelectorAll(".alerta-item").forEach((item) => {
      if (!chaves.has(item.dataset.chave)) item.remove();
    });
  }

  function renderizarResumo(resumo) {
    // Total no curral
    definirNumero(el.totalCurral, resumo.totalNoCurral, `<span class="unit" id="dash-total-unidade"> suínos</span>`);
    if (el.heroTotal) {
      const anterior = el.heroTotal.textContent;
      el.heroTotal.textContent = `${resumo.totalNoCurral} suíno${resumo.totalNoCurral === 1 ? "" : "s"}`;
      if (anterior !== "—" && anterior !== el.heroTotal.textContent) ui.tick(el.heroTotal);
    }
    el.totalSub.textContent = resumo.ultimoEvento
      ? `Último registro: Baia ${resumo.ultimoEvento.baia} · ${resumo.ultimoEvento.tipo === "entrada" ? "Entrada" : "Saída"} às ${formatarHora(resumo.ultimoEvento.timestamp)}`
      : "Aguardando primeiro evento…";

    renderizarBaias(resumo.baias);

    // Entradas / saídas hoje
    const sufixo = `<span class="suffix"> registros</span>`;
    definirNumero(el.entradasHoje, resumo.entradasHoje, sufixo);
    definirNumero(el.saidasHoje, resumo.saidasHoje, sufixo);

    const totalHoje = resumo.entradasHoje + resumo.saidasHoje;
    const pctEntradas = totalHoje > 0 ? Math.round((resumo.entradasHoje / totalHoje) * 100) : 0;
    const pctSaidas = totalHoje > 0 ? Math.round((resumo.saidasHoje / totalHoje) * 100) : 0;

    definirEscala(el.entradasBarra, pctEntradas / 100, "scaleX");
    el.entradasLegenda.textContent = totalHoje > 0 ? `${pctEntradas}% do fluxo de hoje` : "Sem movimentação ainda";
    el.entradasBadge.textContent = resumo.entradasHoje > 0 ? "Movimentação registrada" : "Sem movimentação ainda";

    definirEscala(el.saidasBarra, pctSaidas / 100, "scaleX");
    el.saidasLegenda.textContent = totalHoje > 0 ? `${pctSaidas}% do fluxo de hoje` : "Sem movimentação ainda";
    el.saidasBadge.textContent = resumo.saidasHoje > 0 ? "Movimentação registrada" : "Sem movimentação ainda";

    renderizarAlertas(resumo.alertas);

    if (resumo.ultimoEvento) {
      el.ultimoEvento.textContent = `Baia ${resumo.ultimoEvento.baia} · ${resumo.ultimoEvento.tipo === "entrada" ? "Entrada" : "Saída"} (${formatarHora(resumo.ultimoEvento.timestamp)})`;
    }
  }

  // ── Gráfico de barras: movimentações por hora (últimas 7h) ──
  async function atualizarMiniChart() {
    try {
      // Busca só a partir da data de início da janela (pode ser ontem,
      // se a janela de 7h atravessar a meia-noite)
      const agora = new Date();
      const inicioJanela = new Date(agora.getTime() - 6 * 60 * 60 * 1000);
      const pad = (n) => String(n).padStart(2, "0");
      const de = `${inicioJanela.getFullYear()}-${pad(inicioJanela.getMonth() + 1)}-${pad(inicioJanela.getDate())}`;

      const resp = await fetch(`${API_BASE}/api/eventos?de=${de}&limit=5000`);
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const { eventos } = await resp.json();

      const buckets = [];
      for (let h = 6; h >= 0; h--) {
        const inicioHora = new Date(agora);
        inicioHora.setHours(agora.getHours() - h, 0, 0, 0);
        buckets.push({ inicioHora, contagem: 0 });
      }

      eventos.forEach((ev) => {
        const d = new Date(ev.timestamp.replace(" ", "T"));
        const bucket = buckets.find(
          (b) => d.getFullYear() === b.inicioHora.getFullYear() &&
                 d.getMonth() === b.inicioHora.getMonth() &&
                 d.getDate() === b.inicioHora.getDate() &&
                 d.getHours() === b.inicioHora.getHours()
        );
        if (bucket) bucket.contagem++;
      });

      // Garante exatamente uma barra por hora (reaproveita as existentes)
      let barras = el.miniChart.querySelectorAll(".mini-bar");
      if (barras.length !== buckets.length) {
        el.miniChart.innerHTML = buckets.map(() => `<div class="mini-bar"></div>`).join("");
        barras = el.miniChart.querySelectorAll(".mini-bar");
      }

      const maxContagem = Math.max(...buckets.map((b) => b.contagem), 1);
      buckets.forEach((b, i) => {
        const barra = barras[i];
        const rotulo = `${b.inicioHora.getHours()}h — ${b.contagem} evento${b.contagem === 1 ? "" : "s"}`;
        definirEscala(barra, Math.max(b.contagem / maxContagem, 0.04), "scaleY");
        barra.classList.toggle("active", i === buckets.length - 1);
        barra.title = rotulo;
        barra.setAttribute("aria-label", rotulo);
      });
      el.miniChart.setAttribute("role", "img");
      el.miniChart.setAttribute("aria-label", "Movimentações por hora: " + buckets.map((b) => `${b.inicioHora.getHours()}h ${b.contagem}`).join(", "));

      if (el.miniChartEixo) {
        el.miniChartEixo.innerHTML = buckets.map((b) => `<span>${b.inicioHora.getHours()}h</span>`).join("");
      }
    } catch (err) {
      console.warn("Não foi possível atualizar o gráfico de movimentações:", err);
    }
  }

  // ── Botões de simulação (demo sem hardware) ──
  let proximaBaiaDemo = 0;
  async function simularEvento(tipo, botao) {
    const baia = NOMES_BAIAS[proximaBaiaDemo % NOMES_BAIAS.length];
    proximaBaiaDemo++;
    botao?.setAttribute("aria-busy", "true");
    try {
      const resp = await fetch(`${API_BASE}/api/eventos`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ baia, tipo, origem: "demo" }),
      });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    } catch (err) {
      console.error("Falha ao simular evento:", err);
      definirConexao("Falha ao enviar o evento — o servidor está rodando?", false);
    } finally {
      botao?.removeAttribute("aria-busy");
    }
  }

  el.btnSimularEntrada?.addEventListener("click", () => simularEvento("entrada", el.btnSimularEntrada));
  el.btnSimularSaida?.addEventListener("click", () => simularEvento("saida", el.btnSimularSaida));

  // ── Carga inicial via REST (garante dados mesmo se o WebSocket demorar) ──
  fetch(`${API_BASE}/api/resumo`)
    .then((r) => r.json())
    .then(renderizarResumo)
    .catch((err) => {
      console.warn("Não foi possível carregar o resumo inicial:", err);
      definirConexao("Servidor indisponível — inicie o backend (npm start)", false);
    });

  atualizarMiniChart();

  // ── WebSocket (tempo real) ──
  // Observação: o indicador "Status do Sistema" (dot + texto) é controlado
  // pelo js/arduino-serial.js, que reflete se o navegador está com o Arduino
  // conectado via USB (Web Serial API). Aqui só cuidamos dos dados.
  if (typeof io === "function") {
    const socket = io(API_BASE || undefined);

    socket.on("connect", () => definirConexao("Ao vivo · conectado ao servidor", true));
    socket.on("disconnect", () => definirConexao("Servidor desconectado — tentando reconectar…", false));
    socket.on("connect_error", () => definirConexao("Sem conexão em tempo real com o servidor", false));

    socket.on("resumo-inicial", (resumo) => {
      renderizarResumo(resumo);
    });

    socket.on("novo-evento", ({ resumo }) => {
      renderizarResumo(resumo);
      atualizarMiniChart();
    });
  } else {
    definirConexao("Tempo real indisponível (Socket.IO não carregou)", false);
  }

  // Atualiza o gráfico periodicamente mesmo sem eventos novos (a janela de 7h "anda")
  setInterval(atualizarMiniChart, 5 * 60 * 1000);
})();
