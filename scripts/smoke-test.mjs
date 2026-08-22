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
const [administrators, rolePermissions, systemControls] = await Promise.all([
  request("/admin/administrators", { headers: auth(admin.accessToken) }),
  request("/admin/role-permissions", { headers: auth(admin.accessToken) }),
  request("/admin/system-controls", { headers: auth(admin.accessToken) }),
]);
assert.ok(administrators.some((item) => item.email === "admin@yachdahv.test"));
assert.ok(rolePermissions["Super Admin"].includes("manage_admins"));
assert.equal(typeof systemControls.matching, "boolean");

const [churches, adminChurches, waitlistInvites] = await Promise.all([
  request("/onboarding/churches", { headers: auth(fikayo.accessToken) }),
  request("/admin/churches", { headers: auth(admin.accessToken) }),
  request("/admin/waitlist-invites", { headers: auth(admin.accessToken) }),
]);
assert.ok(churches.length >= 1);
assert.ok(adminChurches.length >= churches.length);
assert.ok(Array.isArray(waitlistInvites));
assert.ok(waitlistInvites.every((invite) => !("code" in invite) && !("codeHash" in invite)));

const legacyOnboarding = await fetch(`${base}/onboarding`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ phone: "+2348000000000" }),
});
assert.equal(legacyOnboarding.status, 404);

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

const relationshipState = await request("/relationship-tools/state", { headers: auth(fikayo.accessToken) });
const shared = await request("/relationship-tools/devotional/reflections", {
  method: "POST",
  headers: auth(fikayo.accessToken),
  body: JSON.stringify({ day: 0, body: "A shared reflection from the backend smoke test" }),
});
assert.equal(shared.matchId, relationshipState.matchId);
const partnerState = await request("/relationship-tools/state", { headers: auth(david.accessToken) });
assert.ok(partnerState.reflections.some((reflection) => reflection.body === "A shared reflection from the backend smoke test"));

console.log("Smoke test passed: auth, waitlist access controls, admin controls, matching, messaging, notifications and shared relationship tools.");
