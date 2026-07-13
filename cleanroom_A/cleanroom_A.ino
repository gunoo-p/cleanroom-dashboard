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

Adafruit_BME280 bme;
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

  if (!bme.begin(0x76)) {  // 주소 0x76 또는 0x77
    Serial.println("BME280 인식 실패!");
    while (1);
  }
}

void loop() {
  if (!client.connected()) reconnect_mqtt();
  client.loop();

  // 센서 읽기
  float temperature = bme.readTemperature();
  float humidity    = bme.readHumidity();
  float pressure    = bme.readPressure() / 100.0F;  // hPa
  int   mq2_raw     = analogRead(MQ2_PIN);
  int   mq135_raw   = analogRead(MQ135_PIN);

  // JSON 생성
  char payload[256];
  snprintf(payload, sizeof(payload),
    "{\"device_id\":\"%s\",\"temperature\":%.2f,\"humidity\":%.2f,"
    "\"pressure\":%.2f,\"mq2_raw\":%d,\"mq135_raw\":%d}",
    device_id, temperature, humidity, pressure, mq2_raw, mq135_raw);

  // MQTT publish
  client.publish(topic, payload);
  Serial.println(payload);

  delay(INTERVAL);
}
