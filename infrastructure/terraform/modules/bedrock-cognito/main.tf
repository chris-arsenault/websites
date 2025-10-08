# # modules/bedrock-verification/variables.tf
#
#
#
# # modules/bedrock-verification/main.tf
#
#
# # Attach the role to the identity pool
#
# # CloudWatch Log Group for monitoring Bedrock usage (optional)
# resource "aws_cloudwatch_log_group" "bedrock_logs" {
#   name              = "/aws/bedrock/${var.project_name}"
#   retention_in_days = 7
#
#   tags = merge(var.tags, {
#     Name = "${var.project_name}-bedrock-logs"
#   })
# }
#
# # IAM role for Lambda (if needed for additional processing)
# resource "aws_iam_role" "lambda_execution" {
#   name = "${var.project_name}-lambda-execution"
#
#   assume_role_policy = jsonencode({
#     Version = "2012-10-17"
#     Statement = [
#       {
#         Effect = "Allow"
#         Principal = {
#           Service = "lambda.amazonaws.com"
#         }
#         Action = "sts:AssumeRole"
#       }
#     ]
#   })
#
#   tags = merge(var.tags, {
#     Name = "${var.project_name}-lambda-execution"
#   })
# }
#
# # Lambda execution policy
# resource "aws_iam_role_policy_attachment" "lambda_basic" {
#   role       = aws_iam_role.lambda_execution.name
#   policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
# }
#
# # Lambda policy for Bedrock access
# resource "aws_iam_role_policy" "lambda_bedrock" {
#   name = "${var.project_name}-lambda-bedrock"
#   role = aws_iam_role.lambda_execution.id
#
#   policy = jsonencode({
#     Version = "2012-10-17"
#     Statement = [
#       {
#         Effect = "Allow"
#         Action = [
#           "bedrock:InvokeModel",
#           "bedrock:InvokeModelWithResponseStream"
#         ]
#         Resource = [
#           "arn:aws:bedrock:*::foundation-model/${var.bedrock_model_id}"
#         ]
#       },
#       {
#         Effect = "Allow"
#         Action = [
#           "logs:CreateLogGroup",
#           "logs:CreateLogStream",
#           "logs:PutLogEvents"
#         ]
#         Resource = "${aws_cloudwatch_log_group.bedrock_logs.arn}:*"
#       }
#     ]
#   })
# }
#
# # DynamoDB table for rate limiting (optional but recommended)
# resource "aws_dynamodb_table" "rate_limit" {
#   name           = "${var.project_name}-rate-limit"
#   billing_mode   = "PAY_PER_REQUEST"
#   hash_key       = "identity_id"
#   range_key      = "timestamp"
#
#   attribute {
#     name = "identity_id"
#     type = "S"
#   }
#
#   attribute {
#     name = "timestamp"
#     type = "N"
#   }
#
#   ttl {
#     attribute_name = "ttl"
#     enabled        = true
#   }
#
#   tags = merge(var.tags, {
#     Name = "${var.project_name}-rate-limit"
#   })
# }
#
# # IAM policy for DynamoDB access
# resource "aws_iam_role_policy" "dynamodb_access" {
#   name = "${var.project_name}-dynamodb-access"
#   role = aws_iam_role.lambda_execution.id
#
#   policy = jsonencode({
#     Version = "2012-10-17"
#     Statement = [
#       {
#         Effect = "Allow"
#         Action = [
#           "dynamodb:GetItem",
#           "dynamodb:PutItem",
#           "dynamodb:Query",
#           "dynamodb:UpdateItem"
#         ]
#         Resource = aws_dynamodb_table.rate_limit.arn
#       }
#     ]
#   })
# }
#
# # modules/bedrock-verification/outputs.tf
