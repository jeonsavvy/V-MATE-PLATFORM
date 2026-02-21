import { handler as chatHandler } from "./server/chat-handler.js";

const CHAT_API_PATH = "/api/chat";

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

const serveStaticAsset = async (request, env) => {
  const assetResponse = await env.ASSETS.fetch(request);
  if (assetResponse.status !== 404) {
    return assetResponse;
  }

  if (isHtmlRequest(request)) {
    const url = new URL(request.url);
    url.pathname = "/index.html";
    return env.ASSETS.fetch(new Request(url.toString(), request));
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
