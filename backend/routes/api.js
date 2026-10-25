// ─────────────────────────────────────────────────────────
// routes/api.js — Endpoints REST (TCC, Quadro 9)
//
// Consumidos pelo site e, opcionalmente, por qualquer cliente HTTP
// (Postman, curl, um ESP32 no futuro). Toda validação de entrada fica
// aqui, então as regras valem igualmente para o Arduino, para os
// botões de demonstração e para o simulador.
// ─────────────────────────────────────────────────────────

const express = require("express");
const db = require("../db");

const TIPOS_VALIDOS = ["entrada", "saida"]; // RN02
const ORIGENS_VALIDAS = ["arduino", "manual", "demo", "simulador"]; // RN10
const LIMITE_MAXIMO = 5000; // maior página que a API devolve de uma vez
const FORMATO_DATA = /^\d{4}-\d{2}-\d{2}$/; // "2026-08-09"

/**
 * Lê e valida os filtros de consulta (?baia=&tipo=&de=&ate=).
 * Devolve { filtros } se tudo estiver certo, ou { erro } com a mensagem.
 */
function lerFiltros(query) {
  const { baia, tipo, de, ate } = query;

  if (baia !== undefined && !db.baiaExiste(baia)) {
    return { erro: `Baia inválida. Use uma destas: ${db.BAIAS_VALIDAS.join(", ")}` };
  }
  if (tipo !== undefined && !TIPOS_VALIDOS.includes(tipo)) {
    return { erro: "Tipo inválido. Use 'entrada' ou 'saida'." };
  }
  for (const [nome, valor] of [["de", de], ["ate", ate]]) {
    if (valor !== undefined && !FORMATO_DATA.test(valor)) {
      return { erro: `Data '${nome}' inválida. Use o formato AAAA-MM-DD.` };
    }
  }
  return { filtros: { baia, tipo, de, ate } };
}

/** Converte ?limit= e ?offset= em inteiros válidos, ou devolve { erro }. */
function lerPaginacao(query) {
  const limit = query.limit === undefined ? 50 : Number(query.limit);
  const offset = query.offset === undefined ? 0 : Number(query.offset);

  if (!Number.isInteger(limit) || limit < 1 || limit > LIMITE_MAXIMO) {
    return { erro: `'limit' deve ser um número inteiro entre 1 e ${LIMITE_MAXIMO}.` };
  }
  if (!Number.isInteger(offset) || offset < 0) {
    return { erro: "'offset' deve ser um número inteiro maior ou igual a 0." };
  }
  return { limit, offset };
}

/**
 * Recebe a instância do Socket.IO para avisar todos os navegadores
 * conectados sempre que um evento novo é gravado.
 */
module.exports = function criarRotasApi(io) {
  const router = express.Router();

  // GET /api/resumo — números do dashboard (total no curral, hoje, alertas...)
  router.get("/resumo", (req, res) => {
    res.json(db.obterResumo());
  });

  // GET /api/baias — baias cadastradas e suas capacidades
  router.get("/baias", (req, res) => {
    res.json(db.listarBaias());
  });

  // GET /api/eventos — histórico paginado com filtros
  // ex.: ?baia=A&tipo=entrada&de=2026-08-01&ate=2026-08-09&limit=50&offset=0
  router.get("/eventos", (req, res) => {
    const { filtros, erro } = lerFiltros(req.query);
    if (erro) return res.status(400).json({ erro });

    const paginacao = lerPaginacao(req.query);
    if (paginacao.erro) return res.status(400).json({ erro: paginacao.erro });

    res.json(db.listarEventos({ ...filtros, ...paginacao }));
  });

  // GET /api/eventos/exportar — baixa um CSV com o histórico filtrado
  router.get("/eventos/exportar", (req, res) => {
    const { filtros, erro } = lerFiltros(req.query);
    if (erro) return res.status(400).json({ erro });

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="eventos_suinotech_${Date.now()}.csv"`
    );
    res.send(db.exportarEventosCsv(filtros));
  });

  // POST /api/eventos — registra um evento
  // Usado pelo navegador quando o Arduino está conectado, pelos botões
  // "Simular" do painel e pelo simulador (npm run simulate).
  // Body: { "baia": "A", "tipo": "entrada", "origem": "arduino" }
  router.post("/eventos", (req, res) => {
    const { baia, tipo, origem = "manual" } = req.body || {};

    if (!db.baiaExiste(baia)) {
      return res.status(400).json({
        erro: `Baia inválida. Use uma destas: ${db.BAIAS_VALIDAS.join(", ")}`,
      });
    }
    if (!TIPOS_VALIDOS.includes(tipo)) {
      return res.status(400).json({ erro: "Tipo inválido. Use 'entrada' ou 'saida'." });
    }
    if (!ORIGENS_VALIDAS.includes(origem)) {
      return res.status(400).json({
        erro: `Origem inválida. Use uma destas: ${ORIGENS_VALIDAS.join(", ")}`,
      });
    }

    const evento = db.inserirEvento({ baia, tipo, origem });
    const resumo = db.obterResumo();

    // Difunde antes de responder: todas as telas abertas atualizam juntas (RF06)
    io.emit("novo-evento", { evento, resumo });

    res.status(201).json({ evento, resumo });
  });

  return router;
};
