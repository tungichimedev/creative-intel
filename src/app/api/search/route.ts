import { NextRequest, NextResponse } from "next/server";
import { parseAppLink } from "@/lib/parsers/app-link";
import { searchMetaAds, type MetaAd } from "@/lib/platforms/meta";
import { searchTikTokAds, type TikTokAd } from "@/lib/platforms/tiktok";
import { prisma } from "@/lib/db";

/** Try Playwright scraper first, fall back to SearchAPI */
async function searchMetaCreatives(appName: string): Promise<{
  ads: MetaAd[];
  error: string | null;
  source: string;
}> {
  // Option 1: Playwright scraper (free, no token)
  // Only available when running locally or on a server with Chromium
  try {
    const { scrapeMetaAds } = await import("@/lib/platforms/meta-scraper");
    const result = await scrapeMetaAds(appName, { maxAds: 30 });
    if (result.ads.length > 0) {
      return { ads: result.ads, error: null, source: "scraper" };
    }
  } catch (err) {
    // Playwright not available (e.g., Vercel serverless) — fall through
    console.log("Playwright scraper unavailable:", (err as Error).message);
  }

  // Option 2: SearchAPI.io (paid, but no approval needed)
  const searchApiKey = process.env.SEARCHAPI_KEY;
  if (searchApiKey) {
    try {
      const result = await searchMetaAds(appName, { apiKey: searchApiKey });
      return { ads: result.ads, error: null, source: "searchapi" };
    } catch (err) {
      return { ads: [], error: (err as Error).message, source: "searchapi" };
    }
  }

  return {
    ads: [],
    error: "No Meta search method available. Run locally for free scraping, or set SEARCHAPI_KEY.",
    source: "none",
  };
}

