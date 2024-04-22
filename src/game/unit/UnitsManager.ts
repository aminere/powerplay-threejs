import { Box3Helper, Mesh, Object3D, Vector2, Vector3 } from "three";
import { input } from "../../engine/Input";
import { GameUtils } from "../GameUtils";
import { cmdFogAddCircle, cmdSetSelectedElems, cmdStartSelection } from "../../Events";
import { skeletonPool } from "../animation/SkeletonPool";
import { utils } from "../../engine/Utils";
import { skeletonManager } from "../animation/SkeletonManager";
import { GameMapState } from "../components/GameMapState";
import { IBuildingInstance, buildingSizes } from "../buildings/BuildingTypes";
import { config } from "../config";
import { UnitType } from "../GameDefinitions";
import { GameMapProps } from "../components/GameMapProps";
import { meshes } from "../../engine/resources/Meshes";
import { CharacterUnit, ICharacterUnit } from "./CharacterUnit";
import { IUnit, Unit } from "./Unit";
import { MiningState } from "./states/MiningState";
import { NPCState } from "./states/NPCState";
import { ITruckUnit, TruckUnit } from "./TruckUnit";
import { FlockProps } from "../components/Flock";
import { time } from "../../engine/core/Time";
import { UnitMotion } from "./UnitMotion";
import { truckUpdate } from "./update/TruckUpdate";
import { workerUpdate } from "./update/WorkerUpdate";
import { SoldierState } from "./states/SoldierState";
import { UnitUtils } from "./UnitUtils";

const screenPos = new Vector3();
const spawnCoords = new Vector2();
const { unitScale, truckScale, tankScale } = config.game;

function getBoundingBox(mesh: Mesh) {
    if (mesh.geometry.boundingBox) {
        return mesh.geometry.boundingBox;
    } else {
        mesh.geometry.computeBoundingBox();
        return mesh.geometry.boundingBox!;
    }
}

class UnitsManager {

    public get units() { return this._units; }
    public get selectedUnits() { return this._selectedUnits; }

    public set selectedUnits(value: IUnit[]) { this._selectedUnits = value; }
    public set owner(value: Object3D) { this._owner = value; }

    private _owner!: Object3D;
    private _units: IUnit[] = [];
    private _selectedUnits: IUnit[] = [];
    private _selectionStart: Vector2 = new Vector2();
    private _dragStarted: boolean = false;
    private _spawnUnitRequest: IBuildingInstance | null = null;

    async preload() {
        await skeletonManager.load({
            skins: {
                "worker": "/models/characters/Worker.json",
                "enemy-melee": "/models/characters/NPC.json",
                "enemy-ranged": "/models/characters/Astronaut.json"
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
        this.handleInput();
        skeletonPool.update();
        this.handleSpawnRequests();

        const props = FlockProps.instance;
        const steerAmount = props.speed * time.deltaTime;
        const avoidanceSteerAmount = props.avoidanceSpeed * time.deltaTime;
        for (const unit of this._units) {
            if (!unit.isAlive) {
                continue;
            }

            unit.fsm.update();
            UnitMotion.update(unit, steerAmount, avoidanceSteerAmount);

            switch (unit.type) {
                case "truck": truckUpdate(unit as ITruckUnit); break;
                case "worker": workerUpdate(unit as ICharacterUnit); break;
            }
        }        
    }

    public async spawn(mapCoords: Vector2, type: UnitType) {

        const id = this._units.length;
        switch (type) {
            case "truck": {
                const visual = (await meshes.load(`/models/${type}.glb`))[0].clone();
                visual.castShadow = true;

                visual.userData.unserializable = true;
                GameUtils.mapToWorld(mapCoords, visual.position);                
                cmdFogAddCircle.post({ mapCoords, radius: 10 });
                
                const boundingBox = getBoundingBox(visual);
                const box3Helper = new Box3Helper(boundingBox);
                visual.add(box3Helper);
                box3Helper.visible = false;

                const unit = new TruckUnit({ visual, boundingBox, type, states: []}, id);
                visual.scale.multiplyScalar(truckScale);
                this._units.push(unit);
                this._owner.add(visual);
            }
            break;

            case "tank": {
                const visual = utils.createObject(this._owner, "root");
                const submeshes = (await meshes.load(`/models/${type}.glb`)).map(submesh => submesh.clone());
                for (const submesh of submeshes) {
                    submesh.castShadow = true;
                    submesh.userData.unserializable = true;
                    visual.add(submesh);
                }                

                visual.userData.unserializable = true;
                GameUtils.mapToWorld(mapCoords, visual.position);      
                cmdFogAddCircle.post({ mapCoords, radius: 10 });
                
                const boundingBox = getBoundingBox(submeshes[0]);
                const box3Helper = new Box3Helper(boundingBox);
                visual.add(box3Helper);
                box3Helper.visible = false;

                const unit = new Unit({ visual, boundingBox, type, states: []}, id);
                visual.scale.multiplyScalar(tankScale);
                this._units.push(unit);
                this._owner.add(visual);
            }
            break;

            default: {
                // character mesh
                const sharedMesh = skeletonManager.getSharedSkinnedMesh(type)!;
                const boundingBox = skeletonManager.boundingBox;
                const skinnedMesh = sharedMesh.clone();
                skinnedMesh.scale.multiplyScalar(unitScale);
                skinnedMesh.boundingBox = boundingBox;
                skinnedMesh.bindMode = "detached";

                skinnedMesh.userData.unserializable = true;
                GameUtils.mapToWorld(mapCoords, skinnedMesh.position);

                const unit = new CharacterUnit({ 
                    visual: skinnedMesh,
                    type, 
                    states: (() => {
                        switch (type) {
                            case "worker": return [new MiningState(), new SoldierState()];
                            case "enemy-melee": return [new NPCState()]
                            default: return [];
                        }
                    })(),
                    animation: skeletonManager.applyIdleAnim(skinnedMesh)
                }, id);
                this._units.push(unit);
                this._owner.add(skinnedMesh);
                
                if (UnitUtils.isEnemy(unit)) {
                    switch (type) {
                        case "enemy-melee":
                            unit.fsm.switchState(NPCState);
                            break;
                    }
                } else {
                    cmdFogAddCircle.post({ mapCoords, radius: 10 });
                }

                const box3Helper = new Box3Helper(skinnedMesh.boundingBox!);
                skinnedMesh.add(box3Helper);
                box3Helper.visible = false;
            }    
        }
    }

    public kill(unit: IUnit) {
        unit.setHealth(0);
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

    private handleInput() {
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
                                    const { mesh } = unit;                                    
                                    if (!unit.isAlive) {
                                        continue;
                                    }
                                    GameUtils.worldToScreen(mesh.position, gameMapState.camera, screenPos);
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
    }
}

export const unitsManager = new UnitsManager();

