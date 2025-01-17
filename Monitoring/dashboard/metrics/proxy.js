// websocket server that dashboard connects to.
const chalk = require('chalk');
const redis = require('redis');
const got = require('got');
const fs = require('fs');
const http = require('http');
const httpProxy = require('http-proxy');
var child  = require('child_process'); 

// 5 minutes
const SWITCH_TIME = 300000;

// Interval for which we will perform latency checks
// 5 seconds
const LOAD_INTERVAL = 5000;

// Survey used during post request to checkbox.io microservice
// For canary analysis
const SURVEY = 'survey.json';

// Our arrays for metrics for final report generation
var cpuArr = [];
var memArr = [];
var mongoArr = [];
var nodeArr = [];
var nginxArr = [];
var latencyArr = [];
var statusCodeArr = [];
var srvName;

// Get the environment type from commandline args
// `local` uses blue_ip, green_ip which will also be provided in the args
// `production` uses the ip.txt file
let args = process.argv.slice(2);

const BLUE = `http://${args[1]}:3000/preview`;
const GREEN = `http://${args[2]}:3000/preview`;

var	servers = 
	[
	{name: "blue", url:`http://${args[1]}:3000/preview`, status: "#cccccc",  scoreTrend : [0]},
	{name: "green", url:`http://${args[2]}:3000/preview`, status: "#cccccc",  scoreTrend : [0]}
	];

async function saveMetrics() 
{
	const data = {
		name : srvName,
		latency: latencyArr,
		memory: memArr,
		cpu: cpuArr,
		nginx: nginxArr,
		node: nodeArr,
		mongo: mongoArr,
		statusCode: statusCodeArr
	};
	 
	await fs.writeFileSync(`${data.name}.json`, JSON.stringify(data), 'utf8');

	srvName = '';
	memArr = [];
	cpuArr = [];
	latencyArr = [];
	nodeArr = [];
	nginxArr = [];
	mongoArr = [];
	statusCodeArr = [];
}

////////////////////////////////////////////////////////////////////////////////////////
// PROXY / LOAD BALANCER
////////////////////////////////////////////////////////////////////////////////////////
// For the First 5 minutes it routes traffic to BLUE
// For the next 5 minutes it routes traffic to GREEN
// Finally it terminates the servers using `pm2 kill`
class Proxy
{
    constructor()
    {
		this.TARGET = BLUE;
		setInterval(this.sendLoad.bind(this), LOAD_INTERVAL);
		setTimeout( this.switchover.bind(this), SWITCH_TIME );
    }

    async proxy()
    {
        let options = {};
        let proxy   = httpProxy.createProxyServer(options);
        let self = this;
        // Redirect requests to the active TARGET (BLUE or GREEN)
        let server  = http.createServer(function(req, res)
        {
            // callback for redirecting requests.
            proxy.web( req, res, {target: self.TARGET } );
        });
		server.listen(3080);	
   }

   async switchover()
   {
	  await saveMetrics();
      this.TARGET = GREEN;
	  console.log(chalk.keyword('pink')(`Switching over to ${this.TARGET} ...`));
	  setTimeout(async function() {
		await saveMetrics();
		child.execSync('pm2 kill', {stdio: 'inherit'});
	}, SWITCH_TIME); 
   } 
   
   // We send Load to our target every 5 seconds
   // We use POST method on /preview service at port 3000
   // We will survey.json to be rendered
   async sendLoad() {
       
            // console.log(chalk.keyword('orange')(`******* ${this.TARGET} *******`));
            var options = {
                headers: {
                    'Content-type': 'application/json'
                },
                body: fs.readFileSync(SURVEY, 'utf8'),
				throwHttpErrors: false,
				timeout: 5000
			};
			let now = Date.now();
			var TGT = this.TARGET;
			try {
            got.post(this.TARGET, options).then(function(res){
                for (var server of servers) {
					let captureServer = server;
					if (captureServer.url == TGT) {						
						captureServer.statusCode = res.statusCode;
						captureServer.latency = res.statusCode == 200 ? Date.now() - now: 5000;
						updateHealth(captureServer);
					}
				}
			})
		}
		catch(e) {}
	}
}


