import { IBuildingInstance } from "../../buildings/BuildingTypes";
import { GameMapState } from "../../components/GameMapState";
import { buildingConfig } from "../../config/BuildingConfig";
import { unitConfig } from "../../config/UnitConfig";
import { State } from "../../fsm/StateMachine";
import { ICharacterUnit } from "../ICharacterUnit";
import { IUnit } from "../IUnit";
import { spiralFind } from "../UnitSearch";
import { UnitUtils } from "../UnitUtils";
import { AttackBuilding } from "./AttackBuilding";
import { AttackUnit } from "./AttackUnit";

export class IdleEnemy extends State<ICharacterUnit> {

    override update(unit: IUnit) {
        const { buildings } = GameMapState.instance;
        const { sectorCoords, mapCoords } = unit.coords;
        const { vision } = unitConfig[unit.type].range;        
        
        const targetUnit = spiralFind(unit, vision, target => !UnitUtils.isEnemy(target));
        if (targetUnit) {
            const attack = unit.fsm.switchState(AttackUnit);
            attack.setTarget(targetUnit); 
            return;                      
        }        

        const minX = mapCoords.x - vision;
        const minY = mapCoords.y - vision;
        const maxX = mapCoords.x + vision;
        const maxY = mapCoords.y + vision;
        let closestBuilding: IBuildingInstance | null = null;
        let distToClosest = Infinity;
        for (const [dx, dy] of [[0, 0], [-1, -1], [0, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [0, 1], [1, 1]]) {
            const sectorX = sectorCoords.x + dx;
            const sectorY = sectorCoords.y + dy;
            const sectorId = `${sectorX},${sectorY}`;
            const list = buildings.get(sectorId);
            if (!list) {
                continue;
            }
            for (const building of list) {
                const { size } = buildingConfig[building.buildingType];
                const startX = building.mapCoords.x;
                const startY = building.mapCoords.y;
                const endX = startX + size.x - 1;
                const endY = startY + size.z - 1;
                if (endX < minX || startX > maxX || endY < minY || startY > maxY) {
                    continue;
                }
                
                const centerX = startX + size.x / 2;
                const centerY = startY + size.z / 2;
                const dist = Math.abs(mapCoords.x - centerX) + Math.abs(mapCoords.y - centerY);
                if (dist < distToClosest) {
                    distToClosest = dist;
                    closestBuilding = building;
                }
            }
        }

        if (closestBuilding) {
            const attack = unit.fsm.switchState(AttackBuilding);
            attack.setTarget(closestBuilding);
            return;          
        }
    }
}

