"use client";

import { useState } from "react";

// 신고 글 길이 제한 (DESIGN.md 1.2, 데이터 저장소의 신고 표와 같은 값)
const MAX_TEXT_LENGTH = 500;
// 신고자 이름 길이 제한
const MAX_NAME_LENGTH = 20;
// 서버가 5초 안에 답하도록 되어 있다. 연결이 끊겨 답이 아예 오지 않을 때만 이 시간 뒤에 기다리기를 멈춘다.
const GIVE_UP_AFTER_MS = 10000;

const RETRY_MESSAGE = "신고를 보내지 못했습니다. 다시 시도해 주세요.";

// 직원 화면에 보여 주는 장비 정보 (다른 사람의 이름과 위치는 받지 않는다)
type EquipmentSummary = { type: string; model: string; serialTail: string };

// 서버가 돌려준 AI 정리 결과
type OrganizedReport = {
  equipment: EquipmentSummary | null;
  candidates: EquipmentSummary[];
  changeType: string;
  oldLocation: string;
  newLocation: string;
  userName: string;
};

// 글자 수를 센다. 이모지 같은 글자도 1글자로 세어 데이터 저장소의 계산과 맞춘다.
function countChars(text: string): number {
  return Array.from(text).length;
}

// 장비를 "모니터 LG 27UP850 (끝자리 0012)" 형태로 적는다.
function describe(item: EquipmentSummary): string {
  return `${item.type} ${item.model} (끝자리 ${item.serialTail})`;
}

// 신고자 이름과 변동 내용을 입력해 보내고, AI가 정리한 내용을 보여 준다.
export function ReportForm() {
  const [name, setName] = useState("");
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<OrganizedReport | null>(null);

  const length = countChars(text);
  const tooLong = length > MAX_TEXT_LENGTH;

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (sending) return;

    if (name.trim() === "") {
      setError("신고자 이름을 적어 주세요.");
      return;
    }
    if (text.trim() === "") {
      setError("변동 내용을 적어 주세요.");
      return;
    }
    if (tooLong) {
      setError(`변동 내용은 ${MAX_TEXT_LENGTH}자까지 적을 수 있습니다.`);
      return;
    }

    setSending(true);
    setError(null);
    setResult(null);
    try {
      const response = await fetch("/api/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reporter: name, text }),
        signal: AbortSignal.timeout(GIVE_UP_AFTER_MS),
      });
      const answer = (await response.json()) as
        | { ok: true; report: OrganizedReport }
        | { ok: false; message: string };

      if (answer.ok) {
        setResult(answer.report);
        setText(""); // 같은 신고를 두 번 보내지 않도록 내용 칸을 비운다.
      } else {
        setError(answer.message);
      }
    } catch {
      setError(RETRY_MESSAGE);
    } finally {
      setSending(false);
    }
  }

  return (
    <>
      <form onSubmit={handleSubmit} noValidate className="mt-6 flex flex-col gap-5">
        <div className="flex flex-col gap-1">
          <label htmlFor="reporter" className="text-sm font-medium text-zinc-800 dark:text-zinc-200">
            신고자 이름
          </label>
          <input
            id="reporter"
            name="reporter"
            type="text"
            value={name}
            onChange={(event) => setName(event.target.value)}
            maxLength={MAX_NAME_LENGTH}
            placeholder="예: 직원A"
            autoComplete="off"
            className="w-56 rounded border border-zinc-300 bg-white px-3 py-2 text-black dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
          />
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="text" className="text-sm font-medium text-zinc-800 dark:text-zinc-200">
            변동 내용
          </label>
          <textarea
            id="text"
            name="text"
            value={text}
            onChange={(event) => setText(event.target.value)}
            rows={5}
            placeholder="예: 3층 A-12 직원A 모니터를 5층 B-03으로 옮겼어요"
            aria-describedby="text-count"
            className="rounded border border-zinc-300 bg-white px-3 py-2 text-black dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
          />
        </div>

        <div className="flex items-center justify-between gap-4">
          <p
            id="text-count"
            className={
              tooLong
                ? "text-sm font-medium text-red-700 dark:text-red-300"
                : "text-sm text-zinc-600 dark:text-zinc-400"
            }
          >
            {length} / {MAX_TEXT_LENGTH}자
          </p>
          <button
            type="submit"
            disabled={sending}
            className="rounded bg-foreground px-5 py-2 font-medium text-background disabled:opacity-50"
          >
            {sending ? "AI가 정리하는 중…" : "신고 보내기"}
          </button>
        </div>

        {error && (
          <p
            role="alert"
            className="rounded border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-800 dark:bg-red-950 dark:text-red-200"
          >
            {error}
          </p>
        )}
      </form>

      {result && <OrganizedResult report={result} />}
    </>
  );
}

// AI가 정리한 5개 항목을 보여 준다. (DESIGN.md 1.2)
function OrganizedResult({ report }: { report: OrganizedReport }) {
  return (
    <section
      role="status"
      aria-label="AI가 정리한 내용"
      className="mt-8 rounded border border-zinc-300 bg-zinc-50 px-5 py-4 dark:border-zinc-700 dark:bg-zinc-900"
    >
      <h2 className="text-lg font-semibold text-black dark:text-zinc-50">AI가 정리한 내용</h2>
      <dl className="mt-3 grid grid-cols-[6rem_1fr] gap-x-4 gap-y-2 text-sm text-zinc-900 dark:text-zinc-100">
        <dt className="font-medium text-zinc-600 dark:text-zinc-400">장비</dt>
        <dd>
          {report.equipment ? (
            describe(report.equipment)
          ) : report.candidates.length > 0 ? (
            <>
              확인 필요 — 아래 후보 중 하나로 보입니다.
              <ul className="mt-1 list-disc pl-5">
                {report.candidates.map((item) => (
                  <li key={`${item.type}-${item.serialTail}`}>{describe(item)}</li>
                ))}
              </ul>
            </>
          ) : (
            "확인 필요"
          )}
        </dd>
        <dt className="font-medium text-zinc-600 dark:text-zinc-400">변동 종류</dt>
        <dd>{report.changeType}</dd>
        <dt className="font-medium text-zinc-600 dark:text-zinc-400">이전 위치</dt>
        <dd>{report.oldLocation}</dd>
        <dt className="font-medium text-zinc-600 dark:text-zinc-400">새 위치</dt>
        <dd>{report.newLocation}</dd>
        <dt className="font-medium text-zinc-600 dark:text-zinc-400">사용자</dt>
        <dd>{report.userName}</dd>
      </dl>
      <p className="mt-4 text-sm text-zinc-700 dark:text-zinc-300">
        신고가 접수되었습니다. 관리자 확인 후 목록에 반영됩니다.
      </p>
    </section>
  );
}
