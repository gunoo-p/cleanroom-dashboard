# 통계탭 AI 예측·해설 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 통계탭 추세 차트에 Holt-Winters AI 예측 점선·신뢰 구간을 그리고, Gemini 해설 카드 "AI 분석"을 추가한다.

**Architecture:** query 서비스(FastAPI)에 statsmodels 예측 엔드포인트와 Gemini 해설 엔드포인트를 추가한다. 프론트는 기존 분석 데이터와 별개의 `useQuery` 두 개로 이를 불러와, 실패해도 기존 화면은 그대로 둔다. 임계치는 프론트 `config.ts`에만 있으므로 해설 요청 본문은 프론트가 만든다(`/logs/summary`와 같은 패턴).

**Tech Stack:** Python 3.9, FastAPI, statsmodels/numpy/pandas/scipy, httpx(Gemini) / React 18, @tanstack/react-query 5, recharts 3

**Spec:** `docs/superpowers/specs/2026-11-19-ai-forecast-design.md`

## Global Constraints
- query 서비스 이미지는 `python:3.9-slim` — 새 의존성은 Python 3.9 휠이 있는 버전으로 고정: `numpy==1.26.4`, `pandas==2.2.3`, `scipy==1.13.1`, `statsmodels==0.14.4`.
- 임계치는 `frontend/src/analysis/config.ts`가 단일 출처. 백엔드로 복사하지 않는다.
- Gemini 호출은 `services/query/app/ai_summary.py`의 기존 상수·패턴(`GEMINI_URL`, `x-goog-api-key`, `thinkingLevel: "minimal"`)을 재사용한다.
- 기존 선형회귀 배지·ETA·차트 고정 Y축 범위(`axisMin/axisMax`)는 바꾸지 않는다.
- 해설은 10분 캐시, 자동 재요청 없음. 예측은 기존과 같은 60초 갱신.
- 화면 문구: 카드 제목 `AI 분석`, 범례 `AI 예측` / `신뢰 구간`, 모델 표기 `Holt-Winters 지수평활 · statsmodels`, `Gemini`, 로딩 `AI가 분석 중...`, 실패 `AI 해설을 불러오지 못했습니다`.

## Review Focus
1. Gemini 키가 없거나 503 → 카드에만 실패 문구, 다른 패널은 정상 (Task 5 확인 단계).
2. 데이터가 없는 구역(C·D, history 404) → 예측 엔드포인트 404, 프론트는 예측선 없이 기존 화면 유지 (Task 4 확인 단계).
3. 행에 `None`이 섞임(예: `pressure_outside` 결측) → 그 센서에서만 해당 행을 빼고 예측 (Task 1 테스트).
4. 값이 일정한 시계열(가스가 평평) → 예외 없이 유한한 값 또는 빈 결과, 응답 JSON에 NaN 없음 (Task 1 테스트).
5. 신뢰 구간이 고정 Y축 범위를 넘음 → 축이 늘어나지 않고 잘림(`YAxis allowDataOverflow`) (Task 4 확인 단계).

---

### Task 1: 예측 함수 `forecast_series`

**Files:**
- Modify: `services/query/requirements.txt` (Global Constraints의 4개 추가)
- Create: `services/query/app/forecast.py`
- Test: `services/query/tests/__init__.py`(빈 파일), `services/query/tests/test_forecast.py`

**Interfaces:**
- Produces: `forecast_series(times: list[datetime], values: list[Optional[float]], interval_minutes: int, horizon_steps: int) -> tuple[list[dict], str]`
  - 반환 `([{"t": str(ISO), "value": float, "lower": float, "upper": float}, ...], model_label)`.
  - `t`는 마지막 시각 + `interval_minutes × k`(k=1..horizon_steps), `datetime.isoformat()`.
  - `model_label`: 계절성 사용 시 `"Holt-Winters (추세+일주기)"`, 아니면 `"Holt-Winters (추세)"`. 결과가 비면 `""`.

