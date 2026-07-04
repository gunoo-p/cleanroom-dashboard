CREATE EXTENSION IF NOT EXISTS timescaledb;

CREATE TABLE sensor_data (
    time        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    device_id   TEXT        NOT NULL,
    temperature DOUBLE PRECISION,
    humidity    DOUBLE PRECISION,
    pm25        DOUBLE PRECISION,
    gas         DOUBLE PRECISION
);

SELECT create_hypertable('sensor_data', 'time');