data "aws_region" "current" {}

locals {
  ru_ai_site_name             = "ru-ai"
  ru_ai_project_prefix        = "websites"
  ru_ai_resource_prefix       = "${local.ru_ai_project_prefix}-${local.ru_ai_site_name}"
  ru_ai_api_name              = "${local.ru_ai_resource_prefix}-bedrock-proxy"
  ru_ai_rate_limit_per_minute = 10
  ru_ai_bedrock_model_id      = "anthropic.claude-3-haiku-20240307-v1:0"
  ru_ai_tags = {
    Project   = "Websites"
    ManagedBy = "Terraform"
    Site      = local.ru_ai_site_name
  }
}

resource "aws_dynamodb_table" "ru_ai_rate_limits" {
  name         = "${local.ru_ai_resource_prefix}-rate-limit"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "pk"

  attribute {
    name = "pk"
    type = "S"
  }

  ttl {
    attribute_name = "ttl"
    enabled        = true
  }

  tags = merge(local.ru_ai_tags, {
    Name = "${local.ru_ai_resource_prefix}-rate-limit"
  })
}

resource "aws_bedrock_inference_profile" "ru_ai_model_instance_profile" {
  name = "${local.ru_ai_resource_prefix}-instance-profile"

  model_source {
    copy_from = "arn:aws:bedrock:us-east-1::foundation-model/${local.ru_ai_bedrock_model_id}"
  }

  tags = merge(local.ru_ai_tags, {
    Name = "${local.ru_ai_resource_prefix}-instance-profile"
  })
}

data "aws_iam_policy_document" "ru_ai_lambda" {
  statement {
    sid    = "DynamoDBAccess"
    effect = "Allow"
    actions = [
      "dynamodb:PutItem",
      "dynamodb:GetItem",
      "dynamodb:UpdateItem",
      "dynamodb:DescribeTable"
    ]
    resources = [aws_dynamodb_table.ru_ai_rate_limits.arn]
  }

  statement {
    sid    = "InvokeBedrock"
    effect = "Allow"
    actions = [
      "bedrock:InvokeModel",
      "bedrock:InvokeModelWithResponseStream"
    ]
    resources = [
      "arn:aws:bedrock:${data.aws_region.current.id}::foundation-model/${local.ru_ai_bedrock_model_id}",
      aws_bedrock_inference_profile.ru_ai_model_instance_profile.arn
    ]
  }
}

module "ru_ai_api" {
  source = "./modules/api-http"

  name              = local.ru_ai_api_name
  lambda_entry_path = "${path.module}/../../apps/ru-ai.net/backend/handler.js"
  lambda_runtime    = "nodejs24.x"
  lambda_handler    = "handler.handler"
  lambda_environment = {
    TABLE_NAME            = aws_dynamodb_table.ru_ai_rate_limits.name
    RATE_LIMIT_PER_MINUTE = tostring(local.ru_ai_rate_limit_per_minute)
    MODEL_ID              = aws_bedrock_inference_profile.ru_ai_model_instance_profile.arn
    BEDROCK_REGION        = data.aws_region.current.id
  }
  iam_policy_json    = data.aws_iam_policy_document.ru_ai_lambda.json
  routes             = ["POST /invoke"]
  cors_allow_origins = ["*"]
  custom_domain_name = local.ru_ai_api_domain
  domain_zone_name   = local.ru_ai_domain_name
}

module "ru_ai_site" {
  source = "./modules/static-website"

  hostname            = local.ru_ai_hostname
  domain_name         = local.ru_ai_domain_name
  site_directory_path = "${path.module}/../../apps/ru-ai.net/static"
  runtime_config = {
    invoke_url = "https://${local.ru_ai_api_domain}/invoke"
  }
}
