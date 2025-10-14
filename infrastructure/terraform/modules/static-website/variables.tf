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

variable "prefix" {
  description = "Shared prefix applied to all resource names (e.g., websites)"
  type        = string
  default     = "websites"
}

variable "invoke_url" {
  description = "URL of the POST endpoint to hit bedrock"
  type        = string
  default     = ""
}

variable "site_name" {
  description = "Short site identifier; leave blank to derive from hostname"
  type        = string
  default     = ""
}
