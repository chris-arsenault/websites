locals {
  normalized_prefix = trimspace(var.prefix)
  derived_site_name = element(split(".", var.hostname), 0)
  configured_site   = trimspace(var.site_name)
  site_name         = local.configured_site != "" ? local.configured_site : local.derived_site_name
  resource_prefix   = local.normalized_prefix != "" ? "${local.normalized_prefix}-${local.site_name}" : local.site_name
  bucket_name       = "${local.resource_prefix}-${replace(var.hostname, ".", "-")}"
  default_tags = merge(
    var.tags,
    {
      Site = local.site_name
    },
    local.normalized_prefix != "" ? { ProjectPrefix = local.normalized_prefix } : {}
  )

  mime_types = {
    ".html" = "text/html"
    ".css"  = "text/css"
    ".js"   = "application/javascript"
    ".json" = "application/json"
    ".svg"  = "image/svg+xml"
    ".png"  = "image/png"
    ".jpg"  = "image/jpeg"
    ".jpeg" = "image/jpeg"
    ".gif"  = "image/gif"
    ".ico"  = "image/x-icon"
    ".xml"  = "application/xml"
    ".txt"  = "text/plain"
    ".pdf"  = "application/pdf"
    ".woff" = "font/woff"
    ".woff2" = "font/woff2"
    ".ttf"  = "font/ttf"
    ".eot"  = "application/vnd.ms-fontobject"
  }
}
