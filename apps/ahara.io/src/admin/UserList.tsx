import type { UserRecord } from "../api";

type Props = {
  users: UserRecord[];
  onEdit: (user: UserRecord) => void;
  onDelete: (username: string) => void;
  onAdd: () => void;
};

export function UserList({ users, onEdit, onDelete, onAdd }: Readonly<Props>) {
  return (
    <div className="user-list">
      <div className="user-list-header">
        <h2>Users</h2>
        <button className="btn btn-primary" onClick={onAdd}>Add User</button>
      </div>
      <table>
        <thead>
          <tr>
            <th>Email</th>
            <th>Name</th>
            <th>Apps</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {users.map((u) => (
            <tr key={u.username}>
              <td>{u.username}</td>
              <td>{u.displayName ?? "\u2014"}</td>
              <td>
                {Object.entries(u.apps ?? {})
                  .map(([k, v]) => `${k}:${v}`)
                  .join(", ") || "none"}
              </td>
              <td className="actions-cell">
                <button onClick={() => onEdit(u)}>Edit</button>
                <button onClick={() => onDelete(u.username)}>Delete</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
