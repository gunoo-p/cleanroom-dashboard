// 센서 배선 점검용 스케치 — WiFi/MQTT 없이 센서만 확인한다. 시리얼 모니터 115200.
#include <Wire.h>
#include <Adafruit_BME280.h>

// 핀은 cleanroom_A.ino와 동일
#define MQ2_PIN   34
#define MQ135_PIN 35
#define SDA2_PIN  25
#define SCL2_PIN  26

Adafruit_BME280 bmeIn;
Adafruit_BME280 bmeOut;
TwoWire I2C_OUT = TwoWire(1);
bool inOk, outOk;

void scan(TwoWire& bus, const char* name) {
  Serial.printf("[%s] I2C 스캔:", name);
  int found = 0;
  for (byte a = 1; a < 127; a++) {
    bus.beginTransmission(a);
    if (bus.endTransmission() == 0) { Serial.printf(" 0x%02X", a); found++; }
  }
  Serial.println(found ? "" : " 장치 없음 (SDA/SCL·전원 배선 확인)");
}

// 기압은 해발 0~1000m 기준 대략 850~1100hPa, 온도·습도는 상식 범위
bool checkBme(Adafruit_BME280& b, const char* name) {
  float t = b.readTemperature(), h = b.readHumidity(), p = b.readPressure() / 100.0F;
  bool ok = !isnan(t) && t > -10 && t < 60 && h >= 0 && h <= 100 && p > 850 && p < 1100;
  Serial.printf("[%s] %s  %.2f°C  %.2f%%RH  %.2fhPa\n", name, ok ? "PASS" : "FAIL", t, h, p);
  return ok;
}

// 0이나 4095에 붙어 있으면 단선·전원 문제일 가능성이 높다
bool checkMq(int pin, const char* name) {
  int v = analogRead(pin);
  bool ok = v > 0 && v < 4095;
  Serial.printf("[%s] %s  raw=%d\n", name, ok ? "PASS" : "FAIL", v);
  return ok;
}

void setup() {
  Serial.begin(115200);
  delay(1000);
  Wire.begin();
  I2C_OUT.begin(SDA2_PIN, SCL2_PIN);

  Serial.println("\n===== 센서 연결 테스트 =====");
  scan(Wire, "실내 버스 21/22");
  scan(I2C_OUT, "실외 버스 25/26");

  inOk  = bmeIn.begin(0x76);
  outOk = bmeOut.begin(0x76, &I2C_OUT);
  Serial.printf("[실내 BME280] begin %s\n", inOk ? "OK" : "실패");
  Serial.printf("[실외 BME280] begin %s\n", outOk ? "OK" : "실패");
}

void loop() {
  int fail = 0;
  if (!inOk  || !checkBme(bmeIn,  "실내 BME280")) fail++;
  if (!outOk || !checkBme(bmeOut, "실외 BME280")) fail++;
  if (inOk && outOk) {
    float diffPa = (bmeIn.readPressure() - bmeOut.readPressure());  // readPressure()는 Pa
    Serial.printf("[차압] %.1f Pa (같은 공간에 두면 0 근처여야 정상)\n", diffPa);
  }
  if (!checkMq(MQ2_PIN, "MQ-2")) fail++;
  if (!checkMq(MQ135_PIN, "MQ135")) fail++;
  Serial.println(fail ? "==> FAIL " + String(fail) + "개\n" : "==> 전부 PASS\n");
  delay(3000);
}
