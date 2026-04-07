data "aws_region" "current" {}

locals {
  ru_ai_site_name             = "ru-ai"
  ru_ai_project_prefix        = "websites"
  ru_ai_resource_prefix       = "${local.ru_ai_project_prefix}-${local.ru_ai_site_name}"
  ru_ai_api_name              = "${local.ru_ai_resource_prefix}-bedrock-proxy"
  ru_ai_rate_limit_per_minute = 10
  ru_ai_bedrock_model_id      = "anthropic.claude-3-haiku-20240307-v1:0"
}

# =============================================================================
# Shared resources (DynamoDB, Bedrock)
# =============================================================================

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
}

resource "aws_bedrock_inference_profile" "ru_ai_model_instance_profile" {
  name = "${local.ru_ai_resource_prefix}-instance-profile"

  model_source {
    copy_from = "arn:aws:bedrock:us-east-1::foundation-model/${local.ru_ai_bedrock_model_id}"
  }
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

# =============================================================================
# Static website (shared module)
# =============================================================================

module "ru_ai_site" {
  source = "git::https://github.com/chris-arsenault/ahara-tf-patterns.git//modules/website"

  prefix         = local.ru_ai_resource_prefix
  hostname       = local.ru_ai_hostname
  site_directory = "${path.module}/../../apps/ru-ai.net/static"
  encrypt        = false
  runtime_config = {
    invoke_url = "https://${local.ru_ai_api_domain}/invoke"
  }
}

# =============================================================================
# API (shared ALB module)
# =============================================================================

module "ru_ai_api" {
  source = "git::https://github.com/chris-arsenault/ahara-tf-patterns.git//modules/alb-api"

  prefix   = local.ru_ai_resource_prefix
  hostname = local.ru_ai_api_domain

  iam_policy = [data.aws_iam_policy_document.ru_ai_lambda.json]

  environment = {
    TABLE_NAME            = aws_dynamodb_table.ru_ai_rate_limits.name
    RATE_LIMIT_PER_MINUTE = tostring(local.ru_ai_rate_limit_per_minute)
    MODEL_ID              = aws_bedrock_inference_profile.ru_ai_model_instance_profile.arn
    BEDROCK_REGION        = data.aws_region.current.id
  }

  lambdas = {
    proxy = {
      binary = "${path.module}/../../apps/ru-ai.net/backend/target/lambda/proxy/bootstrap"
      routes = [
        {
          priority      = 201
          paths         = ["/invoke"]
          methods       = ["POST", "OPTIONS"]
          authenticated = false
        }
      ]
    }
  }
}
