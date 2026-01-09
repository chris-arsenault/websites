variable "name" {
  description = "Base name for API resources"
  type        = string
}

variable "lambda_entry_path" {
  description = "Path to the Lambda entry file"
  type        = string
}

variable "lambda_runtime" {
  description = "Lambda runtime (e.g., nodejs18.x, python3.12)"
  type        = string
}

variable "lambda_handler" {
  description = "Lambda handler (e.g., handler.handler)"
  type        = string
}

variable "lambda_environment" {
  description = "Environment variables for Lambda"
  type        = map(string)
}

variable "iam_policy_json" {
  description = "Inline policy JSON for the Lambda role"
  type        = string
}

variable "routes" {
  description = "List of HTTP routes (e.g., GET /items)"
  type        = list(string)
}

variable "cors_allow_origins" {
  description = "CORS allowed origins"
  type        = list(string)
}

variable "custom_domain_name" {
  description = "Custom domain name for the API"
  type        = string
}

variable "domain_zone_name" {
  description = "Route53 hosted zone name for the custom domain"
  type        = string
}
