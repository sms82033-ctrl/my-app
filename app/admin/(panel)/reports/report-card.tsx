"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Equipment } from "@/lib/equipment";
import type { PendingReport } from "@/lib/reports";

// 변동 종류 4가지 (PRD 5번)
const CHANGE_TYPES = ["자리 이동", "교체", "고장", "기타"];
// 신고 글에 없던 내용을 나타내는 말
const NEEDS_CHECK = "확인 필요";
// 위치·사용자 칸의 글자 수 제한
const MAX_FIELD_LENGTH = 30;

const FIELD_CLASS =
  "w-full rounded border border-zinc-300 bg-white px-3 py-2 text-sm text-black dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50";
const LABEL_CLASS = "text-sm font-medium text-zinc-600 dark:text-zinc-400";

// 장비를 "모니터 MN-0012 · 직원A · 3층 A-12" 형태로 적는다. (관리자 화면이라 이름과 위치를 보여 준다)
function describe(item: Equipment): string {
  return `${item.type} ${item.serial} · ${item.user_name} · ${item.location}`;
}

// "확인 필요"는 빈 칸으로 바꿔 보여 준다. 관리자가 직접 채우는 칸이기 때문이다.
function toInput(value: string): string {
  return value === NEEDS_CHECK ? "" : value;
}

