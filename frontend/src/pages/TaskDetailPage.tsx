import { useState, useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { createClient } from "../api/client";
import { useAuth } from "../context/useAuth";
import type { Task } from "../hooks/useTasks";

export function TaskDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { token } = useAuth();
  const navigate = useNavigate();
  const [task, setTask] = useState<Task | null>(null);
  const [description, setDescription] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    createClient(token)
      .get<Task>(`/tasks/${id}`, controller.signal)
      .then((t) => {
        setTask(t);
        setDescription(t.description);
      })
      .catch(() => navigate("/"));
    return () => controller.abort();
  }, [id, token]);

  const handleSave = async () => {
    await createClient(token).put(`/tasks/${id}`, { description });
    navigate("/");
  };

  const handleDelete = async () => {
    await createClient(token).delete(`/tasks/${id}`);
    navigate("/");
  };

  if (!task) return <p>Loading...</p>;

  return (
    <div className="task-detail-page">
      <Link to="/">← Back to list</Link>
      <h2>Task Detail</h2>
      <textarea
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        rows={4}
      />
      <label>
        <input
          type="checkbox"
          checked={task.completed}
          onChange={async () => {
            const updated = { ...task, completed: !task.completed };
            setTask(updated);
            await createClient(token).put(`/tasks/${id}`, {
              completed: updated.completed,
            });
          }}
        />
        Completed
      </label>
      <div className="actions">
        <button onClick={handleSave}>Save</button>
        <button onClick={handleDelete} className="danger">
          Delete
        </button>
      </div>
    </div>
  );
}
