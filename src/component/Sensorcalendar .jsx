import { useState, useCallback } from "react";
import "./Sensorcalen .css";

// ─── 상수 ────────────────────────────────────────────────────────────────────
const SENSORS = [
  { id: "temp1", label: "온도 센서 #1", unit: "°C", zone: "공장동 A-1" },
  { id: "temp2", label: "온도 센서 #2", unit: "°C", zone: "공장동 B-2" },
  { id: "temp3", label: "온도 센서 #3", unit: "°C", zone: "공장동 A-1" },
  { id: "gas1", label: "가스 센서 #1", unit: "ppm", zone: "공장동 C-3" },
  { id: "gas2", label: "가스 센서 #2", unit: "ppm", zone: "공장동 B-1" },
  { id: "dust1", label: "미세입자 센서 #1", unit: "μg/m³", zone: "공장동 A-2" },
  { id: "dust2", label: "미세입자 센서 #2", unit: "μg/m³", zone: "공장동 B-2" },
  { id: "humid1", label: "습도 센서 #1", unit: "%", zone: "공장동 B-2" },
  { id: "humid2", label: "습도 센서 #2", unit: "%", zone: "공장동 C-2" },
  { id: "humid3", label: "습도 센서 #3", unit: "%", zone: "공장동 C-3" },
];

// 센서별 임계값 및 정상 범위
const THRESHOLDS = {
  temp1: { normal: [15, 30], warning: [30, 35], danger: [35, 50] },
  temp2: { normal: [15, 30], warning: [30, 35], danger: [35, 50] },
  temp3: { normal: [15, 30], warning: [30, 35], danger: [35, 50] },
  gas1: { normal: [0, 100], warning: [100, 150], danger: [150, 300] },
  gas2: { normal: [0, 100], warning: [100, 150], danger: [150, 300] },
  dust1: { normal: [0, 35], warning: [35, 75], danger: [75, 150] },
  dust2: { normal: [0, 35], warning: [35, 75], danger: [75, 150] },
  humid1: { normal: [30, 60], warning: [60, 70], danger: [70, 100] },
  humid2: { normal: [30, 60], warning: [60, 70], danger: [70, 100] },
  humid3: { normal: [30, 60], warning: [60, 70], danger: [70, 100] },
};

const DOW = ["일", "월", "화", "수", "목", "금", "토"];
const STATUS_LABEL = { danger: "위험", warning: "경고", normal: "정상" };

// ─── 시드 기반 난수 ───────────────────────────────────────────────────────────
function seededRng(seed) {
  let s = seed >>> 0;
  return () => {
    s = Math.imul(s ^ (s >>> 16), 0x45d9f3b);
    s = Math.imul(s ^ (s >>> 16), 0x45d9f3b);
    s ^= s >>> 16;
    return (s >>> 0) / 0xffffffff;
  };
}

function pad(n) {
  return String(n).padStart(2, "0");
}

