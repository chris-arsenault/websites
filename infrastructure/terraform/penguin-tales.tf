# Penguin Tales website

module "penguin-tales" {
  source = "./modules/static-website"

  hostname             = "penguin-tales.com"
  domain_name          = "penguin-tales.com"
  site_directory_path  = "${path.module}/../../sites/penguin-tales.com"
  site_name            = "penguin-tales"
  prefix               = var.prefix

  tags = {
    Website = "penguin-tales.com"
  }
}
