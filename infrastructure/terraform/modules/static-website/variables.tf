variable "hostname" {
  description = "The full hostname for the website (e.g., robot-test.example.com)"
  type        = string
}

variable "domain_name" {
  description = "The root domain name (e.g., example.com)"
  type        = string
}

variable "index_html_path" {
  description = "Path to the index.html file to upload"
  type        = string
}

variable "tags" {
  description = "Tags to apply to all resources"
  type        = map(string)
  default     = {}
}