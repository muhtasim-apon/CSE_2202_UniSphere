# ============================================================
# CSE_2202_Project — Developer Makefile
# Works on Windows (Git Bash / MinGW make) and Mac / Linux
#
# Quick start for teammates:
#   1. make install        <- installs all dependencies
#   2. Copy the .env.example files and fill in the keys
#   3. make run            <- starts both servers
# ============================================================

# ── OS detection ─────────────────────────────────────────────
# Forward slashes are used everywhere so Git Bash (MinGW) and
# POSIX shells both work. Python and Windows also accept /.
ifeq ($(OS),Windows_NT)
    PYTHON      := python
    # Paths relative to project root (used for install)
    PIP         := backend/venv/bin/pip.exe
    # Path relative to backend/ dir (used after "cd backend &&")
    UVICORN     := venv/bin/uvicorn.exe
    # npm.cmd avoids the "C:/Program Files/nodejs/npm" spaces issue
    NPM         := npm.cmd
    MKDIR       := mkdir
else
    PYTHON      := python3
    PIP         := backend/venv/bin/pip
    UVICORN     := venv/bin/uvicorn
    NPM         := npm
    MKDIR       := mkdir -p
endif

FRONTEND_DIR := frontend
BACKEND_DIR  := backend

.PHONY: help install install-frontend install-backend \
        run frontend backend env-check clean

.DEFAULT_GOAL := help

# ── Help ─────────────────────────────────────────────────────

help: ## Show available commands
	@echo ""
	@echo "  CSE 2202 Project — available make targets"
	@echo ""
	@echo "  make install          Install ALL dependencies (run this first)"
	@echo "  make install-frontend Install only frontend Node packages"
	@echo "  make install-backend  Install only backend Python packages"
	@echo "  make run              Start backend + frontend dev servers"
	@echo "  make backend          Start FastAPI only  (http://localhost:8000)"
	@echo "  make frontend         Start Next.js only  (http://localhost:3000)"
	@echo "  make clean            Remove node_modules, venv, and build cache"
	@echo ""

# ── Install ──────────────────────────────────────────────────

install: install-backend install-frontend ## Install ALL dependencies
	@echo ""
	@echo "Done! Next steps:"
	@echo "  1. Copy env templates and fill in your Supabase credentials:"
	@echo "       cp backend/.env.example        backend/.env"
	@echo "       cp frontend/.env.local.example frontend/.env.local"
	@echo "  2. Run:  make run"
	@echo ""

install-frontend: ## Install frontend Node.js packages (npm install)
	@echo "[frontend] Installing Node.js packages..."
	cd $(FRONTEND_DIR) && $(NPM) install
	@echo "[frontend] Done."

install-backend: ## Create Python venv and install pip packages
	@echo "[backend] Creating Python virtual environment..."
	$(PYTHON) -m venv $(BACKEND_DIR)/venv
	@echo "[backend] Installing Python packages..."
	$(PIP) install --upgrade pip --quiet
	$(PIP) install -r $(BACKEND_DIR)/requirements.txt
	@echo "[backend] Done."

# ── Dev servers ──────────────────────────────────────────────

run: ## Start both backend and frontend in parallel
	$(MAKE) -j2 backend frontend

frontend: ## Start the Next.js dev server (http://localhost:3000)
	@echo "[frontend] Starting Next.js..."
	cd $(FRONTEND_DIR) && $(NPM) run dev

backend: ## Start the FastAPI dev server (http://localhost:8000)
	@echo "[backend] Starting FastAPI..."
	cd $(BACKEND_DIR) && venv\bin\uvicorn.exe main:app --reload --host 0.0.0.0 --port 8000

# ── Clean ────────────────────────────────────────────────────

clean: ## Remove node_modules, .next, venv, and __pycache__
	@echo "Cleaning build artifacts..."
ifeq ($(OS),Windows_NT)
	powershell -NoProfile -Command "$$ErrorActionPreference='SilentlyContinue'; Remove-Item -LiteralPath '$(FRONTEND_DIR)/node_modules','$(FRONTEND_DIR)/.next','$(BACKEND_DIR)/venv','$(BACKEND_DIR)/__pycache__' -Recurse -Force; exit 0"
else
	rm -rf $(FRONTEND_DIR)/node_modules $(FRONTEND_DIR)/.next
	rm -rf $(BACKEND_DIR)/venv $(BACKEND_DIR)/__pycache__
endif
	@echo "Clean done. Run 'make install' to reinstall."
