
export function Properties({ children }: { children: React.ReactNode }) {
    return <div style={{
        padding: ".2rem 0 .2rem .6rem",
        display: "flex",
        flexDirection: "column",
        gap: ".2rem",
    }}>
        {children}
    </div>
}

