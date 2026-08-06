/**
 * Beräkningen: API-tjänsten och e-postarbetarens sex körningar.
 *
 * ALLT HÄR ÄR SLÄCKT TILLS var.enable_compute = true, av ett ärligt skäl:
 * arbetaren finns (db/worker/email-worker.ts, byggd med npm run
 * build:worker), men API:et gör inte det ännu - awsAdapter mot DataPort
 * är nästa steg efter migreringen. En ECS-tjänst som pekar på en avbild
 * som inte finns startar om i evighet utan att förklara varför.
 *
 * Rollerna är åtskilda med flit:
 *   execution_role  hämtar avbilden och skriver loggar (AWS-standard)
 *   api_task        läser databaslösenordet, signerar dokument-URL:er
 *   worker_task     läser databaslösenordet och integrationsnycklarna,
 *                   skickar e-post - men rör ALDRIG dokumenthinken
 *
 * Arbetaren ansluter som app_worker, aldrig som superanvändare
 * (db/README.md). Terraform ger den bara vägen; rollen kommer ur
 * db/bootstrap.sql.
 */

resource "aws_ecs_cluster" "main" {
  name = local.name

  setting {
    name  = "containerInsights"
    value = "enabled"
  }

  tags = { Name = local.name }
}

# --- Roller ------------------------------------------------------------

data "aws_iam_policy_document" "ecs_assume" {
  statement {
    effect  = "Allow"
    actions = ["sts:AssumeRole"]

    principals {
      type        = "Service"
      identifiers = ["ecs-tasks.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "execution" {
  name               = "${local.name}-ecs-execution"
  assume_role_policy = data.aws_iam_policy_document.ecs_assume.json
}

resource "aws_iam_role_policy_attachment" "execution" {
  role       = aws_iam_role.execution.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy"
}

resource "aws_iam_role_policy" "execution_secrets" {
  name = "las-hemligheter-vid-start"
  role = aws_iam_role.execution.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect   = "Allow"
        Action   = ["secretsmanager:GetSecretValue"]
        Resource = [aws_secretsmanager_secret.database.arn]
      },
      {
        Effect   = "Allow"
        Action   = ["kms:Decrypt"]
        Resource = [aws_kms_key.secrets.arn]
      },
    ]
  })
}

resource "aws_iam_role" "api_task" {
  name               = "${local.name}-api-task"
  assume_role_policy = data.aws_iam_policy_document.ecs_assume.json
}

resource "aws_iam_role_policy" "api_task" {
  name = "api-behorigheter"
  role = aws_iam_role.api_task.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "SigneraOchLagraHandlingar"
        Effect = "Allow"
        Action = [
          "s3:GetObject",
          "s3:PutObject",
          "s3:DeleteObject",
          "s3:ListBucket",
        ]
        Resource = [
          aws_s3_bucket.documents.arn,
          "${aws_s3_bucket.documents.arn}/*",
        ]
      },
      {
        Sid      = "KrypteraHandlingar"
        Effect   = "Allow"
        Action   = ["kms:Decrypt", "kms:GenerateDataKey"]
        Resource = [aws_kms_key.documents.arn]
      },
      {
        Sid    = "SkickaBekraftelsemejl"
        Effect = "Allow"
        Action = ["ses:SendEmail", "ses:SendRawEmail"]
        Resource = [
          aws_sesv2_email_identity.domain.arn,
          "arn:aws:ses:${var.aws_region}:${data.aws_caller_identity.current.account_id}:configuration-set/${aws_sesv2_configuration_set.main.configuration_set_name}",
        ]
      },
    ]
  })
}

resource "aws_iam_role" "worker_task" {
  name               = "${local.name}-worker-task"
  assume_role_policy = data.aws_iam_policy_document.ecs_assume.json
}

resource "aws_iam_role_policy" "worker_task" {
  name = "arbetarens-behorigheter"
  role = aws_iam_role.worker_task.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "SkickaUtkorgen"
        Effect = "Allow"
        Action = ["ses:SendEmail", "ses:SendRawEmail"]
        Resource = [
          aws_sesv2_email_identity.domain.arn,
          "arn:aws:ses:${var.aws_region}:${data.aws_caller_identity.current.account_id}:configuration-set/${aws_sesv2_configuration_set.main.configuration_set_name}",
        ]
      },
    ]
  })
}

