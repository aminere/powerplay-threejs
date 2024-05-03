
import styles from "./Tooltip.module.css";

interface TooltipProps {
    content: JSX.Element;
}

export function Tooltip(props: React.PropsWithChildren<TooltipProps>) {
    return <div className={styles.tooltip}>
        {props.children}
        <span className={styles.tooltiptext}>
            {props.content}
        </span>
    </div>
}

