# Creative Intel — Architecture Document

## 1. System Overview

Creative Intel is a Next.js web application that aggregates ad creative data from multiple advertising platforms (Meta Ad Library, TikTok Commercial Content API) and presents it through a searchable gallery interface.

```
┌─────────────────────────────────────────────────────────────┐
│                        Client (Browser)                      │
│  ┌──────────┐  ┌──────────────┐  ┌────────────────────────┐ │
│  │ Search   │  │ Results      │  │ Creative Card          │ │
│  │ Bar      │→ │ Gallery      │  │ (media + copy + meta)  │ │
│  └──────────┘  └──────────────┘  └────────────────────────┘ │
└───────────────────────┬─────────────────────────────────────┘
                        │ POST /api/search
                        ▼
┌─────────────────────────────────────────────────────────────┐
│                    Next.js API Routes (Vercel)               │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐   │
│  │                  Search Orchestrator                   │   │
│  │  1. Parse app link → extract metadata                 │   │
│  │  2. Upsert app in DB                                  │   │
│  │  3. Search platforms in parallel                      │   │
│  │  4. Store creatives in DB                             │   │
│  │  5. Return aggregated results                         │   │
│  └────────┬──────────────┬──────────────┬───────────────┘   │
│           │              │              │                     │
│  ┌────────▼───┐  ┌──────▼──────┐  ┌───▼──────────────┐    │
│  │ App Link   │  │ Meta Client │  │ TikTok Client    │    │
│  │ Parser     │  │ (Graph API) │  │ (Commercial API) │    │
│  └────────┬───┘  └──────┬──────┘  └───┬──────────────┘    │
│           │              │              │                     │
└───────────┼──────────────┼──────────────┼─────────────────────┘
            │              │              │
    ┌───────▼───┐   ┌──────▼──────┐  ┌───▼────────────┐
    │ App Store │   │ Meta Ad     │  │ TikTok         │
    │ / Play    │   │ Library API │  │ Commercial     │
    │ Store     │   │ (Graph API) │  │ Content API    │
    └───────────┘   └─────────────┘  └────────────────┘
            │
    ┌───────▼────────────────────────────────────────┐
    │              PostgreSQL (Neon)                   │
    │  ┌──────┐  ┌──────────┐  ┌───────────┐        │
    │  │ apps │  │ searches │  │ creatives │        │
    │  └──────┘  └──────────┘  └───────────┘        │
    └─────────────────────────────────────────────────┘
```

---

## 2. Tech Stack

| Layer | Technology | Rationale |
|-------|-----------|-----------|
| **Framework** | Next.js 16 (App Router) | Full-stack React with API routes, SSR, Vercel-native |
| **Language** | TypeScript | Type safety across client + server |
| **Styling** | Tailwind CSS 4 | Utility-first, fast iteration, built-in dark mode |
| **Database** | PostgreSQL (Neon) | Serverless Postgres, free tier, Vercel integration |
| **ORM** | Prisma 7 | Type-safe DB access, migrations, schema-as-code |
| **DB Adapter** | @prisma/adapter-pg | Prisma 7 driver adapter for PostgreSQL |
| **Hosting** | Vercel | Zero-config Next.js deployment, edge network |
| **HTTP Client** | Native fetch | No extra dependency, works in Node.js 18+ |

---

## 3. Project Structure

```
creative-intel/
├── docs/
│   ├── REQUIREMENTS.md          # Product requirements
│   └── ARCHITECTURE.md          # This document
├── prisma/
│   ├── schema.prisma            # Database schema
│   └── migrations/              # Prisma migrations
├── prisma.config.ts             # Prisma 7 configuration (datasource URL)
├── src/
│   ├── app/
│   │   ├── layout.tsx           # Root layout (fonts, metadata)
│   │   ├── page.tsx             # Home page (search + recent searches)
│   │   ├── globals.css          # Global styles
│   │   ├── api/
│   │   │   └── search/
│   │   │       └── route.ts     # POST /api/search — main orchestrator
│   │   └── results/
│   │       └── [id]/
│   │           ├── page.tsx     # Results gallery (server component)
│   │           └── results-filter.tsx  # Platform filter (client component)
│   ├── components/
│   │   ├── search-bar.tsx       # Search input with loading state
│   │   └── creative-card.tsx    # Individual ad creative card
│   ├── lib/
│   │   ├── db.ts                # Prisma client singleton
│   │   ├── parsers/
│   │   │   └── app-link.ts      # App Store / Play Store URL parser
│   │   └── platforms/
│   │       ├── meta.ts          # Meta Ad Library API client
│   │       └── tiktok.ts        # TikTok Commercial Content API client
│   └── generated/
│       └── prisma/              # Auto-generated Prisma client (gitignored)
├── .env                         # Environment variables (gitignored)
├── package.json
└── tsconfig.json
```

