import { useEffect, useRef } from "react"
import { cmdRenderUI, evtScreenResized, cmdSetSelectedElems } from "../../Events";
import { gameMapState } from "../components/GameMapState";
import { Color, Vector3 } from "three";
import { GameUtils } from "../GameUtils";
import { engine } from "../../engine/Engine";
import { IUnit } from "../unit/IUnit";
import { IBuildingInstance } from "../GameTypes";
import { config } from "../config";

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
const { cellSize } = config.game;

function drawBar(ctx: CanvasRenderingContext2D, health: number) {
    const camera = gameMapState.camera;
    GameUtils.worldToScreen(worldPos, camera, screenPos);
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

    useEffect(() => {

        const onSelectedElems = ({ units, building }: {
            units?: IUnit[];
            building?: IBuildingInstance;
        }) => {
            if (units) {
                selectedUnitsRef.current = units;
            } else {
                selectedUnitsRef.current.length = 0;
            }

            if (building) {
                selectedBuildingRef.current = building;
            } else {
                selectedBuildingRef.current = null;
            }
        };

        const renderUI = () => {
            if (!gameMapState.instance) {
                return;
            }
            
            const canvas = canvasRef.current!;
            const ctx = canvas.getContext("2d")!;
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.lineWidth = 1;
            ctx.strokeStyle = "black";
            
            const selectedUnits = selectedUnitsRef.current;
            const selectedBuilding = selectedBuildingRef.current;
            if (selectedUnits.length > 0) {
                for (let i = 0; i < selectedUnits.length; i++) {  
                    const unit = selectedUnits[i];              
                    const { obj, isAlive } = unit;
                    if (!isAlive) {
                        continue;
                    }
                    worldPos.copy(obj.position).addScaledVector(obj.up, headOffset);                    
                    drawBar(ctx, selectedUnits[i].health);
                }
            } else if (selectedBuilding) {
                const { obj, buildingId } = selectedBuilding;
                const buildingConfig = config.buildings[buildingId];
                worldPos.copy(obj.position).addScaledVector(obj.up, buildingConfig.size.y * cellSize);
                worldPos.x += buildingConfig.size.x / 2 * cellSize;
                worldPos.z += buildingConfig.size.z / 2 * cellSize;
                drawBar(ctx, 1);
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