/************************************
 * BEGIN THE MONITORING AND METRICS
*************************************/
function start(app)
{
	////////////////////////////////////////////////////////////////////////////////////////
	// DASHBOARD
	////////////////////////////////////////////////////////////////////////////////////////
	const io = require('socket.io')(3000);
	// Force websocket protocol, otherwise some browsers may try polling.
	io.set('transports', ['websocket']);
	// Whenever a new page/client opens a dashboard, we handle the request for the new socket.
	io.on('connection', function (socket) {
        // console.log(`Received connection id ${socket.id} connected ${socket.connected}`);

		if( socket.connected )
		{
			//// Broadcast heartbeat event over websockets ever 1 second
			var heartbeatTimer = setInterval( function () 
			{
				socket.emit("heartbeat", servers);
			}, 1000);

			//// If a client disconnects, we will stop sending events for them.
			socket.on('disconnect', function (reason) {
				console.log(`closing connection ${reason}`);
				clearInterval(heartbeatTimer);
			});
		}
	});

	/////////////////////////////////////////////////////////////////////////////////////////
	// REDIS SUBSCRIPTION
	/////////////////////////////////////////////////////////////////////////////////////////
	let client = redis.createClient(6379, 'localhost', {});
	// We subscribe to all the data being published by the server's metric agent.
	for( var server of servers )
	{
		// The name of the server is the name of the channel to recent published events on redis.
		client.subscribe(server.name);
	}

	// When an agent has published information to a channel, we will receive notification here.
	client.on("message", function (channel, message) 
	{
		// console.log(`Received message from agent: ${channel}`)
		for( var server of servers )
		{
			// Update our current snapshot for a server's metrics.
			if( server.name == channel)
			{
				let payload = JSON.parse(message);
				server.memoryLoad = payload.memoryLoad;
				server.cpu = payload.cpu;
				server.nginx = payload.nginx;
				server.mongo = payload.mongo;
				server.node = payload.node;
				server.mysql = payload.mysql;
			}
		}
	});

	let proxy = new Proxy();
	proxy.proxy();
}

function recordMetrics(server) {
	latencyArr.push(server.latency);
	memArr.push(server.memoryLoad);
	cpuArr.push(server.cpu);
	nodeArr.push(server.node);
	nginxArr.push(server.nginx);
	mongoArr.push(server.mongo);
	statusCodeArr.push(server.statusCode);
	srvName = server.name;
}

async function updateHealth(server)
{
	let score = 0;
	// Update score calculation.
	// Only if server is responsive then we update
	if (server.statusCode == 200) {

		score += 1

		if (server.latency < 50) {

			score += 1
		}
		else if (server.latency < 100) {

			score += 0.75
		}
		else if (server.latency < 2000) {

			score += 0.5
		}
		
		if (server.memoryLoad < 90 ) {

			score += 1
		}
		else if (server.memoryLoad < 100) {
	
			score += 0.5
		}
	
		if (server.cpu < 50) {
	
			score += 1
		}

		else if (server.cpu < 100) {
			score += 0.5
		}
	}

	recordMetrics(server);

	server.status = score2color(score/4);
	// console.log(`${server.name} ${score} ${canary}`);

	// Add score to trend data.
	server.scoreTrend.push( (4-score));
	if( server.scoreTrend.length > 100 )
	{
		server.scoreTrend.shift();
	}
}

function score2color(score)
{
	if (score <= 0.25) return "#ff0000";
	if (score <= 0.50) return "#ffcc00";
	if (score <= 0.75) return "#00cc00";
	return "#00ff00";
}

module.exports.start = start;