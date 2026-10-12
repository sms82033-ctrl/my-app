import Link from "next/link";
import { ReportForm } from "./report-form";

// 변동 신고 화면 (DESIGN.md 1.2)
// 로그인 없이 쓰는 직원용 화면이다.
export default function ReportPage() {
  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-6 py-10">
      <Link href="/" className="text-sm text-zinc-600 underline dark:text-zinc-400">
        ← 첫 화면
      </Link>
      <h1 className="mt-4 text-2xl font-bold tracking-tight text-black dark:text-zinc-50">
        장비 변동 신고
      </h1>
      {/* 개인정보 안내 문구 (PRD 7번) */}
      <p className="mt-4 rounded border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-100">
        ⚠ 주민등록번호·전화번호 등 개인정보를 적지 마세요. 실습에서는 가짜 이름(예:
        직원A)을 사용합니다.
      </p>
      <ReportForm />
    </main>
  );
}
