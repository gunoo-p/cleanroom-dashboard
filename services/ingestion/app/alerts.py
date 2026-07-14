import os
import httpx

TELEGRAM_BOT_TOKEN = os.getenv("TELEGRAM_BOT_TOKEN")
TELEGRAM_CHAT_ID = os.getenv("TELEGRAM_CHAT_ID")

# 아래 임계치는 frontend/src/dashboard/deriveDashboard.ts의 statusFor()와 동일해야 한다.
# 프론트에서 임계치를 바꾸면 여기도 같이 바꿔야 대시보드 표시와 알림 발동 시점이 어긋나지 않는다.
LOW_IS_BAD = {"pressure"}

DEVIATION_THRESHOLDS = {
    "temp": {"center": 22.0, "caution": 0.5, "warning": 1.0, "danger": 2.0},
    "hum": {"center": 45, "caution": 2, "warning": 5, "danger": 10},
}

# pressure는 실내-실외 차압(Pa). ISO 14644 기준 클린룸 양압 권장치(ISO 7: +10~20Pa, ISO 8: +5~15Pa)를
# 참고해 10Pa 이상을 정상, 5~10Pa를 경고, 5Pa 미만(0 이하 포함, 양압 붕괴)을 위험으로 잡음.
DIRECT_THRESHOLDS = {
    "gas": {"warning": 2000, "danger": 3000},
    "pm": {"warning": 2000, "danger": 3000},
    "pressure": {"warning": 10, "danger": 5},
}

SENSOR_LABELS = {"temp": "온도", "hum": "습도", "gas": "가스", "pm": "공기질", "pressure": "차압"}
SENSOR_UNITS = {"temp": "°C", "hum": "%", "gas": "", "pm": "", "pressure": "Pa"}
FIELD_TO_KEY = {"temperature": "temp", "humidity": "hum", "gas": "gas", "air_quality": "pm", "pressure_diff": "pressure"}


def status_for(key: str, value: float) -> str:
    dev = DEVIATION_THRESHOLDS.get(key)
    if dev:
        d = abs(value - dev["center"])
        if d > dev["danger"]:
            return "danger"
        if d > dev["warning"]:
            return "warning"
        if d > dev["caution"]:
            return "caution"
        return "normal"
    t = DIRECT_THRESHOLDS[key]
    if key in LOW_IS_BAD:
        return "danger" if value < t["danger"] else "warning" if value < t["warning"] else "normal"
    return "danger" if value > t["danger"] else "warning" if value > t["warning"] else "normal"


# 대시보드 카드에 뜨는 라벨과 동일한 문구(frontend/src/dashboard/deriveDashboard.ts의 normalRangeLabel)
# — 여기서도 임계치를 텍스트로 보여줘야 알림만 보고도 얼마나 벗어난 건지 알 수 있다.
def normal_range_label(key: str) -> str:
    unit = SENSOR_UNITS[key]
    dev = DEVIATION_THRESHOLDS.get(key)
    if dev:
        lo = dev["center"] - dev["caution"]
        hi = dev["center"] + dev["caution"]
        return f"정상 {lo:.1f}~{hi:.1f}{unit}"
    t = DIRECT_THRESHOLDS[key]
    return f"정상 {t['warning']}{unit} 이상" if key in LOW_IS_BAD else f"정상 {t['warning']}{unit} 이하"


# 프로세스 재시작하면 초기화되는 인메모리 상태 — 재시작 직후 이미 위험/경고 상태면 바로 한 번
# 더 알리게 되지만(아래 분기 참고), 놓치는 것보다 중복이 훨씬 나아서 감수 가능한 수준.
_last_alert_status: dict[tuple[str, str], str] = {}


async def check_and_alert(device_id: str, fields: dict):
    if not TELEGRAM_BOT_TOKEN or not TELEGRAM_CHAT_ID:
        return

    # 실내(pressure)·실외(pressure_outside) 절대기압 자체는 날씨에 따라 같이 오르내려서 의미가 없고,
    # 그 차이(hPa→Pa 변환)만 실제 클린룸 양압 상태를 반영한다.
    pressure = fields.get("pressure")
    pressure_outside = fields.get("pressure_outside")
    fields = {
        **fields,
        "pressure_diff": (pressure - pressure_outside) * 100 if pressure is not None and pressure_outside is not None else None,
    }

    for field, key in FIELD_TO_KEY.items():
        value = fields.get(field)
        if value is None:
            continue

        status = status_for(key, value)
        # caution은 대시보드에서도 "정상"에 가까운 낮은 단계라 알림 대상에서는 정상과 동일하게 취급한다.
        alert_status = status if status in ("warning", "danger") else "normal"

        cache_key = (device_id, key)
        prev = _last_alert_status.get(cache_key)
        _last_alert_status[cache_key] = alert_status

        # 상태가 바뀐 순간(엣지)에만 보낸다 — 위험/정상이 계속 유지되는 동안 매번 보내면 스팸이 된다.
        # 단, 서비스가 막 시작돼 이전 상태(prev)를 모르는 경우(prev is None)는 "정상이었다"로
        # 가정하지 않는다 — 이미 위험/경고 상태로 떠 있는데 그걸 놓치고 다음 전환까지 무한정
        # 조용히 있으면 안 되므로, 이 경우 현재 상태가 정상이 아니면 바로 한 번 알린다.
        if prev == alert_status:
            continue
        if prev is None and alert_status == "normal":
            continue

        await _send(device_id, key, alert_status, value)


async def _send(device_id: str, key: str, alert_status: str, value: float):
    label = SENSOR_LABELS[key]
    unit = SENSOR_UNITS[key]
    decimals = 0 if key == "gas" else 1
    value_text = f"{value:.{decimals}f}{unit}"

    range_text = normal_range_label(key)
    if alert_status == "normal":
        text = f"✅ [{device_id}] {label} 정상 범위로 복귀 ({value_text} · {range_text})"
    else:
        emoji = "🔴" if alert_status == "danger" else "🟡"
        level = "위험" if alert_status == "danger" else "경고"
        text = f"{emoji} [{device_id}] {label} {level} 임계 초과 ({value_text} · {range_text})"

    url = f"https://api.telegram.org/bot{TELEGRAM_BOT_TOKEN}/sendMessage"
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            await client.post(url, json={"chat_id": TELEGRAM_CHAT_ID, "text": text})
    except Exception as e:
        print(f"텔레그램 알림 발송 실패: {e}")