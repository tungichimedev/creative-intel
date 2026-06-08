"use client";

import { useState } from "react";

interface CreativeCardProps {
  platform: string;
  advertiser?: string;
  headline?: string;
  adCopy?: string;
  mediaUrl?: string;
  mediaType?: string;
  thumbnailUrl?: string;
  landingPage?: string;
  firstSeen?: string;
  lastSeen?: string;
  isActive?: boolean;
}

export function CreativeCard({
  platform,
  advertiser,
  headline,
  adCopy,
  mediaUrl,
  mediaType,
  thumbnailUrl,
  landingPage,
  firstSeen,
  lastSeen,
  isActive,
}: CreativeCardProps) {
  const [expanded, setExpanded] = useState(false);

  const platformColors: Record<string, string> = {
    meta: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
    tiktok: "bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-400",
  };

  const daysSinceStart = firstSeen
    ? Math.floor(
        (Date.now() - new Date(firstSeen).getTime()) / (1000 * 60 * 60 * 24)
      )
    : null;

  return (
    <div className="group rounded-xl border border-zinc-200 bg-white overflow-hidden transition-shadow hover:shadow-lg dark:border-zinc-800 dark:bg-zinc-900">
      {/* Media preview */}
      <div className="relative aspect-video bg-zinc-100 dark:bg-zinc-800">
        {mediaType === "video" && mediaUrl ? (
          <video
            src={mediaUrl}
            poster={thumbnailUrl || undefined}
            className="h-full w-full object-cover"
            controls
            preload="none"
          />
        ) : thumbnailUrl || mediaUrl ? (
          // For Meta ads, mediaUrl is the snapshot URL (an iframe page)
          // Show thumbnail if available, otherwise link to snapshot
          <a
            href={mediaUrl || "#"}
            target="_blank"
            rel="noopener noreferrer"
            className="block h-full w-full"
          >
            {thumbnailUrl ? (
              <img
                src={thumbnailUrl}
                alt={headline || "Ad creative"}
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-zinc-400">
                <span className="text-sm">Click to view ad snapshot</span>
              </div>
            )}
          </a>
        ) : (
          <div className="flex h-full w-full items-center justify-center text-zinc-400">
            <svg
              className="h-12 w-12"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0022.5 18.75V5.25A2.25 2.25 0 0020.25 3H3.75A2.25 2.25 0 001.5 5.25v13.5A2.25 2.25 0 003.75 21z"
              />
            </svg>
          </div>
        )}

        {/* Platform badge */}
        <span
          className={`absolute left-3 top-3 rounded-full px-2.5 py-1 text-xs font-medium ${platformColors[platform] || "bg-zinc-100 text-zinc-700"}`}
        >
          {platform === "meta" ? "Meta" : "TikTok"}
        </span>

        {/* Active badge */}
        {isActive && (
          <span className="absolute right-3 top-3 flex items-center gap-1 rounded-full bg-green-100 px-2 py-1 text-xs font-medium text-green-700 dark:bg-green-900/30 dark:text-green-400">
            <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
            Active
          </span>
        )}
      </div>

      {/* Content */}
      <div className="p-4">
        {advertiser && (
          <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
            {advertiser}
          </p>
        )}

        {headline && (
          <h3 className="mt-1 text-sm font-semibold text-zinc-900 line-clamp-2 dark:text-zinc-100">
            {headline}
          </h3>
        )}

        {adCopy && (
          <p
            className={`mt-2 text-sm text-zinc-600 dark:text-zinc-300 ${expanded ? "" : "line-clamp-3"}`}
          >
            {adCopy}
          </p>
        )}

        {adCopy && adCopy.length > 150 && (
          <button
            onClick={() => setExpanded(!expanded)}
            className="mt-1 text-xs text-blue-600 hover:underline"
          >
            {expanded ? "Show less" : "Show more"}
          </button>
        )}

        {/* Meta info row */}
        <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-zinc-400">
          {daysSinceStart !== null && (
            <span>Running {daysSinceStart}d</span>
          )}
          {firstSeen && (
            <span>
              Started{" "}
              {new Date(firstSeen).toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
              })}
            </span>
          )}
          {landingPage && (
            <a
              href={landingPage}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-500 hover:underline"
            >
              Landing page
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
