# --- Passwords & Secrets ---

resource "random_password" "sonarqube_db" {
  length  = 24
  special = false
}

resource "random_password" "sonarqube_admin" {
  length      = 16
  special     = false
  min_upper   = 1
  min_lower   = 1
  min_numeric = 1
}

# --- SSM Parameters ---

resource "aws_ssm_parameter" "sonarqube_db_password" {
  name  = "/websites/sonarqube/db-password"
  type  = "SecureString"
  value = random_password.sonarqube_db.result
}

resource "aws_ssm_parameter" "sonarqube_admin_password" {
  name  = "/websites/sonarqube/admin-password"
  type  = "SecureString"
  value = random_password.sonarqube_admin.result
}

resource "aws_ssm_parameter" "sonarqube_cognito_client_id" {
  name  = "/websites/sonarqube/cognito-client-id"
  type  = "String"
  value = aws_cognito_user_pool_client.sonarqube.id
}

resource "aws_ssm_parameter" "sonarqube_cognito_client_secret" {
  name  = "/websites/sonarqube/cognito-client-secret"
  type  = "SecureString"
  value = aws_cognito_user_pool_client.sonarqube.client_secret
}

# --- Cognito App Client ---

resource "aws_cognito_user_pool_client" "sonarqube" {
  name         = "sonarqube"
  user_pool_id = module.cognito.user_pool_id

  generate_secret                      = true
  allowed_oauth_flows                  = ["code"]
  allowed_oauth_scopes                 = ["openid", "email", "profile"]
  allowed_oauth_flows_user_pool_client = true
  callback_urls                        = ["https://${local.sonarqube_domain}/oauth2/callback/oidc"]
  supported_identity_providers         = ["COGNITO"]

  explicit_auth_flows = [
    "ALLOW_USER_PASSWORD_AUTH",
    "ALLOW_REFRESH_TOKEN_AUTH",
    "ALLOW_USER_SRP_AUTH"
  ]
}

# --- IAM ---

data "aws_iam_policy_document" "sonarqube_assume" {
  statement {
    actions = ["sts:AssumeRole"]
    principals {
      type        = "Service"
      identifiers = ["ec2.amazonaws.com"]
    }
  }
}

data "aws_iam_policy_document" "sonarqube_instance" {
  statement {
    actions = [
      "ssm:GetParameter",
      "ssm:GetParameters",
      "ssm:PutParameter"
    ]
    resources = ["arn:aws:ssm:${data.aws_region.current.id}:*:parameter/websites/sonarqube/*"]
  }
}

resource "aws_iam_role" "sonarqube" {
  name               = "websites-sonarqube"
  assume_role_policy = data.aws_iam_policy_document.sonarqube_assume.json
}

resource "aws_iam_role_policy" "sonarqube" {
  name   = "websites-sonarqube-ssm"
  role   = aws_iam_role.sonarqube.id
  policy = data.aws_iam_policy_document.sonarqube_instance.json
}

resource "aws_iam_instance_profile" "sonarqube" {
  name = "websites-sonarqube"
  role = aws_iam_role.sonarqube.name
}

# --- Security Group ---

resource "aws_security_group" "sonarqube" {
  name        = "websites-sonarqube"
  description = "SonarQube EC2 instance"

  ingress {
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
    description = "HTTP (Caddy redirect)"
  }

  ingress {
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
    description = "HTTPS"
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
    description = "All outbound"
  }
}

# --- EC2 ---

data "aws_ami" "al2023" {
  most_recent = true
  owners      = ["amazon"]

  filter {
    name   = "name"
    values = ["al2023-ami-*-x86_64"]
  }

  filter {
    name   = "virtualization-type"
    values = ["hvm"]
  }
}

resource "aws_instance" "sonarqube" {
  ami                    = data.aws_ami.al2023.id
  instance_type          = "t3.small"
  iam_instance_profile   = aws_iam_instance_profile.sonarqube.name
  vpc_security_group_ids = [aws_security_group.sonarqube.id]

  root_block_device {
    volume_size = 20
    volume_type = "gp3"
  }

  user_data = templatefile("${path.module}/sonarqube-userdata.sh.tftpl", {
    aws_region      = data.aws_region.current.id
    domain          = local.sonarqube_domain
    cognito_pool_id = module.cognito.user_pool_id
    ssm_prefix      = "/websites/sonarqube"
    oidc_plugin_url = "https://github.com/sonar-auth-oidc/sonar-auth-oidc/releases/download/v3.0.0/sonar-auth-oidc-plugin-3.0.0.jar"
  })

  tags = { Name = "websites-sonarqube" }

  lifecycle {
    ignore_changes = [ami, user_data]
  }
}

# --- Networking ---

resource "aws_eip" "sonarqube" {
  instance = aws_instance.sonarqube.id
  tags     = { Name = "websites-sonarqube" }
}

data "aws_route53_zone" "ahara" {
  name         = "${local.ahara_domain_name}."
  private_zone = false
}

resource "aws_route53_record" "sonarqube" {
  zone_id = data.aws_route53_zone.ahara.zone_id
  name    = local.sonarqube_domain
  type    = "A"
  ttl     = 300
  records = [aws_eip.sonarqube.public_ip]
}

# --- Outputs ---

output "sonarqube_admin_password" {
  description = "SonarQube admin password"
  value       = random_password.sonarqube_admin.result
  sensitive   = true
}

output "sonarqube_url" {
  description = "SonarQube URL"
  value       = "https://${local.sonarqube_domain}"
}
