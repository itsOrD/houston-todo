import { useState, useEffect, useCallback } from "react";
import { createClient } from "../api/client";
import { useAuth } from "../context/useAuth";

export interface Task {
  id: string;
  description: string;
  completed: boolean;
  position: number;
  account_id: string | null;
}

export function useTasks() {
  const { token } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchTasks = useCallback(async (signal?: AbortSignal) => {
    if (!token) return;
    setLoading(true);
    try {
      const data = await createClient(token).get<Task[]>("/tasks", signal);
      setTasks(data);
    } finally {
      setLoading(false);
    }
  }, [token]);

  // AbortController cleanup — cancels in-flight request on unmount
  useEffect(() => {
    const controller = new AbortController();
    fetchTasks(controller.signal);
    return () => controller.abort();
  }, [fetchTasks]);

  const create = useCallback(
    async (description: string, account_id: string | null = null) => {
      if (!token) return;
      const task = await createClient(token).post<Task>("/tasks", {
        description,
        account_id,
      });
      setTasks((prev) => [...prev, task]);
      return task;
    },
    [token],
  );

  // Optimistic update with rollback on failure
  const update = useCallback(
    async (id: string, data: Partial<Task>) => {
      if (!token) return;
      setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, ...data } : t)));
      try {
        await createClient(token).put(`/tasks/${id}`, data);
      } catch {
        fetchTasks();
      }
    },
    [token, fetchTasks],
  );

  const remove = useCallback(
    async (id: string) => {
      if (!token) return;
      setTasks((prev) => prev.filter((t) => t.id !== id));
      await createClient(token).delete(`/tasks/${id}`);
    },
    [token],
  );

  return { tasks, loading, create, update, remove };
}
