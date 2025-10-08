variable "project_name" {
  description = "Name of the project (used for resource naming)"
  type        = string
}

variable "aws_region" {
  type        = string
  description = "AWS region (must support Bedrock)"
}

variable "rate_limit_per_minute" {
  type        = number
  default     = 10
  description = "Requests allowed per user per 1-minute window"
}

variable "bedrock_model_id" {
  type = string
  # example Anthropics on Bedrock; change as needed
  description = "Bedrock model ID to invoke"
}

variable "tags" {
  description = "Tags to apply to all resources"
  type        = map(string)
  default     = {}
}