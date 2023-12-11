import { Mesh, Object3D } from "three";
import { Component, IComponentState } from "../../engine/Component";
import { ComponentProps } from "../../engine/ComponentProps";
import { time } from "../../engine/Time";

export class TreeProps extends ComponentProps { }

interface ITreeState extends IComponentState {
    angles: number[];
}

export class Tree extends Component<TreeProps, ITreeState> {

    override start(owner: Object3D) {
        const mesh = owner as Mesh;
        console.assert(mesh.isMesh);
        console.assert(mesh.morphTargetInfluences);
        const influences = mesh.morphTargetInfluences!;
        this.setState({
            angles: influences.map(() => Math.random() * Math.PI)
        });
    }

    override update(owner: Object3D) {
        const mesh = owner as Mesh;
        const influences = mesh.morphTargetInfluences!;
        for (let i = 0; i < influences.length; i++) {
            this.state.angles[i] += time.deltaTime;
            influences[i] = Math.cos(this.state.angles[i]) * 0.5 + 0.5;
        }
    }
}

