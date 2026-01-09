import os
import json
import time
import base64
import boto3
from botocore.exceptions import ClientError
from datetime import datetime, timezone

DDB_TABLE = os.environ["TABLE_NAME"]
RATE_LIMIT = int(os.environ.get("RATE_LIMIT_PER_MINUTE", "30"))
MODEL_ID = os.environ["MODEL_ID"]
BEDROCK_REGION = os.environ.get("BEDROCK_REGION")

dynamodb = boto3.resource("dynamodb")
table = dynamodb.Table(DDB_TABLE)
brt = boto3.client("bedrock-runtime", region_name=BEDROCK_REGION)

def _minute_bucket(now: datetime) -> str:
    return now.strftime("%Y%m%d%H%M")  # e.g. 20251007T2012 -> "202510072012"

def _rate_limit_key(user_id: str, now: datetime) -> str:
    return f"{user_id}#{_minute_bucket(now)}"

def _json_response(status, body, cors=True):
    headers = {"Content-Type": "application/json"}
    if cors:
        headers.update({
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Headers": "*",
            "Access-Control-Allow-Methods": "OPTIONS,POST"
        })
    return {
        "statusCode": status,
        "headers": headers,
        "body": json.dumps(body)
    }

def _get_user_id(event):
    # Prefer explicit header; fall back to JWT sub if behind an authorizer; else IP
    headers = event.get("headers") or {}
    uid = headers.get("x-user-id") or headers.get("X-User-Id")
    if uid:
        return uid.strip()
    req_ctx = event.get("requestContext") or {}
    auth = (req_ctx.get("authorizer") or {}).get("jwt") or {}
    claims = auth.get("claims") or {}
    if "sub" in claims:
        return claims["sub"]
    # Fallback to source IP for anonymous users
    http = req_ctx.get("http") or {}
    return http.get("sourceIp", "anonymous")

def _check_and_increment(user_id: str, now: datetime):
    """
    Fixed-window rate limit: per user per minute.
    Uses conditional update to prevent exceeding RATE_LIMIT.
    """
    pk = _rate_limit_key(user_id, now)
    ttl = int(time.time()) + 120  # expire ~2 minutes after window start

    try:
        resp = table.update_item(
            Key={"pk": pk},
            UpdateExpression="SET #c = if_not_exists(#c, :zero) + :one, #ttl = if_not_exists(#ttl, :ttl)",
            ConditionExpression="attribute_not_exists(#c) OR #c < :limit",
            ExpressionAttributeNames={"#c": "count", "#ttl": "ttl"},
            ExpressionAttributeValues={":zero": 0, ":one": 1, ":limit": RATE_LIMIT, ":ttl": ttl},
            ReturnValues="UPDATED_NEW"
        )
        return True, resp["Attributes"]["count"]
    except ClientError as e:
        print(e)
        if e.response["Error"]["Code"] == "ConditionalCheckFailedException":
            return False, RATE_LIMIT
        raise

def handler(event, context):
    # Health check
    if event.get("requestContext", {}).get("http", {}).get("method") == "OPTIONS":
        return _json_response(200, {"ok": True})


    user_id = _get_user_id(event)
    print(f"UserId: {user_id}")
    now = datetime.now(timezone.utc)

    ok, count = _check_and_increment(user_id, now)
    print(f"count: {count}")

    if not ok:
        return _json_response(429, {"message": "Rate limit exceeded", "limit_per_minute": RATE_LIMIT})

    try:
        body = event.get("body") or "{}"
        if event.get("isBase64Encoded"):
            body = base64.b64decode(body).decode("utf-8")
        payload = json.loads(body)
    except Exception:
        return _json_response(400, {"message": "Invalid JSON body"})

    # Expect either a simple { "prompt": "..." } OR pass-through 'messages' for Anthropic format
    prompt = payload.get("prompt")
    messages = payload.get("messages")

    if messages is None:
        if not isinstance(prompt, str) or not prompt.strip():
            return _json_response(400, {"message": "Provide 'prompt' (string) or 'messages' (Anthropic format)"})
        # Build minimal Anthropic-style messages array
        messages = [{"role": "user", "content": prompt}]

    bedrock_body = {
        "anthropic_version": "bedrock-2023-05-31",
        "max_tokens": int(payload.get("max_tokens", 256)),
        "temperature": float(payload.get("temperature", 0)),
        "messages": messages
    }

    try:
        resp = brt.invoke_model(
            modelId=MODEL_ID,
            contentType="application/json",
            accept="application/json",
            body=json.dumps(bedrock_body)
        )
        # resp["body"] is a StreamingBody; read and decode
        raw = resp["body"].read()
        data = json.loads(raw)

        # Normalize a small response for clients
        text = ""
        try:
            # Anthropic on Bedrock: list of content blocks with .text
            text = (data.get("content") or [{}])[0].get("text", "")
        except Exception:
            pass

        return _json_response(200, {
            "user_id": user_id,
            "count_in_window": int(count),
            "model_id": MODEL_ID,
            "raw": data,
            "text": text
        })

    except ClientError as e:
        status = 403 if e.response["Error"]["Code"] in {"AccessDeniedException", "ForbiddenException"} else 500
        return _json_response(status, {"message": "Bedrock error", "error": e.response["Error"]})
    except Exception as e:
        return _json_response(500, {"message": "Unhandled error", "error": str(e)})
