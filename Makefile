# ============================================
# WISDOM CHURCH ADMIN PANEL - DOCKER MAKEFILE
# ============================================
# Usage: make <target>
# Run `make help` (or just `make`) to list all available targets.
#
# Environment variables used by the dev/prod profiles (docker-compose.yml)
# and the production image build (Dockerfile):
#   API_INTERNAL_URL       Backend URL reachable from inside the dev container
#                          (default in docker-compose.yml: http://wisdom_api:8080)
#   NEXT_PUBLIC_API_URL    Public backend URL exposed to the browser
#   NEXT_PUBLIC_BACKEND_URL, NEXT_PUBLIC_API_PROXY, APP_ADMIN_PORTAL_URL
#                          Build-time args for the production image (see Dockerfile);
#                          all have safe defaults and are only overridden for
#                          non-default deployments.
# This app has no database of its own - the `migrate` service/./migrations
# volume belongs to the separate backend repository, not this one.

# ============================================
# VARIABLES & CONFIGURATION
# ============================================
PROJECT_NAME := wisdomchurch-admin
DEV_PROFILE := dev
PROD_PROFILE := prod
NEXTJS_SERVICE := nextjs-app
NGINX_SERVICE := nginx

# Docker Compose file
COMPOSE_FILE := docker-compose.yml

# ============================================
# DEVELOPMENT COMMANDS
# ============================================
.PHONY: dev
dev: ## Start development environment with hot reload (attached)
	@echo "🚀 Starting development environment with hot reload..."
	docker compose --profile $(DEV_PROFILE) up --build

.PHONY: dev-detach
dev-detach: ## Start development environment in background
	@echo "🚀 Starting development environment in background..."
	docker compose --profile $(DEV_PROFILE) up --build -d
	@echo "📊 Use 'make logs-dev' to view logs"

.PHONY: dev-fresh
dev-fresh: ## Fresh development build without cache
	@echo "🔄 Starting fresh development build (no cache)..."
	docker compose --profile $(DEV_PROFILE) build --no-cache
	docker compose --profile $(DEV_PROFILE) up -d
	@echo "📊 Use 'make logs-dev' to view logs"

.PHONY: logs-dev
logs-dev: ## View development logs
	@echo "📋 Showing development logs..."
	docker compose --profile $(DEV_PROFILE) logs -f

.PHONY: shell
shell: ## Open shell in development container
	@echo "🐚 Opening shell in development container..."
	docker compose --profile $(DEV_PROFILE) exec $(NEXTJS_SERVICE) sh

# ============================================
# PRODUCTION COMMANDS
# ============================================
.PHONY: prod
prod: ## Start production environment (attached)
	@echo "🏗️  Starting production environment..."
	docker compose --profile $(PROD_PROFILE) up --build

.PHONY: prod-detach
prod-detach: ## Start production environment in background
	@echo "🏗️  Starting production environment in background..."
	docker compose --profile $(PROD_PROFILE) up --build -d
	@echo "📊 Use 'make logs-prod' to view logs"

.PHONY: prod-fresh
prod-fresh: ## Fresh production build without cache
	@echo "🔄 Starting fresh production build (no cache)..."
	docker compose --profile $(PROD_PROFILE) up --build --no-cache -d
	@echo "📊 Use 'make logs-prod' to view logs"

.PHONY: logs-prod
logs-prod: ## View production logs
	@echo "📋 Showing production logs..."
	docker compose --profile $(PROD_PROFILE) logs -f

# ============================================
# BUILD & DEPLOYMENT
# ============================================
.PHONY: build
build: ## Build all images (development and production)
	@echo "🔨 Building development image..."
	docker compose --profile $(DEV_PROFILE) build
	@echo "🔨 Building production image..."
	docker compose --profile $(PROD_PROFILE) build

.PHONY: build-prod
build-prod: ## Build only production image
	@echo "🔨 Building production image..."
	docker compose --profile $(PROD_PROFILE) build

.PHONY: push
push: ## Push images to registry (configure registry first)
	@echo "📤 Pushing images to registry..."
	@echo "⚠️  Configure your registry in docker-compose.yml first!"
	# docker compose --profile $(PROD_PROFILE) push

# ============================================
# MAINTENANCE & CLEANUP
# ============================================
.PHONY: stop
stop: ## Stop all running containers
	@echo "🛑 Stopping all containers..."
	docker compose --profile $(DEV_PROFILE) down
	docker compose --profile $(PROD_PROFILE) down

.PHONY: clean
clean: stop ## Stop containers and remove volumes
	@echo "🧹 Stopping containers and removing volumes..."
	docker compose --profile $(DEV_PROFILE) down -v
	docker compose --profile $(PROD_PROFILE) down -v

.PHONY: purge
purge: clean ## Full cleanup: stop, remove containers, images, volumes
	@echo "💥 Full system purge..."
	docker system prune -a --volumes -f

.PHONY: status
status: ## Show container status
	@echo "📊 Development containers:"
	docker compose --profile $(DEV_PROFILE) ps
	@echo ""
	@echo "📊 Production containers:"
	docker compose --profile $(PROD_PROFILE) ps

# ============================================
# UTILITIES
# ============================================
.PHONY: npm
npm: ## Run npm command in development container (make npm ARGS="install package")
	@docker compose --profile $(DEV_PROFILE) exec $(NEXTJS_SERVICE) npm $(ARGS)

.PHONY: npm-prod
npm-prod: ## Run npm command in production container
	@docker compose --profile $(PROD_PROFILE) exec $(NEXTJS_SERVICE)-prod npm $(ARGS)

.PHONY: lint
lint: ## Run ESLint in development container
	@docker compose --profile $(DEV_PROFILE) exec $(NEXTJS_SERVICE) npm run lint

.PHONY: test
test: ## Run tests in development container
	@docker compose --profile $(DEV_PROFILE) exec $(NEXTJS_SERVICE) npm test

# ============================================
# HELP & INFO
# ============================================
.PHONY: help
help: ## Show this help message
	@echo "╔══════════════════════════════════════════════════════════════════════╗"
	@echo "║              WISDOM CHURCH ADMIN PANEL - MAKE COMMANDS              ║"
	@echo "╠══════════════════════════════════════════════════════════════════════╣"
	@echo "║ Usage: make <target>                                                ║"
	@echo "╠══════════════════════════════════════════════════════════════════════╣"
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | \
		awk 'BEGIN {FS = ":.*?## "}; {printf "║ \033[36m%-20s\033[0m %s\n", $$1, $$2}' | \
		sort | \
		sed 's/^/║ /'
	@echo "╚══════════════════════════════════════════════════════════════════════╝"

.PHONY: version
version: ## Show Docker and Compose versions
	@echo "Docker version:"
	docker --version
	@echo ""
	@echo "Docker Compose version:"
	docker compose version

# ============================================
# DEFAULT TARGET
# ============================================
.DEFAULT_GOAL := help