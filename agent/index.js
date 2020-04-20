const redis = require('redis');
const util  = require('util');
const os = require('os');
const si = require('systeminformation');

// Calculate metrics.
// TASK 1:
class Agent
{
    memoryLoad()
    {
        let totalMem = os.totalmem()
        let freeMem = os.freemem()
        // console.log( totalMem, freeMem );
        let usedMemory = (totalMem - freeMem) * 100 / totalMem
        return usedMemory
    }
    async cpu()
    {
       let load = await si.currentLoad();
       // console.log(load);
       return load.currentload;
    }
}

(async () => 
{
    // Get agent name from command line.
    let args = process.argv.slice(2);
    main(args[0], args[1]);
    
})();


async function main(name, monitor_ip)
{
    let agent = new Agent();
    console.log('Agent name: ', name)
    let connection = redis.createClient(6379, monitor_ip, {})
    connection.on('error', function(e)
    {
        console.log(e);
        process.exit(1);
    });
    let client = {};
    client.publish = util.promisify(connection.publish).bind(connection);

    // Push update ever 1 second
    setInterval(async function()
    {
        let payload = {
            memoryLoad: agent.memoryLoad(),
            cpu: await agent.cpu()
        };
        let msg = JSON.stringify(payload);
        await client.publish(name, msg);
        console.log(`${name} ${msg}`);
    }, 1000);

}



