module "stack_atlas_site" {
  source = "./modules/static-website"

  hostname            = local.stack_atlas_hostname
  domain_name         = local.stack_atlas_domain_name
  site_directory_path = "${path.module}/../../apps/stack-atlas/dist"
}
