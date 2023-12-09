import { AnimationMixer, Object3D } from "three";
import { Component } from "../Component";
import { ComponentProps } from "../ComponentProps";
import { time } from "../Time";
import { engine } from "../Engine";

export class AnimatorProps extends ComponentProps {    
    animation = "";
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
        this.setState({ mixer });

        if (this.props.autoStart) {
            const info = engine.animations.get(this.props.animation);
            if (info) {
                mixer.clipAction(info.clip).play();
            } else {
                console.warn(`Animation '${this.props.animation}' not found`);
            }            
        }        
    }
    
    override update(_owner: Object3D) {
        this.state.mixer.update(time.deltaTime);
    }
}


