"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

// 비밀번호를 입력해 로그인한다. 맞으면 신고 승인 화면으로 이동한다.
export function LoginForm() {
  const [password, setPassword] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (sending) return;

    if (password === "") {
      setError("비밀번호를 적어 주세요.");
      return;
    }

    setSending(true);
    setError(null);
    try {
      const response = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const answer = (await response.json()) as { ok: true } | { ok: false; message: string };
      if (answer.ok) {
        // 입력한 비밀번호를 화면에 남겨 두지 않는다.
        setPassword("");
        setSending(false);
        // 로그인 표시가 생겼으니 신고 승인 화면으로 이동한다.
        router.replace("/admin/reports");
        return;
      }
      setError(answer.message);
      setPassword("");
    } catch {
      setError("로그인하지 못했습니다. 다시 시도해 주세요.");
    }
    setSending(false);
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="mt-6 flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <label htmlFor="password" className="text-sm font-medium text-zinc-800 dark:text-zinc-200">
          비밀번호
        </label>
        <input
          id="password"
          name="password"
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          autoComplete="current-password"
          className="rounded border border-zinc-300 bg-white px-3 py-2 text-black dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
        />
      </div>
      <button
        type="submit"
        disabled={sending}
        className="rounded bg-foreground px-5 py-2 font-medium text-background disabled:opacity-50"
      >
        {sending ? "확인하는 중…" : "들어가기"}
      </button>
      {error && (
        <p
          role="alert"
          className="rounded border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-800 dark:bg-red-950 dark:text-red-200"
        >
          {error}
        </p>
      )}
    </form>
  );
}
