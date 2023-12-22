import { AnimationAction, AnimationMixer, Object3D } from "three";
import { Component } from "../Component";
import { ComponentProps } from "../ComponentProps";
import { time } from "../Time";
import { engineState } from "../EngineState";

export class AnimatorProps extends ComponentProps {
    currentAnim = "";
    animations = new Array<string>();    
    autoStart = true;

    constructor(props?: Partial<AnimatorProps>) {
        super();
        this.deserialize(props);
    }
}

interface IAnimatorState {
    mixer: AnimationMixer;
    actions: Record<string, AnimationAction>;
    currentAnim: string;
}

export class Animator extends Component<AnimatorProps, IAnimatorState> {

    public get currentAction() { return this.state.actions[this.state.currentAnim]; }

    constructor(props?: Partial<AnimatorProps>) {
        super(new AnimatorProps(props));
    }
    
    override start(owner: Object3D) {
        const mixer = new AnimationMixer(owner);
        const actions = this.props.animations.map(animation => {
            const info = engineState.animations.get(animation);
            if (info) {
                return mixer.clipAction(info.clip);
            } else {
                console.warn(`Animation '${animation}' not found`);
                return null;
            }
        })
            .filter(Boolean)
            .reduce((prev, cur) => ({ ...prev, [cur!.getClip().name]: cur! }), {} as Record<string, AnimationAction>);

        this.setState({ mixer, actions, currentAnim: this.props.currentAnim });

        if (this.props.autoStart) {
            actions[this.props.currentAnim]?.play();
        }        
    }
    
    override update(_owner: Object3D) {
        this.state.mixer.update(time.deltaTime);
    }

    public transitionTo(animation: string) {
        const transitionDuration = .5;
        const currentAction = this.state.actions[this.state.currentAnim];
        const nextAction = this.state.actions[animation];
        if (currentAction && nextAction) {
            currentAction.crossFadeTo(nextAction, transitionDuration, false);
            nextAction
                .reset()
                .play();                
            this.state.currentAnim = animation;
        }
    }
}

