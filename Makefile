.PHONY: help install dev start proxy serve build build-prod build-demo demo test test-watch \
       lint clean map-icons check \
       docker-build docker-up docker-down docker-logs

# Default target
help: ## Show this help
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | \
		awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-15s\033[0m %s\n", $$1, $$2}'

# ---------------------------------------------------------------------------
# Setup
# ---------------------------------------------------------------------------

install: ## Install npm dependencies
	npm ci

# ---------------------------------------------------------------------------
# Development
# ---------------------------------------------------------------------------

dev: ## Start proxy server + Angular dev server (full stack)
	npm run dev

start: ## Start Angular dev server only
	npm start

proxy: ## Start proxy server only
	node proxy/server.js

serve: ## Start Angular dev server with proxy config
	npx ng serve --proxy-config proxy.conf.json

# ---------------------------------------------------------------------------
# Build
# ---------------------------------------------------------------------------

build: ## Build for production
	npx ng build

build-dev: ## Build for development (with source maps)
	npx ng build --configuration development

build-demo: ## Build the static demo for GitHub Pages
	npx ng build --configuration=demo

demo: build-demo ## Build demo and serve it locally at http://localhost:4300/ZureMap/
	@rm -rf dist/zuremap-demo-serve/ZureMap
	@mkdir -p dist/zuremap-demo-serve/ZureMap
	@cp -r dist/zuremap-demo/browser/. dist/zuremap-demo-serve/ZureMap/
	@echo "→  Demo: http://localhost:4300/ZureMap/"
	npx http-server dist/zuremap-demo-serve -p 4300 -c-1 --silent

# ---------------------------------------------------------------------------
# Test
# ---------------------------------------------------------------------------

test: ## Run unit tests (single run)
	npx ng test --watch=false

test-watch: ## Run unit tests in watch mode
	npx ng test

# ---------------------------------------------------------------------------
# Code quality
# ---------------------------------------------------------------------------

lint: ## Lint the project (if ng lint is configured)
	npx ng lint

# ---------------------------------------------------------------------------
# Utilities
# ---------------------------------------------------------------------------

map-icons: ## Regenerate icon mappings
	node scripts/map-icons.js

clean: ## Remove build artifacts and caches
	rm -rf dist/ dist/zuremap-demo-serve/ .angular/

check: node_modules ## Verify install is up-to-date then run tests
	npx ng build
	npx ng test --watch=false

# ---------------------------------------------------------------------------
# Docker
# ---------------------------------------------------------------------------

docker-build: ## Build the Docker image
	docker compose build

docker-up: ## Build and start the container
	docker compose up --build

docker-down: ## Stop and remove the container
	docker compose down

docker-logs: ## Tail container logs
	docker compose logs -f

# ---------------------------------------------------------------------------
# Internal / prerequisites
# ---------------------------------------------------------------------------

node_modules: package.json package-lock.json
	npm ci
	@touch node_modules
