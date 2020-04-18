const child = require('child_process');
const chalk = require('chalk');
const path = require('path');
const yaml = require('js-yaml');
const fs = require('fs');

const sshSync = require('../lib/ssh');

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
    console.log(chalk.greenBright('Provisioning Proxy server...'));
    let result = child.spawnSync(`bakerx`, `run monitor queues --ip ${monitor_ip} --sync`.split(' '), 
                                {shell:true, stdio: 'inherit', cwd: path.join(__dirname, "../dashboard")} );
    if( result.error ) { console.log(result.error); process.exit( result.status ); }

    console.log(chalk.blueBright('Provisioning blue server...'));
    result = child.spawnSync(`bakerx`, `run blue queues --ip ${blue_ip}`.split(' '), {shell:true, stdio: 'inherit'} );
    if( result.error ) { console.log(result.error); process.exit( result.status ); }

    console.log(chalk.blueBright('Provisioning green server...'));
    result = child.spawnSync(`bakerx`, `run green queues --ip ${green_ip}`.split(' '), {shell:true, stdio: 'inherit'} );
    if( result.error ) { console.log(result.error); process.exit( result.status ); }
}

async function clone_repositories(blue_branch, green_branch) {
  // Clone checkbox microservice on blue
  console.log(chalk.blueBright('Cloning the checkbox microservice on blue...'));
  let result = await sshSync(`git clone https://github.com/chrisparnin/checkbox.io-micro-preview.git`, `vagrant@${blue_ip}`);
  if (result.error) {
    console.log(result.error);
    process.exit(result.status);
  }

  // Switch to blue_branch
  console.log(chalk.blueBright(`Switching to ${blue_branch}...`));
  result = await sshSync(`cd checkbox.io-micro-preview && git checkout ${blue_branch}`, `vagrant@${blue_ip}`);
  if (result.error) {
    console.log(result.error);
    process.exit(result.status);
  }

  // Clone checkbox microservice on green
  console.log(chalk.greenBright('Cloning the checkbox microservice on blue...'));
  result = await sshSync(`git clone https://github.com/chrisparnin/checkbox.io-micro-preview.git`, `vagrant@${green_ip}`);
  if (result.error) {
    console.log(result.error);
    process.exit(result.status);
  }

  // Switch to green_branch
  console.log(chalk.blueBright(`Switching to ${green_branch}...`));
  result = await sshSync(`cd checkbox.io-micro-preview && git checkout ${green_branch}`, `vagrant@${green_ip}`);
  if (result.error) {
    console.log(result.error);
    process.exit(result.status);
  }
}

async function run(blue_branch, green_branch) {
    await provision_servers();

    console.log(chalk.blueBright('Running playbook to install dependencies...'));
    const cmd = `ansible-playbook --vault-password-file vault_pass.txt /bakerx/pipeline/checkbox-playbook.yml -i /bakerx/pipeline/inventory`;
    result = sshSync(cmd,`vagrant@${ansible_ip}`);
    if (result.error) {
        console.log(result.error);
        process.exit(result.status);
    }

    await clone_repositories(blue_branch, green_branch);

}
