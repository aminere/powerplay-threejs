import { AnimationAction, AnimationMixer, LoopOnce, LoopPingPong, LoopRepeat, Object3D } from "three";
import { Component } from "../Component";
import { ComponentProps } from "../ComponentProps";
import { time } from "../Time";
import { engineState } from "../EngineState";
import { TArray } from "../TArray";
import * as Attributes from "../Attributes";

const LoopModes = [
    "Once",
    "Repeat",
    "PingPong"
] as const;

type LoopMode = typeof LoopModes[number];

export class AnimatorProps extends ComponentProps {
    currentAnim = 0;
    animations = new TArray(String);    

    @Attributes.enumOptions(LoopModes)
    loopMode: LoopMode = "Repeat";

    repetitions = Infinity;
    autoStart = true;

    constructor(props?: Partial<AnimatorProps>) {
        super();

        if (props?.currentAnim) {
            if (typeof props.currentAnim === "string") {
                console.warn("Upgrading from old AnimatorProps");
                props.currentAnim = 0;
            }
        }

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

        const { animations, currentAnim } = this.props;
        const actions = animations.map(animation => {
            const info = engineState.animations.get(animation.valueOf());
            if (info) {
                const action = mixer.clipAction(info.clip);
                switch (this.props.loopMode) {
                    case "Once": {
                        action.setLoop(LoopOnce, 1);
                        action.clampWhenFinished = true;
                    } break;
                    case "Repeat": action.setLoop(LoopRepeat, this.props.repetitions); break;
                    case "PingPong": action.setLoop(LoopPingPong, this.props.repetitions); break;
                }                
                return action;
            } else {
                console.warn(`Animation '${animation}' not found`);
                return null;
            }
        })
            .filter(Boolean)
            .reduce((prev, cur) => ({ ...prev, [cur!.getClip().name]: cur! }), {} as Record<string, AnimationAction>);

        const currentAnimName = animations.at(currentAnim).valueOf();
        this.setState({ mixer, actions, currentAnim: currentAnimName });

        if (this.props.autoStart) {
            actions[currentAnimName]?.play();
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

