import {
  CognitoUserPool,
  CognitoUser,
  AuthenticationDetails,
  CognitoUserSession
} from "amazon-cognito-identity-js";
import { config } from "./config";

const getUserPool = () => {
  if (!config.cognitoUserPoolId || !config.cognitoClientId) {
    throw new Error("Missing Cognito configuration");
  }
  return new CognitoUserPool({
    UserPoolId: config.cognitoUserPoolId,
    ClientId: config.cognitoClientId
  });
};

const getCurrentUser = () => {
  try {
    return getUserPool().getCurrentUser();
  } catch {
    return null;
  }
};

export const signIn = (username: string, password: string): Promise<CognitoUserSession> => {
  const user = new CognitoUser({ Username: username, Pool: getUserPool() });
  const details = new AuthenticationDetails({ Username: username, Password: password });
  return new Promise((resolve, reject) => {
    user.authenticateUser(details, {
      onSuccess: (session) => resolve(session),
      onFailure: (error) => reject(error)
    });
  });
};

export const signOut = () => {
  getCurrentUser()?.signOut();
};

export const getSession = (): Promise<CognitoUserSession | null> => {
  const user = getCurrentUser();
  if (!user) return Promise.resolve(null);
  return new Promise((resolve) => {
    user.getSession((error: Error | null, session: CognitoUserSession | null) => {
      resolve(error || !session ? null : session);
    });
  });
};

export const getIdToken = async (): Promise<string | null> => {
  const session = await getSession();
  return session?.getIdToken().getJwtToken() ?? null;
};
