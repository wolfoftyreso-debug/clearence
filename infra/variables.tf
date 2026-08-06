variable "project" {
  description = "Namnprefix på allt som skapas."
  type        = string
  default     = "clearance"
}

variable "environment" {
  description = "Miljö: prod, stage eller sandbox. Ingår i varje resursnamn."
  type        = string
  default     = "prod"

  validation {
    condition     = contains(["prod", "stage", "sandbox"], var.environment)
    error_message = "environment måste vara prod, stage eller sandbox."
  }
}

variable "aws_region" {
  description = "Region. Svensk personuppgiftsdata stannar i EU (db/README.md)."
  type        = string
  default     = "eu-north-1"

  validation {
    condition     = startswith(var.aws_region, "eu-")
    error_message = "Regionen måste ligga i EU - datalagringsbeslutet i db/README.md."
  }
}

variable "domain_name" {
  description = "Publikt värdnamn för appen, t.ex. clearance.se."
  type        = string
}

variable "hosted_zone_id" {
  description = "Route53-zonen för domain_name. Tom sträng hoppar över DNS-posterna."
  type        = string
  default     = ""
}

variable "mail_from_address" {
  description = "Avsändaradress för utkorgen (SES). Måste ligga under domain_name."
  type        = string
}

# --- Nät ---------------------------------------------------------------

variable "vpc_cidr" {
  description = "CIDR för hela VPC:n."
  type        = string
  default     = "10.40.0.0/16"
}

variable "az_count" {
  description = "Antal tillgänglighetszoner. Två är minimum för RDS multi-AZ."
  type        = number
  default     = 2

  validation {
    condition     = var.az_count >= 2 && var.az_count <= 3
    error_message = "az_count måste vara 2 eller 3."
  }
}

variable "single_nat_gateway" {
  description = "En NAT i stället för en per zon. Billigare, men en zon-punkt som kan falla."
  type        = bool
  default     = true
}

# --- Databas -----------------------------------------------------------

variable "db_instance_class" {
  description = "RDS-instansklass."
  type        = string
  default     = "db.t4g.small"
}

variable "db_allocated_storage" {
  description = "Lagring i GB. Autoskalning tar över vid behov."
  type        = number
  default     = 50
}

variable "db_max_allocated_storage" {
  description = "Tak för autoskalad lagring i GB."
  type        = number
  default     = 500
}

variable "db_backup_retention_days" {
  description = "Backupdagar. PITR gäller hela fönstret (db/README.md)."
  type        = number
  default     = 14

  validation {
    condition     = var.db_backup_retention_days >= 7
    error_message = "Minst 7 dagars backup - ärendedata får inte kunna gå förlorad tyst."
  }
}

variable "db_multi_az" {
  description = "Standby i en andra zon. På i prod."
  type        = bool
  default     = true
}

# --- Beräkning ---------------------------------------------------------

variable "enable_compute" {
  description = <<-EOT
    Startar API-tjänsten och de schemalagda arbetarkörningarna.

    STÅR PÅ false TILLS CONTAINERAVBILDERNA FINNS. Nätet, databasen,
    lagringen och e-posten går att resa idag; API-adaptern (awsAdapter mot
    DataPort) är ännu inte byggd, och en ECS-tjänst som pekar på en avbild
    som inte finns startar om i all evighet utan att säga varför.
  EOT
  type        = bool
  default     = false
}

variable "enable_google_source" {
  description = <<-EOT
    Kopplar in Google Places som källa (webbadress, omdömen, verksamhetsstatus).

    STÅR PÅ false TILLS NYCKELN FINNS. Slås den på utan att
    google_maps_api_key ligger i integrationshemligheten kan ECS inte läsa
    hemligheten, och API-uppgifterna startar om i evighet.

    Ordningen är alltså: lägg in nyckeln i hemligheten FÖRST, slå på
    flaggan sedan. Se docs/driftsattning.md.

    Med flaggan av svarar /v1/health med sources.google = false och källan
    redovisas som ej ansluten - tjänsten fungerar, analysen blir tunnare.
  EOT
  type        = bool
  default     = false
}

variable "api_image" {
  description = "Container för API:et, t.ex. <konto>.dkr.ecr.eu-north-1.amazonaws.com/clearance-api:sha."
  type        = string
  default     = ""
}

variable "worker_image" {
  description = "Container för e-postarbetaren (db/worker/email-worker.ts)."
  type        = string
  default     = ""
}

variable "api_desired_count" {
  description = "Antal API-uppgifter. Två så att en utrullning aldrig ger nedtid."
  type        = number
  default     = 2
}

variable "api_cpu" {
  description = "CPU-enheter per API-uppgift (1024 = 1 vCPU)."
  type        = number
  default     = 512
}

variable "api_memory" {
  description = "MiB per API-uppgift."
  type        = number
  default     = 1024
}

# --- Drift -------------------------------------------------------------

variable "log_retention_days" {
  description = "Hur länge CloudWatch-loggarna sparas."
  type        = number
  default     = 90
}

variable "alert_email" {
  description = "Adress som larmen går till. Tom sträng skapar ingen prenumeration."
  type        = string
  default     = ""
}
