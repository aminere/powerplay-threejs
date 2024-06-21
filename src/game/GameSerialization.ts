import { Vector2, Vector3 } from "three";
import { Axis, IConveyorConfig, IRail, IRailConfig } from "./GameTypes";
import { BuildingType, IAssemblyState, IBuildingInstance, IFactoryState } from "./buildings/BuildingTypes";
import { RawResourceType, ResourceType, UnitType, PlayerVehicleType, GameMode } from "./GameDefinitions";
import { BufferAttribute, BufferGeometry, Mesh } from "three";
import { GameMapState } from "./components/GameMapState";
import { GameMapProps } from "./components/GameMapProps";

interface ISerializedCell {
    index: number;
    roadTile?: number;
    resource?: RawResourceType;
    units?: UnitType[];
    conveyor?: IConveyorConfig;
}

interface ISerializedElevation {
    vertexIndex: number;
    height: number;
}

interface ISerializedSector {
    key: string;
    cells: ISerializedCell[];
    elevation: ISerializedElevation[];
}

interface ISerializedBuilding {
    mapCoords: Vector2;
}

export interface ISerializedFactory extends ISerializedBuilding {
    output: ResourceType | null;
}

export interface ISerializedAssembly extends ISerializedBuilding {
    output: PlayerVehicleType | null;
}

export type TSerializedBuilding = ISerializedBuilding | ISerializedFactory | ISerializedAssembly;

interface ISerializedRail {
    config: IRailConfig;
    startCoords: Vector2,
    startAxis: Axis,
    endCoords?: Vector2,
    endAxis?: Axis
}

export interface ISerializedGameMap {
    size: number;
    sectors: ISerializedSector[];
    buildings: Record<BuildingType, TSerializedBuilding[]>;
    rails: ISerializedRail[];
    cameraPos: Vector3;
    gameMode: GameMode;
}

function serializeFactory(instance: IBuildingInstance) {
    const state = instance.state as IFactoryState;
    const serialized: ISerializedFactory = {
        mapCoords: instance.mapCoords.clone(),
        output: state.output
    };
    return serialized;
}

function serializeAssembly(instance: IBuildingInstance) {
    const state = instance.state as IAssemblyState;
    const serialized: ISerializedAssembly = {
        mapCoords: instance.mapCoords.clone(),
        output: state.output
    };
    return serialized;
}

function serializeBuilding(instance: IBuildingInstance) {
    const serialized: TSerializedBuilding = {
        mapCoords: instance.mapCoords.clone()
    };
    return serialized;
}

export function serializeGameMap() {    
    const state = GameMapState.instance;
    const liveSectors = Array.from(state.sectors.entries());

    const rails: IRail[] = [];
    const sectors = liveSectors.map(([key, sector]) => {
        const cells = sector.cells.map((cell, cellIndex) => {            

            const unitCount = cell.units ? (cell.units.length > 0 ? cell.units.length : undefined) : undefined;
            if (cell.isEmpty && unitCount === undefined) {
                return null!;
            }

            // buildings are recorded in a separate structure
            // but if the cell has a resource and is under a building, record it
            if (cell.building !== undefined && !cell.resource) {
                return null;
            }

            // rails are recorded in a separate structure
            if (cell.rail) {
                // only serialize the start of the rail segment
                if (cell.rail.config) {
                    rails.push(cell.rail);
                }                
                return null;
            }

            const serializedCell: ISerializedCell = {
                index: cellIndex,
                roadTile: cell.roadTile,
                resource: cell.resource?.type,
                conveyor: cell.conveyor?.config,
                units: cell.units?.map(unit => unit.type)
            };
            
            return serializedCell;
        }).filter(Boolean);

        const geometry = (sector.layers.terrain as Mesh).geometry as BufferGeometry;
        const position = geometry.getAttribute("position") as BufferAttribute;
        const elevation: ISerializedElevation[] = [];
        for (let i = 0; i < position.count; i++) {
            const y = position.getY(i);
            if (y !== 0) {                
                elevation.push({ vertexIndex: i, height: y });
            }
        }

        return {
            key,
            cells,
            elevation
        } as ISerializedSector;
    });

    const buildings: Record<string, TSerializedBuilding[]> = {};
    for (const [, instances] of state.buildings) {
        for (const instance of instances) {
            const buildingType = instance.buildingType;
            const list = buildings[buildingType];
    
            const serialized = (() => {
                switch (buildingType) {
                    case "factory": return serializeFactory(instance);
                    case "assembly": return serializeAssembly(instance);
                    default: return serializeBuilding(instance);
                }
            })();
    
            if (list) {
                list.push(serialized);
            } else {
                buildings[buildingType] = [serialized];
            }
        }        
    }

    const result: ISerializedGameMap = {
        size: state.sectorRes,
        sectors,
        buildings,
        rails: rails.map(rail => {
            const serializedRail: ISerializedRail = {                
                config: rail.config!,
                startCoords: rail.mapCoords,
                startAxis: rail.axis,
                endCoords: rail.endCell?.rail?.mapCoords ?? undefined,
                endAxis: rail.endCell?.rail?.axis ?? undefined
            };
            return serializedRail;
        }),
        cameraPos: state.cameraRoot.position.clone(),
        gameMode: GameMapProps.instance.gameMode
    };

    return result;
}

