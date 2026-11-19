"""3D 클린룸 화면이 붙은 센서 시뮬레이터 (pywebview + three.js).

기존 simulator.py(tkinter)는 그대로 두고, 화면만 웹(web/)으로 바꾼 버전이다.
센서값 생성·전송 로직과 설정값(주소, 장치 ID, 위험값 등)은 simulator.py에서 그대로 가져와 쓰므로
값을 바꿀 때는 simulator.py 한 곳만 고치면 된다.

  파이썬(이 파일)                         웹 화면(web/)
  ─────────────                           ─────────────
  SimEngine: 값 생성 → 3초마다 POST  ──▶  window.sim.onData()   카드·로그 갱신
  Api.set_scenario()                ◀──  시나리오 버튼 클릭
                                    ──▶  window.sim.onScenario()  3D 애니메이션 전환

3D 모델: web/models/model.glb 가 있으면 그걸 띄우고, 없으면 임시 클린룸 모형을 띄운다.

실행:
  pip install -r requirements.txt
  python simulator_3d.py
  python simulator_3d.py --selftest   # 창을 띄워 버튼·3D·전송 연동을 자동 점검 후 종료
                                      # (점검 중 정상값 1~2건을 실제로 서버에 보낸다)
"""
import argparse
import json
import os
import sys
import threading
import time

import requests
import webview

# 설정·값 생성 규칙은 기존 시뮬레이터와 공유한다 (import만 하고 tkinter 창은 띄우지 않음).
from simulator import (
    API_URL,
    DANGER_OVERRIDES,
    DEVICE_ID,
    INTERVAL,
    PRESSURE_DIFF_BASE,
    PRESSURE_DIFF_RANGE,
    PRESSURE_OUTSIDE_BASE,
    SCENARIO_LABELS,
    SENSORS,
    gen_value,
)

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
WEB_DIR = os.path.join(BASE_DIR, "web")
MODEL_PATH = os.path.join(WEB_DIR, "models", "model.glb")


class SimEngine:
    """화면과 무관한 시뮬레이터 본체. simulator.py의 _build_payload/_run과 같은 동작."""

    def __init__(self, on_data, on_log):
        self.on_data = on_data  # (display: dict, ok: bool, sent: int, failed: int) -> None
        self.on_log = on_log    # (msg: str, tag: str) -> None
        self.running = False
        self.tick = 0
        self.scenario = None    # None이면 전부 정상, 아니면 그 센서만 위험 시나리오
        self.sent = 0
        self.failed = 0
        self._thread = None

    def set_scenario(self, key):
        if key not in SCENARIO_LABELS:
            return
        self.scenario = key
        self.on_log(f"시나리오 전환 → {SCENARIO_LABELS[key]}", "info")

    def toggle(self):
        if self.running:
            self.running = False
            self.on_log("정지.", "info")
        else:
            self.running = True
            self.sent = 0
            self.failed = 0
            self.on_log("시작!", "ok")
            self._thread = threading.Thread(target=self._run, daemon=True)
            self._thread.start()
        return self.running

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
        while self.running:
            try:
                payload, display = self._build_payload()

                try:
                    r = requests.post(API_URL, json=payload, timeout=2)
                    ok = r.status_code == 200
                except Exception as e:
                    ok = False
                    display["_error"] = str(e)

                if ok:
                    self.sent += 1
                else:
                    self.failed += 1

                self.on_data(display, ok, self.sent, self.failed)
            except Exception as e:
                # 전송 루프 자체가 죽지 않도록 방어: 화면 갱신이나 기타 예외가 나도 계속 돈다.
                print(f"시뮬레이터 루프 오류: {e}")

            time.sleep(INTERVAL)


