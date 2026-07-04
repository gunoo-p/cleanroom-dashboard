import { useState } from "react";
import "./AuthModal.css";

export default function AuthModal({ onClose, onLogin }) {
  const [role, setRole] = useState("employee");
  const [mode, setMode] = useState("login"); // "login" | "find"
  const [form, setForm] = useState({ id: "", password: "" });
  const [findForm, setFindForm] = useState({ name: "", employeeId: "" });
  const [saveId, setSaveId] = useState(false);
  const [error, setError] = useState("");

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
    setError("");
  };

  const handleFindChange = (e) => {
    setFindForm({ ...findForm, [e.target.name]: e.target.value });
    setError("");
  };

  const handleLogin = (e) => {
    e.preventDefault();
    if (!form.id || !form.password) {
      setError("아이디와 비밀번호를 입력해주세요.");
      return;
    }
    onLogin && onLogin({ id: form.id, role });
    onClose && onClose();
  };

  const handleFind = (e) => {
    e.preventDefault();
    if (!findForm.name || !findForm.employeeId) {
      setError("이름과 사원번호를 입력해주세요.");
      return;
    }
    alert("임시 비밀번호가 등록된 이메일로 발송되었습니다.");
    setMode("login");
    setFindForm({ name: "", employeeId: "" });
    setError("");
  };

  const switchMode = (m) => {
    setMode(m);
    setError("");
  };

  return (
    <div className="auth-overlay">
      <div className="auth-modal">
        {/* 역할 탭 */}
        <div className="role-tabs">
          <button
            className={"role-tab" + (role === "employee" ? " active" : "")}
            onClick={() => {
              setRole("employee");
              setError("");
            }}
          >
            일반사원
          </button>
          <button
            className={"role-tab" + (role === "admin" ? " active" : "")}
            onClick={() => {
              setRole("admin");
              setError("");
            }}
          >
            관리자
          </button>
        </div>

        {/* ── 로그인 ── */}
        {mode === "login" && (
          <>
            <h2 className="auth-title">로그인</h2>
            <form className="auth-form" onSubmit={handleLogin}>
              <input
                type="text"
                name="id"
                className="auth-input"
                placeholder="아이디"
                value={form.id}
                onChange={handleChange}
              />
              <input
                type="password"
                name="password"
                className="auth-input"
                placeholder="비밀번호"
                value={form.password}
                onChange={handleChange}
              />

              {error && <p className="auth-error">{error}</p>}

              <div className="auth-options">
                <label className="save-id">
                  <input
                    type="checkbox"
                    checked={saveId}
                    onChange={(e) => setSaveId(e.target.checked)}
                  />
                  아이디 저장
                </label>
                <div className="find-links">
                  <button type="button" onClick={() => switchMode("find")}>
                    비밀번호 찾기
                  </button>
                </div>
              </div>

              <button type="submit" className={"auth-submit " + role}>
                로그인
              </button>
            </form>
          </>
        )}

        {/* ── 비밀번호 찾기 ── */}
        {mode === "find" && (
          <>
            <h2 className="auth-title">비밀번호 찾기</h2>
            <p className="find-desc">
              이름과 사원번호를 입력하시면
              <br />
              등록된 이메일로 임시 비밀번호를 보내드립니다.
            </p>
            <form className="auth-form" onSubmit={handleFind}>
              <input
                type="text"
                name="name"
                className="auth-input"
                placeholder="이름"
                value={findForm.name}
                onChange={handleFindChange}
              />
              <input
                type="text"
                name="employeeId"
                className="auth-input"
                placeholder="사원번호"
                value={findForm.employeeId}
                onChange={handleFindChange}
              />

              {error && <p className="auth-error">{error}</p>}

              <button type="submit" className={"auth-submit " + role}>
                임시 비밀번호 발송
              </button>
              <button
                type="button"
                className="back-btn"
                onClick={() => switchMode("login")}
              >
                ← 로그인으로 돌아가기
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
