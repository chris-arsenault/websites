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
      local_path        = "apps/ahara.io/dist"
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
    (local.scorchbook_hostname) = {
      url               = module.scorchbook_site.website_url
      hostname          = module.scorchbook_site.hostname
      s3_bucket         = module.scorchbook_site.s3_bucket_name
      cloudfront_id     = module.scorchbook_site.cloudfront_distribution_id
      cloudfront_domain = module.scorchbook_site.cloudfront_domain_name
      site_name         = module.scorchbook_site.site_name
      domain_name       = module.scorchbook_site.domain_name
      local_path        = "apps/scorchbook/frontend/dist"
    }
    (local.stack_atlas_hostname) = {
      url               = module.stack_atlas_site.website_url
      hostname          = module.stack_atlas_site.hostname
      s3_bucket         = module.stack_atlas_site.s3_bucket_name
      cloudfront_id     = module.stack_atlas_site.cloudfront_distribution_id
      cloudfront_domain = module.stack_atlas_site.cloudfront_domain_name
      site_name         = module.stack_atlas_site.site_name
      domain_name       = module.stack_atlas_site.domain_name
      local_path        = "apps/stack-atlas/dist"
    }
  }
}

output "cognito_chris_password" {
  description = "Initial password for chris@chris-arsenault.net"
  value       = random_password.cognito_chris.result
  sensitive   = true
}

output "cognito_user_pool_id" {
  description = "Cognito user pool ID"
  value       = module.cognito.user_pool_id
}

output "cognito_client_ids" {
  description = "Map of Cognito client keys to app client IDs"
  value       = module.cognito.client_ids
}
