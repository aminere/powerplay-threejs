
export class Env {
    public static get isWeb() { return !Boolean(window.__TAURI_IPC__); }
    public static get isDesktop() { return Boolean(window.__TAURI_IPC__); }
}
