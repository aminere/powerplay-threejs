
export class MathUtils {
    public static lerp_InOutCubic(a: number, b: number, t: number) {
        const factor = (t < 0.5) ? 4 * t * t * t : (1 - ((-2 * t + 2)**3) / 2);
        return a + (b - a) * factor;
    }
}

