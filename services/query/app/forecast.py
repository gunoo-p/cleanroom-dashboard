import math
import warnings
from datetime import datetime, timedelta
from typing import List, Optional, Tuple

import numpy as np
from statsmodels.tsa.holtwinters import ExponentialSmoothing

MIN_POINTS = 10


def forecast_series(
    times: List[datetime],
    values: List[Optional[float]],
    interval_minutes: int,
    horizon_steps: int,
) -> Tuple[List[dict], str]:
    pairs = [(t, v) for t, v in zip(times, values) if v is not None]
    if len(pairs) < MIN_POINTS:
        return [], ""
    y = np.array([v for _, v in pairs], dtype=float)
    period = 1440 // interval_minutes
    # 일주기를 배우려면 하루치가 최소 두 번은 있어야 한다.
    seasonal = len(y) >= 2 * period and period >= 2

    try:
        with warnings.catch_warnings():
            warnings.simplefilter("ignore")
            fit = ExponentialSmoothing(
                y,
                trend="add",
                damped_trend=True,
                seasonal="add" if seasonal else None,
                seasonal_periods=period if seasonal else None,
            ).fit()
        pred = fit.forecast(horizon_steps)
        std = float(np.std(fit.resid))
    except Exception:
        return [], ""

    last = pairs[-1][0]
    points = []
    for k, value in enumerate(pred, start=1):
        margin = 1.96 * std * math.sqrt(k)
        p = {
            "t": (last + timedelta(minutes=interval_minutes * k)).isoformat(),
            "value": float(value),
            "lower": float(value - margin),
            "upper": float(value + margin),
        }
        if not all(math.isfinite(p[key]) for key in ("value", "lower", "upper")):
            return [], ""
        points.append(p)
    return points, "Holt-Winters (추세+일주기)" if seasonal else "Holt-Winters (추세)"
