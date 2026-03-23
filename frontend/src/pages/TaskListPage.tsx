import { useState, useMemo } from "react";
import { useAuth } from "../context/useAuth";
import { useTasks } from "../hooks/useTasks";
import { pipe, filterByCompleted, sortByPosition } from "../utils/helpers";

export function TaskListPage() {
  const { user, logout } = useAuth();
  const { tasks, loading, create, update, remove } = useTasks();
  const [newTask, setNewTask] = useState("");
  const [filter, setFilter] = useState<boolean | null>(null);

  // Composable filter pipeline — pipe + curried HOF
  const filteredTasks = useMemo(
    () => pipe(filterByCompleted(filter), sortByPosition)(tasks),
    [tasks, filter],
  );

  // Stats via reduce
  const stats = useMemo(
    () =>
      tasks.reduce(
        (acc, t) => ({
          ...acc,
          [t.completed ? "done" : "todo"]:
            acc[t.completed ? "done" : "todo"] + 1,
        }),
        { done: 0, todo: 0 },
      ),
    [tasks],
  );

  const handleAdd = async () => {
    if (!newTask.trim()) return;
    await create(newTask.trim());
    setNewTask("");
  };

  if (loading) return <p>Loading tasks...</p>;

  return (
    <div className="task-list-page">
      <header>
        <h1>Houston</h1>
        <span>Welcome, {user?.name}</span>
        <button onClick={logout}>Logout</button>
      </header>

      <div className="stats">
        <span>{stats.todo} active</span> · <span>{stats.done} completed</span>
      </div>

      <div className="add-task">
        <input
          value={newTask}
          onChange={(e) => setNewTask(e.target.value)}
          placeholder="New task..."
          onKeyDown={(e) => e.key === "Enter" && handleAdd()}
        />
        <button onClick={handleAdd}>Add</button>
      </div>

      <div className="filters">
        <button onClick={() => setFilter(null)} className={filter === null ? "active" : ""}>All</button>
        <button onClick={() => setFilter(false)} className={filter === false ? "active" : ""}>Active</button>
        <button onClick={() => setFilter(true)} className={filter === true ? "active" : ""}>Done</button>
      </div>

      <ul className="tasks">
        {filteredTasks.map((task) => (
          <li key={task.id} className={task.completed ? "completed" : ""}>
            <input
              type="checkbox"
              checked={task.completed}
              onChange={() => update(task.id, { completed: !task.completed })}
            />
            <span className="task-desc">{task.description}</span>
            <button onClick={() => remove(task.id)} className="delete">×</button>
          </li>
        ))}
      </ul>
    </div>
  );
}
