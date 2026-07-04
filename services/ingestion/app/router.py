from fastapi import APIRouter
from app.schema import SensorData
from app.publisher import publish_sensor_data
import asyncpg
import os
from dotenv import load_dotenv

load_dotenv()
router = APIRouter()
DB_URL = os.getenv("DB_URL")

@router.post("/data")
async def receive_sensor_data(data: SensorData):
    conn = await asyncpg.connect(DB_URL)
    await conn.execute("""
        INSERT INTO sensor_data (device_id, temperature, humidity, pm25, gas)
        VALUES ($1, $2, $3, $4, $5)
    """, data.device_id, data.temperature, data.humidity, data.pm25, data.gas)
    await conn.close()
    await publish_sensor_data(data.model_dump())
    return {"status": "ok", "device_id": data.device_id}