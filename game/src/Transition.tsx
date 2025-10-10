
import React from "react";

import styles from "./styles/Transition.module.css";

export class Transition extends React.Component {

    public get active() { return this._active; }

    private _overlay!: HTMLDivElement;
    private _active = false;

    public render() {
        return <div
            ref={e => this._overlay = e as HTMLDivElement}
            className="overlay fadeOut"
            style={{
                backgroundColor: "black",
                pointerEvents: "none",
                transition: "opacity .4s ease-in-out"
            }}
        />;
    }

    public fadeIn(onComplete?: () => void) {
        this._overlay.classList.remove(styles.fadeOut);
        this._overlay.classList.add(styles.fadeIn);
        setTimeout(() => onComplete?.(), 400);
    }
    
    private fadeOut(onComplete?: () => void) {
        this._overlay.classList.remove(styles.fadeIn);
        this._overlay.classList.add(styles.fadeOut);
        setTimeout(() => onComplete?.(), 400);
    }

    public transition(fadeOutFinished: () => void) {
        this._active = true;
        this.fadeOut(() => {
            fadeOutFinished();
            this._active = false;
            this.fadeIn();
        });
    }
}
