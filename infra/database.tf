/**
 * Databasen: PostgreSQL på RDS.
 *
 * Det här är produkten. Ärendena, journalen, besluten, handlingarnas
 * metadata, fakturorna och API-nycklarnas hashar bor här - och hela
 * säkerhetsmodellen är radskyddet (RLS) i migrationerna, inte något som
 * infrastrukturen lägger till ovanpå.
 *
 * Två saker infrastrukturen ändå måste hålla:
 *   1. Instansen är ALDRIG publik. Radskydd hjälper inte mot någon som
 *      kan ansluta som ägaren.
 *   2. force_ssl. En anslutning utan TLS är en anslutning där
 *      insolvensdata går i klartext över nätet.
 *
 * Applikationens roller (app_user utan BYPASSRLS, app_worker) skapas av
 * db/bootstrap.sql - inte här. Terraform äger maskinen, migrationerna
 * äger innehållet.
 */

resource "aws_db_subnet_group" "main" {
  name       = "${local.name}-db"
  subnet_ids = aws_subnet.data[*].id

  tags = { Name = "${local.name}-db-subnets" }
}

resource "aws_db_parameter_group" "main" {
  name   = "${local.name}-pg16"
  family = "postgres16"

  parameter {
    name  = "rds.force_ssl"
    value = "1"
  }

  # Loggar varje anslutning: vem som kopplade upp sig mot ärendedatan är
  # en revisionsfråga, inte en driftdetalj.
  parameter {
    name  = "log_connections"
    value = "1"
  }

  parameter {
    name  = "log_disconnections"
    value = "1"
  }

  # Långsamma frågor (>1 s) loggas. En fristberäkning som börjar ta
  # sekunder är en varning innan den blir ett haveri.
  parameter {
    name  = "log_min_duration_statement"
    value = "1000"
  }

  lifecycle {
    create_before_destroy = true
  }
}

resource "random_password" "db_master" {
  length  = 32
  special = true
  # Tecken som bryter en postgres://-URL hör inte hemma i ett lösenord som
  # ska in i DATABASE_URL.
  override_special = "!#%*-_=+"
}

resource "aws_db_instance" "main" {
  identifier = "${local.name}-pg"

  engine         = "postgres"
  engine_version = "16"
  instance_class = var.db_instance_class

  allocated_storage     = var.db_allocated_storage
  max_allocated_storage = var.db_max_allocated_storage
  storage_type          = "gp3"
  storage_encrypted     = true
  kms_key_id            = aws_kms_key.database.arn

  db_name  = "clearance"
  username = "clearance_admin"
  password = random_password.db_master.result
  port     = 5432

  db_subnet_group_name   = aws_db_subnet_group.main.name
  vpc_security_group_ids = [aws_security_group.database.id]
  parameter_group_name   = aws_db_parameter_group.main.name
  publicly_accessible    = false

  multi_az                = var.db_multi_az
  backup_retention_period = var.db_backup_retention_days
  backup_window           = "01:00-02:00"
  maintenance_window      = "sun:03:00-sun:04:00"
  copy_tags_to_snapshot   = true

  # PITR inom hela backupfönstret (db/README.md).
  performance_insights_enabled          = true
  performance_insights_kms_key_id       = aws_kms_key.database.arn
  performance_insights_retention_period = 7
  enabled_cloudwatch_logs_exports       = ["postgresql", "upgrade"]
  monitoring_interval                   = 60
  monitoring_role_arn                   = aws_iam_role.rds_monitoring.arn

  auto_minor_version_upgrade = true
  deletion_protection        = var.environment == "prod"
  skip_final_snapshot        = var.environment != "prod"
  final_snapshot_identifier  = var.environment == "prod" ? "${local.name}-final" : null

  tags = { Name = "${local.name}-pg" }

  lifecycle {
    # Lösenordet roteras i Secrets Manager, inte genom en ny plan.
    ignore_changes = [password]
  }
}

resource "aws_iam_role" "rds_monitoring" {
  name = "${local.name}-rds-monitoring"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Service = "monitoring.rds.amazonaws.com" }
      Action    = "sts:AssumeRole"
    }]
  })
}

resource "aws_iam_role_policy_attachment" "rds_monitoring" {
  role       = aws_iam_role.rds_monitoring.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonRDSEnhancedMonitoringRole"
}
