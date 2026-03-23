import { useState, useEffect, useCallback } from "react";
import { createClient } from "../api/client";
import { useAuth } from "../context/useAuth";

export interface Account {
  id: string;
  name: string;
  credits_used: number;
  credits_total: number;
  reset_frequency: string;
  reset_time: string;
  timezone: string;
}

export function useAccounts() {
  const { token } = useAuth();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAccounts = useCallback(async (signal?: AbortSignal) => {
    if (!token) return;
    setLoading(true);
    try {
      const data = await createClient(token).get<Account[]>("/accounts", signal);
      setAccounts(data);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    const controller = new AbortController();
    fetchAccounts(controller.signal);
    return () => controller.abort();
  }, [fetchAccounts]);

  const create = useCallback(
    async (data: Omit<Account, "id" | "credits_used">) => {
      if (!token) return;
      const account = await createClient(token).post<Account>("/accounts", data);
      setAccounts((prev) => [...prev, account]);
      return account;
    },
    [token],
  );

  // Optimistic credit update
  const updateCredits = useCallback(
    async (id: string, credits_used: number) => {
      if (!token) return;
      setAccounts((prev) =>
        prev.map((a) => (a.id === id ? { ...a, credits_used } : a)),
      );
      await createClient(token).put(`/accounts/${id}`, { credits_used });
    },
    [token],
  );

  const remove = useCallback(
    async (id: string) => {
      if (!token) return;
      setAccounts((prev) => prev.filter((a) => a.id !== id));
      await createClient(token).delete(`/accounts/${id}`);
    },
    [token],
  );

  return { accounts, loading, create, updateCredits, remove };
}
