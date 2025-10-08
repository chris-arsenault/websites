resource "aws_bedrock_inference_profile" "model_instance_profile" {
  name = "${var.project_name}-instance-profile"

  model_source {
    copy_from = "arn:aws:bedrock:us-east-1::foundation-model/${var.bedrock_model_id}"
  }

  tags = var.tags
}