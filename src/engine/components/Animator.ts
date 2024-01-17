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

    @Attributes.command("transition")
    transitionCommand = true;

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

function setLoopMode(action: AnimationAction, loopMode: LoopMode, repetitions: number) {
    switch (loopMode) {
        case "Once": {
            action.setLoop(LoopOnce, 1);
            action.clampWhenFinished = true;
        } break;
        case "Repeat": action.setLoop(LoopRepeat, repetitions); break;
        case "PingPong": action.setLoop(LoopPingPong, repetitions); break;
    }   
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
                setLoopMode(action, this.props.loopMode, this.props.repetitions);
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

    public transitionTo(animation: string, options?: {
        duration?: number;
        loopMode?: LoopMode;
        repetitions?: number;
        onFinished?: () => void;
    }) {
        const currentAction = this.state.actions[this.state.currentAnim];
        const nextAction = this.state.actions[animation];
        if (currentAction && nextAction) {

            if (options?.onFinished) {
                const onAnimFinished = () => {
                    options!.onFinished!();
                    this.state.mixer.removeEventListener("finished", onAnimFinished);
                };
                this.state.mixer.addEventListener("finished", onAnimFinished);
            }            
            
            const transitionDuration = options?.duration ?? 0.5;
            if (options?.loopMode) {
                setLoopMode(nextAction, options?.loopMode, options.repetitions ?? Infinity);
            }
            
            nextAction.reset().play();
            currentAction.crossFadeTo(nextAction, transitionDuration, true);
            this.state.currentAnim = animation;
        }
    }

    public reset() {
        const currentAction = this.state.actions[this.state.currentAnim];
        currentAction.reset().play();
    }
}

