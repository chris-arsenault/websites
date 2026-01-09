data "archive_file" "lambda_zip" {
  type        = "zip"
  source_file = var.lambda_source_path
  output_path = "${path.module}/lambda_function.zip"
}

resource "aws_lambda_function" "bedrock_proxy" {
  function_name = "${local.resource_prefix}-bedrock-proxy"
  role          = aws_iam_role.lambda_role.arn
  filename      = data.archive_file.lambda_zip.output_path
  source_code_hash = data.archive_file.lambda_zip.output_base64sha256
  handler       = "lambda_function.handler"
  runtime       = "python3.12"
  timeout       = 15
  memory_size   = 512

  environment {
    variables = {
      TABLE_NAME            = aws_dynamodb_table.rate_limits.name
      RATE_LIMIT_PER_MINUTE = tostring(local.rate_limit_per_minute)
      MODEL_ID              = aws_bedrock_inference_profile.model_instance_profile.arn
      BEDROCK_REGION        = data.aws_region.current.id
    }
  }

  depends_on = [data.archive_file.lambda_zip]

  tags = merge(local.default_tags, {
    Name = "${local.resource_prefix}-bedrock-proxy"
  })
}
