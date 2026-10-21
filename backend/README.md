# Backend — SuinoTech

Node.js + Express + Socket.IO. Este servidor faz 3 coisas ao mesmo tempo:

1. Serve o site (pasta `../frontend`) em `http://localhost:3000`
2. Expõe a API REST (`/api/...`)
3. Distribui os eventos novos para todo mundo conectado, em tempo real,
   via WebSocket

A conexão com o Arduino (USB) acontece **direto no navegador** (Chrome
ou Edge), usando a Web Serial API — por isso o backend não tem nenhuma
dependência nativa/compilada: só pacotes JavaScript puros, então o
`npm install` é rápido e funciona em qualquer computador, sem precisar
instalar Visual Studio Build Tools nem nada do tipo.

## 1. Instalar

Requer [Node.js](https://nodejs.org) 18 ou mais recente.

```bash
cd backend
npm install
```

## 2. Configurar

```bash
cp .env.example .env
```

Não tem muito o que configurar — por padrão o site sobe na porta 3000.

## 3. Rodar

```bash
npm start
```

Acesse **http://localhost:3000** no Chrome ou Edge. Na seção Dashboard,
clique em "🔌 Conectar Arduino (USB)" para ligar o hardware de verdade
(veja `hardware/README.md`).

### Sem o Arduino por perto? Use o simulador

Em um segundo terminal, com o servidor já rodando:

```bash
npm run simulate
```

Isso gera eventos de entrada/saída falsos a cada poucos segundos, para
testar e demonstrar o painel funcionando. Os botões "+ Simular Entrada /
Saída" no próprio site fazem a mesma coisa, sob demanda.

## Estrutura

```
backend/
├── server.js         # Ponto de entrada: Express + Socket.IO + arquivos estáticos
├── db.js             # Acesso aos dados (arquivo JSON — veja database/ESTRUTURA-DE-DADOS.md)
├── simulator.js       # Gera eventos falsos para teste/demonstração
├── routes/
│   └── api.js        # Rotas REST (/api/resumo, /api/eventos, ...)
└── database/
    ├── ESTRUTURA-DE-DADOS.md  # Documentação do formato dos dados
    └── dados.json     # Criado automaticamente na primeira execução
```

## API REST

| Método | Rota | Descrição |
|---|---|---|
| GET | `/api/resumo` | Números do dashboard: total no curral, entradas/saídas de hoje, alertas |
| GET | `/api/baias` | Lista as baias cadastradas e suas capacidades |
| GET | `/api/eventos` | Histórico paginado. Filtros: `?baia=A&tipo=entrada&de=2026-08-01&ate=2026-08-09&limit=50&offset=0` |
| GET | `/api/eventos/exportar` | Baixa um CSV do histórico (mesmos filtros acima) |
| POST | `/api/eventos` | Cria um evento. Body: `{ "baia": "A", "tipo": "entrada" }` — é essa rota que o navegador chama sozinho quando o Arduino está conectado |

## WebSocket (Socket.IO)

| Evento (servidor → navegador) | Quando acontece |
|---|---|
| `resumo-inicial` | Assim que o navegador conecta |
| `novo-evento` | Toda vez que um evento novo é gravado |

## Por que não usar SQLite/MySQL de verdade?

Ficou documentado em `database/ESTRUTURA-DE-DADOS.md` — resumindo: bancos
de dados de verdade no Node costumam exigir compilar código nativo na
instalação, o que trava muita gente no Windows sem as ferramentas de
build instaladas. Como o volume de dados de um protótipo é pequeno, um
arquivo JSON dá conta do recado sem esse risco.
