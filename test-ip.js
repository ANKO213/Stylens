const { networkInterfaces } = require('os');

function getLocalIp() {
    const nets = networkInterfaces();
    console.log("Interfaces found:", Object.keys(nets));

    for (const name of Object.keys(nets)) {
        for (const net of nets[name]) {
            console.log(`Interface ${name}: ${net.family} ${net.address} (internal: ${net.internal})`);
            const familyV4Value = typeof net.family === 'string' ? 'IPv4' : 4;
            if (net.family === familyV4Value && !net.internal) {
                console.log("MATCH FOUND:", net.address);
                return net.address;
            }
        }
    }
    return "localhost";
}

console.log("Result:", getLocalIp());
