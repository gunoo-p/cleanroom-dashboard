# 프론트엔드

반도체 클린룸 모니터링 대시보드. 탭 2개로 구성된다.

- **대시보드(차트) 탭** (`src/chart/`): 실시간 센서값 · 시계열 차트 · 구역(zone) 선택
- **통계(분석) 탭** (`src/stats/`): 설비 이상 예측 · 공기질 추세 · 수율 상관관계

두 탭 다 백엔드(`/api/sensors/{device_id}/history`, `/api/sensors/{device_id}/latest`, `/api/devices`)에서 **원시 시계열만** 받아오고, 이동평균·회귀·상관계수 같은 파생 지표는 프론트에서 계산한다. API 연결이 안 되면 mock으로 조용히 넘어가지 않고 "연결 실패"를 명확히 표시한다 (신뢰할 수 없는 값을 진짜처럼 보여주지 않기 위함).

## 통계(분석) 탭 — 계산 방식

### 데이터 흐름

```
query 서비스 (/api/sensors/{id}/history)
        │ 원시 시계열 (temperature/humidity/pressure/gas/air_quality)
        ▼
src/stats/api.ts (fetchAnalysis)
        │ chart 모듈의 buildDashboardData()를 재사용해 defect_rate까지 계산
        ▼
AnalysisData { device_id, points }
        ▼
src/stats/deriveAnalysis.ts
        │ 이동평균 / 선형회귀 / 피어슨 상관계수 계산
        ▼
AnalysisView { equipmentAnomaly, trends, yieldCorrelation }
        ▼
StatsTab.tsx → 각 Panel 컴포넌트 렌더링
```

### 공용 계산 함수 (`src/stats/calc.ts`)

| 함수 | 하는 일 |
|---|---|
| `movingAverage(values, window)` | 단순 이동평균 — 순간 노이즈를 눌러 추세만 보이게 함 |
| `linearRegression(xs, ys)` | 최소제곱법 선형회귀. `{slope, intercept}` 반환 |
| `pearsonCorrelation(xs, ys)` | 피어슨 상관계수(-1~1) — 두 변수가 같이 움직이는 정도 |
| `etaToThreshold(current, threshold, rate)` | 지금 속도(rate)로 계속 가면 threshold까지 걸리는 시간. `rate<=0`이면 `null` |
| `mean(values)` | 평균 |

전부 이 프로젝트 전용 로직이 아니라 표준 통계 계산이라, 실측 데이터로 바뀌어도 그대로 재사용된다.

### 행 1: 설비 이상 예측 (`buildEquipmentAnomaly`)

최근 24시간 데이터로, 온도·가스 각각에 대해:
1. 이동평균(기본 6포인트 창)
2. 최근 8시간 구간만 선형회귀 → 시간당 변화율
3. 그 변화율로 위험 임계치까지 도달하는 예상 시간(ETA)
4. 변화율이 기준을 넘으면 "상승 추세 감지" 배지

→ "지금 위험한가"가 아니라 **"이대로 가면 위험해지는가"**를 보는 패널.

### 행 2: 공기질 추세 (`buildAirTrend`)

행 1과 같은 로직을 공기질(MQ135) 센서에 적용. (원래 있던 "필터 교체 예측" 카드는 근거 데이터가 없어져 제거됨 — 아래 한계 참고)

### 행 3: 수율 상관관계 (`buildYieldCorrelation`)

- **산점도 + 회귀선**: 습도 vs 불량률
- **상관계수 히트맵**: 5개 센서(온도/습도/가스/공기질/기압) 간 피어슨 상관계수 5×5 매트릭스
- **Top3 카드**: 불량률과 상관계수 절댓값이 가장 큰 센서 3개 + 습도 임계 초과 시 불량률 배수 배너

## ⚠️ 한계: `defect_rate`(불량률)는 실측이 아니다

이 탭의 핵심 축인 "불량률"은 실제 생산 불량 데이터가 아니라 임시 공식이다 (`src/chart/deriveDashboard.ts`):

```ts
// 교체 지점: 이 함수를 학습된 모델 점수로 대체한다
function computeDefectRate(humN, gasN) {
  return clamp((humN / 100) * (gasN / 100) * 135 - 18, 0, 100)
}
```

