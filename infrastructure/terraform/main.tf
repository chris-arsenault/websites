terraform {
  required_version = ">= 1.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 6.0"
    }
  }
  backend "s3" {
    region       = "us-east-1"
    key          = "projects/websites.tfstate"
    encrypt      = true
    use_lockfile = true
  }
}

# Provider for prod (us-east-1)
provider "aws" {
  region = "us-east-1"

  default_tags {
    tags = {
      Project   = "Websites"
      ManagedBy = "Terraform"
    }
  }
}
