import { api } from "~/trpc/server";

export const dynamic = "force-dynamic";

export default async function Home() {
  const health = await api.health.check();

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-2">
      <h1 className="text-2xl">finbro</h1>
      <p className="text-sm">Database time: {health.dbTime}</p>
    </main>
  );
}
