terraform {
  required_version = ">= 1.9.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.60"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.6"
    }
  }

  # Fjärrstate. Kommenterad tills kontot finns: en state-fil på en laptop
  # är en enskild punkt där hela driftmiljön kan gå förlorad, och två
  # personer som kör apply samtidigt utan lås skriver över varandra.
  #
  # backend "s3" {
  #   bucket         = "clearance-tfstate"
  #   key            = "prod/terraform.tfstate"
  #   region         = "eu-north-1"
  #   dynamodb_table = "clearance-tflock"
  #   encrypt        = true
  # }
}

provider "aws" {
  region = var.aws_region

  default_tags {
    tags = local.tags
  }
}

# CloudFront kräver att certifikatet ligger i us-east-1, oavsett var
# resten av miljön bor. Det är den enda anledningen till den här aliasen.
provider "aws" {
  alias  = "us_east_1"
  region = "us-east-1"

  default_tags {
    tags = local.tags
  }
}
