import { useState, useEffect, useCallback } from "react";
import { fetchUsers, saveUser, removeUser, type UserRecord } from "../api";
import { UserList } from "./UserList";
import { UserEditor } from "./UserEditor";

export function AdminPage() {
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [editing, setEditing] = useState<UserRecord | "new" | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setUsers(await fetchUsers());
      setError("");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleSave = async (user: UserRecord) => {
    try {
      await saveUser(user);
      setEditing(null);
      await load();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const handleDelete = async (username: string) => {
    if (!confirm(`Delete user ${username}?`)) return;
    try {
      await removeUser(username);
      await load();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  if (loading) return <p>Loading...</p>;

  return (
    <div className="admin-page">
      {error && <p className="error">{error}</p>}
      {editing ? (
        <UserEditor
          user={editing === "new" ? undefined : editing}
          onSave={handleSave}
          onCancel={() => setEditing(null)}
        />
      ) : (
        <UserList
          users={users}
          onEdit={(u) => setEditing(u)}
          onDelete={handleDelete}
          onAdd={() => setEditing("new")}
        />
      )}
    </div>
  );
}
