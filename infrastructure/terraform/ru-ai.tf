module "bedrock" {
  source = "./modules/bedrock-cognito"

  project_name     = "ru-ai"
  bedrock_model_id = "anthropic.claude-3-5-sonnet-20241022-v2:0"

  allowed_origins = [
    "ru-ai.net"
  ]

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

  bedrock_config = module.bedrock.config

  tags = {
    Website = "ru-ai.net"
  }
}