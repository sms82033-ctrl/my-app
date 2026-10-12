import { Suspense } from "react";
import Link from "next/link";
import { listEquipment } from "@/lib/equipment";
import { requireAdmin } from "@/lib/session";
import { EquipmentForm } from "../equipment-form";

// 고칠 장비는 ?serial=시리얼번호 형태로 주소 뒤에 붙는다.
type SearchParams = PageProps<"/admin/equipment/edit">["searchParams"];

// 장비 수정 화면 (PRD must 3, DESIGN.md 2.6)
export default function EditEquipmentPage({ searchParams }: PageProps<"/admin/equipment/edit">) {
  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-10">
      <h1 className="text-2xl font-bold tracking-tight text-black dark:text-zinc-50">
        장비 수정
      </h1>
      <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
        고친 내용은 변경 이력에 &ldquo;관리자 직접 수정&rdquo;으로 남습니다.
      </p>
      <Suspense
        fallback={
          <p className="mt-6 text-zinc-600 dark:text-zinc-400">장비 정보를 불러오는 중입니다…</p>
        }
      >
        <EditForm searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

// 주소의 시리얼번호로 장비를 찾아, 지금 값이 채워진 입력 칸을 보여 준다.
async function EditForm({ searchParams }: { searchParams: SearchParams }) {
  // 로그인하지 않았으면 로그인 화면으로 보낸다. 장비 정보를 읽기 전에 먼저 확인한다.
  await requireAdmin();
  const value = (await searchParams).serial;
  const serial = (Array.isArray(value) ? value[0] : value) ?? "";
  const result = await listEquipment();

  const equipment = result.ok ? result.items.find((item) => item.serial === serial) : undefined;
  if (!equipment) {
    return (
      <div className="mt-6">
        <p
          role="alert"
          className="rounded border border-red-300 bg-red-50 px-4 py-3 text-red-800 dark:border-red-800 dark:bg-red-950 dark:text-red-200"
        >
          {result.ok ? "그런 장비가 없습니다." : result.message}
        </p>
        <Link href="/admin/equipment" className="mt-3 inline-block text-sm text-zinc-600 underline dark:text-zinc-400">
          장비 조회로 돌아가기
        </Link>
      </div>
    );
  }

  // key를 주어, 다른 장비를 고치러 오거나 저장된 값이 바뀌면 입력 칸이 최신 값으로 다시 채워지게 한다.
  return <EquipmentForm key={Object.values(equipment).join("|")} equipment={equipment} />;
}
