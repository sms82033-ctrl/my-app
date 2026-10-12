import { Suspense } from "react";
import { connection } from "next/server";
import { listEquipment } from "@/lib/equipment";
import { listPendingReports } from "@/lib/reports";
import { requireAdmin } from "@/lib/session";
import { ReportCard } from "./report-card";

// 신고 시각을 한국 시간으로 적는다. (예: 10월 12일 14:20)
const KOREAN_TIME = new Intl.DateTimeFormat("ko-KR", {
  timeZone: "Asia/Seoul",
  month: "long",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

// 신고 승인 화면 (DESIGN.md 1.4)
// 대기 중인 신고를 카드로 쌓아 보여 준다.
export default function ReportsPage() {
  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-10">
      <h1 className="text-2xl font-bold tracking-tight text-black dark:text-zinc-50">
        신고 승인
      </h1>
      {/* 저장소에서 신고를 가져오는 동안 "불러오는 중"을 먼저 보여 준다. */}
      <Suspense
        fallback={
          <p className="mt-6 text-zinc-600 dark:text-zinc-400">
            대기 중인 신고를 불러오는 중입니다…
          </p>
        }
      >
        <PendingReports />
      </Suspense>
    </main>
  );
}

// 대기 중인 신고와, 장비를 고를 때 쓸 장비 목록을 읽어 카드로 그린다.
async function PendingReports() {
  // 로그인하지 않았으면 로그인 화면으로 보낸다. 신고 내용을 읽기 전에 먼저 확인한다.
  await requireAdmin();
  // 빌드할 때 미리 만들어 두지 않고, 화면을 열 때마다 최신 신고를 읽는다.
  await connection();
  const [reports, equipment] = await Promise.all([listPendingReports(), listEquipment()]);

  if (!reports.ok || !equipment.ok) {
    const message = !reports.ok ? reports.message : !equipment.ok ? equipment.message : "";
    return (
      <p
        role="alert"
        className="mt-6 rounded border border-red-300 bg-red-50 px-4 py-3 text-red-800 dark:border-red-800 dark:bg-red-950 dark:text-red-200"
      >
        {message}
      </p>
    );
  }

  if (reports.items.length === 0) {
    return (
      <p role="status" className="mt-6 text-zinc-600 dark:text-zinc-400">
        대기 중인 신고가 없습니다.
      </p>
    );
  }

  return (
    <>
      <p role="status" className="mt-6 text-sm text-zinc-600 dark:text-zinc-400">
        대기 중인 신고 {reports.items.length}건
      </p>
      <ul className="mt-3 flex flex-col gap-5">
        {reports.items.map((report) => (
          <li key={report.id}>
            <ReportCard
              report={report}
              reportedAt={KOREAN_TIME.format(new Date(report.reported_at))}
              equipment={equipment.items}
            />
          </li>
        ))}
      </ul>
    </>
  );
}
