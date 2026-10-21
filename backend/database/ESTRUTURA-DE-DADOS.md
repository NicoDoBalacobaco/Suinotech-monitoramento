# Estrutura dos dados — `database/dados.json`

O backend guarda tudo num único arquivo JSON, criado automaticamente na
primeira vez que o servidor roda. Formato:

```json
{
  "baias": [
    { "nome": "A", "capacidade": 30 },
    { "nome": "B", "capacidade": 30 },
    { "nome": "C", "capacidade": 30 },
    { "nome": "D", "capacidade": 30 }
  ],
  "eventos": [
    { "id": 1, "baia": "A", "tipo": "entrada", "timestamp": "2026-08-09 20:35:39", "origem": "arduino" },
    { "id": 2, "baia": "B", "tipo": "saida",   "timestamp": "2026-08-09 20:36:12", "origem": "manual" }
  ],
  "proximoId": 3
}
```

- **baias** — lista fixa das 4 baias monitoradas e a capacidade máxima de
  cada uma (usada para disparar os alertas de "baia cheia").
- **eventos** — todo entrada/saída registrada, na ordem em que chegou.
  `origem` indica de onde veio: `arduino` (sensor real), `manual` (via
  API/Postman), `demo` (botões de simulação do dashboard) ou `simulador`
  (script `npm run simulate`).
- **proximoId** — contador interno para gerar o próximo `id` de evento.

## Por que JSON e não SQLite/MySQL?

Bibliotecas de banco de dados no Node geralmente precisam compilar
código C++ na instalação (`node-gyp`), o que exige ferramentas pesadas
(Visual Studio Build Tools no Windows, Xcode no Mac). Isso trava muita
gente logo no primeiro `npm install`. Como este protótipo lida com um
volume pequeno de eventos, um arquivo JSON resolve sem exigir nada além
do Node.js puro.

Se um dia quiser migrar para um banco relacional de verdade, o único
arquivo que precisa mudar é o `backend/db.js` — as funções
(`inserirEvento`, `listarEventos`, `obterResumo`...) podem manter a
mesma assinatura, só a implementação interna muda.
