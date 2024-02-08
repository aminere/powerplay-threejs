import { Mesh, Object3D } from "three";
import { Component, IComponentState } from "../../engine/ecs/Component";
import { ComponentProps } from "../../engine/ecs/ComponentProps";
import { time } from "../../engine/core/Time";

export class AnimateMorphTargetsProps extends ComponentProps { 
    frequency = 1;

    constructor(props?: Partial<AnimateMorphTargetsProps>) {
        super();
        this.deserialize(props);
    }
}

interface IAnimateMorphTargetsState extends IComponentState {
    angles: number[];
}

export class AnimateMorphTargets extends Component<AnimateMorphTargetsProps, IAnimateMorphTargetsState> {

    constructor(props?: Partial<AnimateMorphTargetsProps>) {
        super(new AnimateMorphTargetsProps(props));
    }

    override start(owner: Object3D) {
        const mesh = owner as Mesh;
        console.assert(mesh.isMesh);
        if (mesh.morphTargetInfluences) {
            const influences = mesh.morphTargetInfluences!;
            this.setState({ angles: influences.map(() => Math.random() * Math.PI) });
        } else {
            console.assert(false, "Mesh does not have morph targets");
            this.props.active = false;
        }        
    }

    override update(owner: Object3D) {
        const mesh = owner as Mesh;
        const influences = mesh.morphTargetInfluences!;
        for (let i = 0; i < influences.length; i++) {
            this.state.angles[i] += time.deltaTime * this.props.frequency;
            influences[i] = Math.cos(this.state.angles[i]) * 0.5 + 0.5;
        }
    }
}

