import { useEffect, useRef } from "react";
import { TextButton } from "./TextButton";
import { uiconfig } from "./uiconfig";

import gsap from "gsap";

export function TutorialComplete() {
    const dialogRef = useRef<HTMLDivElement | null>(null);

    useEffect(() => {
        if (!dialogRef.current) {
            return;
        }
        gsap.to(dialogRef.current, {
            scaleY: 1,
            opacity: 1,
            duration: .3,                
        });
    }, []);

    return <div style={{
        position: "absolute",
        width: "100%",
        height: "100%",
        left: "0px",
        top: "0px",
        backgroundColor: "rgba(0, 0, 0, 0.5)",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
    }}>
        <div
            ref={dialogRef}
            style={{
                backgroundColor: uiconfig.backgroundColor,
                padding: `${uiconfig.paddingRem}rem`,
                gap: `${uiconfig.paddingRem * 2}rem`,
                display: "flex",
                flexDirection: "column",
                maxWidth: "80ch",
                transform: "scaleY(0)",
                opacity: 0
            }}>
            <div style={{
                fontSize: "2rem",
                color: "yellow"
            }}>
                Mission Complete!
            </div>
            <div style={{
                fontSize: "1.2rem"
            }}>
                Congratulations on completing the tutorial. <br />
                You are now ready to play on your own terms. <br />
                Good luck!
            </div>
            <div>
                <TextButton text={"Continue"} onClick={() => {
                    console.log("play");
                }} />
            </div>
        </div>
    </div>
}

