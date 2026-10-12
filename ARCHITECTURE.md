# Frontend Architecture

## Stack
React 19 + Vite + React-Bootstrap + Bootstrap + Recharts + Framer Motion + bundled Montserrat font.

## Screens
- Secure Login
- Management Dashboard
- PO Management / PO Entry / PO Detail
- Invoice Management
- Payment & Advance Management
- Reports
- Customer and Item/Service Masters
- Admin User & Role Management

## Data flow
React page → centralized Axios API client → JWT Bearer token → Node API → MongoDB.

The frontend does not contain static business data. Tables, KPI cards, charts, statuses, filters and documents come from backend APIs. Frontend calculations are used for immediate form preview; the backend remains the source of truth for validation and financial reconciliation.

## UI principles
- Montserrat typography
- Bootstrap responsive grid/components
- compact corporate cards and tables
- subtle Framer Motion animation
- responsive sidebar layout
- searchable/filterable operational screens
- PO document action directly on each PO row
