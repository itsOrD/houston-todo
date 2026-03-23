import { useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/useAuth";
import { useTasks, type Task } from "../hooks/useTasks";
import { useAccounts } from "../hooks/useAccounts";
import { pipe, filterByCompleted, sortByPosition, computeStatus } from "../utils/helpers";

export function TaskListPage() {
  const { user, logout } = useAuth();
  const { tasks, loading, create, update, remove } = useTasks();
  const { accounts, create: createAccount, updateCredits, remove: removeAccount } = useAccounts();

  const [newTask, setNewTask] = useState("");
  const [taskAccountId, setTaskAccountId] = useState<string | null>(null);
  const [filter, setFilter] = useState<boolean | null>(null);

  // Add account form
  const [showAddAccount, setShowAddAccount] = useState(false);
  const [acctName, setAcctName] = useState("");
  const [acctCredits, setAcctCredits] = useState(100);
  const [acctFreq, setAcctFreq] = useState("daily");
  const [acctTime, setAcctTime] = useState("00:00");
  const [acctTz, setAcctTz] = useState("UTC");

  // Composable filter pipeline — pipe + curried HOF
  const filteredTasks = useMemo(
    () => pipe<Task[]>(filterByCompleted(filter), sortByPosition)(tasks),
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

  const handleAddTask = async () => {
    if (!newTask.trim()) return;
    await create(newTask.trim(), taskAccountId);
    setNewTask("");
  };

  const handleAddAccount = async () => {
    if (!acctName.trim()) return;
    await createAccount({
      name: acctName.trim(),
      credits_total: acctCredits,
      reset_frequency: acctFreq,
      reset_time: acctTime,
      timezone: acctTz,
    });
    setAcctName("");
    setShowAddAccount(false);
  };

  if (loading) return <p>Loading tasks...</p>;

  return (
    <div className="task-list-page">
      <header>
        <h1>Houston</h1>
        <span>Welcome, {user?.name}</span>
        <button onClick={logout}>Logout</button>
      </header>

      {/* ── AI Account Dashboard ─────────────────────────────── */}
      <section className="accounts-section">
        <div className="section-header">
          <h2>AI Accounts</h2>
          <button onClick={() => setShowAddAccount(!showAddAccount)}>
            {showAddAccount ? "Cancel" : "+ Add Account"}
          </button>
        </div>

        {showAddAccount && (
          <div className="add-account-form">
            <input
              placeholder="Account name (e.g. Claude, ChatGPT)"
              value={acctName}
              onChange={(e) => setAcctName(e.target.value)}
            />
            <label>
              Credits:
              <input
                type="number"
                value={acctCredits}
                onChange={(e) => setAcctCredits(Number(e.target.value))}
                min={1}
              />
            </label>
            <label>
              Reset:
              <select value={acctFreq} onChange={(e) => setAcctFreq(e.target.value)}>
                <option value="daily">Daily</option>
                <option value="monthly">Monthly</option>
                <option value="none">None</option>
              </select>
            </label>
            <label>
              Time:
              <input
                type="time"
                value={acctTime}
                onChange={(e) => setAcctTime(e.target.value)}
              />
            </label>
            <label>
              Timezone:
              <select value={acctTz} onChange={(e) => setAcctTz(e.target.value)}>
                <option value="UTC">UTC</option>
                <option value="America/New_York">Eastern</option>
                <option value="America/Chicago">Central</option>
                <option value="America/Denver">Mountain</option>
                <option value="America/Los_Angeles">Pacific</option>
              </select>
            </label>
            <button onClick={handleAddAccount}>Save Account</button>
          </div>
        )}

        <div className="accounts-grid">
          {accounts.map((acct) => {
            const status = computeStatus(acct.credits_used, acct.credits_total);
            const remaining = acct.credits_total - acct.credits_used;
            return (
              <div key={acct.id} className={`account-card status-${status}`}>
                <div className="account-header">
                  <strong>{acct.name}</strong>
                  <span className={`status-badge ${status}`}>{status.toUpperCase()}</span>
                </div>
                <div className="credit-row">
                  <button
                    onClick={() => updateCredits(acct.id, Math.max(0, acct.credits_used - 1))}
                  >
                    −
                  </button>
                  <span>
                    {remaining} / {acct.credits_total} credits
                  </span>
                  <button
                    onClick={() =>
                      updateCredits(acct.id, Math.min(acct.credits_total, acct.credits_used + 1))
                    }
                  >
                    +
                  </button>
                </div>
                <div className="account-meta">
                  Resets {acct.reset_frequency} at {acct.reset_time} ({acct.timezone})
                </div>
                <button className="danger" onClick={() => removeAccount(acct.id)}>
                  Remove
                </button>
              </div>
            );
          })}
        </div>
      </section>

      {/* ── Task List ────────────────────────────────────────── */}
      <section className="tasks-section">
        <h2>Mission Tasks</h2>

        <div className="stats">
          <span>{stats.todo} active</span> · <span>{stats.done} completed</span>
        </div>

        <div className="add-task">
          <input
            value={newTask}
            onChange={(e) => setNewTask(e.target.value)}
            placeholder="New task..."
            onKeyDown={(e) => e.key === "Enter" && handleAddTask()}
          />
          <select
            value={taskAccountId ?? ""}
            onChange={(e) => setTaskAccountId(e.target.value || null)}
          >
            <option value="">No account</option>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
          <button onClick={handleAddTask}>Add</button>
        </div>

        <div className="filters">
          <button onClick={() => setFilter(null)} className={filter === null ? "active" : ""}>All</button>
          <button onClick={() => setFilter(false)} className={filter === false ? "active" : ""}>Active</button>
          <button onClick={() => setFilter(true)} className={filter === true ? "active" : ""}>Done</button>
        </div>

        <ul className="tasks">
          {filteredTasks.map((task) => {
            const acct = accounts.find((a) => a.id === task.account_id);
            return (
              <li key={task.id} className={task.completed ? "completed" : ""}>
                <input
                  type="checkbox"
                  checked={task.completed}
                  onChange={() => update(task.id, { completed: !task.completed })}
                />
                <Link to={`/tasks/${task.id}`} className="task-desc">{task.description}</Link>
                {acct && <span className="task-account-tag">{acct.name}</span>}
                <button onClick={() => remove(task.id)} className="delete">×</button>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}
