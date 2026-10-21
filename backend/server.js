// ─────────────────────────────────────────────────────────
// server.js — Ponto de entrada do backend SuinoTech
//
// Faz 3 coisas:
//  1) Serve o site (pasta ../frontend) como arquivos estáticos
//  2) Expõe a API REST (rotas em routes/api.js)
//  3) Abre um WebSocket (Socket.IO) para empurrar eventos novos
//     para o navegador em tempo real
//
// A conexão com o Arduino (USB) acontece direto no navegador,
// via Web Serial API (veja frontend/js/arduino-serial.js) — o
// backend só recebe os eventos já prontos pela API REST comum
// (POST /api/eventos), então não precisa de nenhuma biblioteca
// nativa de porta serial aqui.
// ─────────────────────────────────────────────────────────

require("dotenv").config();
const path = require("path");
const express = require("express");
const cors = require("cors");
const http = require("http");
const { Server } = require("socket.io");

const criarRotasApi = require("./routes/api");
const db = require("./db");

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*" }, // simples de propósito: é um protótipo acadêmico
});

const PORT = process.env.PORT || 3000;
const FRONTEND_DIR = path.join(__dirname, "..", "frontend");

app.use(cors());
app.use(express.json());

// Site estático (index.html, historico.html, css/, js/...)
app.use(express.static(FRONTEND_DIR));

// API
app.use("/api", criarRotasApi(io));

// ── WebSocket ──
io.on("connection", (socket) => {
  console.log(`[socket] cliente conectado (${socket.id})`);
  // Ao conectar, manda o resumo atual imediatamente (evita tela vazia até o próximo evento)
  socket.emit("resumo-inicial", db.obterResumo());

  socket.on("disconnect", () => {
    console.log(`[socket] cliente desconectado (${socket.id})`);
  });
});

server.listen(PORT, () => {
  console.log("─────────────────────────────────────────────");
  console.log(`  SuinoTech rodando em  http://localhost:${PORT}`);
  console.log(`  Painel ao vivo:       http://localhost:${PORT}/#dashboard`);
  console.log(`  Histórico/relatórios: http://localhost:${PORT}/historico.html`);
  console.log("  Conecte o Arduino pelo botão \"Conectar Arduino (USB)\" no site (Chrome/Edge).");
  console.log("─────────────────────────────────────────────");
});
