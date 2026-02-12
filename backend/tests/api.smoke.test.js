import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";

process.env.DISABLE_GEMINI = "true";
process.env.MONGODB_URI = "";

const { default: app } = await import("../src/app.js");

let server;
let baseUrl;

const requestJson = async (path, options = {}) => {
  const response = await fetch(`${baseUrl}${path}`, {
    headers: {
      "content-type": "application/json",
      ...(options.headers || {})
    },
    ...options
  });

  const body = await response.json();
  return { response, body };
};

test.before(async () => {
  server = http.createServer(app);
  await new Promise((resolve) => {
    server.listen(0, "127.0.0.1", resolve);
  });

  const address = server.address();
  baseUrl = `http://127.0.0.1:${address.port}`;
});

test.after(async () => {
  if (!server) {
    return;
  }

  await new Promise((resolve, reject) => {
    server.close((error) => {
      if (error) {
        reject(error);
        return;
      }
      resolve();
    });
  });
});

test("GET /api/health returns service health with parser and persistence mode", async () => {
  const { response, body } = await requestJson("/api/health", { method: "GET" });

  assert.equal(response.status, 200);
  assert.equal(body.status, "ok");
  assert.match(body.timestamp, /^\d{4}-\d{2}-\d{2}T/);
  assert.ok(["json", "mongodb"].includes(body.persistence));
  assert.ok(["rule-based", "gemini+rule-fallback"].includes(body.parser));
});

test("POST /api/voice/parse handles Hindi quantity + unit correctly", async () => {
  const { response, body } = await requestJson("/api/voice/parse", {
    method: "POST",
    body: JSON.stringify({
      transcript: "मुझे 5 किलो सेब चाहिए",
      language: "hi-IN"
    })
  });

  assert.equal(response.status, 200);
  assert.equal(body.action, "add");
  assert.equal(body.quantity, 5);
  assert.equal(body.unit, "kg");
  assert.ok(typeof body.item === "string" && body.item.length > 0);
  assert.equal(body.language, "hi-IN");
});

test("POST /api/voice/execute rejects unavailable catalog item instead of silently adding", async () => {
  const { response, body } = await requestJson("/api/voice/execute", {
    method: "POST",
    body: JSON.stringify({
      transcript: "add 2 samsung galaxy phones",
      language: "en-US"
    })
  });

  assert.equal(response.status, 200);
  assert.equal(body.action, "add");
  assert.equal(body.rejected, true);
  assert.match(body.message, /(not found|out of stock|unavailable)/i);
  assert.ok(Array.isArray(body.list));
});

test("GET /api/search returns found=false for missing query", async () => {
  const { response, body } = await requestJson(
    "/api/search?query=zzzz-super-unknown-item-987654321",
    { method: "GET" }
  );

  assert.equal(response.status, 200);
  assert.equal(body.found, false);
  assert.equal(body.count, 0);
  assert.ok(Array.isArray(body.results));
  assert.match(body.message, /No products found/i);
});
