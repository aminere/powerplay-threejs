// import React from "react";
import ReactDOM from "react-dom/client";
import { App } from "./App";
import { invoke } from '@tauri-apps/api/tauri';
import { appWindow } from '@tauri-apps/api/window';
import { exit } from '@tauri-apps/api/process';
import { Env } from "./env";
import { cmdExitGame } from "powerplay-lib";
import "./styles/global.css";

function tauriInvoke(callback: () => void) {
  if (Env.isDesktop) {
    callback();
  }
}

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  // <React.StrictMode>
    <App
      onMounted={() => {
        tauriInvoke(() => invoke('show_window'));
        tauriInvoke(() => {
          appWindow.onFocusChanged(({ payload: focused }) => {
            if (focused) {
              invoke('grab_cursor');
            }
          });
        });

        cmdExitGame.attach(() => {
          tauriInvoke(() => exit(0));
        });
      }}
    />
  // </React.StrictMode>
);
