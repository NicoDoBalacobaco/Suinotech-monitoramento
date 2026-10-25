/* ─────────────────────────────────────────────────────────
   historico.js — Página de Histórico e Relatórios
   Filtros, paginação, exportação em CSV e atualização ao vivo.
   ───────────────────────────────────────────────────────── */
(function () {
  const API_BASE = "";
  const ITENS_POR_PAGINA = 15;
  const ui = window.SuinoUI || { tick() {} };

  const el = {
    totalCurral: document.getElementById("hist-total-curral"),
    entradasHoje: document.getElementById("hist-entradas-hoje"),
    saidasHoje: document.getElementById("hist-saidas-hoje"),
    totalFiltro: document.getElementById("hist-total-filtro"),

    liveDot: document.getElementById("hist-live-dot"),
    liveTexto: document.getElementById("hist-live-texto"),
    legenda: document.getElementById("tabela-legenda"),

    form: document.getElementById("form-filtros"),
    fBaia: document.getElementById("f-baia"),
    fTipo: document.getElementById("f-tipo"),
    fDe: document.getElementById("f-de"),
    fAte: document.getElementById("f-ate"),

    btnFiltrar: document.getElementById("btn-filtrar"),
    btnLimpar: document.getElementById("btn-limpar"),
    btnExportar: document.getElementById("btn-exportar"),

    tabelaCorpo: document.getElementById("tabela-corpo"),
    btnAnterior: document.getElementById("btn-anterior"),
    btnProxima: document.getElementById("btn-proxima"),
    paginacaoInfo: document.getElementById("paginacao-info"),
  };

  if (!el.tabelaCorpo) return;

  let paginaAtual = 0; // 0-indexed
  let maiorIdVisto = null; // para destacar linhas que chegam ao vivo
  let requisicaoAtual = 0; // ignora respostas antigas se o usuário clicar rápido

  function filtrosAtuais() {
    return {
      baia: el.fBaia.value || undefined,
      tipo: el.fTipo.value || undefined,
      de: el.fDe.value || undefined,
      ate: el.fAte.value || undefined,
    };
  }

  function semFiltros() {
    return !el.fBaia.value && !el.fTipo.value && !el.fDe.value && !el.fAte.value;
  }

  function formatarData(timestampSql) {
    const d = new Date(timestampSql.replace(" ", "T"));
    if (isNaN(d.getTime())) return { data: timestampSql, hora: "" };
    return {
      data: d.toLocaleDateString("pt-BR"),
      hora: d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
    };
  }

  // Escapa texto antes de inserir em HTML: um valor vindo do servidor
  // nunca pode virar uma tag ou script na página.
  function escaparHtml(texto) {
    return String(texto ?? "").replace(/[&<>"']/g, (c) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
    })[c]);
  }

  // Nomes amigáveis para as origens aceitas pelo servidor (RN10)
  function origemLabel(origem) {
    switch (origem) {
      case "arduino": return "Arduino";
      case "manual": return "Manual";
      case "demo": return "Demonstração";
      case "simulador": return "Simulador";
      default: return escaparHtml(origem) || "—";
    }
  }

  function definirConexao(texto, aoVivo) {
    if (el.liveTexto) el.liveTexto.textContent = texto;
    if (el.liveDot) el.liveDot.classList.toggle("live-dot--muted", !aoVivo);
  }

  function definirValor(alvo, valor) {
    const novo = String(valor);
    if (alvo.dataset.valor !== undefined && alvo.dataset.valor !== novo) ui.tick(alvo);
    alvo.textContent = novo;
    alvo.dataset.valor = novo;
  }

  async function carregarResumo() {
    try {
      const resp = await fetch(`${API_BASE}/api/resumo`);
      const resumo = await resp.json();
      definirValor(el.totalCurral, resumo.totalNoCurral);
      definirValor(el.entradasHoje, resumo.entradasHoje);
      definirValor(el.saidasHoje, resumo.saidasHoje);
    } catch (err) {
      console.warn("Não foi possível carregar o resumo:", err);
    }
  }

  function linhaVazia(texto, erro) {
    return `<tr><td colspan="6" class="tabela-vazia${erro ? " tabela-vazia--erro" : ""}">${texto}</td></tr>`;
  }

  async function carregarEventos({ aoVivo = false } = {}) {
    const minhaRequisicao = ++requisicaoAtual;

    // Mantém a tabela atual visível (esmaecida) enquanto carrega — sem "piscar" vazio
    if (!el.tabelaCorpo.querySelector("tr td:not(.tabela-vazia)")) {
      el.tabelaCorpo.innerHTML = linhaVazia("Carregando registros…");
    } else if (!aoVivo) {
      el.tabelaCorpo.classList.add("is-loading");
    }
    el.tabelaCorpo.setAttribute("aria-busy", "true");

    const filtros = filtrosAtuais();
    const params = new URLSearchParams();
    Object.entries(filtros).forEach(([k, v]) => { if (v) params.set(k, v); });
    params.set("limit", ITENS_POR_PAGINA);
    params.set("offset", paginaAtual * ITENS_POR_PAGINA);

    try {
      const resp = await fetch(`${API_BASE}/api/eventos?${params.toString()}`);
      const corpo = await resp.json();
      if (!resp.ok) throw new Error(corpo.erro || `HTTP ${resp.status}`);
      const { eventos, total } = corpo;
      if (minhaRequisicao !== requisicaoAtual) return;

      definirValor(el.totalFiltro, total);

      if (eventos.length === 0) {
        el.tabelaCorpo.innerHTML = linhaVazia("Nenhum registro encontrado para este filtro.");
      } else {
        const limiteNovo = aoVivo ? maiorIdVisto : null;
        el.tabelaCorpo.innerHTML = eventos
          .map((ev) => {
            const { data, hora } = formatarData(ev.timestamp);
            const badgeClasse = ev.tipo === "entrada" ? "badge-tipo-entrada" : "badge-tipo-saida";
            const badgeTexto = ev.tipo === "entrada" ? "Entrada" : "Saída";
            const novo = limiteNovo !== null && Number(ev.id) > limiteNovo ? ' class="is-new"' : "";
            const baia = escaparHtml(ev.baia);
            return `<tr${novo}>
              <td class="col-id" data-label="Registro">#${escaparHtml(ev.id)}</td>
              <td class="col-baia" data-label="Baia"><span class="baia-cell"><span class="ear-tag ear-tag--sm" aria-hidden="true">${baia}</span>Baia ${baia}</span></td>
              <td data-label="Evento"><span class="badge-tipo ${badgeClasse}"><svg aria-hidden="true"><use href="#i-${ev.tipo === "entrada" ? "in" : "out"}"/></svg>${badgeTexto}</span></td>
              <td data-label="Data">${data}</td>
              <td data-label="Hora">${hora}</td>
              <td data-label="Origem">${origemLabel(ev.origem)}</td>
            </tr>`;
          })
          .join("");
      }

      if (paginaAtual === 0 && semFiltros()) {
        const ids = eventos.map((ev) => Number(ev.id)).filter((n) => !isNaN(n));
        if (ids.length) maiorIdVisto = Math.max(maiorIdVisto ?? 0, ...ids);
      }

      const totalPaginas = Math.max(Math.ceil(total / ITENS_POR_PAGINA), 1);
      el.paginacaoInfo.textContent = `Página ${paginaAtual + 1} de ${totalPaginas} · ${total} registro${total === 1 ? "" : "s"}`;
      if (el.legenda) {
        el.legenda.textContent = semFiltros()
          ? `${total} registro${total === 1 ? "" : "s"} no total`
          : `${total} registro${total === 1 ? "" : "s"} com os filtros aplicados`;
      }
      el.btnAnterior.disabled = paginaAtual <= 0;
      el.btnProxima.disabled = paginaAtual + 1 >= totalPaginas;
    } catch (err) {
      if (minhaRequisicao !== requisicaoAtual) return;
      el.tabelaCorpo.innerHTML = linhaVazia("Erro ao carregar registros. O servidor (backend) está rodando?", true);
      if (el.legenda) el.legenda.textContent = "Sem conexão com o servidor";
      console.error(err);
    } finally {
      if (minhaRequisicao === requisicaoAtual) {
        el.tabelaCorpo.classList.remove("is-loading");
        el.tabelaCorpo.removeAttribute("aria-busy");
      }
    }
  }

  function exportarCsv() {
    const filtros = filtrosAtuais();
    const params = new URLSearchParams();
    Object.entries(filtros).forEach(([k, v]) => { if (v) params.set(k, v); });
    window.location.href = `${API_BASE}/api/eventos/exportar?${params.toString()}`;
  }

  // Enter em qualquer campo também filtra (o botão "Filtrar" é o submit do formulário)
  el.form?.addEventListener("submit", (e) => {
    e.preventDefault();
    paginaAtual = 0;
    carregarEventos();
  });
  if (!el.form) {
    el.btnFiltrar.addEventListener("click", () => { paginaAtual = 0; carregarEventos(); });
  }
  el.btnLimpar.addEventListener("click", () => {
    el.fBaia.value = "";
    el.fTipo.value = "";
    el.fDe.value = "";
    el.fAte.value = "";
    paginaAtual = 0;
    carregarEventos();
  });
  el.btnExportar.addEventListener("click", exportarCsv);
  el.btnAnterior.addEventListener("click", () => {
    if (paginaAtual > 0) { paginaAtual--; carregarEventos(); }
  });
  el.btnProxima.addEventListener("click", () => {
    paginaAtual++; carregarEventos();
  });

  carregarResumo();
  carregarEventos();

  // ── Atualização ao vivo: se estiver na 1ª página sem filtros, refaz a
  // busca automaticamente quando um novo evento chega do Arduino ──
  if (typeof io === "function") {
    const socket = io(API_BASE || undefined);
    socket.on("connect", () => definirConexao("Ao vivo · novos eventos aparecem aqui", true));
    socket.on("disconnect", () => definirConexao("Servidor desconectado — tentando reconectar…", false));
    socket.on("connect_error", () => definirConexao("Sem conexão em tempo real", false));
    socket.on("novo-evento", () => {
      carregarResumo();
      if (paginaAtual === 0 && semFiltros()) {
        carregarEventos({ aoVivo: true });
      }
    });
  } else {
    definirConexao("Tempo real indisponível", false);
  }
})();
