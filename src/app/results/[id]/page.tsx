import { prisma } from "@/lib/db";
import { notFound } from "next/navigation";
import { CreativeCard } from "@/components/creative-card";
import { ResultsFilter } from "./results-filter";

interface Props {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ platform?: string }>;
}

export default async function ResultsPage({ params, searchParams }: Props) {
  const { id } = await params;
  const { platform: filterPlatform } = await searchParams;

  const search = await prisma.search.findUnique({
    where: { id },
    include: {
      app: true,
      creatives: {
        orderBy: { createdAt: "desc" },
        where: filterPlatform ? { platform: filterPlatform } : undefined,
      },
    },
  });

  if (!search) return notFound();

  const totalMeta = search.metaCount;
  const totalTiktok = search.tiktokCount;

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      {/* Header */}
      <div className="border-b border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
        <div className="mx-auto flex max-w-7xl items-center gap-6 px-6 py-6">
          <a
            href="/"
            className="text-sm text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
          >
            &larr; Back
          </a>

          {search.app.icon && (
            <img
              src={search.app.icon}
              alt={search.app.name}
              className="h-16 w-16 rounded-2xl"
            />
          )}
          <div>
            <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">
              {search.app.name}
            </h1>
            <p className="text-sm text-zinc-500">
              {search.app.developer}
              {search.app.category && ` · ${search.app.category}`}
              {` · ${search.app.platform === "ios" ? "iOS" : "Android"}`}
            </p>
            <div className="mt-2 flex gap-4 text-sm">
              <span className="rounded-full bg-blue-100 px-3 py-1 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
                {totalMeta} Meta ads
              </span>
              <span className="rounded-full bg-pink-100 px-3 py-1 text-pink-700 dark:bg-pink-900/30 dark:text-pink-400">
                {totalTiktok} TikTok ads
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="mx-auto max-w-7xl px-6 pt-6">
        <ResultsFilter
          searchId={id}
          currentPlatform={filterPlatform || "all"}
        />
      </div>

      {/* Error messages */}
      {search.error && (
        <div className="mx-auto max-w-7xl px-6 pt-4">
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-200">
            {search.error}
          </div>
        </div>
      )}

      {/* Creative grid */}
      <div className="mx-auto max-w-7xl px-6 py-6">
        {search.creatives.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <p className="text-lg text-zinc-500">No creatives found</p>
            <p className="mt-2 text-sm text-zinc-400">
              {search.error
                ? "Check your API tokens in .env"
                : "Try a different app or check back later"}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {search.creatives.map((creative) => (
              <CreativeCard
                key={creative.id}
                platform={creative.platform}
                advertiser={creative.advertiser || undefined}
                headline={creative.headline || undefined}
                adCopy={creative.adCopy || undefined}
                mediaUrl={creative.mediaUrl || undefined}
                mediaType={creative.mediaType || undefined}
                thumbnailUrl={creative.thumbnailUrl || undefined}
                landingPage={creative.landingPage || undefined}
                firstSeen={creative.firstSeen?.toISOString()}
                lastSeen={creative.lastSeen?.toISOString()}
                isActive={creative.isActive}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
