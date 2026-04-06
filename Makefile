.PHONY: ci terraform-fmt-check rust-fmt-check rust-clippy

ci: rust-fmt-check rust-clippy terraform-fmt-check

rust-fmt-check:
	cd apps/ru-ai.net/backend && cargo fmt -- --check

rust-clippy:
	cd apps/ru-ai.net/backend && cargo clippy --release -- -D warnings

terraform-fmt-check:
	terraform fmt -check -recursive infrastructure/terraform/
