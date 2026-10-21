// ─────────────────────────────────────────────────────────
// db.js — Camada de acesso aos dados
//
// Guarda tudo num arquivo JSON simples (database/dados.json) em vez
// de um banco "de verdade" como SQLite/MySQL. Motivo: bibliotecas de
// banco de dados no Node normalmente precisam compilar um pedacinho
// de código C++ na hora do "npm install" (via node-gyp), o que exige
// instalar ferramentas pesadas (Visual Studio Build Tools no Windows,
// Xcode no Mac...). Isso trava muita gente logo no início do projeto.
//
// Como este é um protótipo de TCC (poucos eventos, um usuário por vez),
// um arquivo JSON dá conta do recado com zero dependências nativas —
// o "npm install" fica rápido e funciona em qualquer computador.
//
// As funções abaixo têm exatamente a mesma assinatura que teriam com
// um banco relacional de verdade, então trocar por SQLite/MySQL no
// futuro (ex: se o volume de dados crescer muito) significa só reescrever
// este arquivo — o resto do backend (routes/api.js) não muda nada.
// ─────────────────────────────────────────────────────────

const fs = require("fs");
const path = require("path");

const ARQUIVO_DADOS = path.join(__dirname, "database", "dados.json");

const BAIAS_PADRAO = [
  { nome: "A", capacidade: 30 },
  { nome: "B", capacidade: 30 },
  { nome: "C", capacidade: 30 },
  { nome: "D", capacidade: 30 },
];

// ── Carrega/cria o arquivo de dados ──
function carregarDados() {
  if (!fs.existsSync(ARQUIVO_DADOS)) {
    const inicial = { baias: BAIAS_PADRAO, eventos: [], proximoId: 1 };
    fs.mkdirSync(path.dirname(ARQUIVO_DADOS), { recursive: true });
    fs.writeFileSync(ARQUIVO_DADOS, JSON.stringify(inicial, null, 2));
    return inicial;
  }
  const conteudo = fs.readFileSync(ARQUIVO_DADOS, "utf-8");
  return JSON.parse(conteudo);
}

function salvarDados(dadosAtuais) {
  fs.writeFileSync(ARQUIVO_DADOS, JSON.stringify(dadosAtuais, null, 2));
}

// Carrega uma vez em memória; toda escrita atualiza a memória E o arquivo.
let dados = carregarDados();

const BAIAS_VALIDAS = dados.baias.map((b) => b.nome);

function baiaExiste(nome) {
  return BAIAS_VALIDAS.includes(String(nome).toUpperCase());
}

/** "2026-08-09 20:35:39" — formato usado em todo o projeto (hora local). */
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

/** Insere um novo evento (entrada/saída) e devolve o registro criado. */
function inserirEvento({ baia, tipo, origem = "arduino" }) {
  baia = String(baia).toUpperCase();
  const evento = {
    id: dados.proximoId++,
    baia,
    tipo,
    timestamp: formatarAgora(),
    origem,
  };
  dados.eventos.push(evento);
  salvarDados(dados);
  return evento;
}

/** Lista eventos com filtros opcionais + paginação simples. */
function listarEventos({ baia, tipo, de, ate, limit = 50, offset = 0 } = {}) {
  let resultado = dados.eventos;

  if (baia) {
    const baiaUpper = String(baia).toUpperCase();
    resultado = resultado.filter((e) => e.baia === baiaUpper);
  }
  if (tipo) {
    resultado = resultado.filter((e) => e.tipo === tipo);
  }
  if (de) {
    resultado = resultado.filter((e) => dataDoTimestamp(e.timestamp) >= de);
  }
  if (ate) {
    resultado = resultado.filter((e) => dataDoTimestamp(e.timestamp) <= ate);
  }

  // Mais recentes primeiro
  resultado = [...resultado].sort((a, b) => {
    if (a.timestamp === b.timestamp) return b.id - a.id;
    return a.timestamp < b.timestamp ? 1 : -1;
  });

  const total = resultado.length;
  const pagina = resultado.slice(Number(offset), Number(offset) + Number(limit));

  return { eventos: pagina, total };
}

/** Total atual dentro de uma baia = entradas - saídas (nunca negativo). */
function totalAtualPorBaia(nomeBaia) {
  let entradas = 0;
  let saidas = 0;
  for (const e of dados.eventos) {
    if (e.baia !== nomeBaia) continue;
    if (e.tipo === "entrada") entradas++;
    else if (e.tipo === "saida") saidas++;
  }
  return Math.max(entradas - saidas, 0);
}

/** Contagem de eventos de hoje (entrada ou saída) para uma baia. */
function contagemHojePorBaia(nomeBaia, tipo) {
  const hoje = hojeStr();
  let total = 0;
  for (const e of dados.eventos) {
    if (e.baia === nomeBaia && e.tipo === tipo && dataDoTimestamp(e.timestamp) === hoje) {
      total++;
    }
  }
  return total;
}

/** Lista as baias cadastradas. */
function listarBaias() {
  return dados.baias;
}

/** Monta o resumo completo usado pelo dashboard em tempo real. */
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

    const ocupacao = capacidade > 0 ? totalAtual / capacidade : 0;
    if (ocupacao >= 1) {
      alertas.push({
        baia: nome,
        nivel: "critico",
        mensagem: `Baia ${nome} atingiu a capacidade máxima (${totalAtual}/${capacidade}).`,
      });
    } else if (ocupacao >= 0.85) {
      alertas.push({
        baia: nome,
        nivel: "atencao",
        mensagem: `Baia ${nome} próxima da capacidade máxima (${totalAtual}/${capacidade}).`,
      });
    }

    return { nome, capacidade, totalAtual, entradasHoje: eHoje, saidasHoje: sHoje };
  });

  const ultimoEvento =
    dados.eventos.length > 0 ? dados.eventos[dados.eventos.length - 1] : null;

  return {
    totalNoCurral,
    entradasHoje,
    saidasHoje,
    baias: resumoBaias,
    alertas,
    ultimoEvento,
    atualizadoEm: new Date().toISOString(),
  };
}

/** Gera o conteúdo CSV completo (respeitando os mesmos filtros da listagem). */
function exportarEventosCsv(filtros = {}) {
  const { eventos } = listarEventos({ ...filtros, limit: 1_000_000, offset: 0 });
  const linhas = ["id,baia,tipo,timestamp,origem"];
  for (const e of eventos) {
    linhas.push(`${e.id},${e.baia},${e.tipo},${e.timestamp},${e.origem}`);
  }
  return linhas.join("\n");
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
