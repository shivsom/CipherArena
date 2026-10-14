# CipherArena – MERN CTF platform

React (Vite) + Express + MongoDB (Mongoose) + JWT. In production one Node service
builds the React app and serves it together with the REST API.

## How the platform works
- **Free Arena** – 9 challenges, each with a downloadable file (`server/challenge-files/`). Download it, find the flag
  (`CA{...}`), submit it on the site. Flags are stored only as SHA-256 hashes in MongoDB.
- **Premium Vault** – 5 harder challenges (₹99 one-time by default) unlocked through **Razorpay Checkout**:
  `POST /api/premium/order` → Razorpay Checkout → `POST /api/premium/verify` (HMAC-SHA256 signature check).
  `POST /api/premium/webhook` grants access too if the player closes the tab after paying.
- The catalog lives in `server/challenges/catalog.js`. On every server start it is synced into MongoDB
  (new challenges appear, removed ones are hidden, solve counters and users are untouched).
- Change or add a challenge: edit the catalog and the builder, then
  `npm run build:challenges` (writes the files) and `npm run verify:challenges` (solves every file to prove it is solvable).

## Run locally
```bash
cp server/.env.example server/.env        # set MONGO_URI and JWT_SECRET
npm run build                             # install server + client, build client/dist
npm run seed                              # sample challenges and players
NODE_ENV=production PORT=10000 npm start  # http://localhost:10000
```
Development with hot reload: `npm run dev:server` and `npm run dev:client` (port 5173, `/api` proxied to 5000).

## Deploy on Render (single web service)
1. Create a free MongoDB Atlas cluster, add a database user and allow access from `0.0.0.0/0`.
2. Push this repository to GitHub.
3. Render → **New → Blueprint** → select the repository (uses `render.yaml`),
   or **New → Web Service** with build `npm run build`, start `npm start`, health check `/api/health`.
4. Set the `MONGO_URI` environment variable to the Atlas connection string (JWT_SECRET is generated).
5. Premium payments: create Razorpay API keys and set `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`
   (and optionally `RAZORPAY_WEBHOOK_SECRET` + a webhook to `/api/premium/webhook`). Start with **test mode** keys.
6. Challenges are synced automatically on start – no seeding needed. (`npm run seed` is for local demo data only, it wipes users.)
   Check the deploy with `BASE_URL=https://<your-app>.onrender.com npm run test:e2e`.

## Tests
```bash
npm run verify:challenges   # every challenge file can be solved from its download alone
npm run test:e2e            # register → login → download a file → solve → submit → leaderboard (needs a running server)
# premium flow against a mock Razorpay API (start the server with RAZORPAY_API_BASE=http://localhost:9911, see the file header)
npm run test:premium
```

## Optional: frontend on Vercel / Netlify
Deploy `client/` with build `npm run build` and output `dist`, set `VITE_API_URL=https://<api>.onrender.com/api`,
and set `CLIENT_URL` on the API so CORS allows the frontend domain.
`client/vercel.json` and `client/public/_redirects` send every route to `index.html` for React Router.
