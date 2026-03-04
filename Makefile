.PHONY: lint lint-fix format format-check typecheck terraform-fmt terraform-fmt-check

lint: lint-ahara lint-ahara-backend lint-scorchbook-frontend lint-scorchbook-backend lint-auth-trigger
lint-fix: lint-fix-ahara lint-fix-ahara-backend lint-fix-scorchbook-frontend lint-fix-scorchbook-backend lint-fix-auth-trigger
format-check: format-check-ahara format-check-scorchbook-frontend format-check-scorchbook-backend format-check-ahara-backend format-check-auth-trigger
typecheck: typecheck-ahara typecheck-ahara-backend typecheck-scorchbook-frontend typecheck-scorchbook-backend typecheck-auth-trigger

# ahara.io frontend
lint-ahara:
	cd apps/ahara.io && npx eslint .
lint-fix-ahara:
	cd apps/ahara.io && npx eslint . --fix
format-check-ahara:
	cd apps/ahara.io && npx prettier --check src/
typecheck-ahara:
	cd apps/ahara.io && npx tsc --noEmit

# ahara.io backend
lint-ahara-backend:
	cd apps/ahara.io/backend && npx eslint .
lint-fix-ahara-backend:
	cd apps/ahara.io/backend && npx eslint . --fix
format-check-ahara-backend:
	cd apps/ahara.io/backend && npx prettier --check src/
typecheck-ahara-backend:
	cd apps/ahara.io/backend && npx tsc --noEmit

# scorchbook frontend
lint-scorchbook-frontend:
	cd apps/scorchbook/frontend && npx eslint .
lint-fix-scorchbook-frontend:
	cd apps/scorchbook/frontend && npx eslint . --fix
format-check-scorchbook-frontend:
	cd apps/scorchbook/frontend && npx prettier --check src/
typecheck-scorchbook-frontend:
	cd apps/scorchbook/frontend && npx tsc --noEmit

# scorchbook backend
lint-scorchbook-backend:
	cd apps/scorchbook/backend && npx eslint .
lint-fix-scorchbook-backend:
	cd apps/scorchbook/backend && npx eslint . --fix
format-check-scorchbook-backend:
	cd apps/scorchbook/backend && npx prettier --check src/
typecheck-scorchbook-backend:
	cd apps/scorchbook/backend && npx tsc --noEmit

# auth-trigger
lint-auth-trigger:
	cd apps/auth-trigger && npx eslint .
lint-fix-auth-trigger:
	cd apps/auth-trigger && npx eslint . --fix
format-check-auth-trigger:
	cd apps/auth-trigger && npx prettier --check src/
typecheck-auth-trigger:
	cd apps/auth-trigger && npx tsc --noEmit

# terraform
terraform-fmt:
	cd infrastructure/terraform && terraform fmt -recursive
terraform-fmt-check:
	cd infrastructure/terraform && terraform fmt -check -recursive
