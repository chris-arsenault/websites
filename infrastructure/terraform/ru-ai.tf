# Robot detector website
module "ru-ai" {
  source = "./modules/static-website"

  hostname        = "ru-ai.net"
  domain_name     = "ru-ai.net"
  index_html_path = "${path.module}/../../sites/ru-ai.net/index.html"

  tags = {
    Website = "ru-ai.net"
  }
}