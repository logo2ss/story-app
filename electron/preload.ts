import { contextBridge, ipcRenderer } from "electron";
const invoke =
  (channel: string) =>
  (...args: unknown[]) =>
    ipcRenderer.invoke(channel, ...args);
contextBridge.exposeInMainWorld("storyweaver", {
  finishClose: () => ipcRenderer.send("close:finish"),
  onBeforeClose: (cb: () => void) => {
    const listener = () => cb();
    ipcRenderer.on("before-close", listener);
    return () => ipcRenderer.removeListener("before-close", listener);
  },
  list: invoke("projects:list"),
  open: invoke("projects:open"),
  save: invoke("projects:save"),
  create: invoke("projects:create"),
  remove: invoke("projects:remove"),
  duplicate: invoke("projects:duplicate"),
  images: invoke("images:import"),
  imageBytes: invoke("images:bytes"),
  text: invoke("text:import"),
  backup: invoke("projects:backup"),
  restore: invoke("projects:restore"),
  export: invoke("export"),
  settings: invoke("settings:get"),
  setSettings: invoke("settings:set"),
  chooseDirectory: invoke("directory:choose"),
  clearCache: invoke("cache:clear"),
  sample: invoke("sample"),
  onProgress: (cb: (s: string) => void) => {
    const listener = (_: unknown, s: string) => cb(s);
    ipcRenderer.on("progress", listener);
    return () => ipcRenderer.removeListener("progress", listener);
  },
});
