import Link from "next/link";

// 첫 화면 (DESIGN.md 1.1)
// 앱 이름과 이동 버튼 2개만 둔다.
export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col items-center justify-center gap-10 px-6 py-16">
      <h1 className="text-center text-4xl font-bold tracking-tight text-black dark:text-zinc-50">
        전산장비 관리 프로그램
      </h1>
      <div className="flex w-full flex-col gap-4 sm:w-auto sm:flex-row">
        <Link
          href="/report"
          className="flex h-14 items-center justify-center rounded-lg bg-foreground px-8 text-lg font-medium text-background"
        >
          변동 신고하기
        </Link>
        <Link
          href="/admin/reports"
          className="flex h-14 items-center justify-center rounded-lg border border-zinc-300 px-8 text-lg font-medium text-black dark:border-zinc-700 dark:text-zinc-50"
        >
          관리자 화면
        </Link>
      </div>
    </main>
  );
}
