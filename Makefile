SHELL        := cmd.exe
.SHELLFLAGS  := /c

FRONTEND_DIR := frontend
BACKEND_DIR  := backend
VENV         := $(BACKEND_DIR)\venv
PYTHON       := python

CLEAN_CMD := powershell -NoProfile -Command "$$ErrorActionPreference='SilentlyContinue'; Remove-Item -LiteralPath '$(FRONTEND_DIR)/node_modules','$(FRONTEND_DIR)/.next','$(VENV)','$(BACKEND_DIR)/__pycache__' -Recurse -Force; exit 0"

.PHONY: help install install-frontend install-backend run frontend backend clean

help: ## Show this help message
	@powershell -NoProfile -Command "Write-Host 'Available targets:'; Select-String -Path '$(firstword $(MAKEFILE_LIST))' -Pattern '^[a-zA-Z_-]+:.*?## .*$$' | ForEach-Object { $$parts = $$_.Line -split ':.*?## '; Write-Host ('  ' + $$parts[0].PadRight(18) + ' ' + $$parts[1]) }"

install: install-frontend install-backend ## Install all frontend and backend dependencies

install-frontend: ## Install frontend (Next.js) dependencies
	cd $(FRONTEND_DIR) && npm install

install-backend: ## Create venv and install backend (FastAPI) dependencies
	$(PYTHON) -m venv $(VENV)
	$(VENV)\Scripts\python.exe -m pip install --upgrade pip
	$(VENV)\Scripts\python.exe -m pip install -r $(BACKEND_DIR)\requirements.txt

run: ## Run frontend and backend together
	$(MAKE) -j2 backend frontend

frontend: ## Start the Next.js dev server (http://localhost:3000)
	cd $(FRONTEND_DIR) && npm run dev

backend: ## Start the FastAPI dev server (http://localhost:8000)
	cd $(BACKEND_DIR) && venv\Scripts\uvicorn.exe main:app --reload

clean: ## Remove installed dependencies and build artifacts
	$(CLEAN_CMD)

.DEFAULT_GOAL := help
