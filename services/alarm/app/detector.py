from app.threshold import THRESHOLDS

def detect_alarm(data: dict) -> list:
    alarms = []
    for metric, threshold in THRESHOLDS.items():
        value = data.get(metric)
        if value is None:
            continue
        if value >= threshold["critical"]:
            alarms.append({
                "device_id": data["device_id"],
                "metric": metric,
                "value": value,
                "level": "critical"
            })
        elif value >= threshold["warning"]:
            alarms.append({
                "device_id": data["device_id"],
                "metric": metric,
                "value": value,
                "level": "warning"
            })
    return alarms