/**
 * Utdata: det man behöver för att rulla ut och för att felsöka.
 *
 * Inga hemligheter passerar här. Anslutningssträngarna finns i Secrets
 * Manager; ett terraform output som skriver ut ett lösenord hamnar i
 * någons terminalhistorik och i CI-loggen.
 */

output "web_bucket" {
  description = "Hinken som `npm run build` laddas upp till."
  value       = aws_s3_bucket.web.bucket
}

output "cloudfront_distribution_id" {
  description = "Distributionen att invalidera efter utrullning."
  value       = aws_cloudfront_distribution.web.id
}

output "cloudfront_domain" {
  description = "CloudFront-adressen (DNS pekar hit)."
  value       = aws_cloudfront_distribution.web.domain_name
}

output "documents_bucket" {
  description = "Handlingarnas hink. Nås bara via signerade URL:er."
  value       = aws_s3_bucket.documents.bucket
}

output "database_endpoint" {
  description = "Databasens adress. Nås bara inifrån VPC:n."
  value       = aws_db_instance.main.endpoint
}

output "database_secret_arn" {
  description = "Secrets Manager-posten med anslutningsstrangarna."
  value       = aws_secretsmanager_secret.database.arn
}

output "integrations_secret_arn" {
  description = "Platsen for integrationsnycklarna - varden satts i driftpanelen."
  value       = aws_secretsmanager_secret.integrations.arn
}

output "ses_identity" {
  description = "Verifierad avsandardoman."
  value       = aws_sesv2_email_identity.domain.email_identity
}

output "alerts_topic_arn" {
  description = "SNS-amnet som larmen gar till."
  value       = aws_sns_topic.alerts.arn
}

output "worker_schedules" {
  description = "Arbetarens korningar: namn och tid."
  value       = { for k, v in local.worker_jobs : k => v.schedule }
}

output "deploy_command" {
  description = "Utrullning av webbappen, i ordning."
  value = join(" && ", [
    "npm run build",
    "aws s3 sync dist/ s3://${aws_s3_bucket.web.bucket}/ --delete",
    "aws cloudfront create-invalidation --distribution-id ${aws_cloudfront_distribution.web.id} --paths '/*'",
  ])
}
