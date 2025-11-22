module "bedrock" {
  source = "./modules/bedrock-api"

  site_name                = "ru-ai"
  prefix                   = var.prefix
  permissions_boundary_arn = var.permissions_boundary_arn
  bedrock_model_id         = "anthropic.claude-3-haiku-20240307-v1:0"
  aws_region               = "us-east-1"

  tags = {
    Website = "ru-ai.net"
  }
}

# Robot detector website


module "ru-ai" {
  source = "./modules/static-website"

  hostname            = "ru-ai.net"
  domain_name         = "ru-ai.net"
  site_directory_path = "${path.module}/../../sites/ru-ai.net"
  site_name           = "ru-ai"
  prefix              = var.prefix

  invoke_url = module.bedrock.invoke_url

  tags = {
    Website = "ru-ai.net"
  }
}
