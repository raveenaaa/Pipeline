const sshSync = require("../lib/ssh");
const chalk = require("chalk");

exports.command = "useful-tests";
exports.desc = "Provision and configure the configuration server";
exports.builder = yargs => {
  yargs.options({
    count: {
      alias: 'c',
      describe: "Number of iterations to run the tests",
      type: "number",
      default: 100
    }
  });
};

exports.handler = async argv => {
    const { c } = argv;
  
    (async () => {
      await run(c);
    })();
  };

async function run(c) {
  // Check for any running git process and delete;
  console.log(chalk.keyword('orange')('Delete any git processes...'));
  let result = await sshSync(`rm -f iTrust2-v6/.git/index.lock`, 'vagrant@192.168.33.20');
  result = await sshSync(`rm -f iTrust2-v6/.git/head.lock`, 'vagrant@192.168.33.20');
  if (result.error) {
    console.log(result.error);
    process.exit(result.status);
  }

  // Clone a fresh copy of the iTrust repository
  console.log(chalk.keyword('orange')('Cloning the iTrust repository...'));
  result = await sshSync(`git clone https://$GIT_USERNAME:$GIT_PASSWORD@github.ncsu.edu/engr-csc326-staff/iTrust2-v6.git`, 'vagrant@192.168.33.20');
  if (result.error) {
    console.log(result.error);
    process.exit(result.status);
  }
 
  // Configure the iTrust repository, email.properties and db.properties
  console.log(chalk.keyword('orange')('Changing email and db properties...'));
  result = await sshSync('./email-db-config.sh', "vagrant@192.168.33.20");
  if (result.error) {
    console.log(result.error);
    process.exit(result.status);
  }

  // Running the test suite analysis
  console.log(chalk.keyword('orange')('Running the test suite'));
  result = await sshSync(`node mutation_driver.js ${c}`, "vagrant@192.168.33.20");
  if (result.error) {
    console.log(result.error);
    process.exit(result.status);
  }
}