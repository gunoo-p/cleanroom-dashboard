# 통계탭 AI 예측 + AI 해설 설계

## 의도
통계탭에 "AI가 탑재되어 있다"는 것을 눈으로 보여 준다. 정확도 향상보다 **보이는 AI**와
**설명 가능한 모델 이름**("Python 서버에서 Holt-Winters 시계열 모델이 예측한다")이 목적이다.

## 목표
- 추세 차트 4개(온도·가스·공기질·차압) 끝에 **AI 예측 점선 + 신뢰 구간 띠**를 그린다.
- 통계탭에 **"AI 분석" 카드**를 추가해 Gemini가 현재 추세·예측을 2~3문장으로 해설한다.
- 카드에 사용 모델(`Holt-Winters 지수평활 · statsmodels`, `Gemini`)을 표시한다.

## 비목표
- 예측 정확도 검증·튜닝(실측 데이터가 이틀뿐이라 의미가 적다).
- 기존 선형회귀 기반 배지·ETA 교체. 그대로 둔다.
- 딥러닝(LSTM 등), 모델 학습 결과 저장.

## 안티 목표 (동작해도 실패인 것)
- AI 호출이 실패하면 통계탭 전체가 깨지는 것. 예측·해설은 실패해도 기존 화면은 그대로 보여야 한다.
- 60초마다 Gemini를 호출해 쿼터를 태우는 것.
- 예측 띠가 차트 Y축을 넓혀 기존 차트 가독성(PR #13 고정 범위)을 망치는 것.

## 제약
- query 서비스: Python 3.9(`python:3.9-slim`), FastAPI, asyncpg. 현재 계산 라이브러리 없음.
- 임계치는 프론트 `frontend/src/analysis/config.ts`가 단일 출처다. 백엔드로 복사하지 않는다.
- 데이터: `esp32-A1` 실측 약 2일, `esp32-B1` 시뮬 약 8일.
- Gemini 호출 패턴은 `services/query/app/ai_summary.py`를 따른다(`GEMINI_API_KEY`, lite 모델, minimal thinking).

## 접근 방식
| 안 | 내용 | 트레이드오프 |
|---|---|---|
| **A. 백엔드 ML + Gemini 해설 (선택)** | query 서비스에 statsmodels Holt-Winters 예측 엔드포인트, Gemini 해설 엔드포인트 | 모델 이름을 댈 수 있어 설득력 큼. 의존성으로 이미지 약 100MB 증가 |
| B. 브라우저 Holt 직접 구현 + 해설 | `calc.ts`에 이중 지수평활 20줄 | 빠르고 의존성 없음. "AI 모델"이라 하기엔 약함 |
| (탈락) Gemini가 숫자 예측 | | 숫자가 들쭉날쭉해 차트가 틀어지면 역효과 |
| (탈락) LSTM | | 데이터 부족, 과함 |

사용자가 목적("AI 탑재를 보여 주기")에 맞춰 A를 골랐다.

## 설계

### 백엔드 (`services/query`)
1. **의존성**: `requirements.txt`에 `numpy`, `pandas`, `scipy`, `statsmodels`를 Python 3.9 호환 버전으로 고정(statsmodels 0.14.x 계열).
2. **`app/forecast.py`** (새 파일): 순수 함수 `forecast_series(times, values, interval_minutes, horizon_steps)`.
   - `statsmodels.tsa.holtwinters.ExponentialSmoothing`, `trend="add"`, `damped_trend=True`.
   - 하루 주기 2번 이상 분량의 포인트가 있으면 `seasonal="add"`, `seasonal_periods = 1440 / interval_minutes`. 아니면 계절성 없이.
   - 포인트가 너무 적으면(예: 10개 미만) 빈 결과.
   - 신뢰 구간: 잔차 표준편차 × 1.96 × √h (h = 몇 스텝 뒤인지).
   - 반환: `[{t, value, lower, upper}]` + 사용한 모델 설명 문자열(예: `"Holt-Winters (추세+일주기)"`).
3. **`GET /analysis/{device_id}/forecast?from&to&interval_minutes`**: `get_sensor_history`로 원시 데이터를 읽고, 차압(Pa) = `(pressure - pressure_outside) * 100`을 계산(프론트 `api.ts`와 같은 식), `temp`·`gas`·`pm`(=`air_quality`)·`pressure` 네 시계열을 각각 예측해 돌려준다. 예측 길이: 최근 구간의 약 25%(기간 1일 → 6시간).
4. **`app/ai_summary.py`에 `generate_trend_insight(...)` 추가** + **`POST /analysis/insight`**: 프론트가 센서별 집계(현재값, 상태, 시간당 변화율, 위험 도달 예상, AI 예측 끝값)를 보내면 Gemini가 한국어 2~3문장으로 해설. 실패 시 502 (기존 `/logs/summary`와 동일).

### 프론트 (`frontend/src/analysis`)
1. **`api.ts`**: `fetchForecast(deviceId, period)`, `fetchInsight(body)` 추가.
2. **`AnalysisTab.tsx`**: 예측은 별도 `useQuery`(`['forecast', deviceId, period]`, 기존과 같은 60초 갱신). 실패해도 화면 유지.
   해설은 `useQuery`(`['insight', deviceId, period]`, `staleTime` 10분, 자동 재요청 없음). view가 준비된 뒤에만 요청.
3. **`TrendChart.tsx`**: 예측 점선(`Line`, `strokeDasharray`) + 신뢰 구간(`Area`). 범례 이름 "AI 예측". Y축은 기존 고정 범위(`axisMin/axisMax`)를 유지하고 띠가 넘치면 잘린다.
4. **새 패널 `insight`** (`components/AiInsightCard.tsx`): `PANEL_ROWS` 2행을 `['air', 'insight']`로. 제목 "AI 분석", 해설 문장, 하단에 모델 표기. 로딩 중 "AI가 분석 중..." / 실패 시 "AI 해설을 불러오지 못했습니다".
5. 모델 표기 문자열·예측 길이 등 상수는 `config.ts`에 둔다.

### 검증
- `forecast.py`에 작은 테스트 하나(합성 사인파 + 추세 → 예측 길이·구간 순서 lower ≤ value ≤ upper, 데이터 부족 시 빈 결과).
- 브라우저에서 1일/1주일/1개월, A구역(실측)·B구역(시뮬) 각각 확인. Gemini 키 없을 때 카드만 실패 문구가 나오는지 확인.

## 빌더에게 맡김
- 예측 띠·점선 색, 카드 세부 레이아웃(기존 `Panel`·`Badge` 재사용).
- statsmodels 수렴 경고 처리 방식(무시하되 예외는 빈 결과로).
- 해설 프롬프트 문구(`ai_summary.py` 기존 프롬프트 톤에 맞춤).