- [ ] **Step 1: 실패하는 테스트 작성** — pytest 없이 assert + `if __name__ == "__main__":`로 함수들을 차례로 호출.
  - `test_trend_with_daily_cycle`: 15분 간격 3일치(96×3 = 288포인트), `value = 20 + 0.01*i + sin(2π·i/96)`, horizon 24 → 결과 24개, 모든 `lower <= value <= upper`, label에 `"일주기"` 포함, 첫 `t`가 마지막 입력 시각 + 15분.
  - `test_short_series_no_season`: 15분 간격 40포인트 → 결과 24개, label == `"Holt-Winters (추세)"`.
  - `test_too_few_points`: 9포인트 → `([], "")`.
  - `test_none_values_skipped`: 40포인트 중 5개 `None` → 예외 없음, 결과 24개.
  - `test_constant_series_finite`: 40포인트 모두 `100.0` → 예외 없음, 결과가 비었거나 모든 값이 `math.isfinite`.
- [ ] **Step 2: 실패 확인**
  Run: `docker compose build query && docker compose run --rm -v "$PWD/services/query/tests:/app/tests" query python -m tests.test_forecast`
  Expected: `ModuleNotFoundError: No module named 'app.forecast'`
- [ ] **Step 3: `forecast_series` 구현** — `None`인 쌍은 먼저 제거, 남은 포인트 < 10이면 빈 결과. `ExponentialSmoothing(trend="add", damped_trend=True, seasonal="add" if n >= 2*period else None, seasonal_periods=period)`, `period = 1440 // interval_minutes`. 신뢰 구간 = `1.96 × std(resid) × sqrt(k)`. `warnings`는 억제하고, 적합 중 예외나 비유한 값이 나오면 빈 결과.
- [ ] **Step 4: 통과 확인** — Step 2 명령, Expected: 에러 없이 종료(코드 0).
- [ ] **Step 5: Commit** `feat(query): Holt-Winters 예측 함수 추가`

### Task 2: 예측·해설 엔드포인트

**Files:**
- Modify: `services/query/app/router.py`
- Modify: `services/query/app/ai_summary.py`

**Interfaces:**
- Consumes: `forecast_series` (Task 1), `get_sensor_history(device_id, limit, from_time, to_time, interval_minutes)`
- Produces:
  - `GET /api/analysis/{device_id}/forecast?from=&to=&interval_minutes=` (세 값 모두 필수) → `{"series": {"temp"|"gas"|"pm"|"pressure": {"model": str, "points": [{t,value,lower,upper}]}}}`. history가 비면 404 `"데이터 없음"`.
    - `pm` = `air_quality`, `pressure` = `(pressure - pressure_outside) * 100`(둘 중 하나라도 None이면 None).
    - `horizon_steps = max(1, round((to - from).total_seconds() / 60 / interval_minutes * 0.25))`.
  - `POST /api/analysis/insight` 본문 `InsightRequest {zone_label: str, period_label: str, sensors: List[InsightSensor]}`, `InsightSensor {sensor: str, unit: str, current: float, status: str, rate_per_hour: float, eta_hours: Optional[float], forecast_end: Optional[float]}` → `{"summary": str}`, 실패 시 502 `"AI 해설 생성 실패"`.
  - `ai_summary.generate_trend_insight(zone_label: str, period_label: str, sensors: list[dict]) -> str` — 기존 `generate_day_summary`와 같은 호출부. 프롬프트: 반도체 클린룸 담당자용, 한국어 2~3문장, 위험 방향으로 움직이는 센서와 AI 예측이 임계에 가까워지는지 위주, 마크다운 없이. Gemini 요청 부분은 두 함수가 공유하도록 작은 내부 함수(`_generate(prompt) -> str`)로 뽑는다.

