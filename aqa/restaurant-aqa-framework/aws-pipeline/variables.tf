variable "aws_region" {
  description = "AWS region for the QA pipeline."
  type        = string
  default     = "eu-north-1"
}

variable "repository_owner" {
  description = "GitHub repository owner or organization."
  type        = string
}

variable "repository_name" {
  description = "GitHub repository name."
  type        = string
}

variable "repository_branch" {
  description = "Branch that triggers the QA pipeline."
  type        = string
  default     = "main"
}

variable "github_connection_arn" {
  description = "ARN of an AWS CodeConnections connection authorized for this GitHub repository."
  type        = string
}

variable "artifact_bucket_name" {
  description = "Globally unique S3 bucket name for CodePipeline artifacts."
  type        = string
}

variable "qa_secrets_arn" {
  description = "Secrets Manager secret ARN containing the QA environment variables as JSON keys."
  type        = string
  sensitive   = true
}

variable "pipeline_name" {
  description = "Name prefix for the CodePipeline and CodeBuild resources."
  type        = string
  default     = "restaurant-aqa"
}
