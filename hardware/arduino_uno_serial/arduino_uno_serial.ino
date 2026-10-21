/* ─────────────────────────────────────────────────────────
   SuinoTech — Protótipo de Monitoramento de Suínos
   Arduino Uno / Nano — Simulação dos sensores de Entrada/Saída

   O QUE ESTE CÓDIGO FAZ
   ----------------------
   Simula 4 baias (A, B, C, D). Cada baia tem 2 sensores digitais:
   um de ENTRADA e um de SAÍDA. Quando o "animal passa" (ou seja,
   quando você aperta o botão / interrompe o sensor IR daquela
   baia), o Arduino manda uma linha de texto em formato JSON pela
   porta Serial USB, que o backend Node.js (serial-bridge.js) lê,
   grava no banco e mostra no site em tempo real.

   Exemplo do que é enviado:
     {"baia":"A","evento":"entrada"}
     {"baia":"C","evento":"saida"}

   FUNCIONA COM BOTÃO *OU* SENSOR IR
   ----------------------------------
   O código usa INPUT_PULLUP e considera "acionado" quando o pino
   vai para LOW (nível baixo). Isso funciona tanto para:
     - Um botão/push-button ligado entre o pino e o GND; ou
     - Um módulo sensor infravermelho (ex: KY-032, FC-51), cuja
       saída OUT também vai para LOW quando detecta um objeto.
   Ou seja: para trocar de botão para sensor IR de verdade depois,
   basta ligar o fio OUT do módulo no mesmo pino — não precisa
   mudar uma linha de código.

   LIGAÇÕES (Arduino Uno/Nano)
   ----------------------------
     Baia A - Entrada -> pino digital 2
     Baia A - Saída   -> pino digital 3
     Baia B - Entrada -> pino digital 4
     Baia B - Saída   -> pino digital 5
     Baia C - Entrada -> pino digital 6
     Baia C - Saída   -> pino digital 7
     Baia D - Entrada -> pino digital 8
     Baia D - Saída   -> pino digital 9

     LED indicador (opcional, pode usar o LED_BUILTIN)  -> pino 13
     Buzzer (opcional, apita a cada evento)              -> pino 11

   Cada botão: uma perna no pino digital, a outra perna no GND.
   (Não precisa de resistor externo — usamos o pull-up interno.)

   Veja hardware/README.md para o diagrama de ligação completo.
   ───────────────────────────────────────────────────────── */

#include <Arduino.h>

// ── Configuração das baias ──
const uint8_t NUM_BAIAS = 4;
const char* NOMES_BAIAS[NUM_BAIAS] = { "A", "B", "C", "D" };
const uint8_t PINOS_ENTRADA[NUM_BAIAS] = { 2, 4, 6, 8 };
const uint8_t PINOS_SAIDA[NUM_BAIAS]   = { 3, 5, 7, 9 };

const uint8_t PINO_LED = 13;
const uint8_t PINO_BUZZER = 11;

const unsigned long DEBOUNCE_MS = 250; // tempo mínimo entre dois acionamentos do mesmo sensor

// Guarda o último instante (millis) em que cada sensor foi acionado,
// para não registrar o mesmo evento várias vezes seguidas.
unsigned long ultimoAcionamentoEntrada[NUM_BAIAS];
unsigned long ultimoAcionamentoSaida[NUM_BAIAS];

// Guarda o último estado lido de cada pino, para detectar a "borda"
// (o momento exato em que o sensor passa de solto -> acionado).
int estadoAnteriorEntrada[NUM_BAIAS];
int estadoAnteriorSaida[NUM_BAIAS];

void setup() {
  Serial.begin(9600);

  for (uint8_t i = 0; i < NUM_BAIAS; i++) {
    pinMode(PINOS_ENTRADA[i], INPUT_PULLUP);
    pinMode(PINOS_SAIDA[i], INPUT_PULLUP);
    estadoAnteriorEntrada[i] = HIGH; // HIGH = solto (não acionado), graças ao pull-up
    estadoAnteriorSaida[i] = HIGH;
    ultimoAcionamentoEntrada[i] = 0;
    ultimoAcionamentoSaida[i] = 0;
  }

  pinMode(PINO_LED, OUTPUT);
  pinMode(PINO_BUZZER, OUTPUT);
  digitalWrite(PINO_LED, LOW);

  // Pequena piscada de "estou vivo" ao ligar
  for (uint8_t i = 0; i < 3; i++) {
    digitalWrite(PINO_LED, HIGH);
    delay(120);
    digitalWrite(PINO_LED, LOW);
    delay(120);
  }

  // Avisa o backend que o Arduino terminou de inicializar
  Serial.println("{\"status\":\"pronto\"}");
}

void loop() {
  unsigned long agora = millis();

  for (uint8_t i = 0; i < NUM_BAIAS; i++) {
    verificarSensor(
      PINOS_ENTRADA[i], estadoAnteriorEntrada[i], ultimoAcionamentoEntrada[i],
      agora, NOMES_BAIAS[i], "entrada"
    );
    verificarSensor(
      PINOS_SAIDA[i], estadoAnteriorSaida[i], ultimoAcionamentoSaida[i],
      agora, NOMES_BAIAS[i], "saida"
    );
  }
}

/**
 * Lê um sensor, aplica debounce e — se detectar um novo acionamento —
 * envia o evento correspondente pela Serial em formato JSON.
 */
void verificarSensor(
  uint8_t pino,
  int &estadoAnterior,
  unsigned long &ultimoAcionamento,
  unsigned long agora,
  const char* nomeBaia,
  const char* tipoEvento
) {
  int estadoAtual = digitalRead(pino);

  // Detecta a borda de descida: estava solto (HIGH) e agora está acionado (LOW)
  bool foiAcionadoAgora = (estadoAnterior == HIGH && estadoAtual == LOW);

  if (foiAcionadoAgora && (agora - ultimoAcionamento) > DEBOUNCE_MS) {
    enviarEvento(nomeBaia, tipoEvento);
    ultimoAcionamento = agora;
    piscarEBipar();
  }

  estadoAnterior = estadoAtual;
}

/** Monta e envia a linha JSON com o evento detectado. */
void enviarEvento(const char* baia, const char* tipo) {
  Serial.print("{\"baia\":\"");
  Serial.print(baia);
  Serial.print("\",\"evento\":\"");
  Serial.print(tipo);
  Serial.println("\"}");
}

/** Feedback físico simples: pisca o LED e apita o buzzer por um instante. */
void piscarEBipar() {
  digitalWrite(PINO_LED, HIGH);
  tone(PINO_BUZZER, 2000, 80);
  delay(80);
  digitalWrite(PINO_LED, LOW);
}
