
import { DoubleSide, Material, Mesh, Object3D } from "three";
import { Component } from "../../engine/ecs/Component";
import { ComponentProps } from "../../engine/ecs/ComponentProps";
import gsap from "gsap";
import { engineState } from "../../engine/EngineState";

export class FadeoutProps extends ComponentProps {    
    duration = 1;
    keepShadows = false;

    constructor(props?: Partial<FadeoutProps>) {
        super();
        this.deserialize(props);
    }
}

function meshFadeout(mesh: Mesh, duration: number, keepShadows: boolean) {
    if (Array.isArray(mesh.material)) {                
        console.warn("Fadeout component can only be applied to Mesh objects with a single material");
        return Promise.resolve();
    } else {
        return new Promise(resolve => {
            const material = (mesh.material as Material).clone();
            material.transparent = true;
            material.side = DoubleSide;
            mesh.material = material;
            gsap.to(material, {
                duration,
                opacity: 0,
                onUpdate: () => {
                    if (mesh.castShadow && !keepShadows) {
                        if (material.opacity < .5) {
                            mesh.castShadow = false;
                        }
                    }
                },
                onComplete: resolve
            });
        });                
    }
};

export class Fadeout extends Component<FadeoutProps> {
    constructor(props?: Partial<FadeoutProps>) {
        super(new FadeoutProps(props));
    }    

    override start(owner: Object3D) {
        const subMeshes = owner.getObjectsByProperty("isMesh", true) as Mesh[];
        Promise.all(subMeshes.map(mesh => meshFadeout(mesh, this.props.duration, this.props.keepShadows)))
            .then(() => {
                engineState.removeObject(owner);
            });
    }
}

