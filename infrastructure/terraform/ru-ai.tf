module "bedrock" {
  source = "./modules/bedrock-api"

  site_name        = "ru-ai"
  project_prefix   = var.project_prefix
  bedrock_model_id = "anthropic.claude-3-haiku-20240307-v1:0"
  aws_region       = "us-east-1"

  tags = {
    Website = "ru-ai.net"
  }
}

# Robot detector website


module "ru-ai" {
  source = "./modules/static-website"

  hostname        = "ru-ai.net"
  domain_name     = "ru-ai.net"
  index_html_path = "${path.module}/../../sites/ru-ai.net/index.html"
  site_name       = "ru-ai"
  project_prefix  = var.project_prefix

  invoke_url = module.bedrock.invoke_url

  tags = {
    Website = "ru-ai.net"
  }
}
