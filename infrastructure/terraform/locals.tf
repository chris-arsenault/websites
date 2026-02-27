locals {
  ahara_hostname    = "ahara.io"
  ahara_domain_name = "ahara.io"

  stack_atlas_domain_name = local.ahara_domain_name
  stack_atlas_hostname    = "stack-atlas.${local.stack_atlas_domain_name}"

  ru_ai_hostname    = "ru-ai.net"
  ru_ai_domain_name = "ru-ai.net"
  ru_ai_api_domain  = "api.${local.ru_ai_domain_name}"

  scorchbook_domain_name = "ahara.io"
  scorchbook_hostname    = "sauce.${local.scorchbook_domain_name}"
  scorchbook_api_domain  = "sauce-api.${local.scorchbook_domain_name}"
  scorchbook_allowed_origins = [
    "http://localhost:5173",
    "https://${local.scorchbook_hostname}"
  ]

  scorchbook_name_prefix     = "scorchbook-ffcf7631"
  scorchbook_frontend_bucket = "${local.scorchbook_name_prefix}-frontend"
  scorchbook_media_bucket    = "${local.scorchbook_name_prefix}-media"
  scorchbook_table_name      = "${local.scorchbook_name_prefix}-tastings"

  cognito_user_pool_name = "${local.scorchbook_name_prefix}-users"
  cognito_clients = {
    scorchbook = "${local.scorchbook_name_prefix}-app"
    svap       = "svap-app"
  }
}
