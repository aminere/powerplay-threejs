
import { Quaternion, MathUtils as TMathUtils, Vector3 } from "three";

export interface ISmoothDampResult {    
    velocity: number;
}

const _2PI = Math.PI * 2;

class MathUtils {
    public lerp_InOutCubic(a: number, b: number, t: number) {
        const factor = (t < 0.5) ? 4 * t * t * t : (1 - ((-2 * t + 2) ** 3) / 2);
        return a + (b - a) * factor;
    }

    // Based on Game Programming Gems 4 Chapter 1.10
    public smoothDamp(current: number, _target: number, velocity: number, _smoothTime: number, maxSpeed: number, deltaTime: number, result: ISmoothDampResult) {
        const smoothTime = Math.max(0.0001, _smoothTime);
        const omega = 2. / smoothTime;
        const x = omega * deltaTime;
        const exp = 1 / (1 + x + 0.48 * x * x + 0.235 * x * x * x);
        let change = current - _target;
        const originalTo = _target;
        const maxChange = maxSpeed * smoothTime;
        change = TMathUtils.clamp(change, -maxChange, maxChange);
        const target = current - change;
        const temp = (velocity + omega * change) * deltaTime;
        let outputVelocity = (velocity - omega * temp) * exp;
        let output = target + (change + temp) * exp;
        // Prevent overshooting
        if ((originalTo - current) > 0.0 === (output > originalTo)) {
            output = originalTo;
            outputVelocity = (output - originalTo) / deltaTime;
        }
        result.velocity = outputVelocity;
        return output;
    }

    public smoothDampAngle(current: number, target: number, velocity: number, smoothTime: number, maxSpeed: number, deltaTime: number, result: ISmoothDampResult) {
        const targetAngle = current + this.deltaAngle(current, target);
        return this.smoothDamp(current, targetAngle, velocity, smoothTime, maxSpeed, deltaTime, result);
    }

    private _smoothDampVec3ResultX = { velocity: 0 };
    private _smoothDampVec3ResultY = { velocity: 0 };
    private _smoothDampVec3ResultZ = { velocity: 0 };
    public smoothDampVec3(current: Vector3, target: Vector3, velocity: Vector3, smoothTime: number, maxSpeed: number, deltaTime: number) {       
        current.x = this.smoothDamp(current.x, target.x, velocity.x, smoothTime, maxSpeed, deltaTime, this._smoothDampVec3ResultX);
        current.y = this.smoothDamp(current.y, target.y, velocity.y, smoothTime, maxSpeed, deltaTime, this._smoothDampVec3ResultY);
        current.z = this.smoothDamp(current.z, target.z, velocity.z, smoothTime, maxSpeed, deltaTime, this._smoothDampVec3ResultZ);
        velocity.set(this._smoothDampVec3ResultX.velocity, this._smoothDampVec3ResultY.velocity, this._smoothDampVec3ResultZ.velocity);
    }

    // Calculates the shortest difference between two given angles.
    public deltaAngle(current: number, target: number) {
        let delta = this.repeat((target - current), _2PI);
        if (delta > Math.PI) {
            delta -= _2PI;
        }
        return delta;
    }

    private _smoothDampQuatResult = { velocity: 0 };
    public smoothDampQuat(
        current: Quaternion, 
        target: Quaternion, 
        velocity: number, 
        smoothTime: number, 
        maxSpeed: number, 
        deltaTime: number        
    ) {
        const delta = current.angleTo(target);
        if (delta > 0) {
            let t = this.smoothDampAngle(delta, 0, velocity, smoothTime, maxSpeed, deltaTime, this._smoothDampQuatResult);
            t = 1.0 - (t / delta);
            current.slerp(target, t);
            return this._smoothDampQuatResult.velocity;
        }
        return velocity;
    }

    // Loops the value t, so that it is never larger than length and never smaller than 0.
    public repeat(t: number, length: number) {
        return TMathUtils.clamp(t - Math.floor(t / length) * length, 0., length);
    }
}

export const mathUtils = new MathUtils();

