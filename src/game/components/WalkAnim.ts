import { Object3D, SkinnedMesh } from "three";
import { Component } from "../../engine/Component";
import { ComponentProps } from "../../engine/ComponentProps";
import { SkeletonManager } from "../animation/SkeletonManager";
import { time } from "../../engine/Time";
import { engineState } from "../../engine/EngineState";

export class WalkAnimProps extends ComponentProps {
    skeletonManager: SkeletonManager | null = null;
    duration = .25;

    constructor(props?: Partial<WalkAnimProps>) {
        super();
        this.deserialize(props);
    }
}

interface IWalkAnimState {
    timer: number;
}

export class WalkAnim extends Component<WalkAnimProps, IWalkAnimState> {
    constructor(props?: Partial<WalkAnimProps>) {
        super(new WalkAnimProps(props));
    }

    override start(owner: Object3D) {
        this.props.skeletonManager?.applySkeleton("walk", owner as SkinnedMesh);
        this.setState({ timer: this.props.duration });
    }

    override update(owner: Object3D) {
        this.state.timer -= time.deltaTime;
        if (this.state.timer < 0) {
            this.props.skeletonManager?.applySkeleton("idle", owner as SkinnedMesh);
            engineState.removeComponent(owner, WalkAnim);
        }
    }

    public reset() {
        this.state.timer = this.props.duration;
    }
}

