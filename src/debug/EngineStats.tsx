import { WebGLProgram, WebGLInfo } from "three";

import styles from "./engine-stats.module.css";
import { MutableRefObject, useEffect, useRef, useState } from "react";
import { engine } from "../engine/Engine";

interface IProps {
    renderInfo: MutableRefObject<WebGLInfo | undefined>;
}

type WebGLProgramPatch = WebGLProgram & { type: string };

export function EngineStats(props: IProps) {
    const requestId = useRef<number>();
    const [shaders, setShaders] = useState<string[]>([]);
    const [calls, setCalls] = useState<number>(0);
    const [triangles, setTriangles] = useState<number>(0);
    const [shadersExpanded, setShadersExpanded] = useState<boolean>(false);
    const [animsExpanded, setAnimsExpanded] = useState<boolean>(false);

    const tick = () => {
        const renderInfo = props.renderInfo.current;
        if (renderInfo) {
            const names = renderInfo.programs?.map(p => `${(p as WebGLProgramPatch).type} (${p.usedTimes})`);
            setShaders(names ?? []);
            setCalls(renderInfo.render.calls);
            setTriangles(renderInfo.render.triangles);
        }
        requestId.current = requestAnimationFrame(tick);
    };

    useEffect(() => {
        tick();
        return () => cancelAnimationFrame(requestId.current!);
    }, []);

    return <div className={styles.root}>
        <div className={styles.header}>Draw calls: {calls}</div>
        <div className={styles.header}>Triangles: {triangles}</div>
        <div
            className={`clickable ${styles.header}`}
            onClick={() => setShadersExpanded(!shadersExpanded)}
        >
            {shadersExpanded ? "-" : "+"} Shaders: {shaders.length}
        </div>
        {shadersExpanded && shaders.map((s, i) => <div key={i}>{s}</div>)}
        {
            engine.animations.size > 0
            &&
            <div
                className={`clickable ${styles.header}`}
                onClick={() => setAnimsExpanded(!animsExpanded)}
            >
                {animsExpanded ? "-" : "+"} Anims: {engine.animations.size}
            </div>
        }
        {
            animsExpanded
            &&
            Array.from(engine.animations.values()).map((a, i) => {
                return <div key={i}>{`${a.clip.name} (${a.owner.name})`}</div>
            })
        }
    </div>
}

