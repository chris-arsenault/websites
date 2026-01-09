output "bucket" {
  description = "S3 bucket name"
  value       = aws_s3_bucket.media.bucket
}

output "arn" {
  description = "S3 bucket ARN"
  value       = aws_s3_bucket.media.arn
}
