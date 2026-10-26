/* ─────────────────────────────────────────────────────────
   SuinoTech — Protótipo de Monitoramento de Suínos
   Arduino Uno / Nano — Porteiras com detecção de sentido

   O QUE ESTE CÓDIGO FAZ
   ----------------------
   Cada uma das 4 baias (A, B, C, D) tem UMA porteira com DOIS
   sensores, instalados um atrás do outro no sentido da passagem:

        lado de fora                         lado de dentro
             │   [EXTERNO]          [INTERNO]   │
             │       ║                  ║       │
        ─────┼───────╫──────────────────╫───────┼──── corredor → baia
                     ║◄── menor que ───►║
                        o comprimento
                        de um suíno

   Como o animal é mais comprido que a distância entre os sensores,
   ele cobre os dois feixes por um instante. A ORDEM em que os feixes
   são interrompidos e liberados indica o sentido:

     ENTRADA:  externo → externo+interno → interno → livre
     SAÍDA:    interno → externo+interno → externo → livre

   Se o animal começar a passar e voltar, a sequência se desfaz e
   nada é registrado. Animais em fila são contados um a um, desde
   que passem em fila única (corredor estreito) e com um pequeno
   espaço entre eles. LIMITAÇÃO: dois animais colados (o segundo
   cobre o sensor externo antes de o primeiro liberar o interno) ou
   lado a lado produzem a mesma sequência de um animal que recua,
   e podem ser contados como um só.

   Quando uma passagem termina, o Arduino envia uma linha JSON pela
   porta USB, que o navegador (Chrome/Edge) lê pela Web Serial API:
     {"baia":"A","evento":"entrada"}
     {"baia":"C","evento":"saida"}

   COMO FUNCIONA POR DENTRO (decodificação em quadratura)
   --------------------------------------------------------
   Os dois sensores formam um estado de 2 bits. Na ordem de uma
   entrada, os estados são numerados 0 → 1 → 2 → 3 → 0:

       posição 0 = livre      (externo solto,  interno solto)
       posição 1 = externo    (externo coberto, interno solto)
       posição 2 = os dois    (externo coberto, interno coberto)
       posição 3 = interno    (externo solto,  interno coberto)

   Cada mudança para a posição seguinte soma +1 passo; para a
   anterior, −1. Quando a porteira volta a ficar livre:
     +4 passos = 1 entrada · −4 = 1 saída · 0 = desistiu (nada)

   SENSORES E RUÍDO
   -----------------
   Funciona com sensores IR de barreira (emissor de um lado da
   passagem, receptor do outro) ou com botões para testar na
   bancada. Os dois dão nível LOW quando acionados (INPUT_PULLUP).
   Cada sensor passa por dois filtros antes de entrar na conta:
     1) a leitura precisa ficar ESTÁVEL por ESTABILIDADE_MS;
     2) o mesmo sensor não é aceito como acionado de novo antes de
        DEBOUNCE_MS (250 ms, requisito RNF05 do TCC).

   TESTE COM BOTÕES (sem animais)
   -------------------------------
   Simule o corpo do animal cobrindo os dois sensores:
     entrada: aperte EXTERNO, aperte INTERNO (sem soltar o externo),
              solte EXTERNO, solte INTERNO.
     saída:   o mesmo, começando pelo INTERNO.

   LIGAÇÕES (Arduino Uno/Nano)
   ----------------------------
     Baia A - Externo -> D2      Baia C - Externo -> D6
     Baia A - Interno -> D3      Baia C - Interno -> D7
     Baia B - Externo -> D4      Baia D - Externo -> D8
     Baia B - Interno -> D5      Baia D - Interno -> D9

     LED indicador (opcional, pode usar o LED da placa) -> D13
     Buzzer passivo (opcional, apita a cada evento)     -> D11

   Veja hardware/README.md para o passo a passo da montagem.
   ───────────────────────────────────────────────────────── */

#include <Arduino.h>

// ── Configuração das porteiras ──
const uint8_t NUM_BAIAS = 4;
const char* NOMES_BAIAS[NUM_BAIAS] = { "A", "B", "C", "D" };
const uint8_t PINOS_EXTERNO[NUM_BAIAS] = { 2, 4, 6, 8 };
const uint8_t PINOS_INTERNO[NUM_BAIAS] = { 3, 5, 7, 9 };

// Nível que o sensor entrega quando o feixe é interrompido (ou o botão é
// apertado). Botões e a maioria dos receptores IR dão LOW. Se o seu módulo
// der HIGH ao ser bloqueado (confira no Monitor Serial), troque para HIGH.
const int NIVEL_ACIONADO = LOW;

const uint8_t PINO_LED = 13;
const uint8_t PINO_BUZZER = 11;

// ── Tempos (em milissegundos) ──
const unsigned long ESTABILIDADE_MS = 30;  // o sinal precisa ficar parado este tempo para valer
const unsigned long DEBOUNCE_MS = 250;     // intervalo mínimo entre dois acionamentos do mesmo sensor (RNF05)
const unsigned long DURACAO_LED_MS = 80;   // tempo do LED aceso e do bipe a cada evento
const unsigned int  FREQ_BIPE_HZ = 2000;

// ── Um sensor com filtro de ruído ──
struct Sensor {
  uint8_t pino;
  int bruto;                     // última leitura crua (pode estar trepidando)
  bool coberto;                  // estado filtrado: true = feixe interrompido / botão apertado
  unsigned long ultimaMudanca;   // quando a leitura crua mudou pela última vez
  unsigned long ultimoAcionamento; // quando o sensor foi aceito como coberto pela última vez
};

