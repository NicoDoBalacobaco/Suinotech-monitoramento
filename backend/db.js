// ─────────────────────────────────────────────────────────
// db.js — Camada de acesso aos dados (persistência)
//
// Guarda tudo num arquivo JSON simples (database/dados.json) em vez
// de um banco "de verdade" como SQLite/MySQL — o motivo está em
// database/ESTRUTURA-DE-DADOS.md (resumo: zero dependência nativa).
//
// Este é o ÚNICO módulo que toca no armazenamento (requisito RNF08):
// as funções exportadas têm a mesma assinatura que teriam com um banco
// relacional, então trocar o mecanismo significa reescrever só este
// arquivo — routes/api.js e server.js não mudam.
//
// Regras de negócio implementadas aqui (numeração do TCC, Quadro 7):
//   RN01  só existem as baias cadastradas (A, B, C, D)
//   RN03  o nome da baia é normalizado para maiúscula
//   RN04  saldo da baia = entradas − saídas
//   RN05  o saldo nunca fica negativo
//   RN06  capacidade padrão de 30 animais por baia
//   RN07  ocupação ≥ 85% e < 100% → alerta de atenção
//   RN08  ocupação ≥ 100%         → alerta crítico
//   RN09  "hoje" = data corrente do servidor
// ─────────────────────────────────────────────────────────

const fs = require("fs");
const path = require("path");

// O caminho pode ser trocado por variável de ambiente — os testes
// automatizados usam isso para gravar num arquivo temporário e não
// mexer nos dados reais.
const ARQUIVO_DADOS =
  process.env.SUINOTECH_DADOS || path.join(__dirname, "database", "dados.json");

const BAIAS_PADRAO = [
  { nome: "A", capacidade: 30 },
  { nome: "B", capacidade: 30 },
  { nome: "C", capacidade: 30 },
  { nome: "D", capacidade: 30 },
];

const LIMIAR_ATENCAO = 0.85; // RN07
const LIMIAR_CRITICO = 1; // RN08

// ── Leitura e gravação do arquivo ──

function dadosIniciais() {
  return { baias: BAIAS_PADRAO.map((b) => ({ ...b })), eventos: [], proximoId: 1 };
}

/**
 * Grava de forma atômica: escreve num arquivo temporário e só depois
 * o renomeia por cima do original. Se o computador desligar no meio da
 * gravação, o dados.json antigo continua inteiro (no pior caso, perde-se
 * só o último evento, nunca o arquivo todo).
 */
function salvarDados(dadosAtuais) {
  const temporario = `${ARQUIVO_DADOS}.tmp`;
  fs.writeFileSync(temporario, JSON.stringify(dadosAtuais, null, 2));
  fs.renameSync(temporario, ARQUIVO_DADOS);
}

/**
 * Carrega o arquivo de dados ou cria um novo na primeira execução.
 * Se o arquivo existir mas estiver corrompido (JSON inválido), ele é
 * preservado com outro nome para análise e o sistema recomeça vazio —
 * assim o servidor nunca deixa de subir por causa de um arquivo ruim.
 */
function carregarDados() {
  fs.mkdirSync(path.dirname(ARQUIVO_DADOS), { recursive: true });

  if (!fs.existsSync(ARQUIVO_DADOS)) {
    const inicial = dadosIniciais();
    salvarDados(inicial);
    return inicial;
  }

  try {
    return JSON.parse(fs.readFileSync(ARQUIVO_DADOS, "utf-8"));
  } catch (erro) {
    const copia = ARQUIVO_DADOS.replace(/\.json$/, `.corrompido-${Date.now()}.json`);
    fs.renameSync(ARQUIVO_DADOS, copia);
    console.error(`[db] ${path.basename(ARQUIVO_DADOS)} estava corrompido (${erro.message}).`);
    console.error(`[db] Uma cópia foi guardada em ${copia} e um arquivo novo foi criado.`);
    const inicial = dadosIniciais();
    salvarDados(inicial);
    return inicial;
  }
}

// Carrega uma vez em memória; toda escrita atualiza a memória E o arquivo.
let dados = carregarDados();

const BAIAS_VALIDAS = dados.baias.map((b) => b.nome);

// ── Utilitários de data (formato "2026-08-09 20:35:39", hora local) ──

function formatarAgora() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

function dataDoTimestamp(timestamp) {
  return timestamp.slice(0, 10); // "2026-08-09 20:35:39" -> "2026-08-09"
}

function hojeStr() {
  return dataDoTimestamp(formatarAgora());
}

// ── Operações ──

/** RN01 + RN03: a baia existe? (aceita minúscula) */
function baiaExiste(nome) {
  return typeof nome === "string" && BAIAS_VALIDAS.includes(nome.toUpperCase());
}

/** Insere um novo evento (entrada/saída) e devolve o registro criado (RF02). */
function inserirEvento({ baia, tipo, origem = "arduino" }) {
  const evento = {
    id: dados.proximoId++,
    baia: baia.toUpperCase(), // RN03
    tipo,
    timestamp: formatarAgora(),
    origem,
  };
  dados.eventos.push(evento);
  salvarDados(dados);
  return evento;
}

