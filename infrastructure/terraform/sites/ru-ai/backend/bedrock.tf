resource "aws_bedrock_inference_profile" "model_instance_profile" {
  name = "${local.resource_prefix}-instance-profile"

  model_source {
    copy_from = "arn:aws:bedrock:us-east-1::foundation-model/${local.bedrock_model_id}"
  }

  tags = merge(local.default_tags, {
    Name = "${local.resource_prefix}-instance-profile"
  })
}
