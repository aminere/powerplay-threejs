
import { MathUtils as TMathUtils, Vector3 } from "three";

export interface ISmoothDampResult<T> {
    value: T;
    velocity: T;
}

class MathUtils {
    public lerp_InOutCubic(a: number, b: number, t: number) {
        const factor = (t < 0.5) ? 4 * t * t * t : (1 - ((-2 * t + 2) ** 3) / 2);
        return a + (b - a) * factor;
    }

    // Based on Game Programming Gems 4 Chapter 1.10
    public smoothDamp(current: number, target: number, velocity: number, smoothTime: number, maxSpeed: number, deltaTime: number, result: ISmoothDampResult<number>) {
        smoothTime = Math.max(0.0001, smoothTime);
        const omega = 2. / smoothTime;
        const x = omega * deltaTime;
        const exp = 1 / (1 + x + 0.48 * x * x + 0.235 * x * x * x);
        let change = current - target;
        const originalTo = target;
        const maxChange = maxSpeed * smoothTime;
        change = TMathUtils.clamp(change, -maxChange, maxChange);
        target = current - change;
        const temp = (velocity + omega * change) * deltaTime;
        let outputVelocity = (velocity - omega * temp) * exp;
        let output = target + (change + temp) * exp;
        // Prevent overshooting
        if (originalTo - current > 0.0 === output > originalTo) {
            output = originalTo;
            outputVelocity = (output - originalTo) / deltaTime;
        }
        result.value = output;
        result.velocity = outputVelocity;
    }

    private _smoothDampVec3ResultX = { value: 0, velocity: 0 };
    private _smoothDampVec3ResultY = { value: 0, velocity: 0 };
    private _smoothDampVec3ResultZ = { value: 0, velocity: 0 };
    public smoothDampVec3(current: Vector3, target: Vector3, velocity: Vector3, smoothTime: number, maxSpeed: Vector3, deltaTime: number, result: ISmoothDampResult<Vector3>) {       
        this.smoothDamp(current.x, target.x, velocity.x, smoothTime, maxSpeed.x, deltaTime, this._smoothDampVec3ResultX);
        this.smoothDamp(current.y, target.y, velocity.y, smoothTime, maxSpeed.y, deltaTime, this._smoothDampVec3ResultY);
        this.smoothDamp(current.z, target.z, velocity.z, smoothTime, maxSpeed.z, deltaTime, this._smoothDampVec3ResultZ);
        result.value.set(this._smoothDampVec3ResultX.value, this._smoothDampVec3ResultY.value, this._smoothDampVec3ResultZ.value);
        result.velocity.set(this._smoothDampVec3ResultX.velocity, this._smoothDampVec3ResultY.velocity, this._smoothDampVec3ResultZ.velocity);
    }
}

export const mathUtils = new MathUtils();

