import assert from "node:assert/strict";

const base = process.env.API_URL || "http://127.0.0.1:4000/api";

async function request(path, options = {}) {
  const response = await fetch(`${base}${path}`, {
    ...options,
    headers: { "content-type": "application/json", ...(options.headers || {}) },
  });
  const body = await response.json().catch(() => null);
  assert.ok(response.ok, `${options.method || "GET"} ${path} failed with ${response.status}: ${JSON.stringify(body)}`);
  return body;
}

async function login(email) {
  return request("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password: process.env.SEED_PASSWORD || "ChangeMe123!" }),
  });
}

const health = await request("/health");
assert.equal(health.ok, true);

const [admin, fikayo, david] = await Promise.all([
  login("admin@yachdahv.test"),
  login("fikayo@yachdahv.test"),
  login("david@yachdahv.test"),
]);
const auth = (token) => ({ authorization: `Bearer ${token}` });

const me = await request("/users/me", { headers: auth(fikayo.accessToken) });
assert.equal(me.email, "fikayo@yachdahv.test");

const dashboard = await request("/admin/dashboard", { headers: auth(admin.accessToken) });
assert.ok(dashboard.users >= 4);

await request(`/matches/${david.user.id}/like`, { method: "POST", headers: auth(fikayo.accessToken) });
const mutual = await request(`/matches/${fikayo.user.id}/like`, { method: "POST", headers: auth(david.accessToken) });
assert.equal(mutual.status, "matched");

const conversation = await request("/conversations", {
  method: "POST",
  headers: auth(fikayo.accessToken),
  body: JSON.stringify({ memberId: david.user.id }),
});
await request(`/conversations/${conversation.id}/messages`, {
  method: "POST",
  headers: auth(fikayo.accessToken),
  body: JSON.stringify({ body: "Hello from the backend smoke test" }),
});
const messages = await request(`/conversations/${conversation.id}/messages`, { headers: auth(david.accessToken) });
assert.ok(messages.some((message) => message.body === "Hello from the backend smoke test"));

const notifications = await request("/notifications", { headers: auth(david.accessToken) });
assert.ok(notifications.length >= 1);

console.log("Smoke test passed: health, auth, profile, admin, mutual match, conversation, message and notifications.");
