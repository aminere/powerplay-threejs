import { Vector2 } from "three";
import { DOMUtils } from "./DOMUtils";

class Input {
    set touchPos(value: Vector2) { this._touchPos.copy(value); }
    set touchInside(value: boolean) { this._touchInside = value; }
    set rawWheelDelta(e: WheelEvent) {this._rawWheelDelta = DOMUtils.getWheelDelta(e.deltaY, e.deltaMode); }

    get touchPos() { return this._touchPos; }
    get touchButton() { return this._touchButton; }
    get touchJustPressed() { return this._touchJustPressed; }
    get touchPressed() { return this._touchPressed; }
    get touchJustReleased() { return this._touchJustReleased; }
    get touchJustMoved() { return this._touchJustMoved; }
    get touchInside() { return this._touchInside; }
    get wheelDelta() { return this._wheelDelta; }    
    
    private _touchPos = new Vector2();
    private _touchButton = 0;
    private _rawTouchButton = 0;
    private _touchJustPressed = false;
    private _touchPressed = false;
    private _touchJustReleased = false;
    private _touchJustMoved = false;
    private _pointerDown = false;
    private _touchInside = false;
    private _wheelDelta = 0;
    private _rawWheelDelta = 0;

    public init() {
        this.onPointerDown = this.onPointerDown.bind(this);
        this.onPointerUp = this.onPointerUp.bind(this);
        this.onPointerMove = this.onPointerMove.bind(this);
        window.addEventListener("pointerdown", this.onPointerDown);
        window.addEventListener("pointerup", this.onPointerUp);
        window.addEventListener("pointermove", this.onPointerMove);
    }

    public update() {
        if (this._pointerDown) {
            if (!this._touchPressed) {
                this._touchJustPressed = true;
                this._touchButton = this._rawTouchButton;
            }
            this._touchPressed = true;
        } else {
            if (this._touchPressed) {
                this._touchJustReleased = true;
            }
            this._touchPressed = false;
        }        
        this._wheelDelta = this._rawWheelDelta;
    }

    public postUpdate() {
        this._touchJustPressed = false;
        this._touchJustReleased = false;
        this._touchJustMoved = false;
        this._wheelDelta = 0;
        this._rawWheelDelta = 0;
    }

    public dispose() {
        window.removeEventListener("pointerdown", this.onPointerDown);
        window.removeEventListener("pointerup", this.onPointerUp);
        window.removeEventListener("pointermove", this.onPointerMove);
    }

    private onPointerDown(e: PointerEvent) {
        this._pointerDown = true;
        this._rawTouchButton = e.button;
    }

    private onPointerUp() {
        this._pointerDown = false;        
    }

    private onPointerMove() {
        this._touchJustMoved = true;
    }
}

export const input = new Input();

