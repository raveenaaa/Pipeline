const got    = require("got");
const chalk  = require('chalk');
const os     = require('os');
const fs     = require('fs');
var config = {};
// Retrieve our api token from the environment variables.
config.token = process.env.DOTOKEN;
config.ssh_key = process.env.SSH_KEY;

if( !config.token )
{
	console.log(chalk`{red.bold DOTOKEN is not defined!}`);
	console.log(`Please set your environment variables with appropriate token.`);
	console.log(chalk`{italic You may need to refresh your shell in order for your changes to take place.}`);
	process.exit(1);
}

console.log(chalk.green(`Your token is: ${config.token.substring(0,4)}...`));

// Configure our headers to use our token when making REST api requests.
const headers =
{
	'Content-Type':'application/json',
	Authorization: 'Bearer ' + config.token
};


class DigitalOceanProvider
{
	// Documentation for needle:
	// https://github.com/tomas/needle

	// async listRegions()
	// {
	// 	let response = await got('https://api.digitalocean.com/v2/regions', { headers: headers, json:true })
	// 						 .catch(err => console.error(`listRegions ${err}`));
							 
	// 	if( !response ) return;

	// 	if( response.body.regions )
	// 	{
	// 		for( let region of response.body.regions)
	// 		{
	// 			console.log('Name: ' + region.name + ' Slug: ' + region.slug)
	// 		}
	// 	}

	// 	if( response.headers )
	// 	{
	// 		console.log( chalk.yellow(`Calls remaining ${response.headers["ratelimit-remaining"]}`) );
	// 	}
	// }

	// async listImages( )
	// {
	// 	// HINT: Add this to the end to get better filter results: ?type=distribution&per_page=100

	// 	let response = await got('https://api.digitalocean.com/v2/images?type=distribution&per_page=100', { headers: headers, json:true })
	// 						 .catch(err => console.error(`listImages ${err}`));
							 
	// 	if( !response ) return;

	// 	if( response.body.images )
	// 	{
	// 		for( let image of response.body.images)
	// 		{
	// 			console.log(image.slug)
	// 		}
	// 	}

	// 	if( response.headers )
	// 	{
	// 		console.log( chalk.yellow(`Calls remaining ${response.headers["ratelimit-remaining"]}`) );
	// 	}

	// }

	async addSshKey ()
	{
		var data = 
		{
			"name": "My SSH Public Key",
			"public_key": config.ssh_key
		};
		
		let response = await got.post("https://api.digitalocean.com/v2/account/keys", 
		{
			headers:headers,
			json:true,
			body: data
		}).catch( err => 
			console.error(chalk.red(`createDroplet: ${err}`)) 
		);

		if( !response ) return;

		console.log(response.statusCode);
		if(response.statusCode == 201)
		{
			console.log(chalk.green(`Added SSH Key ID : ${response.body.ssh_key.id}`));
		}
		return response.body.ssh_key.id;
	}

	async createDroplet (dropletName, region, imageName, ssh_id )
	{
		if( dropletName == "" || region == "" || imageName == "" )
		{
			console.log( chalk.red("You must provide non-empty parameters for createDroplet!") );
			return;
		}

		var data = 
		{
			"name": dropletName,
			"region":region,
			"size":"2gb",
			"image":imageName,
			"ssh_keys":ssh_id,
			"backups":false,
			"ipv6":true,
			"user_data":null,
			"private_networking":true
		};

		console.log("Attempting to create: "+ JSON.stringify(data) );

		let response = await got.post("https://api.digitalocean.com/v2/droplets", 
		{
			headers:headers,
			json:true,
			body: data
		}).catch( err => 
			console.error(chalk.red(`createDroplet: ${err}`)) 
		);

		if( !response ) return;

		console.log(response.statusCode);

		if(response.statusCode == 202)
		{
			console.log(chalk.green(`Created droplet id ${response.body.droplet.id}`));
		}
		return response.body.droplet.id;
	}

