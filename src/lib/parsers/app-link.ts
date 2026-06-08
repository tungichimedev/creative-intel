export interface AppInfo {
  name: string;
  developer: string;
  bundleId: string;
  storeUrl: string;
  platform: "ios" | "android";
  icon: string;
  category: string;
}

/** Parse App Store URL → extract app ID */
function parseAppStoreUrl(url: string): { id: string; country: string } | null {
  // https://apps.apple.com/us/app/some-name/id123456
  // https://apps.apple.com/app/id123456
  const match = url.match(
    /apps\.apple\.com\/(?:(\w{2})\/)?app\/(?:[^/]+\/)?id(\d+)/
  );
  if (!match) return null;
  return { country: match[1] || "us", id: match[2] };
}

/** Parse Play Store URL → extract package name */
function parsePlayStoreUrl(url: string): string | null {
  // https://play.google.com/store/apps/details?id=com.example.app
  const match = url.match(/play\.google\.com\/store\/apps\/details\?id=([^\s&]+)/);
  return match ? match[1] : null;
}

/** Fetch app metadata from App Store lookup API */
async function fetchAppStoreInfo(
  appId: string,
  country: string
): Promise<AppInfo | null> {
  const res = await fetch(
    `https://itunes.apple.com/lookup?id=${appId}&country=${country}`
  );
  const data = await res.json();
  const result = data.results?.[0];
  if (!result) return null;

  return {
    name: result.trackName,
    developer: result.artistName,
    bundleId: result.bundleId,
    storeUrl: result.trackViewUrl,
    platform: "ios",
    icon: result.artworkUrl512 || result.artworkUrl100,
    category: result.primaryGenreName,
  };
}

/** Fetch app metadata from Google Play (via a simple scrape of the page) */
async function fetchPlayStoreInfo(packageName: string): Promise<AppInfo | null> {
  try {
    const res = await fetch(
      `https://play.google.com/store/apps/details?id=${packageName}&hl=en`,
      {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
        },
      }
    );
    const html = await res.text();

    // Extract title from <title> tag: "App Name - Apps on Google Play"
    const titleMatch = html.match(/<title>([^<]+)<\/title>/);
    const rawTitle = titleMatch?.[1] || "";
    const name = rawTitle.replace(/ - Apps on Google Play$/, "").trim();

    // Extract developer from meta tag or structured data
    const devMatch = html.match(
      /<a[^>]*class="[^"]*"[^>]*href="\/store\/apps\/dev[^"]*"[^>]*>([^<]+)<\/a>/
    );
    const developer = devMatch?.[1]?.trim() || "";

    // Extract icon
    const iconMatch = html.match(
      /<img[^>]*src="(https:\/\/play-lh\.googleusercontent\.com\/[^"]+)"[^>]*alt="Icon"/
    );
    const icon = iconMatch?.[1] || "";

    // Extract category
    const catMatch = html.match(
      /itemprop="genre"[^>]*content="([^"]+)"/
    );
    const category = catMatch?.[1] || "";

    if (!name) return null;

    return {
      name,
      developer,
      bundleId: packageName,
      storeUrl: `https://play.google.com/store/apps/details?id=${packageName}`,
      platform: "android",
      icon,
      category,
    };
  } catch {
    return null;
  }
}

/** Main entry: parse any app store link and return metadata */
export async function parseAppLink(url: string): Promise<AppInfo | null> {
  // Try App Store
  const appStore = parseAppStoreUrl(url);
  if (appStore) {
    return fetchAppStoreInfo(appStore.id, appStore.country);
  }

  // Try Play Store
  const packageName = parsePlayStoreUrl(url);
  if (packageName) {
    return fetchPlayStoreInfo(packageName);
  }

  return null;
}
