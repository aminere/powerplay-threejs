import { AnimationMixer, Object3D } from "three";
import { Component } from "../Component";
import { ComponentProps } from "../ComponentProps";
import { time } from "../Time";

export class AnimatorProps extends ComponentProps {

    autoStart = true;    

    constructor(props?: Partial<AnimatorProps>) {
        super();
        this.deserialize(props);
    }
}

interface IAnimatorState {
    mixer: AnimationMixer;
}

export class Animator extends Component<AnimatorProps, IAnimatorState> {
    constructor(props?: Partial<AnimatorProps>) {
        super(new AnimatorProps(props));
    }
    
    override start(owner: Object3D) {        
        const mixer = new AnimationMixer(owner);
        const clip = owner.animations[0];
        mixer.clipAction(clip).play();

        this.setState({ mixer });
    }
    
    override update(_owner: Object3D) {
        this.state.mixer.update(time.deltaTime);
    }
}


