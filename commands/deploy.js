const child = require('child_process');
const chalk = require('chalk');
const path = require('path');
const os = require('os');

const scpSync = require('../lib/scp');
const sshSync = require('../lib/ssh');

exports.command = 'deploy <projectName>';
exports.desc = 'Deploy the projects';
exports.builder = (yargs) => {
  yargs.options({
    projectName: {
      describe: 'Name of the project to be deployed',
      type: 'string',
    },
    i: {
      describe: 'Inventory file',
      type: 'string',
    },
  });
};

exports.handler = async (argv) => {
  const { projectName } = argv;
  const inventoryFile = encodeURIComponent(argv['i']);

  (async () => {
    await run(projectName, inventoryFile);
  })();
};

async function run(projectName, inventoryFile) {
  // console.log(chalk.greenBright('Installing configuration server!'));

  // console.log(chalk.blueBright('Provisioning configuration server...'));
  // let result = child.spawnSync(
  //   `bakerx`,
  //   `run ansible-srv bionic --ip 192.168.33.10 --sync`.split(' '),
  //   { shell: true, stdio: 'inherit' }
  // );
  // if (result.error) {
  //   console.log(result.error);
  //   process.exit(result.status);
  // }

  // // Temporarily setup a deploy server until the provisioning step is done
  // console.log(chalk.blueBright('Provisioning deploy server...'));
  // result = child.spawnSync(
  //   `bakerx`,
  //   `run deploy-srv bionic --ip 192.168.33.20 --memory 3072`.split(' '),
  //   { shell: true, stdio: 'inherit' }
  // );
  // if (result.error) {
  //   console.log(result.error);
  //   process.exit(result.status);
  // }

  // console.log(
  //   chalk.blueBright('Installing privateKey on configuration server')
  // );
  // let identifyFile = path.join(os.homedir(), '.bakerx', 'insecure_private_key');
  // result = scpSync(
  //   identifyFile,
  //   'vagrant@192.168.33.10:/home/vagrant/.ssh/deploy_rsa'
  // );
  // if (result.error) {
  //   console.log(result.error);
  //   process.exit(result.status);
  // }

  result = sshSync(
    `ansible-playbook --vault-password-file vault_pass.txt "/bakerx/pipeline/${projectName}-playbook.yml" -i "/bakerx/pipeline/${inventoryFile}" -vvvv`,
    'vagrant@192.168.33.10'
  );
  if (result.error) {
    console.log(result.error);
    process.exit(result.status);
  }
}
