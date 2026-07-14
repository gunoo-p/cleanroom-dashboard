# 반도체 클린룸 모니터링 프로젝트

ESP32 센서(온도·습도·차압·가스·공기질)로 클린룸 환경을 실시간 모니터링하고, 추세 기반 설비 이상 예측·환경 안정성·과거 이벤트 로그를 보여주는 웹 대시보드. 임계치를 넘으면 텔레그램으로 알림이 가고, 하루치 로그는 Claude API로 자연어 요약을 받아볼 수 있다.

## 아키텍처

```
ESP32 (BME280×2 + MQ-2 + MQ135)
        │
        ├─ HTTP POST /api/data ──────────────┐
        └─ MQTT publish ──▶ mosquitto(1883) ─┤
                                              ▼
                                     ingestion (FastAPI, 8001)
                                              │  ├─▶ TimescaleDB(5433) 저장
                                              │  └─▶ 임계치 체크 → 텔레그램 알림
                                              ▼
                                     TimescaleDB(5433)
                                              ▲
                                              │  조회
                                     query (FastAPI, 8000)
                                              │  └─▶ Claude API (로그 AI 요약)
                                              ▼
                                     frontend (Vite, 5173)
                                       ├─ 대시보드(차트) 탭   — 실시간 값 + 연결 상태
                                       ├─ 통계(분석) 탭       — 추세 예측 + 상관관계
                                       └─ 로그 캘린더 탭      — 과거 이벤트 조회 + CSV + AI 요약
```

- **ingestion**: 센서 데이터 수신(HTTP + MQTT) → TimescaleDB 저장. 매 판독마다 임계치를 체크해 상태가 바뀌는 순간(정상↔경고↔위험)에 텔레그램으로 알림 발송
- **query**: TimescaleDB 조회 API(기간별 조회, `time_bucket` 집계) + 로그 캘린더용 AI 요약 API(Claude API 호출)
- **mosquitto**: MQTT 브로커 (`listener 1883`, `allow_anonymous true`)
- **frontend**: React + Vite. 대시보드·통계(분석)·로그 캘린더 3개 탭으로 구성

## 디렉토리 구조

```
services/ingestion/   # 센서 데이터 수신(HTTP + MQTT) + 임계치 알림
services/query/       # 조회 API + AI 요약 API
infra/                # DB 초기화 스크립트, mosquitto 설정
frontend/             # React 대시보드
cleanroom_A/          # ESP32 펌웨어(Arduino)
```

## 실행 방법

```bash
docker compose up -d --build   # timescaledb, mosquitto, ingestion, query
cd frontend && npm install && npm run dev   # http://localhost:5173
```

AI 요약·텔레그램 알림 없이도 앱 자체는 정상 동작한다. 두 기능을 쓰려면 루트 `.env`에 아래 값을 채워야 한다:

```bash
ANTHROPIC_API_KEY=     # Claude API 키 (console.anthropic.com)
TELEGRAM_BOT_TOKEN=    # @BotFather로 발급받은 봇 토큰
TELEGRAM_CHAT_ID=      # 알림 받을 채팅방(개인/그룹) id
```

## 센서 구성

| 센서 | 측정 항목 | 비고 |
|---|---|---|
| BME280 (실내) | 온도, 습도, 기압 | 실측 보정된 값 (°C, %RH, hPa) |
| BME280 (실외) | 기압 | 차압 계산용 기준값 — 실내 BME280과 같은 ESP32에서 2번째 I2C 버스(GPIO25/26)로 연결 |
| MQ-2 | 가스(가연성) | raw ADC(0~4095), 아직 %LEL 미보정 |
| MQ135 | 공기질 | raw ADC(0~4095), 아직 ppm 미보정 |

**차압**은 실내 BME280과 실외 BME280의 절대기압 차이(`(실내 hPa − 실외 hPa) × 100` = Pa)로 계산한다. 두 센서가 같은 순간 같은 날씨의 영향을 받기 때문에, 날씨로 인한 공통 변동(하루에도 ±10~20hPa)은 빼는 과정에서 상쇄되고 실제 클린룸 양압 상태(수~수십 Pa 단위)만 남는다. BME280 하나만으로 재는 절대기압은 날씨에 따라 오르내릴 뿐 클린룸 압력 관리와는 무관하므로 사용하지 않는다.

DB 스키마(`infra/init.sql`): `sensor_data(time, device_id, temperature, humidity, pressure, pressure_outside, gas, air_quality)`.

## 프론트엔드

### 대시보드(차트) 탭 (`frontend/src/dashboard/`)

실시간 센서값 · 시계열 차트 · 구역(zone) 선택. 상단 숫자는 `/api/sensors/{id}/latest`를 3초마다 폴링해 체감 실시간성을 확보하고(차트 데이터는 무겁게 하지 않음), 차트는 `/api/sensors/{id}/history`를 10초마다 폴링한다.

