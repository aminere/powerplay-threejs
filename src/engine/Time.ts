class Time {
    get time() { return this._time; }
    get deltaTime() { return this._deltaTime; }
    get fps() { return this._fps; }
    get currentFrame() { return this._currentFrame; }

    private _deltaTimeCap = 1 / 10;    
    private _previousTime = performance.now();
    private _time = 0;
    private _deltaTime = 0;    
    private _fps = 0;
    private _currentFrame = 0;

    public updateDeltaTime() {
        const time = performance.now();
        const deltaTime = Math.min((time - this._previousTime) / 1000.0, this._deltaTimeCap);
        this._deltaTime = deltaTime;
        this._time += deltaTime;
        this._previousTime = time;        
    }
}

export const time = new Time();

