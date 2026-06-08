# Creative Intel — Requirements Document

## 1. Product Overview

**Creative Intel** is a web-based ad creative intelligence platform that lets users search and analyze competitor ad creatives across Meta (Facebook/Instagram) and TikTok by simply pasting an App Store or Google Play link.

**Problem:** Marketing teams and indie developers need to see what ads competitors are running to inform their own creative strategy. Current tools (AppGrowing, SocialPeta) are expensive ($200-500/mo) and over-featured for teams that just need quick competitor creative lookups.

**Solution:** A lightweight, fast creative search tool. Paste an app link, instantly see all ad creatives that app is running across platforms.

### Target Users

| User | Need |
|------|------|
| Mobile app marketers | See competitor ad strategies before campaign planning |
| UA (User Acquisition) managers | Find proven creative formats in their vertical |
| Indie developers | Research what ads successful competitors run |
| Creative teams | Build swipe files of high-performing ad styles |

---

## 2. Functional Requirements

### 2.1 Core Feature: Search by App Link (P0 — MVP)

**FR-1: App Link Parsing**
- Accept App Store URLs (`apps.apple.com/...`)
- Accept Google Play URLs (`play.google.com/store/apps/details?id=...`)
- Extract app metadata: name, developer, bundle ID, icon, category
- Show clear error for unsupported URL formats

**FR-2: Meta Ad Library Search**
- Search Meta Ad Library API (`/ads_archive`) using app name as search term
- Support search by Facebook Page ID for precise matching
- Retrieve: ad ID, creative body text, headline, link titles, snapshot URL, page name, delivery dates, spend range, impressions, publisher platforms
- Paginate results (cursor-based, 25 per page default)
- Support country filter (default: US)

**FR-3: TikTok Ad Library Search**
- Search TikTok Commercial Content API (`/v2/research/adlib/ad/query/`)
- Retrieve: ad ID, advertiser name, ad title, ad text, video URL, image URL, thumbnail, landing page, dates shown, reach, likes, industry, objective, format
- Paginate results (offset-based, 20 per page default)
- Support region filter (default: US)

**FR-4: Results Display**
- Show app header: icon, name, developer, category, platform (iOS/Android)
- Show ad count per platform (e.g., "12 Meta ads, 5 TikTok ads")
- Display creatives in a responsive grid (1-4 columns based on viewport)
- Each creative card shows:
  - Platform badge (Meta / TikTok)
  - Media preview (image or video player)
  - Active/inactive status badge
  - Advertiser name
  - Headline (2-line clamp)
  - Ad copy (3-line clamp with "Show more")
  - Running duration ("Running 45d")
  - Start date
  - Landing page link
- Filter by platform (All / Meta / TikTok)

**FR-5: Data Persistence**
- Cache app metadata in database (upsert on re-search)
- Store all found creatives with platform-specific raw data
- Deduplicate creatives by `(platform, platform_ad_id)`
- Track search history with result counts

**FR-6: Search History**
- Show recent searches on home page (last 10)
- Each entry shows: app icon, name, ad counts, date
- Click to re-view results

### 2.2 Enhanced Search (P1)

**FR-7: Text-Based Search**
- Search by keyword/brand name without requiring an app link
- Search across cached creatives + live API queries

**FR-8: Advertiser Search**
- Search Meta ads by Facebook Page ID directly
- Cross-reference app developer name to find their Facebook Page

**FR-9: Multi-Country Search**
- Allow selecting multiple countries for broader results
- Show country distribution in results

**FR-10: Pagination**
- Load more results on scroll or "Load More" button
- Show total available count per platform

### 2.3 Creative Analysis (P2)

**FR-11: AI Creative Analysis**
- Classify creative format (UGC, product shot, lifestyle, testimonial, animation, meme)
- Extract hook type from first 3 seconds of video
- Identify CTA style and emotional triggers
- Tag ad copy patterns (question, statistic, fear, social proof, urgency)

**FR-12: Creative Collections**
- Save individual creatives to named collections ("swipe files")
- View/manage collections
- Export collection as PDF or image grid

**FR-13: Similar Creatives**
- "Find similar" button on any creative
- Use CLIP embeddings for visual similarity search
- Show top 10 most similar creatives from database

