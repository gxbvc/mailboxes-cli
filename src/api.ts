import { getApiKey, getApiUrl } from "./config.js";

class MailboxesAPI {
  constructor(private baseUrl: string, private apiKey: string) {}

  private async request(method: string, path: string, body?: Record<string, any>, params?: Record<string, string>): Promise<any> {
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

    if (body && (method === "POST" || method === "PATCH" || method === "PUT")) {
      headers["Content-Type"] = "application/json";
      init.body = JSON.stringify(body);
    }

    const response = await fetch(url, init);
    const json = await response.json().catch(() => null);

    if (!response.ok) {
      const message = json?.error || json?.message || `HTTP ${response.status} ${response.statusText}`;
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

  async patch(path: string, body?: Record<string, any>): Promise<any> {
    return this.request("PATCH", path, body);
  }

  async delete(path: string): Promise<any> {
    return this.request("DELETE", path);
  }
}

export function createClient(): MailboxesAPI {
  return new MailboxesAPI(getApiUrl(), getApiKey());
}
