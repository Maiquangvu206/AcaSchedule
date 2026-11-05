.PHONY: help dev prod down logs ps build clean

COMPOSE = docker compose
DEV_COMPOSE = $(COMPOSE) -f docker-compose.yml -f docker-compose.override.yml

help: ## Show available commands
	@grep -E '^[a-zA-Z_-]+:.*?## ' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-12s\033[0m %s\n", $$1, $$2}'

dev: ## Start all services in development mode (hot-reload)
	$(DEV_COMPOSE) up --build -d

prod: ## Start all services in production mode
	$(COMPOSE) up --build -d

down: ## Stop all services
	$(COMPOSE) down

logs: ## Tail logs from all services
	$(COMPOSE) logs -f

ps: ## Show running services
	$(COMPOSE) ps

build: ## Build all images without starting
	$(COMPOSE) build

clean: ## Stop services and remove volumes (destructive)
	$(COMPOSE) down -v --remove-orphans
