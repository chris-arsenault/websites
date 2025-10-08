output "website_url" {
  description = "The URL of the website"
  value       = "https://${var.hostname}"
}

output "hostname" {
  description = "The hostname of the website"
  value       = var.hostname
}

output "s3_bucket_name" {
  description = "The name of the S3 bucket"
  value       = aws_s3_bucket.website.id
}

output "cloudfront_distribution_id" {
  description = "The ID of the CloudFront distribution"
  value       = aws_cloudfront_distribution.website.id
}

output "cloudfront_domain_name" {
  description = "The domain name of the CloudFront distribution"
  value       = aws_cloudfront_distribution.website.domain_name
}

output "site_name" {
  description = "The site name (subdomain without domain)"
  value       = split(".", var.hostname)[0]
}

output "domain_name" {
  description = "The root domain name"
  value       = var.domain_name
}