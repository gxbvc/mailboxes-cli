export function success(data: any): void {
  console.log(JSON.stringify({ ok: true, data }));
}

export function error(message: string, code?: string): never {
  console.error(JSON.stringify({ ok: false, error: message, ...(code && { code }) }));
  process.exit(1);
}
