# Bedrock Verification Module

This Terraform module sets up AWS infrastructure for AI-powered robot verification using Amazon Bedrock and Cognito.

## Architecture

- **Cognito Identity Pool**: Provides temporary AWS credentials to unauthenticated users
- **IAM Roles & Policies**: Grants minimal permissions to invoke Bedrock models
- **DynamoDB Table**: Rate limiting to prevent abuse
- **CloudWatch Logs**: Monitor Bedrock API usage
- **Lambda Execution Role**: For optional Lambda functions

## Usage

```hcl
module "bedrock_verification" {
  source = "./modules/bedrock-verification"

  project_name    = "robot-detector"
  bedrock_model_id = "anthropic.claude-3-5-sonnet-20241022-v2:0"
  
  allowed_origins = [
    "https://robot-detector.example.com"
  ]

  tags = {
    Environment = "production"
    Project     = "RobotDetector"
  }
}
```

## Outputs

- `identity_pool_id`: Use this in your frontend to get temporary credentials
- `aws_region`: Region where Bedrock is available
- `bedrock_model_id`: Model to invoke
- `config`: Complete configuration object for frontend

## Security Features

1. **Unauthenticated Access Only**: Users don't need accounts
2. **Scoped Permissions**: Only allows InvokeModel on specific Bedrock model
3. **Rate Limiting Table**: Track and limit API calls per identity
4. **CloudWatch Monitoring**: Track all Bedrock invocations
5. **No Data Storage**: Credentials are temporary (1 hour default)

## Frontend Integration

```javascript
// Get temporary credentials
const credentials = await Auth.federatedSignIn(
  'cognito-identity.amazonaws.com',
  {
    IdentityPoolId: '<identity_pool_id>'
  }
);

// Invoke Bedrock
const bedrock = new BedrockRuntimeClient({
  region: '<region>',
  credentials: credentials
});
```

## Rate Limiting

The DynamoDB table tracks API calls by Cognito Identity ID. Implement Lambda@Edge or a Lambda function to enforce limits (e.g., 10 requests per hour per identity).

## Costs

- **Cognito**: Free for unauthenticated identities
- **Bedrock**: Pay per token (varies by model)
- **DynamoDB**: Pay-per-request (very low cost)
- **CloudWatch**: Minimal for logging

## Required Bedrock Model Access

Ensure Bedrock model access is enabled in your AWS account:
```bash
aws bedrock list-foundation-models --region us-east-1
```

Enable model access in AWS Console: Bedrock → Model access