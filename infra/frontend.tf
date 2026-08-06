/**
 * Webbappens väg ut: CloudFront framför en privat S3-hink.
 *
 * Appen är en enfilsapplikation med klientsidans routing, så allt som
 * inte är en fil måste svara med index.html - annars ger en direktlänk
 * till /dashboard/samtal en 404 i stället för samtalet.
 *
 * Säkerhetsrubrikerna sätts här och inte i appen: en rubrik som bara
 * finns i utvecklingsservern skyddar ingen i drift.
 */

resource "aws_cloudfront_origin_access_control" "web" {
  name                              = "${local.name}-web-oac"
  description                       = "CloudFront -> privat S3-hink, ingen publik vag runt"
  origin_access_control_origin_type = "s3"
  signing_behavior                  = "always"
  signing_protocol                  = "sigv4"
}

resource "aws_acm_certificate" "web" {
  provider = aws.us_east_1

  domain_name               = var.domain_name
  subject_alternative_names = ["www.${var.domain_name}"]
  validation_method         = "DNS"

  lifecycle {
    create_before_destroy = true
  }

  tags = { Name = "${local.name}-cert" }
}

resource "aws_cloudfront_response_headers_policy" "security" {
  name    = "${local.name}-security-headers"
  comment = "Sakerhetsrubriker for hela appen"

  security_headers_config {
    strict_transport_security {
      access_control_max_age_sec = 63072000
      include_subdomains         = true
      preload                    = true
      override                   = true
    }

    content_type_options {
      override = true
    }

    frame_options {
      frame_option = "DENY"
      override     = true
    }

    referrer_policy {
      referrer_policy = "strict-origin-when-cross-origin"
      override        = true
    }

    # Bygget gör noll externa anrop (verifieras av npm run test:external),
    # så policyn kan hållas strikt: allt kommer från samma ursprung.
    # 'unsafe-inline' för style krävs av Tailwinds runtime-variabler.
    content_security_policy {
      content_security_policy = join("; ", [
        "default-src 'self'",
        "img-src 'self' data: blob:",
        "style-src 'self' 'unsafe-inline'",
        "font-src 'self'",
        "connect-src 'self'",
        "frame-src 'self' blob:",
        # 'self' blob: - INTE 'none'. Rapportvisaren bäddar in PDF:en med
        # <object data={blob-url}>, och med 'none' blockeras den av vår
        # egen policy i produktion. Reservrutan hade då skyllt på
        # webbläsaren ("visar inte inbäddade PDF:er här") när det i
        # själva verket var vi som stoppade den - ett falskt besked om
        # vår egen konfiguration.
        "object-src 'self' blob:",
        "base-uri 'self'",
        "form-action 'self'",
        "frame-ancestors 'none'",
      ])
      override = true
    }
  }
}

resource "aws_cloudfront_distribution" "web" {
  enabled             = true
  is_ipv6_enabled     = true
  comment             = "${local.name}: webbappen"
  default_root_object = "index.html"
  price_class         = "PriceClass_100" # EU + Nordamerika räcker för en svensk tjänst
  aliases             = [var.domain_name, "www.${var.domain_name}"]
  web_acl_id          = aws_wafv2_web_acl.cloudfront.arn

  origin {
    domain_name              = aws_s3_bucket.web.bucket_regional_domain_name
    origin_id                = "web-bucket"
    origin_access_control_id = aws_cloudfront_origin_access_control.web.id
  }

  default_cache_behavior {
    target_origin_id       = "web-bucket"
    viewer_protocol_policy = "redirect-to-https"
    allowed_methods        = ["GET", "HEAD", "OPTIONS"]
    cached_methods         = ["GET", "HEAD"]
    compress               = true

    # AWS-hanterade policyer: CachingOptimized respektive CORS-S3Origin.
    cache_policy_id            = "658327ea-f89d-4fab-a63d-7e88639e58f6"
    origin_request_policy_id   = "88a5eaf4-2fd4-4709-b370-b4c650ea3fcf"
    response_headers_policy_id = aws_cloudfront_response_headers_policy.security.id
  }

  # Enfilsapplikationen: djupa länkar ska nå appen, inte en felsida.
  custom_error_response {
    error_code            = 403
    response_code         = 200
    response_page_path    = "/index.html"
    error_caching_min_ttl = 0
  }

  custom_error_response {
    error_code            = 404
    response_code         = 200
    response_page_path    = "/index.html"
    error_caching_min_ttl = 0
  }

  viewer_certificate {
    acm_certificate_arn      = aws_acm_certificate.web.arn
    ssl_support_method       = "sni-only"
    minimum_protocol_version = "TLSv1.2_2021"
  }

  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }

  logging_config {
    bucket          = aws_s3_bucket.logs.bucket_domain_name
    prefix          = "cloudfront/"
    include_cookies = false
  }

  tags = { Name = "${local.name}-cdn" }
}

# WAF måste ligga i us-east-1 för CloudFront.
resource "aws_wafv2_web_acl" "cloudfront" {
  provider = aws.us_east_1

  name  = "${local.name}-cdn-waf"
  scope = "CLOUDFRONT"

  default_action {
    allow {}
  }

  rule {
    name     = "AWSManagedCommonRules"
    priority = 1

    override_action {
      none {}
    }

    statement {
      managed_rule_group_statement {
        vendor_name = "AWS"
        name        = "AWSManagedRulesCommonRuleSet"
      }
    }

    visibility_config {
      cloudwatch_metrics_enabled = true
      metric_name                = "common-rules"
      sampled_requests_enabled   = true
    }
  }

  rule {
    name     = "AWSManagedKnownBadInputs"
    priority = 2

    override_action {
      none {}
    }

    statement {
      managed_rule_group_statement {
        vendor_name = "AWS"
        name        = "AWSManagedRulesKnownBadInputsRuleSet"
      }
    }

    visibility_config {
      cloudwatch_metrics_enabled = true
      metric_name                = "known-bad-inputs"
      sampled_requests_enabled   = true
    }
  }

  # Takfrekvens per IP. Inloggningen och den publika live-länken är de
  # ytor där någon annars kan gissa sig fram i lugn och ro.
  rule {
    name     = "Takfrekvens"
    priority = 3

    action {
      block {}
    }

    statement {
      rate_based_statement {
        limit              = 2000
        aggregate_key_type = "IP"
      }
    }

    visibility_config {
      cloudwatch_metrics_enabled = true
      metric_name                = "rate-limit"
      sampled_requests_enabled   = true
    }
  }

  visibility_config {
    cloudwatch_metrics_enabled = true
    metric_name                = "${local.name}-cdn-waf"
    sampled_requests_enabled   = true
  }

  tags = { Name = "${local.name}-cdn-waf" }
}

# --- DNS ---------------------------------------------------------------

resource "aws_route53_record" "web" {
  count = var.hosted_zone_id == "" ? 0 : 1

  zone_id = var.hosted_zone_id
  name    = var.domain_name
  type    = "A"

  alias {
    name                   = aws_cloudfront_distribution.web.domain_name
    zone_id                = aws_cloudfront_distribution.web.hosted_zone_id
    evaluate_target_health = false
  }
}

resource "aws_route53_record" "web_www" {
  count = var.hosted_zone_id == "" ? 0 : 1

  zone_id = var.hosted_zone_id
  name    = "www.${var.domain_name}"
  type    = "A"

  alias {
    name                   = aws_cloudfront_distribution.web.domain_name
    zone_id                = aws_cloudfront_distribution.web.hosted_zone_id
    evaluate_target_health = false
  }
}
