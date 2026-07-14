#include <WiFi.h>
#include <PubSubClient.h>
#include <Wire.h>
#include <Adafruit_BME280.h>

// ── 설정 ──────────────────────────
const char* ssid        = "";  // WiFi 이름
const char* password    = "";  // WiFi 비밀번호
const char* mqtt_server = "";  // 서버 IP
const int   mqtt_port   = 1883;
const char* topic       = "cleanroom/sensors";
const char* device_id   = "esp32-A1";

#define MQ2_PIN   34
#define MQ135_PIN 33
#define INTERVAL  1000  // 3초

// 실외 BME280용 2번째 I2C 버스 핀. 두 센서 모두 SDO 핀이 없는 4핀 모듈이라 주소가 둘 다 0x76으로
// 고정돼 있음 — 같은 버스에 물리면 주소가 겹쳐서 안 되니, 버스 자체를 분리해서 둘 다 0x76 그대로 쓴다.
#define SDA2_PIN 25
#define SCL2_PIN 26

Adafruit_BME280 bmeIn;
Adafruit_BME280 bmeOut;
TwoWire I2C_OUT = TwoWire(1);
WiFiClient espClient;
PubSubClient client(espClient);

void setup_wifi() {
  WiFi.begin(ssid, password);
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.println("\nWiFi 연결됨: " + WiFi.localIP().toString());
}

void reconnect_mqtt() {
  while (!client.connected()) {
    if (client.connect(device_id)) {
      Serial.println("MQTT 연결됨");
    } else {
      Serial.print("MQTT 실패 rc=");
      Serial.println(client.state());
      delay(2000);
    }
  }
}

void setup() {
  Serial.begin(115200);
  setup_wifi();
  client.setServer(mqtt_server, mqtt_port);

  if (!bmeIn.begin(0x76)) {  // 실내: 기본 I2C 버스(GPIO21/22)
    Serial.println("실내 BME280 인식 실패!");
    while (1);
  }

  I2C_OUT.begin(SDA2_PIN, SCL2_PIN);
  if (!bmeOut.begin(0x76, &I2C_OUT)) {  // 실외: 2번째 I2C 버스(GPIO25/26), 같은 주소 0x76 그대로
    Serial.println("실외 BME280 인식 실패!");
    while (1);
  }
}

void loop() {
  if (!client.connected()) reconnect_mqtt();
  client.loop();

  // 센서 읽기
  float temperature     = bmeIn.readTemperature();
  float humidity        = bmeIn.readHumidity();
  float pressure        = bmeIn.readPressure() / 100.0F;   // hPa, 실내
  float pressureOutside = bmeOut.readPressure() / 100.0F;  // hPa, 실외(차압 계산용 기준값)
  int   mq2_raw     = analogRead(MQ2_PIN);
  int   mq135_raw   = analogRead(MQ135_PIN);

  // JSON 생성
  char payload[300];
  snprintf(payload, sizeof(payload),
    "{\"device_id\":\"%s\",\"temperature\":%.2f,\"humidity\":%.2f,"
    "\"pressure\":%.2f,\"pressure_outside\":%.2f,\"mq2_raw\":%d,\"mq135_raw\":%d}",
    device_id, temperature, humidity, pressure, pressureOutside, mq2_raw, mq135_raw);

  // MQTT publish
  client.publish(topic, payload);
  Serial.println(payload);

  delay(INTERVAL);
}
