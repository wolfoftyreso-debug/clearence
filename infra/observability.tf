/**
 * Loggar och larm.
 *
 * Urvalet styrs av en fråga: vad får INTE gå sönder tyst?
 *
 *   1. Utkorgen. Ett fakturamejl som aldrig gick iväg blir en
 *      betalningsanmärkning hos kunden.
 *   2. Databasen. Ärendedatan och radskyddet bor där.
 *   3. Arbetarens körningar. Ett stängningsjobb som inte kört betyder
 *      konton som inte stängts - och besked som inte skickats.
 *
 * Loggarna kan innehålla bolagsnamn, alltså personuppgifter i praktiken:
 * de krypteras med egen nyckel och gallras enligt log_retention_days.
 */

resource "aws_cloudwatch_log_group" "api" {
  name              = "/${local.name}/api"
  retention_in_days = var.log_retention_days
  kms_key_id        = aws_kms_key.logs.arn

  tags = { Name = "${local.name}-api-logs" }
}

resource "aws_cloudwatch_log_group" "worker" {
  name              = "/${local.name}/worker"
  retention_in_days = var.log_retention_days
  kms_key_id        = aws_kms_key.logs.arn

  tags = { Name = "${local.name}-worker-logs" }
}

resource "aws_sns_topic" "alerts" {
  name              = "${local.name}-alerts"
  kms_master_key_id = aws_kms_key.secrets.id

  tags = { Name = "${local.name}-alerts" }
}

resource "aws_sns_topic_subscription" "alerts_email" {
  count = var.alert_email == "" ? 0 : 1

  topic_arn = aws_sns_topic.alerts.arn
  protocol  = "email"
  endpoint  = var.alert_email
}

# --- Databasen ---------------------------------------------------------

resource "aws_cloudwatch_metric_alarm" "db_cpu" {
  alarm_name          = "${local.name}-db-cpu"
  alarm_description   = "Databasens CPU over 80 % i 15 minuter"
  namespace           = "AWS/RDS"
  metric_name         = "CPUUtilization"
  statistic           = "Average"
  period              = 300
  evaluation_periods  = 3
  threshold           = 80
  comparison_operator = "GreaterThanThreshold"
  alarm_actions       = [aws_sns_topic.alerts.arn]
  ok_actions          = [aws_sns_topic.alerts.arn]

  dimensions = {
    DBInstanceIdentifier = aws_db_instance.main.id
  }

  tags = { Name = "${local.name}-db-cpu" }
}

resource "aws_cloudwatch_metric_alarm" "db_storage" {
  alarm_name          = "${local.name}-db-storage"
  alarm_description   = "Mindre an 10 GB fritt utrymme kvar i databasen"
  namespace           = "AWS/RDS"
  metric_name         = "FreeStorageSpace"
  statistic           = "Average"
  period              = 300
  evaluation_periods  = 2
  threshold           = 10737418240 # 10 GB
  comparison_operator = "LessThanThreshold"
  alarm_actions       = [aws_sns_topic.alerts.arn]

  dimensions = {
    DBInstanceIdentifier = aws_db_instance.main.id
  }

  tags = { Name = "${local.name}-db-storage" }
}

# --- Utkorgen ----------------------------------------------------------

resource "aws_cloudwatch_metric_alarm" "ses_bounce_rate" {
  alarm_name          = "${local.name}-ses-bounce"
  alarm_description   = "Studsfrekvensen over 5 % - SES stanger avsandaren vid 10 %"
  namespace           = "AWS/SES"
  metric_name         = "Reputation.BounceRate"
  statistic           = "Average"
  period              = 3600
  evaluation_periods  = 1
  threshold           = 0.05
  comparison_operator = "GreaterThanThreshold"
  alarm_actions       = [aws_sns_topic.alerts.arn]

  tags = { Name = "${local.name}-ses-bounce" }
}

resource "aws_cloudwatch_metric_alarm" "ses_complaint_rate" {
  alarm_name          = "${local.name}-ses-complaint"
  alarm_description   = "Klagomalsfrekvensen over 0,1 %"
  namespace           = "AWS/SES"
  metric_name         = "Reputation.ComplaintRate"
  statistic           = "Average"
  period              = 3600
  evaluation_periods  = 1
  threshold           = 0.001
  comparison_operator = "GreaterThanThreshold"
  alarm_actions       = [aws_sns_topic.alerts.arn]

  tags = { Name = "${local.name}-ses-complaint" }
}

# --- Arbetaren ---------------------------------------------------------

# En körning som slutar med felkod betyder att något i kön inte gick
# iväg - eller att konton inte stängdes. Det ska väcka någon.
resource "aws_cloudwatch_log_metric_filter" "worker_errors" {
  name           = "${local.name}-worker-errors"
  log_group_name = aws_cloudwatch_log_group.worker.name
  pattern        = "?ERROR ?Error ?misslyckades"

  metric_transformation {
    name          = "WorkerErrors"
    namespace     = local.name
    value         = "1"
    default_value = "0"
  }
}

resource "aws_cloudwatch_metric_alarm" "worker_errors" {
  alarm_name          = "${local.name}-worker-errors"
  alarm_description   = "E-postarbetaren loggade fel - utkorgen kan sta stilla"
  namespace           = local.name
  metric_name         = "WorkerErrors"
  statistic           = "Sum"
  period              = 900
  evaluation_periods  = 1
  threshold           = 0
  comparison_operator = "GreaterThanThreshold"
  treat_missing_data  = "notBreaching"
  alarm_actions       = [aws_sns_topic.alerts.arn]

  tags = { Name = "${local.name}-worker-errors" }
}

# --- Revisionsspåret ---------------------------------------------------

# CloudTrail: vem i driften rörde vad. Ärendejournalen i databasen är
# append-only, men den säger inget om någon med AWS-behörighet gjorde
# något med maskinerna under den.
resource "aws_cloudtrail" "main" {
  name                          = local.name
  s3_bucket_name                = aws_s3_bucket.logs.bucket
  s3_key_prefix                 = "cloudtrail"
  include_global_service_events = true
  is_multi_region_trail         = true
  enable_log_file_validation    = true
  kms_key_id                    = aws_kms_key.logs.arn

  depends_on = [aws_s3_bucket_policy.logs_cloudtrail]

  tags = { Name = "${local.name}-cloudtrail" }
}

resource "aws_s3_bucket_policy" "logs_cloudtrail" {
  bucket = aws_s3_bucket.logs.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid       = "CloudTrailFarKontrolleraHinken"
        Effect    = "Allow"
        Principal = { Service = "cloudtrail.amazonaws.com" }
        Action    = "s3:GetBucketAcl"
        Resource  = aws_s3_bucket.logs.arn
      },
      {
        Sid       = "CloudTrailSkriverLoggar"
        Effect    = "Allow"
        Principal = { Service = "cloudtrail.amazonaws.com" }
        Action    = "s3:PutObject"
        Resource  = "${aws_s3_bucket.logs.arn}/cloudtrail/AWSLogs/${data.aws_caller_identity.current.account_id}/*"
        Condition = {
          StringEquals = { "s3:x-amz-acl" = "bucket-owner-full-control" }
        }
      },
      {
        Sid       = "ALBSkriverAtkomstloggar"
        Effect    = "Allow"
        Principal = { Service = "logdelivery.elasticloadbalancing.amazonaws.com" }
        Action    = "s3:PutObject"
        Resource  = "${aws_s3_bucket.logs.arn}/alb/*"
      },
    ]
  })
}
