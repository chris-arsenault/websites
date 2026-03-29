locals {
  ahara_hostname    = "ahara.io"
  ahara_domain_name = "ahara.io"

  stack_atlas_domain_name = local.ahara_domain_name
  stack_atlas_hostname    = "stack-atlas.${local.stack_atlas_domain_name}"

  ru_ai_hostname    = "ru-ai.net"
  ru_ai_domain_name = "ru-ai.net"
  ru_ai_api_domain  = "api.${local.ru_ai_domain_name}"

  ahara_api_domain      = "api.${local.ahara_domain_name}"
  ahara_frontend_bucket = "ahara-io-frontend"
  ahara_allowed_origins = [
    "http://localhost:5173",
    "https://${local.ahara_hostname}"
  ]
}
