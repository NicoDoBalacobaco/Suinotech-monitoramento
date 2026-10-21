// ─────────────────────────────────────────────────────────
// simulator.js — Gera eventos falsos de entrada/saída periodicamente
//
// Serve para testar e demonstrar o painel funcionando SEM precisar
// do Arduino físico conectado (ótimo para gravar vídeo de apresentação,
// testar o layout, etc). Rode em paralelo ao servidor:
//
//   Terminal 1:  npm start
//   Terminal 2:  npm run simulate
// ─────────────────────────────────────────────────────────

const http = require("http");

const PORT = process.env.PORT || 3000;
const BAIAS = ["A", "B", "C", "D"];

function enviarEvento() {
  const baia = BAIAS[Math.floor(Math.random() * BAIAS.length)];
  // Um pouco mais de chance de "entrada" do que "saida", só para o
  // total do curral crescer aos poucos, como na vida real.
  const tipo = Math.random() < 0.6 ? "entrada" : "saida";

  const payload = JSON.stringify({ baia, tipo, origem: "simulador" });

  const req = http.request(
    {
      hostname: "localhost",
      port: PORT,
      path: "/api/eventos",
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(payload),
      },
    },
    (res) => {
      if (res.statusCode === 201) {
        console.log(`[simulador] evento enviado -> Baia ${baia} · ${tipo}`);
      } else {
        console.warn(`[simulador] servidor respondeu ${res.statusCode}`);
      }
    }
  );

  req.on("error", (err) =>
    console.error(`[simulador] falha ao conectar no servidor (ele está rodando com "npm start"?): ${err.message}`)
  );

  req.write(payload);
  req.end();
}

console.log("[simulador] iniciado — gerando um evento a cada 2 a 5 segundos. Ctrl+C para parar.");
function agendarProximo() {
  const intervalo = 2000 + Math.random() * 3000;
  setTimeout(() => {
    enviarEvento();
    agendarProximo();
  }, intervalo);
}
agendarProximo();
