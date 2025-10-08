output "identity_pool_id" {
  description = "Cognito Identity Pool ID"
  value       = aws_cognito_identity_pool.main.id
}

output "aws_region" {
  description = "AWS Region for Bedrock"
  value       = data.aws_region.current.name
}

output "bedrock_model_id" {
  description = "Bedrock model ID to use"
  value       = var.bedrock_model_id
}

output "unauthenticated_role_arn" {
  description = "ARN of the unauthenticated IAM role"
  value       = aws_iam_role.unauthenticated.arn
}

# output "lambda_execution_role_arn" {
#   description = "ARN of the Lambda execution role"
#   value       = aws_iam_role.lambda_execution.arn
# }
#
# output "rate_limit_table_name" {
#   description = "Name of the DynamoDB rate limiting table"
#   value       = aws_dynamodb_table.rate_limit.name
# }
#
# output "cloudwatch_log_group_name" {
#   description = "Name of the CloudWatch log group"
#   value       = aws_cloudwatch_log_group.bedrock_logs.name
# }

output "config" {
  description = "Configuration object for frontend use"
  value = {
    region         = data.aws_region.current.name
    identityPoolId = aws_cognito_identity_pool.main.id
    bedrockModelId = var.bedrock_model_id
  }
  sensitive = false
}