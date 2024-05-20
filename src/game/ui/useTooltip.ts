import { useEffect, useRef } from "react";
import { cmdShowTooltip } from "../../Events";

export function useTooltip(tooltipId?: string) {
    const tooltipRef = useRef<HTMLDivElement | null>(null);

    useEffect(() => {
        if (!tooltipRef.current) {
            return;
        }
        const onShowTooltip = (tooltipTargetId?: string) => {
            const show = tooltipTargetId && tooltipTargetId === tooltipId;
            if (show) {
                if (!tooltipRef.current!.classList.contains("visible")) {
                    tooltipRef.current!.classList.add("visible");
                }
            } else {
                if (tooltipRef.current!.classList.contains("visible")) {
                    tooltipRef.current!.classList.remove("visible");
                }
            }
        }
        cmdShowTooltip.attach(onShowTooltip);
        return () => {
            cmdShowTooltip.detach(onShowTooltip)
        }
    }, [tooltipId]);

    return tooltipRef;
}

