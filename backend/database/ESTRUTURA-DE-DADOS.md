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

- **baias** — as 4 baias monitoradas e a capacidade máxima de cada uma
  (usada nos alertas de 85% e 100%).
- **eventos** — toda entrada/saída registrada, na ordem em que chegou.
  `origem` indica de onde veio: `arduino` (sensor real), `manual` (via
  API/Postman), `demo` (botões de simulação do painel) ou `simulador`
  (script `npm run simulate`).
- **proximoId** — contador interno para gerar o próximo `id`.

O total de animais de cada baia **não fica gravado**: é recalculado a
partir dos eventos sempre que alguém pede o resumo. Assim o total nunca
diverge do histórico.

## Segurança do arquivo

- A gravação é **atômica**: o servidor escreve num arquivo temporário e só
  então o renomeia por cima do `dados.json`. Se o computador desligar no
  meio, o arquivo anterior continua inteiro.
- Se mesmo assim o arquivo estiver corrompido ao iniciar, ele é guardado
  como `dados.corrompido-<data>.json` e o servidor começa com um arquivo
  novo, em vez de não subir.
- Para **zerar os dados** (ex.: antes da apresentação), pare o servidor e
  apague o `dados.json`; ele é recriado vazio na próxima execução.

## Por que JSON e não SQLite/MySQL?

Bibliotecas de banco de dados no Node geralmente precisam compilar código
C++ na instalação (`node-gyp`), o que exige ferramentas pesadas (Visual
Studio Build Tools no Windows, Xcode no Mac) e trava muita gente no
primeiro `npm install`. Como o protótipo tem um único processo gravando e
pouco volume de eventos, um arquivo JSON resolve sem exigir nada além do
Node.js (requisito RNF04 do TCC).

Para migrar para um banco relacional, só o `backend/db.js` precisa mudar:
as funções (`inserirEvento`, `listarEventos`, `obterResumo`...) mantêm a
mesma assinatura e o resto do sistema não percebe a troca (RNF08).
