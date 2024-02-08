
import { Component } from "../../engine/ecs/Component";
import { ComponentProps } from "../../engine/ecs/ComponentProps";

import * as Attributes from "../../engine/serialization/Attributes";
import { Mesh, Object3D, ShaderMaterial } from "three";
import { time } from "../../engine/core/Time";

export class GrassProps extends ComponentProps {

    @Attributes.range([0, 1])
    windStrength = 1;

    constructor(props?: Partial<GrassProps>) {
        super();
        this.deserialize(props);
    }
}

export class Grass extends Component<GrassProps> {
    constructor(props?: Partial<GrassProps>) {
        super(new GrassProps(props));
    }

    override update(_owner: Object3D) {
        const material = (_owner as Mesh).material as ShaderMaterial;
        material.uniforms.time.value = time.time * this.props.windStrength;
        material.uniformsNeedUpdate = true;
    }
}