- [ ] **Step 1: 구현** — 위 인터페이스 그대로. 예측은 CPU 작업이라 `await run_in_threadpool(...)`(starlette)로 감싼다.
- [ ] **Step 2: 확인**
  Run: `docker compose up -d --build query && curl -s "localhost:8000/api/analysis/esp32-B1/forecast?from=$(date -u -v-1d +%FT%TZ)&to=$(date -u +%FT%TZ)&interval_minutes=15" | python3 -c "import json,sys;d=json.load(sys.stdin)['series'];print({k:(v['model'],len(v['points'])) for k,v in d.items()})"`
  Expected: 네 키 모두 `points` 24개 근처, model 문자열 출력.
  Run: `curl -s -o /dev/null -w "%{http_code}" "localhost:8000/api/analysis/esp32-C1/forecast?from=2026-11-18T00:00:00Z&to=2026-11-19T00:00:00Z&interval_minutes=15"` → `404`
  Run: `curl -s -XPOST localhost:8000/api/analysis/insight -H 'content-type: application/json' -d '{"zone_label":"B구역","period_label":"1일","sensors":[{"sensor":"온도","unit":"°C","current":24.1,"status":"warning","rate_per_hour":0.7,"eta_hours":3.2,"forecast_end":25.9}]}'` → `{"summary": "..."}`(키가 없으면 502)
- [ ] **Step 3: Commit** `feat(query): AI 예측·해설 엔드포인트 추가`

### Task 3: 프론트 API·타입·상수

**Files:**
- Modify: `frontend/src/analysis/types.ts`, `frontend/src/analysis/api.ts`, `frontend/src/analysis/config.ts`

**Interfaces:**
- Produces:
  - `types.ts`: `ForecastPoint {t: string; value: number; lower: number; upper: number}`, `ForecastSeries {model: string; points: ForecastPoint[]}`, `type ForecastKey = 'temp' | 'gas' | 'pm' | 'pressure'`, `ForecastData {series: Record<ForecastKey, ForecastSeries>}`, `InsightSensor`, `InsightRequest`(Task 2와 같은 snake_case 필드).
  - `api.ts`: `fetchForecast(deviceId: string, period: AnalysisPeriodOption): Promise<ForecastData>`(`fetchAnalysis`와 같은 from/to/interval 계산), `fetchInsight(body: InsightRequest): Promise<string>`(logcalendar의 `fetchDaySummary`와 같은 방식).
  - `config.ts`: `AI = { forecastModel: 'Holt-Winters 지수평활 · statsmodels', insightModel: 'Gemini', insightStaleMs: 600_000 }`, `COLORS.forecast`(regression과 구분되는 색).
- [ ] **Step 1: 구현** — 계산 로직 없음(타입·fetch만).
- [ ] **Step 2: 확인** Run: `cd frontend && npm run build` → 성공.
- [ ] **Step 3: Commit** `feat(frontend): AI 예측·해설 API 타입 추가`

### Task 4: 차트에 예측 점선·신뢰 구간

**Files:**
- Modify: `frontend/src/analysis/components/TrendChart.tsx`, `TrendPanel.tsx`, `AnalysisPanel.tsx`, `frontend/src/analysis/AnalysisTab.tsx`

**Interfaces:**
- Consumes: `fetchForecast`, `ForecastData`, `ForecastPoint`, `COLORS.forecast` (Task 3)
- Produces: `TrendChartProps.forecast?: ForecastPoint[]`; `AnalysisPanel` Props에 `forecast?: ForecastData`; `TrendKey → ForecastKey` 매핑(`air → pm`, 나머지 동일)은 `AnalysisPanel.tsx`에.

