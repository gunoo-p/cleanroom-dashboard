CREATE EXTENSION IF NOT EXISTS timescaledb;

CREATE TABLE sensor_data (
    time        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    device_id   TEXT        NOT NULL,
    temperature DOUBLE PRECISION, -- 온도
    humidity    DOUBLE PRECISION, -- 습도
    pm25        DOUBLE PRECISION, -- 미세입자
    gas         DOUBLE PRECISION -- 가스
);

SELECT create_hypertable('sensor_data', 'time');