---

## 4. Database Schema

### Entity-Relationship Diagram

```
┌──────────────┐       ┌──────────────┐       ┌──────────────────┐
│     apps     │       │   searches   │       │    creatives     │
├──────────────┤       ├──────────────┤       ├──────────────────┤
│ id (PK)      │◄──┐   │ id (PK)      │◄──┐   │ id (PK)          │
│ name         │   ├───│ app_id (FK)  │   ├───│ app_id (FK)      │
│ developer    │   │   │ query        │   │   │ search_id (FK)   │
│ bundle_id    │   │   │ status       │   │   │ platform         │
│ store_url (U)│   │   │ error        │   │   │ platform_ad_id   │
│ platform     │   │   │ meta_count   │   │   │ advertiser       │
│ icon         │   │   │ tiktok_count │   │   │ ad_copy          │
│ category     │   │   │ created_at   │   │   │ headline         │
│ created_at   │   │   └──────────────┘   │   │ cta              │
│ updated_at   │   │                       │   │ media_url        │
└──────────────┘   │                       │   │ media_type       │
                   │                       │   │ thumbnail_url    │
                   │                       │   │ landing_page     │
                   │                       │   │ first_seen       │
                   │                       │   │ last_seen        │
                   │                       │   │ is_active        │
                   │                       │   │ raw_data (JSON)  │
                   │                       │   │ created_at       │
                   └───────────────────────┘   └──────────────────┘
                                                    UQ(platform,
                                                    platform_ad_id)
```

### Key Constraints

| Table | Constraint | Purpose |
|-------|-----------|---------|
| `apps` | UNIQUE on `store_url` | Prevent duplicate app entries |
| `creatives` | UNIQUE on `(platform, platform_ad_id)` | Deduplicate ads across searches |
| `searches` | FK to `apps` | Every search belongs to an app |
| `creatives` | FK to `apps` + optional FK to `searches` | Track which search found the creative |

### Indexes (Implicit via Prisma)

- `apps.store_url` — unique index for fast upsert
- `creatives.(platform, platform_ad_id)` — unique composite for dedup
- `searches.app_id` — FK index for listing searches per app
- `creatives.app_id` — FK index for listing creatives per app

---

## 5. Component Architecture

### Server vs. Client Components

| Component | Type | Why |
|-----------|------|-----|
| `app/page.tsx` | Server | Fetches recent searches from DB at render time |
| `app/results/[id]/page.tsx` | Server | Fetches search + creatives from DB |
| `components/search-bar.tsx` | Client | Form state, fetch call, router navigation |
| `components/creative-card.tsx` | Client | Interactive (expand/collapse ad copy, video controls) |
| `results/[id]/results-filter.tsx` | Client | Router navigation on filter click |

### Data Flow

```
1. User pastes URL → SearchBar (client)
2. SearchBar POSTs to /api/search
3. API route:
   a. parseAppLink(url) → AppInfo (name, developer, icon, etc.)
   b. prisma.app.upsert() → App record
   c. prisma.search.create() → Search record (status: "running")
   d. Promise.all([searchMetaAds(), searchTikTokAds()]) → parallel fetch
   e. For each result: prisma.creative.upsert() → deduplicated storage
   f. prisma.search.update() → status: "done", counts
   g. Return { app, searchId, meta: { ads }, tiktok: { ads } }
4. SearchBar navigates to /results/{searchId}
5. Results page (server) loads search + creatives from DB
6. Gallery renders CreativeCard components
```

---

## 6. API Design

### Internal API Routes

#### `POST /api/search`

**Request:**
```json
{
  "url": "https://apps.apple.com/app/id123456"
}
```

