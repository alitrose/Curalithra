# CURALITHRA — Intelligent Hospital Management System (Horizon Web Edition)

**Tagline:** *Care, Connected. Operations, Simplified.*

CURALITHRA Web Edition is a full-stack hospital operations and clinical management platform designed for modern healthcare facilities. It brings together patient registration, triage vitals, physician directories, conflict-safe appointment scheduling, role-restricted Electronic Medical Records (EMR), pharmacotherapy prescriptions, high-precision billing with PDF invoices, operational analytics with CSV exports, notifications, and administrative audit logging.

---

## 1. Key Highlights & Horizon UI Architecture

- **Strict Horizontal Top Navigation (Zero Sidebar)**: Full-width SaaS layout powered by a sticky top navigation bar (`TopNavBar`) with permission-filtered links, interactive clinical notifications popover, profile/role chip, sign-out control, and a compact top dropdown menu on mobile/tablet viewports.
- **Horizon Palette**: Graphite surfaces (`#101412`, `#1B2420`, `#090D0B`), Emerald primary accents (`#287A59`), Lime highlights (`#B8F36B`), crisp typography (`Space Grotesk` & `Inter`), and responsive data tables.
- **Clinical & Financial Integrity**:
  - Server-side appointment time-overlap detection (`HTTP 409 Conflict`) reinforced by a PostgreSQL partial unique slot index.
  - Exact monetary calculations using Java `BigDecimal` (`HALF_UP` scale) and OpenPDF itemized invoice generation.
  - CSV report exports with spreadsheet formula-injection neutralization.
  - Print-ready stylesheets (`@media print`) for prescriptions, receipts, clinical notes, and reports.

---

## 2. Technology Stack

| Layer | Technologies |
| --- | --- |
| **Backend** | Java 21, Spring Boot 3.4.5, Spring Security (Stateless JWT + BCrypt cost 12), Spring Data JPA, Spring Validation, OpenPDF 2.0.3, Actuator |
| **Database & Migrations** | PostgreSQL, HikariCP, Flyway (`V1` schema + `V2` notifications & hospital settings) |
| **Frontend** | React 18, TypeScript 5.6, Vite 5.4, Tailwind CSS 3.4, React Router 6 (`HashRouter`), Recharts, Lucide Icons |
| **Testing** | JUnit 5, Spring Boot Test (`MockMvc`), Zonky Embedded PostgreSQL 2.1.0, Vitest 2.1, React Testing Library |
| **Deployment Targets** | GitHub Pages (Frontend), Render Docker Web Service (Backend), Neon PostgreSQL (Database) |

---

## 3. Repository Structure

```text
CURALITHRA-WEB/
├── .github/workflows/
│   └── deploy-pages.yml          # GitHub Actions CI/CD build & Pages deploy (frontend)
├── backend/
│   ├── src/main/java/com/curalithra/web/
│   │   ├── config/               # SecurityConfig (JWT, CORS, BCrypt), BootstrapRunner
│   │   ├── controller/           # REST API controllers (/api/*)
│   │   ├── dto/                  # Validated Java record DTOs
│   │   ├── entity/               # JPA PostgreSQL entities
│   │   ├── enums/                # Role, RolePermission (20 permissions), domain statuses
│   │   ├── exception/            # Consistent JSON GlobalExceptionHandler
│   │   ├── repository/           # Spring Data JPA repositories & JPQL filters
│   │   ├── security/             # JwtService, JwtAuthFilter, PermissionService
│   │   ├── service/              # Business logic, conflict detection, PDF/CSV, seeding
│   │   └── util/                 # DomainValidators, DtoMapper, PaginationUtils
│   ├── src/main/resources/
│   │   ├── db/migration/         # Flyway V1__init_curalithra_schema.sql, V2__notifications_and_settings.sql
│   │   ├── application.yml
│   │   ├── application-dev.yml
│   │   └── application-prod.yml
│   ├── src/test/                 # PostgreSQL + Flyway integration tests
│   ├── .env.example
│   ├── Dockerfile
│   └── pom.xml
├── frontend/
│   ├── src/
│   │   ├── api/client.ts         # Fetch wrapper, JWT bearer injection, blob downloads, 401 handler
│   │   ├── components/           # TopNavBar, CuralithraLogo, reusable UI primitives
│   │   ├── context/              # AuthContext, ToastContext
│   │   ├── pages/                # Login/Setup, Dashboard, Patients, Doctors, Appointments, EMR, Prescriptions, Billing, Reports, Settings, Profile
│   │   ├── test/                 # Vitest + React Testing Library test suites
│   │   ├── types/api.ts          # Full TypeScript contracts mirrored from backend DTOs
│   │   └── utils/format.ts       # Currency & date formatters
│   ├── .env.example
│   ├── package.json
│   └── vite.config.ts
├── docs/
├── render.yaml                   # Render Docker service blueprint
└── README.md
```

