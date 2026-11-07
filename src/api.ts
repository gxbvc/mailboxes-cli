import { getApiKey, getApiUrl } from "./config.js";

export class MailboxesAPI {
  constructor(private baseUrl: string, private apiKey: string) {}

  private async request(method: string, path: string, body?: Record<string, any> | FormData, params?: Record<string, string>): Promise<any> {
    let url = `${this.baseUrl}${path}`;
    if (params) {
      const searchParams = new URLSearchParams(params);
      url += `?${searchParams.toString()}`;
    }

    const headers: Record<string, string> = {
      Authorization: `Bearer ${this.apiKey}`,
      Accept: "application/json",
    };

    const init: RequestInit = { method, headers };

    if (body instanceof FormData) {
      // Multipart: fetch sets the Content-Type with the boundary itself.
      init.body = body;
    } else if (body && (method === "POST" || method === "PATCH" || method === "PUT")) {
      headers["Content-Type"] = "application/json";
      init.body = JSON.stringify(body);
    }

    const response = await fetch(url, init);
    const json = await response.json().catch(() => null);

    if (!response.ok) {
      const message = json?.error || json?.message || `HTTP ${response.status} ${response.statusText}`;
      // The server's stable code (provider_rejected, not_texted_first, ...)
      // rides on the Error so the commands can print it.
      if (json?.error_code) {
        const err = new Error(message) as Error & { code?: string };
        err.code = json.error_code;
        throw err;
      }
      throw new Error(message);
    }

    return json;
  }

  async get(path: string, params?: Record<string, string>): Promise<any> {
    return this.request("GET", path, undefined, params);
  }

  async post(path: string, body?: Record<string, any>): Promise<any> {
    return this.request("POST", path, body);
  }

  async postForm(path: string, form: FormData): Promise<any> {
    return this.request("POST", path, form);
  }

  async patch(path: string, body?: Record<string, any>): Promise<any> {
    return this.request("PATCH", path, body);
  }

  async delete(path: string): Promise<any> {
    return this.request("DELETE", path);
  }

  // Bytes of one attachment or voice memo (mailboxes PR 36). The key goes
  // only to the configured API host: a redirect is refused, never followed.
  async download(path: string, maxBytes: number): Promise<{ data: Buffer; contentType: string }> {
    if (!/^\/api\/v1\/(mailbox\/)?messages\/\d+\/(attachments\/\d+|voice_memo)$/.test(path)) {
      throw new Error("refused: not an attachment path");
    }
    // The key is only ever sent over https (Security, Nov 7).
    if (!/^https:\/\/[^/]+$/i.test(this.baseUrl.replace(/\/+$/, ""))) {
      throw new Error("refused: the API URL is not https");
    }
    const response = await fetch(`${this.baseUrl}${path}`, {
      method: "GET",
      headers: { Authorization: `Bearer ${this.apiKey}` },
      redirect: "manual",
    });
    if (response.status >= 300 && response.status < 400) throw new Error(`refused: redirect (HTTP ${response.status})`);
    if (!response.ok) {
      const json = await response.json().catch(() => null);
      throw new Error(json?.error || `HTTP ${response.status}`);
    }
    const declared = Number(response.headers.get("content-length") || 0);
    if (declared > maxBytes) throw new Error(`refused: larger than ${maxBytes} bytes`);
    // Stream with a running count, so a response without Content-Length
    // cannot fill memory past the cap (Security, Nov 7).
    const chunks: Buffer[] = [];
    let total = 0;
    if (response.body) {
      const reader = response.body.getReader();
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        total += value.length;
        if (total > maxBytes) {
          await reader.cancel().catch(() => {});
          throw new Error(`refused: larger than ${maxBytes} bytes`);
        }
        chunks.push(Buffer.from(value));
      }
    }
    const data = Buffer.concat(chunks);
    return { data, contentType: (response.headers.get("content-type") || "").split(";")[0] };
  }
}

export function createClient(apiKeyOverride?: string): MailboxesAPI {
  return new MailboxesAPI(getApiUrl(), apiKeyOverride ?? getApiKey());
}
