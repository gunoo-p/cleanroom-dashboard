from pydantic import BaseModel
from typing import Optional
from datetime import datetime

class SensorData(BaseModel):
    device_id: str
    temperature: Optional[float] = None
    humidity: Optional[float] = None
    pm25: Optional[float] = None
    gas: Optional[float] = None