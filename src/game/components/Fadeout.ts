
import { Mesh, Object3D } from "three";
import { Component, IComponentState } from "../../engine/Component";
import { ComponentProps } from "../../engine/ComponentProps";
import gsap from "gsap";

export class FadeoutProps extends ComponentProps {    
    duration = 1;
    delay = 0;

    constructor(props?: Partial<FadeoutProps>) {
        super();
        this.deserialize(props);
    }
}

interface IFadeoutState extends IComponentState {    
}

export class Fadeout extends Component<FadeoutProps, IFadeoutState> {
    constructor(props?: Partial<FadeoutProps>) {
        super(new FadeoutProps(props));
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
                const { duration, delay } = this.props;

                const fadeOut = () => {
                    mesh.castShadow = false;
                    gsap.to(material, { duration, opacity: 0 });
                };

                if (delay > 0) {
                    setTimeout(fadeOut, delay * 1000);                
                } else {
                    fadeOut();
                }
            }
        } else {
            console.warn("Fadeout component can only be applied to Mesh objects");
        }
    }
}

