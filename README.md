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

The API listens on `http://127.0.0.1:4000`. `GET /api/health` returns `{ "ok": true }`.

```powershell
cd frontend
copy .env.example .env
npm install
npm run dev
```

Open `http://127.0.0.1:5173`.

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
