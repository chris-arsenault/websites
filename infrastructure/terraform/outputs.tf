output "all_sites" {
  description = "All site details in a map for easy iteration"
  value = {
    ru-ai = {
      url               = module.ru-ai.website_url
      hostname          = module.ru-ai.hostname
      s3_bucket         = module.ru-ai.s3_bucket_name
      cloudfront_id     = module.ru-ai.cloudfront_distribution_id
      cloudfront_domain = module.ru-ai.cloudfront_domain_name
      site_name         = module.ru-ai.site_name
      domain_name       = module.ru-ai.domain_name
      local_path        = "sites/ru-ai.net"
    }
  }
}

output "cloudfront_distribution_id" {
  value = module.ru-ai.cloudfront_distribution_id
}