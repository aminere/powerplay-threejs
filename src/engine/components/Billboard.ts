
import { Camera, Object3D, Quaternion, Renderer, Scene, Vector3 } from "three";
import { Component } from "../../engine/ecs/Component";
import { ComponentProps } from "../../engine/ecs/ComponentProps";

const worldPos = new Vector3();
const worldScale = new Vector3();
const worldRot = new Quaternion();

export class Billboard extends Component<ComponentProps> {

    override mount(owner: Object3D) {
        owner.onBeforeRender = (_renderer: Renderer, _scene: Scene, camera: Camera) => {
            const { worldRotation: cameraRotation } = camera.userData;
            owner.matrixWorld.decompose(worldPos, worldRot, worldScale);
            owner.matrixWorld.compose(worldPos, cameraRotation, worldScale);
        }
    }
}

