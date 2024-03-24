import { Euler, MathUtils,  Object3D, Vector2, Vector3 } from "three";
import { Component } from "../../engine/ecs/Component"
import { config } from "../config";
import { engine } from "../../engine/Engine";
import { cmdFogAddCircle, cmdHideUI, cmdRotateMinimap, cmdSetSelectedElems, cmdShowUI } from "../../Events";
import { createSector, updateCameraBounds, updateCameraSize } from "../GameMapUtils";
import { railFactory } from "../RailFactory";
import { utils } from "../../engine/Utils";
import { GameMapProps } from "./GameMapProps";
import { engineState } from "../../engine/EngineState";
import { Water } from "./Water";
import { EnvProps } from "./EnvProps";
import { Trees } from "./Trees";
import { fogOfWar } from "../FogOfWar";
import gsap from "gsap";
import { buildings } from "../Buildings";
import { conveyors } from "../Conveyors";
import { conveyorItems } from "../ConveyorItems";
import { GameMapUpdate } from "./GameMapUpdate";
import { unitsManager } from "../unit/UnitsManager";
import { GameMapState } from "./GameMapState";
import { treesManager } from "../TreesManager";

export class GameMap extends Component<GameMapProps, GameMapState> {

    constructor(props?: Partial<GameMapProps>) {
        super(new GameMapProps(props));
    }

    override start(owner: Object3D) {

        this.setState(new GameMapState());        

        railFactory.preload();

        this.onKeyUp = this.onKeyUp.bind(this);
        this.onKeyDown = this.onKeyDown.bind(this);
        document.addEventListener("keyup", this.onKeyUp);
        document.addEventListener("keydown", this.onKeyDown);

        if (this.props.initSelf) {
            this.createSectors();
            this.preload()
                .then(() => this.init(this.props.size, owner))
                .then(() => engineState.setComponent(owner, new GameMapUpdate()));
        }
    }

    public createSectors() {
        if (this.state.sectors.size > 0) {
            this.disposeSectors();
        }

        const size = this.props.size;
        for (let i = 0; i < size; ++i) {
            for (let j = 0; j < size; ++j) {
                createSector(new Vector2(j, i));
            }
        }
    }

    public async preload() {
        await buildings.preload();
        await conveyors.preload();
        await unitsManager.preload();
        await conveyorItems.preload();
        await treesManager.preload();
    }

    public init(size: number, owner: Object3D) {
        this.state.sectorRes = size;

        fogOfWar.init(size);
        const { mapRes } = config.game;
        cmdFogAddCircle.post({ mapCoords: new Vector2(mapRes / 2, mapRes / 2), radius: mapRes / 2 });

        const water = utils.createObject(engine.scene!, "water");
        water.matrixAutoUpdate = false;
        water.matrixWorldAutoUpdate = false;
        water.position.setY(-.75);
        water.updateMatrix();
        engineState.setComponent(water, new Water({ sectorRes: size }));

        const props = utils.createObject(engine.scene!, "env-props");
        engineState.setComponent(props, new EnvProps({ sectorRes: size }));

        const trees = utils.createObject(engine.scene!, "trees");
        engineState.setComponent(trees, new Trees({ sectorRes: size }));
        trees.visible = false;

        unitsManager.init(owner);

        updateCameraSize();
        cmdShowUI.post("gamemap");
    }
    
    override dispose() {
        document.removeEventListener("keyup", this.onKeyUp);
        document.removeEventListener("keydown", this.onKeyDown);
        cmdHideUI.post("gamemap");
        conveyors.dispose();
        conveyorItems.dispose();
        this.state.dispose();
        this.props.dispose();
        unitsManager.dispose();
        fogOfWar.dispose();
    }

    public setCameraPos(pos: Vector3) {
        this.state.cameraRoot.position.copy(pos);
        updateCameraBounds();
    }

    public spawnUnitRequest() {
        const { selectedBuilding } = this.state;
        console.assert(selectedBuilding);
        unitsManager.spawnUnitRequest = selectedBuilding!;
    }

    private disposeSectors() {
        const { sectors } = this.state;
        for (const sector of sectors.values()) {
            const { root } = sector;
            root.removeFromParent();
            root.traverse((obj) => {
                utils.disposeObject(obj);
            });
        }
        sectors.clear();
    }    

    private onKeyDown(e: KeyboardEvent) {
        const key = e.key.toLowerCase();
        this.state.pressedKeys.add(key);
    }

    private onKeyUp(e: KeyboardEvent) {
        let cameraDirection = 0;
        const key = e.key.toLowerCase();

        switch (key) {
            case 'q': cameraDirection = -1; break;
            case 'e': cameraDirection = 1; break;
            case "delete": unitsManager.killSelection(); break;
        }
        if (cameraDirection !== 0 && !this.state.cameraTween) {
            this.state.cameraTween = gsap.to(this.state,
                {
                    cameraAngleRad: this.state.cameraAngleRad + Math.PI / 2 * cameraDirection,
                    duration: .45,
                    ease: "power2.out",
                    onUpdate: () => {
                        const [rotationX] = config.camera.rotation;
                        this.state.cameraPivot.setRotationFromEuler(new Euler(MathUtils.degToRad(rotationX), this.state.cameraAngleRad, 0, 'YXZ'));
                        cmdRotateMinimap.post(MathUtils.radToDeg(this.state.cameraAngleRad));
                    },
                    onComplete: () => {
                        this.state.cameraTween = null;

                        // rotate camera bounds
                        const length = this.state.cameraBoundsAccessors.length;
                        this.state.cameraBoundsAccessors = this.state.cameraBoundsAccessors.map((_, index) => {
                            if (cameraDirection < 0) {
                                return this.state.cameraBoundsAccessors[(index + 1) % length];
                            } else {
                                if (index === 0) {
                                    return this.state.cameraBoundsAccessors[length - 1];
                                } else {
                                    return this.state.cameraBoundsAccessors[index - 1];
                                }
                            }
                        });
                    }
                });
        }

        this.state.pressedKeys.delete(key);
    }
}

