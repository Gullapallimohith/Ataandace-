import { useState, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";

export function ErpLoginCard() {
  const queryClient = useQueryClient();
  const [isOpen, setIsOpen] = useState(false);
  const [captchaBase64, setCaptchaBase64] = useState<string | null>(null);
  const [username, setUsername] = useState("2420030663");
  const [password, setPassword] = useState("");
  const [captchaCode, setCaptchaCode] = useState("");
  const [isLoadingCaptcha, setIsLoadingCaptcha] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState<{ text: string; isError: boolean } | null>(null);
  const [sessionActive, setSessionActive] = useState(false);

  // Check initial session status
  useEffect(() => {
    fetch("/api/public/get-attendance")
      .then((r) => r.json())
      .then((data) => {
        if (data.sessionStatus === "active") {
          setSessionActive(true);
        }
      })
      .catch(() => {});
  }, []);

  const loadCaptcha = async () => {
    setIsLoadingCaptcha(true);
    setMessage(null);
    try {
      const res = await fetch("/api/public/login-erp");
      const data = await res.json();
      if (data.ok && data.captchaBase64) {
        setCaptchaBase64(data.captchaBase64);
        setIsOpen(true);
      } else {
        setMessage({ text: data.message || "Failed to load CAPTCHA from ERP.", isError: true });
      }
    } catch (err) {
      setMessage({ text: "Could not reach ERP portal. Check internet connection.", isError: true });
    } finally {
      setIsLoadingCaptcha(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!captchaCode.trim()) {
      setMessage({ text: "Please enter the CAPTCHA text from the image.", isError: true });
      return;
    }

    setIsSubmitting(true);
    setMessage(null);
    try {
      const res = await fetch("/api/public/login-erp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: username.trim(),
          password: password.trim(),
          captcha: captchaCode.trim(),
        }),
      });
      const data = await res.json();

      if (data.ok) {
        setMessage({
          text: `🎉 Logged in successfully! Synced ${data.rowsParsed || 0} course components.`,
          isError: false,
        });
        setSessionActive(true);
        setCaptchaCode("");
        // Invalidate queries so dashboard populates immediately!
        queryClient.invalidateQueries({ queryKey: ["attendance_snapshot"] });
        queryClient.invalidateQueries({ queryKey: ["attendance_history"] });
        queryClient.invalidateQueries({ queryKey: ["app_settings"] });
        setTimeout(() => setIsOpen(false), 2000);
      } else {
        setMessage({ text: data.message || "Login failed. Please check credentials or CAPTCHA.", isError: true });
        // Refresh captcha on failure
        loadCaptcha();
      }
    } catch (err) {
      setMessage({ text: "Login request failed. Check server logs.", isError: true });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="mt-4">
      {!isOpen ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-primary/30 bg-primary/10 p-4">
          <div className="flex items-center gap-3">
            <span className="flex size-3 rounded-full bg-primary animate-pulse" />
            <div>
              <p className="text-sm font-bold text-foreground">
                {sessionActive ? "KL ERP Session Active" : "KL University ERP Sync"}
              </p>
              <p className="text-xs text-muted-foreground">
                {sessionActive
                  ? "Continuous sync is active. Attendance and timetable are automatically synced."
                  : "Start the live sync to fetch real-time attendance and timetable from newERP."}
              </p>
            </div>
          </div>
          <button
            onClick={loadCaptcha}
            disabled={isLoadingCaptcha}
            className="rounded-lg bg-primary px-4 py-2 font-mono text-xs font-bold text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
          >
            {isLoadingCaptcha
              ? "Connecting..."
              : sessionActive
                ? "Re-sync / Change Account"
                : "Log In & Start Live Sync"}
          </button>
        </div>
      ) : (
        <div className="bento p-6 sm:p-8 border border-primary/40">
          <div className="flex items-start justify-between gap-4 border-b border-border pb-4">
            <div>
              <h2 className="text-lg font-bold text-foreground">KL University ERP Portal Login</h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Authenticates with <code>newerp.kluniversity.in</code> to sync your register for <b>Academic Year 2026 – 2027 (Odd Sem)</b>.
              </p>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="text-muted-foreground hover:text-foreground text-sm font-mono px-2 py-1 rounded"
            >
              ✕ Close
            </button>
          </div>

          <form onSubmit={handleLogin} className="mt-6 space-y-4 max-w-lg">
            <div>
              <label className="label-caps block text-[11px] mb-1">ERP Roll Number / Username</label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="e.g. 2400030000"
                className="w-full rounded-lg border border-border bg-secondary/50 px-3.5 py-2 font-mono text-sm text-foreground focus:border-primary focus:outline-none"
                required
              />
            </div>

            <div>
              <label className="label-caps block text-[11px] mb-1">ERP Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••••"
                className="w-full rounded-lg border border-border bg-secondary/50 px-3.5 py-2 font-mono text-sm text-foreground focus:border-primary focus:outline-none"
                required
              />
            </div>

            <div>
              <label className="label-caps block text-[11px] mb-1">CAPTCHA from KL ERP Portal</label>
              <div className="flex items-center gap-3">
                <div className="rounded-lg border border-border bg-black/60 p-1.5 min-h-[46px] min-w-[140px] flex items-center justify-center">
                  {captchaBase64 ? (
                    <img
                      src={captchaBase64}
                      alt="KL ERP CAPTCHA"
                      className="h-10 rounded object-contain"
                    />
                  ) : (
                    <span className="text-xs text-muted-foreground font-mono">Loading...</span>
                  )}
                </div>
                <button
                  type="button"
                  onClick={loadCaptcha}
                  disabled={isLoadingCaptcha}
                  className="rounded-lg border border-border bg-secondary px-3 py-2 text-xs font-mono text-muted-foreground hover:text-foreground transition-colors"
                >
                  🔄 Refresh
                </button>
                <input
                  type="text"
                  value={captchaCode}
                  onChange={(e) => setCaptchaCode(e.target.value)}
                  placeholder="Enter code"
                  className="flex-1 rounded-lg border border-border bg-secondary/50 px-3.5 py-2 font-mono text-sm uppercase tracking-wider text-foreground focus:border-primary focus:outline-none"
                  required
                />
              </div>
            </div>

            {message && (
              <div
                className={`rounded-lg p-3 text-xs font-mono ${
                  message.isError
                    ? "bg-destructive/15 text-destructive border border-destructive/30"
                    : "bg-success/15 text-success border border-success/30"
                }`}
              >
                {message.text}
              </div>
            )}

            <div className="pt-2 flex items-center gap-3">
              <button
                type="submit"
                disabled={isSubmitting || !captchaBase64}
                className="rounded-lg bg-primary px-6 py-2.5 font-mono text-xs font-bold text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
              >
                {isSubmitting ? "Authenticating & Fetching..." : "Log In & Sync Now"}
              </button>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="rounded-lg bg-secondary px-4 py-2.5 font-mono text-xs text-muted-foreground hover:text-foreground"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
