# Hardware — Simulação dos Sensores (Arduino Uno/Nano)

Este protótipo simula os sensores de entrada/saída de cada baia usando
**botões** (mais simples e confiável para demonstração) ou **sensores IR**
de barreira (ex: KY-032, FC-51) — o código é o mesmo para os dois, porque
ambos entregam um sinal digital LOW quando "detectam a passagem do animal".

## Lista de materiais

| Qtd | Componente |
|---|---|
| 1 | Arduino Uno ou Nano |
| até 8 | Botões (push-button) *ou* sensores IR de barreira |
| 1 | LED (opcional — pode usar o LED interno, pino 13) |
| 1 | Buzzer/piezo passivo (opcional) |
| — | Jumpers / protoboard |
| 1 | Cabo USB (dados, não só carga) |

> Você não precisa montar as 4 baias para o protótipo funcionar — pode
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
| LED indicador | D13 (ou use o LED_BUILTIN da própria placa) |
| Buzzer (opcional) | D11 |

## Como ligar um botão

```
  Pino digital (ex: D2) ──── [ BOTÃO ] ──── GND
```

Só isso — **não precisa de resistor externo**. O sketch configura o pino
com `INPUT_PULLUP`, ou seja, o próprio Arduino já mantém o pino em nível
alto (HIGH) internamente; quando o botão fecha o circuito com o GND, o
pino cai para LOW e o evento é detectado.

## Como ligar um sensor IR de barreira (KY-032 / FC-51)

```
  VCC do sensor  ──── 5V do Arduino
  GND do sensor  ──── GND do Arduino
  OUT do sensor  ──── mesmo pino digital do botão que ele substitui (ex: D2)
```

A saída `OUT` desses módulos também vai para LOW quando detecta um
obstáculo — por isso o mesmo sketch funciona sem alterar nenhuma linha
de código, seja com botão ou com sensor IR.

## LED e Buzzer (feedback físico, opcional mas recomendado)

```
  D13 ──── [ resistor 220Ω ] ──── LED (ânodo) ──── LED (catodo) ──── GND
  D11 ──── Buzzer (+) ──── Buzzer (−) ──── GND
```

A cada evento registrado, o Arduino pisca o LED e emite um bipe curto —
ótimo para a banca perceber visualmente que o sensor foi acionado.

## Gravando o sketch

1. Abra `arduino_uno_serial/arduino_uno_serial.ino` na Arduino IDE.
2. Selecione a placa (Uno ou Nano) e a porta serial em **Ferramentas**.
3. Clique em **Carregar** (upload).
4. Abra o **Monitor Serial** (9600 baud) e aperte os botões — você verá
   linhas como `{"baia":"A","evento":"entrada"}` aparecendo. Se aparecer
   isso, o hardware está funcionando.
5. **Feche o Monitor Serial antes de conectar pelo site** — só um
   programa por vez pode usar a porta USB do Arduino.

## Conectando ao site (sem instalar nada extra!)

Diferente de outros tutoriais, aqui você **não precisa configurar porta
COM em nenhum arquivo `.env`, nem instalar biblioteca nenhuma no
backend**. A conexão é feita direto pelo navegador:

1. Abra o site no **Google Chrome** ou **Microsoft Edge** (não funciona
   no Firefox nem no Safari — são navegadores sem suporte a essa função).
2. Na seção Dashboard, clique em **"🔌 Conectar Arduino (USB)"**.
3. O navegador vai mostrar uma janelinha listando as portas USB do
   computador — escolha a que corresponde ao seu Arduino (geralmente
   tem "Arduino" ou "USB Serial" no nome) e clique em Conectar.
4. Pronto — a partir daí, cada vez que você apertar um botão/sensor, o
   evento aparece no site instantaneamente.

Isso usa uma função chamada **Web Serial API**, nativa do navegador.

## Próximo passo

Depois de validar no Monitor Serial (e fechá-lo!), siga o
`backend/README.md` para rodar o site e conectar o Arduino pelo botão.
