# 1) DynamoDB table for rate limiting (fixed 1-minute window keys)
resource "aws_dynamodb_table" "rate_limits" {
  name         = "${local.resource_prefix}-rate-limit"
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

  tags = merge(local.default_tags, {
    Name = "${local.resource_prefix}-rate-limit"
  })
}
