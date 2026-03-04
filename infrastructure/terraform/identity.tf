module "cognito" {
  source = "./modules/cognito"

  user_pool_name      = local.cognito_user_pool_name
  domain_name         = "auth.ahara.io"
  domain_zone_name    = "ahara.io"
  clients             = local.cognito_clients
  pre_auth_lambda_arn = aws_lambda_function.auth_trigger.arn
}

module "user_access_table" {
  source = "./modules/dynamo-table"

  name     = local.user_access_table_name
  hash_key = "username"
}

resource "aws_dynamodb_table_item" "seed_user" {
  table_name = module.user_access_table.name
  hash_key   = "username"

  item = jsonencode({
    username    = { S = "chris" }
    displayName = { S = "Chris" }
    apps = { M = {
      scorchbook = { S = "admin" }
      svap       = { S = "admin" }
      canonry    = { S = "admin" }
      ahara      = { S = "admin" }
    } }
  })

  lifecycle {
    ignore_changes = [item]
  }
}
