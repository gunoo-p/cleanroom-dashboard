# forecast_series 자체 점검. pytest 없이 실행: python -m tests.test_forecast
import math
from datetime import datetime, timedelta

from app.forecast import forecast_series

START = datetime(2026, 11, 16, 0, 0)


def make_times(n, interval=15):
    return [START + timedelta(minutes=interval * i) for i in range(n)]


def test_trend_with_daily_cycle():
    times = make_times(288)
    values = [20 + 0.01 * i + math.sin(2 * math.pi * i / 96) for i in range(288)]
    points, label = forecast_series(times, values, 15, 24)
    assert len(points) == 24
    assert all(p["lower"] <= p["value"] <= p["upper"] for p in points)
    assert "일주기" in label
    assert points[0]["t"] == (times[-1] + timedelta(minutes=15)).isoformat()


def test_short_series_no_season():
    points, label = forecast_series(make_times(40), [20 + 0.1 * i for i in range(40)], 15, 24)
    assert len(points) == 24
    assert label == "Holt-Winters (추세)"


def test_too_few_points():
    assert forecast_series(make_times(9), [1.0] * 9, 15, 24) == ([], "")


def test_none_values_skipped():
    values = [20 + 0.1 * i for i in range(40)]
    for i in (3, 10, 17, 25, 33):
        values[i] = None
    points, _ = forecast_series(make_times(40), values, 15, 24)
    assert len(points) == 24


def test_constant_series_finite():
    points, _ = forecast_series(make_times(40), [100.0] * 40, 15, 24)
    assert all(math.isfinite(p[k]) for p in points for k in ("value", "lower", "upper"))


if __name__ == "__main__":
    for name, fn in list(globals().items()):
        if name.startswith("test_"):
            fn()
            print("ok", name)
