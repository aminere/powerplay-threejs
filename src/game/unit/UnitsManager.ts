import { Box3Helper, Object3D, Vector2, Vector3 } from "three";
import { input } from "../../engine/Input";
import { IUnit } from "./IUnit";
import { GameUtils } from "../GameUtils";
import { cmdFogAddCircle, cmdSetSelectedElems, cmdStartSelection } from "../../Events";
import { skeletonPool } from "../animation/SkeletonPool";
import { utils } from "../../engine/Utils";
import { MiningState } from "./MiningState";
import { skeletonManager } from "../animation/SkeletonManager";
import { GameMapState } from "../components/GameMapState";
import { IUnitProps, Unit } from "./Unit";
import { IBuildingInstance, buildingSizes } from "../buildings/BuildingTypes";
import { updateUnits } from "./UnitsUpdate";
import { config } from "../config";
import { UnitType } from "../GameDefinitions";
import { NPCState } from "./NPCState";
import { GameMapProps } from "../components/GameMapProps";

const screenPos = new Vector3();
const spawnCoords = new Vector2();
const { unitScale } = config.game;

class UnitsManager {

    public get units() { return this._units; }
    public get selectedUnits() { return this._selectedUnits; }

    public set selectedUnits(value: IUnit[]) { this._selectedUnits = value; }
    public set owner(value: Object3D) { this._owner = value; }

    private _owner!: Object3D;
    private _units: Unit[] = [];
    private _selectedUnits: IUnit[] = [];
    private _selectionStart: Vector2 = new Vector2();
    private _dragStarted: boolean = false;
    private _spawnUnitRequest: IBuildingInstance | null = null;

    async preload() {
        await skeletonManager.load({
            skins: {
                "worker": "/models/characters/Worker.json",
                "enemy-melee": "/models/characters/NPC.json",
                "enemy-ranged": "/models/characters/Astronaut.json",
            },
            // globally shared animations
            animations: [
                { name: "idle" },
                { name: "walk" },
                { name: "run" },
                { name: "carry-idle" },
                { name: "carry-run" },
                { name: "shoot" },
            ],
        });

        await skeletonPool.load("/models/characters/Worker.json");
    }

    public dispose() {
        skeletonManager.dispose();
        skeletonPool.dispose();
        this._units.length = 0;
        this._selectedUnits.length = 0;
        this._dragStarted = false;
        this._spawnUnitRequest = null;
    }

    public update() {
        const gameMapState = GameMapState.instance;
        if (input.touchJustPressed) {
            if (!gameMapState.cursorOverUI) {
                if (input.touchButton === 0) {
                    this._dragStarted = true;
                    this._selectionStart.copy(input.touchPos);
                }
            }

        } else if (input.touchPressed) {

            if (input.touchButton === 0) {
                if (input.touchJustMoved) {
                    if (this._dragStarted) {
                        if (!input.touchInside) {
                            this._dragStarted = false;
                        } else {
                            if (gameMapState.selectionInProgress) {
                                this._selectedUnits.length = 0;
                                const units = this._units;
                                for (let i = 0; i < units.length; ++i) {
                                    const unit = units[i];
                                    const { obj, type } = unit;
                                    if (type !== "worker") {
                                        continue;
                                    }
                                    if (!unit.isAlive) {
                                        continue;
                                    }
                                    GameUtils.worldToScreen(obj.position, gameMapState.camera, screenPos);
                                    const rectX = Math.min(this._selectionStart.x, input.touchPos.x);
                                    const rectY = Math.min(this._selectionStart.y, input.touchPos.y);
                                    const rectWidth = Math.abs(input.touchPos.x - this._selectionStart.x);
                                    const rectHeight = Math.abs(input.touchPos.y - this._selectionStart.y);
                                    if (screenPos.x >= rectX && screenPos.x <= rectX + rectWidth && screenPos.y >= rectY && screenPos.y <= rectY + rectHeight) {
                                        this._selectedUnits.push(unit);
                                    }
                                }

                                cmdSetSelectedElems.post({ units: this._selectedUnits });

                            } else {

                                if (!gameMapState.action) {
                                    const dx = input.touchPos.x - this._selectionStart.x;
                                    const dy = input.touchPos.y - this._selectionStart.y;
                                    const dist = Math.sqrt(dx * dx + dy * dy);
                                    const threshold = 5;
                                    if (dist > threshold) {
                                        gameMapState.selectionInProgress = true;
                                        cmdStartSelection.post(this._selectionStart);
                                    }
                                }

                            }
                        }
                    }
                }
            }

        } else if (input.touchJustReleased) {
            if (this._dragStarted) {
                this._dragStarted = false;
            }
        }       

        skeletonPool.update();
        this.handleSpawnRequests();
        updateUnits(this._units);
    }

