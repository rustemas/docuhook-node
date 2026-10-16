// src/index.ts
var DocuHookError = class extends Error {
  status;
  body;
  constructor(message, status, body) {
    super(message);
    this.name = "DocuHookError";
    this.status = status;
    this.body = body;
  }
};
var DocuHookClient = class {
  apiKey;
  baseUrl;
  timeoutMs;
  constructor(options) {
    if (!options.apiKey?.trim()) {
      throw new Error("DocuHook apiKey is required");
    }
    this.apiKey = options.apiKey.trim();
    this.baseUrl = (options.baseUrl ?? "https://docuhook.com").replace(/\/$/, "");
    this.timeoutMs = options.timeoutMs ?? 3e4;
  }
  /** Merge `data` into `html` (sync) or enqueue a job (async). */
  async render(data, html, options = {}) {
    const mode = options.mode === "async" ? "async" : "sync";
    const acceptJson = options.acceptJson !== false;
    const res = await this.request("/api/v1/render", {
      method: "POST",
      headers: acceptJson ? { Accept: "application/json" } : { Accept: "text/html" },
      body: JSON.stringify({
        mode,
        data,
        html,
        filename: options.filename ?? "document.pdf"
      })
    });
    if (res.status === 202) {
      const json = await res.json();
      return {
        ok: true,
        jobId: String(json.job_id ?? ""),
        status: String(json.status ?? "pending"),
        statusUrl: json.status_url ? String(json.status_url) : void 0,
        resultUrl: json.result_url ? String(json.result_url) : void 0,
        plan: json.plan ? String(json.plan) : void 0,
        raw: json
      };
    }
    if (!res.ok) {
      await this.throwHttp(res);
    }
    const contentType = res.headers.get("content-type") ?? "";
    if (contentType.includes("application/json")) {
      const json = await res.json();
      return {
        ok: true,
        html: String(json.html ?? ""),
        filename: String(json.filename ?? options.filename ?? "document.pdf"),
        plan: json.plan ? String(json.plan) : void 0,
        watermark: Boolean(json.watermark),
        raw: json
      };
    }
    const text = await res.text();
    return {
      ok: true,
      html: text,
      filename: options.filename ?? "document.pdf",
      raw: text
    };
  }
  /** Webhook-friendly alias — defaults to async (202). */
  async hookRender(data, html, options = {}) {
    const mode = options.mode ?? "async";
    const acceptJson = options.acceptJson !== false;
    const res = await this.request("/api/v1/hooks/render", {
      method: "POST",
      headers: acceptJson ? { Accept: "application/json" } : { Accept: "text/html" },
      body: JSON.stringify({
        mode,
        data,
        html,
        filename: options.filename ?? "document.pdf"
      })
    });
    if (res.status === 202) {
      const json2 = await res.json();
      return {
        ok: true,
        jobId: String(json2.job_id ?? ""),
        status: String(json2.status ?? "pending"),
        statusUrl: json2.status_url ? String(json2.status_url) : void 0,
        resultUrl: json2.result_url ? String(json2.result_url) : void 0,
        plan: json2.plan ? String(json2.plan) : void 0,
        raw: json2
      };
    }
    if (!res.ok) {
      await this.throwHttp(res);
    }
    const json = await res.json();
    return {
      ok: true,
      html: String(json.html ?? ""),
      filename: String(json.filename ?? options.filename ?? "document.pdf"),
      plan: json.plan ? String(json.plan) : void 0,
      watermark: Boolean(json.watermark),
      raw: json
    };
  }
  async jobStatus(jobId) {
    const res = await this.request(`/api/v1/jobs/${encodeURIComponent(jobId)}`, {
      method: "GET",
      headers: { Accept: "application/json" }
    });
    if (!res.ok) {
      await this.throwHttp(res);
    }
    const json = await res.json();
    return {
      jobId: String(json.job_id ?? jobId),
      status: String(json.status ?? ""),
      createdAt: json.created_at ?? null,
      updatedAt: json.updated_at ?? null,
      error: json.error ?? null,
      hasResult: Boolean(json.has_result),
      raw: json
    };
  }
  async jobResult(jobId) {
    const res = await this.request(`/api/v1/jobs/${encodeURIComponent(jobId)}/result`, {
      method: "GET",
      headers: { Accept: "application/json" }
    });
    if (res.status === 202) {
      const json2 = await res.json().catch(() => ({}));
      throw new DocuHookError("Job still pending", 202, json2);
    }
    if (!res.ok) {
      await this.throwHttp(res);
    }
    const json = await res.json();
    return {
      ok: true,
      html: String(json.html ?? ""),
      filename: String(json.filename ?? "document.pdf"),
      raw: json
    };
  }
  async request(path, init) {
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
          ...init.headers ?? {}
        }
      });
    } finally {
      clearTimeout(timer);
    }
  }
  async throwHttp(res) {
    let body = null;
    try {
      body = await res.json();
    } catch {
      try {
        body = await res.text();
      } catch {
        body = null;
      }
    }
    const message = body && typeof body === "object" && "error" in body ? String(body.error) : `DocuHook request failed (${res.status})`;
    throw new DocuHookError(message, res.status, body);
  }
};
var index_default = DocuHookClient;
export {
  DocuHookClient,
  DocuHookError,
  index_default as default
};