**FR-14: Trend Detection**
- Track creative format popularity over time
- Show rising/declining trends per vertical
- Weekly trend report by category

### 2.4 Advanced Features (P3)

**FR-15: Google Ads Transparency**
- Add Google Ads Transparency Center as third search source
- Map app to Google advertiser ID

**FR-16: Longevity Scoring**
- Score ads by running duration (longer = likely more profitable)
- Rank "top performers" by longevity within a search

**FR-17: Landing Page Capture**
- Screenshot landing pages linked from ads
- Track landing page changes over time

**FR-18: Scheduled Monitoring**
- Set up alerts for specific apps/advertisers
- Daily/weekly email digest of new creatives detected
- Webhook support for integration with other tools

**FR-19: Export & API**
- CSV/JSON export of search results
- REST API for programmatic access
- Rate-limited API keys per user tier

---

## 3. Non-Functional Requirements

### 3.1 Performance

| Metric | Target |
|--------|--------|
| App link parsing | < 2s |
| Platform API search (per platform) | < 5s |
| Total search response time | < 8s (both platforms in parallel) |
| Results page load (from DB) | < 1s |
| Gallery rendering (25 cards) | < 500ms |

### 3.2 Scalability

- Support 100 concurrent searches (MVP)
- Database handles 1M+ stored creatives
- API rate limiting per user/IP to prevent abuse
- Platform API rate limits respected with backoff

### 3.3 Reliability

- Graceful degradation: if one platform API fails, show results from the other
- Error messages distinguish between "no results found" vs. "API error"
- Retry failed API calls once with exponential backoff
- Search status tracking: pending → running → done | error

### 3.4 Security

- API tokens stored in environment variables, never exposed to client
- No user authentication required for MVP (public tool)
- Rate limiting on search endpoint (10 searches/min per IP for MVP)
- Input validation on all API routes (URL format, length limits)
- No PII stored — only public ad data

### 3.5 Deployment

- Vercel deployment (serverless functions for API routes)
- PostgreSQL via Neon (serverless Postgres, free tier)
- Environment variables managed via Vercel dashboard
- No cold-start sensitive paths — API routes can tolerate 1-2s cold start

---

## 4. Data Requirements

### 4.1 Data Sources

| Source | Type | Access | Cost | Coverage |
|--------|------|--------|------|----------|
| Meta Ad Library API | Official REST API | Facebook App + Access Token | Free | All active ads on Meta platforms |
| TikTok Commercial Content API | Official REST API | Developer application | Free | Top-performing ads (curated by TikTok) |
| Apple App Store Lookup API | Public REST API | None | Free | iOS app metadata |
| Google Play Store | Web scraping (HTML) | None | Free | Android app metadata |

### 4.2 Data Freshness

- App metadata: cached, refreshed on each new search
- Creative data: live from APIs on each search, cached in DB for history
- No background crawling in MVP — data fetched on demand
- P2: scheduled background fetches for monitored apps

### 4.3 Data Retention

- App records: indefinite
- Search records: indefinite (lightweight, useful for analytics)
- Creative records: indefinite (historical value grows over time)
- Raw API response data: stored as JSON for future re-processing

---

## 5. Platform API Details

### 5.1 Meta Ad Library API

**Endpoint:** `GET https://graph.facebook.com/v21.0/ads_archive`

**Authentication:** User access token from a Facebook App with verified identity

**Key Parameters:**
| Parameter | Description |
|-----------|-------------|
| `search_terms` | Free-text search (app name) |
| `search_page_ids` | Comma-separated Facebook Page IDs (more precise) |
| `ad_reached_countries` | JSON array of country codes |
| `ad_type` | ALL, POLITICAL_AND_ISSUE_ADS, etc. |
| `fields` | Comma-separated field list |
| `limit` | Results per page (max 25) |
| `after` | Pagination cursor |

**Available Fields:** id, ad_creative_bodies, ad_creative_link_titles, ad_creative_link_captions, ad_creative_link_descriptions, ad_snapshot_url, page_id, page_name, ad_delivery_start_time, ad_delivery_stop_time, spend, impressions, publisher_platforms

