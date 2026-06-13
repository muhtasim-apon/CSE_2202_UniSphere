FRONTEND_DIR := frontend
BACKEND_DIR  := backend
VENV         := $(BACKEND_DIR)/venv
PYTHON       := python3

.PHONY: help install install-frontend install-backend run frontend backend clean

help: ## Show this help message
	@echo "Available targets:"
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-18s\033[0m %s\n", $$1, $$2}'

install: install-frontend install-backend ## Install all frontend and backend dependencies

install-frontend: ## Install frontend (Next.js) dependencies
	cd $(FRONTEND_DIR) && npm install

install-backend: ## Create venv and install backend (FastAPI) dependencies
	$(PYTHON) -m venv $(VENV)
	$(VENV)/bin/pip install --upgrade pip
	$(VENV)/bin/pip install -r $(BACKEND_DIR)/requirements.txt

run: ## Run frontend and backend together
	$(MAKE) -j2 backend frontend

frontend: ## Start the Next.js dev server (http://localhost:3000)
	cd $(FRONTEND_DIR) && npm run dev

backend: ## Start the FastAPI dev server (http://localhost:8000)
	cd $(BACKEND_DIR) && ./venv/bin/uvicorn main:app --reload

clean: ## Remove installed dependencies and build artifacts
	rm -rf $(FRONTEND_DIR)/node_modules $(FRONTEND_DIR)/.next $(VENV) $(BACKEND_DIR)/__pycache__

.DEFAULT_GOAL := help
