const child = require('child_process');
const chalk = require('chalk');
const path = require('path');
const yaml = require('js-yaml');
const fs = require('fs');
var mwu = require('mann-whitney-utest');

const sshSync = require('../lib/ssh');
const scpSync = require('../lib/scp');

exports.command = 'canary <blue_branch> <green_branch>';
exports.desc = 'Run Canary Analysis given the branches';

const PASS = 'PASS';
const FAIL = 'FAIL';
const BLUE = path.join(__dirname, '../dashboard/', 'blue.json');
const GREEN = path.join(__dirname, '../dashboard/', 'green.json')
const REPORT = path.join(__dirname, '../canaryReport');

try {
    const vars_file =  path.join(__dirname, "../pipeline/vars/", "vars.yml");
  
    let fileContents = fs.readFileSync(vars_file);
    let data = yaml.safeLoad(fileContents);
  
    proxy_ip = data.proxy_ip;
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
    let result = child.spawnSync(`bakerx`, `run proxy bionic --ip ${proxy_ip} --sync`.split(' '), 
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

async function configure_redis() {
  console.log(chalk.keyword('orange')('Installing and configuring redis-server on Proxy...'));
  let srcFile = path.join(__dirname, '../pipeline/redis.sh');
  result = await scpSync(srcFile, `vagrant@${proxy_ip}:/home/vagrant/redis.sh`);
      if( result.error ) { console.log(result.error); process.exit( result.status ); }

  result = await sshSync('chmod 700 redis.sh && ./redis.sh', `vagrant@${proxy_ip}`);
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
  let result = await sshSync(`cd /bakerx && npm install`, `vagrant@${proxy_ip}`);
  if (result.error) {
    console.log(result.error);
  }

  console.log(chalk.keyword('orange')('Starting the Dashboard...'));
  sshSync(`cd /bakerx && pm2 kill && pm2 start bin/www -- local ${blue_ip} ${green_ip}`, `vagrant@${proxy_ip}`);
}

async function start_agents() {
  console.log(chalk.blueBright('Starting the agent on blue...'));
  let result = await sshSync(`cd /bakerx && pm2 start index.js -- blue ${proxy_ip}`, `vagrant@${blue_ip}`);

  console.log(chalk.greenBright('Starting the agent on green...'));
  result = await sshSync(`cd /bakerx && pm2 start index.js -- green ${proxy_ip}`, `vagrant@${green_ip}`);
}

async function start_checkbox() {
    // Install dependencies
  console.log(chalk.blueBright(`Installing checkbox dependencies on blue...`));
  let result = await sshSync(`cd checkbox.io-micro-preview/ && npm install`, `vagrant@${blue_ip}`);
    
  console.log(chalk.blueBright('Starting checkbox microservice on blue...'));
  result = await sshSync(`cd checkbox.io-micro-preview/ && pm2 kill && pm2 start index.js`, `vagrant@${blue_ip}`);

  console.log(chalk.greenBright(`Installing checkbox dependencies on green...`));
  result = await sshSync(`cd checkbox.io-micro-preview && npm install`, `vagrant@${green_ip}`);

  console.log(chalk.greenBright('Starting checkbox microservice on green...'));
  result = await sshSync(`cd checkbox.io-micro-preview/ && pm2 kill && pm2 start index.js`, `vagrant@${green_ip}`);
}

async function run_playbook() {
  console.log(chalk.keyword('orange')('Running playbook to install dependencies...'));
    const cmd = `ansible-playbook --vault-password-file vault_pass.txt /bakerx/pipeline/canary-setup.yml -i /bakerx/pipeline/inventory`;
    result = await sshSync(cmd,`vagrant@${ansible_ip}`);
    if (result.error) {
        console.log(result.error);
        process.exit(result.status);
    }
}

async function generateReport(blue_branch, green_branch) {
    const blue_metrics = JSON.parse(await fs.readFileSync(BLUE, 'utf8'));
    const green_metrics = JSON.parse(await fs.readFileSync(GREEN, 'utf8'));

    console.log(chalk.keyword('orange')('\n********** REPORT **********'));

    var canaryScore = {
      'latency': '',
      'memory': '',
      'cpu': '',
      'node': '',
      'nginx': '',
      'mongo':'', 
      'responsive': ''
    };

    var pass = 0;
    for (metric in blue_metrics) {
      if (metric == 'name' || metric == 'responsive'){
        continue
      }
      var len = Math.min(green_metrics[metric].length, blue_metrics[metric].length);
      var samples = [green_metrics[metric].slice(green_metrics[metric].length - len), blue_metrics[metric].slice(blue_metrics[metric].length - len)];
      var u = mwu.test(samples);

      if (!mwu.check(u, samples)) {
        console.error('Something went wrong!');
      }
      else {
      if (mwu.significant(u, samples)) {
        canaryScore[metric] = FAIL
      }
      else {
        canaryScore[metric] = PASS
        pass += 1;
      }
    }
  }
  var result;
  if (blue_metrics['responsive'] && green_metrics['responsive']) {    
    canaryScore['responsive'] = PASS
    if (pass / 6 >= 0.5)
      result = "The canary result is : " + PASS;
    else
      result = FAIL;
  }
  else {
    canaryScore['responsive'] = FAIL;
    result = `Green Server wasn't responsive\nThe canary result is : ` + FAIL;
  }
  console.log(canaryScore)
  console.log(result);  
  var report = '***** REPORT *****\n\n';

  for (metric in canaryScore) {
    report += metric + ':' + canaryScore[metric] + '\n'
  }
  report += '\n' + result
  
  fs.writeFileSync(`${REPORT}_${blue_branch}_${green_branch}.txt`, report, 'utf8');
}

async function shutDown() {
    // console.log(chalk.keyword('orange')('Shutting down canaries'));
    // let result = await child.spawnSync(`bakerx`, `delete vm blue`.split(' '), {shell:true, stdio: 'inherit'} );
    // if( result.error ) { console.log(result.error); process.exit( result.status ); }

    // result = await child.spawnSync(`bakerx`, `delete vm green`.split(' '), {shell:true, stdio: 'inherit'} );
    // if( result.error ) { console.log(result.error); process.exit( result.status ); }

    console.log(chalk.keyword('orange')('Shutting down proxy'));
    result = await child.spawnSync(`bakerx`, `delete vm proxy`.split(' '), {shell:true, stdio: 'inherit'} );
    if( result.error ) { console.log(result.error); process.exit( result.status ); }

    await deleteFile(BLUE);
    await deleteFile(GREEN);
}

async function deleteFile(file) {
  fs.unlinkSync(file, (err) => {
    if (err) {
      console.log(chalk.redBright(err));
      process.exit(err.code);
    }
    console.log('File deleted');
  })
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function run(blue_branch, green_branch) {
    await provision_servers();

    console.log(chalk.keyword('orange')('Cloning repositories...'));
    await clone_repositories(blue_branch, blue_ip);
    
    await clone_repositories(green_branch, green_ip);
    
    await run_playbook();

    await configure_redis();

    await start_checkbox();   
    
    await start_agents(); 

    await start_dashboard(); 

    // Wait for completion of canary analysis and then generate report
    console.log(chalk.keyword('magenta')('Waiting to generate report...'));

    while (true) {

      if (fs.existsSync(BLUE) && fs.existsSync(GREEN)) { 
        break;
      }
      await sleep(5000);
    }
    
    await generateReport(blue_branch, green_branch);

    shutDown();
}
