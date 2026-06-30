from fastapi import APIRouter, HTTPException
from app.repository import get_sensor_history, get_latest_by_device, get_all_devices

router = APIRouter()

@router.get("/devices")
async def list_devices():
    return await get_all_devices()

@router.get("/sensors/{device_id}/history")
async def sensor_history(device_id: str, limit: int = 100):
    data = await get_sensor_history(device_id, limit)
    if not data:
        raise HTTPException(status_code=404, detail="데이터 없음")
    return data

@router.get("/sensors/{device_id}/latest")
async def sensor_latest(device_id: str):
    data = await get_latest_by_device(device_id)
    if not data:
        raise HTTPException(status_code=404, detail="데이터 없음")
    return data