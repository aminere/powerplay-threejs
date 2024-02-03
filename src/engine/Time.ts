
interface ITime {
    time: number;
    deltaTime: number;
    fps: number;
    currentFrame: number;
    update(): void;
}

class DynamicTime implements ITime {
    get time() { return this._time; }
    get deltaTime() { return this._deltaTime; }
    get fps() { return this._fps; }
    get currentFrame() { return 0; }

    update() {
        const time = performance.now();
        const deltaTime = Math.min((time - this._previousTime) / 1000.0, this._deltaTimeCap);
        this._deltaTime = deltaTime;
        this._time += deltaTime;
        this._previousTime = time; 
    }

    private _deltaTimeCap = 1 / 10;    
    private _previousTime = performance.now();
    private _time = 0;
    private _deltaTime = 0;    
    private _fps = 0;
}

class StaticTime implements ITime {
    get time() { return this._time; }
    get deltaTime() { return this._deltaTime; }
    get fps() { return 60; }
    get currentFrame() { return 0; }

    private _deltaTime = 1 / 60;
    private _time = 0;

    update() {
        this._time += this._deltaTime;
    }
}

class Time implements ITime {
    get time() { return this._impl.time; }
    get deltaTime() { return this._impl.deltaTime; }
    get fps() { return this._impl.fps; }
    get currentFrame() { return this._currentFrame; }
    
    public setDynamic(dynamic: boolean) {
        this._impl = dynamic ? this._dynamicImpl : this._staticImpl;
    }

    private _staticImpl = new StaticTime();
    private _dynamicImpl = new DynamicTime();
    private _impl: ITime = this._dynamicImpl;
    private _currentFrame = 0;

    public update() {
        this._impl.update();
        this._currentFrame++;
    }
}

export const time = new Time();

