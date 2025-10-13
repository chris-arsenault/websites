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

resource "aws_iam_role" "lambda_role" {
  name               = "${local.resource_prefix}-bedrock-proxy-lambda-role"
  assume_role_policy = data.aws_iam_policy_document.lambda_assume.json


  tags = merge(local.default_tags, {
    Name = "${local.resource_prefix}-bedrock-proxy-lambda-role"
  })
}

# CloudWatch Logs managed policy
resource "aws_iam_role_policy_attachment" "lambda_basic_logs" {
  role       = aws_iam_role.lambda_role.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

# Inline policy: DynamoDB + Bedrock
data "aws_iam_policy_document" "lambda_inline" {
  statement {
    sid    = "DynamoDBAccess"
    effect = "Allow"
    actions = [
      "dynamodb:PutItem",
      "dynamodb:GetItem",
      "dynamodb:UpdateItem",
      "dynamodb:DescribeTable"
    ]
    resources = [aws_dynamodb_table.rate_limits.arn]
  }

  statement {
    sid    = "InvokeBedrock"
    effect = "Allow"
    actions = [
      "bedrock:InvokeModel",
      "bedrock:InvokeModelWithResponseStream"
    ]
    # Scope down to the chosen model in this region; widen if you support multiple
    resources = [
      "arn:aws:bedrock:${var.aws_region}::foundation-model/${var.bedrock_model_id}",
      aws_bedrock_inference_profile.model_instance_profile.arn
    ]
  }
}


resource "aws_iam_policy" "lambda_policy" {
  name   = "${local.resource_prefix}-bedrock-proxy-lambda-policy"
  policy = data.aws_iam_policy_document.lambda_inline.json

  tags = merge(local.default_tags, {
    Name = "${local.resource_prefix}-bedrock-proxy-lambda-policy"
  })
}

resource "aws_iam_role_policy_attachment" "lambda_inline_attach" {
  role       = aws_iam_role.lambda_role.name
  policy_arn = aws_iam_policy.lambda_policy.arn
}
