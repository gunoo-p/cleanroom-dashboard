// BME280 1개만 점검하는 스케치 — WiFi/MQTT 없이. 시리얼 모니터 115200.
// 배선: SDA→GPIO21, SCL→GPIO22, VCC→3.3V, GND→GND (cleanroom_A.ino 실내 센서와 동일)
#include <Wire.h>
#include <Adafruit_BME280.h>

Adafruit_BME280 bme;
bool ok;

void setup() {
  Serial.begin(115200);
  delay(1000);
  Wire.begin();

  Serial.println("\n===== BME280 테스트 =====");
  Serial.print("I2C 스캔:");
  int found = 0;
  for (byte a = 1; a < 127; a++) {
    Wire.beginTransmission(a);
    if (Wire.endTransmission() == 0) { Serial.printf(" 0x%02X", a); found++; }
  }
  Serial.println(found ? "" : " 장치 없음 (SDA/SCL·전원 배선 확인)");

  // 모듈에 따라 0x76 또는 0x77 — 둘 다 시도
  ok = bme.begin(0x76) || bme.begin(0x77);
  Serial.println(ok ? "BME280 begin OK" : "BME280 begin 실패");
}

void loop() {
  if (!ok) { Serial.println("센서 인식 실패 — 배선 확인 후 리셋"); delay(3000); return; }
  // 기압은 해발 0~1000m 기준 대략 850~1100hPa, 온도·습도는 상식 범위
  float t = bme.readTemperature(), h = bme.readHumidity(), p = bme.readPressure() / 100.0F;
  bool pass = !isnan(t) && t > -10 && t < 60 && h >= 0 && h <= 100 && p > 850 && p < 1100;
  Serial.printf("%s  %.2f°C  %.2f%%RH  %.2fhPa\n", pass ? "PASS" : "FAIL", t, h, p);
  delay(3000);
}
