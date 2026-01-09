output "api_endpoint" {
  description = "HTTP API endpoint"
  value       = aws_apigatewayv2_api.api.api_endpoint
}

output "api_id" {
  description = "HTTP API ID"
  value       = aws_apigatewayv2_api.api.id
}

output "lambda_function_name" {
  description = "Lambda function name"
  value       = aws_lambda_function.api.function_name
}
