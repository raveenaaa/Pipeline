const child = require('child_process');
const chalk = require('chalk');
const path = require('path');
const os = require('os');
const fs = require('fs');
const yaml = require('js-yaml');

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

try {
  const vars_file = path.join(__dirname, '../pipeline/vars/', 'vars.yml');

  let fileContents = fs.readFileSync(vars_file);
  let data = yaml.safeLoad(fileContents);

  ansible_ip = data.ansible_ip;
} catch (e) {
  console.log(e);
}

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
    `run ansible-srv bionic --ip ${ansible_ip} --sync`.split(' '),
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
  // console.log(chalk.blueBright('Provisioning deploy server...'));
  // result = child.spawnSync(
  //   `bakerx`,
  //   `run deploy-srv bionic --ip 192.168.33.20 --memory 3072`.split(' '),
  //   {
  //     shell: true,
  //     stdio: 'inherit',
  //   }
  // );
  // if (result.error) {
  //   console.log(result.error);
  //   process.exit(result.status);
  // }

  console.log(
    chalk.blueBright('Installing privateKey on configuration server')
  );
  let identifyFile =
    privateKey || path.join(os.homedir(), '.bakerx', 'insecure_private_key');
  result = scpSync(
    identifyFile,
    `vagrant@${ansible_ip}:/home/vagrant/.ssh/deploy_rsa`
  );
  if (result.error) {
    console.log(result.error);
    process.exit(result.status);
  }

  console.log(chalk.blueBright('Copying over ansible.cfg'));
  let cfgFile = path.join('ansible.cfg');
  result = scpSync(cfgFile, `vagrant@${ansible_ip}:/home/vagrant/.ansible.cfg`);
  if (result.error) {
    console.log(result.error);
    process.exit(result.status);
  }

  console.log(chalk.blueBright('Running init script...'));
  result = sshSync(`/bakerx/pipeline/server-init.sh`, `vagrant@${ansible_ip}`);
  if (result.error) {
    console.log(result.error);
    process.exit(result.status);
  }

  result = sshSync(
    `ansible-playbook --vault-password-file vault_pass.txt "/bakerx/pipeline/playbook.yml" -i "/bakerx/pipeline/inventory" -vvvv -e "git_username=${username}" -e "git_password=${password}"`,
    `vagrant@${ansible_ip}`
  );
  if (result.error) {
    console.log(result.error);
    process.exit(result.status);
  }
}
