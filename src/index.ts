export type RenderMode = "sync" | "async";

export type DocuHookClientOptions = {
  /** API key (`dh_…`) from https://docuhook.com/account */
  apiKey: string;
  /** Defaults to https://docuhook.com */
  baseUrl?: string;
  /** Request timeout in ms (default 30000) */
  timeoutMs?: number;
};

export type RenderOptions = {
  mode?: RenderMode;
  filename?: string;
  /** Prefer JSON response body (default true) */
  acceptJson?: boolean;
};

export type RenderResult = {
  ok: true;
  html: string;
  filename: string;
  plan?: string;
  watermark?: boolean;
  raw: unknown;
};

export type AsyncJob = {
  ok: true;
  jobId: string;
  status: string;
  statusUrl?: string;
  resultUrl?: string;
  plan?: string;
  raw: unknown;
};

export type JobStatus = {
  jobId: string;
  status: string;
  createdAt?: string | null;
  updatedAt?: string | null;
  error?: string | null;
  hasResult?: boolean;
  raw: unknown;
};

export class DocuHookError extends Error {
  readonly status: number;
  readonly body: unknown;

  constructor(message: string, status: number, body: unknown) {
    super(message);
    this.name = "DocuHookError";
    this.status = status;
    this.body = body;
  }
}

export class DocuHookClient {
  readonly apiKey: string;
  readonly baseUrl: string;
  readonly timeoutMs: number;

  constructor(options: DocuHookClientOptions) {
    if (!options.apiKey?.trim()) {
      throw new Error("DocuHook apiKey is required");
    }
    this.apiKey = options.apiKey.trim();
    this.baseUrl = (options.baseUrl ?? "https://docuhook.com").replace(/\/$/, "");
    this.timeoutMs = options.timeoutMs ?? 30_000;
  }

  /** Merge `data` into `html` (sync) or enqueue a job (async). */
  async render(
    data: Record<string, unknown>,
    html: string,
    options: RenderOptions = {}
  ): Promise<RenderResult | AsyncJob> {
    const mode = options.mode === "async" ? "async" : "sync";
    const acceptJson = options.acceptJson !== false;

    const res = await this.request("/api/v1/render", {
      method: "POST",
      headers: acceptJson ? { Accept: "application/json" } : { Accept: "text/html" },
      body: JSON.stringify({
        mode,
        data,
        html,
        filename: options.filename ?? "document.pdf",
      }),
    });

    if (res.status === 202) {
      const json = (await res.json()) as Record<string, unknown>;
      return {
        ok: true,
        jobId: String(json.job_id ?? ""),
        status: String(json.status ?? "pending"),
        statusUrl: json.status_url ? String(json.status_url) : undefined,
        resultUrl: json.result_url ? String(json.result_url) : undefined,
        plan: json.plan ? String(json.plan) : undefined,
        raw: json,
      };
    }

    if (!res.ok) {
      await this.throwHttp(res);
    }

    const contentType = res.headers.get("content-type") ?? "";
    if (contentType.includes("application/json")) {
      const json = (await res.json()) as Record<string, unknown>;
      return {
        ok: true,
        html: String(json.html ?? ""),
        filename: String(json.filename ?? options.filename ?? "document.pdf"),
        plan: json.plan ? String(json.plan) : undefined,
        watermark: Boolean(json.watermark),
        raw: json,
      };
    }

    const text = await res.text();
    return {
      ok: true,
      html: text,
      filename: options.filename ?? "document.pdf",
      raw: text,
    };
  }

  /** Webhook-friendly alias — defaults to async (202). */
  async hookRender(
    data: Record<string, unknown>,
    html: string,
    options: Omit<RenderOptions, "mode"> & { mode?: RenderMode } = {}
  ): Promise<RenderResult | AsyncJob> {
    const mode = options.mode ?? "async";
    const acceptJson = options.acceptJson !== false;

    const res = await this.request("/api/v1/hooks/render", {
      method: "POST",
      headers: acceptJson ? { Accept: "application/json" } : { Accept: "text/html" },
      body: JSON.stringify({
        mode,
        data,
        html,
        filename: options.filename ?? "document.pdf",
      }),
    });

    if (res.status === 202) {
      const json = (await res.json()) as Record<string, unknown>;
      return {
        ok: true,
        jobId: String(json.job_id ?? ""),
        status: String(json.status ?? "pending"),
        statusUrl: json.status_url ? String(json.status_url) : undefined,
        resultUrl: json.result_url ? String(json.result_url) : undefined,
        plan: json.plan ? String(json.plan) : undefined,
        raw: json,
      };
    }

    if (!res.ok) {
      await this.throwHttp(res);
    }

    const json = (await res.json()) as Record<string, unknown>;
    return {
      ok: true,
      html: String(json.html ?? ""),
      filename: String(json.filename ?? options.filename ?? "document.pdf"),
      plan: json.plan ? String(json.plan) : undefined,
      watermark: Boolean(json.watermark),
      raw: json,
    };
  }

  async jobStatus(jobId: string): Promise<JobStatus> {
    const res = await this.request(`/api/v1/jobs/${encodeURIComponent(jobId)}`, {
      method: "GET",
      headers: { Accept: "application/json" },
    });
    if (!res.ok) {
      await this.throwHttp(res);
    }
    const json = (await res.json()) as Record<string, unknown>;
    return {
      jobId: String(json.job_id ?? jobId),
      status: String(json.status ?? ""),
      createdAt: (json.created_at as string | null | undefined) ?? null,
      updatedAt: (json.updated_at as string | null | undefined) ?? null,
      error: (json.error as string | null | undefined) ?? null,
      hasResult: Boolean(json.has_result),
      raw: json,
    };
  }

  async jobResult(jobId: string): Promise<RenderResult> {
    const res = await this.request(`/api/v1/jobs/${encodeURIComponent(jobId)}/result`, {
      method: "GET",
      headers: { Accept: "application/json" },
    });
    if (res.status === 202) {
      const json = await res.json().catch(() => ({}));
      throw new DocuHookError("Job still pending", 202, json);
    }
    if (!res.ok) {
      await this.throwHttp(res);
    }
    const json = (await res.json()) as Record<string, unknown>;
    return {
      ok: true,
      html: String(json.html ?? ""),
      filename: String(json.filename ?? "document.pdf"),
      raw: json,
    };
  }

  private async request(path: string, init: RequestInit): Promise<Response> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      return await fetch(`${this.baseUrl}${path}`, {
        ...init,
        signal: controller.signal,
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          "X-DocuHook-Key": this.apiKey,
          "Content-Type": "application/json",
          ...(init.headers ?? {}),
        },
      });
    } finally {
      clearTimeout(timer);
    }
  }

  private async throwHttp(res: Response): Promise<never> {
    let body: unknown = null;
    try {
      body = await res.json();
    } catch {
      try {
        body = await res.text();
      } catch {
        body = null;
      }
    }
    const message =
      body && typeof body === "object" && "error" in body
        ? String((body as { error: unknown }).error)
        : `DocuHook request failed (${res.status})`;
    throw new DocuHookError(message, res.status, body);
  }
}

export default DocuHookClient;
