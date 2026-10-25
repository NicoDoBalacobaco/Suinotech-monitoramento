// ─────────────────────────────────────────────────────────
// test/api.test.js — Testes automatizados da API e das regras de negócio
//
// Rodar:  npm test
//
// Sobe o servidor de verdade numa porta livre, com os dados num arquivo
// temporário (variável SUINOTECH_DADOS), e confere cada regra do TCC
// fazendo requisições HTTP — o mesmo caminho que o navegador usa.
// Usa só o que já vem no Node.js (node:test), sem dependência extra.
// ─────────────────────────────────────────────────────────

const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

// Precisa ser definido ANTES de carregar o db.js
const pastaTemp = fs.mkdtempSync(path.join(os.tmpdir(), "suinotech-teste-"));
process.env.SUINOTECH_DADOS = path.join(pastaTemp, "dados.json");

const { criarServidor } = require("../server");

let servidor;
let base;

before(async () => {
  servidor = criarServidor();
  await new Promise((ok) => servidor.listen(0, ok));
  base = `http://localhost:${servidor.address().port}/api`;
});

after(async () => {
  await new Promise((ok) => servidor.close(ok));
  fs.rmSync(pastaTemp, { recursive: true, force: true });
});

// ── Ajudantes ──

async function postar(corpo) {
  const resp = await fetch(`${base}/eventos`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: typeof corpo === "string" ? corpo : JSON.stringify(corpo),
  });
  return { status: resp.status, corpo: await resp.json() };
}

async function obter(rota) {
  const resp = await fetch(`${base}${rota}`);
  return { status: resp.status, corpo: await resp.json() };
}

async function registrar(baia, tipo, vezes = 1) {
  for (let i = 0; i < vezes; i++) {
    const r = await postar({ baia, tipo, origem: "manual" });
    assert.equal(r.status, 201);
  }
}

async function saldo(baia) {
  const { corpo } = await obter("/resumo");
  return corpo.baias.find((b) => b.nome === baia).totalAtual;
}

// ── Regras de negócio ──

test("RF02: evento registrado com id, baia, tipo, data/hora e origem", async () => {
  const { status, corpo } = await postar({ baia: "a", tipo: "entrada", origem: "demo" });
  assert.equal(status, 201);
  assert.equal(corpo.evento.baia, "A"); // RN03: normalizado para maiúscula
  assert.equal(corpo.evento.tipo, "entrada");
  assert.equal(corpo.evento.origem, "demo");
  assert.match(corpo.evento.timestamp, /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/);
  assert.ok(Number.isInteger(corpo.evento.id));
});

test("RN04 / CT05: três entradas e uma saída na baia B resultam em saldo 2", async () => {
  await registrar("B", "entrada", 3);
  await registrar("B", "saida", 1);
  assert.equal(await saldo("B"), 2);
});

test("RN05 / CT06: saída com a baia vazia não deixa o saldo negativo", async () => {
  await registrar("D", "saida", 1);
  assert.equal(await saldo("D"), 0);
});

test("RN05: saídas com a baia vazia não anulam entradas futuras", async () => {
  // Antes da correção, este caso resultava em 0 em vez de 2
  await registrar("D", "saida", 2);
  await registrar("D", "entrada", 2);
  assert.equal(await saldo("D"), 2);
});

test("RN07 / RN08 / CT07: alerta de atenção em 26/30 e crítico em 30/30", async () => {
  await registrar("C", "entrada", 26);
  let { corpo } = await obter("/resumo");
  assert.equal(corpo.alertas.find((a) => a.baia === "C")?.nivel, "atencao");

  await registrar("C", "entrada", 4);
  ({ corpo } = await obter("/resumo"));
  assert.equal(corpo.alertas.find((a) => a.baia === "C")?.nivel, "critico");
});

test("RN09: totais do dia somam apenas os eventos de hoje", async () => {
  const { corpo } = await obter("/resumo");
  const { corpo: lista } = await obter("/eventos?limit=5000");
  const entradas = lista.eventos.filter((e) => e.tipo === "entrada").length;
  assert.equal(corpo.entradasHoje, entradas);
});

// ── Validação de entrada (RNF06, CT09) ──

test("CT09: rejeita baia inexistente, tipo inválido e origem desconhecida", async () => {
  assert.equal((await postar({ baia: "Z", tipo: "entrada" })).status, 400);
  assert.equal((await postar({ baia: ["A"], tipo: "entrada" })).status, 400);
  assert.equal((await postar({ baia: "A", tipo: "talvez" })).status, 400);
  assert.equal((await postar({ baia: "A", tipo: "entrada", origem: "<img src=x>" })).status, 400);
});

test("rejeita JSON malformado e corpo grande demais", async () => {
  assert.equal((await postar("{ isto não é json")).status, 400);
  const enorme = { baia: "A", tipo: "entrada", origem: "x".repeat(20000) };
  assert.equal((await postar(enorme)).status, 400);
});

test("sem origem informada, o evento é registrado como 'manual'", async () => {
  const { corpo } = await postar({ baia: "A", tipo: "saida" });
  assert.equal(corpo.evento.origem, "manual");
});

// ── Histórico e exportação (RF07, RF08, RF09) ──

test("CT10: filtros por baia e tipo devolvem só os registros correspondentes", async () => {
  const { corpo } = await obter("/eventos?baia=B&tipo=entrada&limit=5000");
  assert.equal(corpo.total, 3);
  assert.ok(corpo.eventos.every((e) => e.baia === "B" && e.tipo === "entrada"));
});

test("RF07: histórico ordenado do mais recente para o mais antigo", async () => {
  const { corpo } = await obter("/eventos?limit=5000");
  const ids = corpo.eventos.map((e) => e.id);
  assert.deepEqual(ids, [...ids].sort((a, b) => b - a));
});

test("paginação inválida devolve erro 400 em vez de lista vazia", async () => {
  assert.equal((await obter("/eventos?limit=abc")).status, 400);
  assert.equal((await obter("/eventos?offset=-2")).status, 400);
  assert.equal((await obter("/eventos?de=09/08/2026")).status, 400);
});

test("CT11: CSV exportado tem as mesmas linhas do histórico filtrado", async () => {
  const resp = await fetch(`${base}/eventos/exportar?baia=B`);
  const csv = await resp.text();
  const linhas = csv.replace(/^﻿/, "").trim().split("\r\n");

  assert.equal(linhas[0], "id;baia;tipo;timestamp;origem");
  const { corpo } = await obter("/eventos?baia=B&limit=5000");
  assert.equal(linhas.length - 1, corpo.total);
});
