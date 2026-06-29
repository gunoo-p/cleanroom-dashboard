import redis.asyncio as redis
import json
import os
from dotenv import load_dotenv

load_dotenv()
REDIS_URL = os.getenv("REDIS_URL")

async def publish_sensor_data(data: dict):
    r = redis.from_url(REDIS_URL)
    await r.publish("sensor_data", json.dumps(data))
    await r.aclose()