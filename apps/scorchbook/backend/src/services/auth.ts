import { CognitoJwtVerifier } from "aws-jwt-verify";
import type { UserContext } from "../types";
import { logWarn } from "../utils/logger";

let verifier: ReturnType<typeof CognitoJwtVerifier.create> | null = null;

const getVerifier = () => {
  if (verifier) {
    return verifier;
  }
  const userPoolId = process.env.COGNITO_USER_POOL_ID;
  const clientId = process.env.COGNITO_CLIENT_ID;
  if (!userPoolId || !clientId) {
    throw new Error("Missing Cognito configuration");
  }
  verifier = CognitoJwtVerifier.create({
    userPoolId,
    clientId,
    tokenUse: "id"
  });
  return verifier;
};

export const verifyAuth = async (authorization?: string): Promise<UserContext> => {
  if (!authorization) {
    throw new Error("Missing Authorization header");
  }
  const token = authorization.replace(/^Bearer\s+/i, "").trim();
  if (!token) {
    throw new Error("Missing Bearer token");
  }

  try {
    const verifierInstance = getVerifier();
    const payload = await verifierInstance.verify(token);
    return {
      sub: payload.sub,
      email: payload.email
    };
  } catch (error) {
    logWarn("auth.verify.failed", { error: (error as Error).message });
    throw new Error("Invalid token");
  }
};
