import {
  createContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from "react";
import { createClient } from "../api/client";

interface User {
  id: string;
  name: string;
  email: string;
}

export interface AuthContextType {
  user: User | null;
  token: string | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  logout: () => void;
}

export const AuthContext = createContext<AuthContextType | null>(null); // eslint-disable-line

function saveToken(t: string) {
  localStorage.setItem("token", t);
}

function clearToken() {
  localStorage.removeItem("token");
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(() =>
    localStorage.getItem("token"),
  );
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(() => !!localStorage.getItem("token"));

  useEffect(() => {
    if (!token) return;

    const controller = new AbortController();
    const client = createClient(token);

    client
      .get<User>("/auth/me", controller.signal)
      .then((me) => {
        setUser(me);
        setLoading(false);
      })
      .catch((err) => {
        if (err.name === "AbortError") return;
        clearToken();
        setToken(null);
        setLoading(false);
      });

    return () => controller.abort();
  }, [token]);

  const login = useCallback(async (email: string, password: string) => {
    const client = createClient(null);
    const res = await client.post<{ token: string }>("/auth/login", {
      email,
      password,
    });
    const { token } = res;
    saveToken(token);
    setToken(token);
  }, []);

  const register = useCallback(
    async (name: string, email: string, password: string) => {
      const client = createClient(null);
      const res = await client.post<{ token: string }>("/auth/register", {
        name,
        email,
        password,
      });
      const { token } = res;
      saveToken(token);
      setToken(token);
    },
    [],
  );

  const logout = useCallback(() => {
    if (token) {
      createClient(token)
        .post("/auth/logout")
        .catch(() => {});
    }
    clearToken();
    setToken(null);
    setUser(null);
  }, [token]);

  return (
    <AuthContext.Provider
      value={{ user, token, loading, login, register, logout }}
    >
      {children}
    </AuthContext.Provider>
  );
}
