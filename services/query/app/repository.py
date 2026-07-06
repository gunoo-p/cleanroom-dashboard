import asyncpg
import os
from datetime import datetime, timedelta
from typing import Optional
from dotenv import load_dotenv

load_dotenv()
DB_URL = os.getenv("DB_URL")

async def get_sensor_history(
    device_id: str,
    limit: int = 100,
    from_time: Optional[datetime] = None,
    to_time: Optional[datetime] = None,
    interval_minutes: Optional[int] = None,
):
    conn = await asyncpg.connect(DB_URL)
    try:
        if from_time is not None and to_time is not None:
            if interval_minutes:
                rows = await conn.fetch("""
                    SELECT time_bucket($1::interval, time) AS time,
                           device_id,
                           avg(temperature) AS temperature,
                           avg(humidity) AS humidity,
                           avg(pm25) AS pm25,
                           avg(gas) AS gas
                    FROM sensor_data
                    WHERE device_id = $2 AND time BETWEEN $3 AND $4
                    GROUP BY 1, device_id
                    ORDER BY 1
                """, timedelta(minutes=interval_minutes), device_id, from_time, to_time)
            else:
                rows = await conn.fetch("""
                    SELECT time, device_id, temperature, humidity, pm25, gas
                    FROM sensor_data
                    WHERE device_id = $1 AND time BETWEEN $2 AND $3
                    ORDER BY time
                """, device_id, from_time, to_time)
        else:
            rows = await conn.fetch("""
                SELECT time, device_id, temperature, humidity, pm25, gas
                FROM sensor_data
                WHERE device_id = $1
                ORDER BY time DESC
                LIMIT $2
            """, device_id, limit)
    finally:
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