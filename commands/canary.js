const child = require('child_process');
const chalk = require('chalk');
const path = require('path');
const yaml = require('js-yaml');
const fs = require('fs');

const sshSync = require('../lib/ssh');

exports.command = 'canary <blue_branch> <green_branch>';
exports.desc = 'Run Canary Analysis given the branches';

const PASS = 'PASS';

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
    result = child.spawnSync(`bakerx`, `run blue bionic --ip ${blue_ip} --sync`.split(' '), 
                            {shell:true, stdio: 'inherit', cwd: path.join(__dirname, "../agent")} );
    if( result.error ) { console.log(result.error); process.exit( result.status ); }
    
    console.log(chalk.greenBright('Provisioning green server...'));
    result = child.spawnSync(`bakerx`, `run green bionic --ip ${green_ip} --sync`.split(' '), 
                            {shell:true, stdio: 'inherit', cwd: path.join(__dirname, "../agent")} );
    if( result.error ) { console.log(result.error); process.exit( result.status ); }
}

async function clone_repositories(branch, ip) {
  // Clone checkbox microservice
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
  let result = await sshSync(`cd /bakerx && pm2 start index.js -- blue ${monitor_ip}`, `vagrant@${blue_ip}`);

  console.log(chalk.greenBright('Starting the agent on green...'));
  result = await sshSync(`cd /bakerx && pm2 start index.js -- green ${monitor_ip}`, `vagrant@${green_ip}`);
}

async function start_checkbox() {
    // Install dependencies
  console.log(chalk.blueBright(`Installing dependencies...`));
  let result = await sshSync(`cd checkbox.io-micro-preview/ && npm install`, `vagrant@${blue_ip}`);
    
  console.log(chalk.blueBright('Starting checkbox microservice on blue...'));
  result = await sshSync(`cd checkbox.io-micro-preview/ && pm2 kill && pm2 start index.js`, `vagrant@${blue_ip}`);

  console.log(chalk.greenBright(`Installing dependencies...`));
  result = await sshSync(`cd checkbox.io-micro-preview && npm install`, `vagrant@${green_ip}`);

  console.log(chalk.greenBright('Starting checkbox microservice on green...'));
  result = await sshSync(`cd checkbox.io-micro-preview/ && pm2 kill && pm2 start index.js`, `vagrant@${green_ip}`);
}

async function run_playbook() {
  console.log(chalk.keyword('orange')('Running playbook to install dependencies...'));
    const cmd = `ansible-playbook --vault-password-file vault_pass.txt /bakerx/pipeline/checkbox-playbook.yml -i /bakerx/pipeline/inventory`;
    result = await sshSync(cmd,`vagrant@${ansible_ip}`);
    if (result.error) {
        console.log(result.error);
        process.exit(result.status);
    }
}

async function generateReport() {
    const blue_report = await fs.readFileSync(path.join(__dirname, '../dashboard/', 'blue.json'), 'utf8');
    const green_report = await fs.readFileSync(path.join(__dirname, '../dashboard/', 'green.json'), 'utf8');

    console.log(chalk.keyword('magenta')('\n<=============== REPORT =================>'));

    console.log(chalk.blueBright('Metrics of blue server...'));
    console.log(blue_report);

    console.log(chalk.greenBright('\nMetrics of green server...'));
    console.log(green_report);

    const blue_result = JSON.parse(blue_report).result;
    const green_result = JSON.parse(green_report).result;

    if (blue_result == PASS && green_result == PASS) {
      console.log(chalk.green('PASS'))
    }
    else {
      console.log(chalk.red('FAIL'))
    }
}

async function shutDown() {
    console.log(chalk.keyword('orange')('Shutting down canaries'));
    let result = await child.spawnSync(`bakerx`, `delete vm blue`.split(' '), {shell:true, stdio: 'inherit'} );
    if( result.error ) { console.log(result.error); process.exit( result.status ); }

    result = await child.spawnSync(`bakerx`, `delete vm green`.split(' '), {shell:true, stdio: 'inherit'} );
    if( result.error ) { console.log(result.error); process.exit( result.status ); }
}

async function run(blue_branch, green_branch) {
    await provision_servers();

    console.log(chalk.keyword('orange')('Cloning repositories...'));
    await clone_repositories(blue_branch, blue_ip);
    
    await clone_repositories(green_branch, green_ip);
    
    await run_playbook();

    await start_checkbox();   
    
    await start_agents(); 

    await start_dashboard(); 

    // Wait for completion of canary analysis and then generate report
    console.log(chalk.keyword('orange')('Waiting to generate report...'));
    setTimeout(async function() {
      await generateReport();

      shutDown();
      
    }, 660000);  
}
