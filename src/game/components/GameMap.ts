import { Box2, Camera, DirectionalLight, MathUtils, Object3D, OrthographicCamera, Vector2, Vector3 } from "three";
import { Component, IComponentProps } from "../../engine/Component"
import { createMapState, destroyMapState } from "../MapState";
import { Sector } from "../Sector";
import { config } from "../config";
import { GameUtils } from "../GameUtils";
import { ISector } from "../GameTypes";
import { input } from "../../engine/Input";
import { Time } from "../../engine/Time";
import { engine } from "../../engine/Engine";
import { pools } from "../../engine/Pools";
import { DOMUtils } from "../../engine/DOMUtils";

interface IGameMapState {
    sectors: Map<string, ISector>;
    bounds?: Box2;
}

export class GameMap extends Component<IComponentProps> {
    private _owner!: Object3D;
    private _state!: IGameMapState;
    private _cameraZoom = 1;
    private _cameraAngleRad = 0;
    private _cameraRoot!: Object3D;
    private _camera!: Camera;
    private _light!: DirectionalLight;
    private _cameraBoundsAccessors = [0, 1, 2, 3];  
    private _cameraBounds = [
        new Vector3(), // top
        new Vector3(), // right
        new Vector3(), // bottom
        new Vector3() // left
    ];
    
    constructor(props?: IComponentProps) {
        super(props);
        this._state = {
            sectors: new Map<string, any>()
        };
    }

    override start(owner: Object3D) {
        this._owner = owner;
        createMapState(this._state);
        this.createSector(new Vector2(0, 0));
        this._cameraRoot = engine.scene?.getObjectByName("camera-root")!;
        this._camera = this._cameraRoot.getObjectByProperty("type", "OrthographicCamera") as Camera;
        this._light = this._cameraRoot.getObjectByProperty("type", "DirectionalLight") as DirectionalLight;
        const [, rotationY] = config.camera.rotation;
        this._cameraAngleRad = MathUtils.degToRad(rotationY);

        this.onWheel = this.onWheel.bind(this);
        document.addEventListener("wheel", this.onWheel, { passive: false });
    }

    override update(owner: Object3D) {        
        // this.updateCameraPan();
    }

    override dispose() {
        destroyMapState();
        document.removeEventListener("wheel", this.onWheel);
    }

    private createSector(coords: Vector2) {
        const sectorRoot = Sector.create(coords, this._owner);

        // update bounds
        const { mapRes, cellSize } = config.game;
        const mapSize = mapRes * cellSize;
        const [min, max] = pools.vec2.get(2);
        min.set(sectorRoot.position.x, sectorRoot.position.z);
        max.set(min.x + mapSize, min.y + mapSize);
        const { bounds } = this._state;
        if (!bounds) {
            this._state.bounds = new Box2(min.clone(), max.clone());
        } else {
            bounds.expandByPoint(min);
            bounds.expandByPoint(max);
        }
    }

    private updateCameraPan() {
        const touchPos = input.touchPos;
        const dt = Time.deltaTime;
        const rc = engine.renderer!.domElement.getBoundingClientRect();
        const width = rc.width;
        const height = rc.height;        
        const { panMargin, panSpeed } = config.camera;
        // [0, s] to [-1, 1]
        const [xNorm, yNorm] = [(touchPos.x / width) * 2 - 1, (touchPos.y / height) * 2 - 1];
        const margin = 50;
        const [delta, oldPos] = pools.vec3.get(2);
        if (Math.abs(xNorm) > 1 - panMargin) {
            const dx = xNorm * dt * panSpeed * this._cameraZoom;
            delta.set(dx, 0, 0).applyAxisAngle(GameUtils.vec3.up, this._cameraAngleRad);
            oldPos.copy(this._cameraRoot.position);
            this._cameraRoot.position.add(delta);
            this.updateCameraBounds();
            const [_, rightAccessor, __, leftAccessor] = this._cameraBoundsAccessors;
            const rightBound = this._cameraBounds[rightAccessor];
            const leftBound = this._cameraBounds[leftAccessor];
            const { x: leftX } = leftBound;
            const { x: rightX } = rightBound;
            if (dx < 0) {
                if (leftX > 0) {
                    if (rightX > width - margin) {
                        this._cameraRoot.position.copy(oldPos);
                        this.updateCameraBounds();            
                    }
                }
            } else {
                if (rightX < width) {
                    if (leftX < margin) {
                        this._cameraRoot.position.copy(oldPos);
                        this.updateCameraBounds();            
                    }
                }
            }
        }
        if (Math.abs(yNorm) > 1 - panMargin) {            
            const aspect = width / height;
            const dy = yNorm * aspect * dt * panSpeed * this._cameraZoom;
            delta.set(0, 0, dy).applyAxisAngle(GameUtils.vec3.up, this._cameraAngleRad);
            oldPos.copy(this._cameraRoot.position);
            this._cameraRoot.position.add(delta);
            this.updateCameraBounds();
            const [topAcecssor, _, bottomAccessor] = this._cameraBoundsAccessors;
            const topBound = this._cameraBounds[topAcecssor];
            const bottomBound = this._cameraBounds[bottomAccessor];
            const { y: topY } = topBound;
            const { y: bottomY } = bottomBound;
            if (dy < 0) {
                if (topY > 0) {
                    if (bottomY > height - margin) {
                        this._cameraRoot.position.copy(oldPos);
                        this.updateCameraBounds();
                    }
                }
            } else {
                if (bottomY < height) {
                    if (topY < margin) {
                        this._cameraRoot.position.copy(oldPos);
                        this.updateCameraBounds();
                    }
                }
            }
        }
    }

