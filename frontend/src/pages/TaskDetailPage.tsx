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
  const [error, setError] = useState("");

  useEffect(() => {
    if (!token || !id) return;
    const controller = new AbortController();
    createClient(token)
      .get<Task>(`/tasks/${id}`, controller.signal)
      .then((t) => {
        setTask(t);
        setDescription(t.description);
      })
      .catch((err) => {
        if (err.name === "AbortError") return;
        navigate("/");
      });
    return () => controller.abort();
  }, [id, token, navigate]);

  const handleSave = async () => {
    if (!token || !id) return;
    try {
      await createClient(token).put(`/tasks/${id}`, { description });
      navigate("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    }
  };

  const handleToggle = async () => {
    if (!token || !id || !task) return;
    const updated = { ...task, completed: !task.completed };
    setTask(updated);
    try {
      await createClient(token).put(`/tasks/${id}`, { completed: updated.completed });
    } catch {
      setTask(task);
    }
  };

  const handleDelete = async () => {
    if (!token || !id) return;
    try {
      await createClient(token).delete(`/tasks/${id}`);
      navigate("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete");
    }
  };

  if (!task) return <p>Loading...</p>;

  return (
    <div className="task-detail-page">
      <Link to="/">← Back to list</Link>
      <h2>Task Detail</h2>
      {error && <p className="error">{error}</p>}
      <textarea
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        rows={4}
      />
      <label>
        <input
          type="checkbox"
          checked={task.completed}
          onChange={handleToggle}
        />
        Completed
      </label>
      <div className="actions">
        <button onClick={handleSave}>Save</button>
        <button onClick={handleDelete} className="danger">Delete</button>
      </div>
    </div>
  );
}
