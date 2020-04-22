const redis = require('redis');
const util  = require('util');
const os = require('os');
const si = require('systeminformation');

// Calculate metrics.
// TASK 1:
class Agent
{
    round(num) {
        return Math.round(num * 100) / 100
    }

    memoryLoad()
    {
        let totalMem = os.totalmem()
        let freeMem = os.freemem()
        // console.log( totalMem, freeMem );
        let usedMemory = (totalMem - freeMem) * 100 / totalMem
        return this.round(usedMemory)
    }
    async cpu()
    {
       let load = await si.currentLoad();
       // console.log(load);
       return this.round(load.currentload);
    }

    async nginxMem()
    {
        let nginx = await si.processLoad('nginx');
        // console.log('///455464: ', proc);
        return this.round(nginx.mem);
    }

    async mongoMem()
    {
        let mongo = await si.processLoad('mongod');
        return this.round(mongo.mem);
    }

    async nodeMem()
    {
        let node = await si.processLoad('node');
        return this.round(node.mem);
    }

    async mySQLMem()
    {
        let mysql = await si.processLoad('mysqld');
        return this.round(mysql.mem);
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
    // console.log('Agent name: ', name)
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
            cpu: await agent.cpu(),
            nginx: await agent.nginxMem(),
            mongo: await agent.mongoMem(),
            node: await agent.nodeMem(),
            mysql: await agent.mySQLMem()
        };
        let msg = JSON.stringify(payload);
        await client.publish(name, msg);
        // console.log(`${name} ${msg}`);
    }, 5000);

}



