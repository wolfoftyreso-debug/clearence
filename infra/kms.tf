/**
 * Krypteringsnycklar.
 *
 * En nyckel per datatyp, inte en gemensam. Skälet är inte teori: den dag
 * en nyckel måste roteras eller spärras ska det gå att göra för
 * dokumenten utan att samtidigt låsa databasen och loggarna.
 *
 * Alla har radering med 30 dagars fönster. En KMS-nyckel som raderas i
 * misstag gör backuperna oläsbara - det finns ingen väg tillbaka.
 */

resource "aws_kms_key" "database" {
  description             = "${local.name}: RDS - arendedata, journal, beslut"
  deletion_window_in_days = 30
  enable_key_rotation     = true

  tags = { Name = "${local.name}-kms-db" }
}

resource "aws_kms_alias" "database" {
  name          = "alias/${local.name}-database"
  target_key_id = aws_kms_key.database.key_id
}

resource "aws_kms_key" "documents" {
  description             = "${local.name}: S3 - uppladdade och genererade handlingar"
  deletion_window_in_days = 30
  enable_key_rotation     = true

  tags = { Name = "${local.name}-kms-documents" }
}

resource "aws_kms_alias" "documents" {
  name          = "alias/${local.name}-documents"
  target_key_id = aws_kms_key.documents.key_id
}

resource "aws_kms_key" "secrets" {
  description             = "${local.name}: Secrets Manager - databaslosenord och integrationsnycklar"
  deletion_window_in_days = 30
  enable_key_rotation     = true

  tags = { Name = "${local.name}-kms-secrets" }
}

resource "aws_kms_alias" "secrets" {
  name          = "alias/${local.name}-secrets"
  target_key_id = aws_kms_key.secrets.key_id
}

resource "aws_kms_key" "logs" {
  description             = "${local.name}: CloudWatch - loggar kan innehalla bolagsnamn"
  deletion_window_in_days = 30
  enable_key_rotation     = true

  # CloudWatch måste få använda nyckeln för att kunna skriva krypterat.
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid       = "Kontot administrerar nyckeln"
        Effect    = "Allow"
        Principal = { AWS = "arn:aws:iam::${data.aws_caller_identity.current.account_id}:root" }
        Action    = "kms:*"
        Resource  = "*"
      },
      {
        Sid       = "CloudWatch Logs krypterar med nyckeln"
        Effect    = "Allow"
        Principal = { Service = "logs.${var.aws_region}.amazonaws.com" }
        Action = [
          "kms:Encrypt*",
          "kms:Decrypt*",
          "kms:ReEncrypt*",
          "kms:GenerateDataKey*",
          "kms:Describe*",
        ]
        Resource = "*"
        Condition = {
          ArnLike = {
            "kms:EncryptionContext:aws:logs:arn" = "arn:aws:logs:${var.aws_region}:${data.aws_caller_identity.current.account_id}:log-group:*"
          }
        }
      },
    ]
  })

  tags = { Name = "${local.name}-kms-logs" }
}

resource "aws_kms_alias" "logs" {
  name          = "alias/${local.name}-logs"
  target_key_id = aws_kms_key.logs.key_id
}
