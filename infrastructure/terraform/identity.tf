module "cognito" {
  source = "./modules/cognito"

  user_pool_name   = local.cognito_user_pool_name
  domain_name      = "auth.ahara.io"
  domain_zone_name = "ahara.io"
  clients          = local.cognito_clients
}
