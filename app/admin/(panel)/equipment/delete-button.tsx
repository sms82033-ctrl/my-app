"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

// 장비 1대를 지우는 버튼. 누르면 한 번 더 물어본 뒤 지운다. (PRD must 3)
// 신고나 변경 이력이 있는 장비는 서버가 막고, 그 안내를 버튼 아래에 보여 준다.
export function DeleteButton({ serial, label }: { serial: string; label: string }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  async function handleClick() {
    if (busy) return;
    if (!window.confirm(`"${label}" 장비를 목록에서 지울까요? 지우면 되돌릴 수 없습니다.`)) return;

    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/admin/equipment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "delete", serial }),
      });
      const answer = (await response.json()) as { ok: true } | { ok: false; message: string };
      if (answer.ok) {
        router.refresh(); // 목록을 새로 읽어 이 줄이 사라진다.
        return;
      }
      setError(answer.message);
    } catch {
      setError("지우지 못했습니다. 다시 시도해 주세요.");
    }
    setBusy(false);
  }

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        disabled={busy}
        className="text-red-700 underline underline-offset-2 disabled:opacity-40 dark:text-red-300"
      >
        삭제
      </button>
      {error && (
        <span role="alert" className="mt-1 block text-xs text-red-700 dark:text-red-300">
          {error}
        </span>
      )}
    </>
  );
}
