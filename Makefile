.PHONY: ci terraform-fmt-check

ci: terraform-fmt-check

terraform-fmt-check:
	terraform fmt -check -recursive infrastructure/terraform/
