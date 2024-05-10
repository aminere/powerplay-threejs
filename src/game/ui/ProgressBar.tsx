
interface ProgressBarProps {
    progress: number;
}

export function ProgressBar(props: ProgressBarProps) {
    const { progress } = props;
    return <div 
        style={{
            backgroundColor: "black",
            height: "5px",
            width: "100%",
            position: "relative"
        }}
    >
        <div 
            style={{
                position: "absolute",                
                backgroundColor: "white",
                height: "100%",
                width: `${Math.round(progress * 100)}%`
            }}
        />
    </div>
}

