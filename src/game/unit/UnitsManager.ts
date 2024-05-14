import { Box3Helper, Mesh, Object3D, Vector2, Vector3 } from "three";
import { input } from "../../engine/Input";
import { GameUtils } from "../GameUtils";
import { SelectedElems, cmdFogAddCircle, cmdSetSelectedElems, cmdSpawnUnit, cmdStartSelection, evtUnitKilled } from "../../Events";
import { skeletonPool } from "../animation/SkeletonPool";
import { utils } from "../../engine/Utils";
import { skeletonManager } from "../animation/SkeletonManager";
import { GameMapState } from "../components/GameMapState";
import { IBuildingInstance } from "../buildings/BuildingTypes";
import { config } from "../config/config";
import { UnitType } from "../GameDefinitions";
import { meshes } from "../../engine/resources/Meshes";
import { CharacterUnit } from "./CharacterUnit";
import { Unit } from "./Unit";
import { NPCState } from "./states/NPCState";
import { TruckUnit } from "./TruckUnit";
import { unitMotion } from "./UnitMotion";
import { SoldierState } from "./states/SoldierState";
import { UnitUtils } from "./UnitUtils";
import { TankState } from "./states/TankState";
import { Workers } from "./Workers";
import { TruckState } from "./states/TruckState";
import { buildingConfig } from "../config/BuildingConfig";
import { MiningState } from "./states/MiningState";
import { buildings } from "../buildings/Buildings";
import { conveyors } from "../Conveyors";
import { IUnit } from "./IUnit";
import { ICharacterUnit } from "./ICharacterUnit";
import { MeleeDefendState } from "./states/MeleeDefendState";
import { MeleeAttackState } from "./states/MeleeAttackState";

const screenPos = new Vector3();
const cellCoords = new Vector2();
const minCell = new Vector2();
const maxCell = new Vector2();
const { unitScale, truckScale, tankScale, cellSize } = config.game;

function getBoundingBox(mesh: Mesh) {
    if (mesh.geometry.boundingBox) {
        return mesh.geometry.boundingBox;
    } else {
        mesh.geometry.computeBoundingBox();
        return mesh.geometry.boundingBox!;
    }
}

async function loadVisual(type: UnitType) {
    const visual = (await meshes.load(`/models/${type}.glb`))[0].clone();
    visual.traverse(child => {
        child.castShadow = true;
        child.userData.unserializable = true;
    });
    return visual;
}

function showSelectionLines(_minCell: Vector2, _maxCell: Vector2) {
    const startX = _minCell.x;
    const startY = _minCell.y;
    const endX = Math.max(_maxCell.x - 1, startX);
    const endY = Math.max(_maxCell.y - 1, startY);
    const c1 = GameUtils.mapToWorld(cellCoords.set(startX, startY), new Vector3());
    c1.x -= cellSize / 2; c1.z -= cellSize / 2;
    const c2 = GameUtils.mapToWorld(cellCoords.set(endX, startY), new Vector3());
    c2.x += cellSize / 2; c2.z -= cellSize / 2;
    const c3 = GameUtils.mapToWorld(cellCoords.set(endX, endY), new Vector3());
    c3.x += cellSize / 2; c3.z += cellSize / 2;
    const c4 = GameUtils.mapToWorld(cellCoords.set(startX, endY), new Vector3());
    c4.x -= cellSize / 2; c4.z += cellSize / 2;
    const { selectedElem } = GameMapState.instance.debug;
    selectedElem.setPoints([c1, c2, c3, c4, c1.clone()]);
    selectedElem.visible = true;
}

class UnitsManager {

    public get units() { return this._units; }
    public get selectedUnits() { return this._selectedUnits; }

    public set owner(value: Object3D) { this._owner = value; }

    private _owner!: Object3D;
    private _units: IUnit[] = [];
    private _selectedUnits: IUnit[]  = [];
    private _selectionStart: Vector2 = new Vector2();
    private _dragStarted: boolean = false;
    private _spawnUnitRequest: [IBuildingInstance, UnitType] | null = null;
    private _selection: SelectedElems | null = null;

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

