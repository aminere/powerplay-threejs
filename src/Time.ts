
namespace Private {
    // Cap deltatime for when browser is idle   
    export const deltaTimeCap = 1 / 10;    
    export let previousTime = performance.now();
    export let time = 0;
    export let deltaTime = 0;    
    export let frameTimer = 0;
    export let frameCount = 0;
    export let fps = 0;
    export let currentFrame = 0;    
}

/**
 * @hidden
 */
export namespace TimeInternal {
    export function updateDeltaTime() {
        const time = performance.now();
        const deltaTime = Math.min((time - Private.previousTime) / 1000.0, Private.deltaTimeCap);
        Private.deltaTime = deltaTime;
        Private.time += deltaTime;
        Private.previousTime = time;        
    }
}

export class Time {
    static get time() { return Private.time; }
    static get deltaTime() { return Private.deltaTime; }
    static get fps() { return Private.fps; }
    static get currentFrame() { return Private.currentFrame; }
}
