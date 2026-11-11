# CURALITHRA — Horizon Edition

> **Care, Connected. Operations, Simplified.**

[![Java 21](https://img.shields.io/badge/Java-21-007396?logo=openjdk&logoColor=white)](https://openjdk.org/)
[![Spring Boot 3.4.5](https://img.shields.io/badge/Spring%20Boot-3.4.5-6DB33F?logo=springboot&logoColor=white)](https://spring.io/projects/spring-boot)
[![React 18](https://img.shields.io/badge/React-18.3-61DAFB?logo=react&logoColor=black)](https://react.dev/)
[![TypeScript 5.6](https://img.shields.io/badge/TypeScript-5.6-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Vite 6](https://img.shields.io/badge/Vite-6.4-646CFF?logo=vite&logoColor=white)](https://vitejs.dev/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-Flyway%20%2B%20Neon-4169E1?logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![GitHub Pages](https://img.shields.io/badge/Frontend-GitHub%20Pages-287A59?logo=githubpages&logoColor=white)](https://alitrose.github.io/Curalithra/)

**CURALITHRA — Horizon Edition** is a full-stack hospital operations and Electronic Medical Records (EMR) platform built with **Spring Boot 3.4**, **PostgreSQL + Flyway**, and **React 18 + TypeScript**. It unifies patient intake, triage vitals, physician scheduling with atomic conflict prevention, role-restricted EMR charting, pharmacotherapy prescriptions, `BigDecimal` invoicing with OpenPDF receipts, operational analytics, and compliance audit logging in a distraction-free horizontal command interface.

---

## Live Website & Interactive Demo

- **Live Website:** [https://alitrose.github.io/Curalithra/](https://alitrose.github.io/Curalithra/)
- **Web Repository:** [https://github.com/alitrose/Curalithra](https://github.com/alitrose/Curalithra)
- **Desktop Companion Repository:** [https://github.com/alitrose/Curalithra-Desktop](https://github.com/alitrose/Curalithra-Desktop) *(separate Java desktop repository)*

[**OPEN CURALITHRA — LIVE DEMO**](https://alitrose.github.io/Curalithra/)

---

## One-Click Public Demo Mode

Recruiters, hiring managers, and reviewers can explore every clinical and administrative workflow in **Public Demo Mode** with a single click — **no sign-up or shared passwords required**:

1. Open [https://alitrose.github.io/Curalithra/](https://alitrose.github.io/Curalithra/).
2. Click **`Explore Live Demo`** or pick any of the three role cards (**Administrator Demo**, **Doctor Demo**, or **Receptionist Demo**).
3. The React frontend requests a real backend-minted **HMAC-SHA256 JWT** (`POST /api/auth/demo-login`) authenticated against PostgreSQL.
4. Explore **20 synthetic patients**, **8 specialists**, **8 departments**, **12 appointments**, **6 EMR charts**, **8 prescriptions**, and **8 itemized invoices** with live **OpenPDF receipts** and **CSV exports**.
5. Use the top **`DEMO MODE`** banner at any time to:
   - **Switch roles in one click** (`Admin` / `Doctor` / `Receptionist`) and inspect live RBAC enforcement.
   - Click **`Reset Demo Data`** (`POST /api/demo/reset`) to restore the clean baseline dataset on demand.

> **Hosted Free-Tier Cold Start Note:** When the Render Free container has been idle, the first `/api/health` request may take ~30–50 seconds while the JVM & Hikari pool wake up. Use the **Retry** button on the sign-in header if needed.

---

## Security & Demo Isolation Architecture

CURALITHRA keeps production security intact even while hosting an interactive public portfolio demo:

| Control | Implementation |
| :--- | :--- |
| **Row-Level Tenant Isolation (`is_demo`)** | Flyway `V3__demo_mode_and_isolation.sql` adds `is_demo` across all core clinical tables (`users`, `departments`, `doctors`, `patients`, `appointments`, `medical_records`, `prescriptions`, `bills`, `activity_logs`) with scope-aware composite unique indexes `(..., is_demo)`. |
| **JWT Claim Enforcement** | Demo JWTs include `"demo": true`; `JwtAuthFilter` rejects tampered claims or disabled demo sessions immediately, and `PermissionService.verifySameScope(...)` prevents cross-scope reads or writes. |
| **Zero Hardcoded Frontend Credentials** | Neither the React bundle nor login page embeds demo passwords. Demo authentication mints server-side tokens only when `CURALITHRA_DEMO_ENABLED=true`. |
| **Non-Destructive Demo Guardrails** | Inside Demo Mode, destructive operations (`DELETE` patients/doctors/bills, modifying facility settings, provisioning/editing staff accounts, or rotating demo credentials) are rejected server-side with `HTTP 403` and disabled cleanly in the UI. |
| **Production Default-Off Safety** | `curalithra.demo.enabled` defaults to `false`. Private deployments operate strictly with BCrypt cost-12 password verification and first-run Administrator onboarding (`POST /api/auth/setup`). |
| **CSV Formula Neutralization & Input Validation** | Bean Validation (`@Valid`) DTO records, parameterized JPA/JPQL queries, strict `CORS_ALLOWED_ORIGINS` matching, and OWASP-aware CSV prefix escaping. |

---

## Verified Technology Stack

| Layer | Technologies |
| :--- | :--- |
| **Backend** | Java 21, Spring Boot 3.4.5, Spring Security (Stateless JJWT 0.12.6 + BCrypt), Spring Data JPA, Bean Validation, Spring Actuator, OpenPDF 2.0.3 |
| **Database & Migrations** | PostgreSQL, HikariCP, Flyway (`V1__init_curalithra_schema.sql`, `V2__notifications_and_settings.sql`, `V3__demo_mode_and_isolation.sql`) |
| **Frontend** | React 18.3, TypeScript 5.6, Vite 6.4, Tailwind CSS 3.4, React Router 7 (`HashRouter`), Recharts 2.13, Lucide Icons |
| **Testing** | JUnit 5, Spring Boot Test (`MockMvc`), Zonky Embedded PostgreSQL 2.1.0, Vitest 4.1, React Testing Library 16, jsdom 25 |
| **Cloud / CI-CD** | GitHub Pages + GitHub Actions, Render Docker Web Service (`eclipse-temurin:21-jre-alpine`), Neon Serverless PostgreSQL |

---

## Architecture & Repository Layout

```text
CURALITHRA/
├── .github/workflows/
│   └── deploy-pages.yml          # Automated Vitest + Vite build & GitHub Pages deployment
├── backend/
│   ├── src/main/java/com/curalithra/web/
│   │   ├── config/               # SecurityConfig, BootstrapRunner, DemoBootstrapRunner
│   │   ├── controller/           # REST API controllers (/api/*) & DemoController
│   │   ├── dto/                  # Java record request/response DTOs
│   │   ├── entity/               # JPA entities with is_demo isolation columns
│   │   ├── enums/                # Role, 20 RolePermissions, clinical & billing statuses
│   │   ├── exception/            # Structured JSON GlobalExceptionHandler
│   │   ├── repository/           # Spring Data JPA repositories & scoped JPQL queries
│   │   ├── security/             # JwtService, JwtAuthFilter, PermissionService
│   │   ├── service/              # Clinical, billing, OpenPDF, CSV, DemoService, SeedDataService
│   │   └── util/                 # DomainValidators, DtoMapper, PaginationUtils
│   ├── src/main/resources/
│   │   ├── db/migration/         # Flyway V1, V2, and V3 SQL migrations
│   │   ├── application.yml
│   │   ├── application-dev.yml
│   │   └── application-prod.yml  # Neon PostgreSQL Hikari connection tuning
│   ├── src/test/java/            # Embedded PostgreSQL + Flyway + MockMvc integration suite
│   ├── Dockerfile                # Multi-stage Alpine JDK/JRE 21 build for Render
│   └── pom.xml
├── frontend/
│   ├── src/
│   │   ├── api/client.ts         # Fetch client, URL normalization, unconfigured-host guard
│   │   ├── components/           # Horizontal TopNavBar, DemoBanner, CuralithraLogo, UI primitives
│   │   ├── context/              # AuthContext (JWT, setup & demo state), ToastContext
│   │   ├── pages/                # Login/Demo, Dashboard, Patients, Doctors, Appointments, EMR, Prescriptions, Billing, Reports, Settings, Profile
│   │   ├── test/                 # Vitest + React Testing Library suites
│   │   └── types/api.ts          # TypeScript contracts mirrored from backend DTOs
│   ├── package.json
│   └── vite.config.ts            # base: '/Curalithra/' for GitHub Pages
├── render.yaml                   # Render Docker web service Blueprint
└── README.md
```

---

## Horizon UI & 20-Permission RBAC Policy

- **Strict Zero-Sidebar Layout:** Full-viewport workflow anchored by a sticky horizontal `TopNavBar` (`Space Grotesk` + `Inter`, Graphite `#101412`, Emerald `#287A59`, Lime `#B8F36B`), responsive mobile top dropdown, live notification popover, and `@media print` stylesheets for clinical notes, prescriptions, reports, and receipts.
- **Role-Based Access Control:**

| Role | Demo Persona | Clinical & Operational Access |
| :--- | :--- | :--- |
| **`ADMIN` (Administrator)** | *Dr. Elena Vance* | All 20 permissions: KPI analytics, patient/doctor management, scheduling, EMR & prescriptions, full billing + PDF invoices, reports + CSV export, staff accounts, facility settings, and security audit logs. |
| **`DOCTOR` (Doctor)** | *Dr. Evelyn Hayes* | Patient demographics/vitals, clinical schedule management, full **EMR & prescription authoring**, read-only billing visibility, and reports + CSV export. Restricted from admin settings and user management. |
| **`RECEPTIONIST` (Receptionist)** | *Maya Lin* | Front-desk patient intake, **conflict-aware appointment booking & cancellation**, itemized billing & payment collection, and reports. Strictly **blocked (`403 Forbidden`)** from EMR diagnoses, medical records, prescriptions, settings, and user management. |

---

## Key REST API Endpoints

- **Public & Demo Auth:**
  - `GET /api/health` — Service & live PostgreSQL connectivity check
  - `GET /api/auth/setup-status`, `POST /api/auth/setup` — First-run workspace initialization
  - `GET /api/auth/demo-status`, `POST /api/auth/demo-login`, `POST /api/demo/reset` — Public Demo discovery, role login & sandbox reset
  - `POST /api/auth/login`, `POST /api/auth/logout`, `GET /api/auth/me`, `PUT /api/auth/me`, `POST /api/auth/change-password`
- **Clinical & Operations:**
  - `GET /api/dashboard/stats` — Live KPI metrics, monthly trends, and status distributions
  - `/api/patients/**` (`GET`, `POST`, `PUT`, `DELETE`, `/{id}/history`)
  - `/api/doctors/**` (`GET`, `POST`, `PUT`, `DELETE`, `/departments`, `/specializations`, `/{id}/appointments`)
  - `/api/appointments/**` (`GET`, `POST`, `PUT`, `/{id}/status`, `/{id}/cancel`, `/calendar`, `/available-slots`) — returns `HTTP 409` + open slots on collision
  - `/api/medical-records/**`, `/api/prescriptions/**`
- **Financial, Reports & Governance:**
  - `/api/billing/**` (`GET`, `POST`, `/{id}/payments`, `/{id}/cancel`, `/{id}`, `GET /{id}/pdf`)
  - `/api/reports`, `/api/reports/export` (formula-safe CSV), `/api/reports/audit-logs`
  - `/api/notifications/**`, `/api/settings`, `/api/users/**`

---

## Local Development Setup

### Prerequisites
- **Java JDK 21** (`JAVA_HOME` configured to JDK 21)
- **Node.js 20+** and **npm**
- **PostgreSQL 14+**

### 1. Create Local Database
```sql
CREATE USER curalithra WITH PASSWORD 'your_local_password';
CREATE DATABASE curalithra OWNER curalithra;
```

### 2. Run Spring Boot Backend
Copy `backend/.env.example` to `backend/.env` (never commit `.env`), set your DB credentials and `CURALITHRA_JWT_SECRET`, and start:
```powershell
cd backend
.\mvnw.cmd spring-boot:run
```
Optional local demo mode: pass `CURALITHRA_DEMO_ENABLED=true` when launching if you want one-click Public Demo cards enabled locally.

### 3. Run Vite React Frontend
```powershell
cd frontend
npm install
npm run dev
```
Open `http://localhost:5173/Curalithra/`.

---

## Automated Verification

```powershell
# Backend integration suite (Embedded PostgreSQL + Flyway V1-V3 + MockMvc) & executable JAR
cd backend
.\mvnw.cmd test package

# Frontend typecheck, Vitest suite & production Vite bundle
cd frontend
npx tsc --noEmit
npm test
npm run build
```

---

## Cloud Deployment Overview

- **Database (Neon PostgreSQL):** Use the Neon **Direct** (non-pooler) hostname for Flyway advisory lock compatibility:
  `jdbc:postgresql://<ep-direct-host>.aws.neon.tech/<dbname>?sslmode=require` (omit `channel_binding`).
- **Backend (Render Docker Web Service — `render.yaml`):**
  - Service name: `curalithra-api` · Health check: `/api/health`
  - Environment variables: `SPRING_PROFILES_ACTIVE=prod`, `DB_URL`, `DB_USERNAME`, `DB_PASSWORD`, `CURALITHRA_JWT_SECRET` (32+ chars), `CORS_ALLOWED_ORIGINS=https://alitrose.github.io`, `CURALITHRA_DEMO_ENABLED=true`, `CURALITHRA_DEMO_SEED_ON_STARTUP=true`.
- **Frontend (GitHub Pages — `.github/workflows/deploy-pages.yml`):**
  - Builds with `base: '/Curalithra/'` and repository variable `VITE_API_BASE_URL=https://curalithra-api.onrender.com/api`.
  - Hosted at `https://alitrose.github.io/Curalithra/`.

---

## Author

Built and maintained by **[@alitrose](https://github.com/alitrose)**.
