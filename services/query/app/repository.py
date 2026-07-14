import asyncpg
import os
from datetime import datetime, timedelta
from typing import Optional
from dotenv import load_dotenv

load_dotenv()
DB_URL = os.getenv("DB_URL")

pool: Optional[asyncpg.Pool] = None

async def init_pool():
    global pool
    pool = await asyncpg.create_pool(DB_URL, min_size=1, max_size=10)

async def close_pool():
    global pool
    if pool is not None:
        await pool.close()
        pool = None

async def get_sensor_history(
    device_id: str,
    limit: int = 100,
    from_time: Optional[datetime] = None,
    to_time: Optional[datetime] = None,
    interval_minutes: Optional[int] = None,
):
    if from_time is not None and to_time is not None:
        if interval_minutes:
            rows = await pool.fetch("""
                SELECT time_bucket($1::interval, time) AS time,
                       device_id,
                       avg(temperature) AS temperature,
                       avg(humidity) AS humidity,
                       avg(pressure) AS pressure,
                       avg(pressure_outside) AS pressure_outside,
                       avg(gas) AS gas,
                       avg(air_quality) AS air_quality
                FROM sensor_data
                WHERE device_id = $2 AND time BETWEEN $3 AND $4
                GROUP BY 1, device_id
                ORDER BY 1
            """, timedelta(minutes=interval_minutes), device_id, from_time, to_time)
        else:
            rows = await pool.fetch("""
                SELECT time, device_id, temperature, humidity, pressure, pressure_outside, gas, air_quality
                FROM sensor_data
                WHERE device_id = $1 AND time BETWEEN $2 AND $3
                ORDER BY time
            """, device_id, from_time, to_time)
    else:
        rows = await pool.fetch("""
            SELECT time, device_id, temperature, humidity, pressure, pressure_outside, gas, air_quality
            FROM sensor_data
            WHERE device_id = $1
            ORDER BY time DESC
            LIMIT $2
        """, device_id, limit)
    return [dict(row) for row in rows]

async def get_latest_by_device(device_id: str):
    row = await pool.fetchrow("""
        SELECT time, device_id, temperature, humidity, pressure, pressure_outside, gas, air_quality
        FROM sensor_data
        WHERE device_id = $1
        ORDER BY time DESC
        LIMIT 1
    """, device_id)
    return dict(row) if row else None

async def get_all_devices():
    rows = await pool.fetch("""
        SELECT device_id
        FROM sensor_data
        GROUP BY device_id
        ORDER BY max(time) DESC
    """)
    return [row["device_id"] for row in rows]