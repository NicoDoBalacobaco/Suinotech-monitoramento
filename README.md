# SuinoTech — Sistema de Monitoramento de Suínos

Protótipo de TCC: um Arduino simula sensores de entrada/saída em baias
(currais), e um site mostra os dados em tempo real — dashboard ao vivo,
histórico completo e exportação de relatórios.

```
 [ Botões/Sensores IR ]  →  [ Arduino Uno/Nano ]  →  USB Serial
                                                          │
                                                          ▼
                              [ Navegador (Chrome/Edge) — Web Serial API ]
                                                          │
                                        POST /api/eventos │  WebSocket
                                                          ▼
                                          [ Backend Node.js (JSON) ]
                                                          │
                                                          ▼
                                          [ Site (Dashboard + Histórico) ]
```

A conexão com o Arduino é feita **direto pelo navegador**, sem precisar
instalar nada extra nem configurar porta COM em arquivo nenhum — só
clicar num botão no site.

## Estrutura do projeto

```
suinotech-monitoramento/
├── hardware/     → Sketch do Arduino (C/C++) + guia de montagem
├── backend/      → Servidor Node.js (API + WebSocket)
├── frontend/     → Site (HTML, CSS, JavaScript) — inclui a conexão com o Arduino
└── README.md     → este arquivo
```

Cada pasta representa uma "linguagem"/camada separada, prontas para abrir
no VSCode:

- **hardware/** → C/C++ (Arduino)
- **backend/** → JavaScript (Node.js)
- **frontend/** → HTML, CSS e JavaScript

## Passo a passo rápido

### 1. Hardware
Siga `hardware/README.md` para montar os botões/sensores e gravar o
sketch `hardware/arduino_uno_serial/arduino_uno_serial.ino` no Arduino.

### 2. Backend (site + dados)
```bash
cd backend
npm install
cp .env.example .env
npm start
```

Abra **http://localhost:3000** no **Chrome ou Edge** — o site já é
servido pelo próprio backend.

### 3. Conectar o Arduino
Na seção Dashboard do site, clique em **"🔌 Conectar Arduino (USB)"** e
escolha a porta do Arduino na janela que o navegador mostrar. Pronto.

> Ainda não montou o hardware? Use os botões "Simular Entrada/Saída" no
> dashboard, ou rode `npm run simulate` em outro terminal — o site
> funciona 100% sem o Arduino conectado, só não recebe dados reais.

### 4. Frontend
Não precisa rodar nada à parte — o `backend` já serve os arquivos de
`frontend/` (HTML/CSS/JS). Se quiser só editar o visual, os arquivos
estão em:
- `frontend/index.html` — página institucional do TCC + Dashboard ao vivo
- `frontend/historico.html` — histórico completo, filtros e exportação CSV
- `frontend/css/style.css` — todo o estilo visual (tema "Campo": bege, verde-oliva e lima)
- `frontend/js/arduino-serial.js` — conexão com o Arduino via USB (Web Serial API)
- `frontend/js/dashboard.js` — liga o Dashboard aos dados reais
- `frontend/js/historico.js` — liga a tabela de histórico aos dados reais
- `frontend/js/main.js` — tema, menu, acordeão, abas e contadores (não mexe em dados)
- `frontend/js/motion.js` — rolagem suave (Lenis), textos e fotos animados (GSAP), rastro de pixels no topo
- `frontend/js/suino3d.js` + `frontend/js/suino3d/anatomia.js` — suíno 3D (Three.js) com os sensores em volta
- `frontend/assets/img/` — fotos (Wikimedia Commons, domínio público/CC0)

> O suíno 3D, as fontes e as bibliotecas de animação vêm de CDN: na
> apresentação, deixe o computador com internet. Sem internet, o site
> continua funcionando e o topo mostra uma foto no lugar do modelo 3D.
> As leituras biométricas do suíno (temperatura, peso, respiração…) são
> demonstrativas; a contagem do curral vem do Arduino de verdade.

## O que o site já entrega (conforme especificado no TCC)

- ✅ Dashboard em tempo real (WebSocket) com gráficos e contadores
- ✅ Total no curral, entradas hoje, saídas hoje
- ✅ Registro de entradas/saídas com data, hora e tipo de evento
- ✅ Visualização do total de suínos por baia
- ✅ Histórico completo com filtros (baia, tipo, período) e paginação
- ✅ Exportação de relatórios em CSV
- ✅ Alertas automáticos quando uma baia se aproxima/atinge a capacidade
- ✅ Conexão com o Arduino sem instalar nada extra (Web Serial API)

## Stack utilizada

| Camada | Tecnologia |
|---|---|
| Hardware | Arduino Uno/Nano (C/C++), botões ou sensores IR |
| Comunicação com o Arduino | Web Serial API, direto no navegador (Chrome/Edge) |
| Backend | Node.js + Express + Socket.IO |
| Armazenamento | Arquivo JSON (veja `backend/database/ESTRUTURA-DE-DADOS.md`) |
| Frontend | HTML + CSS + JavaScript puro (sem framework) |

## Por que não usei SQLite/serialport (bibliotecas nativas)?

Elas exigem compilar código C++ na instalação (`node-gyp`), o que trava
muita gente no Windows sem o Visual Studio Build Tools instalado. Troquei
por um arquivo JSON (backend) + Web Serial API (navegador) — zero
dependência nativa, `npm install` funciona de primeira em qualquer
computador, e a conexão com o Arduino fica ainda mais simples (não
precisa nem saber o nome da porta COM, o navegador mostra a lista).

## Testado neste ambiente

Backend instalado e testado do zero (sem nenhum aviso de compilação
nativa), API REST validada (inserção/listagem/filtro de eventos,
exportação CSV, resumo do dashboard) e arquivos estáticos servidos
corretamente. Falta só você conectar o Arduino físico pelo botão do site.
