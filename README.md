# University Auth (Sign Up / Sign In)

A minimal Sign Up / Sign In app using Next.js, FastAPI, and Supabase.

## Prerequisites

- Node.js 18+
- Python 3.10+
- A Supabase project (with the database schema in `Database/authentication.sql` already applied)

## Setup

1. **Configure frontend environment variables**

   ```bash
   cp frontend/.env.local.example frontend/.env.local
   ```

   Edit `frontend/.env.local` and fill in your Supabase project URL and anon key (find these in your Supabase project settings under API).

2. **Configure backend environment variables**

   ```bash
   cp backend/.env.example backend/.env
   ```

   Edit `backend/.env` and fill in your Supabase URL, service role key, and JWT secret (also in Supabase project settings under API).

3. **Install everything**

   ```bash
   make install
   ```

   This installs frontend npm packages and creates a Python virtual environment for the backend.

## Running

Run both frontend and backend together:

```bash
make run
```

Or run them separately in two terminals:

```bash
make frontend   # Next.js dev server at http://localhost:3000
make backend    # FastAPI server at http://localhost:8000
```

## Usage

1. Open http://localhost:3000
2. Click **Sign Up**, fill in your details, and submit.
3. Check your email for the Supabase confirmation link and confirm your account.
4. Go to **Sign In** and log in.
5. You'll be redirected to `/dashboard`, which shows your profile data (fetched both directly from Supabase and via the FastAPI `/api/me` endpoint).
6. Use **Sign Out** to log out.

## Cleaning up

To remove installed dependencies and build artifacts:

```bash
make clean
```

## Project structure

```
frontend/   Next.js app (Sign Up, Sign In, Dashboard)
backend/    FastAPI app (/api/me endpoint)
Database/   SQL schema (do not modify)
moye moye
```
