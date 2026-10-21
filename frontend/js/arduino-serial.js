/* ─────────────────────────────────────────────────────────
   arduino-serial.js — Conecta no Arduino DIRETO pelo navegador,
   usando a Web Serial API (nativa do Chrome/Edge). Não depende
   de nenhuma biblioteca nem configuração no backend.

   Como funciona:
   1. Usuário clica em "Conectar Arduino (USB)"
   2. O Chrome mostra a lista de portas USB do computador
   3. Usuário escolhe a porta do Arduino
   4. Este script lê cada linha JSON que o Arduino envia
      (ex: {"baia":"A","evento":"entrada"}) e manda pro backend
      via POST /api/eventos — que já existia e já distribui o
      evento em tempo real pro site inteiro via WebSocket.

   Compatibilidade: Web Serial funciona no Chrome e no Edge
   (desktop). Não funciona no Firefox nem no Safari — nesses
   casos o botão fica desabilitado com um aviso.
   ───────────────────────────────────────────────────────── */
(function () {
  const API_BASE = "";

  const statusDot = document.getElementById("dash-status-dot");
  const statusTexto = document.getElementById("dash-status-texto");
  const btnConectar = document.getElementById("dash-btn-conectar-arduino");

  if (!btnConectar) return; // não está na página do dashboard

  const btnRotulo = btnConectar.querySelector(".btn-label") || btnConectar;

  let porta = null;
  let leitor = null;
  let leituraAtiva = false;

  // estado: "ok" | "erro" | "aviso" | "inativo" — cor e pulso ficam no CSS
  function definirStatus(texto, estado) {
    statusTexto.textContent = texto;
    if (statusDot) statusDot.dataset.estado = estado;
  }

  // ── Navegador sem suporte (Firefox, Safari, celular) ──
  if (!("serial" in navigator)) {
    definirStatus("Navegador sem suporte a USB · use Chrome ou Edge", "erro");
    btnConectar.disabled = true;
    btnConectar.title = "Abra este site no Chrome ou Edge, no computador, para conectar o Arduino.";
    return;
  }

  definirStatus("Arduino não conectado", "inativo");

  async function conectar() {
    try {
      porta = await navigator.serial.requestPort();
      await porta.open({ baudRate: 9600 });

      leituraAtiva = true;
      btnRotulo.textContent = "Desconectar Arduino";
      definirStatus("Arduino conectado (USB)", "ok");

      lerContinuamente();
    } catch (err) {
      // Usuário fechou a janela de seleção sem escolher nada — não é erro de verdade
      if (err.name === "NotFoundError") return;
      console.error("Falha ao conectar no Arduino:", err);
      definirStatus(`Falha ao conectar: ${err.message}`, "erro");
    }
  }

  async function desconectar() {
    leituraAtiva = false;
    try { await leitor?.cancel(); } catch { /* já estava fechado */ }
    try { await porta?.close(); } catch { /* já estava fechado */ }
    porta = null;
    btnRotulo.textContent = "Conectar Arduino (USB)";
    definirStatus("Arduino não conectado", "inativo");
  }

  btnConectar.addEventListener("click", () => {
    if (porta) {
      desconectar();
    } else {
      conectar();
    }
  });

  async function lerContinuamente() {
    const decoder = new TextDecoderStream();
    const streamFechado = porta.readable.pipeTo(decoder.writable).catch(() => {});
    leitor = decoder.readable.getReader();

    let bufer = "";
    try {
      while (leituraAtiva) {
        const { value, done } = await leitor.read();
        if (done) break;
        bufer += value;

        let indiceQuebra;
        while ((indiceQuebra = bufer.indexOf("\n")) >= 0) {
          const linha = bufer.slice(0, indiceQuebra).trim();
          bufer = bufer.slice(indiceQuebra + 1);
          if (linha) processarLinha(linha);
        }
      }
    } catch (err) {
      console.error("Conexão com o Arduino perdida:", err);
      definirStatus("Conexão perdida — reconecte o cabo USB", "erro");
    } finally {
      try { leitor.releaseLock(); } catch { /* noop */ }
      await streamFechado;
    }
  }

  async function processarLinha(linha) {
    let dados;
    try {
      dados = JSON.parse(linha);
    } catch {
      // O Arduino às vezes manda texto fora do formato JSON (ex: debug) — ignora
      return;
    }

    // Mensagem de handshake enviada pelo sketch ao ligar: {"status":"pronto"}
    if (dados.status) return;

    const { baia, evento } = dados;
    if (!baia || (evento !== "entrada" && evento !== "saida")) return;

    try {
      await fetch(`${API_BASE}/api/eventos`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ baia, tipo: evento, origem: "arduino" }),
      });
    } catch (err) {
      console.error("Falha ao enviar evento do Arduino para o servidor:", err);
    }
  }

  // Se o usuário desconectar o cabo USB fisicamente, o navegador avisa aqui
  navigator.serial.addEventListener("disconnect", (evento) => {
    if (porta && evento.target === porta) {
      desconectar();
      definirStatus("Cabo USB desconectado", "aviso");
    }
  });
})();
