# SuinoTech — Sistema de Monitoramento de Suínos

Protótipo de TCC (Etec Professor Edson Galvão · Técnico em Desenvolvimento
de Sistemas · 2026): **rastreamento de entradas e saídas de suínos com
Arduino e aplicação web**. Um Arduino lê dois sensores na porteira de cada
baia — a ordem em que são cortados diz se o suíno entrou ou saiu — e o site
mostra os dados em tempo real — painel ao vivo,
histórico completo e exportação de relatórios.

```
 [ Botões / sensores IR ]  →  [ Arduino Uno/Nano ]  →  USB serial (JSON)
                                                          │
                                                          ▼
                              [ Navegador (Chrome/Edge) — Web Serial API ]
                                                          │
                                        POST /api/eventos │  WebSocket
                                                          ▼
                                       [ Servidor Node.js + arquivo JSON ]
                                                          │
                                                          ▼
                                       [ Site: painel ao vivo + histórico ]
```

A conexão com o Arduino é feita **direto pelo navegador**, sem instalar
nada extra nem configurar porta COM — só clicar num botão no site. Tudo
roda na rede local, **sem depender de internet**.

## Estrutura do projeto

```
suinotech-monitoramento/
├── hardware/   → sketch do Arduino (C++) + guia de montagem
├── backend/    → servidor Node.js (API REST + WebSocket + testes)
├── frontend/   → site (HTML, CSS, JavaScript), servido pelo backend
├── docs/       → guia rápido para o dia da apresentação
└── README.md   → este arquivo
```

## Passo a passo rápido

**1. Hardware** — siga `hardware/README.md` para montar os botões/sensores
e gravar `hardware/arduino_uno_serial/arduino_uno_serial.ino`.

**2. Servidor (site + dados)** — requer [Node.js](https://nodejs.org) 18+:

```bash
cd backend
npm install
cp .env.example .env
npm start
```

Abra **http://localhost:3000** no **Chrome ou Edge**.

**3. Conectar o Arduino** — na seção Painel, clique em
**"Conectar Arduino (USB)"** e escolha a porta do Arduino.

> Sem o hardware? Use os botões "Simular entrada/saída" do painel ou rode
> `npm run simulate` em outro terminal. O site funciona normalmente sem o
> Arduino; só não recebe dados reais.

**4. Testes automatizados** — `npm test` (na pasta `backend`) confere as
regras de negócio e a API.

## O que o sistema entrega (requisitos do TCC)

- ✅ Painel em tempo real (WebSocket): total no curral, entradas e saídas do dia
- ✅ Ocupação de cada baia com alertas em 85% (atenção) e 100% (crítico)
- ✅ Registro de cada evento com id, baia, tipo, data, hora e origem
- ✅ Histórico com filtros (baia, tipo, período) e paginação
- ✅ Exportação em CSV (abre direto no Excel em português)
- ✅ Conexão com o Arduino sem instalar nada (Web Serial API)
- ✅ Funciona sem internet (o modelo 3D e as animações são opcionais)

> As leituras biométricas do suíno 3D no topo do site (temperatura, peso,
> respiração…) são **ilustrativas** de versões futuras. A contagem das
> baias é a única medição real do protótipo.

## Stack

| Camada | Tecnologia |
|---|---|
| Física | Arduino Uno/Nano (C++), 2 sensores IR por porteira (ou botões na bancada) |
| Comunicação | USB serial 9600 baud · Web Serial API (Chrome/Edge) |
| Servidor | Node.js + Express + Socket.IO |
| Persistência | Arquivo JSON (veja `backend/database/ESTRUTURA-DE-DADOS.md`) |
| Interface | HTML + CSS + JavaScript, sem framework · Three.js, GSAP e Lenis (opcionais, via CDN) |

Nenhuma dependência exige compilar código nativo: o `npm install` funciona
de primeira em qualquer computador. O motivo dessa escolha está explicado
em `backend/database/ESTRUTURA-DE-DADOS.md`.

## Limitações conhecidas

As mesmas registradas no TCC (subseção 6.10): não há identificação
individual dos animais, o Arduino precisa ficar no cabo USB, a captura
depende do navegador aberto, a persistência é um arquivo único e não há
login. **Não publique o servidor na internet aberta**: qualquer pessoa com
acesso poderia registrar eventos.

## Licença

Código aberto sob a licença MIT — veja `LICENSE`.
