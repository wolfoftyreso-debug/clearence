/**
 * CLEARANCE - driftmiljön som kod.
 *
 * Kartan över allt som körs, vad det gör och varför det ser ut som det
 * gör. Besluten bakom kommer från db/README.md: allt i egen AWS-miljö,
 * inga externa beroenden utanför den om de inte är oundvikliga, och
 * radscopingen (RLS) är den garanti som aldrig får försvagas.
 *
 * Läsordning:
 *   network.tf        VPC, zoner, brandväggsregler
 *   kms.tf            krypteringsnycklar (en per datatyp)
 *   database.tf       RDS PostgreSQL - ärendedatan, RLS, journalen
 *   storage.tf        S3: dokumenten (privat) och webbappen (via CloudFront)
 *   frontend.tf       CloudFront, certifikat, WAF, DNS
 *   compute.tf        API-tjänsten och e-postarbetarens sex körningar
 *   email.tf          SES: domänidentitet, DKIM, utkorgens avsändare
 *   secrets.tf        Secrets Manager: databaslösenord, integrationsnycklar
 *   observability.tf  loggar och larm
 */

locals {
  name = "${var.project}-${var.environment}"

  tags = {
    Project     = var.project
    Environment = var.environment
    ManagedBy   = "terraform"
    Repo        = "wolfoftyreso-debug/rekonstruktion"
    DataClass   = "personuppgifter-och-affarshemligheter"
  }

  azs = slice(data.aws_availability_zones.available.names, 0, var.az_count)

  # Arbetarens sex körningar, ordagrant ur db/README.md. Tiderna är UTC;
  # kommentaren anger svensk tid vintertid, för det är så de lästes när de
  # bestämdes.
  worker_jobs = {
    send = {
      description = "Skickar det som väntar i utkorgen"
      schedule    = "rate(5 minutes)"
      args        = []
    }
    remind = {
      description = "Köar betalningspåminnelser (dubblettskyddet bor i databasen)"
      schedule    = "cron(0 * * * ? *)"
      args        = ["--remind"]
    }
    close = {
      description = "Stänger förfallna konton och köar beskedet - aldrig utan besked"
      schedule    = "cron(15 2 * * ? *)" # 03:15 svensk tid
      args        = ["--close"]
    }
    credit = {
      description = "Daglig kreditbevakning, högst en slagning per bolag och dygn"
      schedule    = "cron(30 4 * * ? *)" # 05:30 svensk tid
      args        = ["--credit"]
    }
    gallra = {
      description = "Daglig gallring (GDPR art. 5.1 e). Skuggläge tills en kategori aktiveras."
      schedule    = "cron(0 3 * * ? *)" # 04:00 svensk tid
      args        = ["--gallra"]
    }
    invoice_referrals = {
      description = "Månadsfaktura till rådgivarna, 1:a varje månad"
      schedule    = "cron(0 5 1 * ? *)" # 06:00 svensk tid
      args        = ["--invoice-referrals"]
    }
    invoice_usage = {
      description = "Samlingsfaktura per byrå: upplåsta ärenden och abonnemang"
      schedule    = "cron(0 6 1 * ? *)" # 07:00 svensk tid
      args        = ["--invoice-usage"]
    }
  }
}

data "aws_availability_zones" "available" {
  state = "available"
}

data "aws_caller_identity" "current" {}
