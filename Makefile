.PHONY: lint lint-fix format format-check typecheck terraform-fmt terraform-fmt-check

lint:
	pnpm exec eslint .
lint-fix:
	pnpm exec eslint . --fix
format:
	pnpm exec prettier --write .
format-check:
	pnpm exec prettier --check .
typecheck:
	cd apps/ahara.io && pnpm exec tsc --noEmit
	cd apps/ahara.io/backend && pnpm exec tsc --noEmit
	cd apps/scorchbook/frontend && pnpm exec tsc --noEmit
	cd apps/auth-trigger && pnpm exec tsc --noEmit
terraform-fmt:
	cd infrastructure/terraform && terraform fmt -recursive
terraform-fmt-check:
	cd infrastructure/terraform && terraform fmt -check -recursive
