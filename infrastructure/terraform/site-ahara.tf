module "ahara_site" {
  source = "./modules/static-website"

  hostname            = local.ahara_hostname
  domain_name         = local.ahara_domain_name
  site_directory_path = "${path.module}/../../apps/ahara.io/dist"
}