    private createUnit(props: IUnitProps) {
        const { mesh } = props;
        mesh.userData.unserializable = true;
        mesh.bindMode = "detached";
        const id = this._units.length;
        const unit = new Unit(props, id);
        this._units.push(unit);
        this._owner.add(mesh);

        if (props.type === "worker") {
            cmdFogAddCircle.post({ mapCoords: unit.coords.mapCoords, radius: 10 });
        }
        
        const box3Helper = new Box3Helper(mesh.boundingBox);
        mesh.add(box3Helper);
        box3Helper.visible = false;
        return unit;
    }

    public spawn(mapCoords: Vector2, type: UnitType) {
        const sharedMesh = skeletonManager.getSharedSkinnedMesh(type)!;
        const boundingBox = skeletonManager.boundingBox;
        const mesh = sharedMesh.clone();
        mesh.scale.multiplyScalar(unitScale);
        mesh.boundingBox = boundingBox;
        GameUtils.mapToWorld(mapCoords, mesh.position);
        const unit = this.createUnit({
            mesh,
            type,
            states: (() => {
                switch (type) {
                    case "worker": return [new MiningState()];
                    default: return [new NPCState()]; // ArcherNPCState
                }
            })(),
            animation: skeletonManager.applyIdleAnim(mesh)
        });

        switch (type) {
            case "enemy-melee": unit.fsm.switchState(NPCState); break;
        }        
    }

    public kill(unit: IUnit) {
        unit.health = 0;
        const index = this._units.indexOf(unit as Unit);
        console.assert(index >= 0, `unit ${unit.id} not found`);
        utils.fastDelete(this._units, index);

        const cell = unit.coords.sector!.cells[unit.coords.cellIndex];
        const unitIndex = cell.units!.indexOf(unit);
        console.assert(unitIndex >= 0, `unit ${unit.id} not found in cell`);
        utils.fastDelete(cell.units!, unitIndex);
    }

    public killSelection() {
        if (this._selectedUnits.length === 0) {
            return;
        }
        for (const unit of this._selectedUnits) {
            this.kill(unit);
        }
        this._selectedUnits.length = 0;
        cmdSetSelectedElems.post({ units: this._selectedUnits });
    }

    public spawnUnitRequest() {
        const { selectedBuilding } = GameMapState.instance;
        console.assert(selectedBuilding);
        this._spawnUnitRequest = selectedBuilding!;
    }

    private handleSpawnRequests() {
        const spawnUnitRequest = this._spawnUnitRequest;
        if (!spawnUnitRequest) {
            return;
        }
        spawnCoords.copy(spawnUnitRequest.mapCoords);
        const buildingType = spawnUnitRequest.buildingType;
        const size = buildingSizes[buildingType];
        spawnCoords.x += size.x / 2;
        spawnCoords.y += size.z;

        const props = GameMapProps.instance;
        this.spawn(spawnCoords, props.unit);
        this._spawnUnitRequest = null;
    }
}

export const unitsManager = new UnitsManager();

