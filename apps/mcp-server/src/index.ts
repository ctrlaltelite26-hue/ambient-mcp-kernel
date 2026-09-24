import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";

import { config as loadEnv } from "dotenv";
import { registerAppResource, registerAppTool } from "@modelcontextprotocol/ext-apps/server";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { isInitializeRequest } from "@modelcontextprotocol/sdk/types.js";
import {
  ConsentKernel,
  createDemoHouseholdState,
  DEMO_HOUSEHOLD_META,
  DEMO_MEMBERS,
  PINNED_TOOL_CATALOG,
  type ConfirmViewModel,
} from "@chaperone/mcp-kernel";
import { lineFromSku, listCatalog } from "@chaperone/grocery-mock";
import cors from "cors";
import express, { type Request, type Response } from "express";
import { z } from "zod";

import { awsPersistenceActive, persistCommit, persistPropose } from "./aws-persist.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
loadEnv({ path: join(__dirname, "../.env") });

const HELLO_UI_URI = "ui://chaperone/hello.html";
const CONFIRM_UI_URI = "ui://chaperone/confirm.html";
const PORT = Number(process.env.PORT ?? 3333);
const HOST = process.env.HOST ?? "127.0.0.1";

const helloHtml = readFileSync(join(__dirname, "resources", "hello.html"), "utf8");
const confirmHtmlTemplate = readFileSync(join(__dirname, "resources", "confirm.html"), "utf8");

const kernel = new ConsentKernel(createDemoHouseholdState());
let lastConfirmView: ConfirmViewModel | null = null;

function renderConfirmHtml(view: ConfirmViewModel | null): string {
  const boot = view ? `globalThis.__CHAPERONE_CONFIRM__ = ${JSON.stringify(view)};` : "";
  return confirmHtmlTemplate.replace(
    "<script type=\"module\">",
    `<script>/* chaperone boot */\n${boot}\n</script>\n<script type="module">`,
  );
}

