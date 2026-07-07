import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="text-center">
        <h1 className="text-6xl font-bold text-gray-300 dark:text-gray-600">
          404
        </h1>
        <p className="mt-4 text-lg text-gray-500 dark:text-gray-400">
          页面不存在
        </p>
        <Link
          href="/notes"
          className="mt-6 inline-block rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
        >
          返回首页
        </Link>
      </div>
    </div>
  );
}
