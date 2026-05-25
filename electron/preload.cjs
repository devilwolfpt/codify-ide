const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electron", {
  ipcRenderer: {
    send: (channel, ...args) => {
      // whitelist channels
      const validChannels = ["window-minimize", "window-maximize", "window-close"];
      if (validChannels.includes(channel)) {
        ipcRenderer.send(channel, ...args);
      }
    }
  }
});