# --- Lastbalanseraren --------------------------------------------------

resource "aws_lb" "api" {
  count = var.enable_compute ? 1 : 0

  name               = "${local.name}-alb"
  load_balancer_type = "application"
  internal           = false
  security_groups    = [aws_security_group.alb.id]
  subnets            = aws_subnet.public[*].id

  drop_invalid_header_fields = true
  enable_deletion_protection = var.environment == "prod"

  access_logs {
    bucket  = aws_s3_bucket.logs.bucket
    prefix  = "alb"
    enabled = true
  }

  tags = { Name = "${local.name}-alb" }
}

resource "aws_lb_target_group" "api" {
  count = var.enable_compute ? 1 : 0

  name        = "${local.name}-api"
  port        = 8080
  protocol    = "HTTP"
  target_type = "ip"
  vpc_id      = aws_vpc.main.id

  health_check {
    # API:ets rutter ligger under /v1 - hälsorutten också. Med "/health"
    # här hade varje uppgift underkänts och dödats i en loop, och det
    # enda symtomet vore en driftsättning som aldrig blir klar.
    path                = "/v1/health"
    healthy_threshold   = 2
    unhealthy_threshold = 3
    timeout             = 5
    interval            = 15
    matcher             = "200"
  }

  deregistration_delay = 30

  tags = { Name = "${local.name}-api-tg" }
}

resource "aws_acm_certificate" "api" {
  count = var.enable_compute ? 1 : 0

  domain_name       = "api.${var.domain_name}"
  validation_method = "DNS"

  lifecycle {
    create_before_destroy = true
  }

  tags = { Name = "${local.name}-api-cert" }
}

resource "aws_lb_listener" "api_https" {
  count = var.enable_compute ? 1 : 0

  load_balancer_arn = aws_lb.api[0].arn
  port              = 443
  protocol          = "HTTPS"
  ssl_policy        = "ELBSecurityPolicy-TLS13-1-2-2021-06"
  certificate_arn   = aws_acm_certificate.api[0].arn

  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.api[0].arn
  }
}

# --- API-tjänsten ------------------------------------------------------

resource "aws_ecs_task_definition" "api" {
  count = var.enable_compute ? 1 : 0

  family                   = "${local.name}-api"
  requires_compatibilities = ["FARGATE"]
  network_mode             = "awsvpc"
  cpu                      = var.api_cpu
  memory                   = var.api_memory
  execution_role_arn       = aws_iam_role.execution.arn
  task_role_arn            = aws_iam_role.api_task.arn

  container_definitions = jsonencode([{
    name      = "api"
    image     = var.api_image
    essential = true

    portMappings = [{
      containerPort = 8080
      protocol      = "tcp"
    }]

    environment = [
      { name = "NODE_ENV", value = "production" },
      { name = "AWS_REGION", value = var.aws_region },
      { name = "DOCUMENTS_BUCKET", value = aws_s3_bucket.documents.bucket },
      { name = "APP_BASE_URL", value = "https://${var.domain_name}" },
      { name = "MAIL_FROM", value = var.mail_from_address },
    ]

    # Lösenordet når containern som hemlighet, aldrig som miljövariabel i
    # en plan eller en avbild.
    secrets = [
      { name = "DATABASE_URL", valueFrom = "${aws_secretsmanager_secret.database.arn}:app_url::" },
    ]

    logConfiguration = {
      logDriver = "awslogs"
      options = {
        "awslogs-group"         = aws_cloudwatch_log_group.api.name
        "awslogs-region"        = var.aws_region
        "awslogs-stream-prefix" = "api"
      }
    }
  }])

  tags = { Name = "${local.name}-api" }
}