export async function POST(req: NextRequest) {
  const { url } = await req.json();

  if (!url || typeof url !== "string") {
    return NextResponse.json({ error: "Missing app URL" }, { status: 400 });
  }

  // Step 1: Parse app link → extract metadata
  const appInfo = await parseAppLink(url.trim());
  if (!appInfo) {
    return NextResponse.json(
      { error: "Could not parse app link. Supported: App Store, Google Play URLs." },
      { status: 400 }
    );
  }

  // Step 2: Upsert app in DB
  const app = await prisma.app.upsert({
    where: { storeUrl: appInfo.storeUrl },
    update: {
      name: appInfo.name,
      developer: appInfo.developer,
      icon: appInfo.icon,
      category: appInfo.category,
    },
    create: {
      name: appInfo.name,
      developer: appInfo.developer,
      bundleId: appInfo.bundleId,
      storeUrl: appInfo.storeUrl,
      platform: appInfo.platform,
      icon: appInfo.icon,
      category: appInfo.category,
    },
  });

  // Step 3: Create search record
  const search = await prisma.search.create({
    data: {
      appId: app.id,
      query: appInfo.name,
      status: "running",
    },
  });

  // Step 4: Search platforms in parallel
  const tiktokToken = process.env.TIKTOK_ACCESS_TOKEN;

  const results = {
    meta: { ads: [] as MetaAd[], error: null as string | null, source: "none" },
    tiktok: { ads: [] as TikTokAd[], error: null as string | null },
  };

  const searches = [];

  // Meta search (scraper first, then SearchAPI fallback)
  searches.push(
    searchMetaCreatives(appInfo.name)
      .then(async (res) => {
        results.meta.ads = res.ads;
        results.meta.error = res.error;
        results.meta.source = res.source;
        // Store creatives
        for (const ad of res.ads) {
          await prisma.creative.upsert({
            where: {
              platform_platformAdId: {
                platform: "meta",
                platformAdId: ad.id,
              },
            },
            update: {
              adCopy: ad.adCreativeBodies?.[0] || null,
              headline: ad.adCreativeLinkTitles?.[0] || null,
              advertiser: ad.pageName || null,
              mediaUrl: ad.adSnapshotUrl || null,
              firstSeen: ad.adDeliveryStartTime
                ? new Date(ad.adDeliveryStartTime)
                : null,
              lastSeen: ad.adDeliveryStopTime
                ? new Date(ad.adDeliveryStopTime)
                : null,
              isActive: !ad.adDeliveryStopTime,
              rawData: JSON.parse(JSON.stringify(ad)),
            },
            create: {
              appId: app.id,
              searchId: search.id,
              platform: "meta",
              platformAdId: ad.id,
              adCopy: ad.adCreativeBodies?.[0] || null,
              headline: ad.adCreativeLinkTitles?.[0] || null,
              advertiser: ad.pageName || null,
              mediaUrl: ad.adSnapshotUrl || null,
              mediaType: ad.mediaType || "image",
              firstSeen: ad.adDeliveryStartTime
                ? new Date(ad.adDeliveryStartTime)
                : null,
              lastSeen: ad.adDeliveryStopTime
                ? new Date(ad.adDeliveryStopTime)
                : null,
              isActive: !ad.adDeliveryStopTime,
              rawData: JSON.parse(JSON.stringify(ad)),
            },
          });
        }
      })
      .catch((err) => {
        results.meta.error = err.message;
      })
  );

  // TikTok search
  if (tiktokToken) {
    searches.push(
      searchTikTokAds(appInfo.name, { accessToken: tiktokToken })
        .then(async (res) => {
          results.tiktok.ads = res.ads;
          for (const ad of res.ads) {
            await prisma.creative.upsert({
              where: {
                platform_platformAdId: {
                  platform: "tiktok",
                  platformAdId: ad.id,
                },
              },
              update: {
                adCopy: ad.adText || null,
                headline: ad.adTitle || null,
                advertiser: ad.advertiserName || null,
                mediaUrl: ad.videoUrl || ad.imageUrl || null,
                thumbnailUrl: ad.thumbnailUrl || null,
                landingPage: ad.landingPageUrl || null,
                firstSeen: ad.firstShown ? new Date(ad.firstShown) : null,
                lastSeen: ad.lastShown ? new Date(ad.lastShown) : null,
                rawData: JSON.parse(JSON.stringify(ad)),
              },
              create: {
                appId: app.id,
                searchId: search.id,
                platform: "tiktok",
                platformAdId: ad.id,
                adCopy: ad.adText || null,
                headline: ad.adTitle || null,
                advertiser: ad.advertiserName || null,
                mediaUrl: ad.videoUrl || ad.imageUrl || null,
                mediaType: ad.videoUrl ? "video" : "image",
                thumbnailUrl: ad.thumbnailUrl || null,
                landingPage: ad.landingPageUrl || null,
                firstSeen: ad.firstShown ? new Date(ad.firstShown) : null,
                lastSeen: ad.lastShown ? new Date(ad.lastShown) : null,
                rawData: JSON.parse(JSON.stringify(ad)),
              },
            });
          }
        })
        .catch((err) => {
          results.tiktok.error = err.message;
        })
    );
  } else {
    results.tiktok.error = "TIKTOK_ACCESS_TOKEN not configured";
  }

  await Promise.all(searches);

  // Step 5: Update search record
  await prisma.search.update({
    where: { id: search.id },
    data: {
      status: "done",
      metaCount: results.meta.ads.length,
      tiktokCount: results.tiktok.ads.length,
      error:
        results.meta.error && results.tiktok.error
          ? `Meta: ${results.meta.error}; TikTok: ${results.tiktok.error}`
          : results.meta.error || results.tiktok.error || null,
    },
  });

  return NextResponse.json({
    app: {
      id: app.id,
      name: app.name,
      developer: app.developer,
      icon: app.icon,
      category: app.category,
      platform: app.platform,
    },
    searchId: search.id,
    meta: {
      count: results.meta.ads.length,
      ads: results.meta.ads,
      error: results.meta.error,
      source: results.meta.source,
    },
    tiktok: {
      count: results.tiktok.ads.length,
      ads: results.tiktok.ads,
      error: results.tiktok.error,
    },
  });
}
