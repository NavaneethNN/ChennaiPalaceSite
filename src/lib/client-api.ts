export async function api<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...options,
    headers: { "Content-Type": "application/json", ...options?.headers },
    cache: "no-store",
  });
  const data = await response.json();
  if (!response.ok)
    throw new Error(data.error || "Unable to complete request.");
  return data;
}
export const send = <T>(url: string, data: unknown) =>
  api<T>(url, { method: "POST", body: JSON.stringify(data) });
