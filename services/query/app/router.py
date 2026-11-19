from datetime import datetime
from typing import List, Optional
from fastapi import APIRouter, HTTPException, Query
from starlette.concurrency import run_in_threadpool
from pydantic import BaseModel
from app.repository import get_sensor_history, get_latest_by_device, get_all_devices
from app.ai_summary import generate_day_summary, generate_trend_insight
from app.forecast import forecast_series

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


class InsightSensor(BaseModel):
    sensor: str
    unit: str
    current: float
    status: str
    rate_per_hour: float
    eta_hours: Optional[float]
    forecast_end: Optional[float]


class InsightRequest(BaseModel):
    zone_label: str
    period_label: str
    sensors: List[InsightSensor]

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

def _pressure_diff_pa(row: dict) -> Optional[float]:
    if row["pressure"] is None or row["pressure_outside"] is None:
        return None
    return (row["pressure"] - row["pressure_outside"]) * 100


def _forecast_all(rows: list, interval_minutes: int, horizon_steps: int) -> dict:
    times = [r["time"] for r in rows]
    columns = {
        "temp": [r["temperature"] for r in rows],
        "gas": [r["gas"] for r in rows],
        "pm": [r["air_quality"] for r in rows],
        "pressure": [_pressure_diff_pa(r) for r in rows],
    }
    series = {}
    for key, values in columns.items():
        points, model = forecast_series(times, values, interval_minutes, horizon_steps)
        series[key] = {"model": model, "points": points}
    return series


@router.get("/analysis/{device_id}/forecast")
async def analysis_forecast(
    device_id: str,
    to: datetime,
    interval_minutes: int = Query(..., ge=1),
    from_: datetime = Query(..., alias="from"),
):
    rows = await get_sensor_history(device_id, 0, from_, to, interval_minutes)
    if not rows:
        raise HTTPException(status_code=404, detail="데이터 없음")
    # 조회 구간의 약 25%만큼 앞을 내다본다(1일 조회 → 6시간).
    horizon_steps = max(1, round((to - from_).total_seconds() / 60 / interval_minutes * 0.25))
    series = await run_in_threadpool(_forecast_all, rows, interval_minutes, horizon_steps)
    return {"series": series}


@router.post("/analysis/insight")
async def analysis_insight(body: InsightRequest):
    try:
        summary = await generate_trend_insight(
            zone_label=body.zone_label,
            period_label=body.period_label,
            sensors=[s.model_dump() for s in body.sensors],
        )
    except Exception:
        raise HTTPException(status_code=502, detail="AI 해설 생성 실패")
    return {"summary": summary}
