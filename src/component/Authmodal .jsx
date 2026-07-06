import { useState } from "react";
import "./AuthModal.css";

export default function AuthModal({ onClose, onLogin }) {
  const [mode, setMode] = useState("login"); // "login" | "register" | "findId" | "findPw"
  const [form, setForm] = useState({
    id: "",
    password: "",
    name: "",
    confirmPassword: "",
    employeeId: "",
  });
  const [saveId, setSaveId] = useState(false);
  const [error, setError] = useState("");

  const handle = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
    setError("");
  };

  const switchMode = (m) => {
    setMode(m);
    setForm({
      id: "",
      password: "",
      name: "",
      confirmPassword: "",
      employeeId: "",
    });
    setError("");
  };

  const handleLogin = (e) => {
    e.preventDefault();
    if (!form.id || !form.password) {
      setError("아이디와 비밀번호를 입력해주세요.");
      return;
    }
    onLogin && onLogin({ id: form.id });
    onClose && onClose();
  };

  const handleRegister = (e) => {
    e.preventDefault();
    if (!form.name || !form.id || !form.password || !form.confirmPassword) {
      setError("모든 항목을 입력해주세요.");
      return;
    }
    if (form.password !== form.confirmPassword) {
      setError("비밀번호가 일치하지 않습니다.");
      return;
    }
    switchMode("login");
  };

  const handleFindId = (e) => {
    e.preventDefault();
    if (!form.name || !form.employeeId) {
      setError("이름과 사원번호를 입력해주세요.");
      return;
    }
    alert("가입된 아이디: user****");
    switchMode("login");
  };

  const handleFindPw = (e) => {
    e.preventDefault();
    if (!form.id || !form.employeeId) {
      setError("아이디와 사원번호를 입력해주세요.");
      return;
    }
    alert("임시 비밀번호가 등록된 이메일로 발송되었습니다.");
    switchMode("login");
  };

  return (
    <div className="auth-overlay">
      <div className="auth-modal">
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
                onChange={handle}
              />
              <input
                type="password"
                name="password"
                className="auth-input"
                placeholder="비밀번호"
                value={form.password}
                onChange={handle}
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
                  <button type="button" onClick={() => switchMode("findId")}>
                    아이디 찾기
                  </button>
                  <span className="divider">|</span>
                  <button type="button" onClick={() => switchMode("findPw")}>
                    비밀번호 찾기
                  </button>
                </div>
              </div>
              <button type="submit" className="auth-submit">
                로그인
              </button>
              <button
                type="button"
                className="secondary-btn"
                onClick={() => switchMode("register")}
              >
                회원가입
              </button>
            </form>
          </>
        )}

        {/* ── 회원가입 ── */}
        {mode === "register" && (
          <>
            <h2 className="auth-title">회원가입</h2>
            <form className="auth-form" onSubmit={handleRegister}>
              <input
                type="text"
                name="name"
                className="auth-input"
                placeholder="이름"
                value={form.name}
                onChange={handle}
              />
              <input
                type="text"
                name="employeeId"
                className="auth-input"
                placeholder="사원번호"
                value={form.employeeId}
                onChange={handle}
              />
              <input
                type="text"
                name="id"
                className="auth-input"
                placeholder="아이디"
                value={form.id}
                onChange={handle}
              />
              <input
                type="password"
                name="password"
                className="auth-input"
                placeholder="비밀번호 (8~12자, 영문+숫자+특수문자)"
                value={form.password}
                onChange={handle}
              />
              <input
                type="password"
                name="confirmPassword"
                className="auth-input"
                placeholder="비밀번호 확인"
                value={form.confirmPassword}
                onChange={handle}
              />
              {error && <p className="auth-error">{error}</p>}
              <button type="submit" className="auth-submit">
                가입하기
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

        {/* ── 아이디 찾기 ── */}
        {mode === "findId" && (
          <>
            <h2 className="auth-title">아이디 찾기</h2>
            <p className="find-desc">
              가입 시 등록한 이름과 사원번호를 입력해주세요.
            </p>
            <form className="auth-form" onSubmit={handleFindId}>
              <input
                type="text"
                name="name"
                className="auth-input"
                placeholder="이름"
                value={form.name}
                onChange={handle}
              />
              <input
                type="text"
                name="employeeId"
                className="auth-input"
                placeholder="사원번호"
                value={form.employeeId}
                onChange={handle}
              />
              {error && <p className="auth-error">{error}</p>}
              <button type="submit" className="auth-submit">
                아이디 찾기
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

        {/* ── 비밀번호 찾기 ── */}
        {mode === "findPw" && (
          <>
            <h2 className="auth-title">비밀번호 찾기</h2>
            <p className="find-desc">
              아이디와 사원번호를 입력하시면
              <br />
              등록된 이메일로 임시 비밀번호를 보내드립니다.
            </p>
            <form className="auth-form" onSubmit={handleFindPw}>
              <input
                type="text"
                name="id"
                className="auth-input"
                placeholder="아이디"
                value={form.id}
                onChange={handle}
              />
              <input
                type="text"
                name="employeeId"
                className="auth-input"
                placeholder="사원번호"
                value={form.employeeId}
                onChange={handle}
              />
              {error && <p className="auth-error">{error}</p>}
              <button type="submit" className="auth-submit">
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
