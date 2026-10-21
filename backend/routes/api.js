// ─────────────────────────────────────────────────────────
// routes/api.js — Endpoints REST consumidos pelo site (frontend)
// e, opcionalmente, por qualquer cliente HTTP (Postman, curl, ESP futuramente).
// ─────────────────────────────────────────────────────────

const express = require("express");
const db = require("../db");

/**
 * Recebe a instância do Socket.IO para poder emitir eventos em
 * tempo real sempre que um novo registro é criado pela API HTTP
 * (além dos registros que já chegam pela porta Serial do Arduino).
 */
module.exports = function criarRotasApi(io) {
  const router = express.Router();

  // GET /api/resumo — números do dashboard (total no curral, hoje, alertas...)
  router.get("/resumo", (req, res) => {
    res.json(db.obterResumo());
  });

  // GET /api/baias — lista simples das baias cadastradas
  router.get("/baias", (req, res) => {
    res.json(db.listarBaias());
  });

  // GET /api/eventos — histórico com filtros (?baia=A&tipo=entrada&de=2026-08-01&ate=2026-08-09&limit=50&offset=0)
  router.get("/eventos", (req, res) => {
    const { baia, tipo, de, ate, limit, offset } = req.query;
    const resultado = db.listarEventos({ baia, tipo, de, ate, limit, offset });
    res.json(resultado);
  });

  // GET /api/eventos/exportar — baixa um CSV com o histórico filtrado
  router.get("/eventos/exportar", (req, res) => {
    const { baia, tipo, de, ate } = req.query;
    const csv = db.exportarEventosCsv({ baia, tipo, de, ate });
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="eventos_suinotech_${Date.now()}.csv"`
    );
    res.send(csv);
  });

  // POST /api/eventos — cria um evento manualmente
  // Útil para: testar sem o Arduino, o botão "Simular evento" do painel,
  // ou uma futura versão com ESP8266/ESP32 enviando via WiFi/HTTP.
  // Body esperado: { "baia": "A", "tipo": "entrada", "origem": "manual" }
  router.post("/eventos", (req, res) => {
    const { baia, tipo, origem } = req.body || {};

    if (!baia || !db.baiaExiste(baia)) {
      return res.status(400).json({
        erro: `Baia inválida. Use uma destas: ${db.BAIAS_VALIDAS.join(", ")}`,
      });
    }
    if (tipo !== "entrada" && tipo !== "saida") {
      return res.status(400).json({ erro: "Tipo inválido. Use 'entrada' ou 'saida'." });
    }

    const evento = db.inserirEvento({ baia, tipo, origem: origem || "manual" });
    const resumo = db.obterResumo();

    io.emit("novo-evento", { evento, resumo });

    res.status(201).json({ evento, resumo });
  });

  return router;
};
