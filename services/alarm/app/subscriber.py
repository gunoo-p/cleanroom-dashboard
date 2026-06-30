import redis.asyncio as r
import json
from app.detector import detect_alarm

REDIS_URL = "redis://localhost:6379"

async def start_subscriber():
    client = r.from_url(REDIS_URL)
    pubsub = client.pubsub()
    await pubsub.subscribe("sensor_data")
    print("Alarm Service 구독 시작...")

    async for message in pubsub.listen():
        if message["type"] != "message":
            continue
        data = json.loads(message["data"])
        alarms = detect_alarm(data)
        for alarm in alarms:
            print(f"[{alarm['level'].upper()}] {alarm['device_id']} - {alarm['metric']}: {alarm['value']}")
            await client.publish("alerts", json.dumps(alarm))