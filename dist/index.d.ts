type RenderMode = "sync" | "async";
type DocuHookClientOptions = {
    /** API key (`dh_…`) from https://docuhook.com/account */
    apiKey: string;
    /** Defaults to https://docuhook.com */
    baseUrl?: string;
    /** Request timeout in ms (default 30000) */
    timeoutMs?: number;
};
type RenderOptions = {
    mode?: RenderMode;
    filename?: string;
    /** Prefer JSON response body (default true) */
    acceptJson?: boolean;
};
type RenderResult = {
    ok: true;
    html: string;
    filename: string;
    plan?: string;
    watermark?: boolean;
    raw: unknown;
};
type AsyncJob = {
    ok: true;
    jobId: string;
    status: string;
    statusUrl?: string;
    resultUrl?: string;
    plan?: string;
    raw: unknown;
};
type JobStatus = {
    jobId: string;
    status: string;
    createdAt?: string | null;
    updatedAt?: string | null;
    error?: string | null;
    hasResult?: boolean;
    raw: unknown;
};
declare class DocuHookError extends Error {
    readonly status: number;
    readonly body: unknown;
    constructor(message: string, status: number, body: unknown);
}
declare class DocuHookClient {
    readonly apiKey: string;
    readonly baseUrl: string;
    readonly timeoutMs: number;
    constructor(options: DocuHookClientOptions);
    /** Merge `data` into `html` (sync) or enqueue a job (async). */
    render(data: Record<string, unknown>, html: string, options?: RenderOptions): Promise<RenderResult | AsyncJob>;
    /** Webhook-friendly alias — defaults to async (202). */
    hookRender(data: Record<string, unknown>, html: string, options?: Omit<RenderOptions, "mode"> & {
        mode?: RenderMode;
    }): Promise<RenderResult | AsyncJob>;
    jobStatus(jobId: string): Promise<JobStatus>;
    jobResult(jobId: string): Promise<RenderResult>;
    private request;
    private throwHttp;
}

export { type AsyncJob, DocuHookClient, type DocuHookClientOptions, DocuHookError, type JobStatus, type RenderMode, type RenderOptions, type RenderResult, DocuHookClient as default };
