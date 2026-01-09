action "aws_cloudfront_create_invalidation" "invalidate_all" {
  config {
    distribution_id = aws_cloudfront_distribution.website.id
    paths           = ["/*"]
  }
}
