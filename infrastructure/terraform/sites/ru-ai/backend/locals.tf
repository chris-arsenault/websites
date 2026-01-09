data "aws_region" "current" {}

locals {
  site_name           = "ru-ai"
  project_prefix      = "websites"
  resource_prefix     = "${local.project_prefix}-${local.site_name}"
  rate_limit_per_minute = 10
  bedrock_model_id    = "anthropic.claude-3-haiku-20240307-v1:0"
  default_tags = {
    Project   = "Websites"
    ManagedBy = "Terraform"
    Site      = local.site_name
  }
}
