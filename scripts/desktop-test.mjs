import { spawn } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";
import { mkdtemp, writeFile, mkdir, stat, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
const run = (command, args, env = process.env) =>
  new Promise((resolve, reject) => {
    const p = spawn(command, args, { stdio: "inherit", env });
    p.on("error", reject);
    p.on("exit", (code) => resolve(code ?? 1));
  });
if (process.env.DISPLAY) {
  process.exitCode = await run("npm", ["run", "test:e2e"]);
} else {
  const dir = await mkdtemp(path.join(tmpdir(), "storyweaver-display-"));
  await mkdir("/tmp/.X11-unix", { recursive: true });
  let display = 90;
  while (
    await stat(`/tmp/.X11-unix/X${display}`).then(
      () => true,
      () => false,
    )
  )
    display++;
  const config = path.join(dir, "xorg.conf");
  await writeFile(
    config,
    `Section "ServerFlags"
 Option "AutoAddDevices" "false"
 Option "DontVTSwitch" "true"
EndSection
Section "Device"
 Identifier "Dummy"
 Driver "dummy"
 VideoRam 256000
EndSection
Section "Monitor"
 Identifier "Monitor"
 HorizSync 5.0-1000.0
 VertRefresh 5.0-200.0
 Modeline "1510x980" 120.00 1510 1600 1700 1850 980 985 990 1080
EndSection
Section "Screen"
 Identifier "Screen"
 Device "Dummy"
 Monitor "Monitor"
 DefaultDepth 24
 SubSection "Display"
  Depth 24
  Modes "1510x980"
 EndSubSection
EndSection`,
  );
  const server = spawn(
    "Xorg",
    [
      `:${display}`,
      "-config",
      config,
      "-logfile",
      path.join(dir, "xorg.log"),
      "-noreset",
      "-nolisten",
      "tcp",
    ],
    { stdio: "ignore" },
  );
  let failure;
  server.on("error", (e) => (failure = e));
  try {
    let ready = false;
    for (let i = 0; i < 100; i++) {
      if (failure) throw failure;
      if (server.exitCode !== null)
        throw new Error(
          "Xorg could not start. Install Xvfb or Xorg with the dummy display driver, then retry.",
        );
      if (
        await stat(`/tmp/.X11-unix/X${display}`).then(
          () => true,
          () => false,
        )
      ) {
        ready = true;
        break;
      }
      await delay(100);
    }
    if (!ready) throw new Error("Virtual display did not become ready.");
    process.exitCode = await run("npm", ["run", "test:e2e"], {
      ...process.env,
      DISPLAY: `:${display}`,
    });
  } finally {
    server.kill();
    await rm(dir, { recursive: true, force: true });
  }
}
