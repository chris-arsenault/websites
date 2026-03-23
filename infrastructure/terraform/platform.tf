# SSM lookups for shared platform resources

data "aws_ssm_parameter" "cognito_user_pool_id" {
  name = "/platform/cognito/user-pool-id"
}

data "aws_ssm_parameter" "cognito_user_pool_arn" {
  name = "/platform/cognito/user-pool-arn"
}

data "aws_ssm_parameter" "cognito_domain" {
  name = "/platform/cognito/domain"
}

data "aws_ssm_parameter" "cognito_client_scorchbook" {
  name = "/platform/cognito/clients/scorchbook"
}

data "aws_ssm_parameter" "cognito_client_ahara" {
  name = "/platform/cognito/clients/ahara"
}

data "aws_ssm_parameter" "cognito_client_canonry" {
  name = "/platform/cognito/clients/canonry"
}

locals {
  cognito_user_pool_id  = nonsensitive(data.aws_ssm_parameter.cognito_user_pool_id.value)
  cognito_user_pool_arn = nonsensitive(data.aws_ssm_parameter.cognito_user_pool_arn.value)
  cognito_domain        = nonsensitive(data.aws_ssm_parameter.cognito_domain.value)
  cognito_client_ids = {
    scorchbook = nonsensitive(data.aws_ssm_parameter.cognito_client_scorchbook.value)
    ahara      = nonsensitive(data.aws_ssm_parameter.cognito_client_ahara.value)
    canonry    = nonsensitive(data.aws_ssm_parameter.cognito_client_canonry.value)
  }
  user_access_table_name = "websites-user-access"
  user_access_table_arn  = "arn:aws:dynamodb:${data.aws_region.current.id}:${data.aws_caller_identity.current.account_id}:table/${local.user_access_table_name}"
}

data "aws_caller_identity" "current" {}
