locals {
  safe_name = replace(var.name, "/", "-")
  default_tags = {
    Project   = "Websites"
    ManagedBy = "Terraform"
  }
}

data "archive_file" "lambda_zip" {
  type        = "zip"
  source_file = var.lambda_entry_path
  output_path = "${path.module}/${local.safe_name}-lambda.zip"
}

data "aws_iam_policy_document" "lambda_assume" {
  statement {
    effect = "Allow"
    principals {
      type        = "Service"
      identifiers = ["lambda.amazonaws.com"]
    }
    actions = ["sts:AssumeRole"]
  }
}

resource "aws_iam_role" "lambda" {
  name                 = "${local.safe_name}-lambda"
  assume_role_policy   = data.aws_iam_policy_document.lambda_assume.json

  tags = local.default_tags
}

resource "aws_iam_role_policy_attachment" "lambda_basic" {
  role       = aws_iam_role.lambda.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

resource "aws_iam_role_policy" "lambda_inline" {
  name   = "${local.safe_name}-lambda-inline"
  role   = aws_iam_role.lambda.id
  policy = var.iam_policy_json
}

resource "aws_lambda_function" "api" {
  function_name = "${local.safe_name}-api"
  role          = aws_iam_role.lambda.arn
  handler       = "handler.handler"
  runtime       = "nodejs18.x"

  filename         = data.archive_file.lambda_zip.output_path
  source_code_hash = data.archive_file.lambda_zip.output_base64sha256

  timeout     = 120
  memory_size = 512

  environment {
    variables = var.lambda_environment
  }

  tags = local.default_tags
}

data "aws_iam_policy_document" "lambda_self_invoke" {
  statement {
    effect = "Allow"
    actions = ["lambda:InvokeFunction"]
    resources = [aws_lambda_function.api.arn]
  }
}

resource "aws_iam_role_policy" "lambda_self_invoke" {
  name   = "${local.safe_name}-lambda-self-invoke"
  role   = aws_iam_role.lambda.id
  policy = data.aws_iam_policy_document.lambda_self_invoke.json
}

resource "aws_apigatewayv2_api" "api" {
  name          = "${local.safe_name}-api"
  protocol_type = "HTTP"

  cors_configuration {
    allow_headers = ["authorization", "content-type"]
    allow_methods = ["GET", "POST", "OPTIONS"]
    allow_origins = var.cors_allow_origins
    max_age       = 600
  }

  tags = local.default_tags
}

resource "aws_apigatewayv2_integration" "api" {
  api_id                 = aws_apigatewayv2_api.api.id
  integration_type       = "AWS_PROXY"
  integration_uri        = aws_lambda_function.api.invoke_arn
  payload_format_version = "2.0"
}

resource "aws_apigatewayv2_route" "routes" {
  for_each = toset(var.routes)

  api_id   = aws_apigatewayv2_api.api.id
  route_key = each.value
  target   = "integrations/${aws_apigatewayv2_integration.api.id}"
}

resource "aws_apigatewayv2_stage" "api" {
  api_id      = aws_apigatewayv2_api.api.id
  name        = "$default"
  auto_deploy = true
}

resource "aws_lambda_permission" "apigw" {
  statement_id  = "AllowApiGatewayInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.api.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.api.execution_arn}/*/*"
}

data "aws_route53_zone" "api" {
  name         = "${var.domain_zone_name}."
  private_zone = false
}

resource "aws_apigatewayv2_domain_name" "api" {
  domain_name = var.custom_domain_name

  domain_name_configuration {
    certificate_arn = var.certificate_arn
    endpoint_type   = "REGIONAL"
    security_policy = "TLS_1_2"
  }
}

resource "aws_apigatewayv2_api_mapping" "api" {
  api_id      = aws_apigatewayv2_api.api.id
  domain_name = aws_apigatewayv2_domain_name.api.id
  stage       = aws_apigatewayv2_stage.api.name
}

resource "aws_route53_record" "api_alias" {
  zone_id = data.aws_route53_zone.api.zone_id
  name    = var.custom_domain_name
  type    = "A"

  alias {
    name                   = aws_apigatewayv2_domain_name.api.domain_name_configuration[0].target_domain_name
    zone_id                = aws_apigatewayv2_domain_name.api.domain_name_configuration[0].hosted_zone_id
    evaluate_target_health = false
  }
}

resource "aws_route53_record" "api_alias_ipv6" {
  zone_id = data.aws_route53_zone.api.zone_id
  name    = var.custom_domain_name
  type    = "AAAA"

  alias {
    name                   = aws_apigatewayv2_domain_name.api.domain_name_configuration[0].target_domain_name
    zone_id                = aws_apigatewayv2_domain_name.api.domain_name_configuration[0].hosted_zone_id
    evaluate_target_health = false
  }
}
