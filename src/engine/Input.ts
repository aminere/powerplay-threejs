import { Vector2 } from "three";

function getWheelDelta(delta: number, deltaMode: number) {
    if (deltaMode === 1) { // DOM_DELTA_LINE
        return delta * 32; // approximation, supposed to be the font size
    } else if (deltaMode === 2) { // DOM_DELTA_PAGE
        return delta * 32 * 10; // approximation, supposed to be the 'page' size whatever the fuck this is
    } else {
        return delta; // DOM_DELTA_PIXEL
    }
}

class Input {
    set touchPos(value: Vector2) { this._touchPos.copy(value); }
    set touchInside(value: boolean) { this._touchInside = value; }
    set rawWheelDelta(e: WheelEvent) {this._rawWheelDelta = getWheelDelta(e.deltaY, e.deltaMode); }
    set rawTouchDown(value: boolean) { this._rawTouchDown = value; }
    set rawTouchButton(value: number) { this._rawTouchButton = value; }
    set rawTouchJustMoved(value: boolean) { this._rawTouchJustMoved = value; }

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
    private _rawTouchJustMoved = false; 
    private _touchDown = false;
    private _rawTouchDown = false;
    private _touchInside = false;
    private _wheelDelta = 0;
    private _rawWheelDelta = 0;    

    public update() {
        this._touchDown = this._rawTouchDown;
        this._wheelDelta = this._rawWheelDelta;
        this._touchJustMoved = this._rawTouchJustMoved;
        if (this._touchDown) {
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
    }

    public postUpdate() {
        this._touchJustPressed = false;
        this._touchJustReleased = false;        
        this._rawWheelDelta = 0;
        this._rawTouchJustMoved = false;
    }
}

export const input = new Input();