**Response (200):**
```json
{
  "app": {
    "id": "clx...",
    "name": "My App",
    "developer": "Developer Inc",
    "icon": "https://...",
    "category": "Games",
    "platform": "ios"
  },
  "searchId": "clx...",
  "meta": {
    "count": 12,
    "ads": [ ... ],
    "error": null
  },
  "tiktok": {
    "count": 5,
    "ads": [ ... ],
    "error": null
  }
}
```

**Error (400):**
```json
{
  "error": "Could not parse app link. Supported: App Store, Google Play URLs."
}
```

**Partial failure (200 with error field):**
When one platform fails, the response still returns with the other platform's results and an error message for the failed one.

### External APIs Used

| API | Method | Endpoint | Auth |
|-----|--------|----------|------|
| Meta Ad Library | GET | `graph.facebook.com/v21.0/ads_archive` | Access token (query param) |
| Meta Ad Library (by page) | GET | `graph.facebook.com/v21.0/ads_archive` | Access token (query param) |
| TikTok Commercial Content | POST | `open.tiktokapis.com/v2/research/adlib/ad/query/` | Bearer token (header) |
| App Store Lookup | GET | `itunes.apple.com/lookup?id={id}` | None |
| Google Play | GET | `play.google.com/store/apps/details?id={id}` | None (HTML scrape) |

---

## 7. Platform Client Architecture

### Meta Ad Library Client (`src/lib/platforms/meta.ts`)

```
searchMetaAds(searchTerms, options)
  → Build URLSearchParams with fields, countries, limit
  → GET /ads_archive
  → Map snake_case response to camelCase MetaAd interface
  → Return { ads, total, hasMore, nextCursor }

searchMetaAdsByPage(pageId, options)
  → Same flow but uses search_page_ids instead of search_terms
```

**Key types:**
- `MetaAd` — normalized ad record with typed fields
- `MetaSearchResult` — paginated response wrapper

### TikTok Commercial Content Client (`src/lib/platforms/tiktok.ts`)

```
searchTikTokAds(searchTerms, options)
  → POST JSON body with search_term, region_code, count, cursor
  → Map response to TikTokAd interface
  → Return { ads, total, hasMore, cursor }
```

**Key types:**
- `TikTokAd` — normalized ad record
- `TikTokSearchResult` — paginated response wrapper

### App Link Parser (`src/lib/parsers/app-link.ts`)

```
parseAppLink(url)
  ├── Try parseAppStoreUrl(url)
  │   └── Match regex → fetchAppStoreInfo(id, country)
  │       └── GET itunes.apple.com/lookup → AppInfo
  └── Try parsePlayStoreUrl(url)
      └── Match regex → fetchPlayStoreInfo(packageName)
          └── GET play.google.com HTML → extract title/dev/icon → AppInfo
```

**Key type:**
- `AppInfo` — unified app metadata (name, developer, bundleId, storeUrl, platform, icon, category)

---

## 8. Error Handling Strategy

### Levels of Failure

| Failure | Handling | User Impact |
|---------|----------|-------------|
| Invalid URL format | 400 response with message | Error shown below search bar |
| App not found in store | 400 response | Error shown below search bar |
| One platform API fails | Partial success — show other platform's results | Warning banner + results from working platform |
| Both platform APIs fail | 200 with error messages, search saved as "done" with 0 counts | Error banner, suggestion to check API tokens |
| Database error | 500 response | Generic error message |
| Network timeout | Caught in platform client, surfaced as error | Platform-specific error in results |

### Error Propagation

```
Platform Client throws Error
  → Search Orchestrator catches per-platform (Promise.catch)
  → Stores error message in results object
  → Updates search record with error string
  → Returns 200 with partial results + error fields
```

This design ensures one platform's failure never blocks the other.

---

## 9. Deployment Architecture

### Vercel Deployment