/** Lista eventos com filtros opcionais + paginação (RF07, RF08). */
function listarEventos({ baia, tipo, de, ate, limit = 50, offset = 0 } = {}) {
  let resultado = dados.eventos;

  if (baia) {
    const baiaUpper = baia.toUpperCase();
    resultado = resultado.filter((e) => e.baia === baiaUpper);
  }
  if (tipo) resultado = resultado.filter((e) => e.tipo === tipo);
  if (de) resultado = resultado.filter((e) => dataDoTimestamp(e.timestamp) >= de);
  if (ate) resultado = resultado.filter((e) => dataDoTimestamp(e.timestamp) <= ate);

  // Mais recentes primeiro (o id desempata eventos do mesmo segundo)
  resultado = [...resultado].sort((a, b) => {
    if (a.timestamp === b.timestamp) return b.id - a.id;
    return a.timestamp < b.timestamp ? 1 : -1;
  });

  return {
    eventos: resultado.slice(offset, offset + limit),
    total: resultado.length,
  };
}

/**
 * RN04 + RN05: saldo atual da baia.
 *
 * Os eventos são percorridos em ordem cronológica e o saldo é limitado
 * a zero A CADA PASSO. Isso importa: uma saída registrada com a baia já
 * vazia (falha de sensor, teste) é simplesmente desconsiderada. Se o
 * piso fosse aplicado só no fim (max(entradas − saídas, 0)), essa saída
 * "fantasma" continuaria descontando das entradas seguintes para sempre
 * — ex.: 3 saídas e depois 2 entradas resultariam em 0 em vez de 2.
 */
function totalAtualPorBaia(nomeBaia) {
  let saldo = 0;
  for (const e of dados.eventos) {
    if (e.baia !== nomeBaia) continue;
    if (e.tipo === "entrada") saldo++;
    else if (e.tipo === "saida") saldo = Math.max(saldo - 1, 0);
  }
  return saldo;
}

/** RN09: quantos eventos de um tipo a baia teve hoje. */
function contagemHojePorBaia(nomeBaia, tipo) {
  const hoje = hojeStr();
  let total = 0;
  for (const e of dados.eventos) {
    if (e.baia === nomeBaia && e.tipo === tipo && dataDoTimestamp(e.timestamp) === hoje) total++;
  }
  return total;
}

/** Lista as baias cadastradas e suas capacidades. */
function listarBaias() {
  return dados.baias;
}

/** Monta o resumo completo usado pelo dashboard em tempo real (RF03–RF05, RF12). */
function obterResumo() {
  let totalNoCurral = 0;
  let entradasHoje = 0;
  let saidasHoje = 0;
  const alertas = [];

  const resumoBaias = dados.baias.map(({ nome, capacidade }) => {
    const totalAtual = totalAtualPorBaia(nome);
    const eHoje = contagemHojePorBaia(nome, "entrada");
    const sHoje = contagemHojePorBaia(nome, "saida");

    totalNoCurral += totalAtual;
    entradasHoje += eHoje;
    saidasHoje += sHoje;

    // RN07 / RN08
    const ocupacao = capacidade > 0 ? totalAtual / capacidade : 0;
    if (ocupacao >= LIMIAR_CRITICO) {
      alertas.push({
        baia: nome,
        nivel: "critico",
        mensagem: `Baia ${nome} atingiu a capacidade máxima (${totalAtual}/${capacidade}).`,
      });
    } else if (ocupacao >= LIMIAR_ATENCAO) {
      alertas.push({
        baia: nome,
        nivel: "atencao",
        mensagem: `Baia ${nome} próxima da capacidade máxima (${totalAtual}/${capacidade}).`,
      });
    }

    return { nome, capacidade, totalAtual, entradasHoje: eHoje, saidasHoje: sHoje };
  });

  return {
    totalNoCurral,
    entradasHoje,
    saidasHoje,
    baias: resumoBaias,
    alertas,
    ultimoEvento: dados.eventos.at(-1) ?? null,
    atualizadoEm: new Date().toISOString(),
  };
}

// ── Exportação CSV (RF09) ──

/**
 * Prepara um valor para uma célula de CSV:
 *  - textos que começam com = + - @ ganham um apóstrofo na frente, para
 *    o Excel não executá-los como fórmula;
 *  - valores com separador, aspas ou quebra de linha vão entre aspas.
 */
function celulaCsv(valor) {
  let texto = String(valor ?? "");
  if (/^[=+\-@]/.test(texto)) texto = `'${texto}`;
  if (/[;"\r\n]/.test(texto)) texto = `"${texto.replace(/"/g, '""')}"`;
  return texto;
}

/**
 * Gera o CSV completo, respeitando os mesmos filtros da listagem — assim o
 * arquivo corresponde exatamente ao que está na tela.
 *
 * Usa ";" como separador e começa com o BOM do UTF-8: é o formato que o
 * Excel em português abre direto em colunas e com acentos corretos.
 */
function exportarEventosCsv(filtros = {}) {
  const { eventos } = listarEventos({ ...filtros, limit: Infinity, offset: 0 });
  const linhas = [["id", "baia", "tipo", "timestamp", "origem"].join(";")];
  for (const e of eventos) {
    linhas.push([e.id, e.baia, e.tipo, e.timestamp, e.origem].map(celulaCsv).join(";"));
  }
  return "﻿" + linhas.join("\r\n");
}

module.exports = {
  baiaExiste,
  BAIAS_VALIDAS,
  listarBaias,
  inserirEvento,
  listarEventos,
  obterResumo,
  exportarEventosCsv,
};
