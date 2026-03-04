import { useState } from "react";
import type { UserRecord } from "../api";

const APP_KEYS = ["scorchbook", "svap", "canonry", "ahara"];
const DEFAULT_ROLE = "admin";

type Props = {
  user?: UserRecord;
  onSave: (user: UserRecord) => void;
  onCancel: () => void;
};

export function UserEditor({ user, onSave, onCancel }: Props) {
  const [username, setUsername] = useState(user?.username ?? "");
  const [displayName, setDisplayName] = useState(user?.displayName ?? "");
  const [apps, setApps] = useState<Record<string, string>>(user?.apps ?? {});

  const toggleApp = (key: string) => {
    setApps((prev) => {
      const next = { ...prev };
      if (next[key]) {
        delete next[key];
      } else {
        next[key] = DEFAULT_ROLE;
      }
      return next;
    });
  };

  const setRole = (key: string, role: string) => {
    setApps((prev) => ({ ...prev, [key]: role }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({ username, displayName, apps });
  };

  return (
    <form className="user-editor" onSubmit={handleSubmit}>
      <h3>{user ? "Edit User" : "Add User"}</h3>
      <label>
        Email
        <input
          type="email"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          disabled={!!user}
          required
        />
      </label>
      <label>
        Display Name
        <input
          type="text"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
        />
      </label>
      <fieldset>
        <legend>App Access</legend>
        {APP_KEYS.map((key) => (
          <div key={key} className="app-toggle">
            <label>
              <input
                type="checkbox"
                checked={!!apps[key]}
                onChange={() => toggleApp(key)}
              />
              {key}
            </label>
            {apps[key] && (
              <select value={apps[key]} onChange={(e) => setRole(key, e.target.value)}>
                <option value="admin">admin</option>
                <option value="readonly">readonly</option>
              </select>
            )}
          </div>
        ))}
      </fieldset>
      <div className="editor-actions">
        <button type="submit">Save</button>
        <button type="button" onClick={onCancel}>Cancel</button>
      </div>
    </form>
  );
}
