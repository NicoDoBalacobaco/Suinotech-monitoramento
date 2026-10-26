# Hardware — Porteiras com detecção de sentido (Arduino Uno/Nano)

> **Status:** em desenvolvimento. O site funciona sem o Arduino (botões
> "Simular entrada/saída" e `npm run simulate`), então a demonstração não
> depende do hardware.

## A ideia: dois sensores por porteira

Como cada baia tem vários suínos, não basta saber que "alguém passou" — é
preciso saber **para que lado**. Por isso cada porteira tem **dois sensores
em sequência**, um do lado de fora (EXTERNO) e outro do lado de dentro
(INTERNO), mais próximos entre si do que o comprimento de um suíno:

```
   corredor                                        baia
      │      [EXTERNO]                 [INTERNO]     │
      │          ║                         ║         │
  ────┼──────────╫─────────────────────────╫─────────┼────
                 ║◄──── ~30 cm (menor ────►║
                      que um suíno)
```

O animal cobre os dois feixes por um instante, e a **ordem** em que eles são
cortados e liberados indica o sentido:

| Sequência | Resultado |
|---|---|
| externo → os dois → interno → livre | **entrada** |
| interno → os dois → externo → livre | **saída** |
| externo → os dois → externo → livre (entrou pela metade e voltou) | nada é registrado |

O sketch faz essa conta com uma técnica chamada **decodificação em
quadratura** (a mesma dos contadores de pessoas em portas de loja): cada
mudança para o próximo estado da sequência soma +1, cada mudança para o
anterior soma −1; quando a porteira fica livre, +4 é uma entrada e −4 é uma
saída. Os detalhes estão no comentário do topo do `.ino`.

### Instalação na porteira (importante)

- **Altura do feixe: na altura do tronco**, nunca das pernas. Se o feixe passar
  entre as pernas, ele é liberado e bloqueado várias vezes durante uma única
  passagem e a sequência se perde. Use a altura do tronco do **menor** animal
  que passa pela porteira.
- **Distância entre os sensores:** menor que o comprimento do menor animal
  (ex.: 30 cm), para que ele cubra os dois feixes por um instante.
- **Polaridade:** botões e a maioria dos receptores IR dão LOW quando
  bloqueados. Confira com um multímetro na saída OUT do receptor: com o feixe
  livre deve marcar ~5 V e, bloqueado, ~0 V. Se for o contrário, troque
  `NIVEL_ACIONADO` para `HIGH` no topo do sketch.

### Limitação

Os animais precisam passar **em fila única** (corredor estreito) e com um
pequeno espaço entre eles. Dois suínos colados — o segundo cobrindo o
sensor externo antes de o primeiro liberar o interno — ou lado a lado geram
a mesma sequência de um animal que recua e podem ser contados como um só.

> **Sem o hardware?** Há uma simulação pronta no Wokwi, com o mesmo circuito
> e o mesmo firmware: veja `simulacao-wokwi/README.md`.

## Lista de materiais

| Qtd | Componente |
|---|---|
| 1 | Arduino Uno ou Nano |
| 4 pares (até 8 sensores) | Sensores IR de barreira (emissor + receptor) *ou* botões para teste em bancada |
| 1 | LED (opcional — pode usar o LED interno, pino 13) |
| 1 | Resistor de 220 Ω (só se usar LED externo) |
| 1 | Buzzer/piezo passivo (opcional) |
| — | Jumpers / protoboard |
| 1 | Cabo USB (de dados, não só de carga) |

> Para o protótipo basta montar a porteira da Baia A (2 sensores) e
> mencionar que as demais seguem o mesmo padrão.

## Mapa de pinos

| Sinal | Pino | Sinal | Pino |
|---|---|---|---|
| Baia A — Externo | D2 | Baia C — Externo | D6 |
| Baia A — Interno | D3 | Baia C — Interno | D7 |
| Baia B — Externo | D4 | Baia D — Externo | D8 |
| Baia B — Interno | D5 | Baia D — Interno | D9 |
| Buzzer (opcional) | D11 | LED indicador | D13 |

## Sensores

**Sensor IR de barreira (recomendado para a porteira):** emissor de um lado
da passagem, receptor do outro. O animal interrompe o feixe.

```
  VCC do receptor ──── 5V do Arduino
  GND do receptor ──── GND do Arduino
  OUT do receptor ──── pino do sensor (ex: D2 para o externo da Baia A)
  (o emissor só precisa de VCC e GND)
```

A saída vai para LOW quando o feixe é interrompido. Receptores com saída em
coletor aberto dependem do pull-up, que o sketch já liga com `INPUT_PULLUP`.

Sensores IR **de obstáculo** (reflexivos, como KY-032 e FC-51) também dão
LOW ao detectar algo e funcionam com o mesmo código, mas têm alcance curto
e variam com a cor do animal — servem para a bancada, não para a granja.

**Botão (teste em bancada):**

```
  Pino digital (ex: D2) ──── [ BOTÃO ] ──── GND
```

Não precisa de resistor externo: o pull-up interno mantém o pino em HIGH,
e o botão o leva a LOW.

## Testando com botões

Com botões, simule o corpo do animal cobrindo os dois sensores ao mesmo
tempo:

- **Entrada:** aperte EXTERNO → aperte INTERNO (sem soltar o externo) →
  solte EXTERNO → solte INTERNO.
- **Saída:** o mesmo, começando pelo INTERNO.
- Apertar um botão e soltar antes de apertar o outro **não registra nada**
  — é o comportamento certo (seria um animal que não chegou a passar).

## Como o sketch evita contagem errada

1. **Trepidação:** cada leitura precisa ficar **estável por 30 ms** para
   valer.
2. **Acionamentos repetidos:** o mesmo sensor não é aceito como acionado de
   novo antes de **250 ms** (requisito RNF05 do TCC).
3. **Animal que recua:** a sequência se desfaz e nenhum evento é enviado.

## LED e buzzer (feedback físico, opcional)

```
  D13 ──── [ resistor 220Ω ] ──── LED (ânodo) ──── LED (cátodo) ──── GND
  D11 ──── Buzzer (+) ──── Buzzer (−) ──── GND
```

A cada entrada ou saída registrada, o Arduino acende o LED e dá um bipe.

## Gravando e testando o sketch

1. Abra `arduino_uno_serial/arduino_uno_serial.ino` na Arduino IDE.
2. Selecione a placa (Uno ou Nano) e a porta em **Ferramentas**.
3. Clique em **Carregar**.
4. Abra o **Monitor Serial** (9600 baud) e faça uma passagem completa — deve
   aparecer `{"baia":"A","evento":"entrada"}`.
5. **Feche o Monitor Serial antes de conectar pelo site** — só um programa
   por vez pode usar a porta USB.

## Conectando ao site

1. Abra o site no **Chrome** ou **Edge** (Firefox e Safari não suportam).
2. Na seção Painel, clique em **"Conectar Arduino (USB)"** e escolha a
   porta do Arduino.
3. Cada passagem completa aparece no site na hora.

A conexão usa a **Web Serial API**, nativa dos navegadores baseados em
Chromium — não é preciso instalar nada nem configurar porta COM.
