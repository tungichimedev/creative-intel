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

const GRAPH_API_VERSION = "v21.0";

/**
 * Search Meta Ad Library for ads related to a given app/search term.
 *
 * Docs: https://www.facebook.com/ads/library/api
 * Endpoint: GET /{version}/ads_archive
 */
export async function searchMetaAds(
  searchTerms: string,
  options: {
    accessToken: string;
    countries?: string[];
    limit?: number;
    cursor?: string;
    adType?: string;
  }
): Promise<MetaSearchResult> {
  const {
    accessToken,
    countries = ["US"],
    limit = 25,
    cursor,
    adType = "ALL",
  } = options;

  const params = new URLSearchParams({
    access_token: accessToken,
    search_terms: searchTerms,
    ad_type: adType,
    ad_reached_countries: JSON.stringify(countries),
    fields: [
      "id",
      "ad_creative_bodies",
      "ad_creative_link_titles",
      "ad_creative_link_captions",
      "ad_creative_link_descriptions",
      "ad_snapshot_url",
      "page_id",
      "page_name",
      "ad_delivery_start_time",
      "ad_delivery_stop_time",
      "spend",
      "impressions",
      "publisher_platforms",
    ].join(","),
    limit: String(limit),
  });

  if (cursor) {
    params.set("after", cursor);
  }

  const url = `https://graph.facebook.com/${GRAPH_API_VERSION}/ads_archive?${params}`;
  const res = await fetch(url);
  const data = await res.json();

  if (data.error) {
    throw new Error(
      `Meta Ad Library API error: ${data.error.message} (code: ${data.error.code})`
    );
  }

  const ads: MetaAd[] = (data.data || []).map((ad: Record<string, unknown>) => ({
    id: ad.id,
    adCreativeBodies: ad.ad_creative_bodies,
    adCreativeLinkTitles: ad.ad_creative_link_titles,
    adCreativeLinkCaptions: ad.ad_creative_link_captions,
    adCreativeLinkDescriptions: ad.ad_creative_link_descriptions,
    adSnapshotUrl: ad.ad_snapshot_url,
    pageId: ad.page_id,
    pageName: ad.page_name,
    adDeliveryStartTime: ad.ad_delivery_start_time,
    adDeliveryStopTime: ad.ad_delivery_stop_time,
    spend: ad.spend,
    impressions: ad.impressions,
    publisherPlatforms: ad.publisher_platforms,
  }));

  return {
    ads,
    total: ads.length,
    hasMore: !!data.paging?.cursors?.after,
    nextCursor: data.paging?.cursors?.after,
  };
}

/**
 * Search by Facebook Page ID (more precise than search_terms).
 */
export async function searchMetaAdsByPage(
  pageId: string,
  options: {
    accessToken: string;
    countries?: string[];
    limit?: number;
    cursor?: string;
  }
): Promise<MetaSearchResult> {
  const {
    accessToken,
    countries = ["US"],
    limit = 25,
    cursor,
  } = options;

  const params = new URLSearchParams({
    access_token: accessToken,
    search_page_ids: pageId,
    ad_type: "ALL",
    ad_reached_countries: JSON.stringify(countries),
    fields: [
      "id",
      "ad_creative_bodies",
      "ad_creative_link_titles",
      "ad_creative_link_captions",
      "ad_creative_link_descriptions",
      "ad_snapshot_url",
      "page_id",
      "page_name",
      "ad_delivery_start_time",
      "ad_delivery_stop_time",
      "spend",
      "impressions",
      "publisher_platforms",
    ].join(","),
    limit: String(limit),
  });

  if (cursor) {
    params.set("after", cursor);
  }

  const url = `https://graph.facebook.com/${GRAPH_API_VERSION}/ads_archive?${params}`;
  const res = await fetch(url);
  const data = await res.json();

  if (data.error) {
    throw new Error(
      `Meta Ad Library API error: ${data.error.message} (code: ${data.error.code})`
    );
  }

  const ads: MetaAd[] = (data.data || []).map((ad: Record<string, unknown>) => ({
    id: ad.id,
    adCreativeBodies: ad.ad_creative_bodies,
    adCreativeLinkTitles: ad.ad_creative_link_titles,
    adCreativeLinkCaptions: ad.ad_creative_link_captions,
    adCreativeLinkDescriptions: ad.ad_creative_link_descriptions,
    adSnapshotUrl: ad.ad_snapshot_url,
    pageId: ad.page_id,
    pageName: ad.page_name,
    adDeliveryStartTime: ad.ad_delivery_start_time,
    adDeliveryStopTime: ad.ad_delivery_stop_time,
    spend: ad.spend,
    impressions: ad.impressions,
    publisherPlatforms: ad.publisher_platforms,
  }));

  return {
    ads,
    total: ads.length,
    hasMore: !!data.paging?.cursors?.after,
    nextCursor: data.paging?.cursors?.after,
  };
}
