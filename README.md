# Letlytics prototype

A Manchester buy-to-let screening prototype for an experienced landlord: discover current asking-price listings, inspect rental evidence, adjust an offer/financing scenario and compare a shortlist. Built with Next.js 16, React 19 and Leaflet.

The default `/live` journey reads a **saved daily dataset** of PropertyData listings, asking-rent samples and free HM Land Registry sales. Page visits, evidence panels and Vercel builds never call either provider. A small “Listings retrieved” timestamp shows the actual listing retrieval time. The original `/discover` → `/property/[id]` → `/compare` journey remains available as an explicitly **synthetic demo**; its grades are unvalidated illustrative heuristics.

All features are available immediately. There is no account, pricing, paywall, payment flow or alert service. The website needs no API key or database. Only the daily refresh job needs a PropertyData key.

## Run locally

Use Node.js 22 or later, then run:

```sh
npm ci
npm run dev
```

Open [localhost:3000](http://localhost:3000). The committed data loads immediately, including without an API key. To deliberately refresh locally, copy `.env.example` to `.env.local`, set `PROPERTYDATA_API_KEY`, and run `npm run data:refresh`. Normal `dev`, `build` and `start` commands do not refresh data. Never prefix the key with `NEXT_PUBLIC_`.

Development uses Webpack. To preview the production build, run `npm run build` followed by `npm start`.

Run the current checks:

```sh
npm test
npm run typecheck
npm run build
```

`npm test` checks calculations, data normalization, daily refresh behavior and saved-data readers without contacting the providers.

## GitHub, daily updates and Vercel

1. Connect this repository to Vercel. Choose **Next.js**, root `./`, build command `npm run build`, default output directory. No PropertyData environment variable is needed in Vercel.
2. In GitHub **Settings → Secrets and variables → Actions**, add the repository secret **`PROPERTYDATA_API_KEY`**.
3. Under **Variables**, add **`SNAPSHOT_COMMIT_EMAIL`**: an email associated with the GitHub account connected to and authorized on the Vercel project. Its GitHub noreply email is fine. Optionally set `SNAPSHOT_COMMIT_NAME`; otherwise the workflow actor's name is used. Vercel checks commit authors for private repositories, so avoid an unrelated bot identity.
4. Ensure Actions are enabled and the default branch permits this workflow's data commits. Open **Actions → Refresh property data → Run workflow** once. Confirm its data commit produces a Vercel deployment.

The supplied [workflow](.github/workflows/refresh-property-data.yml) is scheduled for **06:17 UTC daily** on the default branch. It collects data, validates tests and the build, then commits only the three normalized JSON datasets. The connected Vercel Git integration deploys that commit. Successful refreshes require the Actions settings above; connecting Vercel is a separate setup step.

GitHub scheduled jobs may be delayed or skipped; the timestamp stays at the last successful retrieval. A failed listing request leaves both files unchanged. Successful rental evidence can be retained for up to 48 hours if a matching query fails; sales evidence can be retained for up to 30 days. Their individual retrieval dates are preserved. Missing evidence stays unknown. Provider rate limits stop further PropertyData requests during that run; there is no automatic retry storm.

Do not attach the refresh command to `build`, `postinstall`, request handlers or page effects. Code commits should rebuild the same saved data without spending provider credits. The workflow checks its own data and build because commits made using `GITHUB_TOKEN` do not trigger a separate GitHub push workflow. They can still be handled by Vercel's Git integration.

Local environment files are excluded from Git and Vercel CLI uploads. PropertyData's trial terms are for development/testing; check its plan terms before wider production use.

Official setup references: [GitHub schedules](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#schedule), [Actions secrets](https://docs.github.com/en/actions/how-tos/write-workflows/choose-what-workflows-do/use-secrets), [GitHub token trigger behavior](https://docs.github.com/en/actions/how-tos/write-workflows/choose-when-workflows-run/trigger-a-workflow), [Vercel Git integration](https://vercel.com/docs/git/vercel-for-github), [Vercel commit-author requirements](https://vercel.com/docs/git#deploying-private-git-repositories).

## Property-data walkthrough

1. Open `/live`. The daily listing query selects up to 40 nearest high-yield, reduced-price or chain-free matches within eight miles of central Manchester, excluding SSTC. This is a selected feed, not complete market inventory. The observed initial sample was city-centre flats.
2. Inspect the asking price and rental evidence, then open an analysis. The saved listing and rental data appears together, without waiting on either provider. The initial verified sample contained 40 listings with rental evidence available for 39; counts can change.
3. Change **Offer / purchase price**, **Monthly rent**, and **Annual service / estate charge**. Unknown charges are excluded from calculations and prominently labelled; entering an explicit zero is different from unknown. Financing is shared across the shortlist; rent, offer and property costs are per-property inputs.
4. Open **View recorded sales**. Free HMLR records show completed prices in the same full postcode/type over 36 months. Only category A, existing-building transactions are included; this deliberately excludes some landlord/company purchases. The displayed median requires at least three records and is context, not a valuation or recommended offer.
5. Compare two to four properties and ask which evidence the landlord trusts, which cost needs checking and whether they would investigate a viewing. Real properties do not receive the synthetic model's overall grade.

## Data boundaries

- `scripts/refresh-data.ts` is the daily provider entry point; `scripts/enrich-listings.ts` can backfill original-listing evidence separately. It fetches up to 40 Manchester strategy matches, spaces PropertyData requests at least three seconds apart, and deduplicates rental groups and Land Registry postcode/type queries. Responses are normalized before saving; credential echoes are excluded; the listing image URL is retained for the prototype.
- `src/data/live-snapshot.json` stores the asking-price listings and rental evidence. The current initial dataset was retrieved on 16 October 2026 and contains 40 listings with rental evidence for 39. `src/data/daily-sales.json` currently includes two previously verified cohorts, including five M4 1PH flat sales; the first scheduled refresh populates all queried cohorts.
- `src/lib/daily-data.ts` reads those files. The server layout supplies listing data directly to the UI. `/api/live` is a static read-only snapshot; `/api/sales` reads saved records after validating postcode/type. Neither can refresh data. The former `/api/live/rents` runtime endpoint was removed.
- Rental samples are shared by postcode district, bedroom count and property type, anchored at the first listing's **full postcode**. They are asking rents, not achieved rents or property valuations. The shown range contains 80% of the sample. Weekly values convert using `52 / 12`; samples below 15 listings or beyond three miles are withheld. Users can replace estimates.
- HMLR records cover up to 12 same-postcode/type sales over 36 months, category A and existing buildings only. They update monthly and registrations lag; a retrieval date is not a completeness date. Attribution and original record links remain visible.
- A typical daily run costs four PropertyData credits for 40 sourcing results plus rental-query credits per distinct group; there are no credits consumed by visitors or code rebuilds. Land Registry queries are free. See the [official Price Paid Data documentation](https://landregistry.data.gov.uk/app/doc/ppd/) for coverage and field definitions.

## Three-minute synthetic-demo walkthrough

1. **0:00–0:30 — Discover.** Click **Reset demo**. Scan Manchester, switch between the list and map, and try **Cash flow first**. Area markers group nearby examples at zoom levels below 13; click an area to reveal its homes. Return to **Balanced** for the worked comparison.
2. **0:30–1:30 — Interrogate one deal.** Open [Levenshulme example](http://localhost:3000/property/mcr-boundary-01). Inspect the rent, cost breakdown and score explanations; shortlist it. Change the mortgage rate from 4.5% to 6.5%. At the default 25% deposit and interest-only financing, its illustrative monthly pre-tax cash flow falls from about £362 to £106.
3. **1:30–2:30 — Compare the trade-off.** Open [City Centre example](http://localhost:3000/property/mcr-city-centre-01), shortlist it, then click **Compare**. The same 6.5% rate applies to both homes. The flat's illustrative cash flow is about −£120/month; inspect the service charge and differences in the category scores. These numbers describe fictional scenarios, not actual Manchester deals.
4. **2:30–3:00 — Ask for judgement.** Ask which figure they distrust first, which property they would investigate, and what evidence they would need next. Avoid explaining the grade before hearing their interpretation.

Use the same routes on the Vercel preview hostname. Reset the demo before another walkthrough.

## State and limits

- Real-data and synthetic journeys use separate `sessionStorage` records for their shortlists, assumptions and filters. They survive reloads and navigation, are not accounts or shared links, and ordinarily disappear when that tab's session ends. **Reset all scenario inputs** clears the calculation assumptions; synthetic **Reset demo** clears its working scenario.
- OpenStreetMap tiles and Google Fonts require external network access. The property list and calculations still work if tiles fail; a fallback font is available.
- Figures are before tax. Buying costs are an editable allowance, not a statutory tax calculation. Verified or user-entered ground rent is included. Unknown ground rent, one-off repairs, sale costs and personal/company taxes are excluded. Tenant-paid council tax has no void-period allowance.
- Ten-year scenarios use assumed growth, a fixed mortgage rate and fixed insurance/service charges/council tax. They are not forecasts or investment recommendations.

## Social previews

Canonical and preview URLs use Vercel's production domain, with `letlytics-dev.vercel.app` as the local fallback. The branded preview is a static 1200 × 630 PNG at `/og/letlytics-v2.png`; regenerate it with `npm run image:generate`. It is checked in so link-preview crawlers can load it without a function or an API key.


## Original-listing enrichment

`npm run data:enrich` backfills the current saved listings without re-pulling rents or sales. The existing key can optionally check `/sourced-property` for records without retained provider details; no key is needed for public document retrieval. `-- --force` bypasses the local success cache, never source access restrictions. The normal daily command runs enrichment after sourcing, rents and sales. Vercel serves the resulting saved files and never performs enrichment on a visit.

- `scripts/listing-extraction.ts` reads public Rightmove and OnTheMarket document JSON, verifies the exact portal listing ID, then extracts explicit facts. It never executes page scripts. Source descriptions are untrusted data. The parser is conservative: unsupported formats, unspecified charge periods and unreadable EPC images remain unknown.
- `scripts/enrich-listings-core.ts` follows the provider's outbound/forward links, uses one worker, a five-minute budget, 12-second request timeouts and at most one retry for network/5xx failures. 401/403 are never retried or bypassed. A 429 pauses the whole host, persists Retry-After (six hours if absent), and blocks requests during that window even with `--force`. A host allowlist restricts outgoing documents. Directly linked supported agent brochures require an agent-reference match; building address alone is insufficient. Arbitrary search-result matches are not automatically imported.
- `src/data/listing-enrichment.json` retains facts, source URLs, short excerpts, verification statuses, identity checks, conflicts and failures. Successful checks cache for 24 hours; failed attempts cool down for six hours. Cache reuse/failure retains the real last-success retrieval and enrichment dates. New-source success replaces old evidence so removed facts do not linger. Provider fields in `live-snapshot.json` are never overwritten.
- `src/lib/daily-data.ts` attaches matching saved enrichment to the feed. “Verified” means present in an identity-matched advertisement, not legally verified or independently confirmed. Contradictory values cannot become numeric defaults; original provider and source claims remain inspectable.
- Cash-only restrictions force cash funding even when the shared scenario uses a mortgage. Studio/provider-bedroom conflicts prevent the mismatched rent cohort from becoming a default. Select a separately labelled agent estimate or enter your own rent. Agent estimates, advertised rents and reported achieved rents have different fact types; only the explicitly selected estimate drives the scenario.
- Service charge and ground rent reduce cash flow. Auction fees use `max(offer × percentage, minimum)` only when VAT inclusion/minimum are stated. Pack and per-buyer checks are included. The existing buying-cost allowance remains **all-in**: known fees are itemised within it, not added again. If known fees exceed it, the known total becomes the floor; tax/legal costs still need an allowance. Buyer count starts at one and is editable. Unknown costs are excluded and named.
- Per-property inputs retain priority through refreshed defaults. Reset the property to source defaults separately from resetting the whole shortlist. Choosing another rent source clears only that property's custom rent.

The first backfill was run locally on 16 October 2026 (America/Denver; retrieval timestamps are UTC). The repository's GitHub Actions run list was empty when checked: a configured schedule is not evidence of a completed scheduled run. The listing/rent snapshot remains the earlier retrieval, while enrichment has its own current timestamps. See `reports/enrichment-validation.json` for per-record outcomes and before/after financial comparisons. No new PropertyData listing/rental refresh or Land Registry pull was claimed during this backfill.


The validation pass obtained evidence for 34/40 listings. Its final recheck refreshed 16 and retained 18 earlier successful retrievals after PropertyData outbound links returned HTTP 429; those older dates remain visible. Five Zoopla pages returned HTTP 403 without usable prior evidence, and one Rightmove page returned HTTP 410. The job now pauses the whole host on 429. The saved blocked records do not claim newly verified details. Exact source outcomes and all 40 property IDs are in the validation report.

Alternative-source research located a Reeds Rains candidate for blocked `Z73235683` (reference MCC250696), a Bridgfords candidate for `Z71641932`, and possible cross-portal adverts for other blocked flats. Those were not imported: cached search descriptions/building matches cannot establish current apartment identity without a verifiable source reference or photo/unit match. The High Street original agent page **was** used because the portal linked directly to it and its agent reference 1580 matched. New agent hosts/PDF formats need a dedicated reviewed adapter; there is no generic scraper or anti-bot bypass.
