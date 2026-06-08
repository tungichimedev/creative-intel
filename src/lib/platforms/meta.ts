export interface MetaAd {
  id: string;
  adCreativeBodies?: string[];
  adCreativeLinkTitles?: string[];
  adCreativeLinkCaptions?: string[];
  adCreativeLinkDescriptions?: string[];
  adSnapshotUrl?: string;
  pageId?: string;
  pageName?: string;
  adDeliveryStartTime?: string;
  adDeliveryStopTime?: string;
  spend?: { lower_bound: string; upper_bound: string };
  impressions?: { lower_bound: string; upper_bound: string };
  publisherPlatforms?: string[];
  mediaType?: string;
}

export interface MetaSearchResult {
  ads: MetaAd[];
  total: number;
  hasMore: boolean;
  nextCursor?: string;
}

/**
 * Search Meta Ad Library via SearchAPI.io (third-party proxy).
 * No Meta access token or business verification required.
 *
 * Docs: https://www.searchapi.io/docs/meta-ad-library-api
 * Endpoint: GET https://www.searchapi.io/api/v1/search?engine=meta_ad_library
 */
export async function searchMetaAds(
  searchTerms: string,
  options: {
    apiKey: string;
    country?: string;
    activeStatus?: string;
    mediaType?: string;
    nextPageToken?: string;
  }
): Promise<MetaSearchResult> {
  const {
    apiKey,
    country = "US",
    activeStatus = "active",
    mediaType = "all",
    nextPageToken,
  } = options;

  const params: Record<string, string> = {
    engine: "meta_ad_library",
    api_key: apiKey,
    q: searchTerms,
    country,
    active_status: activeStatus,
    media_type: mediaType,
  };

  if (nextPageToken) {
    params.next_page_token = nextPageToken;
  }

  const url = `https://www.searchapi.io/api/v1/search?${new URLSearchParams(params)}`;
  const res = await fetch(url);
  const data = await res.json();

  if (data.error) {
    throw new Error(
      `SearchAPI error: ${typeof data.error === "string" ? data.error : data.error.message || JSON.stringify(data.error)}`
    );
  }

  const rawAds = data.ads || [];

  const ads: MetaAd[] = rawAds.map((ad: Record<string, unknown>) => {
    const snapshot = ad.snapshot as Record<string, unknown> | undefined;
    const page = ad.page as Record<string, unknown> | undefined;

    // Extract creative text from snapshot
    const bodies: string[] = [];
    const titles: string[] = [];
    const captions: string[] = [];
    const descriptions: string[] = [];

    if (snapshot) {
      // Body text
      if (snapshot.body && typeof snapshot.body === "object") {
        const bodyMarkup = snapshot.body as Record<string, unknown>;
        if (bodyMarkup.text) bodies.push(String(bodyMarkup.text));
      } else if (typeof snapshot.body === "string") {
        bodies.push(snapshot.body);
      }

      // Title
      if (snapshot.title && typeof snapshot.title === "string") {
        titles.push(snapshot.title);
      }

      // Link caption
      if (snapshot.link_title && typeof snapshot.link_title === "string") {
        captions.push(snapshot.link_title);
      }

      // Link description
      if (snapshot.link_description && typeof snapshot.link_description === "string") {
        descriptions.push(snapshot.link_description);
      }
    }

    // Determine media type from snapshot
    let detectedMediaType: string | undefined;
    if (snapshot?.videos && Array.isArray(snapshot.videos) && snapshot.videos.length > 0) {
      detectedMediaType = "video";
    } else if (snapshot?.images && Array.isArray(snapshot.images) && snapshot.images.length > 0) {
      detectedMediaType = "image";
    }

    // Get snapshot URL (the ad preview page)
    const snapshotUrl = ad.snapshot_url as string | undefined;

    // Get image/video URLs from snapshot for thumbnails
    let thumbnailUrl: string | undefined;
    if (snapshot?.images && Array.isArray(snapshot.images) && snapshot.images.length > 0) {
      const firstImage = snapshot.images[0] as Record<string, unknown>;
      thumbnailUrl = firstImage.url as string | undefined;
    }

    return {
      id: String(ad.ad_archive_id || ad.id || ""),
      adCreativeBodies: bodies.length > 0 ? bodies : undefined,
      adCreativeLinkTitles: titles.length > 0 ? titles : undefined,
      adCreativeLinkCaptions: captions.length > 0 ? captions : undefined,
      adCreativeLinkDescriptions: descriptions.length > 0 ? descriptions : undefined,
      adSnapshotUrl: snapshotUrl,
      pageId: page?.id ? String(page.id) : undefined,
      pageName: page?.name ? String(page.name) : undefined,
      adDeliveryStartTime: ad.start_date as string | undefined,
      adDeliveryStopTime: ad.end_date as string | undefined,
      spend: ad.spend as MetaAd["spend"],
      impressions: ad.impressions as MetaAd["impressions"],
      publisherPlatforms: ad.publisher_platforms as string[] | undefined,
      mediaType: detectedMediaType,
      // Store thumbnail for display
      _thumbnailUrl: thumbnailUrl,
    } as MetaAd & { _thumbnailUrl?: string };
  });

  const pagination = data.pagination as Record<string, unknown> | undefined;

  return {
    ads,
    total: (data.search_information as Record<string, unknown>)?.total_count
      ? Number((data.search_information as Record<string, unknown>).total_count)
      : ads.length,
    hasMore: !!pagination?.next_page_token,
    nextCursor: pagination?.next_page_token as string | undefined,
  };
}

/**
 * Search by Facebook Page ID via SearchAPI.
 */
export async function searchMetaAdsByPage(
  pageId: string,
  options: {
    apiKey: string;
    country?: string;
  }
): Promise<MetaSearchResult> {
  const { apiKey, country = "US" } = options;

  const params = new URLSearchParams({
    engine: "meta_ad_library",
    api_key: apiKey,
    page_id: pageId,
    country,
    active_status: "active",
    media_type: "all",
  });

  const url = `https://www.searchapi.io/api/v1/search?${params}`;
  const res = await fetch(url);
  const data = await res.json();

  if (data.error) {
    throw new Error(
      `SearchAPI error: ${typeof data.error === "string" ? data.error : data.error.message || JSON.stringify(data.error)}`
    );
  }

  const rawAds = data.ads || [];

  const ads: MetaAd[] = rawAds.map((ad: Record<string, unknown>) => {
    const snapshot = ad.snapshot as Record<string, unknown> | undefined;
    const page = ad.page as Record<string, unknown> | undefined;

    return {
      id: String(ad.ad_archive_id || ad.id || ""),
      adSnapshotUrl: ad.snapshot_url as string | undefined,
      pageId: page?.id ? String(page.id) : undefined,
      pageName: page?.name ? String(page.name) : undefined,
      adDeliveryStartTime: ad.start_date as string | undefined,
      adDeliveryStopTime: ad.end_date as string | undefined,
      publisherPlatforms: ad.publisher_platforms as string[] | undefined,
      adCreativeBodies: snapshot?.body
        ? [typeof snapshot.body === "string" ? snapshot.body : String((snapshot.body as Record<string, unknown>).text || "")]
        : undefined,
      adCreativeLinkTitles: snapshot?.title ? [String(snapshot.title)] : undefined,
    };
  });

  const pagination = data.pagination as Record<string, unknown> | undefined;

  return {
    ads,
    total: ads.length,
    hasMore: !!pagination?.next_page_token,
    nextCursor: pagination?.next_page_token as string | undefined,
  };
}
