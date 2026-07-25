<div align="center">

<img src="frontend/public/favicon.svg" alt="UniSphere Logo" width="180" height="180" />

**A unified digital campus for the Department of CSE, University of Dhaka.**

Classes · Attendance · Exams & CGPA · Chat · Notice Board · Achievements & Portfolio — in one app.

**Live Demo:** [unisphere-beta.vercel.app](https://unisphere-beta.vercel.app)

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Next.js](https://img.shields.io/badge/Next.js-14-black?logo=next.js)](frontend/package.json)
[![FastAPI](https://img.shields.io/badge/FastAPI-backend-009688?logo=fastapi)](backend/requirements.txt)
[![Supabase](https://img.shields.io/badge/Supabase-Postgres-3ECF8E?logo=supabase)](Database/schema.sql)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](#contributing)

</div>

---

## Table of Contents

- [About](#about)
- [Features](#features)
- [Tech Stack](#tech-stack)
- [Architecture](#architecture)
- [Project Structure](#project-structure)
- [Getting Started](#getting-started)
  - [Prerequisites](#prerequisites)
  - [1. Clone](#1-clone)
  - [2. Configure environment variables](#2-configure-environment-variables)
  - [3. Set up the database](#3-set-up-the-database)
  - [4. Install dependencies](#4-install-dependencies)
  - [5. Run the app](#5-run-the-app)
- [Environment Variables](#environment-variables)
- [Database](#database)
- [Production Deployment](#production-deployment)
- [Security](#security)
- [Roadmap](#roadmap)
- [Contributing](#contributing)
- [License](#license)

---

## About

**UniSphere** is a full-stack university ERP and community platform built for the CSE department at the University of Dhaka. It replaces the fragmented mix of a slow admission/result portal, spreadsheets, and group chats with one coherent app covering academics, communication, and student portfolios — for both students and faculty.

The backend is a stateless FastAPI service in front of Supabase (Postgres + Auth + Storage + Realtime); the frontend is a Next.js 14 App Router client. Every privileged write goes through the FastAPI layer or Supabase Row Level Security — never trusted directly from the browser.

## Features

| Module | What it does |
|---|---|
| **Auth & Onboarding** | Email/password + Google OAuth via Supabase Auth, profile onboarding flow, password reset |
| **Classes** | Manual course creation, invitations, enrollment, attendance sessions, exams & marks, auto-computed CGPA |
| **Chat** | Direct + group chat rooms, requests, replies, reactions, attachments, realtime delivery |
| **Notice Board** | Department posts, polls, attachments, reactions, realtime notifications |
| **Achievements** | Student portfolios — projects, certificates, research papers, skills, comments/ratings/reactions |
| **Faculty & Info** | Department news, research, and faculty directory pages |

## Tech Stack

**Frontend** — Next.js 14 (App Router) · React 18 · TypeScript · Tailwind CSS · Framer Motion · `@react-three/fiber` / three.js · Supabase JS/SSR client

**Backend** — FastAPI · Uvicorn · PyJWT (Supabase JWKS verification) · `python-dotenv` · `supabase-py` (service-role client)

**Database & Platform** — Supabase (PostgreSQL, Auth, Storage, Realtime) · 43-table schema with 72 enforced foreign keys.

## Architecture

```
┌───────────────────┐        HTTPS/JSON        ┌───────────────────┐
│    Next.js 14      │ ───────────────────────► │    FastAPI          │
│   (App Router)      │ ◄─────────────────────── │   (backend/)         │
│    frontend/         │       Bearer JWT          │                      │
└──────────┬──────────┘                          └──────────┬──────────┘
           │  direct client calls (RLS-protected)             │ service-role
           ▼                                                   ▼
┌──────────────────────────────────────────────────────────────────────┐
│                              Supabase                                   │
│   Postgres (43 tables)  ·  Auth  ·  Storage (3 buckets)  ·  Realtime      │
└──────────────────────────────────────────────────────────────────────┘
```

- The frontend talks to Supabase directly for reads protected by Row Level Security, and to the FastAPI backend for privileged operations (JWT verified against Supabase's JWKS endpoint, then executed with the service-role key).
- Three private storage buckets are auto-provisioned on backend startup: `notice-attachments`, `achievement-media`, `chat-attachments` (50 MB limit each).

## Project Structure

```
project/
├── frontend/                 Next.js 14 app
│   ├── app/
│   │   ├── signin/ signup/ forgot-password/ reset-password/   Auth screens
│   │   ├── onboarding/                                         Profile setup
│   │   ├── dashboard/
│   │   │   ├── classes/        Courses, attendance, exams, CGPA
│   │   │   ├── chatroom/       Realtime chat
│   │   │   ├── notice-board/   Posts, polls, notifications
│   │   │   ├── achievements/   Projects, certificates, papers
│   │   │   ├── projects/       Portfolio
│   │   │   ├── profile/        Student/instructor profile
│   │   │   └── info-tech/      News, research, faculty
│   │   ├── api-blogs/, api-faculty/   Server-side data proxies
│   │   ├── components/, context/, lib/
│   │   └── public/brand/       Logo & brand assets
│   └── package.json
├── backend/                   FastAPI app
│   ├── main.py                 Entry point, auth, storage bootstrap
│   ├── routers/                 achievements.py · chat.py · classes.py
│   └── requirements.txt
├── Database/                   SQL schema, migrations, and fixes
│   └── schema.sql               Canonical 43-table schema
├── tools/                      Schema/diagram build scripts
├── .agents/                     ER diagrams & design docs
├── Makefile                    One-command install/run for dev
├── LICENSE
└── README.md
```

## Getting Started

### Prerequisites

- **Node.js** 18+
- **Python** 3.10+
- A **Supabase** project (free tier is enough for development)
- `make` (Git Bash on Windows already includes it; the Makefile auto-detects your OS)

### 1. Clone

```bash
git clone https://github.com/muhtasim-apon/CSE_2202_Project.git
cd CSE_2202_Project
```

### 2. Configure environment variables

```bash
cp frontend/.env.local.example frontend/.env.local
cp backend/.env.example backend/.env
```

Fill in both files with your Supabase project's credentials (Project Settings → API). See [Environment Variables](#environment-variables) below for what each key does.

### 3. Set up the database

In the Supabase SQL Editor, run [`Database/schema.sql`](Database/schema.sql) against your project — this creates all 43 tables and 72 foreign key constraints. Apply any additional migration files in `Database/` your setup needs (e.g. `grants.sql` for role permissions).

### 4. Install dependencies

```bash
make install
```

This installs the frontend's npm packages and creates a Python virtual environment for the backend with everything from `requirements.txt`.

### 5. Run the app

```bash
make run
```

This starts both servers in parallel:

| Service | URL |
|---|---|
| Frontend (Next.js) | http://localhost:3000 |
| Backend (FastAPI) | http://localhost:8000 |

Or run them individually with `make frontend` / `make backend`. Run `make help` to see all available targets, and `make clean` to remove `node_modules`, `.next`, and the Python `venv`.

## Environment Variables

**`frontend/.env.local`**

| Variable | Description |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Your Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anonymous/public key (safe for the browser, protected by RLS) |
| `NEXT_PUBLIC_API_URL` | FastAPI base URL (`http://localhost:8000` in development) |

**`backend/.env`**

| Variable | Description |
|---|---|
| `SUPABASE_URL` | Your Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Service-role key — **server-only, never expose to the client** |
| `SUPABASE_JWT_SECRET` | Used to verify Supabase-issued JWTs on protected routes |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` / `GOOGLE_REDIRECT_URI` | Optional, for Google OAuth on the Classes module |

> Never commit `.env` / `.env.local` files. Only the `.example` templates belong in version control.

## Database

The schema lives in [`Database/schema.sql`](Database/schema.sql): **43 tables**, **72 enforced foreign keys** (56 internal + 16 to `auth.users`), organized into five modules — Identity & Organization, Academic/LMS, Chat, Notice Board, and Achievements.

A full annotated ER diagram is available at [`.agents/er-final-updated.png`](.agents/er-final-updated.png), with a Canva-editable PowerPoint version in [`frontend/assets`](frontend/assets) for presentations.

## Production Deployment

The project is deployed on **Vercel** for the frontend and accessible live at [unisphere-beta.vercel.app](https://unisphere-beta.vercel.app).

To deploy the two apps independently:

- **Frontend** — deploy `frontend/` to [Vercel](https://vercel.com) (or any Next.js host). Set the three `NEXT_PUBLIC_*` env vars in the platform's dashboard; point `NEXT_PUBLIC_API_URL` at your deployed backend.
- **Backend** — deploy `backend/` to any host that runs a long-lived ASGI process (Railway, Render, Fly.io, or a VPS with `uvicorn`/`gunicorn`). Set `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, and `SUPABASE_JWT_SECRET` as platform secrets — never bake them into the image.
- **Database** — Supabase is already managed/production-grade; just point both apps at your production project instead of a dev project.

Recommended before going live: add a GitHub Actions workflow for `next build` + `pip install -r requirements.txt` on every PR, and lock CORS (`main.py`) to your production frontend origin only.

## Security

- All privileged writes go through FastAPI, which verifies the caller's Supabase JWT against the project's JWKS endpoint before touching the service-role client.
- Direct-from-browser Supabase reads rely on Postgres Row Level Security — never disable RLS on a table without an equivalent policy.
- Storage buckets are private by default; access is brokered through signed URLs.
- Found a vulnerability? Please open a private security advisory on GitHub rather than a public issue.

## Roadmap

- [ ] CI pipeline (lint + build + typecheck on PR)
- [ ] Dockerfiles for both services
- [ ] Automated test coverage for backend routers
- [ ] Formal API documentation (OpenAPI is auto-generated by FastAPI at `/docs`)

## Contributing

1. Fork the repo and create a feature branch.
2. Make your changes; keep frontend/backend contracts (routes, payloads) backward-compatible unless discussed.
3. Run `make run` locally and verify both the golden path and edge cases in the browser.
4. Open a pull request describing the change and why.

## License

Released under the [MIT License](LICENSE) © 2026 UniSphere Contributors.