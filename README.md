# PO – Invoice – Payment Reconciliation Frontend

React + Vite + React-Bootstrap frontend connected to the Node/MongoDB backend.

## UI coverage
- Secure login and role-aware navigation
- Animated management dashboard with KPIs, monthly financial chart and ageing
- PO listing with filters and visible PO document link on every row
- Dynamic PO entry with multiple line items and auto totals
- PO lifecycle detail screen
- Multiple invoice entry per PO and invoice documents
- Multiple payment / advance entry with TDS and calculated net bank value
- Report preview + authenticated Excel/PDF downloads
- Customer and item/service masters
- Admin users and roles
- Montserrat bundled locally through `@fontsource/montserrat`
- Bootstrap responsive layout and light animations

## Run
1. Copy `.env.example` to `.env`.
2. Ensure backend runs on the configured URL.
3. `npm install`
4. `npm run dev`

Backend seed defaults: `admin@company.com` / `Admin@12345` unless changed in backend `.env`.
