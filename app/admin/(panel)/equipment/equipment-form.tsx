"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Equipment } from "@/lib/equipment";

// 자주 쓰는 장비 종류. 목록에 없는 종류도 직접 적을 수 있다.
const TYPES = ["본체", "모니터", "프린터", "스캐너", "복합기"];

const FIELD_CLASS =
  "w-full rounded border border-zinc-300 bg-white px-3 py-2 text-sm text-black disabled:bg-zinc-100 disabled:text-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50 dark:disabled:bg-zinc-800";
const LABEL_CLASS = "text-sm font-medium text-zinc-800 dark:text-zinc-200";

const EMPTY: Equipment = { serial: "", type: "", model: "", user_name: "", location: "", purchased_on: "" };

// 장비 1대의 정보를 입력하는 칸. 새 장비 입력과 장비 수정에 함께 쓴다.
// equipment를 넘기면 수정, 넘기지 않으면 입력이다.
export function EquipmentForm({ equipment }: { equipment?: Equipment }) {
  const isEdit = equipment !== undefined;
  const [values, setValues] = useState<Equipment>(equipment ?? EMPTY);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  // 칸 하나의 값을 바꾼다.
  function change(key: keyof Equipment, value: string) {
    setValues((current) => ({ ...current, [key]: value }));
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (sending) return;

    setSending(true);
    setError(null);
    try {
      const response = await fetch("/api/admin/equipment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: isEdit ? "update" : "create", ...values }),
      });
      const answer = (await response.json()) as { ok: true } | { ok: false; message: string };
      if (answer.ok) {
        // 장비 조회 화면으로 돌아가 방금 다룬 장비를 보여 준다.
        const serial = values.serial.trim().toUpperCase();
        // 입력 화면은 다시 열어도 적던 내용이 남아 있으므로, 등록이 끝나면 칸을 비운다.
        if (!isEdit) setValues(EMPTY);
        setSending(false);
        router.push(`/admin/equipment?q=${encodeURIComponent(serial)}&serial=${encodeURIComponent(serial)}`);
        router.refresh();
        return;
      }
      setError(answer.message);
    } catch {
      setError("저장하지 못했습니다. 다시 시도해 주세요.");
    }
    setSending(false);
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="mt-6 grid max-w-xl grid-cols-1 gap-4">
      <div className="flex flex-col gap-1">
        <label htmlFor="serial" className={LABEL_CLASS}>
          시리얼번호
        </label>
        <input
          id="serial"
          type="text"
          value={values.serial}
          onChange={(event) => change("serial", event.target.value)}
          disabled={isEdit}
          maxLength={20}
          placeholder="예: MN-0013"
          autoComplete="off"
          aria-describedby="serial-help"
          className={FIELD_CLASS}
        />
        <p id="serial-help" className="text-xs text-zinc-600 dark:text-zinc-400">
          {isEdit
            ? "시리얼번호는 장비를 구분하는 값이라 고칠 수 없습니다."
            : "영문, 숫자, -(빼기 기호)만 쓸 수 있고, 다른 장비와 겹칠 수 없습니다."}
        </p>
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="type" className={LABEL_CLASS}>
          종류
        </label>
        <input
          id="type"
          type="text"
          list="type-list"
          value={values.type}
          onChange={(event) => change("type", event.target.value)}
          maxLength={20}
          placeholder="예: 모니터"
          autoComplete="off"
          className={FIELD_CLASS}
        />
        <datalist id="type-list">
          {TYPES.map((type) => (
            <option key={type} value={type} />
          ))}
        </datalist>
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="model" className={LABEL_CLASS}>
          모델명
        </label>
        <input
          id="model"
          type="text"
          value={values.model}
          onChange={(event) => change("model", event.target.value)}
          maxLength={50}
          placeholder="예: LG 27UP850"
          autoComplete="off"
          className={FIELD_CLASS}
        />
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="user_name" className={LABEL_CLASS}>
          사용자
        </label>
        <input
          id="user_name"
          type="text"
          value={values.user_name}
          onChange={(event) => change("user_name", event.target.value)}
          maxLength={30}
          placeholder="예: 직원A (함께 쓰는 장비는 공용)"
          autoComplete="off"
          className={FIELD_CLASS}
        />
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="location" className={LABEL_CLASS}>
          위치
        </label>
        <input
          id="location"
          type="text"
          value={values.location}
          onChange={(event) => change("location", event.target.value)}
          maxLength={30}
          placeholder="예: 3층 A-12"
          autoComplete="off"
          className={FIELD_CLASS}
        />
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="purchased_on" className={LABEL_CLASS}>
          구입일
        </label>
        <input
          id="purchased_on"
          type="date"
          value={values.purchased_on}
          onChange={(event) => change("purchased_on", event.target.value)}
          className={FIELD_CLASS}
        />
      </div>

      <div className="mt-2 flex items-center gap-3">
        <button
          type="submit"
          disabled={sending}
          className="rounded bg-foreground px-5 py-2 text-sm font-medium text-background disabled:opacity-50"
        >
          {sending ? "저장하는 중…" : isEdit ? "고친 내용 저장" : "장비 등록"}
        </button>
        <Link href="/admin/equipment" className="text-sm text-zinc-600 underline dark:text-zinc-400">
          취소
        </Link>
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
  );
}
