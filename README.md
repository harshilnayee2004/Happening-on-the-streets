# Hapstr

Hapstr is one property workspace with three ways in:

- **Open House Tools** at `/` — collect, open house, workspace, compare
- **Realtor** at `/realtor` — create a workspace, then see buyer engagement
- **Referral** at `/referral` — pass on a lead you cannot serve

This repository is the skeleton for that rebuild. The pages navigate. The workflows are not built yet.

The previous Hapstr codebase was used as reference only and was not modified.

## Run locally

Node.js 22.14 or newer.

```powershell
cd backend
copy .env.example .env
```

Set `AUTH_SECRET` in `backend/.env` to a random string of at least 32 characters. Then:

```powershell
npm install
npm test
npm run dev
```

The API binds `0.0.0.0` and `PORT` (default 4000). Locally that is `http://127.0.0.1:4000`. `GET /api/health` returns `{ "ok": true }`.

```powershell
cd frontend
copy .env.example .env
npm install
npm run dev
```

Open `http://127.0.0.1:5173`.

## Deploy the frontend on Vercel

Connect [solid-fiesta](https://github.com/harshilnayee2004/solid-fiesta). This repo already points Vercel at `frontend`.

1. Import the GitHub repo in Vercel.
2. Framework: Vite. Output: `frontend/dist`.
3. Add a Production environment variable:

   `VITE_API_BASE_URL` = the public URL of the Hapstr API (no trailing slash), for example `https://api.your-host.example`.

   Vite inlines this at **build** time. After you change it, redeploy.
4. On the API host, set `CORS_ORIGIN` to your Vercel URL, comma-separated if you also keep local:

   `https://your-app.vercel.app,http://127.0.0.1:5173`

The marketing page will load without an API. Collect, workspace, and realtor calls will fail until `VITE_API_BASE_URL` is a reachable HTTPS origin. `http://127.0.0.1:4000` only works on your machine.

## Deploy the API on Railway (SQLite + volume)

The API is a long-running Node 22 process with a file SQLite database. Do not put it on Vercel. Railway is the simplest persistent-volume setup.

1. Create a Railway project and a service from this GitHub repo.
2. Set the service **root directory** to `backend` (uses `backend/Dockerfile`).
3. Add a **volume**. Mount it at `/data`.
4. Set these variables on the service (not in git):

   | Name | Value |
   |---|---|
   | `NODE_ENV` | `production` |
   | `HOST` | `0.0.0.0` |
   | `PORT` | Railway injects this; do not hardcode it |
   | `AUTH_SECRET` | random string, at least 32 characters |
   | `DATABASE_PATH` | `/data/hapstr.sqlite` |
   | `CORS_ORIGIN` | `https://YOUR-VERCEL-APP.vercel.app,http://127.0.0.1:5173` |

5. Deploy. Confirm `GET https://YOUR-RAILWAY-HOST/api/health` returns `{ "ok": true }`.
6. Put that origin (no trailing slash) in Vercel as `VITE_API_BASE_URL` and **redeploy** the frontend.

The public API URL is not checked in. After you create the Railway service, write the URL into `PROJECT_HISTORY.md` under the stack section.

Render (Web Service + disk at `/data`) or Fly.io (volume + `fly.toml`) work the same way: listen on `0.0.0.0:$PORT`, keep SQLite on the mounted disk.

## How the skeleton is put together

`backend/src/services/dataAccess.js` is the only module that queries the database. Routes, controllers, and the UI call that layer when a feature needs data. They do not open SQLite themselves.

Every read and write runs as the actor attached to the request. `middleware/auth.js` verifies a user bearer token or a guest token. `middleware/rls.js` keeps that actor on the request. Missing credentials cannot read a table. A token cannot grant a role; membership is stored per workspace.

Workspace items have a `visibility` field. The default is `private`.

| Visibility | Who can read it |
|---|---|
| `private` | The person who created the item |
| `family` | The creator and members invited as family |
| `realtor` | The creator and members invited as realtor |
| `shared` | The creator and the people explicitly listed on that item |
| `everyone` | The creator and members of that workspace |

Joining a workspace, including through a realtor QR code later, does not reveal private items. Family members do not see private items either. The buyer changes visibility when they choose to share.

Showcase rows store 3D placement only. Share links, when they are added, go in `access_grants` as a `token_hash`. There is no share-token column on showcases.

Listing URLs are checked in `services/listingParser.js`. The allow-list is `zillow.com` and `realtor.com`, https only, with redirects disabled and a size and time limit reserved for the future fetcher. Parsing itself returns “not implemented.” Guest claim, login, SMS, and email are the same.

The frontend calls the API only through `frontend/src/shared/api/client.js`. The 3D viewer, when it is connected, belongs only in `frontend/src/shared/cesium/CesiumViewer.jsx`. Keys stay in environment files, which are not committed.

Navigation lists every page that exists. Pages do not include controls for work that is not built yet.

## What is left for the next step

The Open House Tools flow: collect a home, capture an open house, and work inside the shared workspace.
