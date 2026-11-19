import tkinter as tk
from tkinter import scrolledtext
import threading
import time
import json
import math
import random
import requests
from datetime import datetime

# ── 설정 ─────────────────────────────────────────────
API_URL   = "http://localhost:8001/api/data"
DEVICE_ID = "esp32-B1"  # 프론트의 zoneDeviceId('B')와 동일 — B 구역으로 잡힌다
INTERVAL  = 3  # 초

# 항상 이 범위 안(정상 판정)에서만 흔들리도록 base/range를 여유 있게 잡음(대시보드 임계치 기준).
SENSORS = {
    "temperature": {"label": "온도",   "unit": "°C", "base": 22,  "range": 0.6},
    "humidity":    {"label": "습도",   "unit": "%",  "base": 45,  "range": 2},
    "gas":         {"label": "가스",   "unit": "",   "base": 800, "range": 200},
    "air_quality": {"label": "공기질", "unit": "",   "base": 300, "range": 150},
}

# 차압(Pa)은 실내/실외 두 필드로 나눠 보내야 해서 별도 처리. 실외값 자체는 의미 없고 실내와의
# 차이만 중요하므로 임의 고정값(표준 대기압)에 원하는 차압만큼 실내값을 더해서 만든다.
PRESSURE_OUTSIDE_BASE = 1013.25
PRESSURE_DIFF_BASE  = 15  # Pa, 정상(10Pa 이상)에서 여유 있게
PRESSURE_DIFF_RANGE = 3

# 버튼을 누르면 해당 센서만 이 값 근처로 튀고 나머지는 정상 유지 — 시연/데모용 시나리오.
DANGER_OVERRIDES = {
    "temperature": 26,
    "humidity": 60,
    "gas": 3500,
    "air_quality": 3500,
    "pressure": -10,  # Pa, 차압 위험(양압 붕괴) 시나리오
}

SCENARIO_LABELS = {
    None: "정상",
    "temperature": "온도 위험",
    "humidity": "습도 위험",
    "gas": "가스 위험",
    "air_quality": "공기질 위험",
    "pressure": "차압 위험",
}

def gen_value(base, rng, tick):
    slow  = math.sin(tick * 0.04) * rng * 0.5
    noise = (random.random() - 0.5) * rng * 0.3
    return base + slow + noise

