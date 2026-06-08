import { chromium, type Page, type BrowserContext } from "playwright";
import type { MetaAd, MetaSearchResult } from "./meta.js";

/**
 * Scrape Meta Ad Library directly — no API token needed.
 * Opens facebook.com/ads/library in a headless browser,
 * intercepts the GraphQL responses containing ad data.
 */
export async function scrapeMetaAds(
  searchTerms: string,
  options: {
    country?: string;
    maxAds?: number;
    headless?: boolean;
  } = {}
): Promise<MetaSearchResult> {
  const { country = "US", maxAds = 30, headless = true } = options;

  const collectedAds: MetaAd[] = [];
  const seenIds = new Set<string>();

  // Build the public Ad Library URL
  const params = new URLSearchParams({
    active_status: "active",
    ad_type: "all",
    country,
    q: searchTerms,
    sort_data: '[{"direction":"desc","mode":"relevancy_monthly_grouped"}]',
    search_type: "keyword_unordered",
  });
  const url = `https://www.facebook.com/ads/library/?${params}`;

  const browser = await chromium.launch({
    headless,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-blink-features=AutomationControlled",
    ],
  });

  try {
    const context = await browser.newContext({
      userAgent:
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
      viewport: { width: 1440, height: 900 },
      locale: "en-US",
    });

    // Anti-detection
    await setupStealth(context);

    const page = await context.newPage();

    // Intercept GraphQL responses
    setupGraphQLInterception(page, collectedAds, seenIds);

    // Navigate to ad library
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });

    // Handle cookie consent
    await handleCookieConsent(page);

    // Wait for ads to load
    await page.waitForTimeout(4000);

    // Scroll to load more ads
    let scrollAttempts = 0;
    const maxScrolls = Math.ceil(maxAds / 10); // ~10 ads per scroll

    while (collectedAds.length < maxAds && scrollAttempts < maxScrolls) {
      // If GraphQL interception didn't catch enough, try DOM extraction
      if (collectedAds.length === 0 && scrollAttempts >= 2) {
        const domAds = await extractAdsFromDOM(page);
        for (const ad of domAds) {
          if (!seenIds.has(ad.id)) {
            seenIds.add(ad.id);
            collectedAds.push(ad);
          }
        }
      }

      // Scroll down to trigger lazy loading
      await page.evaluate(() => window.scrollBy(0, 800));
      await page.waitForTimeout(1500 + Math.random() * 1500);

      // Try clicking "See more" if available
      try {
        const seeMore = await page.$(
          '[aria-label="See more"], [data-testid="see-more-button"]'
        );
        if (seeMore) {
          await seeMore.click();
          await page.waitForTimeout(2000);
        }
      } catch {
        // No button found, continue scrolling
      }

      scrollAttempts++;
    }

    // Final DOM extraction attempt if GraphQL yielded nothing
    if (collectedAds.length === 0) {
      const domAds = await extractAdsFromDOM(page);
      for (const ad of domAds) {
        if (!seenIds.has(ad.id)) {
          seenIds.add(ad.id);
          collectedAds.push(ad);
        }
      }
    }

    await context.close();
  } finally {
    await browser.close();
  }

  return {
    ads: collectedAds.slice(0, maxAds),
    total: collectedAds.length,
    hasMore: collectedAds.length >= maxAds,
  };
}

/** Intercept Facebook's internal GraphQL calls to extract ad data */
function setupGraphQLInterception(
  page: Page,
  collectedAds: MetaAd[],
  seenIds: Set<string>
) {
  page.on("response", async (response) => {
    const url = response.url();
    if (!url.includes("/api/graphql") && !url.includes("/graphql")) return;

    try {
      const text = await response.text();

      // Facebook sometimes returns multiple JSON objects separated by newlines
      const jsonParts = text.split("\n").filter((line) => line.trim());

      for (const part of jsonParts) {
        try {
          const json = JSON.parse(part);
          extractAdsFromGraphQL(json, collectedAds, seenIds);
        } catch {
          // Not valid JSON, skip
        }
      }
    } catch {
      // Response body not available, skip
    }
  });
}

