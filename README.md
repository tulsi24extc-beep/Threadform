# Threadform — Custom T-Shirt Designer

A responsive React + TypeScript storefront with a Fabric.js design canvas and an Express + MongoDB API for accounts, orders, and Razorpay checkout.
Storefront photographs are bundled locally from Unsplash so the catalog remains visible without third-party image requests.

## Run locally

Requirements: Node.js 20.19+ (or 22.12+) and either Docker or a local MongoDB instance.

1. Install dependencies:

   ```sh
   npm install
   npm --prefix server install
   ```

2. Start a local MongoDB database. With Docker:

   ```sh
   docker compose up -d mongo
   ```

   Or use your own MongoDB connection string.

3. Configure the API:

   ```sh
   cp server/.env.example server/.env
   ```

   On Windows PowerShell, use `Copy-Item server/.env.example server/.env`.
   Set `JWT_SECRET` to a long, random private value. Keep secrets out of the frontend and source control.

4. Start the frontend and API:

   ```sh
   npm run dev
   ```

   Open <http://localhost:5173>. Vite proxies `/api` requests to the API at port 4000.

Browsing, designing, and the local cart work without database or payment credentials. In development, when MongoDB is not available, accounts and orders use a local SQLite database at `server/data/teestudio-dev.sqlite`; passwords are still bcrypt-hashed, and the database file is git-ignored. These local-only accounts and orders are separate from MongoDB data and are not intended for deployment. To try real sandbox checkout without MongoDB, configure Razorpay test credentials in `server/.env`; orders remain pending unless Razorpay returns a signature the server successfully verifies. Without payment credentials, the checkout button opens a setup page; no order is submitted or marked paid. Payments are never simulated.

## Razorpay test mode

Create a Razorpay account and use its **Test Mode** API credentials. Add the test `RAZORPAY_KEY_ID` and `RAZORPAY_KEY_SECRET` to `server/.env`, then restart the API. The key ID is returned only to the browser to initialize Razorpay Checkout; the secret remains server-side. Use Razorpay's published test payment methods and credentials to exercise the sandbox.

The server creates a Razorpay order using prices from its own catalog, records an order as `pending`, and verifies the HMAC signature before setting it to `paid`. Invalid signatures never confirm an order. A sandbox payment is not a live charge. Do not configure live credentials until your deployment, fulfillment, refund handling, and webhook procedures are ready.

## Commands

| Command | Description |
| --- | --- |
| `npm run dev` | Run Vite and the API in watch mode |
| `npm run build` | Type-check and build the frontend and API |
| `npm run lint` | Run Oxlint |
| `npm run preview` | Preview the production frontend build |

## Deployment

The [Render Blueprint](./render.yaml) deploys the frontend and API together on one origin, so HTTP-only authentication cookies work across pages. It requires a MongoDB Atlas connection string; production startup fails rather than silently running without account storage.

1. Create a MongoDB Atlas database and a database user. Allow connections from the Render service, and copy the Atlas connection string.
2. In Render, choose **New → Blueprint**, connect `tulsi24extc-beep/Threadform`, and deploy the repository's `render.yaml`.
3. When prompted, enter the Atlas connection string as `MONGODB_URI`. Render generates the private `JWT_SECRET` automatically. Do not put either value in source control or the frontend.
4. Open the public `onrender.com` URL shown for the service. Use this URL for login and registration on any device. The free web service may take a little time to wake after inactivity.
5. To enable sandbox payments later, add Razorpay **test** credentials as private `RAZORPAY_KEY_ID` and `RAZORPAY_KEY_SECRET` environment variables in Render.

The GitHub Pages URL (`https://tulsi24extc-beep.github.io/Threadform/`) is a static storefront preview only; GitHub Pages cannot run the API. Account, order, and checkout features require the Render deployment and Atlas database. The authentication cookie is HTTP-only, secure in production, and SameSite=Lax.

The product catalog and prices are intentionally duplicated in the frontend display data and server-side checkout allowlist: the server remains the pricing authority. Update both when adding products.

## Features

- Responsive landing page and filterable product catalog
- Live Fabric.js canvas with editable, draggable design text, shirt colour, print colour, and sizes
- Persistent browser cart with quantity controls, shipping threshold, and checkout summary
- Validated account registration/login, bcrypt password hashes, JWT HTTP-only cookie sessions, protected order/checkout routes, and logout
- MongoDB-backed orders, server-side price calculation, Razorpay order creation, signature verification, and failure status recording
