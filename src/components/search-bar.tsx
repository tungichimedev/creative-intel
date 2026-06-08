"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function SearchBar() {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!url.trim()) return;

    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: url.trim() }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Search failed");
        return;
      }

      router.push(`/results/${data.searchId}`);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSearch} className="w-full max-w-2xl">
      <div className="flex gap-3">
        <input
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="Paste App Store or Google Play link..."
          className="flex-1 rounded-xl border border-zinc-300 bg-white px-5 py-3.5 text-base text-zinc-900 placeholder:text-zinc-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
          required
        />
        <button
          type="submit"
          disabled={loading}
          className="rounded-xl bg-blue-600 px-6 py-3.5 text-base font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? (
            <span className="flex items-center gap-2">
              <svg
                className="h-4 w-4 animate-spin"
                viewBox="0 0 24 24"
                fill="none"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                />
              </svg>
              Searching...
            </span>
          ) : (
            "Search Ads"
          )}
        </button>
      </div>
      {error && (
        <p className="mt-3 text-sm text-red-500">{error}</p>
      )}
      <p className="mt-3 text-sm text-zinc-500">
        Example: https://apps.apple.com/app/id123456 or
        https://play.google.com/store/apps/details?id=com.example.app
      </p>
    </form>
  );
}
