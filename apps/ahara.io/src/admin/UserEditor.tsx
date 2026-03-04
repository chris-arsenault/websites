import { useCallback, useState } from "react";
import type { UserRecord } from "../api";

const APP_KEYS = ["scorchbook", "svap", "canonry", "ahara"];
const DEFAULT_ROLE = "admin";

const toggleAppKey = (prev: Record<string, string>, key: string) => {
  const next = { ...prev };
  if (next[key]) { delete next[key]; } else { next[key] = DEFAULT_ROLE; }
  return next;
};

function AppAccessFieldset({ apps, onToggle, onRoleChange }: Readonly<{
  apps: Record<string, string>;
  onToggle: (key: string) => void;
  onRoleChange: (key: string, role: string) => void;
}>) {
  return (
    <fieldset>
      <legend>App Access</legend>
      {APP_KEYS.map((key) => (
        <div key={key} className="app-toggle">
          <label>
            <input type="checkbox" checked={!!apps[key]} onChange={() => onToggle(key)} />
            {key}
          </label>
          {apps[key] && (
            <select value={apps[key]} onChange={(e) => onRoleChange(key, e.target.value)}>
              <option value="admin">admin</option>
              <option value="readonly">readonly</option>
            </select>
          )}
        </div>
      ))}
    </fieldset>
  );
}

function IdentityFields({ isNew, username, setUsername, email, setEmail, password, setPassword, displayName, setDisplayName }: Readonly<{
  isNew: boolean;
  username: string; setUsername: (v: string) => void;
  email: string; setEmail: (v: string) => void;
  password: string; setPassword: (v: string) => void;
  displayName: string; setDisplayName: (v: string) => void;
}>) {
  return (
    <>
      <label>
        Username
        <input type="text" value={username} onChange={(e) => setUsername(e.target.value)} disabled={!isNew} required />
      </label>
      <label>
        Email (optional)
        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
      </label>
      {isNew && (
        <label>
          Password
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} />
        </label>
      )}
      <label>
        Display Name
        <input type="text" value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
      </label>
    </>
  );
}

type Props = {
  user?: UserRecord;
  onSave: (user: UserRecord) => void;
  onCancel: () => void;
};

export function UserEditor({ user, onSave, onCancel }: Readonly<Props>) {
  const isNew = !user;
  const [username, setUsername] = useState(user?.username ?? "");
  const [email, setEmail] = useState(user?.email ?? "");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState(user?.displayName ?? "");
  const [apps, setApps] = useState<Record<string, string>>(user?.apps ?? {});

  const handleToggle = useCallback((k: string) => setApps((p) => toggleAppKey(p, k)), []);
  const handleRoleChange = useCallback((k: string, r: string) => setApps((p) => ({ ...p, [k]: r })), []);

  const handleSubmit = (e: React.SubmitEvent) => {
    e.preventDefault();
    onSave({ username, email: email || undefined, displayName, apps, ...(isNew && password ? { password } : {}) });
  };

  return (
    <form className="user-editor" onSubmit={handleSubmit}>
      <h3>{user ? "Edit User" : "Add User"}</h3>
      <IdentityFields
        isNew={isNew} username={username} setUsername={setUsername}
        email={email} setEmail={setEmail} password={password} setPassword={setPassword}
        displayName={displayName} setDisplayName={setDisplayName}
      />
      <AppAccessFieldset apps={apps} onToggle={handleToggle} onRoleChange={handleRoleChange} />
      <div className="editor-actions">
        <button type="submit">Save</button>
        <button type="button" onClick={onCancel}>Cancel</button>
      </div>
    </form>
  );
}
