#!/usr/bin/env node

/**
 * Anthropic API Reverse Proxy - Tool Name Transformer
 *
 * 将 Anthropic API 请求中的 tool name 从小写转换为首字母大写（PascalCase）
 * 同时修复模型返回中数组被序列化为字符串的问题
 *
 * 用法:
 *   node proxy-server.js                          # 默认监听 9090
 *   PORT=8080 node proxy-server.js                # 自定义端口
 *   TARGET=https://custom.api.com node proxy-server.js  # 自定义目标
 */

const http = require("http");
const https = require("https");
const { URL } = require("url");

const PORT = parseInt(process.env.PORT || "9090", 10);
const TARGET = process.env.TARGET || "https://anyrouter.top";
const targetUrl = new URL(TARGET);

// ============================================================
// Tool Name Mapping
// ============================================================

const NAME_MAP = {
  todowrite: "TodoWrite",
  webfetch: "WebFetch",
  google_search: "Google_Search",
};

function mapName(name) {
  if (!name || typeof name !== "string") return name;
  if (NAME_MAP[name]) return NAME_MAP[name];
  return name.charAt(0).toUpperCase() + name.slice(1);
}

// ============================================================
// Request Transform: tools[] + messages[] 中的 tool_use name
// ============================================================

function transformRequest(body) {
  if (!body) return body;

  // 1. tools 定义
  if (Array.isArray(body.tools)) {
    body.tools.forEach((tool) => {
      if (tool.name) tool.name = mapName(tool.name);
    });
  }

  // 2. messages 历史中的 tool_use blocks
  if (Array.isArray(body.messages)) {
    body.messages.forEach((msg) => {
      if (Array.isArray(msg.content)) {
        msg.content.forEach((block) => {
          if (block.type === "tool_use" && block.name) {
            block.name = mapName(block.name);
          }
        });
      }
    });
  }

  return body;
}

// ============================================================
// Response Transform: 修复数组被序列化为字符串的问题
// ============================================================

function transformResponseBody(body) {
  if (!body || !Array.isArray(body.content)) return body;

  body.content.forEach((block) => {
    if (block.type === "tool_use" && block.input) {
      for (const key of Object.keys(block.input)) {
        const val = block.input[key];
        if (
          typeof val === "string" &&
          (val.startsWith("[") || val.startsWith("{"))
        ) {
          try {
            block.input[key] = JSON.parse(val);
          } catch (_) {}
        }
      }
    }
  });

  return body;
}

// ============================================================
// SSE Stream Transform: 逐块修复 tool_use content_block_start
// ============================================================

function transformSSELine(line) {
  if (!line.startsWith("data:")) return line;

  const jsonStr = line.slice(5).trim();
  if (!jsonStr || jsonStr === "[DONE]") return line;

  try {
    const data = JSON.parse(jsonStr);

    // content_block_start 中的 tool_use name
    if (
      data.type === "content_block_start" &&
      data.content_block &&
      data.content_block.type === "tool_use" &&
      data.content_block.name
    ) {
      data.content_block.name = mapName(data.content_block.name);
      return "data: " + JSON.stringify(data);
    }

    return line;
  } catch (_) {
    return line;
  }
}

// ============================================================
// HTTP Server
// ============================================================

