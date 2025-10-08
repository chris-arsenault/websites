# Cognito Identity Pool for unauthenticated access
resource "aws_cognito_identity_pool" "main" {
  identity_pool_name               = "${var.project_name}-identity-pool"
  allow_unauthenticated_identities = true
  allow_classic_flow               = false

  tags = merge(var.tags, {
    Name = "${var.project_name}-identity-pool"
  })
}

resource "aws_cognito_identity_pool_roles_attachment" "main" {
  identity_pool_id = aws_cognito_identity_pool.main.id

  roles = {
    "unauthenticated" = aws_iam_role.unauthenticated.arn
  }
}
