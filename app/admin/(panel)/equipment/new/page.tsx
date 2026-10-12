import { EquipmentForm } from "../equipment-form";

// 장비 입력 화면 (PRD must 3, DESIGN.md 2.6)
// 로그인 확인은 proxy.ts가 먼저 하고, 저장할 때 서버 경로가 한 번 더 한다.
export default function NewEquipmentPage() {
  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-10">
      <h1 className="text-2xl font-bold tracking-tight text-black dark:text-zinc-50">
        장비 입력
      </h1>
      <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
        새 장비를 목록에 등록합니다. 실습에서는 가짜 이름(예: 직원A)만 사용합니다.
      </p>
      <EquipmentForm />
    </main>
  );
}
