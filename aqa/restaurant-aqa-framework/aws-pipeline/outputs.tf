output "pipeline_name" {
  description = "AWS CodePipeline name."
  value       = aws_codepipeline.qa.name
}

output "artifact_bucket_name" {
  description = "S3 bucket storing pipeline artifacts; keep it private."
  value       = aws_s3_bucket.artifacts.bucket
}
