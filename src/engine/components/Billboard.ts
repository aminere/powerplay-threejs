
import { Object3D, Quaternion } from "three";
import { Component } from "../../engine/ecs/Component";
import { ComponentProps } from "../../engine/ecs/ComponentProps";

export class Billboard extends Component<ComponentProps> {
    public static typename = "Billboard";

    override mount(owner: Object3D) { 
        owner.matrixAutoUpdate = false;
    }

    setQuaternion(owner: Object3D, quaternion: Quaternion) {
        owner.matrix.compose(owner.position, quaternion, owner.scale);
        owner.matrixWorldNeedsUpdate = true;
    }
}