    private updateCameraBounds() {
        const worldPos = pools.vec3.getOne();
        const [top, right, bottom, left] = this._cameraBounds;
        const mapBounds = this._state.bounds;
        GameUtils.worldToScreen(worldPos.set(mapBounds!.min.x, 0, mapBounds!.min.y), this._camera, top);
        GameUtils.worldToScreen(worldPos.set(mapBounds!.max.x, 0, mapBounds!.max.y), this._camera, bottom);
        GameUtils.worldToScreen(worldPos.set(mapBounds!.min.x, 0, mapBounds!.max.y), this._camera, left);
        GameUtils.worldToScreen(worldPos.set(mapBounds!.max.x, 0, mapBounds!.min.y), this._camera, right);
    }

    private onWheel(e: WheelEvent) {
        const delta = DOMUtils.getWheelDelta(e.deltaY, e.deltaMode);
        const { zoomSpeed, zoomRange, orthoSize } = config.camera;
        const [min, max] = zoomRange;
        const newZoom = MathUtils.clamp(this._cameraZoom + delta * zoomSpeed, min, max);
        const deltaZoom = newZoom - this._cameraZoom;
        const rc = engine.renderer!.domElement.getBoundingClientRect();
        const width = rc.width;
        const height = rc.height;
        // [0, s] to [-1, 1]
        const touchPos = input.touchPos;
        const [xNorm, yNorm] = [(touchPos.x / width) * 2 - 1, (touchPos.y / height) * 2 - 1];
        const aspect = width / height;
        const offsetX = orthoSize * aspect * xNorm * deltaZoom;
        const offsetY = orthoSize * aspect * yNorm * deltaZoom;
        const deltaPos = pools.vec3.getOne();
        deltaPos.set(-offsetX, 0, -offsetY).applyAxisAngle(GameUtils.vec3.up, this._cameraAngleRad);
        this._cameraRoot.position.add(deltaPos);
        this._cameraZoom = newZoom;
        this.updateCameraSize();
        e.preventDefault();
        e.stopPropagation();
    }

    private updateCameraSize() {
        const rc = engine.renderer!.domElement.getBoundingClientRect();
        const width = rc.width;
        const height = rc.height;
        const aspect = width / height;
        const { orthoSize, shadowRange } = config.camera;
        (this._camera as OrthographicCamera).zoom = 1 / this._cameraZoom;
        (this._camera as OrthographicCamera).updateProjectionMatrix();
        this.updateCameraBounds();        
        const cameraLeft = -orthoSize * this._cameraZoom * aspect;
        const _shadowRange = Math.abs(cameraLeft) * shadowRange;        
        this._light.shadow.camera.left = -_shadowRange;
        this._light.shadow.camera.right = _shadowRange;
        this._light.shadow.camera.top = _shadowRange;
        this._light.shadow.camera.bottom = -_shadowRange;
        this._light.shadow.camera.updateProjectionMatrix();
    }
}

