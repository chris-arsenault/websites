variable "site_name" {
  description = "Short site identifier used to compose resource names"
  type        = string
}

variable "project_prefix" {
  description = "Shared prefix applied to all resource names (e.g., websites)"
  type        = string
  default     = "websites"
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