```
┌─────────────────────────────────────────────┐
│                  Vercel                       │
│                                               │
│  ┌─────────────┐  ┌───────────────────────┐ │
│  │ Static Edge  │  │ Serverless Functions  │ │
│  │ (pages, CSS, │  │ (API routes)          │ │
│  │  assets)     │  │                       │ │
│  │              │  │  /api/search          │ │
│  │  / (SSR)     │  │   → Meta API          │ │
│  │  /results/*  │  │   → TikTok API        │ │
│  │  (SSR)       │  │   → Neon PostgreSQL   │ │
│  └─────────────┘  └───────────────────────┘ │
└─────────────────────────────────────────────┘
                        │
                        ▼
              ┌──────────────────┐
              │ Neon PostgreSQL  │
              │ (Serverless)     │
              │                  │
              │ Region: us-east  │
              └──────────────────┘
```

### Environment Variables (Vercel Dashboard)

| Variable | Description | Required |
|----------|-------------|----------|
| `DATABASE_URL` | Neon PostgreSQL connection string | Yes |
| `META_ACCESS_TOKEN` | Facebook Graph API access token | Yes (for Meta search) |
| `TIKTOK_ACCESS_TOKEN` | TikTok Commercial Content API token | Yes (for TikTok search) |

### Build & Deploy

```bash
# Local development
npm run dev              # Next.js dev server on :3000

# Database
npx prisma migrate dev   # Apply migrations locally
npx prisma generate      # Regenerate Prisma client

# Production deploy
git push origin main     # Vercel auto-deploys from main
# Or: vercel --prod      # Manual deploy via CLI
```

### Vercel Function Configuration

- **Runtime:** Node.js 20
- **Max duration:** 60s (covers parallel API calls + DB writes)
- **Memory:** 1024 MB (default)
- **Regions:** Auto (iad1 recommended for US-centric API calls)

---

## 10. Future Architecture Considerations

### P1: Background Jobs

For pagination and multi-country search, API routes may exceed Vercel's 60s limit.

**Option A:** Vercel Cron + queued search
```
POST /api/search → creates search record → returns searchId immediately
Vercel Cron polls pending searches → executes API calls → updates DB
Client polls /api/search/[id]/status until done
```

**Option B:** Vercel Functions with streaming
```
POST /api/search → stream partial results as they arrive
Client renders incrementally
```

### P2: AI Analysis Pipeline

```
Creative stored in DB
  → Background job picks up unanalyzed creatives
  → Claude API: classify format, extract hooks, tag patterns
  → Store analysis results in new `creative_analysis` table
  → Surface tags on creative cards
```

### P2: Similarity Search

```
Creative media URL
  → Download image/video frame
  → CLIP model → 512-dim embedding
  → Store in pgvector column on creatives table
  → Query: SELECT * FROM creatives ORDER BY embedding <=> $query_embedding LIMIT 10
```

Requires: `pgvector` extension on Neon (supported), embedding generation service.

### P3: Scheduled Monitoring

```
┌──────────────┐     ┌─────────────┐     ┌──────────────┐
│ Vercel Cron  │────▶│ Search job  │────▶│ Notification │
│ (daily)      │     │ per monitored│     │ (email/hook) │
│              │     │ app          │     │              │
└──────────────┘     └─────────────┘     └──────────────┘
```

### P3: Multi-Region & CDN

- Cache creative thumbnails on Vercel Edge / R2
- Serve media previews from CDN instead of proxying platform URLs
- Reduces dependency on platform URL expiry

---

## 11. Security Considerations

| Risk | Mitigation |
|------|-----------|
| API token exposure | Tokens in env vars only, never sent to client |
| Platform rate limiting | Respect limits, add backoff, one search at a time per platform |
| SQL injection | Prisma parameterized queries (no raw SQL) |
| XSS via ad copy | React auto-escapes by default; no `dangerouslySetInnerHTML` |
| Abuse (excessive searches) | Rate limit `/api/search` by IP (P1) |
| SSRF via app URL | URL parser validates against known domains only (apps.apple.com, play.google.com) |
| Stored XSS in raw_data | JSON column, never rendered as HTML |

---

## 12. Monitoring & Observability (P1)

| Tool | Purpose |
|------|---------|
| Vercel Analytics | Page views, Web Vitals, function invocations |
| Vercel Logs | API route logs, error tracking |
| Neon Dashboard | DB query performance, connection count |
| Sentry (future) | Error tracking with stack traces |

### Key Metrics to Track

- Searches per day (total, by platform)
- API error rate per platform
- Average search response time
- Database size (rows in creatives table)
- Unique apps searched
- Cache hit rate (re-searched apps)
