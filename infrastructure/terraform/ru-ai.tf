module "bedrock" {
  source = "./modules/bedrock-api"

  project_name     = "ru-ai"
  bedrock_model_id = "anthropic.claude-3-5-sonnet-20241022-v2:0"

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

  invoke_url = module.bedrock.invoke_url

  tags = {
    Website = "ru-ai.net"
  }
}