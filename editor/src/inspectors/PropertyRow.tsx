
export function PropertyRow({ name, children }: { name: string | JSX.Element; children: React.ReactNode }) {

    const label = (() => {
        if (typeof name === "string") {
            if (name.startsWith("_")) {
                return name.slice(1);
            }
        }
        return name;
    })();

    return <div style={{
        display: "grid",
        gridTemplateColumns: ".5fr 1fr",
        alignItems: "center",
        height: "30px",
        gap: ".5rem"
    }}>
        <div style={{
            textOverflow: "ellipsis",
            overflow: "hidden",
            whiteSpace: "pre",
            fontSize: "small",
            textShadow: "black 1px 1px"
        }}>
            {label}
        </div>
        {children}
    </div>
}