/** Extract ads from GraphQL response JSON */
function extractAdsFromGraphQL(
  data: Record<string, unknown>,
  collectedAds: MetaAd[],
  seenIds: Set<string>
) {
  // Recursively search for ad data in the response
  const searchPaths = [
    "data.ad_library_search.edges",
    "data.ad_library_main.search_results.edges",
    "data.adLibrarySearch.edges",
  ];

  let edges: Record<string, unknown>[] | null = null;

  // Try known paths first
  for (const path of searchPaths) {
    const result = getNestedValue(data, path);
    if (Array.isArray(result) && result.length > 0) {
      edges = result as Record<string, unknown>[];
      break;
    }
  }

  // Fallback: recursively find arrays with "node" objects that look like ads
  if (!edges) {
    edges = findAdEdges(data);
  }

  if (!edges) return;

  for (const edge of edges) {
    const node = (edge.node || edge) as Record<string, unknown>;
    if (!node) continue;

    const adId = String(
      node.ad_archive_id || node.adArchiveID || node.id || ""
    );
    if (!adId || seenIds.has(adId)) continue;

    const pageObj = node.page as Record<string, unknown> | undefined;
    const snapshot = node.snapshot as Record<string, unknown> | undefined;

    const ad: MetaAd = {
      id: adId,
      pageId: pageObj?.id ? String(pageObj.id) : undefined,
      pageName: pageObj?.name ? String(pageObj.name) : undefined,
      adCreativeBodies: extractTexts(
        node.ad_creative_bodies || snapshot?.body
      ),
      adCreativeLinkTitles: extractTexts(
        node.ad_creative_link_titles || snapshot?.title
      ),
      adCreativeLinkCaptions: extractTexts(
        node.ad_creative_link_captions || snapshot?.link_title
      ),
      adCreativeLinkDescriptions: extractTexts(
        node.ad_creative_link_descriptions || snapshot?.link_description
      ),
      adSnapshotUrl: node.ad_snapshot_url
        ? String(node.ad_snapshot_url)
        : `https://www.facebook.com/ads/library/?id=${adId}`,
      adDeliveryStartTime: node.ad_delivery_start_time
        ? String(node.ad_delivery_start_time)
        : undefined,
      adDeliveryStopTime: node.ad_delivery_stop_time
        ? String(node.ad_delivery_stop_time)
        : undefined,
      spend: node.spend as MetaAd["spend"],
      impressions: node.impressions as MetaAd["impressions"],
      publisherPlatforms: node.publisher_platforms as string[] | undefined,
    };

    seenIds.add(adId);
    collectedAds.push(ad);
  }
}

/** Extract ad data from DOM as fallback */
async function extractAdsFromDOM(page: Page): Promise<MetaAd[]> {
  return page.evaluate(() => {
    const ads: Array<{
      id: string;
      pageName?: string;
      adCreativeBodies?: string[];
      adSnapshotUrl?: string;
      adDeliveryStartTime?: string;
      publisherPlatforms?: string[];
    }> = [];

    // Try multiple selector strategies
    const selectors = [
      '[data-testid="ad_library_card"]',
      '[role="article"]',
      ".xrvj5dj", // Common Facebook ad card class
    ];

    let cards: Element[] = [];
    for (const sel of selectors) {
      const found = document.querySelectorAll(sel);
      if (found.length > 0) {
        cards = Array.from(found);
        break;
      }
    }

    cards.forEach((card, i) => {
      const text = card.textContent || "";
      if (text.length < 20) return;

      // Extract page name (usually the first link text)
      const links = card.querySelectorAll("a");
      let pageName: string | undefined;
      for (const link of links) {
        const href = link.getAttribute("href") || "";
        if (href.includes("facebook.com/") && link.textContent?.trim()) {
          pageName = link.textContent.trim();
          break;
        }
      }

      // Extract body text (longest text block)
      const spans = card.querySelectorAll("span");
      let longestText = "";
      for (const span of spans) {
        const t = span.textContent?.trim() || "";
        if (t.length > longestText.length && t.length > 30) {
          longestText = t;
        }
      }

      // Extract date
      let startDate: string | undefined;
      const dateMatch = text.match(
        /Started running on ([A-Za-z]+ \d{1,2}, \d{4})/
      );
      if (dateMatch) {
        startDate = dateMatch[1];
      }

      // Extract ad ID from links
      let adId = `dom_${i}`;
      for (const link of links) {
        const href = link.getAttribute("href") || "";
        const idMatch = href.match(/id=(\d+)/);
        if (idMatch) {
          adId = idMatch[1];
          break;
        }
      }

      if (pageName || longestText) {
        ads.push({
          id: adId,
          pageName,
          adCreativeBodies: longestText ? [longestText] : undefined,
          adSnapshotUrl: `https://www.facebook.com/ads/library/?id=${adId}`,
          adDeliveryStartTime: startDate,
        });
      }
    });

    return ads;
  });
}

