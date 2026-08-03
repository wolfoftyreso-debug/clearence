/**
 * Utgående e-post: SES.
 *
 * Valet står i db/README.md: e-post till borgenärer MÅSTE komma fram. En
 * egen SMTP-server utan uppvärmt avsändarrykte hamnar i skräpposten, och
 * ett fakturamejl i skräpposten är en betalningsanmärkning som inte
 * behövde hända.
 *
 * Innehållet kommer alltid ur utkorgen (public.outbound_emails) via
 * arbetaren - aldrig direktanrop från appen. Raden skapas i samma
 * transaktion som fakturan, så det kan inte finnas ett mejl om en faktura
 * som inte finns.
 */

resource "aws_sesv2_email_identity" "domain" {
  email_identity = var.domain_name

  dkim_signing_attributes {
    next_signing_key_length = "RSA_2048_BIT"
  }

  tags = { Name = "${local.name}-ses" }
}

# DKIM-posterna. Utan dem signeras inte mejlen, och osignerad post från en
# ny domän läses som skräp.
resource "aws_route53_record" "dkim" {
  count = var.hosted_zone_id == "" ? 0 : 3

  zone_id = var.hosted_zone_id
  name    = "${aws_sesv2_email_identity.domain.dkim_signing_attributes[0].tokens[count.index]}._domainkey.${var.domain_name}"
  type    = "CNAME"
  ttl     = 600
  records = ["${aws_sesv2_email_identity.domain.dkim_signing_attributes[0].tokens[count.index]}.dkim.amazonses.com"]
}

# DMARC i "quarantine": någon som förfalskar avsändaren i vårt namn mot en
# borgenär ska inte lyckas. Bolaget i kris är redan utsatt nog.
resource "aws_route53_record" "dmarc" {
  count = var.hosted_zone_id == "" ? 0 : 1

  zone_id = var.hosted_zone_id
  name    = "_dmarc.${var.domain_name}"
  type    = "TXT"
  ttl     = 600
  records = ["v=DMARC1; p=quarantine; rua=mailto:dmarc@${var.domain_name}; fo=1"]
}

resource "aws_route53_record" "spf" {
  count = var.hosted_zone_id == "" ? 0 : 1

  zone_id = var.hosted_zone_id
  name    = var.domain_name
  type    = "TXT"
  ttl     = 600
  records = ["v=spf1 include:amazonses.com -all"]
}

resource "aws_sesv2_configuration_set" "main" {
  configuration_set_name = local.name

  delivery_options {
    tls_policy = "REQUIRE"
  }

  reputation_options {
    reputation_metrics_enabled = true
  }

  sending_options {
    sending_enabled = true
  }

  tags = { Name = "${local.name}-ses-config" }
}

# Studsar och klagomål måste synas. Utkorgen märker en rad som failed
# efter fem försök och den plockas aldrig om automatiskt - men driften
# behöver veta att en borgenärsadress studsar, inte gissa.
resource "aws_sns_topic" "email_events" {
  name              = "${local.name}-email-events"
  kms_master_key_id = aws_kms_key.secrets.id

  tags = { Name = "${local.name}-email-events" }
}

resource "aws_sesv2_configuration_set_event_destination" "sns" {
  configuration_set_name = aws_sesv2_configuration_set.main.configuration_set_name
  event_destination_name = "studsar-och-klagomal"

  event_destination {
    enabled              = true
    matching_event_types = ["BOUNCE", "COMPLAINT", "REJECT", "DELIVERY_DELAY"]

    sns_destination {
      topic_arn = aws_sns_topic.email_events.arn
    }
  }
}
