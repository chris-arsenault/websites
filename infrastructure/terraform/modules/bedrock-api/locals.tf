locals {
  name_prefix = startswith(var.project_name, "websites-") ? var.project_name : "websites-${var.project_name}"
}
