import { Eye, EyeOff, Lock } from "lucide-react";
import { useState, type FormEvent } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "../../lib/toast";
import { ApiError, apiPost } from "../../lib/api";
import { Button } from "../../components/ui/button";
import { Input, Label } from "../../components/ui/input";

const LOGIN_LOGO_URL = `${import.meta.env.BASE_URL}favicon_love.webp`;

export function LoginPage() {
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [retryAfter, setRetryAfter] = useState<number | null>(null);
  const navigate = useNavigate();
  const [params] = useSearchParams();

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (busy || !password) return;
    setBusy(true);
    setError(null);
    try {
      await apiPost("/login", { password });
      toast.success("Signed in");
      const next = params.get("next") || "/overview";
      navigate(next.startsWith("/") ? next : "/overview", { replace: true });
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.status === 429) {
          const body = err.message;
          setRetryAfter(30);
          setError(body || "Too many attempts. Try again later.");
        } else {
          setError(err.message);
        }
      } else {
        setError("Unexpected error");
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[var(--page-bg)] p-4 text-[var(--text-primary)]">
      <form
        onSubmit={submit}
        className="login-enter relative w-full max-w-[26rem] rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-1)] p-6 sm:p-8"
      >
        <div className="mb-7 flex flex-col items-center gap-3 text-center">
          <div className="grid h-16 w-16 place-items-center overflow-hidden rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-1)]">
            <img src={LOGIN_LOGO_URL} alt="" width="64" height="64" className="h-full w-full object-cover" />
          </div>
          <div>
            <p className="mb-1 text-[11px] font-bold uppercase tracking-[0.22em] text-[var(--accent)]">Private workspace</p>
            <h1 className="text-2xl font-bold tracking-tight text-[var(--text-1)]">Cartethyia</h1>
            <p className="mt-1 text-sm text-[var(--text-2)]">Sign in to manage your gateway</p>
          </div>
        </div>

        <Label htmlFor="password">Password</Label>
        <div className="relative">
          <Lock size={15} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-[var(--text-3)]" />
          <Input
            id="password"
            name="password"
            type={showPassword ? "text" : "password"}
            autoComplete="current-password"
            autoFocus
            className="h-11 pl-9 pr-10"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Enter your password…"
          />
          <button
            type="button"
            aria-label={showPassword ? "Hide secret" : "Show secret"}
            onClick={() => setShowPassword((visible) => !visible)}
            className="absolute top-1/2 right-3 -translate-y-1/2 rounded-md p-1 text-[var(--text-3)] transition-colors hover:text-[var(--text-1)] focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[var(--accent)]"
          >
            {showPassword ? <EyeOff aria-hidden="true" size={16} /> : <Eye aria-hidden="true" size={16} />}
          </button>
        </div>

        {error && (
          <p role="alert" aria-live="polite" className="mt-2.5 text-xs font-medium text-[var(--red)]">
            {error}
            {retryAfter !== null && ` (retry in ~${retryAfter}s)`}
          </p>
        )}

        <Button type="submit" disabled={busy || !password} className="mt-5 h-11 w-full">
          {busy ? "Signing in…" : "Sign in"}
        </Button>

        <div className="mt-5 text-center text-[11px] text-[var(--text-3)]">
          <p>Password is set via <code className="rounded bg-[var(--surface-2)] px-1 py-0.5 font-mono text-[11px] text-[var(--text-2)]">CONSOLE_PASSWORD</code> in <code className="rounded bg-[var(--surface-2)] px-1 py-0.5 font-mono text-[11px] text-[var(--text-2)]">.env</code></p>
        </div>
      </form>
    </div>
  );
}
