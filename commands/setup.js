const child = require('child_process');
const chalk = require('chalk');
const path = require('path');
const os = require('os');

const scpSync = require('../lib/scp');
const sshSync = require('../lib/ssh');

exports.command = 'setup';
exports.desc = 'Provision and configure the configuration server';
exports.builder = (yargs) => {
  yargs.options({
    privateKey: {
      describe: 'Install the provided private key on the configuration server',
      type: 'string',
    },
    'gh-user': {
      describe: 'GitHub username',
      type: 'string',
    },
    'gh-pass': {
      describe: 'GitHub password',
      type: 'string',
    },
  });
};

exports.handler = async (argv) => {
  const { privateKey } = argv;
  const username = encodeURIComponent(argv['gh-user']);
  const password = encodeURIComponent(argv['gh-pass']);

  (async () => {
    await run(privateKey, username, password);
  })();
};

async function run(privateKey, username, password) {
  console.log(chalk.greenBright('Installing configuration server!'));

  console.log(chalk.blueBright('Provisioning configuration server...'));
  let result = child.spawnSync(
    `bakerx`,
    `run ansible-srv bionic --ip 192.168.33.10 --sync`.split(' '),
    {
      shell: true,
      stdio: 'inherit',
    }
  );
  if (result.error) {
    console.log(result.error);
    process.exit(result.status);
  }

  // Temporarily setup a deploy server until the provisioning step is done
  console.log(chalk.blueBright('Provisioning deploy server...'));
  result = child.spawnSync(
    `bakerx`,
    `run deploy-srv bionic --ip 192.168.33.20 --memory 3072`.split(' '),
    { shell: true, stdio: 'inherit' }
  );
  if (result.error) {
    console.log(result.error);
    process.exit(result.status);
  }

  console.log(
    chalk.blueBright('Installing privateKey on configuration server')
  );
  let identifyFile =
    privateKey || path.join(os.homedir(), '.bakerx', 'insecure_private_key');
  result = scpSync(
    identifyFile,
    'vagrant@192.168.33.10:/home/vagrant/.ssh/deploy_rsa'
  );
  if (result.error) {
    console.log(result.error);
    process.exit(result.status);
  }

  console.log(chalk.blueBright('Running init script...'));
  result = sshSync(
    `/bakerx/pipeline/server-init.sh ${username} ${password}`,
    'vagrant@192.168.33.10'
  );
  if (result.error) {
    console.log(result.error);
    process.exit(result.status);
  }
}
