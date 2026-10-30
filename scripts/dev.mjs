import { spawn } from "node:child_process";
import { createServer } from "vite";
await import("./build.mjs");
const server = await createServer({
  server: { host: "127.0.0.1", port: 5173, strictPort: true },
});
await server.listen();
const child = spawn("electron", ["."], {
  stdio: "inherit",
  shell: process.platform === "win32",
  env: { ...process.env, STORYWEAVER_DEV: "http://localhost:5173" },
});
child.on("exit", async (code) => {
  await server.close();
  process.exit(code ?? 0);
});
for (const sig of ["SIGINT", "SIGTERM"]) process.on(sig, () => child.kill());
