# Ahara.io - Project portfolio website

module "ahara" {
  source = "./modules/static-website"

  hostname            = "ahara.io"
  domain_name         = "ahara.io"
  site_directory_path = "${path.module}/../../sites/ahara.io/dist"
  site_name           = "ahara"
  prefix              = var.prefix

  tags = {
    Website = "ahara.io"
  }
}
