
# Aggregated outputs for easy CI/CD consumption
output "all_sites" {
  description = "All site details in a map for easy iteration"
  value = {
    ru-ai = module.ru-ai
  }
}