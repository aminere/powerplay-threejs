

import { Object3D, Vector3 } from "three";
import { Component } from "../../engine/Component";
import { ComponentProps } from "../../engine/ComponentProps";
import { TArray } from "../TArray";

export class BezierPathProps extends ComponentProps {

    points = new TArray(Vector3);

    constructor(props?: Partial<BezierPathProps>) {
        super();
        this.deserialize(props);
    }
}

export class BezierPath extends Component<BezierPathProps> {
    constructor(props?: Partial<BezierPathProps>) {
        super(new BezierPathProps(props));
    }

    override start(_owner: Object3D) {
    }

}

