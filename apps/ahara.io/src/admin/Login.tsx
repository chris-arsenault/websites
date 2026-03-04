import { useState } from "react";
import { signIn } from "../auth";

export function Login({ onLogin }: Readonly<{ onLogin: () => void }>) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = (e: React.SubmitEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    signIn(username, password)
      .then(() => onLogin())
      .catch((err: unknown) => setError((err as Error).message))
      .finally(() => setLoading(false));
  };

  return (
    <form className="login-form" onSubmit={handleSubmit}>
      <h2>Admin Login</h2>
      {error && <p className="error">{error}</p>}
      <input
        type="text"
        placeholder="Username or email"
        value={username}
        onChange={(e) => setUsername(e.target.value)}
        required
      />
      <input
        type="password"
        placeholder="Password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        required
      />
      <button type="submit" disabled={loading}>
        {loading ? "Signing in..." : "Sign In"}
      </button>
    </form>
  );
}
