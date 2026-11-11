# Sheco Pharmacy Frontend

React + Vite frontend for **Sheco**, a single-pharmacy POS, inventory, and admin system for Ghana.

Talks to the FastAPI backend in `sheco-backend`.

## Stack

- React + Vite
- Tailwind CSS
- React Router
- Recharts
- PWA (vite-plugin-pwa)

## Setup

```bash
npm install
copy .env.example .env
# VITE_API_URL=http://localhost:8000/api
npm run dev
```

Start the backend on port `8000` first (see `sheco-backend` README).

## Notes

- Money is stored as integer **pesewas** (100 = GHS 1.00).
- Auth uses JWT from `POST /api/auth/login`.
- Mobile Money is recorded manually (MTN MoMo, Telecel Cash, AT Money).
- Offline sales queue + catalogue cache live in `localStorage`.
