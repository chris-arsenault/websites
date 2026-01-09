variable "hostname" {
  description = "The full hostname for the website (e.g., example.com)"
  type        = string
}

variable "domain_name" {
  description = "The root domain name (e.g., example.com)"
  type        = string
}

variable "site_directory_path" {
  description = "Path to the directory containing all website files"
  type        = string
}

variable "runtime_config" {
  description = "Runtime config emitted as config.js"
  type        = map(any)
  default     = {}
}
