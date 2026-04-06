use aws_sdk_bedrockruntime::Client as BedrockClient;
use aws_sdk_dynamodb::Client as DynamoClient;
use lambda_http::{run, service_fn};
use proxy::{handler, State};
use std::env;

#[tokio::main]
async fn main() -> Result<(), lambda_http::Error> {
    let config = aws_config::load_defaults(aws_config::BehaviorVersion::latest()).await;

    let bedrock_region = env::var("BEDROCK_REGION").unwrap_or_else(|_| "us-east-1".to_string());
    let bedrock_config = aws_sdk_bedrockruntime::config::Builder::from(&config)
        .region(aws_sdk_bedrockruntime::config::Region::new(bedrock_region))
        .build();

    let state = State {
        dynamo: DynamoClient::new(&config),
        bedrock: BedrockClient::from_conf(bedrock_config),
        table_name: env::var("TABLE_NAME").expect("TABLE_NAME required"),
        rate_limit: env::var("RATE_LIMIT_PER_MINUTE")
            .unwrap_or_else(|_| "30".to_string())
            .parse()
            .unwrap_or(30),
        model_id: env::var("MODEL_ID").expect("MODEL_ID required"),
    };

    run(service_fn(|req| handler(&state, req))).await
}
