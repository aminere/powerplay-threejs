import { Object3D, Vector3 } from "three";

const minarr = new Vector3().toArray();
const maxarr = new Vector3().toArray();
const min = new Vector3();
const max = new Vector3();
const localPos = new Vector3();
const localPosArr = new Vector3().toArray();

export class Collision {

    // Based on Jim Arvo, in "Graphics Gems"
    public static sphereObbInstersects(obb: Object3D, spherePos: Vector3, sphereRadius: number) {
        const cubeRadius = .5;
        min.set(cubeRadius, cubeRadius, cubeRadius).negate().multiply(obb.scale).toArray(minarr);
        max.set(cubeRadius, cubeRadius, cubeRadius).multiply(obb.scale).toArray(maxarr);
        let dmin = 0;
        const c = obb.worldToLocal(localPos.copy(spherePos)).multiply(obb.scale).toArray(localPosArr);
        for (let i = 0; i < 3; ++i) {
            if (c[i] < minarr[i]) {
                dmin += (c[i] - minarr[i]) * (c[i] - minarr[i]);
            } else if (c[i] > maxarr[i]) {
                dmin += (c[i] - maxarr[i]) * (c[i] - maxarr[i]);
            }
        }
        if (dmin <= sphereRadius * sphereRadius) {
            return true;
        }
        return false;
    }

    // TODO
    // public static ObbObbIntersects(obb1: Object3D, obb2: Object3D) {
    //     const planes = [
    //         [new Plane(new Vector3(0, 1, 0), -.5), "y"],
    //         [new Plane(new Vector3(0, -1, 0), -.5), "y"],
    //         [new Plane(new Vector3(1, 0, 0), -.5), "x"],
    //         [new Plane(new Vector3(-1, 0, 0), -.5), "x"],
    //         [new Plane(new Vector3(0, 0, 1), -.5), "z"],
    //         [new Plane(new Vector3(0, 0, -1), -.5), "z"]
    //     ] as const;

    //     const intersects = () => {
    //         const sphereRadius = 1;
    //         const localPos = cube.worldToLocal(sphere.position.clone());
    //         for (const [plane, axis] of planes) {
    //             const d = plane.distanceToPoint(localPos) * cube.scale[axis];
    //             //console.log(d);
    //             if (d > sphereRadius) {
    //                 return false;
    //             }
    //         }
    //         return true;
    //     };

    // }
}

