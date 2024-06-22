
import { IBuildingInstance } from "../../buildings/BuildingTypes";
import { State } from "../../fsm/StateMachine";
import { IUnit } from "../IUnit";
import { buildingConfig } from "../../config/BuildingConfig";
import { unitMotion } from "../UnitMotion";
import { unitAnimation } from "../UnitAnimation";
import { ICharacterUnit } from "../ICharacterUnit";
import { Vector2 } from "three";
import { config } from "../../config/config";
import { GameMapState } from "../../components/GameMapState";
import { unitConfig } from "../../config/UnitConfig";
import { buildings } from "../../buildings/Buildings";

enum AttackBuildingStep {
    Idle,
    GoToBuilding,
    Attack
}

const mapCoords = new Vector2();
const { attackTimes } = config.combat.melee;

export class AttackBuildingState extends State<IUnit> {

    private _target: IBuildingInstance | null = null;
    private _step = AttackBuildingStep.Idle;
    private _loopConsumed = false;
    private _attackIndex = 0;

    override enter(_unit: IUnit) {
        console.log("AttackBuildingState enter");
    }
    
    override exit(_unit: IUnit) {
        console.log("AttackBuildingState exit");
    }

    override update(unit: ICharacterUnit) {
        
        const target = this._target;
        if (!target) {
            const { buildings } = GameMapState.instance;
            const { sectorCoords, mapCoords } = unit.coords;
            const vision = 4;
            const minX = mapCoords.x - vision;
            const minY = mapCoords.y - vision;
            const maxX = mapCoords.x + vision;
            const maxY = mapCoords.y + vision;
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
                    this._target = building;
                    break;
                }
            }
            return;
        }

        if (target.deleted) {
            this._target = null;
            this._step = AttackBuildingStep.Idle;
            return;
        }

        switch (this._step) {
            case AttackBuildingStep.Idle: {
                // move to center of building
                const { size } = buildingConfig[target.buildingType];
                mapCoords.set(
                    Math.floor(target.mapCoords.x + size.x / 2),
                    Math.floor(target.mapCoords.y + size.z / 2)
                );
                unitMotion.moveUnit(unit, mapCoords, false);
                unitAnimation.setAnimation(unit, "run", { transitionDuration: .2, scheduleCommonAnim: true });
                this._step = AttackBuildingStep.GoToBuilding;
            }
                break;

            case AttackBuildingStep.Attack: {
                if (this._loopConsumed) {
                    if (unit.animation.action.time < attackTimes[0]) {
                        this._loopConsumed = false;
                    }
                    break;
                } else {
                    if (unit.animation.action.time < attackTimes[this._attackIndex]) {
                        break;
                    } else {
                        this._attackIndex = (this._attackIndex + 1) % attackTimes.length;
                        if (this._attackIndex === 0) {
                            this._loopConsumed = true;
                        }
                    }
                }

                // attack
                const damage = unitConfig[unit.type].damage;
                target.hitpoints -= damage;
                if (target.hitpoints <= 0) {
                    target.hitpoints = 0;
                    buildings.clear(target);

                    this._target = null;
                    this._step = AttackBuildingStep.Idle;
                    unit.isIdle = true;
                    unitAnimation.setAnimation(unit, "idle", { transitionDuration: .3, scheduleCommonAnim: true });
                }
            }
            break;
        }
    }

    public startAttack(unit: ICharacterUnit) {
        if (this._step === AttackBuildingStep.Attack) {
            return;
        }
        this._step = AttackBuildingStep.Attack;
        unit.isIdle = false;
        this._loopConsumed = false;
        this._attackIndex = 0;
        unitAnimation.setAnimation(unit, "attack", { transitionDuration: .1 });
    }
}