온도/습도 상태는 반도체 클린룸 실측 기준 4단계(정상/주의/경고/중단, [참고자료](#참고자료) 1번)로 판정한다. 차압은 ISO 14644 클린룸 양압 권장치([참고자료](#참고자료) 5번)를 참고해 3단계(정상/경고/위험)로 판정한다. 가스/공기질은 raw ADC 값에 대한 임시 placeholder 임계치만 있다. 각 센서 카드 하단에는 정상 범위(예: `정상 21.5~22.5°C`, `정상 10Pa 이상`)를 같이 표시해, 지금 값이 임계치에서 얼마나 떨어져 있는지 바로 보이게 한다.

헤더에는 장치 연결 상태(🟢 실시간 수신 중 / 🔴 N초·N분째 데이터 없음)가 표시된다. `/latest` 응답 시각과 현재 시각을 비교해 15초 이상 새 데이터가 없으면 오프라인으로 판정한다 — 응답 자체는 성공해도(DB에 남은 마지막 값을 계속 돌려주므로) 시각 기준으로 신선도를 판단해야 하는 점에 유의.

### 통계(분석) 탭 (`frontend/src/analysis/`)

설비 이상 예측 · 공기질 추세 · 환경 안정성. 백엔드는 원시 시계열만 주고, 이동평균·회귀·상관계수 같은 파생 지표는 전부 프론트(`deriveAnalysis.ts`)에서 계산한다. 조회 기간(1일/1주일/1개월)을 선택하면 추세·상관관계 계산이 전부 그 기간 기준으로 다시 계산된다. 각 패널은 클릭하면 자기 자리에서 확대되며(패널 그리드 영역 안에서만), 확대 시 추세 패널엔 현재값/변화율/임계 도달 예상 시간이, 히트맵엔 상관계수 상위 3쌍이 추가로 보인다.

| 함수 (`calc.ts`) | 하는 일 |
|---|---|
| `movingAverage` | 이동평균 — 순간 노이즈를 눌러 추세만 보이게 함 |
| `linearRegression` | 최소제곱법 선형회귀 → 변화율(기울기) |
| `pearsonCorrelation` | 피어슨 상관계수(-1~1) |
| `etaToThreshold` | 현재 속도로 계속 가면 임계치까지 걸리는 시간 |

- **설비 이상 예측**: 온도·가스 이동평균 + 최근 8시간 변화율 → 위험임계 도달 예상시간(ETA). "지금 위험한가"가 아니라 "이대로 가면 위험해지는가"를 본다.
- **공기질 추세**: 같은 로직을 MQ135(공기질)에 적용.
- **환경 안정성**: 차압 이동평균 추세 + 5개 센서 상관계수 히트맵.

각 패널의 계산법·예측 근거(왜 이 지표를 보는가)·신빙성(실측 검증된 것 vs 아직 가정인 것)은 [`frontend/analysis.md`](frontend/analysis.md)에 정리되어 있다.

### 로그 캘린더 탭 (`frontend/src/logcalendar/`)

날짜별 위험/경고 이벤트를 달력으로 보여주고, 날짜를 클릭하면 그 날의 센서별 상세 로그를 볼 수 있다. 백엔드 목데이터 없이 실제 `/api/sensors/{id}/history` 데이터만 쓴다 — 월간 뷰는 30분 간격, 일간 상세는 1분 간격으로 집계(실기기가 3초마다 값을 보내므로 5분 단위로는 짧은 임계 초과가 뭉개져서 1분으로 좁힘). 상태 판정은 대시보드와 동일한 `statusFor()`를 재사용해 두 탭 표시가 항상 일치한다.

- **센서별/상태별 필터**: 전체·위험·경고·정상 탭과 온도/습도/가스/공기질/차압 드롭다운을 조합해서 볼 수 있다.
- **CSV 내보내기**: 현재 필터에 걸린 로그만 UTF-8 BOM 포함 CSV로 다운로드(엑셀 한글 깨짐 방지).
- **AI 요약**: "✨ AI로 하루 요약 보기" 버튼을 누르면 그날 집계(위험/경고/정상 건수, 센서별 내역)를 Claude API(`claude-haiku-4-5`)에 보내 2~3문장 한국어 요약을 받아온다. 열 때 자동 호출하지 않고 버튼을 눌러야 호출되며, 같은 날짜는 세션 내에서 재호출하지 않는다(비용 관리). API 키는 `query` 서비스에서만 다루고 프론트엔드에는 노출되지 않는다.

## 알림(텔레그램)

`services/ingestion/app/alerts.py`가 매 센서 판독마다 임계치를 체크한다. 온도·습도는 대시보드와 동일한 중심값±이탈폭 기준, 차압·가스·공기질은 고정 임계치 기준으로 판정하며(`deriveDashboard.ts`의 `statusFor()`와 동일한 값을 유지해야 함), 상태가 실제로 바뀌는 순간(정상→경고/위험, 위험/경고→정상)에만 발송해 같은 상태가 계속돼도 스팸이 되지 않는다. 서비스가 막 시작돼 이전 상태를 모르는 상황에서 이미 위험/경고 상태면 그 즉시 한 번 알린다(놓치는 것보다 중복이 낫다는 판단). 메시지에는 현재값과 함께 정상 범위도 같이 표시된다.

```
🔴 [esp32-A1] 온도 위험 임계 초과 (30.0°C · 정상 21.5~22.5°C)
✅ [esp32-A1] 온도 정상 범위로 복귀 (22.1°C · 정상 21.5~22.5°C)
🔴 [esp32-A1] 차압 위험 임계 초과 (-48.0Pa · 정상 10Pa 이상)
```

## 임계치 근거자료 현황

| 센서 | 근거 수준 | 비고 |
|---|---|---|
| 온도/습도 | 업계 자료 기반 | [참고자료](#참고자료) 1번(4단계 구분), 8번(cross-check) |
| 차압 | 국제표준 기반 | [참고자료](#참고자료) 5번(ISO 14644) — 다만 지금 값은 클린룸 양압 송풍 설비 없이 두 센서만으로 잰 값이라, 실제 클린룸 시공 기준과는 별개로 "이 공간 자체의 차압 추이"를 보는 용도 |
| 가스/공기질 | **근거 없음(placeholder)** | raw ADC값에 대충 잡은 숫자. [참고자료](#참고자료) 2·6번이 실제 적용해야 할 표준이지만, MQ-2/MQ135 캘리브레이션(R0 측정 후 Rs/R0→ppm 변환, [참고자료](#참고자료) 3·4번 데이터시트 공식)을 거치기 전까지는 이 표준과 무관한 임시값 |

## 참고자료

1. Air Innovations — "Semiconductor Trace Moisture". <https://airinnovations.com/blog/semiconductor-trace-moisture/> (반도체 클린룸 온습도 관리 기준: 정상/주의/경고/중단 4단계)
2. 한국산업안전보건공단(KOSHA) — KOSHA GUIDE P-166-2020, "가스누출감지경보기 설치 및 유지보수에 관한 기술지침" (2020.12). <https://oshri.kosha.or.kr/extappKosha/kosha/guidance/fileDownload.do?sfhlhTchnlgyManualNo=P-166-2020&fileOrdrNo=2> (가연성가스 LEL 25%/50% 경보, 독성가스 ERPG-2/AEGL-2/IDLH 등 물질별 참조표 — 일반 산업 현장 기준이라 반도체 팹 전용은 6번 참고)
3. Zhengzhou Winsen Electronics — MQ-2 Semiconductor Sensor for Flammable Gas, Manual v1.6 (2021-07-01). <https://www.winsen-sensor.com/d/files/newpdf/mq-2-(ver1_6)---manual.pdf>
4. Zhengzhou Winsen Electronics — MQ135 Semiconductor Sensor for Air Quality, Manual v1.4. <https://www.winsen-sensor.com/d/files/PDF/Semiconductor%20Gas%20Sensor/MQ135%20(Ver1.4)%20-%20Manual.pdf>
5. ISO 14644-3/4 (클린룸 국제표준), VDI 2083, GMP Annex 1 — 클린룸 차압 권장치(ISO class 7: 인접구역 대비 +10~20Pa, class 8: +5~15Pa). 이 프로젝트의 차압 임계치(정상 10Pa 이상)는 이 범위 하단을 참고해 잡음.
6. NFPA 318, "Standard for the Protection of Semiconductor Fabrication Facilities" — 반도체 팹 전용 가스감지·경보 표준(감지기 커버리지, 경보 민감도, 반응시간까지 규정, NFPA 76 방법론 인용). 유료 표준이라 원문의 정확한 수치는 미확인 — 캘리브레이션 이후 2번 대신 이 표준을 우선 적용해야 함.
7. 반도체 팹 실란(silane)·아르신(arsine) 가스 누출 사고 사례 — 가스 감지·알림 기능이 왜 필요한지의 실제 근거. 2024 Bosch 독일 공장 실란 누출 폭발(사망 2명), Gollob Incident(1988, 실란+아산화질소 폭발), 프랑스 실린더 충전 중 화재(1999), 일본 대학 연구실 모노실란 폭발(1991).
8. 업계 클린룸 설계 가이드(HVAC/cleanroom 전문 자료) 교차검증 수치 — 온도 20~22°C(±1°C), 습도 30~50%RH(포토리소그래피 구역은 ±1%까지, 그 외 ±5%). 1번 수치와 큰 틀에서 일치.
