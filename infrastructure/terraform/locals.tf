locals {
  ahara_hostname    = "ahara.io"
  ahara_domain_name = "ahara.io"

  ru_ai_hostname    = "ru-ai.net"
  ru_ai_domain_name = "ru-ai.net"
  ru_ai_api_domain  = "api.${local.ru_ai_domain_name}"

  hotsauce_domain_name = "ahara.io"
  hotsauce_hostname    = "sauce.${local.hotsauce_domain_name}"
  hotsauce_api_domain  = "sauce-api.${local.hotsauce_domain_name}"
  hotsauce_allowed_origins = [
    "http://localhost:5173",
    "https://${local.hotsauce_hostname}"
  ]

  hotsauce_name_prefix     = "hotsauce-ffcf7631"
  hotsauce_frontend_bucket = "${local.hotsauce_name_prefix}-frontend"
  hotsauce_media_bucket    = "${local.hotsauce_name_prefix}-media"
  hotsauce_table_name      = "${local.hotsauce_name_prefix}-tastings"

  cognito_user_pool_name = "${local.hotsauce_name_prefix}-users"
  cognito_clients = {
    hotsauce = "${local.hotsauce_name_prefix}-app"
  }
}
