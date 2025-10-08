locals {
  file_hash = filemd5("${path.module}/lambda_function.py")
}
data "archive_file" "lambda_zip" {
  type        = "zip"
  source_file = "${path.module}/lambda_function.py"
  output_path = "${path.module}/lambda_function-${local.file_hash}.zip"
}

resource "aws_lambda_function" "bedrock_proxy" {
  function_name = "${var.project_name}-bedrock-proxy"
  role          = aws_iam_role.lambda_role.arn
  filename      = data.archive_file.lambda_zip.output_path
  handler       = "lambda_function.handler"
  runtime       = "python3.12"
  timeout       = 15
  memory_size   = 512

  environment {
    variables = {
      TABLE_NAME            = aws_dynamodb_table.rate_limits.name
      RATE_LIMIT_PER_MINUTE = tostring(var.rate_limit_per_minute)
      MODEL_ID              = aws_bedrock_inference_profile.model_instance_profile.arn
      BEDROCK_REGION        = var.aws_region
    }
  }

  depends_on = [data.archive_file.lambda_zip]

  tags = var.tags
}