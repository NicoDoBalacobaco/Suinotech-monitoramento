# Simulação no Wokwi (sem hardware)

O [Wokwi](https://wokwi.com) simula o Arduino Uno no navegador, com as peças
ligadas como no protótipo: 8 botões (externo e interno de cada porteira),
LED com resistor de 220 Ω no D13 e buzzer no D11 — os mesmos pinos do TCC
(Quadro 8 e Figura 4).

O Wokwi não tem sensor infravermelho de barreira, então cada sensor é um
**botão**: segurar o botão = feixe interrompido. O firmware trata os dois do
mesmo jeito (os dois dão LOW quando acionados). Os botões do Wokwi ainda
simulam a trepidação de um contato real, o que testa o filtro de ruído.

## Como abrir

1. Acesse **https://wokwi.com/projects/new/arduino-uno**.
2. Na aba **sketch.ino**, apague tudo e cole o conteúdo de
   `hardware/arduino_uno_serial/arduino_uno_serial.ino`.
3. Na aba **diagram.json**, apague tudo e cole o conteúdo de
   `hardware/simulacao-wokwi/diagram.json` (este diretório).
4. Clique no botão verde **▶** e espere aparecer `{"status":"pronto"}` no
   monitor serial (embaixo do circuito).
5. **Clique numa área vazia do circuito** antes de usar o teclado — senão as
   teclas são digitadas no editor.

Para guardar o projeto e ter um link para compartilhar, clique em **Save**
(precisa de uma conta gratuita no Wokwi).

## Teclas

Cada botão está ligado a uma tecla, o que permite segurar dois "sensores" ao
mesmo tempo (o animal cobrindo os dois feixes):

| Baia | Sensor externo | Sensor interno |
|---|---|---|
| A | tecla **1** | tecla **2** |
| B | tecla **3** | tecla **4** |
| C | tecla **5** | tecla **6** |
| D | tecla **7** | tecla **8** |

## Roteiro de teste

| Ação (Baia A) | Esperado no monitor serial |
|---|---|
| Segure **1**, segure **2**, solte **1**, solte **2** | `{"baia":"A","evento":"entrada"}` |
| Segure **2**, segure **1**, solte **2**, solte **1** | `{"baia":"A","evento":"saida"}` |
| Segure e solte só o **1** (animal desiste) | nada |
| Aperte **1** e solte, depois **2** e solte (sem sobrepor) | nada — o animal precisa cobrir os dois |

A cada evento o LED pisca e o buzzer apita.

As três primeiras linhas foram executadas automaticamente no Wokwi em
25/10/2026 (junto com uma entrada na Baia C) e deram o resultado esperado.

## Limitação

O Arduino simulado não aparece como porta USB no computador, então **não dá
para ligar o Wokwi ao site** pelo botão "Conectar Arduino (USB)". Para mostrar
o site funcionando, use os botões "Simular entrada/saída" do painel ou
`npm run simulate`.
