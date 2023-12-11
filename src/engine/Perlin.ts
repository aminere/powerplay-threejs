
class Perlin {

    private samples = (() => {
        console.log('generating perlin noise samples');
        const _samples: number[][] = [];
        const numSamples = 64;
        for (let i = 0; i < numSamples; ++i) {
            _samples.push([]);
            for (let j = 0; j < numSamples; ++j) {
                _samples[i].push(Math.random());
            }
        }
        return _samples;
    })();

    public getNoise(x: number, y: number, frequency = 10, octaves = 4) {
        let noise = 0;
        let weigth = 1;
        let weights = 0;
        let currentFrequency = 1 / frequency;
        for (let k = 0; k < octaves; k++) {
            noise += this.getSample(x, y, currentFrequency) * weigth;
            weights += weigth;
            currentFrequency *= 2;
            weigth *= 0.5;
        }
        noise /= weights;
        return noise;
    }

    private getSample(j: number, i: number, freq: number) {
        let x = j * freq;
        let fx = Math.floor(x);
        let fractX = x - fx;
        const { samples } = this;
        fx = fx % samples.length;
        let fx2 = (fx + 1) % samples.length;

        let y = i * freq;
        let fy = Math.floor(y);
        let fractY = y - fy;
        fy = fy % samples.length;
        let fy2 = (fy + 1) % samples.length;

        let ny1x1 = samples[fy][fx];
        let ny1x2 = samples[fy][fx2];
        let iy1 = ny1x1 + (ny1x2 - ny1x1) * fractX;

        let ny2x1 = samples[fy2][fx];
        let ny2x2 = samples[fy2][fx2];
        let iy2 = ny2x1 + (ny2x2 - ny2x1) * fractX;

        let n = iy1 + (iy2 - iy1) * fractY;
        return n;
    }
}

export const perlin = new Perlin();

