from pydantic import BaseModel
from typing import Optional
from datetime import datetime

class SensorData(BaseModel):
    device_id: str
    temperature: Optional[float] = None
    humidity: Optional[float] = None
    pressure: Optional[float] = None
    pressure_outside: Optional[float] = None
    gas: Optional[float] = None
    air_quality: Optional[float] = None