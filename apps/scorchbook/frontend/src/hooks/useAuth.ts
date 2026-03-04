import { useEffect, useState, type FormEvent } from "react";
import { getSession, signIn, signOut } from "../auth";

export type AuthState = {
  status: "loading" | "signedOut" | "signedIn";
  token: string;
  username: string;
};

export function useAuth() {
  const [auth, setAuth] = useState<AuthState>({ status: "loading", token: "", username: "" });
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    getSession()
      .then((session) => {
        if (session) {
          const payload = session.getIdToken().payload as Record<string, unknown>;
          const displayName =
            (typeof payload.name === "string" && payload.name) ||
            (typeof payload.preferred_username === "string" && payload.preferred_username) ||
            (typeof payload.email === "string" && payload.email) ||
            (typeof payload["cognito:username"] === "string" && payload["cognito:username"]) ||
            "";
          setAuth({ status: "signedIn", token: session.getIdToken().getJwtToken(), username: displayName });
        } else {
          setAuth({ status: "signedOut", token: "", username: "" });
        }
      })
      .catch((error: unknown) => {
        console.error(error);
        setAuth({ status: "signedOut", token: "", username: "" });
      });
  }, []);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (menuOpen && !target.closest(".menu-container")) setMenuOpen(false);
    };
    document.addEventListener("click", handleClick);
    return () => document.removeEventListener("click", handleClick);
  }, [menuOpen]);

  const handleSignIn = (event: FormEvent<HTMLFormElement>, onError: (msg: string) => void) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const username = String(formData.get("username") ?? "");
    const password = String(formData.get("password") ?? "");
    signIn(username, password)
      .then((session) => {
        setAuth({ status: "signedIn", token: session.getIdToken().getJwtToken(), username });
        setMenuOpen(false);
      })
      .catch((error: unknown) => {
        onError((error as Error).message);
      });
  };

  const handleSignOut = (cleanup?: () => void) => {
    signOut();
    setAuth({ status: "signedOut", token: "", username: "" });
    setMenuOpen(false);
    cleanup?.();
  };

  return { auth, menuOpen, setMenuOpen, handleSignIn, handleSignOut };
}
