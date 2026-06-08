export interface TikTokAd {
  id: string;
  advertiserName?: string;
  adTitle?: string;
  adText?: string;
  videoUrl?: string;
  imageUrl?: string;
  thumbnailUrl?: string;
  landingPageUrl?: string;
  firstShown?: string;
  lastShown?: string;
  ctr?: number;
  reach?: number;
  likes?: number;
  industry?: string;
  objective?: string;
  format?: string;
}

export interface TikTokSearchResult {
  ads: TikTokAd[];
  total: number;
  hasMore: boolean;
  cursor?: number;
}

/**
 * Search TikTok Commercial Content API for ads.
 *
 * Endpoint: POST /v2/research/adlib/ad/query/
 * Docs: https://developers.tiktok.com/doc/commercial-content-api-query-ads
 */
export async function searchTikTokAds(
  searchTerms: string,
  options: {
    accessToken: string;
    region?: string;
    limit?: number;
    cursor?: number;
  }
): Promise<TikTokSearchResult> {
  const {
    accessToken,
    region = "US",
    limit = 20,
    cursor = 0,
  } = options;

  const body = {
    search_term: searchTerms,
    region_code: region,
    count: limit,
    cursor,
  };

  const res = await fetch(
    "https://open.tiktokapis.com/v2/research/adlib/ad/query/",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify(body),
    }
  );

  const data = await res.json();

  if (data.error?.code) {
    throw new Error(
      `TikTok API error: ${data.error.message} (code: ${data.error.code})`
    );
  }

  const adList = data.data?.ads || [];
  const ads: TikTokAd[] = adList.map(
    (ad: Record<string, unknown>) => ({
      id: String(ad.ad_id || ad.id || ""),
      advertiserName: ad.business_name as string | undefined,
      adTitle: ad.ad_title as string | undefined,
      adText: ad.ad_text as string | undefined,
      videoUrl: ad.videos
        ? (ad.videos as Record<string, unknown>[])[0]?.video_url as string
        : undefined,
      imageUrl: ad.image_urls
        ? (ad.image_urls as string[])[0]
        : undefined,
      thumbnailUrl: ad.videos
        ? (ad.videos as Record<string, unknown>[])[0]?.cover_image_url as string
        : undefined,
      landingPageUrl: ad.landing_page_url as string | undefined,
      firstShown: ad.first_shown_date as string | undefined,
      lastShown: ad.last_shown_date as string | undefined,
      reach: ad.reach as number | undefined,
      likes: ad.likes as number | undefined,
      industry: ad.industry as string | undefined,
      objective: ad.objective as string | undefined,
      format: ad.ad_format as string | undefined,
    })
  );

  return {
    ads,
    total: data.data?.total_count || ads.length,
    hasMore: data.data?.has_more || false,
    cursor: data.data?.cursor,
  };
}
