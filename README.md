# @docuhook/node

Official [DocuHook](https://docuhook.com) client for Node.js — merge JSON into HTML templates via the API.

```bash
npm install @docuhook/node
```

```js
import { DocuHookClient } from "@docuhook/node";

const client = new DocuHookClient({ apiKey: process.env.DOCUHOOK_API_KEY });

const result = await client.render(
  { invoice: { number: "INV-1" } },
  "<h1>{{invoice.number}}</h1>"
);

console.log(result.html);
```

## Async / webhooks

```js
const job = await client.render(data, html, { mode: "async" });
// or: await client.hookRender(data, html);

const status = await client.jobStatus(job.jobId);
const done = await client.jobResult(job.jobId);
```

API docs: [docuhook.com](https://docuhook.com/#api)