class Api:
    """웹 화면(JS)에서 pywebview.api.<메서드>()로 부르는 함수들.

    pywebview는 이 객체의 공개 속성을 JS로 노출하므로, 내부 상태는 전부 _로 시작하게 둔다.
    """

    def __init__(self):
        self._window = None
        self._engine = SimEngine(on_data=self._push_data, on_log=self._push_log)

    # ── JS → 파이썬 ─────────────────────────────
    def get_config(self):
        return {
            "deviceId": DEVICE_ID,
            "apiUrl": API_URL,
            "interval": INTERVAL,
            # JSON 키는 문자열이어야 해서 None(정상)은 "normal"로 바꿔 보낸다.
            "scenarios": [
                {"key": "normal" if k is None else k, "label": v}
                for k, v in SCENARIO_LABELS.items()
            ],
            "sensors": {k: {"label": m["label"], "unit": m["unit"]} for k, m in SENSORS.items()},
            "hasModel": os.path.exists(MODEL_PATH),
        }

    def toggle(self):
        return self._engine.toggle()

    def set_scenario(self, key):
        self._engine.set_scenario(None if key == "normal" else key)
        self._call_js("onScenario", key)

    # ── 파이썬 → JS ─────────────────────────────
    def _push_data(self, display, ok, sent, failed):
        self._call_js("onData", {"values": display, "ok": ok, "sent": sent, "failed": failed})

    def _push_log(self, msg, tag):
        self._call_js("onLog", {"msg": msg, "tag": tag})

    def _call_js(self, fn, arg):
        if self._window is None:
            return
        try:
            self._window.evaluate_js(f"window.sim && window.sim.{fn}({json.dumps(arg, ensure_ascii=False)})")
        except Exception as e:
            print(f"화면 갱신 실패({fn}): {e}")


# 시나리오별로 3D 화면이 이 상태가 되어야 정상 (scene.js의 PRESETS와 같은 값)
EXPECTED_PARTICLES = {
    "normal": "downflow",
    "temperature": "rise",
    "humidity": "rain",
    "gas": "leak",
    "air_quality": "dust",
    "pressure": "inflow",
}


