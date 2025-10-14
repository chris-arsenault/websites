variable "prefix" {
  description = "Shared prefix applied to all resource names (e.g., websites)"
  type        = string
}

variable "permissions_boundary_arn" {
  description = "Optional ARN of an AWS IAM permissions boundary to apply to created IAM roles"
  type        = string
}