// ─── 3분 간격 로그 생성 (00:00 ~ 23:57) ──────────────────────────────────────
function genLogs(year, month, day) {
  const logs = [];

  // 하루 총 3분 슬롯: 0~479 (24h * 20 슬롯/h)
  for (let slot = 0; slot < 480; slot++) {
    const totalMin = slot * 3;
    const h = Math.floor(totalMin / 60);
    const m = totalMin % 60;
    const timeStr = `${pad(h)}:${pad(m)}:00`;

    // 슬롯마다 모든 센서 측정
    SENSORS.forEach((sensor, sIdx) => {
      const r = seededRng(
        year * 1_000_000 + month * 10_000 + day * 100 + slot * 10 + sIdx + 1,
      );
      const thr = THRESHOLDS[sensor.id];

      // 시간대별 기본 경향 (낮 시간대 온도·가스 상승 시뮬레이션)
      const timeWeight = Math.sin(((h - 6) * Math.PI) / 18); // 0~1, 오후 피크

      let statusRoll = r();
      // 낮(10~17시)에 위험/경고 확률 높이기
      if (h >= 10 && h <= 17) {
        statusRoll = statusRoll * 0.7; // 위험/경고 쪽으로 치우침
      }

      let status, value, desc;

      if (statusRoll < 0.06) {
        // 위험
        status = "danger";
        const [lo, hi] = thr.danger;
        value = (lo + r() * (hi - lo)).toFixed(sensor.unit === "°C" ? 1 : 0);
        desc = `${sensor.label.replace(/ #\d/, "")} 위험 임계 초과 · ${sensor.zone}`;
      } else if (statusRoll < 0.2) {
        // 경고
        status = "warning";
        const [lo, hi] = thr.warning;
        value = (lo + r() * (hi - lo)).toFixed(sensor.unit === "°C" ? 1 : 0);
        desc = `${sensor.label.replace(/ #\d/, "")} 경고 임계 초과 · ${sensor.zone}`;
      } else {
        // 정상
        status = "normal";
        const [lo, hi] = thr.normal;
        value = (lo + r() * (hi - lo)).toFixed(sensor.unit === "°C" ? 1 : 0);
        desc = `정상 범위 측정 · ${sensor.zone}`;
      }

      logs.push({
        time: timeStr,
        slot,
        status,
        sensor: sensor.label,
        value: `${value} ${sensor.unit}`,
        desc,
        zone: sensor.zone,
      });
    });
  }

  // 시간순 정렬 (이미 슬롯 순서대로 생성되지만 센서 순 혼합)
  logs.sort(
    (a, b) => a.time.localeCompare(b.time) || a.sensor.localeCompare(b.sensor),
  );
  return logs;
}

function getDotProfile(logs) {
  return {
    danger: logs.filter((l) => l.status === "danger").length,
    warning: logs.filter((l) => l.status === "warning").length,
    normal: logs.filter((l) => l.status === "normal").length,
  };
}

// ─── Dots ─────────────────────────────────────────────────────────────────────
function Dots({ danger, warning, normal }) {
  const MAX = 4;
  const items = [
    ...Array(Math.min(danger, MAX)).fill("danger"),
    ...Array(Math.min(warning, MAX)).fill("warning"),
    ...Array(Math.min(normal, MAX)).fill("normal"),
  ];
  const visible = items.slice(0, MAX);

  return (
    <div className="dots">
      {visible.map((s, i) => (
        <span key={i} className={`dot dot-${s}`} />
      ))}
    </div>
  );
}

