const child = require('child_process');
const chalk = require('chalk');
const path = require('path');
const os = require('os');
const fs = require('fs');
const scpSync = require('../lib/do_scp');
const sshSync = require('../lib/do_ssh');

exports.command = 'prod up';
exports.desc = 'Provision the VMs on Digital Ocean';
exports.builder = (yargs) => {
};

exports.handler = async (argv) => {
  (async () => {
    await run();
  })();
};

async function run() {
    console.log("Provisioning the VMs");
    let result = child.spawnSync(
        `node digital_ocean.js`, { shell: true, stdio: 'inherit'}
    );
    if (result.error) {
        console.log(result.error);
        process.exit(result.status);
    }

    let servers = JSON.parse(fs.readFileSync('server_ip.json'));

    // Wait for the VMs to boot up
    console.log(chalk.blueBright("Waiting for the VMs to boot up"));
    await sleep(30000);

    for(server in servers){
        var ip = servers[server];
        console.log(chalk.blueBright('Install nodejs on ' + server));
        result = sshSync(
            `sudo apt update && sudo apt -y install curl dirmngr apt-transport-https lsb-release ca-certificates && curl -sL https://deb.nodesource.com/setup_12.x | sudo -E bash -  && sudo apt -y install nodejs`,
            `root@${ip}`
        );
        if (result.error) {
            console.log(result.error);
            process.exit(result.status);
        }

        console.log(chalk.blueBright('Install forever on ' + server));
        result = sshSync(
            `npm install forever -g`,
            `root@${ip}`
        );
        if (result.error) {
            console.log(result.error);
            process.exit(result.status);
        }

    }
    console.log(
        chalk.blueBright('Copying the Monitoring code')
      );
      var identifyFile =
        path.join(__dirname, '../', 'Monitoring');
      result = scpSync(
        identifyFile,
        `root@${servers['Monitor']}:/root/`
      );
      if (result.error) {
        console.log(result.error);
        process.exit(result.status);
      }

    console.log(chalk.blueBright('Install redis'));
    result = sshSync(
        `sudo apt install -y redis-server`,
        `root@${servers['Monitor']}`
    );
    if (result.error) {
        console.log(result.error);
        process.exit(result.status);
    }

    console.log(chalk.blueBright('npm install'));
    result = sshSync(
        `cd Monitoring/servers && npm install`,
        `root@${servers['Monitor']}`
    );
    if (result.error) {
        console.log(result.error);
        process.exit(result.status);
    }

    console.log(chalk.blueBright('index up'));
    result = sshSync(
        `cd Monitoring/servers && node index up`,
        `root@${servers['Monitor']}`
    );
    if (result.error) {
        console.log(result.error);
        process.exit(result.status);
    }

    console.log(chalk.blueBright('npm install'));
    result = sshSync(
        `cd Monitoring/dashboard && npm install`,
        `root@${servers['Monitor']}`
    );
    if (result.error) {
        console.log(result.error);
        process.exit(result.status);
    }

    console.log(chalk.blueBright('Changing redis config'));
    result = sshSync(
        `sed -i 's/bind 127.0.0.1 ::1/bind 0.0.0.0 ::1/g' /etc/redis/redis.conf`,
        `root@${servers['Monitor']}`
    );
    if (result.error) {
        console.log(result.error);
        process.exit(result.status);
    }

    console.log(chalk.blueBright('Restart redis server'));
    result = sshSync(
        `sudo systemctl restart redis-server`,
        `root@${servers['Monitor']}`
    );
    if (result.error) {
        console.log(result.error);
        process.exit(result.status);
    }

    console.log(
        chalk.blueBright('Copying the index file on checkbox agent')
      );
      var identifyFile =
        path.join(__dirname, '../Monitoring/agent/', 'index.js');
      result = scpSync(
        identifyFile,
        `root@${servers['Checkbox']}:/root/`
      );
      if (result.error) {
        console.log(result.error);
        process.exit(result.status);
      }

    console.log(
        chalk.blueBright('Copying the package file on checkbox agent')
      );
      var identifyFile =
        path.join(__dirname, '../Monitoring/agent/', 'package.json');
      result = scpSync(
        identifyFile,
        `root@${servers['Checkbox']}:/root/`
      );
      if (result.error) {
        console.log(result.error);
        process.exit(result.status);
      }

      console.log(
        chalk.blueBright('Copying the ip file to host')
      );
      var identifyFile =
        path.join(__dirname, '../Monitoring/agent/');
      result = scpSync(
        `root@${servers['Monitor']}:/root/Monitoring/dashboard/metrics/ip.txt`,
        identifyFile
      );
      if (result.error) {
        console.log(result.error);
        process.exit(result.status);
      }

      console.log(
        chalk.blueBright('Copying the ip file to checkbox agent')
      );
      var identifyFile =
        path.join(__dirname, '../Monitoring/agent/', 'ip.txt');
      result = scpSync(
        identifyFile,
        `root@${servers['Checkbox']}:/root/`
      );
      if (result.error) {
        console.log(result.error);
        process.exit(result.status);
      }

      console.log(
        chalk.blueBright('Copying the ip file to iTrust agent')
      );
      var identifyFile =
        path.join(__dirname, '../Monitoring/agent/', 'ip.txt');
      result = scpSync(
        identifyFile,
        `root@${servers['iTrust']}:/root/`
      );
      if (result.error) {
        console.log(result.error);
        process.exit(result.status);
      }

      console.log(
        chalk.blueBright('Copying the index file on iTrust agent')
      );
      var identifyFile =
        path.join(__dirname, '../Monitoring/agent/', 'index.js');
      result = scpSync(
        identifyFile,
        `root@${servers['iTrust']}:/root/`
      );
      if (result.error) {
        console.log(result.error);
        process.exit(result.status);
      }

    console.log(
        chalk.blueBright('Copying the package file on iTrust agent')
      );
      var identifyFile =
        path.join(__dirname, '../Monitoring/agent/', 'package.json');
      result = scpSync(
        identifyFile,
        `root@${servers['iTrust']}:/root/`
      );
      if (result.error) {
        console.log(result.error);
        process.exit(result.status);
      }

      console.log(chalk.blueBright('npm install'));
      result = sshSync(
          `npm install`,
          `root@${servers['Checkbox']}`
      );
      if (result.error) {
          console.log(result.error);
          process.exit(result.status);
      }
  
      console.log(chalk.blueBright('npm install'));
      result = sshSync(
          `npm install`,
          `root@${servers['iTrust']}`
      );
      if (result.error) {
          console.log(result.error);
          process.exit(result.status);
      }

      console.log(chalk.blueBright('forever start bin/www'));
      result = sshSync(
          `cd Monitoring/dashboard/ && forever start bin/www`,
          `root@${servers['Monitor']}`
      );
      if (result.error) {
          console.log(result.error);
          process.exit(result.status);
      }

      console.log(chalk.blueBright('forever start checkbox agent'));
      result = sshSync(
          `forever start index.js Checkbox`,
          `root@${servers['Checkbox']}`
      );
      if (result.error) {
          console.log(result.error);
          process.exit(result.status);
      }

      console.log(chalk.blueBright('forever start iTrust agent'));
      result = sshSync(
          `forever start index.js iTrust`,
          `root@${servers['iTrust']}`
      );
      if (result.error) {
          console.log(result.error);
          process.exit(result.status);
      }
}

// Sleep function
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}
