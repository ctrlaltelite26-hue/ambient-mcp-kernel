import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

const MCP_URL = process.env.MCP_URL ?? "http://127.0.0.1:3333/mcp";

export type SpeakerId = "maya" | "leo" | "guest" | null;

export async function withMcpClient<T>(
  fn: (client: Client) => Promise<T>,
): Promise<T> {
  const client = new Client({ name: "chaperone-sim-host", version: "0.4.0" });
  const transport = new StreamableHTTPClientTransport(new URL(MCP_URL));
  await client.connect(transport);
  try {
    return await fn(client);
  } finally {
    await client.close().catch(() => undefined);
  }
}

export async function callToolJson(
  name: string,
  args: Record<string, unknown>,
): Promise<unknown> {
  return withMcpClient(async (client) => {
    const result = await client.callTool({ name, arguments: args });
    const text = (result.content as { type: string; text?: string }[] | undefined)?.find(
      (c) => c.type === "text",
    )?.text;
    if (!text) return result;
    try {
      return JSON.parse(text);
    } catch {
      return { raw: text };
    }
  });
}

export async function readConfirmHtml(): Promise<string> {
  return withMcpClient(async (client) => {
    const res = await client.readResource({ uri: "ui://chaperone/confirm.html" });
    const text = res.contents?.[0] && "text" in res.contents[0] ? res.contents[0].text : "";
    return text ?? "";
  });
}
