
import { Object3D, Vector3 } from "three";
import { ComponentProps } from "../ecs/ComponentProps";
import { Collider, ColliderType } from "./Collider";

export class SphereColliderProps extends ComponentProps {
    radius = 1;
    center = new Vector3();

    constructor(props?: Partial<SphereColliderProps>) {
        super();
        this.deserialize(props);
    }
}

interface ISphereColliderState {
    collisions: Object3D[];
}

export class SphereCollider extends Collider<SphereColliderProps, ISphereColliderState> {
    constructor(props?: Partial<SphereColliderProps>) {
        super(new SphereColliderProps(props));
        this.setState({ collisions: [] })
    }

    override getType(): ColliderType { return "sphere"; }
}