class SimulatorApp:
    def __init__(self, root):
        self.root    = root
        self.root.title("센서 시뮬레이터")
        self.root.configure(bg="#0d1117")
        self.root.geometry("760x560")
        self.root.resizable(False, False)

        self.running  = False
        self.tick     = 0
        self.thread   = None
        self.scenario = None  # None이면 전부 정상, 아니면 그 센서만 위험 시나리오

        self._build_ui()

    def _build_ui(self):
        BG   = "#0d1117"
        CARD = "#161b27"
        TEXT = "#e2e8f0"
        MUTED= "#64748b"

        # 헤더
        hdr = tk.Frame(self.root, bg=BG)
        hdr.pack(fill="x", padx=16, pady=(14, 8))
        tk.Label(hdr, text="🏭 클린룸 센서 시뮬레이터",
                 bg=BG, fg=TEXT, font=("", 14, "bold")).pack(side="left")
        self.btn = tk.Button(hdr, text="▶  실행",
                             bg="#14532d", fg="#4ade80",
                             font=("", 11, "bold"), relief="flat",
                             padx=16, pady=6, cursor="hand2",
                             command=self.toggle)
        self.btn.pack(side="right")

        # 설정 바
        tk.Frame(self.root, bg="#1e2d40", height=1).pack(fill="x")
        cfg = tk.Frame(self.root, bg="#0a0f1a")
        cfg.pack(fill="x")
        tk.Label(cfg,
                 text=f"  device: {DEVICE_ID}   api: {API_URL}   interval: {INTERVAL}s",
                 bg="#0a0f1a", fg=MUTED, font=("", 9)).pack(side="left", pady=5)

        # 시나리오 버튼
        scen = tk.Frame(self.root, bg=BG)
        scen.pack(fill="x", padx=16, pady=(10, 0))
        tk.Label(scen, text="시나리오", bg=BG, fg=MUTED, font=("", 9, "bold")).pack(anchor="w")
        btn_row = tk.Frame(scen, bg=BG)
        btn_row.pack(fill="x", pady=(4, 0))

        self.scenario_buttons = {}
        for key, label in SCENARIO_LABELS.items():
            b = tk.Button(btn_row, text=label, font=("", 10, "bold"),
                          relief="flat", padx=12, pady=6, cursor="hand2",
                          command=lambda k=key: self.set_scenario(k))
            b.pack(side="left", padx=(0, 6))
            self.scenario_buttons[key] = b
        self._refresh_scenario_buttons()

        # 센서 카드 (온도/습도/가스/공기질/차압 5개 — 실내외 원본은 카드로 안 보여줌)
        cards_frame = tk.Frame(self.root, bg=BG)
        cards_frame.pack(fill="x", padx=16, pady=10)

        display_keys = ["temperature", "humidity", "gas", "air_quality", "pressure"]
        display_labels = {**{k: SENSORS[k]["label"] for k in SENSORS}, "pressure": "차압"}
        display_units  = {**{k: SENSORS[k]["unit"] for k in SENSORS}, "pressure": "Pa"}

        self.val_labels = {}
        colors = ["#60a5fa", "#f472b6", "#a78bfa", "#2dd4bf", "#facc15"]

        for i, key in enumerate(display_keys):
            card = tk.Frame(cards_frame, bg=CARD,
                            highlightbackground="#1e2d40", highlightthickness=1)
            card.grid(row=0, column=i, padx=5, sticky="nsew")
            cards_frame.columnconfigure(i, weight=1)

            tk.Label(card, text=display_labels[key],
                     bg=CARD, fg=MUTED, font=("", 10)).pack(anchor="w", padx=12, pady=(10,0))

            vl = tk.Label(card, text="-",
                          bg=CARD, fg=colors[i], font=("", 22, "bold"))
            vl.pack(padx=12, anchor="w")
            self.val_labels[key] = vl

            tk.Label(card, text=display_units[key],
                     bg=CARD, fg=MUTED, font=("", 9)).pack(padx=12, anchor="w", pady=(0, 10))

        # 로그
        tk.Frame(self.root, bg="#1e2d40", height=1).pack(fill="x", padx=16)
        log_lbl = tk.Frame(self.root, bg=BG)
        log_lbl.pack(fill="x", padx=16, pady=(8, 4))
        tk.Label(log_lbl, text="전송 로그",
                 bg=BG, fg=MUTED, font=("", 10, "bold")).pack(side="left")
        self.stats_lbl = tk.Label(log_lbl, text="전송: 0  실패: 0",
                                  bg=BG, fg=MUTED, font=("", 9))
        self.stats_lbl.pack(side="right")

        self.log_box = scrolledtext.ScrolledText(
            self.root, bg="#0a0f1a", fg="#94a3b8",
            font=("Courier", 9), relief="flat",
            state="disabled", height=10)
        self.log_box.pack(fill="both", expand=True, padx=16, pady=(0, 14))
        self.log_box.tag_config("ok",   foreground="#4ade80")
        self.log_box.tag_config("fail", foreground="#ef4444")
        self.log_box.tag_config("info", foreground="#60a5fa")

        self._log("준비 완료. ▶ 실행 버튼을 눌러 시작하세요.", "info")

    def set_scenario(self, key):
        self.scenario = key
        self._refresh_scenario_buttons()
        self._log(f"시나리오 전환 → {SCENARIO_LABELS[key]}", "info")

    def _refresh_scenario_buttons(self):
        for key, b in self.scenario_buttons.items():
            active = key == self.scenario
            if key is None:
                bg, fg = ("#14532d", "#4ade80") if active else ("#161b27", "#4ade80")
            else:
                bg, fg = ("#7f1d1d", "#f87171") if active else ("#161b27", "#f87171")
            b.config(bg=bg, fg=fg)

    def _log(self, msg, tag="data"):
        self.log_box.configure(state="normal")
        ts = datetime.now().strftime("%H:%M:%S")
        self.log_box.insert("end", f"[{ts}] {msg}\n", tag)
        self.log_box.see("end")
        self.log_box.configure(state="disabled")

    def toggle(self):
        if self.running:
            self.running = False
            self.btn.config(text="▶  실행", bg="#14532d", fg="#4ade80")
            self._log("정지.", "info")
        else:
            self.running = True
            self.sent    = 0
            self.failed  = 0
            self.btn.config(text="⏹  정지", bg="#450a0a", fg="#ef4444")
            self._log("시작!", "ok")
            self.thread = threading.Thread(target=self._run, daemon=True)
            self.thread.start()

    def _build_payload(self):
        self.tick += 1
        payload = {"device_id": DEVICE_ID}
        display = {}

        for key, m in SENSORS.items():
            base = DANGER_OVERRIDES[key] if self.scenario == key else m["base"]
            value = round(max(0, gen_value(base, m["range"], self.tick)), 1)
            payload[key] = value
            display[key] = value

        diff_base = DANGER_OVERRIDES["pressure"] if self.scenario == "pressure" else PRESSURE_DIFF_BASE
        diff_pa = gen_value(diff_base, PRESSURE_DIFF_RANGE, self.tick)
        payload["pressure_outside"] = round(PRESSURE_OUTSIDE_BASE, 2)
        payload["pressure"] = round(PRESSURE_OUTSIDE_BASE + diff_pa / 100, 2)
        display["pressure"] = round(diff_pa, 1)

        return payload, display

    def _run(self):
        self.sent = 0; self.failed = 0
        while self.running:
            try:
                payload, display = self._build_payload()

                try:
                    r = requests.post(API_URL, json=payload, timeout=2)
                    ok = r.status_code == 200
                except Exception as e:
                    ok = False
                    display["_error"] = str(e)

                if ok: self.sent   += 1
                else:  self.failed += 1

                self.root.after(0, self._update_ui, display, ok)
            except Exception as e:
                # 전송 루프 자체가 죽지 않도록 방어: UI 갱신이나 기타 예외가 나도 계속 돈다.
                print(f"시뮬레이터 루프 오류: {e}")

            time.sleep(INTERVAL)

    def _update_ui(self, display, ok):
        for key in self.val_labels:
            self.val_labels[key].config(text=str(display.get(key, "-")))

        self.stats_lbl.config(text=f"전송: {self.sent}  실패: {self.failed}")

        tag = "ok" if ok else "fail"
        status = "✓" if ok else "✗"
        data = {k: v for k, v in display.items() if k != "device_id"}
        self._log(f"{status} {json.dumps(data)}", tag)


if __name__ == "__main__":
    root = tk.Tk()
    app  = SimulatorApp(root)
    root.mainloop()
