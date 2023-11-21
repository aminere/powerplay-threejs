import { Vector2 } from "three";

class Input {
    set touchPos(value: Vector2) { this._touchPos.copy(value); }
    set touchInside(value: boolean) { this._touchInside = value; }

    get touchPos() { return this._touchPos; }
    get touchJustPressed() { return this._touchJustPressed; }
    get touchPressed() { return this._touchPressed; }
    get touchJustReleased() { return this._touchJustReleased; }
    get touchJustMoved() { return this._touchJustMoved; }
    get touchInside() { return this._touchInside; }
    
    private _touchPos = new Vector2();
    private _touchJustPressed = false;
    private _touchPressed = false;
    private _touchJustReleased = false;
    private _touchJustMoved = false;
    private _pointerDown = false;
    private _touchInside = false;

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
            }
            this._touchPressed = true;
        } else {
            if (this._touchPressed) {
                this._touchJustReleased = true;
            }
            this._touchPressed = false;
        }        
    }

    public postUpdate() {
        this._touchJustPressed = false;
        this._touchJustReleased = false;
        this._touchJustMoved = false;
    }

    public dispose() {
        window.removeEventListener("pointerdown", this.onPointerDown);
        window.removeEventListener("pointerup", this.onPointerUp);
        window.removeEventListener("pointermove", this.onPointerMove);
    }

    private onPointerDown() {
        this._pointerDown = true;        
    }

    private onPointerUp() {
        this._pointerDown = false;        
    }

    private onPointerMove() {
        this._touchJustMoved = true;
    }
}

export const input = new Input();

