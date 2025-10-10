
import styles from "./styles/LoadingIndicator.module.css";

export function LoadingIndicator() {
    return (
        <div               
            style={{
                position: "absolute",
                width: "100%",
                height: "100%",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-around",
                top: "0px"
            }}
        >
            <div className={styles.loadingIndicator}>
                <div /><div /><div />
            </div>
        </div>
    );
}