// ─── 로그 모달 ────────────────────────────────────────────────────────────────
function LogModal({ date, logs, onClose }) {
  const [tab, setTab] = useState("all");

  const filtered = tab === "all" ? logs : logs.filter((l) => l.status === tab);
  const danger = logs.filter((l) => l.status === "danger").length;
  const warning = logs.filter((l) => l.status === "warning").length;
  const normal = logs.filter((l) => l.status === "normal").length;
  const dow = DOW[new Date(date.year, date.month - 1, date.day).getDay()];

  return (
    <div
      className="overlay"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="modal">
        {/* 헤더 */}
        <div className="modal-head">
          <div>
            <h3 className="modal-title">
              {date.year}년 {date.month}월 {date.day}일 ({dow})
            </h3>
            <p className="modal-summary">
              <span className="summary-danger">위험 {danger}</span>
              {" · "}
              <span className="summary-warning">경고 {warning}</span>
              {" · "}
              <span className="summary-normal">정상 {normal}</span>
              {" · "}총 {danger + warning + normal}건
            </p>
          </div>
          <button className="modal-close" onClick={onClose} aria-label="닫기">
            ✕
          </button>
        </div>

        {/* 탭 */}
        <div className="modal-tabs">
          {["all", "danger", "warning", "normal"].map((t) => (
            <button
              key={t}
              className={`tab-btn ${tab === t ? "active" : ""}`}
              onClick={() => setTab(t)}
            >
              {t === "all"
                ? `전체 (${logs.length})`
                : `${STATUS_LABEL[t]} (${t === "danger" ? danger : t === "warning" ? warning : normal})`}
            </button>
          ))}
        </div>

        {/* 로그 테이블 헤더 */}
        <div className="log-table-header">
          <span>시간</span>
          <span>상태</span>
          <span>센서</span>
          <span>측정값</span>
          <span>내용</span>
        </div>

        {/* 로그 목록 */}
        <div className="modal-body">
          {filtered.length === 0 ? (
            <p className="empty-state">해당 상태의 이벤트가 없습니다.</p>
          ) : (
            filtered.map((log, i) => (
              <div key={i} className={`log-row log-row-${log.status}`}>
                <span className="log-time">{log.time}</span>
                <span className={`badge badge-${log.status}`}>
                  {STATUS_LABEL[log.status]}
                </span>
                <span className="log-sensor">{log.sensor}</span>
                <span className="log-value">{log.value}</span>
                <span className="log-desc">{log.desc}</span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

// ─── 메인 캘린더 ──────────────────────────────────────────────────────────────
export default function SensorCalendar() {
  const [year, setYear] = useState(2024);
  const [month, setMonth] = useState(5);
  const [selected, setSelected] = useState(null);

  const firstDay = new Date(year, month - 1, 1).getDay();
  const daysInMonth = new Date(year, month, 0).getDate();

  const prevMonth = () => {
    if (month === 1) {
      setYear((y) => y - 1);
      setMonth(12);
    } else setMonth((m) => m - 1);
  };
  const nextMonth = () => {
    if (month === 12) {
      setYear((y) => y + 1);
      setMonth(1);
    } else setMonth((m) => m + 1);
  };

  const openDay = useCallback(
    (day) => {
      const logs = genLogs(year, month, day);
      setSelected({ year, month, day, logs });
    },
    [year, month],
  );

  return (
    <div className="calendar-container">
      {/* 헤더 */}
      <div className="cal-header">
        <button className="nav-btn" onClick={prevMonth}>
          ‹
        </button>
        <h2 className="cal-title">
          {year}년 {month}월
        </h2>
        <button className="nav-btn" onClick={nextMonth}>
          ›
        </button>
      </div>

      {/* 그리드 */}
      <div className="cal-grid">
        {DOW.map((d, i) => (
          <div
            key={d}
            className={`dow-label ${i === 0 ? "sun" : i === 6 ? "sat" : ""}`}
          >
            {d}
          </div>
        ))}

        {Array.from({ length: firstDay }).map((_, i) => (
          <div key={`empty-${i}`} className="cal-cell empty" />
        ))}

        {Array.from({ length: daysInMonth }).map((_, idx) => {
          const day = idx + 1;
          const dow = (firstDay + idx) % 7;
          const logs = genLogs(year, month, day);
          const { danger, warning, normal } = getDotProfile(logs);
          const bgClass =
            danger > 0 ? "cell-danger" : warning > 0 ? "cell-warning" : "";

          return (
            <div
              key={day}
              className={`cal-cell ${bgClass} ${dow === 0 ? "sun" : dow === 6 ? "sat" : ""}`}
              onClick={() => openDay(day)}
            >
              <span className="day-num">{day}</span>
              <Dots danger={danger} warning={warning} normal={normal} />
            </div>
          );
        })}
      </div>

      {/* 범례 */}
      <div className="legend">
        <div className="legend-item">
          <span className="dot dot-danger" />
          위험
        </div>
        <div className="legend-item">
          <span className="dot dot-warning" />
          경고
        </div>
        <div className="legend-item">
          <span className="dot dot-normal" />
          정상
        </div>
      </div>

      {/* 모달 */}
      {selected && (
        <LogModal
          date={selected}
          logs={selected.logs}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  );
}
