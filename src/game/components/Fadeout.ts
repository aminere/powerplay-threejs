
import { Mesh, Object3D } from "three";
import { Component } from "../../engine/ecs/Component";
import { ComponentProps } from "../../engine/ecs/ComponentProps";
import gsap from "gsap";

export class FadeoutProps extends ComponentProps {    
    duration = 1;

    constructor(props?: Partial<FadeoutProps>) {
        super();
        this.deserialize(props);
    }
}

export class Fadeout extends Component<FadeoutProps> {

    private _tween: gsap.core.Tween | null = null;

    constructor(props?: Partial<FadeoutProps>) {
        super(new FadeoutProps(props));
    }
    
    override dispose(_owner: Object3D) {        
        if (this._tween) {
            this._tween.kill();
        }
    }

    override start(owner: Object3D) {
        const mesh = (owner as Mesh);
        if (mesh.isMesh) {
            if (Array.isArray(mesh.material)) {
                console.warn("Fadeout component can only be applied to Mesh objects with a single material");
            } else {
                const material = mesh.material.clone();
                material.transparent = true;
                mesh.material = material;                
                mesh.castShadow = false;
                this._tween = gsap.to(material, {
                    duration: this.props.duration,
                    opacity: 0,
                    onComplete: () => {
                        mesh.visible = false;
                        this._tween = null;
                    }
                });
            }
        } else {
            console.warn("Fadeout component can only be applied to Mesh objects");
        }
    }
}

