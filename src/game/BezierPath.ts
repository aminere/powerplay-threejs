import { Vector3 } from "three";
import { GameUtils } from "./GameUtils";

const previous = new Vector3();
const current = new Vector3();

export class BezierPath {

    private _points: Vector3[] = [];
    private _length?: number;

    public get length() {
        if (this._length === undefined) {
            let length = 0;
            const steps = 256;
            
            this.evaluate(0, previous);
            for (let i = 1; i <= steps; i++) {
                const t = i / steps;
                this.evaluate(t, current);
                length += previous.distanceTo(current);
                previous.copy(current);
            }
            this._length = length;
        }
        return this._length;
    }

    public setPoints(points: Vector3[]) {
        this._points = points;
        delete this._length;
    }

    public evaluate(t: number, out: Vector3) {
        const segments = this._points.length / 4;
        const segmentLength = 1 / segments;
        const segmentIndex = Math.max(Math.min(Math.floor(t / segmentLength), segments - 1), 0);
        const localT = (t - segmentIndex * segmentLength) / segmentLength;
        return this.interpolate(localT, segmentIndex * 4, out);
    }    

    private interpolate(t: number, startIndex: number, out: Vector3) {
        const p0 = this._points[startIndex];
        const p1 = this._points[startIndex + 1]; // tangent 1
        const p2 = this._points[startIndex + 2]; // tangent 2
        const p3 = this._points[startIndex + 3];
        const oneMinusT = 1 - t;        
        out.copy(p0).multiplyScalar(oneMinusT * oneMinusT * oneMinusT)
            .addScaledVector(p1, 3 * oneMinusT * oneMinusT * t)
            .addScaledVector(p2, 3 * oneMinusT * t * t)
            .addScaledVector(p3, t * t * t);
        return out;
    }

    public evaluateTangent(t: number, out: Vector3) {
        const segments = this._points.length / 4;
        const segmentLength = 1 / segments;
        const segmentIndex = Math.max(Math.min(Math.floor(t / segmentLength), segments - 1), 0);
        const localT = (t - segmentIndex * segmentLength) / segmentLength;
        return this.interpolateTangent(localT, segmentIndex * 4, out);
    }

    public evaluateBitangent(t: number, out: Vector3) {
        return this.evaluateTangent(t, out)
            .normalize()
            .cross(GameUtils.vec3.up);
    }

    private static p1p0 = new Vector3();
    private static p2p1 = new Vector3();
    private static p3p2 = new Vector3();
    private interpolateTangent(t: number, startIndex: number, out: Vector3) {
        const p0 = this._points[startIndex];
        const p1 = this._points[startIndex + 1]; // tangent 1
        const p2 = this._points[startIndex + 2]; // tangent 2
        const p3 = this._points[startIndex + 3];
        const { p1p0, p2p1, p3p2 } = BezierPath;
        p1p0.subVectors(p1, p0);
        p2p1.subVectors(p2, p1);
        p3p2.subVectors(p3, p2);
        const oneMinusT = 1 - t;        
        out.copy(p1p0).multiplyScalar(3 * oneMinusT * oneMinusT)
            .addScaledVector(p2p1, 6 * oneMinusT * t)
            .addScaledVector(p3p2, 3 * t * t);
        return out;
    }
}