	async dropletInfo (id)
	{
		if( typeof id != "number" )
		{
			console.log( chalk.red("You must provide an integer id for your droplet!") );
			return;
		}

		// Make REST request
		let response = await got(`https://api.digitalocean.com/v2/droplets/${id}`, { headers: headers, json:true })
							 .catch(err => console.error(`dropletInfo ${err}`));

		if( !response ) return;

		if( response.body.droplet.networks.v4[0] )
		{
			let droplet = response.body.droplet;
			// console.log(droplet.networks.v4, droplet.networks.v4[1]);

			// Print out IP address
			//console.log('IP Address : ' + droplet.networks.v4[0].ip_address);
			return droplet.networks.v4;
		}

	}

	async deleteDroplet(id)
	{
		if( typeof id != "number" )
		{
			console.log( chalk.red("You must provide an integer id for your droplet!") );
			return;
		}

		// HINT, use the DELETE verb.
		let response = await got.delete(`https://api.digitalocean.com/v2/droplets/${id}`, { headers: headers, json:true })
		.catch(err => console.error(`listImages ${err}`));

		if( !response ) return;

		// No response body will be sent back, but the response code will indicate success.
		// Specifically, the response code will be a 204, which means that the action was successful with no returned body data.
		if(response.statusCode == 204)
		{
			console.log(`Deleted droplet ${id}`);
		}

	}

};

// Sleep function
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function provision()
{
	let client = new DigitalOceanProvider();

	// #############################################
	// #1 Print out a list of available regions
	// Comment out when completed.
	// https://developers.digitalocean.com/documentation/v2/#list-all-regions
	// use 'slug' property
	//await client.listRegions();

	// #############################################
	// #2 Extend the client object to have a listImages method
	// Comment out when completed.
	// https://developers.digitalocean.com/documentation/v2/#images
	// - Print out a list of available system images, that are AVAILABLE in a specified region.
	// - use 'slug' property or id if slug is null
	//await client.listImages();

	// #############################################
	// #3 Add SSH KEY to the account
	var ssh_id = await client.addSshKey();

	// #############################################
	// #4 Create an droplet with the specified name, region, and image
	// Comment out when completed. ONLY RUN ONCE!!!!!

	servers = ['monitor', 'checkbox', 'itrust'];
	var region = "nyc1";
	var image = "ubuntu-18-04-x64";
	server_ip = {};
	for(var server in servers){
		var name = servers[server];

		var dropletId = await client.createDroplet(name, region, image, [ssh_id]);

		while(true)
		{
			var ip = await client.dropletInfo(dropletId);
			if(ip)
			{
				console.log('IP Address : ' + ip[1].ip_address);
				server_ip[name] = [ ip[1].ip_address, ip[0].ip_address ];
				break
			}
			await sleep(5000);
		}
		var inventory = "[" + name + "]\n" + ip[1].ip_address + " ansible_ssh_private_key_file=~/.ssh/deploy_rsa ansible_user=root\n";
		fs.appendFileSync( "pipeline/cloud_inventory", inventory);
	}
	fs.writeFileSync( "server_ip.json", JSON.stringify( server_ip ) );
	
	// Record the droplet id that you see print out in a variable.
	// We will use this to interact with our droplet for the next steps.

	// !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
	// BEFORE MOVING TO STEP FOR, REMEMBER TO COMMENT OUT THE `createDroplet()` call!!!

	// #############################################
	// #5 Extend the client to retrieve information about a specified droplet.
	// Comment out when done.
	// https://developers.digitalocean.com/documentation/v2/#retrieve-an-existing-droplet-by-id
	// REMEMBER POST != GET
	// Most importantly, print out IP address!
	
	
	// #############################################
	// #6 In the command line, ping your server, make sure it is alive!
	// ping xx.xx.xx.xx

	// #############################################
	// #7 Extend the client to DESTROY the specified droplet.
	// https://developers.digitalocean.com/documentation/v2/#delete-a-droplet
	// await client.deleteDroplet(dropletId);

	// #############################################
	// #8 In the command line, ping your server, make sure it is dead!
	// ping xx.xx.xx.xx
}


// Run workshop code...
(async () => {
	await provision();
})();
