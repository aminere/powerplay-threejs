import { Line3, Matrix4, Plane, Quaternion, Triangle, Vector2, Vector3 } from "three";
import { ObjectPool } from "./ObjectPool";

class Pools {

    get vec2() { return this._vec2; }
    get vec3() { return this._vec3; }
    get mat4() { return this._mat4; }
    get quat() { return this._quat; }
    get plane() { return this._plane; }
    get line3() { return this._line3; }
    get triangle() { return this._triangle; }    

    private _vec2 = new ObjectPool(Vector2, 128);
    private _vec3 = new ObjectPool(Vector3, 128);
    private _mat4 = new ObjectPool(Matrix4, 32);
    private _quat = new ObjectPool(Quaternion, 32);
    private _plane = new ObjectPool(Plane, 128);
    private _line3 = new ObjectPool(Line3, 128);
    private _triangle = new ObjectPool(Triangle, 128);

    public flush() {
        this._vec2.flush();
        this._vec3.flush();
        this._mat4.flush();
        this._quat.flush();
        this._plane.flush();
        this._line3.flush();
        this._triangle.flush();
    }
}

export const pools = new Pools();