def selftest(window, api, result):
    """실제 창에서 버튼을 JS로 눌러 보고, 파이썬·화면·3D 상태가 맞는지 확인한다."""
    checks = []

    def js(expr):
        return window.evaluate_js(expr)

    def check(name, ok, detail=""):
        checks.append(ok)
        print(f"  {'PASS' if ok else 'FAIL'}  {name}" + (f"  ({detail})" if detail else ""), flush=True)

    def info():
        return js("window.sim.debug.info()")

    try:
        print("[selftest] 3D 화면 로딩 대기…", flush=True)
        for _ in range(100):
            if js("!!(window.sim && window.sim.debug && window.sim.debug.ready())"):
                break
            time.sleep(0.2)
        i = info()
        check("3D 장면 로드", bool(i and i.get("ready")), f"source={i and i.get('source')}")
        check("pywebview 연결 (미리보기 모드 아님)", i and not i.get("preview"))
        time.sleep(0.5)
        check("렌더링 진행", info().get("frames", 0) > i.get("frames", 0))
        missing = [k for k, v in (i.get("targets") or {}).items() if not v]
        check("시나리오별 대상 부품 매칭", not missing, "누락: " + ", ".join(missing) if missing else str(i.get("targets")))

        print("[selftest] 시나리오 버튼 클릭 → 파이썬 → 3D", flush=True)
        for key in EXPECTED_PARTICLES:
            js(f"document.querySelector('[data-scenario=\"{key}\"]').click()")
            time.sleep(0.6)
            i = info()
            py_key = "normal" if api._engine.scenario is None else api._engine.scenario
            ok = (
                py_key == key
                and i["uiScenario"] == key
                and i["scenario"] == key
                and i["particles"] == EXPECTED_PARTICLES[key]
                and i["beacon"] == (key != "normal")
                and (key == "normal" or i["glowMeshes"] > 0)
            )
            check(
                f"시나리오 {key}",
                ok,
                f"python={py_key} ui={i['uiScenario']} 3d={i['scenario']} 입자={i['particles']} "
                f"경광등={i['beacon']} 발광부품={i['glowMeshes']} 애니메이션={i['activeClip']}",
            )
        js("document.querySelector('[data-scenario=\"normal\"]').click()")

        # 코드로 만든 클린룸이면 작업자 행동까지 확인 (GLB 모델이면 작업자가 없으므로 건너뜀)
        if info().get("model"):
            print("[selftest] 작업자 상황별 행동", flush=True)

            def click(key):
                js(f"document.querySelector('[data-scenario=\"{key}\"]').click()")

            def wait_workers(cond, timeout=15):
                w = {}
                for _ in range(int(timeout / 0.25)):
                    time.sleep(0.25)
                    w = info()["model"]["workers"]
                    if cond(w):
                        break
                return w

            def home(w):
                return w["modes"].get("work") == 6 and w["modes"].get("loop") == 1

            check("시작 전 제자리 복귀", bool(home(wait_workers(home, 20))))

            click("temperature")
            w = wait_workers(lambda w: w["modes"].get("act") == 7)
            acts = w["acts"]
            check("온도: 부채질·걱정·다급한 작업으로 나뉨",
                  acts.get("fan", 0) >= 3 and acts.get("worried", 0) >= 1 and acts.get("work_fast") == 1, str(w))

            click("humidity")
            w = wait_workers(lambda w: w["acts"].get("umbrella") == 7)
            check("습도: 7명 우산 펼침", w["acts"].get("umbrella") == 7, str(w))

            click("gas")
            w = wait_workers(lambda w: w["acts"].get("cover") == 7)
            check("가스: 7명 입 막고 문 앞 대피", w["acts"].get("cover") == 7, str(w))

            # 위험이 연달아 바뀌면 대피한 자리에서 바로 다음 행동으로
            click("pressure")
            w = wait_workers(lambda w: w["acts"].get("push") == 3 and w["modes"].get("act") == 7)
            check("차압(연속 전환): 3명 문 밀기 + 4명 걱정",
                  w["acts"].get("push") == 3 and w["acts"].get("worried") == 4, str(w))

            click("air_quality")
            w = wait_workers(lambda w: w["modes"].get("act") == 7)
            check("공기질: 기침·먼지 휘젓기", w["acts"].get("cough", 0) >= 3 and w["acts"].get("swat", 0) >= 3, str(w))

            click("normal")
            w = wait_workers(home, 25)
            check("정상 복귀 시 제자리 작업", bool(home(w)), str(w))

        print("[selftest] 실행 버튼 → 실제 전송 → 카드 갱신", flush=True)
        js("document.getElementById('run-btn').click()")
        time.sleep(1.5)
        check("실행 상태 전환", api._engine.running and info()["running"])
        i = info()
        check("센서 카드 갱신", all(v not in (None, "-") for v in i["cards"].values()), str(i["cards"]))
        check("서버 전송 성공", api._engine.sent >= 1, f"sent={api._engine.sent} failed={api._engine.failed}")
        js("document.getElementById('run-btn').click()")
        time.sleep(0.5)
        check("정지 상태 전환", not api._engine.running and not info()["running"])
    except Exception as e:
        check("자가진단 실행", False, repr(e))
    finally:
        passed = sum(checks)
        print(f"[selftest] {passed}/{len(checks)} 통과", flush=True)
        result["ok"] = bool(checks) and all(checks)
        window.destroy()


def main():
    parser = argparse.ArgumentParser(description="3D 클린룸 센서 시뮬레이터")
    parser.add_argument("--selftest", action="store_true", help="버튼·3D·전송 연동을 자동 점검하고 종료")
    args = parser.parse_args()

    api = Api()
    window = webview.create_window(
        "클린룸 센서 시뮬레이터 3D",
        url=os.path.join(WEB_DIR, "index.html"),
        js_api=api,
        width=1200,
        height=860,
        min_size=(980, 720),
        background_color="#0d1117",
    )
    api._window = window
    # 창을 닫으면 전송 루프도 멈춘다.
    window.events.closed += lambda: setattr(api._engine, "running", False)
    # http_server=True: ES 모듈(three.js)과 GLB를 file://이 아닌 로컬 서버로 읽어야 브라우저 보안 제한에 안 걸린다.
    if args.selftest:
        result = {"ok": False}
        webview.start(selftest, (window, api, result), http_server=True)
        sys.exit(0 if result["ok"] else 1)
    webview.start(http_server=True)


if __name__ == "__main__":
    main()
