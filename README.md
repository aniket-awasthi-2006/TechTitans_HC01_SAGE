# MediQueue

MediQueue is a real-time hospital OPD queue management system built with Next.js 16, React 19, MongoDB, Socket.io and Mongoose.

## What this app does

- Provides role-based access for `patient`, `reception`, and `doctor` users.
- Supports user registration and login with JWT authentication.
- Offers live token creation and queue updates via Socket.io.
- Displays a patient-facing TV-style queue board for real-time token status.
- Records consultations and calculates average consultation durations.
- Includes fallback demo login mode when MongoDB is unavailable.

## Project structure overview

- `server.ts` — custom Next.js server with Socket.io support.
- `app/` — Next.js App Router UI and pages.
- `app/api/` — API routes for auth, users, tokens, consultations, and token updates.
- `components/` — shared UI, layout, auth provider, and socket provider.
- `lib/` — auth helpers, MongoDB connection, wait time utilities.
- `models/` — Mongoose schemas for `User`, `Token`, and `Consultation`.

## Key features

### Authentication
- `POST /api/auth/login` — authenticates users and returns a JWT token.
- `POST /api/auth/register` — creates patients in MongoDB and returns a JWT.
- JWT verification is handled in `lib/auth.ts`.

### User roles
- `patient` — register, view queue status, and access patient dashboard.
- `reception` — create tokens for patients, manage live queue, and add users.
- `doctor` — view assigned queue, call next patient, complete consultations, and log prescriptions.

### Queue management
- `GET /api/tokens` — fetches tokens for today with optional doctor filtering.
- `POST /api/tokens` — allows receptionists/doctors to create new patient tokens.
- `PATCH /api/tokens/[id]` — updates token status and creates consultation records when completed.
- Socket.io events broadcast live queue changes to connected clients.

### Patient display board
- `app/display/page.tsx` — a live queue dashboard showing the currently served token and upcoming waiting list.
- Uses Socket.io to auto-refresh when tokens are created, updated, or completed.

## Requirements

- Node.js 20+ recommended
- MongoDB connection for full persistence

## Environment variables

Create a `.env.local` file at the repository root with:

```env
MONGODB_URI=your_mongodb_connection_string
JWT_SECRET=your_jwt_secret
PORT=3000
```

> The app includes demo users in `app/api/auth/login/route.ts`, so login works even when MongoDB is unavailable.

## Scripts

```bash
npm run dev
npm run build
npm start
npm run lint
```

- `npm run dev` — starts the custom Next.js + Socket.io server via `tsx server.ts`.
- `npm run build` — builds the Next.js app.
- `npm start` — runs the production server.
- `npm run lint` — runs ESLint.

## Usage

1. Run `npm install`.
2. Set environment variables in `.env.local`.
3. Start development mode with `npm run dev`.
4. Open `http://localhost:3000`.
5. Use `/login` to choose a role, or `/register` to create a patient account.
6. Open `/display` for the live TV-style queue board.

## Preview deployment

- Live preview: https://tech-titans-hc-01-sage-armg.vercel.app/

## Demo logins

If you want to test quickly without a database, use the following credentials:

- Reception: `reception@hospital.com` / `password123`
- Doctor: `doctor@hospital.com` / `password123`
- Doctor 2: `doctor2@hospital.com` / `password123`
- Patient: `patient@hospital.com` / `password123`

## Notes

- `lib/db.ts` caches the MongoDB connection to avoid reconnecting during development.
- `models/User.ts` hashes passwords with `bcryptjs` before saving.
- `app/page.tsx` redirects authenticated users to dashboards based on role.
- `next.config.ts` is configured for the custom server and Socket.io route.
