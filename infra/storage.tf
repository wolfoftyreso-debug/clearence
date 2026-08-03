/**
 * Lagringen: två hinkar med rakt motsatta syften.
 *
 *   documents  ärendets handlingar. Privat, krypterad med egen nyckel,
 *              versionerad, och nås ALDRIG direkt - bara via signerade
 *              URL:er som API:et skapar efter att ha frågat
 *              app.may_read_document(). En signerad URL kringgår all
 *              databasbehörighet; det är hela poängen med den, och därför
 *              är frågan före signeringen icke förhandlingsbar.
 *
 *   web        den byggda webbappen. Också privat - CloudFront är enda
 *              vägen in (OAC), så det finns ingen hink-URL som kan läcka
 *              runt WAF:en.
 */

resource "aws_s3_bucket" "documents" {
  bucket = "${local.name}-documents"

  tags = { Name = "${local.name}-documents" }
}

resource "aws_s3_bucket_public_access_block" "documents" {
  bucket = aws_s3_bucket.documents.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_server_side_encryption_configuration" "documents" {
  bucket = aws_s3_bucket.documents.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm     = "aws:kms"
      kms_master_key_id = aws_kms_key.documents.arn
    }
    bucket_key_enabled = true
  }
}

# Versionering: frysningslöftet gäller även filerna. En överskriven
# handling ska gå att återställa, för akten är bevisning.
resource "aws_s3_bucket_versioning" "documents" {
  bucket = aws_s3_bucket.documents.id

  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_lifecycle_configuration" "documents" {
  bucket = aws_s3_bucket.documents.id

  # Gallringsregler per dokumenttyp är ett ÖPPET JURIDISKT BESLUT
  # (db/README.md). Tills det är avgjort raderas ingenting - bara gamla
  # versioner flyttas till billigare lagring, och ofullständiga
  # uppladdningar städas.
  rule {
    id     = "gamla-versioner-till-billigare-lagring"
    status = "Enabled"

    filter {}

    noncurrent_version_transition {
      noncurrent_days = 90
      storage_class   = "STANDARD_IA"
    }
  }

  rule {
    id     = "stada-avbrutna-uppladdningar"
    status = "Enabled"

    filter {}

    abort_incomplete_multipart_upload {
      days_after_initiation = 7
    }
  }
}

resource "aws_s3_bucket_policy" "documents" {
  bucket = aws_s3_bucket.documents.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Sid       = "NekaAllaOkrypteradeAnrop"
      Effect    = "Deny"
      Principal = "*"
      Action    = "s3:*"
      Resource = [
        aws_s3_bucket.documents.arn,
        "${aws_s3_bucket.documents.arn}/*",
      ]
      Condition = {
        Bool = { "aws:SecureTransport" = "false" }
      }
    }]
  })
}

# --- Webbappen ---------------------------------------------------------

resource "aws_s3_bucket" "web" {
  bucket = "${local.name}-web"

  tags = { Name = "${local.name}-web" }
}

resource "aws_s3_bucket_public_access_block" "web" {
  bucket = aws_s3_bucket.web.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_server_side_encryption_configuration" "web" {
  bucket = aws_s3_bucket.web.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

resource "aws_s3_bucket_versioning" "web" {
  bucket = aws_s3_bucket.web.id

  versioning_configuration {
    status = "Enabled"
  }
}

# Bara CloudFront-distributionen får läsa. Ingen publik hink-URL finns.
resource "aws_s3_bucket_policy" "web" {
  bucket = aws_s3_bucket.web.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Sid       = "EndastDennaDistribution"
      Effect    = "Allow"
      Principal = { Service = "cloudfront.amazonaws.com" }
      Action    = "s3:GetObject"
      Resource  = "${aws_s3_bucket.web.arn}/*"
      Condition = {
        StringEquals = {
          "AWS:SourceArn" = aws_cloudfront_distribution.web.arn
        }
      }
    }]
  })
}

# --- Åtkomstloggar -----------------------------------------------------

resource "aws_s3_bucket" "logs" {
  bucket = "${local.name}-access-logs"

  tags = { Name = "${local.name}-access-logs" }
}

resource "aws_s3_bucket_public_access_block" "logs" {
  bucket = aws_s3_bucket.logs.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_ownership_controls" "logs" {
  bucket = aws_s3_bucket.logs.id

  rule {
    object_ownership = "BucketOwnerPreferred"
  }
}

resource "aws_s3_bucket_lifecycle_configuration" "logs" {
  bucket = aws_s3_bucket.logs.id

  rule {
    id     = "gallra-atkomstloggar"
    status = "Enabled"

    filter {}

    expiration {
      days = var.log_retention_days
    }
  }
}
