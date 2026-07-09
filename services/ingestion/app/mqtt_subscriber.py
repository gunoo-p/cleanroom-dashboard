import asyncio
import json
import os
import aiomqtt
from dotenv import load_dotenv
from app.ingest import save_reading

load_dotenv()
MQTT_HOST = os.getenv("MQTT_HOST", "localhost")
MQTT_PORT = int(os.getenv("MQTT_PORT", "1883"))
MQTT_TOPIC = "cleanroom/sensors"
RECONNECT_SECONDS = 5

async def _handle_message(message: aiomqtt.Message):
    try:
        payload = json.loads(message.payload)
    except (json.JSONDecodeError, TypeError):
        print(f"MQTT 페이로드 파싱 실패: {message.payload!r}")
        return

    device_id = payload.get("device_id")
    if not device_id:
        print(f"MQTT 페이로드에 device_id 없음: {payload!r}")
        return

    await save_reading(
        device_id,
        payload.get("temperature"),
        payload.get("humidity"),
        payload.get("pressure"),
        payload.get("mq2_raw"),
        payload.get("mq135_raw"),
    )

async def mqtt_listen_forever():
    # 브로커 연결이 끊겨도 태스크 자체가 죽지 않도록 계속 재연결한다.
    while True:
        try:
            async with aiomqtt.Client(MQTT_HOST, MQTT_PORT) as client:
                await client.subscribe(MQTT_TOPIC)
                print(f"MQTT 구독 시작: {MQTT_HOST}:{MQTT_PORT} ({MQTT_TOPIC})")
                async for message in client.messages:
                    await _handle_message(message)
        except asyncio.CancelledError:
            raise
        except Exception as e:
            print(f"MQTT 연결 오류: {e} - {RECONNECT_SECONDS}초 후 재연결")
            await asyncio.sleep(RECONNECT_SECONDS)
