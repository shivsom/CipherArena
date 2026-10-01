# CipherArena – MERN CTF platform

React (Vite) + Express + MongoDB (Mongoose) + JWT. In production one Node service
builds the React app and serves it together with the REST API.

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
5. After the first deploy run `npm run seed` once from the Render shell, then
   `BASE_URL=https://<your-app>.onrender.com npm run test:e2e` from your machine.

## Optional: frontend on Vercel / Netlify
Deploy `client/` with build `npm run build` and output `dist`, set `VITE_API_URL=https://<api>.onrender.com/api`,
and set `CLIENT_URL` on the API so CORS allows the frontend domain.
`client/vercel.json` and `client/public/_redirects` send every route to `index.html` for React Router.
