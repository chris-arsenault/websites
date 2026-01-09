output "api_endpoint" {
  description = "HTTP API endpoint"
  value       = aws_apigatewayv2_api.api.api_endpoint
}

output "custom_domain_name" {
  description = "Custom domain name for the API"
  value       = var.custom_domain_name
}

output "lambda_function_name" {
  description = "Lambda function name"
  value       = aws_lambda_function.api.function_name
}
