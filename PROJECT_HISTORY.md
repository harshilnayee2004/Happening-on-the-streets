# Hapstr v2 — project history (for Claude)

Last updated: 29 September 2026 (Phase 3 feature-complete + post-demo QA / Compare table / API stability).

Repo: [github.com/harshilnayee2004/solid-fiesta](https://github.com/harshilnayee2004/solid-fiesta)  
Local path: `C:\Projects\hapstrv2`  
This is a **rebuild**, not a copy of old Hapstr production. Spec sources: Sept 23 2026 features PDF and `HAPSTR_HANDOFF.md` (audit only). Do not copy the old app pixel-for-pixel.

Use this file to discuss product and architecture. Do not treat it as an invitation to invent APIs that are not in the code.

---

## What Hapstr is

One **property workspace**, three entry points:

| Product | Route | Who |
|---|---|---|
| Marketing (company home) | `/` | Everyone |
| Open House Tools | `/tools` and OHT pages | Buyers (guest-first) |
| Realtor | `/realtor` | Agents |
| Referral | `/referral` | Partners passing a lead |

Privacy default is **private**. Notes, photos, and chat stay with the buyer until they share. Share links use **HMAC tokens only** (no raw token column on showcases). Guest session is 30 days. Login is how you keep the workspace later.

---

## Stack (what actually runs)

- **Node 22.14+**, Express 4, Helmet, CORS.
- **SQLite** via `node:sqlite` `DatabaseSync`. One data-access module: `backend/src/services/dataAccess.js`. RLS via AsyncLocalStorage; Express 4 drops ALS across `await` — re-enter with `runWithActor`.
- Frontend: Vite, React 19, React Router 7 (`createBrowserRouter`).
- Auth: HMAC bearer or `X-Guest-Token`. Roles come from `workspace_members`.
- Listing fetch: **zillow.com / realtor.com only**, HTTPS, no redirects, 8s timeout, 1.5MB max. **Realtor.com often returns HTTP 429** to the server-side importer (bot/rate limit). Zillow `homedetails` links usually still work. Parser reads beds/baths/sqft when the page JSON has them. **Lot size is not parsed or stored.**
- Calculator: 30-year fixed; cents rounded; defaults 20% down, 6.5% rate, 1.2% tax, $1800 ins, HOA 0, gas 50, elec 120, water 40, maint 1%. Every line labeled **Estimate**.
- Visits unique `(property_id, created_by)`. Notes cap 50. Photos 12 BLOB jpeg/png/webp, 8MB.
- Chat is a `workspace_items` row, `kind=chat`, visibility `everyone` in that workspace.
- Photo labels: `workspace_items` `kind=photo_label`.
- Realtor create: PRIMARY workspace + `MEMBER_ROLE.REALTOR`.
- Local / production API: binds `HOST` (default `0.0.0.0`) and `PORT` (default 4000).
- **API host:** Railway (chosen). Service root `backend`, Docker, volume at `/data`, `DATABASE_PATH=/data/hapstr.sqlite`. Public deploy URL: **not issued yet** — add it here after the first Railway deploy.
- CORS: comma-separated `CORS_ORIGIN` (Vercel + `http://127.0.0.1:5173`).
- Frontend: Vercel, `VITE_API_BASE_URL` = Railway origin after it exists.
- Local Vite: `127.0.0.1:5173`.
- Tests (as of this date): backend **45**, frontend **10** (rooms, monthly cost, calendar URL, compare table helpers). Phase 3 covers AI fallback, readiness override, showcase, referral save/list/unlock 501.

**Hard constraints still in force**

- No anonymous SMS / email / fetch.
- No silent mocks.
- No secrets in git (`.env` ignored).
- One Cesium wrapper (`CesiumViewer.jsx`) — Matterport iframe, Cesium 3D tiles via CDN, or map fallback from showcase rows.
- One listing parser.
- Nav lists every live page. No dead buttons.
- Do not print guest or share tokens.

---

## Routes that exist

**Marketing:** `/`

**Open House Tools:** `/tools`, `/learn-more`, `/collect`, `/open-house`, `/workspace`, `/workspace/:id`, `/w/:token`, `/compare`

**Realtor:** `/realtor`, `/realtor/create`, `/realtor/dashboard`

**Referral:** `/referral`, `/referral/submit`, `/referral/matches`

Brand “Hapstr” goes to `/`. Product switch: Tools → `/tools`, Realtor, Referral. Phone nav is a full-width segmented control.

---

## What we have built (shipped in this rebuild)

### Collect

- Paste Zillow / Realtor URL → property + photos + price + address.
- True monthly cost on the card; **details open in a modal**, not an expanding card.
- Open chat on each card.
- Share link (`/w/:token` then replace to workspace UUID).
- Guest-first; no account required to start.

### Open house album

- Capture / upload photos as BLOBs (not URL links).
- Notes tied to the walk.
- Leave guard when leaving OHT paths if homes exist.

### Workspace + chat

- Messenger-style bubbles (not a raw form).
- `@room` mentions (`@kitchen`, etc.) bring that room’s photo forward when a photo is labeled (or fall back to photo index).
- Autocomplete / room picker.
- Workspace chat: **websocket** `/api/chat` (same `kind=chat` rows) with HTTP fallback; last-message toast still used from room list.
- Shared workspace: family can join without an account.
- Chat sits above the house card on phone.
- Listing hero: fixed **4:3** frame, cover-crop, viewport max-height; multi-photo arrows/dots; **Tag a room** under that frame (not a stretched stack).
- Buyer **readiness** 0–100 with Based-on citations; override needs a reason (`readiness_override` item + event).
- **CesiumViewer:** Matterport iframe, Cesium tiles (CDN), or map from showcase coordinates.

### Compare

- Two saved homes: 4:3 cover-cropped heroes (`object-fit: cover`, max-height), TRUE Monthly Cost card only (no extra “Estimate Estimate” line), Open chat on each card.
- Monthly cost **delta** on the same Collect defaults.
- Rooms: two columns labeled by home; tagged photo or “No tagged photo” with **no** leftover image.
- **Side-by-side table:** price, $/sq ft (only if price + sqft exist), beds, baths, sqft, lot size (**always Not available** — not in parser/DB), address, each monthly-cost line + total. Lower cost / more space is lightly highlighted. Table scrolls horizontally on phone.

### Realtor (today)

- Create a workspace from a listing.
- Dashboard lists real listings from **real tables only** (no fake analytics), plus tier switcher, five questions, and Attach 3D.
- Share the workspace link at the door; **QR** on `/realtor/create` is the same `/w/:token`.
- Dashboard: Attach 3D (Matterport or tiles URL). Free / Pro / Premium switcher.

### Realtor analytics foundation (Phase 1 — 29 Sep 2026)

- Shared **`workspace_events`** log via `dataAccess.js` only. Types: `visit`, `duration_tick`, `invite`, `photo_captured`, `video_captured`, `room_entered`, `model_3d_interaction`, `chat_message`, **`readiness_override`**. Existing visits, album photos, share-link joins, chat posts, and room labels also write this table. Old tables stay.
- **`realtor_accounts.tier`**: `free` | `pro` | `premium`, default **free**, created when a user first becomes a realtor (primary workspace).
- **`workspace_members.consent_given`** + **`consent_given_at`**: default false. Flip with `setBuyerRealtorConsent` / `setOwnMemberConsent`.
- **Tier gating (local):** `/realtor/dashboard` has a Free / Pro / Premium switcher that writes `realtor_accounts.tier`. Free API payloads are counts only. Pro is anonymous slots. Premium adds contact only when `consent_given` is true.
- **Consent UI:** buyers who are not the host can opt in on the workspace page.
- **Five questions:** AI-generated answers when `OPENAI_API_KEY` is set (8s timeout); **rules-based fallback** if the call fails or times out. Citation pattern kept (`Based on X messages tagged #room`).
- Open house + online panels on Pro/Premium. 3D count is a real `0` until model events exist.
- API prepared to host: `0.0.0.0` + `PORT`, Railway Dockerfile + volume docs in README. Live Railway URL is **not** in this phase.

### Referral marketplace

- Submit a lead (`POST /api/referral/leads`); blank/whitespace fields store as null. Contact stays on the submitter. Eyebrow is **Referral** (not “Navigation shell”).
- Network search, then beyond-network search. Match explanation with citation-style reasons.
- Unlock is **stubbed**: `501 payment_not_implemented` — no fake charge, contact never returned.

### Phase 3 (29 Sep 2026) — shipped

- AI five-questions with rules fallback.
- Compare polish (rooms, monthly delta, chat).
- Cesium / Matterport from real `showcases` rows.
- Buyer readiness 0–100 with resolved / unresolved / blocking citations; manual override requires a reason and writes `workspace_items` + `workspace_events.readiness_override`.
- QR at the door on `/realtor/create` using the existing `/w/:token`.
- Schedule-a-visit Google Calendar URL from a saved Collect home.
- Workspace chat over websocket (`/api/chat`) with HTTP fallback; same `workspace_items` `kind=chat` schema.
- Referral matching / unlock stub as above.

**The product is feature-complete against the original Sept 23 2026 V2 spec** for the items listed above. Payment processing is explicitly out of scope and is not faked.

### Post-demo QA (same day, local)

- **Collect:** Schedule-a-visit is a Google Calendar TEMPLATE URL (no OAuth).
- **Listing import:** Realtor.com 429 is `listing_rate_limited` in the UI; Zillow is the reliable path from this network.
- **Guest session:** do not send `X-Guest-Token` on `POST /api/auth/guest`. Invalid leftover tokens used to 401 guest issue and make every page look “unloaded.”
- **API process:** `node --watch-path=src`; listen retries if port is busy after a watch restart; startup prints SQLite path + listen URL; migrate failure is a loud exit, not a silent crash; SQLite `busy_timeout=5000`.
- Workspace + Compare photo frames as above; Compare fact table as above.

### UI / deploy

- Marketing page at `/` with product cards and a live route map.
- Tools landing: paste form, card stack, tap-`@room` demo (CSS color fields, not listing photos).
- Dark “Paste / Walk / Decide” strip.
- Phone: 16px inputs, short labels, full-width actions, no horizontal overflow, glass hero copy.
- Removed the fake “Homes, not forms” sample-listing grid.
- Removed VantaGlobe and **Vanta/Three.js clouds** (lag). Sky is CSS only.
- Frontend on **Vercel** (root dir `frontend`, Vite). Env: `VITE_API_BASE_URL`.
- API is **not** on Vercel. Host it on **Railway** with a persistent volume (see README). CORS accepts comma-separated origins.

---

## What is not built (still open)

These were **never in the Phase 3 ship list** (or are host/payment work outside the app):

- Inspection upload / OCR.
- Owner-mortgage / ATTOM.
- Album photos flowing fully into workspace as first-class labeled rooms (labels + listing photos are wired; album BLOBs are still the open-house album).
- Live Railway URL / production API deploy (handled separately).
- Real payment for referral unlock.

---

## Planned realtor business model (gating is in the local dashboard; production host is separate)

Three paid **views of the same workspace**, not three products. Buyers stay private until they agree to disclose.

### Tiers

**Free — numbers only**

- How many visits.
- Duration (aggregate).
- How many people the buyer invited.
- No who, no photos, no notes, no names.

**Pro — anonymous detail**

- Who-shaped events without names: who (as role/slot), time spent, which pictures/video, rooms, discussion themes.
- Still **no legal names or contact**.

**Premium — identity + contact**

- Same detail as Pro **plus** contact numbers and profile background.
- **Only if the buyer agreed to disclose.** The product must not invent or scrape a phone number.

### Five questions realtors always want (dashboard story)

1. Who is the decision maker?
2. What was discussed in the buyer’s network (family, designer, contractors)?
3. What can the decision makers not compromise on (often husband and wife)?
4. What is the main obstacle?
5. Who has the ball (next move)?

Free answers with counts. Pro answers with anonymous narrative. Premium attaches real people when consent exists.

### Open house (more detail-oriented)

1. What pictures/videos were taken, and which notes attach to them?
2. Time spent in the home.
3. Which areas they explored (kitchen, master, living, etc.).

### Online

- Counts of interaction with the **3D model** vs **pictures/video** only.

Implementation implication: one event/log model, **gated columns** by plan + consent. Do not fork three dashboards that lie. Do not show Premium fields on Free.

---

## How to run locally

```powershell
cd backend
copy .env.example .env
# set AUTH_SECRET to 32+ random characters
npm install
npm test
npm run dev
```

```powershell
cd frontend
copy .env.example .env
npm install
npm run dev
```

API: `http://127.0.0.1:4000` (`GET /api/health`). UI: `http://127.0.0.1:5173`.

---

## Talking points for Claude

- Architecture is guest-first + RLS + one data layer. New realtor intel must go through `dataAccess.js` and visibility/consent, not a side table the UI invents.
- Local dashboard gates Free / Pro / Premium. Five questions are AI when keyed, otherwise rules + citations. Production host is still separate.
- Frontend is static on Vercel; without a hosted API, Collect/workspace/realtor writes fail in production.
- Referral unlock will stay 501 until a real payment provider is chosen.
- Realtor.com import can fail with 429 even when the URL opens in a browser — that is their fetch policy, not a bad token.
- Do not invent lot size. Do not reintroduce WebGL backgrounds or fake listing showcases.
- Express 4 drops ALS across `await` — keep `runWithActor` on controller boundaries.
