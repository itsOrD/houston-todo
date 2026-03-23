const API = "/api";

export class ApiError extends Error {
    status!: number;

    constructor(status: number, message: string) {
        super(message);
        this.status = status;
    }
}

export function createClient(token: string | null) {
    const baseHeaders: Record<string, string> = {
        "Content-Type": "application/json",
    };
    if (token) {
        baseHeaders["Authorization"] = `Bearer ${token}`;
    }

    async function request<T>(path: string, opts: RequestInit = {}) {
        const res = await fetch(`${API}${path}`, {
            ...opts,
            headers: baseHeaders,
        });

        if (!res.ok) {
            const body = await res.json().catch(() => ({ detail: res.statusText }));
            const detail = Array.isArray(body.detail)
                ? body.detail.map((e: { msg: string }) => e.msg).join(", ")
                : body.detail || res.statusText;
            throw new ApiError(res.status, detail);
        }

        if (res.status === 204) return undefined as T; // No content
        return res.json() as Promise<T>;
    }

    return {
        get: <T>(path: string, signal?: AbortSignal) =>
            request<T>(path, { signal }),

        post: <T>(path: string, body?: unknown) =>
            request<T>(path, {
                method: "POST",
                body: body ? JSON.stringify(body) : undefined,
            }),

        put: <T>(path: string, body?: unknown) =>
            request<T>(path, {
                method: "PUT",
                body: body ? JSON.stringify(body) : undefined,
            }),

        delete: <T>(path: string) =>
            request<T>(path, { method: "DELETE" }),
    };
}
