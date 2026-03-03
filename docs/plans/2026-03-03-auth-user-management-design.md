# Auth & User Management Design

## Problem

Apps in this project share a single Cognito user pool, but any user can authenticate through any app client. We need centralized per-app access control without apps having to implement anything.

## Solution

A Pre-Authentication Lambda trigger on the Cognito user pool enforces access at login time. A DynamoDB table stores which users can access which apps (and their role per app). An admin UI on ahara.io manages users and their app assignments.

## Data Model

DynamoDB table `websites-user-access`, hash key `username` (email):

```json
{
  "username": "alice@example.com",
  "displayName": "Alice",
  "apps": {
    "scorchbook": "admin",
    "svap": "readonly"
  }
}
```

- Absence of app key = no access
- Role values are freeform strings (default: `"admin"`)
- RBAC enforcement comes later via Pre-Token Generation trigger

## Pre-Auth Lambda Trigger

- Attached to the Cognito user pool as a Pre-Authentication trigger
- Receives `event.callerContext.clientId` and `event.userName`
- Looks up user in DynamoDB, checks if clientId maps to an allowed app
- Needs a mapping of clientId -> app key (passed via env vars)
- Returns event to allow, throws to deny
- Runtime: Node.js, same pattern as other lambdas

## ahara.io Admin UI

ahara.io gains:
- Its own Cognito app client (`ahara` key in the clients map)
- A backend API at `api.ahara.io` (new `api-http` module instance)
- Switch from `static-website` to `spa-website` for runtime config

### API Endpoints

| Route | Description |
|---|---|
| `GET /users` | List all users from DynamoDB + Cognito status |
| `PUT /users/{username}` | Create/update user access (also creates Cognito user if new) |
| `DELETE /users/{username}` | Remove user from DynamoDB + disable in Cognito |

API authenticates via Cognito ID token (same as scorchbook). Pre-Auth trigger restricts who can use the ahara client.

### Frontend

- Unauthenticated: existing portfolio site
- Authenticated: user management dashboard
  - User list with app assignments
  - Add/edit user: email, display name, toggle apps, set roles
  - Uses `amazon-cognito-identity-js` for auth (same as scorchbook)

### Cognito User Lifecycle

When admin creates a user in the UI:
1. API writes to DynamoDB (access record)
2. API calls `AdminCreateUser` to create Cognito user (sends invite email)
3. User receives temporary password, logs in, sets permanent password

When admin removes a user:
1. API deletes DynamoDB record
2. API calls `AdminDisableUser` in Cognito

## Infrastructure Changes

- New DynamoDB table via existing `dynamo-table` module
- New Lambda for Pre-Auth trigger (not behind API Gateway — direct Cognito invocation)
- New `api-http` module instance for ahara.io API
- Cognito module updated to support `lambda_config` for Pre-Auth trigger
- ahara.io switched from `static-website` to `spa-website`
- New Cognito client: `ahara`

## What Apps Do

Nothing. If a user has a valid JWT, they're allowed. No app code changes needed.
