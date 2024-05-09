import { Object3D, Vector3 } from "three";

const minarr = new Vector3().toArray();
const maxarr = new Vector3().toArray();
const min = new Vector3();
const max = new Vector3();
const localPos = new Vector3();
const localPosArr = new Vector3().toArray();

export class Collision {

    // Based on Jim Arvo, in "Graphics Gems"
    public static obbIntersectsSphere(obb: Object3D, _min: Vector3, _max: Vector3, spherePos: Vector3, sphereRadius: number) {
        min.copy(_min).multiply(obb.scale).toArray(minarr);
        max.copy(_max).multiply(obb.scale).toArray(maxarr);
        let dmin = 0;
        const c = obb.worldToLocal(localPos.copy(spherePos)).multiply(obb.scale).toArray(localPosArr);
        for (let i = 0; i < 3; ++i) {
            if (c[i] < minarr[i]) {
                dmin += (c[i] - minarr[i]) * (c[i] - minarr[i]);
            } else if (c[i] > maxarr[i]) {
                dmin += (c[i] - maxarr[i]) * (c[i] - maxarr[i]);
            }
        }
        return dmin < sphereRadius * sphereRadius;
    }
}

