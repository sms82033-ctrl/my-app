import Link from "next/link";

// 로그인한 관리자가 보는 화면(신고 승인, 장비 조회)의 공통 틀 (DESIGN.md 1.4, 1.5)
// 위쪽에 메뉴와 로그아웃을 두고, 그 아래에 각 화면을 보여 준다.
// 로그인 화면은 이 틀 밖에 있어서 메뉴가 나오지 않는다.
export default function AdminLayout({ children }: LayoutProps<"/admin">) {
  return (
    <>
      <nav
        aria-label="관리자 메뉴"
        className="border-b border-zinc-300 bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900"
      >
        <div className="mx-auto flex w-full max-w-5xl items-center gap-6 px-6 py-3 text-sm font-medium">
          <Link href="/admin/reports" className="text-black underline-offset-4 hover:underline dark:text-zinc-50">
            신고 승인
          </Link>
          <Link href="/admin/equipment" className="text-black underline-offset-4 hover:underline dark:text-zinc-50">
            장비 조회
          </Link>
          <Link href="/admin/equipment/new" className="text-black underline-offset-4 hover:underline dark:text-zinc-50">
            장비 입력
          </Link>
          {/* 로그아웃을 누르면 로그인 표시를 지우고 로그인 화면으로 돌아간다. */}
          <form action="/api/admin/logout" method="post" className="ml-auto">
            <button type="submit" className="text-zinc-700 underline-offset-4 hover:underline dark:text-zinc-300">
              로그아웃
            </button>
          </form>
        </div>
      </nav>
      {children}
    </>
  );
}