const server = http.createServer((req, res) => {
  // CORS preflight
  if (req.method === "OPTIONS") {
    res.writeHead(204, {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "*",
      "Access-Control-Max-Age": "86400",
    });
    res.end();
    return;
  }

  const chunks = [];

  req.on("data", (chunk) => chunks.push(chunk));
  req.on("end", () => {
    const rawBody = Buffer.concat(chunks);
    const isMessagesEndpoint = req.url && req.url.includes("/v1/messages");

    // --- Transform request body ---
    let proxyBody = rawBody;
    let isStreaming = false;

    if (isMessagesEndpoint && rawBody.length > 0) {
      try {
        let parsed = JSON.parse(rawBody.toString("utf-8"));
        isStreaming = !!parsed.stream;
        parsed = transformRequest(parsed);
        proxyBody = Buffer.from(JSON.stringify(parsed), "utf-8");
      } catch (_) {
        // 非 JSON body，原样转发
      }
    }

    // --- Build upstream request ---
    const upstreamHeaders = { ...req.headers };
    upstreamHeaders.host = targetUrl.host;
    delete upstreamHeaders["content-length"];
    upstreamHeaders["content-length"] = proxyBody.length;

    const options = {
      hostname: targetUrl.hostname,
      port: targetUrl.port || (targetUrl.protocol === "https:" ? 443 : 80),
      path: req.url,
      method: req.method,
      headers: upstreamHeaders,
    };

    const transport = targetUrl.protocol === "https:" ? https : http;

    const proxyReq = transport.request(options, (proxyRes) => {
      const contentType = proxyRes.headers["content-type"] || "";
      const isSSE = contentType.includes("text/event-stream");
      const isJSON = contentType.includes("application/json");

      // 设置响应头
      const responseHeaders = { ...proxyRes.headers };
      responseHeaders["access-control-allow-origin"] = "*";
      delete responseHeaders["content-length"]; // 内容可能被修改

      if (isMessagesEndpoint && isSSE) {
        // ----- SSE Streaming 模式 -----
        res.writeHead(proxyRes.statusCode, responseHeaders);

        let buffer = "";
        proxyRes.setEncoding("utf-8");

        proxyRes.on("data", (chunk) => {
          buffer += chunk;

          // 按双换行分割完整的 SSE 事件
          const parts = buffer.split("\n\n");
          buffer = parts.pop(); // 最后一部分可能不完整

          for (const part of parts) {
            const transformedLines = part
              .split("\n")
              .map(transformSSELine)
              .join("\n");
            res.write(transformedLines + "\n\n");
          }
        });

        proxyRes.on("end", () => {
          if (buffer.trim()) {
            const transformedLines = buffer
              .split("\n")
              .map(transformSSELine)
              .join("\n");
            res.write(transformedLines + "\n\n");
          }
          res.end();
        });
      } else if (isMessagesEndpoint && isJSON) {
        // ----- 非流式 JSON 模式 -----
        const resChunks = [];
        proxyRes.on("data", (chunk) => resChunks.push(chunk));
        proxyRes.on("end", () => {
          let resBody = Buffer.concat(resChunks);
          try {
            let parsed = JSON.parse(resBody.toString("utf-8"));
            parsed = transformResponseBody(parsed);
            resBody = Buffer.from(JSON.stringify(parsed), "utf-8");
          } catch (_) {}

          responseHeaders["content-length"] = resBody.length;
          res.writeHead(proxyRes.statusCode, responseHeaders);
          res.end(resBody);
        });
      } else {
        // ----- 其他请求原样转发 -----
        res.writeHead(proxyRes.statusCode, responseHeaders);
        proxyRes.pipe(res);
      }
    });

    proxyReq.on("error", (err) => {
      console.error("[proxy error]", err.message);
      if (!res.headersSent) {
        res.writeHead(502, { "Content-Type": "application/json" });
      }
      res.end(JSON.stringify({ error: "proxy_error", message: err.message }));
    });

    proxyReq.write(proxyBody);
    proxyReq.end();
  });
});

server.listen(PORT, () => {
  console.log(`
╔════════════════════════════════════════════════════════╗
║  Anthropic API Proxy (Tool Name Transformer)           ║
╠════════════════════════════════════════════════════════╣
║  Listen : http://localhost:${String(PORT).padEnd(24)}  ║
║  Target : ${TARGET.padEnd(38)}                         ║
╠════════════════════════════════════════════════════════╣
║  Transforms:                                           ║
║    todowrite    → TodoWrite                            ║
║    webfetch     → WebFetch                             ║
║    google_search→ GoogleSearch                         ║
║    other        → Capitalized                          ║
╚════════════════════════════════════════════════════════╝
  `);
});