/** Setup stealth to avoid detection */
async function setupStealth(context: BrowserContext) {
  await context.addInitScript(() => {
    // Hide webdriver
    Object.defineProperty(navigator, "webdriver", { get: () => undefined });

    // Mock chrome runtime
    (window as unknown as Record<string, unknown>).chrome = {
      runtime: { onConnect: undefined, onMessage: undefined },
    };

    // Mock plugins
    Object.defineProperty(navigator, "plugins", {
      get: () => [
        { name: "Chrome PDF Plugin", filename: "internal-pdf-viewer" },
        { name: "Chrome PDF Viewer" },
        { name: "Native Client" },
      ],
    });

    // Mock languages
    Object.defineProperty(navigator, "languages", {
      get: () => ["en-US", "en"],
    });
  });
}

/** Handle cookie consent dialogs */
async function handleCookieConsent(page: Page) {
  const selectors = [
    '[data-testid="cookie-policy-manage-dialog-accept-button"]',
    '[aria-label="Accept all"]',
    '[aria-label="Allow all cookies"]',
    'button:has-text("Accept All")',
    '[data-cookiebanner="accept_button"]',
  ];

  for (const sel of selectors) {
    try {
      const btn = await page.$(sel);
      if (btn) {
        await btn.click();
        await page.waitForTimeout(1000);
        return;
      }
    } catch {
      // Continue
    }
  }
}

/** Get nested value from object using dot notation */
function getNestedValue(
  obj: Record<string, unknown>,
  path: string
): unknown {
  return path.split(".").reduce<unknown>((acc, key) => {
    if (acc && typeof acc === "object" && key in (acc as Record<string, unknown>)) {
      return (acc as Record<string, unknown>)[key];
    }
    return undefined;
  }, obj);
}

/** Recursively find arrays that look like ad edges */
function findAdEdges(
  obj: unknown,
  depth = 0
): Record<string, unknown>[] | null {
  if (depth > 8 || !obj || typeof obj !== "object") return null;

  if (Array.isArray(obj)) {
    // Check if this array contains ad-like nodes
    const first = obj[0] as Record<string, unknown> | undefined;
    if (first) {
      const node = (first.node || first) as Record<string, unknown>;
      if (
        node &&
        (node.ad_archive_id || node.adArchiveID || node.ad_creative_bodies)
      ) {
        return obj as Record<string, unknown>[];
      }
    }
  }

  const record = obj as Record<string, unknown>;
  for (const key of Object.keys(record)) {
    const result = findAdEdges(record[key], depth + 1);
    if (result) return result;
  }

  return null;
}

/** Extract text array from various formats */
function extractTexts(value: unknown): string[] | undefined {
  if (!value) return undefined;
  if (Array.isArray(value)) {
    return value
      .map((v) =>
        typeof v === "string" ? v : typeof v === "object" && v !== null ? String((v as Record<string, unknown>).text || v) : String(v)
      )
      .filter(Boolean);
  }
  if (typeof value === "string") return [value];
  if (typeof value === "object") {
    const text = (value as Record<string, unknown>).text;
    if (text) return [String(text)];
  }
  return undefined;
}
