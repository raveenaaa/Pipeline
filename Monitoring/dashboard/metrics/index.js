// websocket server that dashboard connects to.
const redis = require('redis');
const got = require('got');
const fs = require('fs');
const path = require('path');

// We need your host computer ip address in order to use port forwards to servers.
let ip = ''
try
{
	ip = JSON.parse(fs.readFileSync(path.join(__dirname,'server_ip.json')));
}
catch(e)
{
	console.log(e);
	throw new Error("Missing required server_ip.json file");	
}

/// Servers data being monitored.
var servers = 
[
	{name: "checkbox",url:`http://${ip['checkbox'][1]}:9001/`, status: "#cccccc",  scoreTrend : [0]},
	{name: "itrust",url:`http://${ip['itrust'][1]}:9001/`, status: "#cccccc",  scoreTrend : [0]}
];


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
        console.log(`Received connection id ${socket.id} connected ${socket.connected}`);

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
		console.log(`Received message from agent: ${channel}`)
		for( var server of servers )
		{
			// Update our current snapshot for a server's metrics.
			if( server.name == channel)
			{
				let payload = JSON.parse(message);
				server.memoryLoad = payload.memoryLoad;
				server.cpu = payload.cpu;
				server.systemLoad = payload.systemLoad;
				server.nginx = payload.nginx;
				server.mongo = payload.mongo;
				server.node = payload.node;
				server.mysql = payload.mysql;
				updateHealth(server);
			}
		}
	});

	// LATENCY CHECK
	var latency = setInterval( function () 
	{
		for( var server of servers )
		{
			if( server.url )
			{
				let now = Date.now();

				// Bind a new variable in order to for it to be properly captured inside closure.
				let captureServer = server;

				// Make request to server we are monitoring.
				got(server.url, {timeout: 5000, throwHttpErrors: false}).then(function(res)
				{
					// TASK 2
					captureServer.statusCode = res.statusCode;
					captureServer.latency = Date.now() - now;
				}).catch( e => 
				{
					// console.log(e);
					captureServer.statusCode = e.code;
					captureServer.latency = 5000;
				});
			}
		}
	}, 10000);
}

// TASK 3
function updateHealth(server)
{
	let score = 0;
	// Update score calculation.
	if(server.cpu < 60){
		score = score + 1
	}
	else if(server.cpu < 80){
		score = score + 0.5
	}

	if(server.memoryLoad < 70){
		score = score + 1;
	}
	else if(server.memoryLoad < 90){
		score = score + 0.5;
	}

	if(server.name == "computer" || server.latency < 500){
		score = score + 1;
	}
	else if(server.latency < 2000){
		score = score + 0.5;
	}

	if(server.name == "computer" || server.statusCode == 200){
		score = score + 1;
	}
	else{
		score = score - 1;
	}

	server.status = score2color(score/4);

	console.log(`${server.name} ${score}`);

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