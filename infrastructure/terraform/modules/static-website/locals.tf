locals {
  derived_site_name = element(split(".", var.hostname), 0)
  site_name         = trimspace(var.site_name) != "" ? var.site_name : local.derived_site_name
  resource_prefix   = startswith(local.site_name, "websites-") ? local.site_name : "websites-${local.site_name}"
  bucket_name       = "${local.resource_prefix}-${replace(var.hostname, ".", "-")}"
}
