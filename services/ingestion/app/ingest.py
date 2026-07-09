from app import db
from app.publisher import publish_sensor_data

async def save_reading(device_id: str, temperature, humidity, pressure, gas, air_quality):
    await db.pool.execute("""
        INSERT INTO sensor_data (device_id, temperature, humidity, pressure, gas, air_quality)
        VALUES ($1, $2, $3, $4, $5, $6)
    """, device_id, temperature, humidity, pressure, gas, air_quality)
    await publish_sensor_data({
        "device_id": device_id,
        "temperature": temperature,
        "humidity": humidity,
        "pressure": pressure,
        "gas": gas,
        "air_quality": air_quality,
    })
