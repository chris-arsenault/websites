output "invoke_url" {
  value       = "${aws_apigatewayv2_api.http.api_endpoint}/invoke"
  description = "POST endpoint for invoking Bedrock via Lambda"
}
