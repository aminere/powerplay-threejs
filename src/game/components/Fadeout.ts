
import { DoubleSide, Material, Mesh, Object3D } from "three";
import { Component } from "../../engine/ecs/Component";
import { ComponentProps } from "../../engine/ecs/ComponentProps";
import { time } from "../../engine/core/Time";

export class FadeoutProps extends ComponentProps {    
    duration = 1;
    keepShadows = false;

    constructor(props?: Partial<FadeoutProps>) {
        super();
        this.deserialize(props);
    }
}

export class Fadeout extends Component<FadeoutProps> {

    private _targets!: Mesh[];
    private _timer = 0;
    private _done = false;

    constructor(props?: Partial<FadeoutProps>) {
        super(new FadeoutProps(props));
    }

    override start(owner: Object3D) {
        this._targets = owner.getObjectsByProperty("isMesh", true) as Mesh[];
        for (const mesh of this._targets) {
            const material = (mesh.material as Material).clone();
            material.transparent = true;
            material.side = DoubleSide;
            mesh.material = material;
        }            
    }

    override update(_owner: Object3D) {
        const { duration, keepShadows } = this.props;

        if (this._done) {
            return;
        }
        
        this._timer += time.deltaTime;
        if (this._timer > duration) {
            this._timer = duration;
            this._done = true;
        }

        for (const target of this._targets) {
            const material = (target.material as Material);
            material.opacity = 1 - this._timer / duration;

            if (target.castShadow && !keepShadows) {
                if (material.opacity < .5) {
                    target.castShadow = false;
                }
            }
        }
    }
}

