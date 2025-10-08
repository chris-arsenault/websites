variable "project_name" {
  description = "Name of the project (used for resource naming)"
  type        = string
  default     = "robot-verification"
}

variable "bedrock_model_id" {
  description = "Bedrock model ID to use for verification"
  type        = string
  default     = "anthropic.claude-3-5-sonnet-20241022-v2:0"
}

variable "allowed_origins" {
  description = "List of allowed origins for CORS (website URLs)"
  type        = list(string)
}

variable "tags" {
  description = "Tags to apply to all resources"
  type        = map(string)
  default     = {}
}