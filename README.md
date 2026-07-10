# 반도체 클린룸 모니터링 프로젝트

ESP32 센서(온도·습도·기압·가스·공기질)로 클린룸 환경을 실시간 모니터링하고, 추세 기반 설비 이상 예측·수율 상관관계를 보여주는 웹 대시보드.

## 아키텍처

```
ESP32 (BME280 + MQ-2 + MQ135)
        │  HTTP(POST /api/data) 또는 MQTT(cleanroom/sensors)
        ▼
┌────────────────┐      ┌────────────────┐
│   ingestion     │─────▶│  TimescaleDB    │
│ (FastAPI, 8001) │      │  (5433)         │
└────────────────┘      └────────────────┘
        │                        ▲
        ▼                        │
┌────────────────┐      ┌────────────────┐
│   mosquitto     │      │    query        │
│  (MQTT, 1883)   │      │ (FastAPI, 8000)  │
└────────────────┘      └────────────────┘
        ▲                        │
        │                        ▼
   ESP32 publish            frontend (Vite, 5173)
                             ├─ 대시보드(차트) 탭
                             └─ 통계(분석) 탭
```

- **ingestion**: 센서 데이터 수신(HTTP + MQTT) → TimescaleDB 저장 + Redis publish
- **query**: TimescaleDB 조회 API (기간별 조회, TimescaleDB `time_bucket` 집계 지원)
- **mosquitto**: MQTT 브로커 (`listener 1883`, `allow_anonymous true`)
- **frontend**: React + Vite. 실시간 대시보드와 통계(분석) 탭으로 구성

## 디렉토리 구조

```
services/ingestion/   # 센서 데이터 수신 (HTTP + MQTT)
services/query/       # 조회 API
infra/                # DB 초기화 스크립트, mosquitto 설정
frontend/             # React 대시보드
```

## 실행 방법

```bash
docker compose up -d --build   # timescaledb, redis, mosquitto, ingestion, query
cd frontend && npm install && npm run dev   # http://localhost:5173
```

## 센서 구성

| 센서 | 측정 항목 | 비고 |
|---|---|---|
| BME280 | 온도, 습도, 기압 | 실측 보정된 값 (°C, %RH, hPa) |
| MQ-2 | 가스(가연성) | raw ADC(0~4095), 아직 %LEL 미보정 |
| MQ135 | 공기질 | raw ADC(0~4095), 아직 ppm 미보정 |

DB 스키마(`infra/Init.sql`): `sensor_data(time, device_id, temperature, humidity, pressure, gas, air_quality)`.

## 프론트엔드

### 대시보드(차트) 탭 (`frontend/src/dashboard/`)

실시간 센서값 · 시계열 차트 · 구역(zone) 선택. 상단 숫자는 `/api/sensors/{id}/latest`를 3초마다 폴링해 체감 실시간성을 확보하고(차트 데이터는 무겁게 하지 않음), 차트는 `/api/sensors/{id}/history`를 10초마다 폴링한다.

온도/습도 상태는 반도체 클린룸 실측 기준 4단계(정상/주의/경고/중단, [참고자료](#참고자료) 1번)로 판정한다. 가스/공기질은 raw ADC 값에 대한 임시 placeholder 임계치만 있다.

### 통계(분석) 탭 (`frontend/src/analysis/`)

설비 이상 예측 · 공기질 추세 · 환경 안정성. 백엔드는 원시 시계열만 주고, 이동평균·회귀·상관계수 같은 파생 지표는 전부 프론트(`deriveAnalysis.ts`)에서 계산한다.

| 함수 (`calc.ts`) | 하는 일 |
|---|---|
| `movingAverage` | 이동평균 — 순간 노이즈를 눌러 추세만 보이게 함 |
| `linearRegression` | 최소제곱법 선형회귀 → 변화율(기울기) |
| `pearsonCorrelation` | 피어슨 상관계수(-1~1) |
| `etaToThreshold` | 현재 속도로 계속 가면 임계치까지 걸리는 시간 |

- **설비 이상 예측**: 조회 기간(1일/1주일/1개월, 탭 우측 상단에서 선택) 동안의 온도·가스 이동평균 + 최근 8시간 변화율 → 위험임계 도달 예상시간(ETA). "지금 위험한가"가 아니라 "이대로 가면 위험해지는가"를 본다.
- **공기질 추세**: 같은 로직을 MQ135(공기질)에 적용.
- **환경 안정성**: 기압(차압) 이동평균 추세 + 5개 센서 상관계수 히트맵. (원래 있던 "습도-불량률 상관관계"·"필터 교체 예측"은 근거 데이터가 없어져 제거됨)

각 패널의 계산법·예측 근거(왜 이 지표를 보는가)·신빙성(실측 검증된 것 vs 아직 가정인 것)은 [`frontend/analysis.md`](frontend/analysis.md)에 정리되어 있다.

## 참고자료

1. Air Innovations — "Semiconductor Trace Moisture". <https://airinnovations.com/blog/semiconductor-trace-moisture/> (반도체 클린룸 온습도 관리 기준: 정상/주의/경고/중단 4단계)
2. 한국산업안전보건공단(KOSHA) — KOSHA GUIDE P-166-2020, "가스누출감지경보기 설치 및 유지보수에 관한 기술지침" (2020.12). <https://www.kosha.or.kr/kosha/data/guidanceP.do> (가연성가스 LEL 25%/50% 경보, 독성가스 ERPG-2/AEGL-2/IDLH 등 물질별 참조표)
3. Zhengzhou Winsen Electronics — MQ-2 Semiconductor Sensor for Flammable Gas, Manual v1.6 (2021-07-01). <https://www.winsen-sensor.com/d/files/newpdf/mq-2-(ver1_6)---manual.pdf>
4. Zhengzhou Winsen Electronics — MQ135 Semiconductor Sensor for Air Quality, Manual v1.4. <https://www.winsen-sensor.com/d/files/PDF/Semiconductor%20Gas%20Sensor/MQ135%20(Ver1.4)%20-%20Manual.pdf>
