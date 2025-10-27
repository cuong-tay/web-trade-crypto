
export const calculateEMA = (data: number[], period: number): (number | null)[] => {
    if (data.length < period || period <= 0) {
        return new Array(data.length).fill(null);
    }

    const emaArray: (number | null)[] = new Array(data.length).fill(null);
    const multiplier = 2 / (period + 1);

    // Calculate initial SMA
    let sum = 0;
    for (let i = 0; i < period; i++) {
        sum += data[i];
    }
    emaArray[period - 1] = sum / period;

    // Calculate subsequent EMAs
    for (let i = period; i < data.length; i++) {
        const prevEma = emaArray[i - 1];
        if (prevEma !== null) {
            emaArray[i] = (data[i] - prevEma) * multiplier + prevEma;
        }
    }
    return emaArray;
};


export const calculateRSI = (data: number[], period: number): (number | null)[] => {
    if (data.length < period + 1 || period <= 0) {
        return new Array(data.length).fill(null);
    }

    const rsiArray: (number | null)[] = new Array(data.length).fill(null);
    let avgGain = 0;
    let avgLoss = 0;

    // Calculate initial average gain and loss
    for (let i = 1; i <= period; i++) {
        const change = data[i] - data[i - 1];
        if (change > 0) {
            avgGain += change;
        } else {
            avgLoss -= change;
        }
    }
    avgGain /= period;
    avgLoss /= period;

    const calculateRSIValue = (gain: number, loss: number) => {
        if (loss === 0) return 100;
        const rs = gain / loss;
        return 100 - (100 / (1 + rs));
    };

    rsiArray[period] = calculateRSIValue(avgGain, avgLoss);

    // Calculate subsequent RSIs
    for (let i = period + 1; i < data.length; i++) {
        const change = data[i] - data[i - 1];
        let gain = 0;
        let loss = 0;
        if (change > 0) {
            gain = change;
        } else {
            loss = -change;
        }

        avgGain = (avgGain * (period - 1) + gain) / period;
        avgLoss = (avgLoss * (period - 1) + loss) / period;
        
        rsiArray[i] = calculateRSIValue(avgGain, avgLoss);
    }

    return rsiArray;
};
