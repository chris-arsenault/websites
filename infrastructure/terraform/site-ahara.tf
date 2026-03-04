data "aws_iam_policy_document" "ahara_lambda" {
  statement {
    actions = [
      "dynamodb:GetItem",
      "dynamodb:PutItem",
      "dynamodb:DeleteItem",
      "dynamodb:Scan"
    ]
    resources = [module.user_access_table.arn]
  }

  statement {
    actions = [
      "cognito-idp:AdminCreateUser",
      "cognito-idp:AdminDisableUser",
      "cognito-idp:AdminEnableUser",
      "cognito-idp:ListUsers"
    ]
    resources = [module.cognito.user_pool_arn]
  }
}

module "ahara_api" {
  source = "./modules/api-http"

  name              = "ahara-io"
  lambda_entry_path = "${path.module}/../../apps/ahara.io/backend/dist/handler.js"
  lambda_runtime    = "nodejs24.x"
  lambda_handler    = "handler.handler"
  lambda_environment = {
    TABLE_NAME           = module.user_access_table.name
    COGNITO_USER_POOL_ID = module.cognito.user_pool_id
    COGNITO_CLIENT_ID    = module.cognito.client_ids["ahara"]
    ALLOWED_ORIGINS      = join(",", local.ahara_allowed_origins)
  }
  iam_policy_json    = data.aws_iam_policy_document.ahara_lambda.json
  routes             = ["GET /users", "PUT /users/{username}", "DELETE /users/{username}"]
  cors_allow_origins = local.ahara_allowed_origins
  custom_domain_name = local.ahara_api_domain
  domain_zone_name   = local.ahara_domain_name
}

module "ahara_site" {
  source = "./modules/spa-website"

  hostname            = local.ahara_hostname
  domain_name         = local.ahara_domain_name
  site_directory_path = "${path.module}/../../apps/ahara.io/dist"
  bucket_name         = local.ahara_frontend_bucket
  runtime_config = {
    apiBaseUrl        = "https://${local.ahara_api_domain}"
    cognitoUserPoolId = module.cognito.user_pool_id
    cognitoClientId   = module.cognito.client_ids["ahara"]
  }
}
