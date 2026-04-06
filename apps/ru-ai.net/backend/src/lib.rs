use aws_sdk_bedrockruntime::primitives::Blob;
use aws_sdk_bedrockruntime::Client as BedrockClient;
use aws_sdk_dynamodb::types::AttributeValue;
use aws_sdk_dynamodb::types::ReturnValue;
use aws_sdk_dynamodb::Client as DynamoClient;
use chrono::Utc;
use lambda_http::{Body, Request, Response};
use serde::Deserialize;
use serde_json::{json, Value};

pub struct State {
    pub dynamo: DynamoClient,
    pub bedrock: BedrockClient,
    pub table_name: String,
    pub rate_limit: i64,
    pub model_id: String,
}

#[derive(Deserialize)]
struct InvokeRequest {
    prompt: Option<String>,
    messages: Option<Vec<Value>>,
    max_tokens: Option<i64>,
    temperature: Option<f64>,
}

pub fn cors_response(status: u16, body: Value) -> Response<Body> {
    Response::builder()
        .status(status)
        .header("Content-Type", "application/json")
        .header("Access-Control-Allow-Origin", "*")
        .header("Access-Control-Allow-Headers", "*")
        .header("Access-Control-Allow-Methods", "OPTIONS,POST")
        .body(Body::from(serde_json::to_string(&body).unwrap()))
        .unwrap()
}

pub fn get_user_id(req: &Request) -> String {
    if let Some(Ok(uid)) = req.headers().get("x-user-id").map(|v| v.to_str()) {
        let trimmed = uid.trim();
        if !trimmed.is_empty() {
            return trimmed.to_string();
        }
    }
    if let Some(Ok(fwd)) = req.headers().get("x-forwarded-for").map(|v| v.to_str()) {
        if let Some(ip) = fwd.split(',').next() {
            let trimmed = ip.trim();
            if !trimmed.is_empty() {
                return trimmed.to_string();
            }
        }
    }
    "anonymous".to_string()
}

impl State {
    pub async fn check_rate_limit(
        &self,
        user_id: &str,
    ) -> Result<(bool, i64), Box<dyn std::error::Error>> {
        let bucket = Utc::now().format("%Y%m%d%H%M").to_string();
        let pk = format!("{user_id}#{bucket}");
        let ttl = (Utc::now().timestamp() + 120).to_string();

        let result = self
            .dynamo
            .update_item()
            .table_name(&self.table_name)
            .key("pk", AttributeValue::S(pk))
            .update_expression(
                "SET #c = if_not_exists(#c, :zero) + :one, #ttl = if_not_exists(#ttl, :ttl)",
            )
            .condition_expression("attribute_not_exists(#c) OR #c < :limit")
            .expression_attribute_names("#c", "count")
            .expression_attribute_names("#ttl", "ttl")
            .expression_attribute_values(":zero", AttributeValue::N("0".to_string()))
            .expression_attribute_values(":one", AttributeValue::N("1".to_string()))
            .expression_attribute_values(":limit", AttributeValue::N(self.rate_limit.to_string()))
            .expression_attribute_values(":ttl", AttributeValue::N(ttl))
            .return_values(ReturnValue::UpdatedNew)
            .send()
            .await;

        match result {
            Ok(output) => {
                let count = output
                    .attributes()
                    .and_then(|a| a.get("count"))
                    .and_then(|v| v.as_n().ok())
                    .and_then(|n| n.parse::<i64>().ok())
                    .unwrap_or(0);
                Ok((true, count))
            }
            Err(err) => {
                let svc = err.into_service_error();
                if svc.is_conditional_check_failed_exception() {
                    Ok((false, self.rate_limit))
                } else {
                    Err(Box::new(svc))
                }
            }
        }
    }
}

