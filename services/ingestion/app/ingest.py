from app import db
from app.alerts import check_and_alert

async def save_reading(device_id: str, temperature, humidity, pressure, pressure_outside, gas, air_quality):
    await db.pool.execute("""
        INSERT INTO sensor_data (device_id, temperature, humidity, pressure, pressure_outside, gas, air_quality)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
    """, device_id, temperature, humidity, pressure, pressure_outside, gas, air_quality)
    await check_and_alert(device_id, {
        "temperature": temperature,
        "humidity": humidity,
        "pressure": pressure,
        "pressure_outside": pressure_outside,
        "gas": gas,
        "air_quality": air_quality,
    })
