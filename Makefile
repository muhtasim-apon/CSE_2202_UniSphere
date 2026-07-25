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
# GnuWin32 make (3.81) runs recipes through cmd.exe on Windows
# even when SHELL is set to bash, so install paths and the
# backend recipe use Windows-native backslashes there.
ifeq ($(OS),Windows_NT)
    PYTHON      := py -3
    # Paths relative to project root (used for install)
    PIP         := backend\venv\Scripts\pip.exe
    # Backend recipe is invoked via `cmd /c` so the shell that
    # actually runs it (cmd.exe) can resolve the relative path.
    # `python -m uvicorn` avoids needing uvicorn.exe on PATH.
    UVICORN     := venv\Scripts\python.exe
    UVI_ARGS    := -m uvicorn main:app --reload --host 0.0.0.0 --port 8000
    # npm.cmd avoids the "C:/Program Files/nodejs/npm" spaces issue
    NPM         := npm.cmd
    MKDIR       := mkdir
    # `cmd /c` lets the recipe run under cmd.exe regardless of
    # which shell the user invoked `make` from (PowerShell,
    # Git Bash, cmd, etc.).
    SHELL_CMD   := cmd /c
else
    PYTHON      := python3
    PIP         := backend/venv/bin/pip
    UVICORN     := venv/bin/uvicorn
    UVI_ARGS    := main:app --reload --host 0.0.0.0 --port 8000
    NPM         := npm
    MKDIR       := mkdir -p
    SHELL_CMD   := sh -c
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
	$(SHELL_CMD) "cd /d $(FRONTEND_DIR) && $(NPM) install"
	@echo "[frontend] Done."

install-backend: ## Create Python venv and install pip packages
	@echo "[backend] Creating Python virtual environment..."
	$(PYTHON) -m venv $(BACKEND_DIR)/venv
	@echo "[backend] Installing Python packages..."
	$(SHELL_CMD) "$(BACKEND_DIR)\\venv\\Scripts\\python.exe -m pip install --upgrade pip --quiet"
	$(SHELL_CMD) "$(BACKEND_DIR)\\venv\\Scripts\\python.exe -m pip install -r $(BACKEND_DIR)\\requirements.txt"
	@echo "[backend] Done."

# ── Dev servers ──────────────────────────────────────────────

run: ## Start both backend and frontend in parallel
	$(MAKE) -j2 backend frontend

frontend: ## Start the Next.js dev server (http://localhost:3000)
	@echo "[frontend] Starting Next.js..."
	cd $(FRONTEND_DIR) && $(NPM) run dev

backend: ## Start the FastAPI dev server (http://localhost:8000)
	@echo "[backend] Starting FastAPI..."
	@$(SHELL_CMD) "cd /d $(BACKEND_DIR) && $(UVICORN) $(UVI_ARGS)"

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
