module "ru_ai_backend" {
  source = "./sites/ru-ai/backend"

  lambda_source_path      = "${path.module}/../../apps/ru-ai.net/backend/lambda_function.py"
}

module "ru_ai_site" {
  source = "./modules/static-website"

  hostname            = local.ru_ai_hostname
  domain_name         = local.ru_ai_domain_name
  site_directory_path = "${path.module}/../../apps/ru-ai.net/static"
  runtime_config = {
    invoke_url = module.ru_ai_backend.invoke_url
  }
}

module "ahara_site" {
  source = "./modules/static-website"

  hostname            = local.ahara_hostname
  domain_name         = local.ahara_domain_name
  site_directory_path = "${path.module}/../../apps/ahara.io/static"
}

module "hotsauce_media" {
  source = "./modules/s3-media"

  bucket_name = local.hotsauce_media_bucket
}

module "hotsauce_table" {
  source = "./modules/dynamo-table"

  name     = local.hotsauce_table_name
  hash_key = "id"
}

data "aws_secretsmanager_secret_version" "tavily" {
  secret_id = "tavily/dev"
}

data "aws_route53_zone" "hotsauce" {
  name         = "${local.hotsauce_domain_name}."
  private_zone = false
}

resource "aws_acm_certificate" "hotsauce" {
  domain_name               = local.hotsauce_hostname
  subject_alternative_names = [local.hotsauce_api_domain]
  validation_method         = "DNS"
}

resource "aws_route53_record" "hotsauce_cert_validation" {
  for_each = toset([
    local.hotsauce_hostname,
    local.hotsauce_api_domain
  ])

  zone_id = data.aws_route53_zone.hotsauce.zone_id
  name = one([
    for dvo in aws_acm_certificate.hotsauce.domain_validation_options : dvo.resource_record_name
    if dvo.domain_name == each.value
  ])
  type = one([
    for dvo in aws_acm_certificate.hotsauce.domain_validation_options : dvo.resource_record_type
    if dvo.domain_name == each.value
  ])
  ttl     = 300
  records = [one([
    for dvo in aws_acm_certificate.hotsauce.domain_validation_options : dvo.resource_record_value
    if dvo.domain_name == each.value
  ])]
}

resource "aws_acm_certificate_validation" "hotsauce" {
  certificate_arn         = aws_acm_certificate.hotsauce.arn
  validation_record_fqdns = [for record in aws_route53_record.hotsauce_cert_validation : record.fqdn]
}

data "aws_iam_policy_document" "hotsauce_lambda" {
  statement {
    actions = [
      "dynamodb:GetItem",
      "dynamodb:PutItem",
      "dynamodb:Scan"
    ]
    resources = [module.hotsauce_table.arn]
  }

  statement {
    actions = [
      "s3:PutObject",
      "s3:GetObject"
    ]
    resources = ["${module.hotsauce_media.arn}/*"]
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

module "hotsauce_api" {
  source = "./modules/lambda-api"

  name                = local.hotsauce_name_prefix
  lambda_entry_path   = "${path.module}/../../apps/hotsauce/backend/dist/handler.js"
  lambda_environment = {
    TABLE_NAME            = module.hotsauce_table.name
    MEDIA_BUCKET          = module.hotsauce_media.bucket
    PUBLIC_MEDIA_BASE_URL = "https://${module.hotsauce_media.bucket}.s3.amazonaws.com"
    COGNITO_USER_POOL_ID  = module.cognito.user_pool_id
    COGNITO_CLIENT_ID     = module.cognito.client_ids["hotsauce"]
    ALLOWED_ORIGINS       = join(",", local.hotsauce_allowed_origins)
    TAVILY_API_KEY        = data.aws_secretsmanager_secret_version.tavily.secret_string
  }
  iam_policy_json       = data.aws_iam_policy_document.hotsauce_lambda.json
  routes                = ["GET /tastings", "POST /tastings"]
  cors_allow_origins     = local.hotsauce_allowed_origins
  custom_domain_name     = local.hotsauce_api_domain
  domain_zone_name       = local.hotsauce_domain_name
  certificate_arn        = aws_acm_certificate.hotsauce.arn

  depends_on = [aws_acm_certificate_validation.hotsauce]
}

module "hotsauce_site" {
  source = "./modules/spa-website"

  hostname            = local.hotsauce_hostname
  domain_name         = local.hotsauce_domain_name
  site_directory_path = "${path.module}/../../apps/hotsauce/frontend/dist"
  bucket_name         = local.hotsauce_frontend_bucket
  certificate_arn     = aws_acm_certificate.hotsauce.arn
  runtime_config = {
    apiBaseUrl        = "https://${local.hotsauce_api_domain}"
    cognitoUserPoolId = module.cognito.user_pool_id
    cognitoClientId   = module.cognito.client_ids["hotsauce"]
  }

  depends_on = [aws_acm_certificate_validation.hotsauce]
}