pub async fn handler(state: &State, req: Request) -> Result<Response<Body>, lambda_http::Error> {
    if req.method() == lambda_http::http::Method::OPTIONS {
        return Ok(cors_response(200, json!({"ok": true})));
    }

    let user_id = get_user_id(&req);

    let (ok, count) = match state.check_rate_limit(&user_id).await {
        Ok(r) => r,
        Err(e) => {
            eprintln!("Rate limit error: {e}");
            return Ok(cors_response(500, json!({"message": "Rate limit error"})));
        }
    };

    if !ok {
        return Ok(cors_response(
            429,
            json!({"message": "Rate limit exceeded", "limit_per_minute": state.rate_limit}),
        ));
    }

    let body_str = match req.body() {
        Body::Text(s) => s.clone(),
        Body::Binary(b) => String::from_utf8_lossy(b).to_string(),
        Body::Empty => "{}".to_string(),
    };

    let payload: InvokeRequest = match serde_json::from_str(&body_str) {
        Ok(p) => p,
        Err(_) => return Ok(cors_response(400, json!({"message": "Invalid JSON body"}))),
    };

    let messages = match (payload.messages, payload.prompt) {
        (Some(msgs), _) => msgs,
        (None, Some(prompt)) if !prompt.trim().is_empty() => {
            vec![json!({"role": "user", "content": prompt})]
        }
        _ => {
            return Ok(cors_response(
                400,
                json!({"message": "Provide 'prompt' (string) or 'messages' (Anthropic format)"}),
            ));
        }
    };

    let bedrock_body = json!({
        "anthropic_version": "bedrock-2023-05-31",
        "max_tokens": payload.max_tokens.unwrap_or(256),
        "temperature": payload.temperature.unwrap_or(0.0),
        "messages": messages
    });

    let result = state
        .bedrock
        .invoke_model()
        .model_id(&state.model_id)
        .content_type("application/json")
        .accept("application/json")
        .body(Blob::new(serde_json::to_vec(&bedrock_body).unwrap()))
        .send()
        .await;

    match result {
        Ok(output) => {
            let data: Value = serde_json::from_slice(output.body().as_ref()).unwrap_or_default();
            let text = data
                .pointer("/content/0/text")
                .and_then(|v| v.as_str())
                .unwrap_or("");

            Ok(cors_response(
                200,
                json!({
                    "user_id": user_id,
                    "count_in_window": count,
                    "model_id": state.model_id,
                    "raw": data,
                    "text": text
                }),
            ))
        }
        Err(err) => {
            let code = format!("{}", err);
            let status = if code.contains("AccessDenied") || code.contains("Forbidden") {
                403
            } else {
                500
            };
            Ok(cors_response(
                status,
                json!({"message": "Bedrock error", "error": {"code": code}}),
            ))
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use lambda_http::http::Request as HttpRequest;

    fn build_request(headers: &[(&str, &str)]) -> Request {
        let mut builder = HttpRequest::builder().method("POST").uri("/invoke");
        for (k, v) in headers {
            builder = builder.header(*k, *v);
        }
        builder.body(Body::Empty).unwrap()
    }

    #[test]
    fn cors_response_sets_headers_and_status() {
        let resp = cors_response(418, json!({"ok": true}));
        assert_eq!(resp.status(), 418);
        assert_eq!(resp.headers()["Content-Type"], "application/json");
        assert_eq!(resp.headers()["Access-Control-Allow-Origin"], "*");
        assert_eq!(resp.headers()["Access-Control-Allow-Headers"], "*");
        assert_eq!(
            resp.headers()["Access-Control-Allow-Methods"],
            "OPTIONS,POST"
        );
    }

    #[test]
    fn user_id_prefers_explicit_header() {
        let req = build_request(&[("x-user-id", "alice"), ("x-forwarded-for", "1.2.3.4")]);
        assert_eq!(get_user_id(&req), "alice");
    }

    #[test]
    fn user_id_trims_whitespace() {
        let req = build_request(&[("x-user-id", "  bob  ")]);
        assert_eq!(get_user_id(&req), "bob");
    }

    #[test]
    fn user_id_falls_back_to_first_forwarded_ip() {
        let req = build_request(&[("x-forwarded-for", "1.2.3.4, 5.6.7.8")]);
        assert_eq!(get_user_id(&req), "1.2.3.4");
    }

    #[test]
    fn user_id_skips_empty_header() {
        let req = build_request(&[("x-user-id", "   "), ("x-forwarded-for", "9.9.9.9")]);
        assert_eq!(get_user_id(&req), "9.9.9.9");
    }

    #[test]
    fn user_id_defaults_to_anonymous() {
        let req = build_request(&[]);
        assert_eq!(get_user_id(&req), "anonymous");
    }
}
