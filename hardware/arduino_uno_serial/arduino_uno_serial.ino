/* ─────────────────────────────────────────────────────────
   SuinoTech — Protótipo de Monitoramento de Suínos
   Arduino Uno / Nano — Sensores de Entrada/Saída das baias

   O QUE ESTE CÓDIGO FAZ
   ----------------------
   Monitora 4 baias (A, B, C, D). Cada baia tem 2 sensores digitais:
   um de ENTRADA e um de SAÍDA. Quando o animal passa (ou seja, quando
   o botão é apertado ou o sensor IR daquela baia é acionado), o
   Arduino envia uma linha de texto em formato JSON pela porta Serial
   USB. Quem lê essa linha é o próprio navegador (Chrome/Edge), pela
   Web Serial API — veja frontend/js/arduino-serial.js.

   Exemplo do que é enviado:
     {"baia":"A","evento":"entrada"}
     {"baia":"C","evento":"saida"}

   FUNCIONA COM BOTÃO *OU* SENSOR IR
   ----------------------------------
   O código usa INPUT_PULLUP e considera "acionado" quando o pino vai
   para LOW (nível baixo). Isso vale tanto para:
     - um botão (push-button) ligado entre o pino e o GND; quanto para
     - um sensor IR de saída digital ativa em LOW — de barreira
       (emissor + receptor, o feixe é interrompido) ou de obstáculo
       (reflexivo, ex.: KY-032, FC-51).
   Para trocar o botão pelo sensor, basta ligar o fio OUT do sensor
   no mesmo pino — não precisa mudar nenhuma linha de código.

   TRATAMENTO DE RUÍDO (debounce) — requisito RNF05 do TCC
   --------------------------------------------------------
   1) Um contato só muda de estado depois de ficar ESTÁVEL por
      ESTABILIDADE_MS. Isso filtra a trepidação tanto ao apertar
      quanto ao SOLTAR o botão.
   2) Depois de um evento, o mesmo sensor fica bloqueado por
      DEBOUNCE_MS (250 ms): acionamentos repetidos nesse intervalo
      são descartados.
   3) Só a transição solto → acionado gera evento (detecção de borda):
      segurar o botão não gera eventos repetidos.

   LIGAÇÕES (Arduino Uno/Nano)
   ----------------------------
     Baia A - Entrada -> D2      Baia C - Entrada -> D6
     Baia A - Saída   -> D3      Baia C - Saída   -> D7
     Baia B - Entrada -> D4      Baia D - Entrada -> D8
     Baia B - Saída   -> D5      Baia D - Saída   -> D9

     LED indicador (opcional, pode usar o LED da placa) -> D13
     Buzzer passivo (opcional, apita a cada evento)     -> D11

   Cada botão: uma perna no pino digital, a outra no GND.
   Não precisa de resistor externo — o pull-up interno resolve.
   Veja hardware/README.md para o passo a passo da montagem.
   ───────────────────────────────────────────────────────── */

#include <Arduino.h>

// ── Configuração das baias ──
const uint8_t NUM_BAIAS = 4;
const char* NOMES_BAIAS[NUM_BAIAS] = { "A", "B", "C", "D" };
const uint8_t PINOS_ENTRADA[NUM_BAIAS] = { 2, 4, 6, 8 };
const uint8_t PINOS_SAIDA[NUM_BAIAS]   = { 3, 5, 7, 9 };

const uint8_t PINO_LED = 13;
const uint8_t PINO_BUZZER = 11;

// ── Tempos (em milissegundos) ──
const unsigned long ESTABILIDADE_MS = 30;  // tempo que o sinal precisa ficar parado para valer
const unsigned long DEBOUNCE_MS = 250;     // intervalo mínimo entre dois eventos do mesmo sensor (RNF05)
const unsigned long DURACAO_LED_MS = 80;   // quanto tempo o LED fica aceso a cada evento
const unsigned int  FREQ_BIPE_HZ = 2000;

// ── Estado de cada sensor ──
struct Sensor {
  uint8_t pino;
  const char* baia;
  const char* tipo;              // "entrada" ou "saida"
  int estadoBruto;               // última leitura crua do pino (pode estar trepidando)
  int estadoEstavel;             // estado já filtrado (HIGH = solto, LOW = acionado)
  unsigned long ultimaMudanca;   // quando a leitura crua mudou pela última vez
  unsigned long ultimoEvento;    // quando o último evento deste sensor foi enviado
};

