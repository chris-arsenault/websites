resource "terraform_data" "deployment_marker" {
  input = sha256(jsonencode({
    files          = [for k, v in aws_s3_object.website_files : v.source_hash]
    runtime_config = var.runtime_config
  }))

  lifecycle {
    action_trigger {
      events  = [after_update]
      actions = [action.aws_cloudfront_create_invalidation.invalidate_all]
    }
  }

  depends_on = [aws_s3_object.config]
}

action "aws_cloudfront_create_invalidation" "invalidate_all" {
  config {
    distribution_id = aws_cloudfront_distribution.website.id
    paths           = ["/*"]
  }
}
