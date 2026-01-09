output "all_sites" {
  description = "All site details in a map for easy iteration"
  value = {
    (local.ahara_hostname) = {
      url               = module.ahara_site.website_url
      hostname          = module.ahara_site.hostname
      s3_bucket         = module.ahara_site.s3_bucket_name
      cloudfront_id     = module.ahara_site.cloudfront_distribution_id
      cloudfront_domain = module.ahara_site.cloudfront_domain_name
      site_name         = module.ahara_site.site_name
      domain_name       = module.ahara_site.domain_name
      local_path        = "apps/ahara.io/static"
    }
    "ru-ai.net" = {
      url               = module.ru_ai_site.website_url
      hostname          = module.ru_ai_site.hostname
      s3_bucket         = module.ru_ai_site.s3_bucket_name
      cloudfront_id     = module.ru_ai_site.cloudfront_distribution_id
      cloudfront_domain = module.ru_ai_site.cloudfront_domain_name
      site_name         = module.ru_ai_site.site_name
      domain_name       = module.ru_ai_site.domain_name
      local_path        = "apps/ru-ai.net/static"
    }
    (local.hotsauce_hostname) = {
      url               = module.hotsauce_site.website_url
      hostname          = module.hotsauce_site.hostname
      s3_bucket         = module.hotsauce_site.s3_bucket_name
      cloudfront_id     = module.hotsauce_site.cloudfront_distribution_id
      cloudfront_domain = module.hotsauce_site.cloudfront_domain_name
      site_name         = module.hotsauce_site.site_name
      domain_name       = module.hotsauce_site.domain_name
      local_path        = "apps/hotsauce/frontend/dist"
    }
  }
}

output "cognito_chris_password" {
  description = "Initial password for chris@chris-arsenault.net"
  value       = random_password.cognito_chris.result
  sensitive   = true
}
