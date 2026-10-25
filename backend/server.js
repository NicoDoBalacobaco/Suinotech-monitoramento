// ─────────────────────────────────────────────────────────
// server.js — Ponto de entrada do backend SuinoTech
//
// Um único processo faz 3 coisas (requisito RNF07):
//  1) Serve o site (pasta ../frontend) como arquivos estáticos
//  2) Expõe a API REST (rotas em routes/api.js)
//  3) Mantém o WebSocket (Socket.IO) que empurra cada evento novo
//     para todos os navegadores abertos, em tempo real
//
// A leitura do Arduino (USB) acontece no navegador, via Web Serial API
// (veja frontend/js/arduino-serial.js). O backend só recebe os eventos
// já prontos por POST /api/eventos — por isso não precisa de nenhuma
// biblioteca nativa de porta serial (requisito RNF04).
// ─────────────────────────────────────────────────────────

require("dotenv").config();
const path = require("path");
const http = require("http");
const express = require("express");
const cors = require("cors");
const { Server } = require("socket.io");

const criarRotasApi = require("./routes/api");
const db = require("./db");

const FRONTEND_DIR = path.join(__dirname, "..", "frontend");

/**
 * Monta o servidor HTTP + Socket.IO sem colocá-lo para escutar.
 * Separado do listen() para que os testes automatizados possam subir
 * o servidor numa porta livre qualquer.
 */
function criarServidor() {
  const app = express();
  const server = http.createServer(app);

  // CORS aberto de propósito: o sistema roda na rede local da granja
  // (RNF02) e não tem login — limitação registrada no TCC (subseção 6.10).
  const io = new Server(server, { cors: { origin: "*" } });

  app.use(cors());
  app.use(express.json({ limit: "10kb" })); // um evento tem poucos bytes

  // Site estático (index.html, historico.html, css/, js/...).
  // O cliente do Socket.IO é servido pelo próprio Socket.IO em
  // /socket.io/socket.io.js — assim o tempo real funciona sem internet.
  app.use(express.static(FRONTEND_DIR));

  app.use("/api", criarRotasApi(io));

  // JSON malformado ou corpo grande demais → 400 com mensagem clara
  app.use((erro, req, res, next) => {
    if (erro.type === "entity.parse.failed" || erro.type === "entity.too.large") {
      return res.status(400).json({ erro: "Corpo da requisição inválido." });
    }
    next(erro);
  });

  io.on("connection", (socket) => {
    console.log(`[socket] cliente conectado (${socket.id})`);
    // Manda o estado atual na hora, para a tela não ficar vazia até o próximo evento
    socket.emit("resumo-inicial", db.obterResumo());
    socket.on("disconnect", () => console.log(`[socket] cliente desconectado (${socket.id})`));
  });

  return server;
}

// Só escuta a porta quando executado direto (npm start), não quando importado
if (require.main === module) {
  const PORT = process.env.PORT || 3000;
  criarServidor().listen(PORT, () => {
    console.log("─────────────────────────────────────────────");
    console.log(`  SuinoTech rodando em  http://localhost:${PORT}`);
    console.log(`  Painel ao vivo:       http://localhost:${PORT}/#dashboard`);
    console.log(`  Histórico/relatórios: http://localhost:${PORT}/historico.html`);
    console.log('  Conecte o Arduino pelo botão "Conectar Arduino (USB)" no site (Chrome/Edge).');
    console.log("─────────────────────────────────────────────");
  });
}

module.exports = { criarServidor };