- [ ] **Step 1: `AnalysisTab`** — `useQuery({queryKey: ['forecast', deviceId, period], queryFn: () => fetchForecast(deviceId, periodOption), refetchInterval: 60_000, retry: false})`, 결과를 그리드·확대 오버레이의 `AnalysisPanel` 양쪽에 `forecast`로 전달. 실패·로딩 시 `undefined`.
- [ ] **Step 2: `TrendChart`** — `forecast`가 있으면 차트 데이터 = `points` + 예측 행(`{t, forecast: value, band: [lower, upper]}`). 마지막 실측 행에도 `forecast: 마지막 ma`를 넣어 선이 끊기지 않게 한다. `Area dataKey="band"`(투명도 낮게) + `Line dataKey="forecast" strokeDasharray="5 4"`. `SERIES_LABEL`에 `forecast: 'AI 예측'`, `band: '신뢰 구간'`. Tooltip은 배열 값이면 `"lower~upper"`로 표시. `YAxis`에 `allowDataOverflow`. X축 `interval` 계산은 합친 데이터 길이 기준.
- [ ] **Step 3: 확인** — `npm run build` 성공 후 `npm run dev`로 통계탭: B구역 1일에서 4개 차트 끝에 점선+띠, 확대 시 범례에 `AI 예측`. C구역 선택 시 기존 "연결 실패" 화면 그대로(콘솔 에러로 탭이 깨지지 않음). 띠가 축 범위를 넘으면 잘리는지 확인.
- [ ] **Step 4: Commit** `feat(frontend): 추세 차트에 AI 예측선 표시`

### Task 5: "AI 분석" 해설 카드

**Files:**
- Create: `frontend/src/analysis/components/AiInsightCard.tsx`
- Modify: `frontend/src/analysis/deriveAnalysis.ts`, `components/AnalysisPanel.tsx`, `AnalysisTab.tsx`, `analysis.css`

**Interfaces:**
- Consumes: `fetchInsight`, `InsightRequest`, `ForecastData`, `AI` (Task 3), `forecast` 쿼리 (Task 4)
- Produces:
  - `deriveAnalysis.ts`: `buildInsightRequest(view: AnalysisView, forecast: ForecastData | undefined, zone: Zone, periodLabel: string): InsightRequest` — 4개 센서(온도·가스·공기질·차압), `current = latestValue`, `status = statusFor(key, latestValue)`, `rate_per_hour = ratePerHour`, `eta_hours = etaHours`, `forecast_end = 해당 예측 마지막 value ?? null`, 소수 1자리 반올림. `zone_label = \`${zone}구역\``.
  - `AiInsightCard({ state, summary, onClick, expanded })`, `state: 'loading' | 'error' | 'ready'` — `Panel` 재사용, 제목 `AI 분석`, 배지에 `Gemini`, 본문 문장, 하단에 `AI.forecastModel` / `AI.insightModel` 표기.
  - `PanelKey`에 `'insight'`, `PANEL_ROWS[1] = ['air', 'insight']`. `AnalysisPanel` Props에 `insight: { state, summary }`.
- [ ] **Step 1: `AnalysisTab`** — `useQuery({queryKey: ['insight', deviceId, period], queryFn: () => fetchInsight(buildInsightRequest(view!, forecast, zone, periodOption.label)), enabled: !!view && !forecastQuery.isPending, staleTime: AI.insightStaleMs, refetchInterval: false, refetchOnWindowFocus: false, retry: false})`.
- [ ] **Step 2: 카드·패널 연결** — 위 인터페이스대로. 스타일은 기존 패널 클래스 재사용, 필요한 최소 CSS만 `analysis.css`에.
- [ ] **Step 3: 확인** — `npm run build` 성공. 브라우저에서 B구역: 카드에 `AI가 분석 중...` → 문장 표시, 60초 지나도 Network 탭에 `/analysis/insight` 재요청 없음. `GEMINI_API_KEY` 없이 query를 띄우면 카드만 `AI 해설을 불러오지 못했습니다`, 나머지 패널 정상. 모바일 폭(390px)에서 2행 레이아웃 확인.
- [ ] **Step 4: Commit** `feat(frontend): Gemini AI 분석 카드 추가`
