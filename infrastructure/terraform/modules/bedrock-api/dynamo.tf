# 1) DynamoDB table for rate limiting (fixed 1-minute window keys)
resource "aws_dynamodb_table" "rate_limits" {
  name         = "${var.project_name}-rate-limit"
  billing_mode = "PAY_PER_REQUEST"

  hash_key = "pk"

  attribute {
    name = "pk"
    type = "S"
  }

  ttl {
    attribute_name = "ttl"
    enabled        = true
  }

  tags = var.tags
}