resource "aws_ecs_service" "api" {
  count = var.enable_compute ? 1 : 0

  name            = "${local.name}-api"
  cluster         = aws_ecs_cluster.main.id
  task_definition = aws_ecs_task_definition.api[0].arn
  desired_count   = var.api_desired_count
  launch_type     = "FARGATE"

  network_configuration {
    subnets          = aws_subnet.private[*].id
    security_groups  = [aws_security_group.api.id]
    assign_public_ip = false
  }

  load_balancer {
    target_group_arn = aws_lb_target_group.api[0].arn
    container_name   = "api"
    container_port   = 8080
  }

  # Rullande utrullning utan nedtid: den gamla uppgiften lever tills den
  # nya svarar på hälsokontrollen.
  deployment_minimum_healthy_percent = 100
  deployment_maximum_percent         = 200
  enable_execute_command             = false

  depends_on = [aws_lb_listener.api_https]

  tags = { Name = "${local.name}-api" }
}

# --- E-postarbetaren ---------------------------------------------------

resource "aws_ecs_task_definition" "worker" {
  count = var.enable_compute ? 1 : 0

  family                   = "${local.name}-worker"
  requires_compatibilities = ["FARGATE"]
  network_mode             = "awsvpc"
  cpu                      = 256
  memory                   = 512
  execution_role_arn       = aws_iam_role.execution.arn
  task_role_arn            = aws_iam_role.worker_task.arn

  container_definitions = jsonencode([{
    name      = "worker"
    image     = var.worker_image
    essential = true

    environment = [
      { name = "SES_REGION", value = var.aws_region },
      { name = "MAIL_FROM", value = var.mail_from_address },
      { name = "APP_BASE_URL", value = "https://${var.domain_name}" },
    ]

    secrets = [
      { name = "DATABASE_URL", valueFrom = "${aws_secretsmanager_secret.database.arn}:worker_url::" },
    ]

    logConfiguration = {
      logDriver = "awslogs"
      options = {
        "awslogs-group"         = aws_cloudwatch_log_group.worker.name
        "awslogs-region"        = var.aws_region
        "awslogs-stream-prefix" = "worker"
      }
    }
  }])

  tags = { Name = "${local.name}-worker" }
}

resource "aws_iam_role" "scheduler" {
  name = "${local.name}-scheduler"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Service = "scheduler.amazonaws.com" }
      Action    = "sts:AssumeRole"
    }]
  })
}

resource "aws_iam_role_policy" "scheduler" {
  name = "starta-arbetaren"
  role = aws_iam_role.scheduler.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect   = "Allow"
        Action   = ["ecs:RunTask"]
        Resource = var.enable_compute ? ["${aws_ecs_task_definition.worker[0].arn_without_revision}:*"] : ["*"]
      },
      {
        Effect   = "Allow"
        Action   = ["iam:PassRole"]
        Resource = [aws_iam_role.execution.arn, aws_iam_role.worker_task.arn]
      },
    ]
  })
}

# De sex körningarna ur db/README.md, var och en med sin egen tid och sin
# egen orsak. Se local.worker_jobs i main.tf.
resource "aws_scheduler_schedule" "worker" {
  for_each = var.enable_compute ? local.worker_jobs : {}

  name        = "${local.name}-${replace(each.key, "_", "-")}"
  description = each.value.description
  group_name  = "default"

  flexible_time_window {
    mode = "OFF"
  }

  schedule_expression          = each.value.schedule
  schedule_expression_timezone = "Europe/Stockholm"

  target {
    arn      = aws_ecs_cluster.main.arn
    role_arn = aws_iam_role.scheduler.arn

    ecs_parameters {
      task_definition_arn = aws_ecs_task_definition.worker[0].arn
      launch_type         = "FARGATE"
      task_count          = 1

      network_configuration {
        subnets          = aws_subnet.private[*].id
        security_groups  = [aws_security_group.worker.id]
        assign_public_ip = false
      }
    }

    input = jsonencode({
      containerOverrides = [{
        name    = "worker"
        command = concat(["node", "db/dist/email-worker.cjs"], each.value.args)
      }]
    })

    retry_policy {
      maximum_retry_attempts = 2
    }
  }
}
