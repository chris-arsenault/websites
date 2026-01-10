resource "random_password" "cognito_chris" {
  length      = 16
  special     = false
  min_upper   = 1
  min_lower   = 1
  min_numeric = 1
}

resource "aws_cognito_user" "chris" {
  user_pool_id   = module.cognito.user_pool_id
  username       = "chris@chris-arsenault.net"
  password       = random_password.cognito_chris.result
  message_action = "SUPPRESS"

  attributes = {
    email          = "chris@chris-arsenault.net"
    email_verified = "true"
    name           = "chris"
  }
}
