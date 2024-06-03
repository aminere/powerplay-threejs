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
    get keyPressed() { return this._pressedKeys; }
    get keyJustPressed() { return this._justPressedKeys; }
    get keyJustReleased() { return this._justReleasedKeys; }

    public setRawKeyPressed(key: string, pressed: boolean) {
        if (pressed) {
            this._rawPressedKeys.add(key);
        } else {
            this._rawReleasedKeys.add(key);
        }
    }
    
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
    private _rawPressedKeys = new Set<string>();
    private _rawReleasedKeys = new Set<string>();
    private _justPressedKeys = new Set<string>();
    private _pressedKeys = new Set<string>();
    private _justReleasedKeys = new Set<string>();

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

        if (this._rawPressedKeys.size > 0) {
            for (const key of this._rawPressedKeys) {
                if (!this._pressedKeys.has(key)) {
                    this._justPressedKeys.add(key);
                }
                this._pressedKeys.add(key);
            }
            this._rawPressedKeys.clear();
        }
        
        if (this._rawReleasedKeys.size > 0) {
            for (const key of this._rawReleasedKeys) {
                if (this._pressedKeys.has(key)) {
                    this._justReleasedKeys.add(key);
                }
                this._pressedKeys.delete(key);
            }
            this._rawReleasedKeys.clear();
        }
    }

    public postUpdate() {
        this._touchJustPressed = false;
        this._touchJustReleased = false;        
        this._rawWheelDelta = 0;
        this._rawTouchJustMoved = false;
        this._justPressedKeys.clear();
        this._justReleasedKeys.clear();
    }
}

export const input = new Input();

