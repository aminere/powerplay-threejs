import { DirectionalLight, Object3D, Vector3 } from "three";
import { Component, IComponentProps } from "../../engine/Component";

export interface IDirectionalLightProps extends IComponentProps {
    direction: Vector3;
}

export class DirectionalLightComponent extends Component<IDirectionalLightProps> {

    constructor(props?: IDirectionalLightProps) {
        super(props ?? {
            direction: new Vector3(1, 3, 1.8).normalize()
        });
    }

    override start(owner: Object3D) {
        const light = owner as DirectionalLight;
        if (light.isDirectionalLight) {
            light.target.position.copy(light.position).addScaledVector(this.props.direction, -1);
            light.target.name = "DirectionalLightTarget";
            owner.parent!.add(light.target);
        }
    }
}