**Rate Limits:** Not officially published. Estimated ~200 calls/hour per token. Use single token with reasonable delays.

**Limitations:**
- Only returns currently active ads (no historical archive unless you store them)
- `ad_snapshot_url` is a rendered HTML page, not a direct media file
- Spend/impressions are ranges, not exact values
- No filtering by app/bundle ID — must search by name or page ID

### 5.2 TikTok Commercial Content API

**Endpoint:** `POST https://open.tiktokapis.com/v2/research/adlib/ad/query/`

**Authentication:** Bearer token (OAuth 2.0 client credentials)

**Key Parameters (JSON body):**
| Parameter | Description |
|-----------|-------------|
| `search_term` | Keyword search |
| `region_code` | Country code (e.g., "US") |
| `count` | Results per page (max 20) |
| `cursor` | Offset for pagination |

**Available Fields:** ad_id, business_name, ad_title, ad_text, videos (with video_url, cover_image_url), image_urls, landing_page_url, first_shown_date, last_shown_date, reach, likes, industry, objective, ad_format

**Rate Limits:** Varies by application approval tier.

**Limitations:**
- Returns only top-performing ads, not all ads
- No direct app/bundle ID search — keyword only
- Video URLs may expire; consider caching thumbnails
- Limited historical depth compared to Meta

---

## 6. User Stories

### MVP (P0)

| ID | Story | Acceptance Criteria |
|----|-------|-------------------|
| US-1 | As a marketer, I want to paste an App Store link and see all Meta ads for that app | App metadata extracted, Meta ads displayed in gallery, error shown if no results |
| US-2 | As a marketer, I want to paste a Play Store link and see all Meta ads for that app | Play Store URL parsed, app name extracted, Meta search executed |
| US-3 | As a marketer, I want to see TikTok ads alongside Meta ads for the same app | Both platforms searched in parallel, results combined with platform badges |
| US-4 | As a user, I want to filter results by platform | Platform filter tabs (All/Meta/TikTok) update the gallery |
| US-5 | As a user, I want to see my recent searches | Home page shows last 10 searches with app icon and ad counts |
| US-6 | As a user, I want to see how long an ad has been running | Duration shown on each card ("Running 45d") |
| US-7 | As a user, I want to view the full ad snapshot (Meta) | Clicking the media area opens ad_snapshot_url in a new tab |
| US-8 | As a user, I want to watch TikTok video ads inline | Video player with controls, poster thumbnail, lazy loading |

### P1

| ID | Story | Acceptance Criteria |
|----|-------|-------------------|
| US-9 | As a user, I want to search by keyword without an app link | Text search box, searches both platforms by keyword |
| US-10 | As a user, I want to load more results beyond the first page | "Load More" button fetches next page from each platform |
| US-11 | As a user, I want to search in different countries | Country selector (multi-select), updates API queries |
| US-12 | As a user, I want to sort results by date or running duration | Sort dropdown on results page |

### P2

| ID | Story | Acceptance Criteria |
|----|-------|-------------------|
| US-13 | As a marketer, I want AI to classify each ad's creative format | Tags shown on cards (UGC, product shot, etc.) |
| US-14 | As a user, I want to save ads to a collection | "Save" button on cards, named collections, collection view |
| US-15 | As a user, I want to find visually similar ads | "Similar" button, shows top 10 by embedding distance |
| US-16 | As a marketer, I want to see trending creative formats | Trends page with time-series charts by format/vertical |

---

## 7. Monetization (Future)

| Tier | Price | Limits |
|------|-------|--------|
| Free | $0 | 5 searches/day, last 7 days of cached data |
| Pro | $29/mo | Unlimited searches, full history, collections, AI analysis |
| Team | $79/mo | Everything in Pro + API access, export, team sharing |
| Enterprise | Custom | Scheduled monitoring, webhooks, white-label, dedicated support |

---

## 8. Success Metrics

| Metric | Target (3 months post-launch) |
|--------|-------------------------------|
| Monthly active users | 500 |
| Searches per day | 100 |
| Unique apps searched | 1,000 |
| Creatives stored | 50,000 |
| Avg search response time | < 6s |
| User retention (weekly) | 30% |
