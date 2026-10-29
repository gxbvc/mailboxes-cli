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
}

export function createClient(apiKeyOverride?: string): MailboxesAPI {
  return new MailboxesAPI(getApiUrl(), apiKeyOverride ?? getApiKey());
}
