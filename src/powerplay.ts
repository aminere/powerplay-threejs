
export { Component } from "./engine/ecs/Component";
export { ComponentProps }  from "./engine/ecs/ComponentProps";
export { serialization } from "./engine/serialization/Serialization";
export { TArray } from "./engine/serialization/TArray";

export { componentFactory } from "./engine/ecs/ComponentFactory";
export { engine, type ISceneInfo } from "./engine/Engine";
export { engineState } from "./engine/EngineState";
export { input } from "./engine/Input";
export { utils } from "./engine/Utils";
export { time } from "./engine/core/Time";

export { GameUI } from "./game/ui/GameUI";
export { EngineStats } from "./debug/EngineStats";
export { config } from "./game/config";

export { meshes } from "./engine/resources/Meshes";
export { textures } from "./engine/resources/Textures";
export { GameMap } from "./game/components/GameMap";
export { GameMapState } from "./game/components/GameMapState";
export { createSectors } from "./game/GameMapUtils";

export type { ISerializedGameMap, ISerializedSector, ISerializedCell, ISerializedElevation, ISerializedFactory, TSerializedBuilding } from "./game/GameSerialization";
export type { IFactoryState, IBuildingInstance } from "./game/buildings/BuildingTypes";

export { Animator } from "./engine/components/Animator";
export { Particles } from "./engine/components/Particles";