        this.onUnitKilled = this.onUnitKilled.bind(this);
        evtUnitKilled.attach(this.onUnitKilled);
        this.onSpawnUnit = this.onSpawnUnit.bind(this);
        cmdSpawnUnit.attach(this.onSpawnUnit);
    }

    public dispose() {
        evtUnitKilled.detach(this.onUnitKilled);
        cmdSpawnUnit.detach(this.onSpawnUnit);
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

        unitMotion.resetCollisionResults();
        for (const unit of this._units) {
            if (unit.isAlive) {
                unit.fsm.update();
                unitMotion.applyForces(unit);
                switch (unit.type) {
                    case "worker": Workers.update(unit as ICharacterUnit); break;
                }
            }
        }  
        
        for (const unit of this._units) {
            if (unit.isAlive) {
                unitMotion.steer(unit);
            }
        }
    }

    public async spawn(mapCoords: Vector2, type: UnitType) {

        const id = this._units.length;
        switch (type) {
            case "truck": {
                const visual = await loadVisual(type);
                GameUtils.mapToWorld(mapCoords, visual.position);
                const boundingBox = getBoundingBox(visual);
                const unit = new TruckUnit({ visual, boundingBox, type, states: [new TruckState()]}, id);                
                visual.scale.multiplyScalar(truckScale);
                this._units.push(unit);
                this._owner.add(visual);
                unit.fsm.switchState(TruckState);

                cmdFogAddCircle.post({ mapCoords, radius: 10 });    
                const box3Helper = new Box3Helper(boundingBox);
                visual.add(box3Helper);
                box3Helper.visible = false;

            }
            break;

            case "tank": {
                const visual = await loadVisual(type);
                visual.receiveShadow = true;
                GameUtils.mapToWorld(mapCoords, visual.position);
                const boundingBox = getBoundingBox(visual);                
                const unit = new Unit({ visual, boundingBox, type, states: [new TankState()]}, id);
                visual.scale.multiplyScalar(tankScale);
                this._units.push(unit);
                this._owner.add(visual);
                unit.fsm.switchState(TankState);

                cmdFogAddCircle.post({ mapCoords, radius: 10 });
                const box3Helper = new Box3Helper(boundingBox);
                visual.add(box3Helper);
                box3Helper.visible = false;
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
                            case "worker": return [
                                new MiningState(), 
                                new SoldierState(),
                                new MeleeDefendState(), 
                                new MeleeAttackState()
                            ];
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

    public killSelection() {
        if (!this._selection) {
            return;
        }

        switch (this._selection.type) {
            case "building": {
                const building = this._selection.building;
                buildings.clear(building.id);
            }
            break;

            case "units": {
                const units = this._selection.units;
                if (units.length > 0) {
                    for (const unit of units) {
                        unit.setHitpoints(0);
                    }
                    console.assert(units === this._selectedUnits);
                    this._selectedUnits.length = 0;
                }
            }
            break;

            case "cell": {
                const { cell, mapCoords } = this._selection;
                console.assert(cell.conveyor);
                conveyors.clear(mapCoords);
                conveyors.clearLooseCorners(mapCoords);
            }
            break;
        }
        
        this.setSelection(null);        
    }

    public setSelection(selection: SelectedElems | null) {

        const { selectedElem } = GameMapState.instance.debug;
        selectedElem.visible = false;
        if (selection) {
            switch (selection.type) {
                case "units": {
                    this._selectedUnits = selection.units;
                }
                break;

                case "building": {
                    this._selectedUnits.length = 0;
                    const buildingType = selection.building.buildingType;
                    const { size } = buildingConfig[buildingType];
                    switch (buildingType) {
                        case "depot": {
                            const { range } = config.depots;                            
                            minCell.set(selection.building.mapCoords.x - range, selection.building.mapCoords.y - range);
                            maxCell.set(minCell.x + range * 2 + size.x, minCell.y + range * 2 + size.z);
                            showSelectionLines(minCell, maxCell);
                        }
                        break;
                        default: {
                            minCell.copy(selection.building.mapCoords);
                            maxCell.set(minCell.x + size.x, minCell.y + size.z);
                            showSelectionLines(minCell, maxCell);
                        }
                        break;
                    }
                }
                break;

                case "cell": {
                    this._selectedUnits.length = 0;
                    const { mapCoords } = selection;                    
                    showSelectionLines(mapCoords, mapCoords);
                }
                break;
            }
        } else {
            this._selectedUnits.length = 0;
        }

        cmdSetSelectedElems.post(selection);
        this._selection = selection;
    }

    private handleSpawnRequests() {
        const spawnUnitRequest = this._spawnUnitRequest;
        if (!spawnUnitRequest) {
            return;
        }

        const [building, unitType] = spawnUnitRequest;
        const { buildingType, mapCoords } = building;
        cellCoords.copy(mapCoords);
        const size = buildingConfig[buildingType].size;
        cellCoords.set(Math.round(cellCoords.x + size.x / 2), cellCoords.y + size.z);
        this.spawn(cellCoords, unitType);
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
                                    if (!unit.isAlive) {
                                        continue;
                                    }
                                    GameUtils.worldToScreen(unit.visual.position, gameMapState.camera, screenPos);
                                    const rectX = Math.min(this._selectionStart.x, input.touchPos.x);
                                    const rectY = Math.min(this._selectionStart.y, input.touchPos.y);
                                    const rectWidth = Math.abs(input.touchPos.x - this._selectionStart.x);
                                    const rectHeight = Math.abs(input.touchPos.y - this._selectionStart.y);
                                    if (screenPos.x >= rectX && screenPos.x <= rectX + rectWidth && screenPos.y >= rectY && screenPos.y <= rectY + rectHeight) {
                                        this._selectedUnits.push(unit);
                                    }
                                }

                                if (this._selectedUnits.length > 0) {
                                    this.setSelection({ type: "units", units: this._selectedUnits });
                                } else {
                                    this.setSelection(null);
                                }

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

    private onUnitKilled(unit: IUnit) {
        const index = this._units.indexOf(unit as Unit);
        console.assert(index >= 0, `unit ${unit.id} not found`);
        utils.fastDelete(this._units, index);
    }

    private onSpawnUnit(request: [IBuildingInstance, UnitType]) {
        this._spawnUnitRequest = request;
    }
}

export const unitsManager = new UnitsManager();

