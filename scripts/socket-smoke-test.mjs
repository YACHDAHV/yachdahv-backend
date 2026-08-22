import assert from "node:assert/strict";
import { io } from "socket.io-client";

const apiBase = process.env.API_URL || "http://127.0.0.1:4000/api";
const socketBase = process.env.SOCKET_URL || `${apiBase.replace(/\/api\/?$/, "")}/chat`;

async function request(path, options = {}) {
  const response = await fetch(`${apiBase}${path}`, {
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

function connect(token) {
  return new Promise((resolve, reject) => {
    const socket = io(socketBase, { auth: { token }, forceNew: true, timeout: 5000 });
    socket.once("connect", () => resolve(socket));
    socket.once("connect_error", reject);
  });
}

const [fikayo, david] = await Promise.all([
  login("fikayo@yachdahv.test"),
  login("david@yachdahv.test"),
]);
const auth = (token) => ({ authorization: `Bearer ${token}` });

await request(`/matches/${david.user.id}/like`, { method: "POST", headers: auth(fikayo.accessToken) });
await request(`/matches/${fikayo.user.id}/like`, { method: "POST", headers: auth(david.accessToken) });
const conversation = await request("/conversations", {
  method: "POST",
  headers: auth(fikayo.accessToken),
  body: JSON.stringify({ memberId: david.user.id }),
});

const [sender, recipient] = await Promise.all([connect(fikayo.accessToken), connect(david.accessToken)]);
const body = `Realtime socket smoke test ${Date.now()}`;

try {
  const received = new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("Recipient did not receive the realtime message")), 5000);
    recipient.on("message:new", (message) => {
      if (message.body !== body) return;
      clearTimeout(timer);
      resolve(message);
    });
  });

  const sent = new Promise((resolve, reject) => {
    sender.timeout(5000).emit("message:send", { conversationId: conversation.id, body }, (timeoutError, result) => {
      if (timeoutError) return reject(timeoutError);
      if (!result?.ok) return reject(new Error(result?.error || "Socket send failed"));
      resolve(result.message);
    });
  });

  const [sentMessage, receivedMessage] = await Promise.all([sent, received]);
  assert.equal(receivedMessage.id, sentMessage.id);

  const persisted = await request(`/conversations/${conversation.id}/messages`, { headers: auth(david.accessToken) });
  assert.ok(persisted.some((message) => message.id === sentMessage.id));
  console.log("Socket smoke test passed: authenticated send, live recipient delivery and persistence.");
} finally {
  sender.disconnect();
  recipient.disconnect();
}
