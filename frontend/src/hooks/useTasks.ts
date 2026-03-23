import { useState, useEffect, useCallback } from "react";
import { createClient } from "../api/client";
import { useAuth } from "../context/useAuth";

export interface Task {
  id: string;
  description: string;
  completed: boolean;
  position: number;
}

export function useTasks() {
  const { token } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const client = createClient(token);

  const fetchTasks = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    try {
      const data = await client.get<Task[]>("/tasks", signal);
      setTasks(data);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    const controller = new AbortController();
    fetchTasks(controller.signal);
    return () => controller.abort();
  }, [fetchTasks]);

  const create = useCallback(async (description: string) => {
    const task = await client.post<Task>("/tasks", { description });
    setTasks(prev => [...prev, task]);
    return task;
  }, [token]);

  const update = useCallback(async (id: string, data: Partial<Task>) => {
    // Optimistic update
    setTasks(prev => prev.map(t => t.id === id ? { ...t, ...data } : t));
    try {
      await client.put(`/tasks/${id}`, data);
    } catch {
      fetchTasks(); // Rollback on failure
    }
  }, [token]);

  const remove = useCallback(async (id: string) => {
    setTasks(prev => prev.filter(t => t.id !== id));
    await client.delete(`/tasks/${id}`);
  }, [token]);

  const reorder = useCallback(async (taskIds: string[]) => {
    setTasks(prev => taskIds.map((id, i) => {
      const task = prev.find(t => t.id === id)!;
      return { ...task, position: i };
    }));
    await client.put("/tasks/reorder", { task_ids: taskIds });
  }, [token]);

  return { tasks, loading, create, update, remove, reorder };
}