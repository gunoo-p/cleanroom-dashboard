import os
import httpx

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
# 3.8-flash는 과부하(503)가 잦아 짧은 요약에 충분한 lite 모델을 쓴다.
GEMINI_MODEL = "gemini-3.5-flash-lite"
GEMINI_URL = f"https://generativelanguage.googleapis.com/v1beta/models/{GEMINI_MODEL}:generateContent"


async def generate_day_summary(
    date: str,
    zone_label: str,
    danger: int,
    warning: int,
    normal: int,
    by_sensor: list[dict],
) -> str:
    lines = [f"- {s['sensor']}: 위험 {s['danger']}건, 경고 {s['warning']}건" for s in by_sensor if s["danger"] or s["warning"]]
    breakdown = "\n".join(lines) if lines else "센서별 위험/경고 없음"

    prompt = (
        f"다음은 반도체 클린룸({zone_label}) {date}일자 센서 로그 집계입니다.\n"
        f"전체: 위험 {danger}건, 경고 {warning}건, 정상 {normal}건\n"
        f"센서별 위험/경고 내역:\n{breakdown}\n\n"
        "위 데이터를 바탕으로 담당자가 빠르게 상황을 파악할 수 있도록 한국어로 2~3문장의 자연스러운 요약을 작성하세요. "
        "숫자를 나열하기보다는 어떤 센서가 문제였는지, 얼마나 심각했는지 경향 위주로 설명하세요. "
        "위험/경고가 전혀 없었다면 정상적으로 유지되었다고 간단히 언급하세요. "
        "제목이나 마크다운 서식(#, *, - 등) 없이 순수한 문장 2~3개로만 답하세요."
    )

    if not GEMINI_API_KEY:
        raise RuntimeError("GEMINI_API_KEY가 설정되지 않음")

    async with httpx.AsyncClient(timeout=30.0) as client:
        response = await client.post(
            GEMINI_URL,
            headers={"x-goog-api-key": GEMINI_API_KEY},
            json={
                "contents": [{"parts": [{"text": prompt}]}],
                # thinking 토큰도 출력 한도에서 깎이므로 최소로 둬야 300토큰 안에 답이 잘리지 않는다.
                # 3.x 모델은 thinkingBudget을 400으로 거부하고 thinkingLevel만 받는다.
                "generationConfig": {"maxOutputTokens": 300, "thinkingConfig": {"thinkingLevel": "minimal"}},
            },
        )
        response.raise_for_status()
    parts = response.json().get("candidates", [{}])[0].get("content", {}).get("parts", [])
    return "".join(p.get("text", "") for p in parts).strip()
