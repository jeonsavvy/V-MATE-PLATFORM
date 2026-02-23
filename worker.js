import { handler as chatHandler } from "./server/chat-handler.js";

const CHAT_API_PATH = "/api/chat";
const CLIENT_RUNTIME_ENV_KEYS = [
  "VITE_SUPABASE_URL",
  "VITE_SUPABASE_ANON_KEY",
  "VITE_SUPABASE_PUBLISHABLE_KEY",
  "VITE_PUBLIC_SUPABASE_URL",
  "VITE_PUBLIC_SUPABASE_ANON_KEY",
  "VITE_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
  "VITE_CHAT_API_BASE_URL",
];

const isChatApiRequest = (pathname) =>
  pathname === CHAT_API_PATH || pathname === `${CHAT_API_PATH}/`;

const syncWorkerEnvToProcessEnv = (env) => {
  if (typeof process === "undefined" || typeof process.env === "undefined") {
    return;
  }

  for (const [key, value] of Object.entries(env)) {
    if (typeof value === "string") {
      process.env[key] = value;
    }
  }
};

const toEvent = async (request) => {
  let body = "";

  if (request.method !== "GET" && request.method !== "HEAD") {
    body = await request.text();
  }

  return {
    httpMethod: request.method,
    headers: Object.fromEntries(request.headers.entries()),
    body,
  };
};

const toWorkerResponse = (result) =>
  new Response(result?.body ?? "", {
    status: result?.statusCode ?? 500,
    headers: result?.headers,
  });

const handleChatApi = async (request, env) => {
  syncWorkerEnvToProcessEnv(env);
  const event = await toEvent(request);
  const result = await chatHandler(event, {});
  return toWorkerResponse(result);
};

const isHtmlRequest = (request) => {
  if (request.method !== "GET") return false;
  const accept = request.headers.get("accept") || "";
  return accept.includes("text/html");
};

const buildClientRuntimeEnv = (env) => {
  const runtimeEnv = {};

  for (const key of CLIENT_RUNTIME_ENV_KEYS) {
    const value = env?.[key];
    if (typeof value === "string" && value.trim()) {
      runtimeEnv[key] = value;
    }
  }

  return runtimeEnv;
};

const injectRuntimeEnvIntoHtml = async (response, env) => {
  const contentType = response.headers.get("content-type") || "";
  if (!contentType.includes("text/html")) {
    return response;
  }

  const html = await response.text();
  const runtimeEnv = buildClientRuntimeEnv(env);
  const serializedRuntimeEnv = JSON.stringify(runtimeEnv).replace(/</g, "\\u003c");
  const runtimeScript = `<script id="v-mate-runtime-env">window.__V_MATE_RUNTIME_ENV__=${serializedRuntimeEnv};</script>`;

  const body = html.includes("</head>")
    ? html.replace("</head>", `${runtimeScript}</head>`)
    : `${runtimeScript}${html}`;

  const headers = new Headers(response.headers);
  headers.delete("content-length");
  headers.delete("etag");

  return new Response(body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
};

const serveStaticAsset = async (request, env) => {
  let assetResponse = await env.ASSETS.fetch(request);

  if (assetResponse.status === 404 && isHtmlRequest(request)) {
    const url = new URL(request.url);
    url.pathname = "/index.html";
    assetResponse = await env.ASSETS.fetch(new Request(url.toString(), request));
  }

  if (isHtmlRequest(request)) {
    return injectRuntimeEnvIntoHtml(assetResponse, env);
  }

  return assetResponse;
};

const worker = {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (isChatApiRequest(url.pathname)) {
      return handleChatApi(request, env);
    }

    return serveStaticAsset(request, env);
  },
};

export default worker;