const uint8_t NUM_SENSORES = NUM_BAIAS * 2;
Sensor sensores[NUM_SENSORES];

bool ledAceso = false;
unsigned long ledAcesoEm = 0;    // quando o LED foi aceso pela última vez

// ─────────────────────────────────────────────────────────

void setup() {
  Serial.begin(9600);

  // Monta a lista de sensores: [A-entrada, A-saída, B-entrada, B-saída, ...]
  for (uint8_t i = 0; i < NUM_BAIAS; i++) {
    sensores[i * 2]     = { PINOS_ENTRADA[i], NOMES_BAIAS[i], "entrada", HIGH, HIGH, 0, 0 };
    sensores[i * 2 + 1] = { PINOS_SAIDA[i],   NOMES_BAIAS[i], "saida",   HIGH, HIGH, 0, 0 };
  }
  for (uint8_t i = 0; i < NUM_SENSORES; i++) {
    pinMode(sensores[i].pino, INPUT_PULLUP); // HIGH = solto, graças ao pull-up
  }

  pinMode(PINO_LED, OUTPUT);
  pinMode(PINO_BUZZER, OUTPUT);
  digitalWrite(PINO_LED, LOW);

  // Três piscadas de "estou vivo" ao ligar (caso de teste CT01)
  for (uint8_t i = 0; i < 3; i++) {
    digitalWrite(PINO_LED, HIGH);
    delay(120);
    digitalWrite(PINO_LED, LOW);
    delay(120);
  }

  // Mensagem de prontidão — o site reconhece e ignora esta linha
  Serial.println("{\"status\":\"pronto\"}");
}

void loop() {
  unsigned long agora = millis();

  for (uint8_t i = 0; i < NUM_SENSORES; i++) {
    verificarSensor(sensores[i], agora);
  }

  // Apaga o LED sem usar delay(): a leitura dos sensores nunca para
  // (a subtração continua correta mesmo quando o millis() reinicia, a cada ~49 dias)
  if (ledAceso && agora - ledAcesoEm >= DURACAO_LED_MS) {
    digitalWrite(PINO_LED, LOW);
    ledAceso = false;
  }
}

/**
 * Lê um sensor, filtra a trepidação e — se detectar um novo
 * acionamento válido — envia o evento pela Serial.
 */
void verificarSensor(Sensor &s, unsigned long agora) {
  int leitura = digitalRead(s.pino);

  // A leitura crua mudou: reinicia a contagem de estabilidade
  if (leitura != s.estadoBruto) {
    s.estadoBruto = leitura;
    s.ultimaMudanca = agora;
    return;
  }

  // Ainda não ficou estável tempo suficiente, ou não mudou de fato
  if (agora - s.ultimaMudanca < ESTABILIDADE_MS || leitura == s.estadoEstavel) return;

  s.estadoEstavel = leitura;

  // Borda de descida (solto → acionado) fora do intervalo de bloqueio
  bool acionou = (s.estadoEstavel == LOW);
  bool foraDoBloqueio = (s.ultimoEvento == 0 || agora - s.ultimoEvento >= DEBOUNCE_MS);

  if (acionou && foraDoBloqueio) {
    enviarEvento(s.baia, s.tipo);
    s.ultimoEvento = agora;
    sinalizar(agora);
  }
}

/** Monta e envia a linha JSON com o evento detectado. */
void enviarEvento(const char* baia, const char* tipo) {
  Serial.print("{\"baia\":\"");
  Serial.print(baia);
  Serial.print("\",\"evento\":\"");
  Serial.print(tipo);
  Serial.println("\"}");
}

/** Feedback físico: acende o LED e dá um bipe curto (sem bloquear o loop). */
void sinalizar(unsigned long agora) {
  digitalWrite(PINO_LED, HIGH);
  ledAceso = true;
  ledAcesoEm = agora;
  tone(PINO_BUZZER, FREQ_BIPE_HZ, DURACAO_LED_MS); // tone() com duração já é não bloqueante
}
