from datetime import datetime
from typing import List, Optional
from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel
from app.repository import get_sensor_history, get_latest_by_device, get_all_devices
from app.ai_summary import generate_day_summary

router = APIRouter()


class SensorSummaryCount(BaseModel):
    sensor: str
    danger: int
    warning: int


class DaySummaryRequest(BaseModel):
    date: str
    zone_label: str
    danger: int
    warning: int
    normal: int
    by_sensor: List[SensorSummaryCount]

@router.get("/devices")
async def list_devices():
    return await get_all_devices()

@router.get("/sensors/{device_id}/history")
async def sensor_history(
    device_id: str,
    limit: int = 100,
    from_: Optional[datetime] = Query(None, alias="from"),
    to: Optional[datetime] = None,
    interval_minutes: Optional[int] = None,
):
    data = await get_sensor_history(device_id, limit, from_, to, interval_minutes)
    if not data:
        raise HTTPException(status_code=404, detail="데이터 없음")
    return data

@router.get("/sensors/{device_id}/latest")
async def sensor_latest(device_id: str):
    data = await get_latest_by_device(device_id)
    if not data:
        raise HTTPException(status_code=404, detail="데이터 없음")
    return data

@router.post("/logs/summary")
async def logs_summary(body: DaySummaryRequest):
    try:
        summary = await generate_day_summary(
            date=body.date,
            zone_label=body.zone_label,
            danger=body.danger,
            warning=body.warning,
            normal=body.normal,
            by_sensor=[s.model_dump() for s in body.by_sensor],
        )
    except Exception:
        raise HTTPException(status_code=502, detail="AI 요약 생성 실패")
    return {"summary": summary}