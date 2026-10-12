import { Suspense } from "react";
import Link from "next/link";
import { filterEquipment, listEquipment, type Equipment } from "@/lib/equipment";
import { listHistory, MAX_HISTORY } from "@/lib/history";
import { requireAdmin } from "@/lib/session";
import { DeleteButton } from "./delete-button";

// 검색어는 ?q=검색어, 선택한 장비는 ?serial=시리얼번호 형태로 주소 뒤에 붙는다.
type SearchParams = PageProps<"/admin/equipment">["searchParams"];

// 검색어 길이 제한 (너무 긴 글이 들어오지 않게 한다)
const MAX_QUERY_LENGTH = 50;

// 이력의 시각을 한국 시간으로 적는다. (예: 10월 12일 14:25)
const KOREAN_TIME = new Intl.DateTimeFormat("ko-KR", {
  timeZone: "Asia/Seoul",
  month: "long",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

const ALERT_CLASS =
  "mt-6 rounded border border-red-300 bg-red-50 px-4 py-3 text-red-800 dark:border-red-800 dark:bg-red-950 dark:text-red-200";

// 장비 조회 화면 (DESIGN.md 1.5)
// 검색 칸, 장비 표, 선택한 장비의 변경 이력을 보여 준다.
export default function EquipmentPage({ searchParams }: PageProps<"/admin/equipment">) {
  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-10">
      <h1 className="text-2xl font-bold tracking-tight text-black dark:text-zinc-50">
        장비 조회
      </h1>
      {/* 검색어를 읽고 저장소에서 목록을 가져오는 동안 "불러오는 중"을 먼저 보여 준다. */}
      <Suspense
        fallback={
          <p className="mt-6 text-zinc-600 dark:text-zinc-400">
            장비 목록을 불러오는 중입니다…
          </p>
        }
      >
        <EquipmentSearch searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

// 주소에서 값 하나를 꺼낸다. 같은 이름이 여러 번 오면 첫 번째만 쓴다.
function readParam(value: string | string[] | undefined): string {
  const text = Array.isArray(value) ? value[0] : value;
  return (text ?? "").trim().slice(0, MAX_QUERY_LENGTH);
}

// 이 화면의 주소를 만든다. 검색어와 선택한 장비를 주소에 담는다.
function pageUrl(query: string, serial?: string): string {
  const params = new URLSearchParams();
  if (query !== "") params.set("q", query);
  if (serial) params.set("serial", serial);
  const text = params.toString();
  return text === "" ? "/admin/equipment" : `/admin/equipment?${text}`;
}

// 검색 칸, 검색어에 맞는 장비 표, 선택한 장비의 변경 이력을 그린다.
async function EquipmentSearch({ searchParams }: { searchParams: SearchParams }) {
  // 로그인하지 않았으면 로그인 화면으로 보낸다. 장비 목록을 읽기 전에 먼저 확인한다.
  await requireAdmin();
  const params = await searchParams;
  const query = readParam(params.q);
  const result = await listEquipment();

  if (!result.ok) {
    return (
      <p role="alert" className={ALERT_CLASS}>
        {result.message}
      </p>
    );
  }

  const items = filterEquipment(result.items, query);
  // 선택한 장비는 전체 목록에서 찾는다. 목록에 없는 시리얼번호는 무시한다.
  const selected = result.items.find((item) => item.serial === readParam(params.serial));

  return (
    <>
      {/* 찾기를 누르면 같은 화면이 ?q=검색어 주소로 다시 열린다. */}
      <form action="/admin/equipment" method="get" className="mt-6 flex flex-wrap items-center gap-2">
        <label htmlFor="q" className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
          검색
        </label>
        <input
          id="q"
          name="q"
          type="search"
          defaultValue={query}
          maxLength={MAX_QUERY_LENGTH}
          placeholder="사용자·위치·시리얼번호"
          className="w-64 rounded border border-zinc-300 bg-white px-3 py-2 text-sm text-black dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
        />
        <button
          type="submit"
          className="rounded bg-foreground px-4 py-2 text-sm font-medium text-background"
        >
          찾기
        </button>
        {query !== "" && (
          <Link href="/admin/equipment" className="text-sm text-zinc-600 underline dark:text-zinc-400">
            전체 보기
          </Link>
        )}
      </form>
      <EquipmentTable items={items} query={query} selectedSerial={selected?.serial} />
      {selected && <HistorySection equipment={selected} />}
    </>
  );
}

// 장비 목록을 표로 그린다. 맞는 장비가 없으면 안내 문구를 보여 준다.
// 시리얼번호를 누르면 그 장비의 변경 이력이 표 아래에 나온다.
function EquipmentTable({
  items,
  query,
  selectedSerial,
}: {
  items: Equipment[];
  query: string;
  selectedSerial: string | undefined;
}) {
  if (items.length === 0) {
    return (
      <p role="status" className="mt-6 text-zinc-600 dark:text-zinc-400">
        해당 장비 없음
      </p>
    );
  }

  return (
    <>
      <p role="status" className="mt-6 text-sm text-zinc-600 dark:text-zinc-400">
        {query === "" ? `전체 ${items.length}대` : `"${query}" 검색 결과 ${items.length}대`}
        {" · 시리얼번호를 누르면 변경 이력이 아래에 나옵니다."}
      </p>
      <div className="mt-2 overflow-x-auto">
        <table className="w-full border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-zinc-300 text-zinc-700 dark:border-zinc-700 dark:text-zinc-300">
              <th scope="col" className="px-3 py-2 font-semibold">종류</th>
              <th scope="col" className="px-3 py-2 font-semibold">모델명</th>
              <th scope="col" className="px-3 py-2 font-semibold">시리얼번호</th>
              <th scope="col" className="px-3 py-2 font-semibold">사용자</th>
              <th scope="col" className="px-3 py-2 font-semibold">위치</th>
              <th scope="col" className="px-3 py-2 font-semibold">구입일</th>
              <th scope="col" className="px-3 py-2 font-semibold">관리</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => {
              const isSelected = item.serial === selectedSerial;
              return (
                <tr
                  key={item.serial}
                  className={
                    isSelected
                      ? "border-b border-zinc-200 bg-amber-50 text-zinc-900 dark:border-zinc-800 dark:bg-amber-950 dark:text-zinc-100"
                      : "border-b border-zinc-200 text-zinc-900 dark:border-zinc-800 dark:text-zinc-100"
                  }
                >
                  <td className="px-3 py-2">{item.type}</td>
                  <td className="px-3 py-2">{item.model}</td>
                  <td className="px-3 py-2 font-mono">
                    <Link
                      href={`${pageUrl(query, item.serial)}#history`}
                      aria-current={isSelected ? "true" : undefined}
                      className="underline underline-offset-2"
                    >
                      {item.serial}
                    </Link>
                  </td>
                  <td className="px-3 py-2">{item.user_name}</td>
                  <td className="px-3 py-2">{item.location}</td>
                  <td className="px-3 py-2">{item.purchased_on}</td>
                  <td className="whitespace-nowrap px-3 py-2">
                    <Link
                      href={`/admin/equipment/edit?serial=${encodeURIComponent(item.serial)}`}
                      aria-label={`${item.serial} 수정`}
                      className="mr-3 underline underline-offset-2"
                    >
                      수정
                    </Link>
                    <DeleteButton serial={item.serial} label={`${item.type} ${item.serial}`} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}

// 선택한 장비의 변경 이력을 최근 것부터 최대 10건까지 보여 준다. (PRD 5번)
async function HistorySection({ equipment }: { equipment: Equipment }) {
  const history = await listHistory(equipment.serial);

  return (
    <section id="history" aria-labelledby="history-title" className="mt-10 scroll-mt-6">
      <h2 id="history-title" className="text-lg font-semibold text-black dark:text-zinc-50">
        {equipment.type} {equipment.serial}의 변경 이력 (최근 {MAX_HISTORY}건)
      </h2>
      <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
        현재: {equipment.user_name} · {equipment.location}
      </p>

      {!history.ok ? (
        <p role="alert" className={ALERT_CLASS}>
          {history.message}
        </p>
      ) : history.items.length === 0 ? (
        <p className="mt-4 text-zinc-600 dark:text-zinc-400">변경 이력이 없습니다.</p>
      ) : (
        <ol className="mt-4 flex flex-col gap-3">
          {history.items.map((entry) => (
            <li
              key={entry.id}
              className="rounded border border-zinc-200 px-4 py-3 text-sm dark:border-zinc-800"
            >
              <p className="text-zinc-600 dark:text-zinc-400">
                {KOREAN_TIME.format(new Date(entry.changed_at))} ·{" "}
                {/* 신고 번호가 없는 이력은 관리자가 직접 고친 것이다. */}
                {entry.report_id === null ? entry.who : `신고자 ${entry.who}`} · {entry.what}
              </p>
              <p className="mt-1 text-zinc-900 dark:text-zinc-100">{entry.how}</p>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
