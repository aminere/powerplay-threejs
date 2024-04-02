import { useEffect, useRef } from "react"
import { cmdRenderUI, evtScreenResized, cmdSetSelectedElems } from "../../Events";
import { Color, Vector2, Vector3 } from "three";
import { GameUtils } from "../GameUtils";
import { engine } from "../../engine/Engine";
import { IUnit } from "../unit/IUnit";
import { config } from "../config";
import { GameMapState } from "../components/GameMapState";
import { IBuildingInstance, buildingSizes } from "../buildings/BuildingTypes";

const full = new Color(0x19c80f);
const empty = new Color(0xc01c06);
const color = new Color();
const parts = 5;
const step = 1 / parts;
const partWidth = 8;
const partHeight = 8;
const totalWidth = partWidth * parts;
const worldPos = new Vector3();
const screenPos = new Vector3();
const headOffset = 2;
const { cellSize, conveyorHeight } = config.game;

function drawBar(ctx: CanvasRenderingContext2D, position: Vector3, health: number) {
    const { camera } = GameMapState.instance;
    GameUtils.worldToScreen(position, camera, screenPos);
    const barX = Math.round(screenPos.x - totalWidth / 2);
    const barY = Math.round(screenPos.y);
    ctx.fillStyle = "rgba(0, 0, 0, 0.3)";
    ctx.fillRect(barX, barY, totalWidth, partHeight);

    const progress = health;
    color.copy(empty).lerpHSL(full, progress);
    for (let j = 0; j < parts; ++j) {
        const section = Math.floor(progress * parts);
        const opacity = (() => {
            if (j < section) {
                return 1;
            } else if (j > section) {
                return 0;
            } else {
                const localProgress = progress - (section * step);
                const normalizedProgress = localProgress / step;
                return normalizedProgress;
            }
        })();
        const partColor = `rgba(${color.r * 255}, ${color.g * 255}, ${color.b * 255}, ${opacity})`;
        ctx.fillStyle = partColor;
        ctx.fillRect(barX + j * partWidth, barY, partWidth, partHeight);
        ctx.strokeRect(barX + j * partWidth, barY, partWidth, partHeight);
    }
}

export function HealthBars() {

    const selectedUnitsRef = useRef<IUnit[]>([]);
    const selectedBuildingRef = useRef<IBuildingInstance | null>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const selectedConveyorRef = useRef<Vector2 | null>(null);

    useEffect(() => {

        const onSelectedElems = ({ units, building, conveyor }: {
            units?: IUnit[];
            building?: IBuildingInstance;
            conveyor?: Vector2;
        }) => {
            if (units) {
                selectedUnitsRef.current = units;
            } else {
                selectedUnitsRef.current.length = 0;
            }
            selectedBuildingRef.current = building ?? null;
            selectedConveyorRef.current = conveyor ?? null;
        };

        const renderUI = () => {            
            const canvas = canvasRef.current!;
            const ctx = canvas.getContext("2d")!;
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.lineWidth = 1;
            ctx.strokeStyle = "black";
            
            const selectedUnits = selectedUnitsRef.current;
            const selectedBuilding = selectedBuildingRef.current;
            const selectedConveyor = selectedConveyorRef.current;
            if (selectedUnits.length > 0) {
                for (let i = 0; i < selectedUnits.length; i++) {  
                    const unit = selectedUnits[i];              
                    const { obj, isAlive } = unit;
                    if (!isAlive) {
                        continue;
                    }
                    worldPos.copy(obj.position).addScaledVector(obj.up, headOffset);                    
                    drawBar(ctx, worldPos, selectedUnits[i].health);
                }
            } else if (selectedBuilding) {
                const { visual, buildingType } = selectedBuilding;
                const size = buildingSizes[buildingType];
                worldPos.copy(visual.position).addScaledVector(visual.up, size.y * cellSize);
                worldPos.x += size.x / 2 * cellSize;
                worldPos.z += size.z / 2 * cellSize;
                drawBar(ctx, worldPos, 1);
            } else if (selectedConveyor) {
                GameUtils.mapToWorld(selectedConveyor, worldPos);
                worldPos.y += conveyorHeight * cellSize;
                drawBar(ctx, worldPos, 1);
            }
        };

        const onResize = () => {
            const { width, height } = engine.screenRect;
            canvasRef.current!.width = width;
            canvasRef.current!.height = height;
        };

        cmdRenderUI.attach(renderUI);
        cmdSetSelectedElems.attach(onSelectedElems);
        evtScreenResized.attach(onResize);
        return () => {
            cmdSetSelectedElems.detach(onSelectedElems);
            cmdRenderUI.detach(renderUI);
            evtScreenResized.detach(onResize);
        }
    }, []);

    const { width, height } = engine.screenRect;
    return <canvas
        ref={canvasRef}
        style={{
            position: "absolute",
            left: "0",
            top: "0",
            width: "100%",
            height: "100%",
            imageRendering: "pixelated"
        }}
        width={width}
        height={height}
    />
}

