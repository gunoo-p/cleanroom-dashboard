from fastapi import APIRouter
from app.schema import SensorData
from app.ingest import save_reading

router = APIRouter()

@router.post("/data")
async def receive_sensor_data(data: SensorData):
    await save_reading(
        data.device_id, data.temperature, data.humidity,
        data.pressure, data.gas, data.air_quality,
    )
    return {"status": "ok", "device_id": data.device_id}