---

## 4. Security & Role-Based Access Control (RBAC)

CURALITHRA enforces stateless JWT authentication paired with 20 fine-grained permissions across three clinical roles:

- **ADMIN (`Administrator`)**: Full access across all 20 permissions — patient/doctor/appointment CRUD, clinical EMR & prescriptions, full billing + invoice deletion, reports & CSV export, staff user management (`MANAGE_USERS`), facility configuration (`MANAGE_SETTINGS`), and audit logs (`VIEW_ACTIVITY_LOGS`).
- **DOCTOR (`Doctor`)**: Full clinical EMR and prescription authoring (`VIEW_MEDICAL_RECORDS`, `EDIT_MEDICAL_RECORDS`), patient demographics & vitals editing, appointment management, read-only billing visibility, and reports.
- **RECEPTIONIST (`Receptionist`)**: Front-desk registration, appointment scheduling/cancellation, itemized billing & payment collection (`MANAGE_BILLING`), and reports. Intentionally **blocked** from viewing or editing clinical diagnoses, EMR notes, prescriptions (`403 Forbidden`), user administration, and hospital settings.

---

## 5. Implemented Feature Modules

1. **First-Run Setup & Authentication (`/login`)**: Detects an empty `users` table (`GET /api/auth/setup-status`) and presents an interactive Administrator workspace onboarding wizard with optional synthetic hospital dataset seeding.
2. **Clinical Operations Dashboard (`/dashboard`)**: Dynamic KPI metrics (including Total Patients, Active Doctors, Today's Visits, Cancelled Visits, Pending/Completed queues, Collected Revenue, Outstanding Due), interactive date range presets, Recharts visualizations, upcoming schedule, and activity/alert panels.
3. **Patient Registry (`/patients`)**: Searchable/paginated directory, blood group & gender filters, demographics & triage vitals editor, longitudinal patient profile modal (appointments, billing ledger, and role-gated clinical notes).
4. **Medical Specialists & Departments (`/doctors`)**: Card-based roster with department & specialization metadata, consultation fee configuration, active toggle, and per-doctor schedule drawer.
5. **Appointment Management (`/appointments`)**: Table view + grouped Schedule Agenda view, conflict detection (`HTTP 409`) displaying open clinic time slots on the chosen physician's date, status workflow (`SCHEDULED`, `CONFIRMED`, `COMPLETED`, `NO_SHOW`, `CANCELLED`).
6. **Electronic Medical Records (`/medical-records`)**: Doctor/Admin clinical assessments (vitals, symptoms, diagnosis, treatment, notes), optional appointment linking, multi-medication inline prescription builder, and printable clinical note sheet.
7. **Prescriptions (`/prescriptions`)**: Standalone and EMR-linked medication orders, dispensing status transitions (`ACTIVE` -> `DISPENSED` -> `COMPLETED`), and print-ready Rx sheet.
8. **Billing & Invoices (`/billing`)**: Multi-item invoice creation with `BigDecimal` precision and configurable tax rate, payment ledger (`CASH`, `CARD`, `UPI`, `BANK_TRANSFER`, `INSURANCE`), invoice cancellation/deletion, and authenticated **OpenPDF Official PDF download** + printable receipt.
9. **Hospital Reports (`/reports`)**: 5 report types (`PATIENT_REGISTRATION`, `DOCTOR_ACTIVITY`, `APPOINTMENTS`, `APPOINTMENT_STATUS`, `REVENUE`) with keyword/date filters, metric cards, printable layout, and formula-safe **CSV Export**.
10. **Clinical Notifications (`TopNavBar`)**: Live alert feed for today's appointments, overdue appointments, unpaid invoice follow-ups, and active prescriptions, with per-user read tracking (`notification_reads`) and Mark All Read.
11. **Settings & Administration (`/settings`)**: Configurable hospital settings (`hospital_settings`), staff account provisioning & password resets (`/api/users`), system health telemetry, and paginated security audit trail.
12. **Staff Profile (`/profile`)**: Displays granted role permissions, self-service profile editing (`PUT /api/auth/me`), and secure password rotation (`POST /api/auth/change-password`).

---

## 6. Local Development Setup

### Prerequisites
- **Java JDK 21** (Ensure `JAVA_HOME` points to JDK 21)
- **Node.js 20+** and **npm**
- **PostgreSQL 14+** (for running the Spring Boot backend locally)

### 1) Database Setup (Local PostgreSQL)
Create a database and user:
```sql
CREATE USER curalithra WITH PASSWORD 'your_local_password';
CREATE DATABASE curalithra OWNER curalithra;
```
Flyway automatically applies `V1__init_curalithra_schema.sql` and `V2__notifications_and_settings.sql` on startup.

### 2) Backend Setup
Copy `backend/.env.example` to `backend/.env` (never commit `.env`), configure `DB_URL`, `DB_USERNAME`, `DB_PASSWORD`, and run:
```powershell
cd backend
.\mvnw.cmd spring-boot:run
```
Backend API listens on `http://localhost:8080/api`. Health check: `GET http://localhost:8080/api/health`.

### 3) Frontend Setup
Copy `frontend/.env.example` to `frontend/.env.local` if pointing to a custom backend URL (default Vite proxy routes `/api` to `http://localhost:8080`):
```powershell
cd frontend
npm install
npm run dev
```
Open: `http://localhost:5173/Curalithra-Web/`

> **First-Run Onboarding**: If the `users` table is empty, CURALITHRA displays the First-Run Administrator Setup screen automatically so you can create your Admin account (no hardcoded default password is shipped).

---

## 7. Automated Testing & Verification

### Backend Integration Tests (PostgreSQL + Flyway + MockMvc)
Uses `io.zonky.test:embedded-postgres` so tests validate real PostgreSQL queries, partial unique indexes, and Flyway migrations automatically:
```powershell
cd backend
.\mvnw.cmd test package
```

### Frontend Unit, Integration & Build Checks
```powershell
cd frontend
npx tsc --noEmit
npm test
npm run build
```

---

## 8. Key API Endpoints Overview

- **Public**: `GET /api/health`, `GET /api/auth/setup-status`, `POST /api/auth/setup`, `POST /api/auth/login`
- **Auth & Profile**: `POST /api/auth/logout`, `GET /api/auth/me`, `PUT /api/auth/me`, `POST /api/auth/change-password`
- **Core Clinical**: `/api/dashboard/stats`, `/api/patients/**`, `/api/doctors/**`, `/api/appointments/**`, `/api/medical-records/**`, `/api/prescriptions/**`
- **Financial & Reports**: `/api/billing/**`, `/api/billing/{id}/pdf`, `/api/reports`, `/api/reports/export`, `/api/reports/audit-logs`
- **Notifications & Admin**: `/api/notifications/**`, `/api/settings`, `/api/users/**`

---

## 9. Target Cloud Deployment Architecture

Target public deployment architecture prepared in this repository (awaiting explicit provisioning & push):

- **Frontend (GitHub Pages)**: Target URL `https://alitrose.github.io/Curalithra-Web/`
  - Uses `base: '/Curalithra-Web/'` in `frontend/vite.config.ts`, `HashRouter` for client-side routing reliability on static Pages, and `.github/workflows/deploy-pages.yml`.
  - Required GitHub Repository Variable: `VITE_API_BASE_URL=https://<your-render-service>.onrender.com/api`
- **Backend (Render Docker Web Service)**: Blueprint in `render.yaml` + `backend/Dockerfile`
  - Required Render Environment Variables:
    - `SPRING_PROFILES_ACTIVE=prod`
    - `DB_URL=jdbc:postgresql://<neon-host>/<dbname>?sslmode=require`
    - `DB_USERNAME=<neon-user>`
    - `DB_PASSWORD=<neon-password>`
    - `CURALITHRA_JWT_SECRET=<32+ random characters>`
    - `CORS_ALLOWED_ORIGINS=https://alitrose.github.io`
    - `CURALITHRA_BOOTSTRAP_ENABLED=false` (recommended, or provide `CURALITHRA_BOOTSTRAP_ADMIN_PASSWORD` for headless init)
- **Database (Neon PostgreSQL)**: Serverless PostgreSQL with SSL (`sslmode=require`) and automatic Flyway schema migration (`V1` + `V2`).

---

## 10. Troubleshooting

- **`CORS error` from GitHub Pages**: Ensure Render `CORS_ALLOWED_ORIGINS` is set to `https://alitrose.github.io` (origin only — do NOT append `/Curalithra-Web/`).
- **Render `prod` fails to boot with JWT error**: Verify `CURALITHRA_JWT_SECRET` is set and at least 32 characters long.
- **Neon connection error on Render**: Ensure `DB_URL` begins with `jdbc:postgresql://` (not `postgres://`) and ends with `?sslmode=require`.
- **`JAVA_HOME not defined correctly` on Windows**: Point `JAVA_HOME` to a valid JDK 21 installation before running `.\mvnw.cmd`.
