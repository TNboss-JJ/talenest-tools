"use client";
import { useState } from "react";
import { createClient } from "@/lib/supabase-browser";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const supabase = createClient();

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    if (error) {
      setError(error.message);
    } else {
      setSent(true);
    }
    setLoading(false);
  };

  return (
    <div style={{
      fontFamily: "'DM Sans', sans-serif", minHeight: "100vh",
      background: "#0F1117", color: "#E8E6E1",
      display: "flex", alignItems: "center", justifyContent: "center"
    }}>
      <div style={{
        width: "100%", maxWidth: 380, padding: 32,
        background: "rgba(255,255,255,0.02)",
        border: "1px solid rgba(255,255,255,0.06)",
        borderRadius: 16
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 28 }}>
          <div style={{
            width: 36, height: 36, borderRadius: 10,
            background: "linear-gradient(135deg, #3B7A6D, #2A5C52)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 16, fontWeight: 700, color: "#F7F2EA"
          }}>₩</div>
          <div>
            <div style={{ fontSize: 17, fontWeight: 700, letterSpacing: "-0.02em" }}>
              ExpenseBot
            </div>
            <div style={{ fontSize: 10, color: "#555" }}>tools.talenest.org</div>
          </div>
        </div>

        {sent ? (
          <div>
            <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 8 }}>
              메일을 확인하세요
            </div>
            <div style={{ fontSize: 13, color: "#888", lineHeight: 1.6 }}>
              <strong style={{ color: "#6DCDB8" }}>{email}</strong>로
              로그인 링크를 보냈습니다. 메일의 링크를 클릭하면 자동으로 로그인됩니다.
            </div>
          </div>
        ) : (
          <>
            <div style={{ fontSize: 13, color: "#888", marginBottom: 20, lineHeight: 1.5 }}>
              등록된 이메일로 로그인하세요. 비밀번호 없이 매직 링크로 인증합니다.
            </div>
            <div>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="your@email.com"
                onKeyDown={(e) => e.key === "Enter" && handleLogin(e)}
                style={{
                  width: "100%", padding: "12px 16px", boxSizing: "border-box",
                  background: "rgba(255,255,255,0.04)",
                  border: "1px solid rgba(255,255,255,0.08)",
                  borderRadius: 10, color: "#E8E6E1", fontSize: 14,
                  fontFamily: "inherit", marginBottom: 12, outline: "none"
                }}
              />
              <button
                onClick={handleLogin}
                disabled={loading || !email}
                style={{
                  width: "100%", padding: "12px 0", borderRadius: 10,
                  border: "none", cursor: loading ? "wait" : "pointer",
                  fontSize: 14, fontWeight: 600, fontFamily: "inherit",
                  background: "linear-gradient(135deg, #3B7A6D, #2A5C52)",
                  color: "#F7F2EA", opacity: loading || !email ? 0.5 : 1,
                  transition: "opacity 0.2s"
                }}
              >
                {loading ? "보내는 중..." : "로그인 링크 보내기"}
              </button>
            </div>
          </>
        )}

        {error && (
          <div style={{
            marginTop: 12, padding: 12, fontSize: 12,
            background: "rgba(220,80,80,0.08)",
            border: "1px solid rgba(220,80,80,0.15)",
            borderRadius: 8, color: "#E88"
          }}>
            {error}
          </div>
        )}
      </div>
    </div>
  );
}
