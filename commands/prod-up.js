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
        var ip = servers[server][0];
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
        `root@${servers['monitor'][0]}:/root/`
      );
      if (result.error) {
        console.log(result.error);
        process.exit(result.status);
      }

    console.log(chalk.blueBright('Install redis'));
    result = sshSync(
        `sudo apt install -y redis-server`,
        `root@${servers['monitor'][0]}`
    );
    if (result.error) {
        console.log(result.error);
        process.exit(result.status);
    }

    console.log(chalk.blueBright('npm install'));
    result = sshSync(
        `cd Monitoring/servers && npm install`,
        `root@${servers['monitor'][0]}`
    );
    if (result.error) {
        console.log(result.error);
        process.exit(result.status);
    }

    // console.log(chalk.blueBright('index up'));
    // result = sshSync(
    //     `cd Monitoring/servers && node index up`,
    //     `root@${servers['monitor'][0]}`
    // );
    // if (result.error) {
    //     console.log(result.error);
    //     process.exit(result.status);
    // }

    console.log(chalk.blueBright('npm install'));
    result = sshSync(
        `cd Monitoring/dashboard && npm install`,
        `root@${servers['monitor'][0]}`
    );
    if (result.error) {
        console.log(result.error);
        process.exit(result.status);
    }

    console.log(chalk.blueBright('Changing redis config'));
    result = sshSync(
        `sed -i 's/bind 127.0.0.1 ::1/bind 0.0.0.0 ::1/g' /etc/redis/redis.conf`,
        `root@${servers['monitor'][0]}`
    );
    if (result.error) {
        console.log(result.error);
        process.exit(result.status);
    }

    console.log(chalk.blueBright('Restart redis server'));
    result = sshSync(
        `sudo systemctl restart redis-server`,
        `root@${servers['monitor'][0]}`
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
        `root@${servers['checkbox'][0]}:/root/`
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
        `root@${servers['checkbox'][0]}:/root/`
      );
      if (result.error) {
        console.log(result.error);
        process.exit(result.status);
      }

      // console.log(
      //   chalk.blueBright('Copying the ip file to host')
      // );
      // var identifyFile =
      //   path.join(__dirname, '../Monitoring/agent/');
      // result = scpSync(
      //   `root@${servers['monitor'][0]}:/root/Monitoring/dashboard/metrics/ip.txt`,
      //   identifyFile
      // );
      // if (result.error) {
      //   console.log(result.error);
      //   process.exit(result.status);
      // }

      console.log(
        chalk.blueBright('Copying the ip file to monitor vm')
      );
      var identifyFile =
        path.join(__dirname, '../', 'server_ip.json');
      result = scpSync(
        identifyFile,
        `root@${servers['monitor'][0]}:/root/Monitoring/dashboard/metrics/`
      );
      if (result.error) {
        console.log(result.error);
        process.exit(result.status);
      }

      // console.log(
      //   chalk.blueBright('Copying the ip file to checkbox agent')
      // );
      // var identifyFile =
      //   path.join(__dirname, '../Monitoring/agent/', 'ip.txt');
      // result = scpSync(
      //   identifyFile,
      //   `root@${servers['checkbox'][0]}:/root/`
      // );
      // if (result.error) {
      //   console.log(result.error);
      //   process.exit(result.status);
      // }

      // console.log(
      //   chalk.blueBright('Copying the ip file to iTrust agent')
      // );
      // var identifyFile =
      //   path.join(__dirname, '../Monitoring/agent/', 'ip.txt');
      // result = scpSync(
      //   identifyFile,
      //   `root@${servers['itrust'][0]}:/root/`
      // );
      // if (result.error) {
      //   console.log(result.error);
      //   process.exit(result.status);
      // }

      console.log(chalk.blueBright('Create ip file on Checkbox agent'));
      result = sshSync(
          `echo ${servers['monitor'][1]} >> ip.txt`,
          `root@${servers['checkbox'][0]}`
      );
      if (result.error) {
          console.log(result.error);
          process.exit(result.status);
      }

      console.log(chalk.blueBright('Create ip file on iTrust agent'));
      result = sshSync(
          `echo ${servers['monitor'][1]} >> ip.txt`,
          `root@${servers['itrust'][0]}`
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
        `root@${servers['itrust'][0]}:/root/`
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
        `root@${servers['itrust'][0]}:/root/`
      );
      if (result.error) {
        console.log(result.error);
        process.exit(result.status);
      }

      console.log(chalk.blueBright('Install ufw on checkbox'));
      result = sshSync(
          `sudo apt-get install ufw && sudo ufw default allow incoming && sudo ufw allow ssh && sudo ufw --force enable`,
          `root@${servers['checkbox'][0]}`
      );
      if (result.error) {
          console.log(result.error);
          process.exit(result.status);
      }

    console.log(chalk.blueBright('Install ufw on itrust'));
      result = sshSync(
          `sudo apt-get install ufw && sudo ufw default allow incoming && sudo ufw allow ssh && sudo ufw --force enable`,
          `root@${servers['itrust'][0]}`
      );
      if (result.error) {
          console.log(result.error);
          process.exit(result.status);
      }

      console.log(chalk.blueBright('npm install'));
      result = sshSync(
          `npm install`,
          `root@${servers['checkbox'][0]}`
      );
      if (result.error) {
          console.log(result.error);
          process.exit(result.status);
      }
  
      console.log(chalk.blueBright('npm install'));
      result = sshSync(
          `npm install`,
          `root@${servers['itrust'][0]}`
      );
      if (result.error) {
          console.log(result.error);
          process.exit(result.status);
      }

      console.log(chalk.blueBright('forever start bin/www'));
      result = sshSync(
          `cd Monitoring/dashboard/ && forever start bin/www`,
          `root@${servers['monitor'][0]}`
      );
      if (result.error) {
          console.log(result.error);
          process.exit(result.status);
      }

      console.log(chalk.blueBright('forever start checkbox agent'));
      result = sshSync(
          `forever start index.js checkbox`,
          `root@${servers['checkbox'][0]}`
      );
      if (result.error) {
          console.log(result.error);
          process.exit(result.status);
      }

      console.log(chalk.blueBright('forever start iTrust agent'));
      result = sshSync(
          `forever start index.js itrust`,
          `root@${servers['itrust'][0]}`
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
