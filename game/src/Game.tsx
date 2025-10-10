import { useCallback, useEffect, useRef, useState } from "react"
import { GameUI, engine, input, utils, ISceneInfo, evtSceneCreated, cmdShowUI, IVector2 } from "powerplay-lib";
import { Camera, WebGLInfo } from "three";
import { Env } from "./env";
import Stats from "stats.js";

import styles from "./styles/Game.module.css";
import "powerplay-lib/lib/style.css";

interface IProps {
    pointerPos: IVector2;
}

export default function Game(props: IProps) {
    const root = useRef<HTMLDivElement>(null);
    const cursor = useRef<HTMLImageElement>(null);
    const activeRef = useRef(false);
    const [camera, setCamera] = useState<Camera | null>(null);
    const [pointerLocked, setPointerLocked] = useState(utils.isPointerLocked());
    const stats = useRef(new Stats());
    const renderInfo = useRef<WebGLInfo>();   

    useEffect(() => {
        const onSceneCreated = (info: ISceneInfo) => {
            const container = root.current!;
            setCamera(info.mainCamera);
            const { width, height } = container.getBoundingClientRect();
            utils.updateCameraAspect(info.mainCamera, width, height);
            engine.setScreenSize(width, height);
            if (!activeRef.current) {
                console.assert(info.name === "mainmenu");
                cmdShowUI.post("mainmenu");
            }
            activeRef.current = true;
        };
        
        evtSceneCreated.attach(onSceneCreated);
        return () => {
            evtSceneCreated.detach(onSceneCreated);
        }
    }, []);
    
    useEffect(() => {
        const container = root.current!;

        if (!engine.renderer) {
            const { width, height } = container.getBoundingClientRect();
            engine.init(width, height, "game");
            renderInfo.current = engine.renderer!.info;
            engine.parseScene(utils.createNewScene("mainmenu").toJSON());
            input.touchPos.set(props.pointerPos.x, props.pointerPos.y);
            if (Env.isWeb) {
                input.touchInside = utils.isPointerLocked();
            } else {
                input.touchInside = true;
            }
        }
        
        console.assert(container.children.length === 0);     
        container.appendChild(engine.renderer!.domElement);

        const _stats = stats.current;
        _stats.showPanel(0); // 0: fps, 1: ms, 2: mb, 3+: custom
        container.appendChild(_stats.dom);
        _stats.dom.style.position = "absolute";
        _stats.dom.style.left = "unset";
        _stats.dom.style.right = "0";
        _stats.dom.style.display = "none"; // TODO parametrize
        return () => {
            activeRef.current = false;
            container.removeChild(engine.renderer!.domElement);
            container.removeChild(_stats.dom);            
        }
    }, []);

    useEffect(() => {
        if (!camera) {
            return;
        }
        const onResize = () => {
            setTimeout(() => {
                const { width, height } = root.current!.getBoundingClientRect();
                engine.setScreenSize(width, height);
                utils.updateCameraAspect(camera!, width, height);
            }, 60);
        };        

        window.addEventListener('resize', onResize);
        return () => {
            window.removeEventListener('resize', onResize);
        }
    }, [camera]);

    useEffect(() => {
        const onPointerDown = (e: PointerEvent) => {
            input.rawTouchDown = true;
            input.rawTouchButton = e.button;
            input.touchPos.set(props.pointerPos.x, props.pointerPos.y);
        };

        const onPointerMove = () => {
            input.rawTouchJustMoved = true;
            const { pointerPos } = props;                
            // const handCursorOffet = 10;   
            // cursor.current!.style.left = `${pointerPos.x - handCursorOffet}px`;
            cursor.current!.style.left = `${pointerPos.x}px`;
            cursor.current!.style.top = `${pointerPos.y}px`;
            input.touchPos.set(props.pointerPos.x, props.pointerPos.y);
        };

        const onPointerUp = () => {
            input.rawTouchDown = false;
            input.touchPos.set(props.pointerPos.x, props.pointerPos.y);
        };

        const onClick = () => {
            if (Env.isWeb) {
                if (!utils.isPointerLocked()) {
                    (document.body as any).requestPointerLock({ unadjustedMovement: false });
                }
            }
        }

        const onPointerLockChange = () => {
            setPointerLocked(utils.isPointerLocked());
            input.touchInside = utils.isPointerLocked();
        };

        // const onWheel = (e: WheelEvent) => {
        //     input.rawWheelDelta = e;
        // };

        const onKeyDown = (e: KeyboardEvent) => {
            const key = e.key.toLowerCase();
            input.setRawKeyPressed(key, true);
        };
        const onKeyUp = (e: KeyboardEvent) => {
            const key = e.key.toLowerCase();
            input.setRawKeyPressed(key, false);
        };

        window.addEventListener('click', onClick);
        window.addEventListener('pointermove', onPointerMove);
        window.addEventListener('pointerdown', onPointerDown);
        window.addEventListener('pointerup', onPointerUp);
        window.addEventListener("keydown", onKeyDown);
        window.addEventListener("keyup", onKeyUp);
        document.addEventListener('pointerlockchange', onPointerLockChange);
        // window.addEventListener('wheel', onWheel);
        return () => {
            window.removeEventListener('click', onClick);
            window.removeEventListener('pointermove', onPointerMove);
            window.removeEventListener('pointerdown', onPointerDown);
            window.removeEventListener('pointerup', onPointerUp);
            window.removeEventListener("keydown", onKeyDown);
            window.removeEventListener("keyup", onKeyUp);
            document.removeEventListener('pointerlockchange', onPointerLockChange);
            // window.removeEventListener('wheel', onWheel);
        }

    }, []);

    const animationFrameId = useRef<number>(0);
    const update = useCallback(() => {
        if (!activeRef.current) {
            return;
        }
        stats.current.begin();
        engine.update();
        engine.render(camera!);
        engine.renderUI();

        stats.current.end();
        animationFrameId.current = requestAnimationFrame(update);
    }, [camera]);

    useEffect(() => {
        if (activeRef.current) {
            update();
            return () => {
                cancelAnimationFrame(animationFrameId.current);
            }
        }
    }, [update]);

    return <>
        <div
            style={{
                width: "100%",
                height: "100%"
            }}
            ref={root}
            onWheel={e => input.rawWheelDelta = e.nativeEvent}
        />
        {/* {active && <EngineStats renderInfo={renderInfo} />} */}
        <GameUI rawPointerPos={props.pointerPos} />
        <img
            ref={cursor}
            className={styles.cursor}
            src="images/cursor.png"
            style={{ 
                display: pointerLocked ? 'block' : 'none',
                left: `${props.pointerPos.x}px`,
                top: `${props.pointerPos.y}px` 
            }}
        />
    </>
}

