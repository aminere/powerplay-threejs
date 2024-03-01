
import { Quaternion, MathUtils as TMathUtils, Vector3 } from "three";

const _2PI = Math.PI * 2;

class MathUtils {
    public lerp_InOutCubic(a: number, b: number, t: number) {
        const factor = (t < 0.5) ? 4 * t * t * t : (1 - ((-2 * t + 2) ** 3) / 2);
        return a + (b - a) * factor;
    }

    public smoothDamp(a: number, b: number, halfLife: number, dt: number) {
        return b + (a - b) * Math.pow(2, -dt / halfLife);        
    }    

    public smoothDampAngle(current: number, target: number, halfLife: number, deltaTime: number) {
        const targetAngle = current + this.deltaAngle(current, target);
        return this.smoothDamp(current, targetAngle, halfLife, deltaTime);
    }   

    public smoothDampVec3(current: Vector3, target: Vector3, halfLife: number, deltaTime: number) {       
        current.x = this.smoothDamp(current.x, target.x, halfLife, deltaTime);
        current.y = this.smoothDamp(current.y, target.y, halfLife, deltaTime);
        current.z = this.smoothDamp(current.z, target.z, halfLife, deltaTime);
    }

    // Calculates the shortest difference between two given angles.
    public deltaAngle(current: number, target: number) {
        let delta = this.repeat((target - current), _2PI);
        if (delta > Math.PI) {
            delta -= _2PI;
        }
        return delta;
    }    

    public smoothDampQuat(current: Quaternion, target: Quaternion, halfLife: number, deltaTime: number) {
        const delta = current.angleTo(target);
        if (delta > 0) {
            let t = this.smoothDampAngle(delta, 0, halfLife, deltaTime);
            t = 1.0 - (t / delta);
            current.slerp(target, t);
        }
    }

    // Loops the value t, so that it is never larger than length and never smaller than 0.
    public repeat(t: number, length: number) {
        return TMathUtils.clamp(t - Math.floor(t / length) * length, 0., length);
    }
}

export const mathUtils = new MathUtils();