습도·가스가 그 구간 내에서 상대적으로 높으면 불량률도 높다고 **가정만** 해둔 것이다. 그래서 산점도·히트맵·Top3 카드는 전부 이 가짜 값에서 파생된 결과이고, 제목의 "SECOM 기반"은 UCI SECOM 데이터셋([참고자료](#참고자료) 1번)의 **분석 기법을 참고**했다는 뜻이지 그 데이터를 실제로 쓰고 있다는 뜻은 아니다. 실제 MES/검사 장비의 pass/fail 데이터가 들어오면 `computeDefectRate` 자리를 그 실측값(또는 그걸로 학습한 모델 점수)으로 교체해야 한다.

## 임계치 출처

| 센서 | 값 | 출처 | 신뢰도 |
|---|---|---|---|
| 온도 (대시보드 탭) | 정상 22.0±0.5℃ / 주의 ±1℃ / 경고 ±2℃ / 중단 그 이상 | 참고자료 2번 | 실측 반도체 클린룸 기준 |
| 습도 (대시보드 탭) | 정상 45%±2%RH / 주의 ±5% / 경고 ±10% / 중단 그 이상 | 참고자료 2번 | 실측 반도체 클린룸 기준 |
| 가연성가스 (MQ-2) | LEL 25%(1차)/50%(2차) 경보 | 참고자료 3번 | 공식 기준이지만, MQ-2가 raw ADC(0~4095)만 줘서 아직 %LEL로 환산 못 함(아래 참고) |
| 유해가스/공기질 (MQ135) | — | 참고자료 4번 (특정 물질 기준, 미적용) | ⚠️ placeholder만 있음. 특정 유해물질의 ppm 기준이라 raw ADC와 단위가 안 맞아 미적용 |
| 통계 탭 온도/가스/공기질 (`src/stats/config.ts`) | 자체 설정값 | — | ⚠️ placeholder. 대시보드 탭의 최신 실측 기준이 아직 반영 안 됨 |

**가스/공기질이 왜 아직 미적용인지**: MQ-2/MQ135는 `analogRead()`로 raw ADC(0~4095) 값만 주는데, 공식 임계치는 %LEL·ppm처럼 보정(calibration)된 단위다. 제조사(Winsen) 공식 매뉴얼([참고자료](#참고자료) 5, 6번)도 그래프 이미지만 제공할 뿐 변환 공식을 안 줘서, 표준가스 없이는 신뢰할 수 있는 raw→ppm 변환이 어렵다. 그래서 지금은 raw ADC 스케일의 임시 숫자만 들어가 있고, 나중에 베이스라인 대비 상대값(%) 방식으로 바꾸는 걸 검토 중이다.

## 참고자료

1. UCI Machine Learning Repository — SECOM Data Set. <https://archive.ics.uci.edu/ml/datasets/SECOM> (반도체 공정 센서-불량 공개 데이터셋. 이 프로젝트의 "수율 상관관계" 분석 기법 설계 참고용이며, 실제 데이터를 쓰지는 않음)
2. Air Innovations — "Semiconductor Trace Moisture". <https://airinnovations.com/blog/semiconductor-trace-moisture/> (반도체 클린룸 온습도 관리 기준: 정상/주의/경고/중단 4단계)
3. 한국산업안전보건공단(KOSHA) — KOSHA GUIDE P-166-2020, "가스누출감지경보기 설치 및 유지보수에 관한 기술지침" (2020.12). <https://www.kosha.or.kr/kosha/data/guidanceP.do> (가연성/독성 가스누출감지경보기 경보 설정 기준. 가연성가스는 LEL 25%/50%, 독성가스는 ERPG-2/AEGL-2/IDLH 등 물질별 참조표 사용)
4. 한국산업안전보건공단(KOSHA) — KOSHA GUIDE P-46-2012, "클린룸의 안전관리에 관한 기술지침" (사내 자료로 확인, 공개 URL 미확인 — 특정 유해물질의 ppm 경보 기준 표 포함)
5. Zhengzhou Winsen Electronics — MQ-2 Semiconductor Sensor for Flammable Gas, Manual v1.6 (2021-07-01). <https://www.winsen-sensor.com/d/files/newpdf/mq-2-(ver1_6)---manual.pdf>
6. Zhengzhou Winsen Electronics — MQ135 Semiconductor Sensor for Air Quality, Manual v1.4. <https://www.winsen-sensor.com/d/files/PDF/Semiconductor%20Gas%20Sensor/MQ135%20(Ver1.4)%20-%20Manual.pdf>
