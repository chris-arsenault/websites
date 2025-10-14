locals {
  normalized_prefix = trimspace(var.prefix)
  normalized_site   = trimspace(var.site_name)
  resource_prefix   = local.normalized_prefix != "" ? "${local.normalized_prefix}-${local.normalized_site}" : local.normalized_site
  default_tags = merge(
    var.tags,
    {
      Site = local.normalized_site
    },
    local.normalized_prefix != "" ? { ProjectPrefix = local.normalized_prefix } : {}
  )
}
