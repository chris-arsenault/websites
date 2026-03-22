resource "aws_cognito_identity_pool" "canonry" {
  identity_pool_name               = local.canonry_identity_pool_name
  allow_unauthenticated_identities = false

  cognito_identity_providers {
    client_id               = local.cognito_client_ids["canonry"]
    provider_name           = "cognito-idp.${data.aws_region.current.id}.amazonaws.com/${local.cognito_user_pool_id}"
    server_side_token_check = true
  }
}

data "aws_iam_policy_document" "canonry_auth_assume" {
  statement {
    actions = ["sts:AssumeRoleWithWebIdentity"]

    principals {
      type        = "Federated"
      identifiers = ["cognito-identity.amazonaws.com"]
    }

    condition {
      test     = "StringEquals"
      variable = "cognito-identity.amazonaws.com:aud"
      values   = [aws_cognito_identity_pool.canonry.id]
    }

    condition {
      test     = "ForAnyValue:StringLike"
      variable = "cognito-identity.amazonaws.com:amr"
      values   = ["authenticated"]
    }
  }
}

data "aws_iam_policy_document" "canonry_s3_access" {
  statement {
    actions   = ["s3:ListAllMyBuckets"]
    resources = ["*"]
  }

  statement {
    actions = ["s3:ListBucket"]
    resources = [
      "arn:aws:s3:::*-canonry-images-*"
    ]

    dynamic "condition" {
      for_each = local.canonry_image_prefix != "" ? [1] : []
      content {
        test     = "StringLike"
        variable = "s3:prefix"
        values   = ["${local.canonry_image_prefix}/*"]
      }
    }
  }

  statement {
    actions = [
      "s3:GetObject",
      "s3:PutObject",
      "s3:PutObjectTagging"
    ]
    resources = [
      local.canonry_image_prefix != ""
      ? "arn:aws:s3:::*-canonry-images-*/${local.canonry_image_prefix}/*"
      : "arn:aws:s3:::*-canonry-images-*/*"
    ]
  }
}

resource "aws_iam_role" "canonry_authenticated" {
  name               = "${local.scorchbook_name_prefix}-canonry-authenticated"
  assume_role_policy = data.aws_iam_policy_document.canonry_auth_assume.json
}

resource "aws_iam_role" "canonry_access" {
  name               = "${local.scorchbook_name_prefix}-canonry-access"
  assume_role_policy = data.aws_iam_policy_document.canonry_auth_assume.json
}

resource "aws_iam_role_policy" "canonry_access" {
  name   = "${local.scorchbook_name_prefix}-canonry-s3-access"
  role   = aws_iam_role.canonry_access.id
  policy = data.aws_iam_policy_document.canonry_s3_access.json
}

resource "aws_cognito_user_group" "canonry_access" {
  user_pool_id = local.cognito_user_pool_id
  name         = local.canonry_access_group_name
  description  = "Canonry access"
  role_arn     = aws_iam_role.canonry_access.arn
}

resource "aws_cognito_user_in_group" "chris_canonry_access" {
  user_pool_id = local.cognito_user_pool_id
  username     = "chris"
  group_name   = aws_cognito_user_group.canonry_access.name
}

resource "aws_cognito_identity_pool_roles_attachment" "canonry" {
  identity_pool_id = aws_cognito_identity_pool.canonry.id

  roles = {
    authenticated = aws_iam_role.canonry_authenticated.arn
  }

  role_mapping {
    identity_provider         = "cognito-idp.${data.aws_region.current.id}.amazonaws.com/${local.cognito_user_pool_id}:${local.cognito_client_ids["canonry"]}"
    type                      = "Token"
    ambiguous_role_resolution = "Deny"
  }
}
