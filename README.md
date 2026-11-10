# Sheco Pharmacy Frontend

React + Vite frontend for **Sheco**, a single-pharmacy POS, inventory, and admin system for Ghana.

## Stack

- React + Vite
- Tailwind CSS
- React Router
- Recharts
- PWA (vite-plugin-pwa)
- Mock API layer (ready to swap for FastAPI)

## Demo accounts

| Role | Username | Password | PIN |
|------|----------|----------|-----|
| Super Admin | `admin` | `admin123` | `1234` |
| Salesperson | `kwame` | `sale123` | `2222` |
| Salesperson | `efua` | `sale123` | `3333` |

## Scripts

```bash
npm install
npm run dev
npm run build
```

## Notes

- Money is stored as integer **pesewas** (100 = GHS 1.00).
- Mobile Money is recorded manually (MTN MoMo, Telecel Cash, AT Money).
- Offline sales queue + catalogue cache live in `localStorage`.
