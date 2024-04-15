const debug = false;

export const logger = {
    logDebug(...args) {
        if (debug) {
            console.log(...args);
        }
    },

    log(...args) {
        console.log(...args);
    }
}