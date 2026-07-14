CREATE EXTENSION IF NOT EXISTS timescaledb;

CREATE TABLE sensor_data (
    time             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    device_id        TEXT        NOT NULL,
    temperature      DOUBLE PRECISION, -- 온도
    humidity         DOUBLE PRECISION, -- 습도
    pressure         DOUBLE PRECISION, -- 실내 기압(hPa)
    pressure_outside DOUBLE PRECISION, -- 실외 기압(hPa) — (pressure - pressure_outside)로 차압(Pa) 계산
    gas              DOUBLE PRECISION, -- 가스 (MQ-2)
    air_quality      DOUBLE PRECISION -- 공기질 (MQ135)
);

SELECT create_hypertable('sensor_data', 'time');