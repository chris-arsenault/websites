module "scorchbook_media" {
  source = "./modules/s3-media"

  bucket_name = local.scorchbook_media_bucket
}

module "scorchbook_table" {
  source = "./modules/dynamo-table"

  name     = local.scorchbook_table_name
  hash_key = "id"
}

data "aws_secretsmanager_secret_version" "tavily" {
  secret_id = "tavily/dev"
}

data "aws_iam_policy_document" "scorchbook_lambda" {
  statement {
    actions = [
      "dynamodb:GetItem",
      "dynamodb:DeleteItem",
      "dynamodb:PutItem",
      "dynamodb:Scan"
    ]
    resources = [module.scorchbook_table.arn]
  }

  statement {
    actions = [
      "s3:PutObject",
      "s3:GetObject"
    ]
    resources = ["${module.scorchbook_media.arn}/*"]
  }

  statement {
    actions   = ["bedrock:InvokeModel"]
    resources = ["*"]
  }

  statement {
    actions = [
      "transcribe:StartTranscriptionJob",
      "transcribe:GetTranscriptionJob"
    ]
    resources = ["*"]
  }
}

module "scorchbook_api" {
  source = "./modules/api-http"

  name              = local.scorchbook_name_prefix
  lambda_entry_path = "${path.module}/../../apps/scorchbook/backend/dist/handler.js"
  lambda_runtime    = "nodejs18.x"
  lambda_handler    = "handler.handler"
  lambda_environment = {
    TABLE_NAME            = module.scorchbook_table.name
    MEDIA_BUCKET          = module.scorchbook_media.bucket
    PUBLIC_MEDIA_BASE_URL = "https://${module.scorchbook_media.bucket}.s3.amazonaws.com"
    COGNITO_USER_POOL_ID  = module.cognito.user_pool_id
    COGNITO_CLIENT_ID     = module.cognito.client_ids["scorchbook"]
    ALLOWED_ORIGINS       = join(",", local.scorchbook_allowed_origins)
    TAVILY_API_KEY        = data.aws_secretsmanager_secret_version.tavily.secret_string
  }
  iam_policy_json    = data.aws_iam_policy_document.scorchbook_lambda.json
  routes             = ["GET /tastings", "POST /tastings", "POST /tastings/{id}/rerun", "DELETE /tastings/{id}"]
  cors_allow_origins = local.scorchbook_allowed_origins
  custom_domain_name = local.scorchbook_api_domain
  domain_zone_name   = local.scorchbook_domain_name
}

module "scorchbook_site" {
  source = "./modules/spa-website"

  hostname            = local.scorchbook_hostname
  domain_name         = local.scorchbook_domain_name
  site_directory_path = "${path.module}/../../apps/scorchbook/frontend/dist"
  bucket_name         = local.scorchbook_frontend_bucket
  runtime_config = {
    apiBaseUrl        = "https://${local.scorchbook_api_domain}"
    cognitoUserPoolId = module.cognito.user_pool_id
    cognitoClientId   = module.cognito.client_ids["scorchbook"]
  }
}
