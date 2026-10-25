# Backend — SuinoTech

Node.js + Express + Socket.IO. Um único processo faz 3 coisas:

1. Serve o site (pasta `../frontend`) em `http://localhost:3000`
2. Expõe a API REST (`/api/...`)
3. Distribui cada evento novo, em tempo real, para todas as telas abertas
   (WebSocket)

A leitura do Arduino (USB) acontece **no navegador** (Chrome ou Edge),
pela Web Serial API. Por isso o backend só tem pacotes JavaScript puros —
sem dependência nativa nem compilação na instalação.

## Instalar, configurar e rodar

Requer [Node.js](https://nodejs.org) 18 ou mais recente.

```bash
cd backend
npm install
cp .env.example .env   # por padrão o site sobe na porta 3000
npm start
```

Acesse **http://localhost:3000** no Chrome ou Edge.

| Comando | O que faz |
|---|---|
| `npm start` | Sobe o servidor |
| `npm run dev` | Sobe o servidor e reinicia sozinho ao salvar um arquivo |
| `npm run simulate` | Gera eventos falsos a cada 2–5 s (com o servidor já rodando) |
| `npm test` | Roda os testes automatizados (não mexe nos dados reais) |

## Estrutura

```
backend/
├── server.js         # Ponto de entrada: Express + Socket.IO + arquivos estáticos
├── db.js             # Único módulo que acessa os dados + regras de negócio
├── simulator.js      # Gera eventos falsos para teste/demonstração
├── routes/
│   └── api.js        # Rotas REST e validação das requisições
├── test/
│   └── api.test.js   # Testes automatizados (node:test)
└── database/
    ├── ESTRUTURA-DE-DADOS.md  # Formato dos dados e por que JSON
    └── dados.json             # Criado automaticamente na primeira execução
```

## API REST

| Método | Rota | Descrição |
|---|---|---|
| GET | `/api/resumo` | Números do painel: total no curral, entradas/saídas de hoje, alertas, último evento |
| GET | `/api/baias` | Baias cadastradas e suas capacidades |
| GET | `/api/eventos` | Histórico paginado. Filtros: `?baia=A&tipo=entrada&de=2026-08-01&ate=2026-08-09&limit=50&offset=0` |
| GET | `/api/eventos/exportar` | Baixa um CSV do histórico (mesmos filtros) |
| POST | `/api/eventos` | Registra um evento. Body: `{ "baia": "A", "tipo": "entrada", "origem": "manual" }` |

Validações (respondem `400` com uma mensagem explicando o erro):

- `baia`: uma das cadastradas (A, B, C, D) — maiúscula ou minúscula
- `tipo`: `entrada` ou `saida`
- `origem` (opcional, padrão `manual`): `arduino`, `manual`, `demo` ou `simulador`
- `de` / `ate`: datas no formato `AAAA-MM-DD`
- `limit`: inteiro de 1 a 5000 · `offset`: inteiro ≥ 0

O CSV usa `;` como separador e UTF-8 com BOM, que é o formato que o Excel
em português abre direto em colunas.

## WebSocket (Socket.IO)

| Evento (servidor → navegador) | Quando acontece |
|---|---|
| `resumo-inicial` | Assim que o navegador conecta |
| `novo-evento` | Toda vez que um evento novo é gravado (leva o resumo já recalculado) |

O cliente do Socket.IO é servido pelo próprio servidor em
`/socket.io/socket.io.js`, então o tempo real funciona sem internet.
