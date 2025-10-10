
import styles from "./LoadingIndicator.module.css";

export function LoadingIndicator() {
    return (
        <div               
            style={{
                position: "absolute",
                width: "100%",
                height: "100%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                top: "0px"
            }}
        >
            <div className={styles.loadingIndicator}>
                <div /><div /><div />
            </div>
        </div>
    );
}

