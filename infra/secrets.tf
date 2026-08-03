/**
 * Hemligheterna.
 *
 * Två sorter, med olika ägare:
 *
 *   databasen           Terraform skapar och äger den. Anslutnings-
 *                       strängarna byggs här och läses av containrarna
 *                       vid start - de finns aldrig i en avbild, en
 *                       miljöfil eller en plan-utskrift.
 *
 *   integrationerna     Creditsafe och liknande. Terraform skapar bara
 *                       PLATSEN, aldrig värdet. Värdet läggs in en gång i
 *                       driftpanelen, maskeras omedelbart och visas
 *                       aldrig igen - samma regel som användarnas
 *                       API-nycklar. En hemlighet i en versionshanterad
 *                       fil är en hemlighet som läckt.
 *
 * app_url och worker_url pekar på OLIKA databasroller. Arbetaren är
 * app_worker; API:et är app_user, som varken äger tabeller eller har
 * BYPASSRLS - båda hade stängt av radskyddet tyst (db/README.md).
 */

resource "random_password" "app_user" {
  length           = 32
  special          = true
  override_special = "!#%*-_=+"
}

resource "random_password" "app_worker" {
  length           = 32
  special          = true
  override_special = "!#%*-_=+"
}

resource "aws_secretsmanager_secret" "database" {
  name        = "${local.name}/database"
  description = "Anslutningsstrangar for API:et (app_user) och arbetaren (app_worker)"
  kms_key_id  = aws_kms_key.secrets.arn

  recovery_window_in_days = var.environment == "prod" ? 30 : 0

  tags = { Name = "${local.name}-db-secret" }
}

resource "aws_secretsmanager_secret_version" "database" {
  secret_id = aws_secretsmanager_secret.database.id

  secret_string = jsonencode({
    host        = aws_db_instance.main.address
    port        = aws_db_instance.main.port
    dbname      = aws_db_instance.main.db_name
    master_user = aws_db_instance.main.username
    master_pass = random_password.db_master.result

    # sslmode=require: klartext mot databasen är inte ett alternativ, och
    # rds.force_ssl i parametergruppen avvisar allt annat ändå.
    app_url    = "postgres://app_user:${random_password.app_user.result}@${aws_db_instance.main.endpoint}/${aws_db_instance.main.db_name}?sslmode=require"
    worker_url = "postgres://app_worker:${random_password.app_worker.result}@${aws_db_instance.main.endpoint}/${aws_db_instance.main.db_name}?sslmode=require"
  })

  lifecycle {
    # Rotation sker utanför Terraform. En plan ska inte kunna skriva
    # tillbaka ett gammalt lösenord över ett roterat.
    ignore_changes = [secret_string]
  }
}

# Platsen för integrationsnycklarna. VÄRDET SÄTTS ALDRIG HÄR.
resource "aws_secretsmanager_secret" "integrations" {
  name        = "${local.name}/integrations"
  description = "Plats for integrationsnycklar. Vardet satts i driftpanelen, aldrig i kod."
  kms_key_id  = aws_kms_key.secrets.arn

  recovery_window_in_days = var.environment == "prod" ? 30 : 0

  tags = { Name = "${local.name}-integrations-secret" }
}
