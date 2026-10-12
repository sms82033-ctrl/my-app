import Link from "next/link";
import { LoginForm } from "./login-form";

// 관리자 로그인 화면 (DESIGN.md 1.3)
export default function LoginPage() {
  return (
    <main className="mx-auto w-full max-w-md flex-1 px-6 py-16">
      <Link href="/" className="text-sm text-zinc-600 underline dark:text-zinc-400">
        ← 첫 화면
      </Link>
      <h1 className="mt-4 text-2xl font-bold tracking-tight text-black dark:text-zinc-50">
        관리자 로그인
      </h1>
      <LoginForm />
    </main>
  );
}
