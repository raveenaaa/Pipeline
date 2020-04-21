const child = require('child_process');
const chalk = require('chalk');
const path = require('path');
const yaml = require('js-yaml');
const fs = require('fs');

const sshSync = require('../lib/ssh');
const scpSync = require('../lib/scp');

exports.command = 'canary <blue_branch> <green_branch>';
exports.desc = 'Run Canary Analysis given the branches';

try {
    const vars_file =  path.join(__dirname, "../pipeline/vars/", "vars.yml");
  
    let fileContents = fs.readFileSync(vars_file);
    let data = yaml.safeLoad(fileContents);
  
    monitor_ip = data.monitor_ip;
    green_ip =  data.green_ip;
    blue_ip = data.blue_ip;
    ansible_ip = data.ansible_ip;
  }
  catch(e) {
    console.log(e);
  }

exports.handler = async (argv) => {
  const { blue_branch, green_branch } = argv;

  (async () => {
    await run(blue_branch, green_branch);
  })();
};

async function provision_servers() {
    console.log(chalk.keyword('orange')('Provisioning Proxy server...'));
    let result = child.spawnSync(`bakerx`, `run proxy queues --ip ${monitor_ip} --sync`.split(' '), 
                                {shell:true, stdio: 'inherit', cwd: path.join(__dirname, "../dashboard")} );
    if( result.error ) { console.log(result.error); process.exit( result.status ); }

    console.log(chalk.blueBright('Provisioning blue server...'));
    result = child.spawnSync(`bakerx`, `run blue queues --ip ${blue_ip} --sync`.split(' '), 
                            {shell:true, stdio: 'inherit', cwd: path.join(__dirname, "../agent")} );
    if( result.error ) { console.log(result.error); process.exit( result.status ); }
    
    console.log(chalk.greenBright('Provisioning green server...'));
    result = child.spawnSync(`bakerx`, `run green queues --ip ${green_ip} --sync`.split(' '), 
                            {shell:true, stdio: 'inherit', cwd: path.join(__dirname, "../agent")} );
    if( result.error ) { console.log(result.error); process.exit( result.status ); }
}

async function clone_repositories(branch, ip) {
  // Clone checkbox microservice
  console.log(chalk.keyword('orange')('Cloning the checkbox microservice...'));
  let result = await sshSync(`git clone https://github.com/chrisparnin/checkbox.io-micro-preview.git`, `vagrant@${ip}`);
  if (result.error) {
    console.log(result.error);
    process.exit(result.status);
  }

  // Switch to branch
  console.log(chalk.keyword('orange')(`Switching to ${branch}...`));
  result = await sshSync(`cd checkbox.io-micro-preview && git checkout ${branch}`, `vagrant@${ip}`);
  if (result.error) {
    console.log(result.error);
    process.exit(result.status);
  }

  // Install dependencies
  console.log(chalk.keyword('orange')(`Install dependencies...`));
  result = await sshSync(`cd checkbox.io-micro-preview && npm install`, `vagrant@${ip}`);
  if (result.error) {
    console.log(result.error);
    process.exit(result.status);
  }
}

async function start_dashboard() {
  let result = await sshSync(`cd /bakerx && npm install`, `vagrant@${monitor_ip}`);
  if (result.error) {
    console.log(result.error);
  }

  console.log(chalk.keyword('orange')('Starting the Dashboard...'));
  sshSync(`cd /bakerx && sudo npm install forever -g && forever stopall && forever start bin/www local ${blue_ip} ${green_ip}`, `vagrant@${monitor_ip}`);
}

async function start_agents() {
  console.log(chalk.blueBright('Starting the agent on blue...'));
  result = sshSync(`cd /bakerx && forever start index.js blue ${monitor_ip}`, `vagrant@${blue_ip}`);

  console.log(chalk.greenBright('Starting the agent on green...'));
  result = sshSync(`cd /bakerx && forever start index.js green ${monitor_ip}`, `vagrant@${green_ip}`);
}

async function start_checkbox() {
  console.log(chalk.blueBright('Starting checkbox microservice on blue...'));
  result = sshSync(`cd checkbox.io-micro-preview/ && sudo npm install forever -g && forever stopall && forever start index.js`, `vagrant@${blue_ip}`);

  console.log(chalk.greenBright('Starting checkbox microservice on green...'));
  result = sshSync(`cd checkbox.io-micro-preview/ && sudo npm install forever -g && forever stopall && forever start index.js`, `vagrant@${green_ip}`);

}

async function run_playbook() {
  console.log(chalk.blueBright('Running playbook to install dependencies...'));
    const cmd = `ansible-playbook --vault-password-file vault_pass.txt /bakerx/pipeline/checkbox-playbook.yml -i /bakerx/pipeline/inventory`;
    result = await sshSync(cmd,`vagrant@${ansible_ip}`);
    if (result.error) {
        console.log(result.error);
        process.exit(result.status);
    }
}

async function run(blue_branch, green_branch) {
    await provision_servers();
    
    await run_playbook()

    // console.log(chalk.blueBright('Setting up blue...'));
    await clone_repositories(blue_branch, blue_ip);
    
    // console.log(chalk.greenBright('Setting up green...'));
    await clone_repositories(green_branch, green_ip);

    await start_checkbox();   
    
    await start_agents(); 

    await start_dashboard();    
}
