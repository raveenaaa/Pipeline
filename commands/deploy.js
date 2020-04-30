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
  result = sshSync(
    `ansible-playbook --vault-password-file vault_pass.txt "/bakerx/pipeline/${projectName}-playbook.yml" -i "/bakerx/pipeline/${inventoryFile}" -vvvv`,
    'vagrant@192.168.33.10'
  );
  if (result.error) {
    console.log(result.error);
    process.exit(result.status);
  }
}
