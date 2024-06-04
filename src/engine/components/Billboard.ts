
import { Object3D, Quaternion } from "three";
import { Component } from "../../engine/ecs/Component";
import { ComponentProps } from "../../engine/ecs/ComponentProps";

export class Billboard extends Component<ComponentProps> {
    public static typename = "Billboard" as const;

    override mount(owner: Object3D) { 
        owner.matrixAutoUpdate = false;
    }

    setRotation(owner: Object3D, rotation: Quaternion) {
        owner.matrix.compose(owner.position, rotation, owner.scale);
        owner.matrixWorldNeedsUpdate = true;
    }
}