// ── Uma porteira = dois sensores + a contagem de passos ──
struct Porteira {
  const char* baia;
  Sensor externo;
  Sensor interno;
  uint8_t posicao;  // 0 livre · 1 externo · 2 os dois · 3 interno
  int passos;       // soma dos passos desde que a porteira ficou ocupada
  int ultimoSentido; // +1 ou −1: sentido do último passo válido
};

Porteira porteiras[NUM_BAIAS];

bool ledAceso = false;
unsigned long ledAcesoEm = 0;

// ─────────────────────────────────────────────────────────

void setup() {
  Serial.begin(9600);

  for (uint8_t i = 0; i < NUM_BAIAS; i++) {
    Porteira &p = porteiras[i];
    p.baia = NOMES_BAIAS[i];
    p.externo = { PINOS_EXTERNO[i], HIGH, false, 0, 0 };
    p.interno = { PINOS_INTERNO[i], HIGH, false, 0, 0 };
    p.posicao = 0;
    p.passos = 0;
    p.ultimoSentido = 0;
    pinMode(p.externo.pino, INPUT_PULLUP); // HIGH = livre, graças ao pull-up
    pinMode(p.interno.pino, INPUT_PULLUP);
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

  for (uint8_t i = 0; i < NUM_BAIAS; i++) {
    atualizarPorteira(porteiras[i], agora);
  }

  // Apaga o LED sem usar delay(): a leitura dos sensores nunca para
  // (a subtração continua correta mesmo quando o millis() reinicia, a cada ~49 dias)
  if (ledAceso && agora - ledAcesoEm >= DURACAO_LED_MS) {
    digitalWrite(PINO_LED, LOW);
    ledAceso = false;
  }
}

/**
 * Filtra o ruído de um sensor. Devolve true se o estado filtrado mudou.
 */
bool atualizarSensor(Sensor &s, unsigned long agora) {
  int leitura = digitalRead(s.pino);

  // A leitura crua mudou: reinicia a contagem de estabilidade
  if (leitura != s.bruto) {
    s.bruto = leitura;
    s.ultimaMudanca = agora;
    return false;
  }
  if (agora - s.ultimaMudanca < ESTABILIDADE_MS) return false;

  bool cobertoAgora = (leitura == NIVEL_ACIONADO);
  if (cobertoAgora == s.coberto) return false;

  // RNF05: o mesmo sensor não volta a ser aceito como coberto antes de 250 ms
  if (cobertoAgora && s.ultimoAcionamento != 0 && agora - s.ultimoAcionamento < DEBOUNCE_MS) return false;

  s.coberto = cobertoAgora;
  if (cobertoAgora) s.ultimoAcionamento = agora;
  return true;
}

/** Converte o par de sensores na posição 0..3 da sequência de entrada. */
uint8_t posicaoAtual(const Porteira &p) {
  if (!p.externo.coberto && !p.interno.coberto) return 0; // livre
  if ( p.externo.coberto && !p.interno.coberto) return 1; // só o externo
  if ( p.externo.coberto &&  p.interno.coberto) return 2; // os dois
  return 3;                                               // só o interno
}

/**
 * Lê os dois sensores da porteira, soma os passos da sequência e,
 * quando a porteira fica livre, registra as entradas ou saídas completas.
 */
void atualizarPorteira(Porteira &p, unsigned long agora) {
  bool mudouExterno = atualizarSensor(p.externo, agora);
  bool mudouInterno = atualizarSensor(p.interno, agora);
  if (!mudouExterno && !mudouInterno) return;

  uint8_t nova = posicaoAtual(p);
  uint8_t diferenca = (nova - p.posicao + 4) % 4;

  if (diferenca == 1) {          // avançou na sequência de entrada
    p.passos++;
    p.ultimoSentido = 1;
  } else if (diferenca == 3) {   // avançou na sequência de saída
    p.passos--;
    p.ultimoSentido = -1;
  } else if (diferenca == 2) {
    // Os dois sensores mudaram juntos (animal muito rápido): pulou uma
    // posição. Assume que continuou no mesmo sentido em que vinha.
    p.passos += 2 * p.ultimoSentido;
  }
  p.posicao = nova;

  // Porteira livre: fecha a contagem
  if (p.posicao == 0) {
    // Arredonda para o ciclo completo mais próximo (4 passos = 1 animal)
    int animais = (p.passos >= 0 ? p.passos + 2 : p.passos - 2) / 4;
    for (int i = 0; i < animais; i++) enviarEvento(p.baia, "entrada", agora);
    for (int i = 0; i < -animais; i++) enviarEvento(p.baia, "saida", agora);
    p.passos = 0;
    p.ultimoSentido = 0;
  }
}

/** Monta e envia a linha JSON com o evento detectado e dá o sinal físico. */
void enviarEvento(const char* baia, const char* tipo, unsigned long agora) {
  Serial.print("{\"baia\":\"");
  Serial.print(baia);
  Serial.print("\",\"evento\":\"");
  Serial.print(tipo);
  Serial.println("\"}");

  // LED + bipe curto, sem bloquear o loop (tone() com duração não bloqueia)
  digitalWrite(PINO_LED, HIGH);
  ledAceso = true;
  ledAcesoEm = agora;
  tone(PINO_BUZZER, FREQ_BIPE_HZ, DURACAO_LED_MS);
}
