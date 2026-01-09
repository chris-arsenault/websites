output "name" {
  description = "DynamoDB table name"
  value       = aws_dynamodb_table.table.name
}

output "arn" {
  description = "DynamoDB table ARN"
  value       = aws_dynamodb_table.table.arn
}
