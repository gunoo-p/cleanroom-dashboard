import asyncpg
import os
from dotenv import load_dotenv

load_dotenv()
DB_URL = os.getenv("DB_URL")

async def get_sensor_history(device_id: str, limit: int = 100):
    conn = await asyncpg.connect(DB_URL)
    rows = await conn.fetch("""
        SELECT time, device_id, temperature, humidity, pm25, gas
        FROM sensor_data
        WHERE device_id = $1
        ORDER BY time DESC
        LIMIT $2
    """, device_id, limit)
    await conn.close()
    return [dict(row) for row in rows]

async def get_latest_by_device(device_id: str):
    conn = await asyncpg.connect(DB_URL)
    row = await conn.fetchrow("""
        SELECT time, device_id, temperature, humidity, pm25, gas
        FROM sensor_data
        WHERE device_id = $1
        ORDER BY time DESC
        LIMIT 1
    """, device_id)
    await conn.close()
    return dict(row) if row else None

async def get_all_devices():
    conn = await asyncpg.connect(DB_URL)
    rows = await conn.fetch("""
        SELECT DISTINCT device_id FROM sensor_data
    """)
    await conn.close()
    return [row["device_id"] for row in rows]