function createServer(): McpServer {
  const server = new McpServer({
    name: "chaperone-mcp",
    version: "0.5.0",
  });

  registerAppResource(server, "Chaperone Hello", HELLO_UI_URI, {}, async () => ({
    contents: [{ uri: HELLO_UI_URI, mimeType: "text/html;profile=mcp-app", text: helloHtml }],
  }));

  registerAppResource(server, "Confirm order", CONFIRM_UI_URI, {}, async () => ({
    contents: [
      {
        uri: CONFIRM_UI_URI,
        mimeType: "text/html;profile=mcp-app",
        text: renderConfirmHtml(lastConfirmView),
      },
    ],
  }));

  registerAppTool(
    server,
    "hello_chaperone",
    {
      title: "Hello Chaperone",
      description: "Smoke-test tool.",
      inputSchema: { name: z.string().default("judge") },
      _meta: { ui: { resourceUri: HELLO_UI_URI } },
    },
    async ({ name }) => ({
      content: [{ type: "text", text: `Hello, ${name}. Chaperone MCP is up.` }],
      _meta: { ui: { resourceUri: HELLO_UI_URI } },
    }),
  );

  registerAppTool(
    server,
    "propose_order",
    {
      title: "Propose order",
      description: PINNED_TOOL_CATALOG.propose_order,
      inputSchema: {
        sessionId: z.string().describe("Host session id"),
        speakerMemberId: z
          .enum(["maya", "leo", "guest"])
          .nullable()
          .describe("Demo selector — not biometrics"),
        intent: z.string(),
        sku: z.string().default("coffee"),
        qty: z.number().int().positive().default(1),
        invokedToolDescription: z.string().optional(),
      },
      _meta: { ui: { resourceUri: CONFIRM_UI_URI } },
    },
    async (args) => {
      let basket;
      try {
        basket = [lineFromSku(args.sku, args.qty)];
      } catch {
        basket = [{ sku: args.sku, qty: args.qty, unitPriceMinor: 1000 }];
      }
      const result = kernel.propose({
        sessionId: args.sessionId,
        speakerMemberId: args.speakerMemberId,
        intent: args.intent,
        basket,
        invokedToolDescription: args.invokedToolDescription,
      });
      await persistPropose(result, args.sessionId);
      if (result.confirmView) lastConfirmView = result.confirmView;
      const text = JSON.stringify(result, null, 2);
      if (result.confirmView) {
        return {
          content: [{ type: "text", text }],
          _meta: { ui: { resourceUri: CONFIRM_UI_URI } },
        };
      }
      return { content: [{ type: "text", text }] };
    },
  );

  server.registerTool(
    "commit_order",
    {
      title: "Commit order",
      description: PINNED_TOOL_CATALOG.commit_order,
      inputSchema: {
        sessionId: z.string(),
        payloadHash: z.string().length(64),
        actorMemberId: z.enum(["maya", "leo", "guest"]).optional(),
      },
    },
    async (args) => {
      const result = kernel.commit({
        sessionId: args.sessionId,
        payloadHash: args.payloadHash,
        actorMemberId: args.actorMemberId,
      });
      await persistCommit(result);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.registerTool(
    "list_household",
    {
      title: "List household seed",
      description: PINNED_TOOL_CATALOG.list_household,
      inputSchema: {},
    },
    async () => ({
      content: [
        {
          type: "text",
          text: JSON.stringify(
            {
              household: DEMO_HOUSEHOLD_META,
              members: DEMO_MEMBERS,
              grants: kernel.listGrants(),
              catalogSkus: listCatalog().map((i) => i.sku),
            },
            null,
            2,
          ),
        },
      ],
    }),
  );

  return server;
}

const app = express();
app.use(
  cors({
    origin: true,
    exposedHeaders: ["Mcp-Session-Id", "mcp-session-id"],
  }),
);
app.use(express.json({ limit: "4mb" }));

const transports = new Map<string, StreamableHTTPServerTransport>();

app.get("/health", (_req, res) => {
  res.json({
    ok: true,
    name: "chaperone-mcp",
    version: "0.5.0",
    transport: "streamable-http",
    endpoint: "/mcp",
    tools: ["hello_chaperone", "propose_order", "commit_order", "list_household"],
    confirmUi: CONFIRM_UI_URI,
    household: DEMO_HOUSEHOLD_META.name,
    awsPersistence: awsPersistenceActive(),
  });
});

app.post("/mcp", async (req: Request, res: Response) => {
  try {
    const sessionId = req.headers["mcp-session-id"] as string | undefined;
    let transport: StreamableHTTPServerTransport | undefined;
    if (sessionId && transports.has(sessionId)) {
      transport = transports.get(sessionId);
    } else if (!sessionId && isInitializeRequest(req.body)) {
      const server = createServer();
      transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: () => randomUUID(),
        onsessioninitialized: (id) => {
          transports.set(id, transport!);
        },
      });
      transport.onclose = () => {
        const id = transport?.sessionId;
        if (id) transports.delete(id);
      };
      await server.connect(transport);
    } else {
      res.status(400).json({
        jsonrpc: "2.0",
        error: {
          code: -32000,
          message: "Bad Request: missing or unknown MCP session. Send initialize first.",
        },
        id: null,
      });
      return;
    }
    await transport!.handleRequest(req, res, req.body);
  } catch (error) {
    console.error("MCP POST error:", error);
    if (!res.headersSent) {
      res.status(500).json({
        jsonrpc: "2.0",
        error: { code: -32603, message: "Internal server error" },
        id: null,
      });
    }
  }
});

app.get("/mcp", async (req: Request, res: Response) => {
  const sessionId = req.headers["mcp-session-id"] as string | undefined;
  const transport = sessionId ? transports.get(sessionId) : undefined;
  if (!transport) {
    res.status(400).send("Invalid or missing MCP session");
    return;
  }
  await transport.handleRequest(req, res);
});

app.delete("/mcp", async (req: Request, res: Response) => {
  const sessionId = req.headers["mcp-session-id"] as string | undefined;
  const transport = sessionId ? transports.get(sessionId) : undefined;
  if (!transport) {
    res.status(400).send("Invalid or missing MCP session");
    return;
  }
  await transport.handleRequest(req, res);
  transports.delete(sessionId!);
});

app.listen(PORT, HOST, () => {
  console.log(`Chaperone MCP v0.5 listening on http://${HOST}:${PORT}/mcp`);
  console.log(`Health: http://${HOST}:${PORT}/health`);
  console.log(`AWS dual-write: ${awsPersistenceActive() ? "ON (CHAPERONE_AWS=1)" : "off (memory)"}`);
});
