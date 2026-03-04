import { useState, useEffect, useCallback } from "react";
import { fetchUsers, saveUser, removeUser, type UserRecord } from "../api";
import { UserList } from "./UserList";
import { UserEditor } from "./UserEditor";

export function AdminPage() {
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [editing, setEditing] = useState<UserRecord | "new" | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    fetchUsers()
      .then((users) => {
        setUsers(users);
        setError("");
      })
      .catch((err: unknown) => setError((err as Error).message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleSave = useCallback((user: UserRecord) => {
    saveUser(user)
      .then(() => {
        setEditing(null);
        load();
      })
      .catch((err: unknown) => setError((err as Error).message));
  }, [load]);

  const handleDelete = useCallback((username: string) => {
    if (!confirm(`Delete user ${username}?`)) return;
    removeUser(username)
      .then(() => load())
      .catch((err: unknown) => setError((err as Error).message));
  }, [load]);

  const handleCancel = useCallback(() => setEditing(null), []);
  const handleAdd = useCallback(() => setEditing("new" as const), []);
  const handleEdit = useCallback((u: UserRecord) => setEditing(u), []);

  if (loading) return <p>Loading...</p>;

  return (
    <div className="admin-page">
      {error && <p className="error">{error}</p>}
      {editing ? (
        <UserEditor
          user={editing === "new" ? undefined : editing}
          onSave={handleSave}
          onCancel={handleCancel}
        />
      ) : (
        <UserList
          users={users}
          onEdit={handleEdit}
          onDelete={handleDelete}
          onAdd={handleAdd}
        />
      )}
    </div>
  );
}