// 신고 1건을 보여 주는 카드. 원문과 AI 정리 내용을 함께 보여 주고, 관리자가 내용을 고친 뒤 승인·반려한다.
export function ReportCard({
  report,
  reportedAt,
  equipment,
}: {
  report: PendingReport;
  reportedAt: string; // 한국 시간으로 적은 신고 시각
  equipment: Equipment[];
}) {
  const [serial, setSerial] = useState(report.equipment_serial ?? "");
  const [changeType, setChangeType] = useState(
    CHANGE_TYPES.includes(report.change_type) ? report.change_type : "",
  );
  const [newLocation, setNewLocation] = useState(toInput(report.new_location));
  const [userName, setUserName] = useState(toInput(report.user_name));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  // 승인에 꼭 필요한 칸이 비었는지 본다. 비어 있으면 승인 버튼을 막는다. (DESIGN.md 2.3)
  // 장비와 변동 종류는 항상, 새 위치는 자리 이동일 때 필요하다.
  const missing =
    serial === ""
      ? "승인하려면 장비를 골라 주세요."
      : changeType === ""
        ? "승인하려면 변동 종류를 골라 주세요."
        : changeType === "자리 이동" && newLocation.trim() === ""
          ? "자리 이동은 새 위치를 적어야 승인할 수 있습니다."
          : null;

  // 승인 또는 반려를 서버에 보낸다. 성공하면 목록을 새로 읽어 이 카드가 사라진다.
  async function decide(action: "approve" | "reject") {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/admin/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reportId: report.id, action, serial, changeType, newLocation, userName }),
      });
      const answer = (await response.json()) as { ok: true } | { ok: false; message: string };
      if (answer.ok) {
        router.refresh();
        return; // 카드가 사라질 때까지 버튼을 막아 둔다.
      }
      setError(answer.message);
    } catch {
      setError("처리하지 못했습니다. 다시 시도해 주세요.");
    }
    setBusy(false);
  }

  // 장비를 고르는 칸에 넣을 목록을 정한다. (DESIGN.md 1.4)
  // 후보가 2~3대면 후보 중에서 고르고, 그 밖에는 전체 목록에서 고른다.
  const candidates = equipment.filter((item) => report.candidate_serials.includes(item.serial));
  const hasCandidates = candidates.length > 0;
  const choices = hasCandidates ? candidates : equipment;
  const id = `report-${report.id}`;

  return (
    <article
      aria-labelledby={`${id}-title`}
      className="rounded border border-zinc-300 bg-white px-5 py-4 dark:border-zinc-700 dark:bg-zinc-950"
    >
      <h2 id={`${id}-title`} className="text-base font-semibold text-black dark:text-zinc-50">
        {report.reporter} · {reportedAt}
      </h2>

      <p className="mt-3 text-sm text-zinc-900 dark:text-zinc-100">
        <span className={LABEL_CLASS}>원문 </span>
        &ldquo;{report.original_text}&rdquo;
      </p>

      <h3 className="mt-4 text-sm font-semibold text-black dark:text-zinc-50">
        AI 정리 (고칠 수 있음)
      </h3>
      <div className="mt-2 grid grid-cols-1 gap-x-4 gap-y-3 sm:grid-cols-[6rem_1fr] sm:items-center">
        <label htmlFor={`${id}-serial`} className={LABEL_CLASS}>
          장비
        </label>
        <div>
          <select
            id={`${id}-serial`}
            value={serial}
            onChange={(event) => setSerial(event.target.value)}
            className={FIELD_CLASS}
          >
            <option value="">
              {hasCandidates ? "확인 필요 — 후보 중에서 고르세요" : "확인 필요 — 장비를 고르세요"}
            </option>
            {choices.map((item) => (
              <option key={item.serial} value={item.serial}>
                {describe(item)}
              </option>
            ))}
          </select>
          {hasCandidates && (
            <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">
              AI가 1대로 정하지 못해 후보 {candidates.length}대를 골랐습니다.
            </p>
          )}
        </div>

        <label htmlFor={`${id}-type`} className={LABEL_CLASS}>
          변동 종류
        </label>
        <select
          id={`${id}-type`}
          value={changeType}
          onChange={(event) => setChangeType(event.target.value)}
          className={FIELD_CLASS}
        >
          <option value="">확인 필요 — 종류를 고르세요</option>
          {CHANGE_TYPES.map((type) => (
            <option key={type} value={type}>
              {type}
            </option>
          ))}
        </select>

        <span className={LABEL_CLASS}>이전 위치</span>
        <span className="text-sm text-zinc-900 dark:text-zinc-100">{report.old_location}</span>

        <label htmlFor={`${id}-location`} className={LABEL_CLASS}>
          새 위치
        </label>
        <input
          id={`${id}-location`}
          type="text"
          value={newLocation}
          onChange={(event) => setNewLocation(event.target.value)}
          maxLength={MAX_FIELD_LENGTH}
          placeholder="확인 필요 (예: 5층 B-03)"
          autoComplete="off"
          className={FIELD_CLASS}
        />

        <label htmlFor={`${id}-user`} className={LABEL_CLASS}>
          사용자
        </label>
        <input
          id={`${id}-user`}
          type="text"
          value={userName}
          onChange={(event) => setUserName(event.target.value)}
          maxLength={MAX_FIELD_LENGTH}
          placeholder="확인 필요 (예: 직원A)"
          autoComplete="off"
          className={FIELD_CLASS}
        />
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-end gap-2">
        {missing && (
          <p id={`${id}-missing`} className="mr-auto text-sm text-amber-800 dark:text-amber-200">
            {missing}
          </p>
        )}
        <button
          type="button"
          onClick={() => decide("approve")}
          disabled={busy || missing !== null}
          aria-describedby={missing ? `${id}-missing` : undefined}
          className="rounded bg-foreground px-5 py-2 text-sm font-medium text-background disabled:opacity-40"
        >
          승인
        </button>
        <button
          type="button"
          onClick={() => decide("reject")}
          disabled={busy}
          className="rounded border border-zinc-300 px-5 py-2 text-sm font-medium text-black disabled:opacity-40 dark:border-zinc-700 dark:text-zinc-50"
        >
          반려
        </button>
      </div>

      {error && (
        <p
          role="alert"
          className="mt-3 rounded border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-800 dark:bg-red-950 dark:text-red-200"
        >
          {error}
        </p>
      )}
    </article>
  );
}
