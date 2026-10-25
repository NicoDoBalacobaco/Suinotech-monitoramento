/* ─────────────────────────────────────────────────────────
   arduino-serial.js — Conecta no Arduino DIRETO pelo navegador,
   usando a Web Serial API (nativa do Chrome/Edge). Não depende
   de nenhuma biblioteca nem configuração no backend (RNF01).

   Como funciona:
   1. O usuário clica em "Conectar Arduino (USB)"
   2. O navegador mostra a lista de portas USB do computador
   3. O usuário escolhe a porta do Arduino
   4. Este script lê cada linha JSON que o Arduino envia
      (ex: {"baia":"A","evento":"entrada"}) e manda para o backend
      via POST /api/eventos — que grava e distribui o evento em
      tempo real para todas as telas via WebSocket.

   Se o servidor estiver fora do ar no momento, o evento NÃO se
   perde: fica numa fila e é reenviado automaticamente.

   Compatibilidade: Chrome e Edge no computador. Em Firefox,
   Safari e celular o botão fica desabilitado com um aviso.
   ───────────────────────────────────────────────────────── */
(function () {
  const API_BASE = "";
  const BAUD_RATE = 9600; // precisa ser igual ao Serial.begin() do sketch
  const INTERVALO_REENVIO_MS = 3000;

  const statusDot = document.getElementById("dash-status-dot");
  const statusTexto = document.getElementById("dash-status-texto");
  const btnConectar = document.getElementById("dash-btn-conectar-arduino");

  if (!btnConectar) return; // não está na página do painel

  const btnRotulo = btnConectar.querySelector(".btn-label") || btnConectar;

  let porta = null;
  let leitor = null;
  let leituraAtiva = false;
  let conectando = false;

  const fila = [];            // eventos lidos do Arduino ainda não aceitos pelo servidor
  let enviando = false;
  let reenvioAgendado = null;

  // ── Indicador de status (cor e pulso ficam no CSS) ──
  // estado: "ok" | "erro" | "aviso" | "inativo"
  function definirStatus(texto, estado) {
    statusTexto.textContent = texto;
    if (statusDot) statusDot.dataset.estado = estado;
  }

  function statusConectado() {
    if (fila.length > 0) {
      definirStatus(`Arduino conectado · ${fila.length} evento(s) aguardando o servidor`, "aviso");
    } else {
      definirStatus("Arduino conectado (USB)", "ok");
    }
  }

  // ── Navegador sem suporte (Firefox, Safari, celular) — RNF03 ──
  if (!("serial" in navigator)) {
    definirStatus("Navegador sem suporte a USB · use Chrome ou Edge", "erro");
    btnConectar.disabled = true;
    btnConectar.title = "Abra este site no Chrome ou Edge, no computador, para conectar o Arduino.";
    return;
  }

  definirStatus("Arduino não conectado", "inativo");

  // ── Conexão (RF10) ──

  async function conectar() {
    if (conectando) return; // evita abrir duas janelas com cliques repetidos
    conectando = true;
    try {
      porta = await navigator.serial.requestPort();
      await porta.open({ baudRate: BAUD_RATE });

      leituraAtiva = true;
      btnRotulo.textContent = "Desconectar Arduino";
      statusConectado();
      lerContinuamente();
    } catch (err) {
      porta = null;
      // Usuário fechou a janela de seleção sem escolher nada — não é erro de verdade
      if (err.name === "NotFoundError") return;
      console.error("Falha ao conectar no Arduino:", err);
      definirStatus(`Falha ao conectar: ${err.message}`, "erro");
    } finally {
      conectando = false;
    }
  }

  async function desconectar() {
    leituraAtiva = false;
    try { await leitor?.cancel(); } catch { /* já estava fechado */ }
    try { await porta?.close(); } catch { /* já estava fechado */ }
    porta = null;
    leitor = null;
    btnRotulo.textContent = "Conectar Arduino (USB)";
    definirStatus("Arduino não conectado", "inativo");
  }

  btnConectar.addEventListener("click", () => (porta ? desconectar() : conectar()));

  // Se o cabo USB for puxado, o navegador avisa aqui
  navigator.serial.addEventListener("disconnect", async (evento) => {
    if (porta && evento.target === porta) {
      await desconectar();
      definirStatus("Cabo USB desconectado", "aviso");
    }
  });

  // ── Leitura da porta serial ──

  /**
   * Lê o fluxo da porta continuamente. Uma leitura pode trazer meia
   * linha ou várias linhas juntas, por isso os caracteres são acumulados
   * num buffer e cada linha completa (terminada em \n) é processada uma
   * única vez.
   */
  async function lerContinuamente() {
    const decoder = new TextDecoderStream();
    const streamFechado = porta.readable.pipeTo(decoder.writable).catch(() => {});
    leitor = decoder.readable.getReader();

    let buffer = "";
    try {
      while (leituraAtiva) {
        const { value, done } = await leitor.read();
        if (done) break;
        buffer += value;

        let indiceQuebra;
        while ((indiceQuebra = buffer.indexOf("\n")) >= 0) {
          const linha = buffer.slice(0, indiceQuebra).trim();
          buffer = buffer.slice(indiceQuebra + 1);
          if (linha) processarLinha(linha);
        }
      }
    } catch (err) {
      console.error("Conexão com o Arduino perdida:", err);
      if (leituraAtiva) {
        await desconectar();
        definirStatus("Conexão perdida — reconecte o cabo USB", "erro");
      }
    } finally {
      try { leitor?.releaseLock(); } catch { /* noop */ }
      await streamFechado;
    }
  }

  /** Interpreta uma linha do Arduino e, se for um evento válido, enfileira o envio. */
  function processarLinha(linha) {
    let dados;
    try {
      dados = JSON.parse(linha);
    } catch {
      return; // texto fora do formato JSON (ex: mensagem de depuração) — ignora
    }

    if (dados.status) return; // mensagem de prontidão {"status":"pronto"}

    const { baia, evento } = dados;
    if (!baia || (evento !== "entrada" && evento !== "saida")) return;

    fila.push({ baia, tipo: evento, origem: "arduino" });
    enviarFila();
  }

  // ── Envio ao servidor, com fila de reenvio ──

  /**
   * Envia os eventos pendentes em ordem. Se o servidor não responder,
   * para e tenta de novo daqui a alguns segundos — os eventos continuam
   * na fila até serem aceitos.
   */
  async function enviarFila() {
    if (enviando) return;
    enviando = true;
    clearTimeout(reenvioAgendado);

    while (fila.length > 0) {
      try {
        const resp = await fetch(`${API_BASE}/api/eventos`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(fila[0]),
        });
        // 4xx = evento rejeitado pela validação: reenviar não adianta, descarta
        if (resp.ok || (resp.status >= 400 && resp.status < 500)) {
          if (!resp.ok) console.warn("Evento do Arduino rejeitado pelo servidor:", fila[0]);
          fila.shift();
          continue;
        }
        throw new Error(`HTTP ${resp.status}`);
      } catch (err) {
        console.warn("Servidor indisponível; o evento será reenviado:", err.message);
        reenvioAgendado = setTimeout(enviarFila, INTERVALO_REENVIO_MS);
        break;
      }
    }

    enviando = false;
    if (porta) statusConectado();
  }
})();
