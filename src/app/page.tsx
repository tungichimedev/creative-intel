import { SearchBar } from "@/components/search-bar";
import { prisma } from "@/lib/db";

export default async function Home() {
  // Fetch recent searches
  let recentSearches: {
    id: string;
    query: string;
    metaCount: number;
    tiktokCount: number;
    createdAt: Date;
    app: { name: string; icon: string | null; platform: string };
  }[] = [];

  try {
    recentSearches = await prisma.search.findMany({
      where: { status: "done" },
      orderBy: { createdAt: "desc" },
      take: 10,
      select: {
        id: true,
        query: true,
        metaCount: true,
        tiktokCount: true,
        createdAt: true,
        app: {
          select: { name: true, icon: true, platform: true },
        },
      },
    });
  } catch {
    // DB not set up yet — show empty
  }

  return (
    <div className="flex min-h-screen flex-col items-center bg-zinc-50 dark:bg-zinc-950">
      {/* Hero */}
      <div className="flex w-full flex-col items-center gap-8 px-4 pt-24 pb-16">
        <div className="text-center">
          <h1 className="text-4xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50 sm:text-5xl">
            Creative Intel
          </h1>
          <p className="mt-4 text-lg text-zinc-500 dark:text-zinc-400">
            Search ad creatives for any app across Meta & TikTok
          </p>
        </div>
        <SearchBar />
      </div>

      {/* Recent searches */}
      {recentSearches.length > 0 && (
        <div className="w-full max-w-3xl px-4 pb-16">
          <h2 className="mb-4 text-lg font-semibold text-zinc-700 dark:text-zinc-300">
            Recent Searches
          </h2>
          <div className="space-y-2">
            {recentSearches.map((s) => (
              <a
                key={s.id}
                href={`/results/${s.id}`}
                className="flex items-center gap-4 rounded-xl border border-zinc-200 bg-white p-4 transition-colors hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:bg-zinc-800"
              >
                {s.app.icon && (
                  <img
                    src={s.app.icon}
                    alt={s.app.name}
                    className="h-12 w-12 rounded-xl"
                  />
                )}
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-zinc-900 dark:text-zinc-100 truncate">
                    {s.app.name}
                  </p>
                  <p className="text-sm text-zinc-500">
                    {s.metaCount} Meta ads, {s.tiktokCount} TikTok ads
                  </p>
                </div>
                <span className="text-sm text-zinc-400">
                  {new Date(s.createdAt).toLocaleDateString()}
                </span>
              </a>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
