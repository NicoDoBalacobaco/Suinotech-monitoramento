# Hardware — Sensores de entrada/saída (Arduino Uno/Nano)

Este protótipo detecta a passagem dos animais em cada baia usando
**botões** (mais simples e confiáveis para a demonstração em bancada) ou
**sensores IR** com saída digital. O código é o mesmo para os dois, porque
ambos entregam um sinal LOW quando "detectam a passagem do animal".

## Lista de materiais

| Qtd | Componente |
|---|---|
| 1 | Arduino Uno ou Nano |
| até 8 | Botões (push-button) *ou* sensores IR com saída digital (veja abaixo) |
| 1 | LED (opcional — pode usar o LED interno, pino 13) |
| 1 | Resistor de 220 Ω (só se usar LED externo) |
| 1 | Buzzer/piezo passivo (opcional) |
| — | Jumpers / protoboard |
| 1 | Cabo USB (de dados, não só de carga) |

> Não é preciso montar as 4 baias para o protótipo funcionar — dá para
> montar só a Baia A (2 botões) para a demonstração e mencionar no
> relatório que as demais seguem o mesmo padrão.

## Mapa de pinos

| Sinal | Pino Arduino |
|---|---|
| Baia A — Entrada | D2 |
| Baia A — Saída | D3 |
| Baia B — Entrada | D4 |
| Baia B — Saída | D5 |
| Baia C — Entrada | D6 |
| Baia C — Saída | D7 |
| Baia D — Entrada | D8 |
| Baia D — Saída | D9 |
| LED indicador | D13 (ou o LED da própria placa) |
| Buzzer (opcional) | D11 |

## Como ligar um botão

```
  Pino digital (ex: D2) ──── [ BOTÃO ] ──── GND
```

Só isso — **não precisa de resistor externo**. O sketch configura o pino
com `INPUT_PULLUP`: o próprio Arduino mantém o pino em nível alto (HIGH);
quando o botão fecha o circuito com o GND, o pino cai para LOW e o evento
é detectado.

## Como ligar um sensor IR

Existem dois tipos, e os dois funcionam com o mesmo sketch:

| Tipo | Como detecta | Exemplos |
|---|---|---|
| **De barreira** (feixe) | Emissor e receptor ficam um de cada lado da passagem; o animal interrompe o feixe | Pares emissor/receptor de 3 mm ou 5 mm com saída em coletor aberto |
| **De obstáculo** (reflexivo) | Emissor e receptor ficam lado a lado; detecta a luz refletida pelo animal | KY-032, FC-51 |

Para uma porteira real, o de **barreira** é o mais indicado (alcance maior
e menos sensível à cor e à distância do animal). Para a bancada, o de
obstáculo é mais barato e fácil de encontrar.

```
  VCC do sensor  ──── 5V do Arduino
  GND do sensor  ──── GND do Arduino
  OUT do sensor  ──── mesmo pino digital do botão que ele substitui (ex: D2)
```

A saída `OUT` desses módulos vai para LOW quando detecta o animal — por
isso o sketch funciona sem alterar nenhuma linha, seja com botão ou com
sensor IR. (Os de coletor aberto dependem do pull-up, que o sketch já liga
com `INPUT_PULLUP`.)

## LED e buzzer (feedback físico, opcional mas recomendado)

```
  D13 ──── [ resistor 220Ω ] ──── LED (ânodo) ──── LED (cátodo) ──── GND
  D11 ──── Buzzer (+) ──── Buzzer (−) ──── GND
```

A cada evento registrado, o Arduino acende o LED e emite um bipe curto —
assim a banca percebe na hora que o sensor foi acionado.

## Como o sketch evita contagem dupla

Botões mecânicos "trepidam" por alguns milissegundos ao apertar **e** ao
soltar. O sketch filtra isso em três camadas (detalhes no comentário do
topo do `.ino`):

1. o sinal precisa ficar **estável por 30 ms** para a mudança valer;
2. depois de um evento, o mesmo sensor fica **bloqueado por 250 ms**
   (requisito RNF05 do TCC);
3. só a transição **solto → acionado** gera evento — segurar o botão não
   repete a contagem.

## Gravando o sketch

1. Abra `arduino_uno_serial/arduino_uno_serial.ino` na Arduino IDE.
2. Selecione a placa (Uno ou Nano) e a porta em **Ferramentas**.
3. Clique em **Carregar** (upload).
4. Abra o **Monitor Serial** (9600 baud) e aperte os botões — devem
   aparecer linhas como `{"baia":"A","evento":"entrada"}`. Se aparecer,
   o hardware está funcionando.
5. **Feche o Monitor Serial antes de conectar pelo site** — só um
   programa por vez pode usar a porta USB do Arduino.

## Conectando ao site (sem instalar nada extra)

Não é preciso configurar porta COM em arquivo nenhum nem instalar
biblioteca no backend. A conexão é feita direto pelo navegador:

1. Abra o site no **Google Chrome** ou **Microsoft Edge** (Firefox e
   Safari não têm suporte a essa função).
2. Na seção Painel, clique em **"Conectar Arduino (USB)"**.
3. O navegador mostra uma lista das portas USB do computador — escolha a
   do Arduino (geralmente tem "Arduino", "USB Serial" ou "CH340" no nome)
   e clique em Conectar.
4. Pronto — cada vez que um botão/sensor for acionado, o evento aparece
   no site na hora.

Isso usa a **Web Serial API**, nativa dos navegadores baseados em Chromium.

## Próximo passo

Depois de validar no Monitor Serial (e fechá-lo!), siga o
`backend/README.md` para rodar o site e conectar o Arduino pelo botão.
