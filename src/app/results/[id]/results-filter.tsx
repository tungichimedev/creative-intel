"use client";

import { useRouter } from "next/navigation";

interface Props {
  searchId: string;
  currentPlatform: string;
}

export function ResultsFilter({ searchId, currentPlatform }: Props) {
  const router = useRouter();

  function handleFilter(platform: string) {
    const url =
      platform === "all"
        ? `/results/${searchId}`
        : `/results/${searchId}?platform=${platform}`;
    router.push(url);
  }

  const tabs = [
    { key: "all", label: "All" },
    { key: "meta", label: "Meta" },
    { key: "tiktok", label: "TikTok" },
  ];

  return (
    <div className="flex gap-2">
      {tabs.map((tab) => (
        <button
          key={tab.key}
          onClick={() => handleFilter(tab.key)}
          className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
            currentPlatform === tab.key
              ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
              : "bg-white text-zinc-600 hover:bg-zinc-100 dark:bg-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800"
          }`}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
