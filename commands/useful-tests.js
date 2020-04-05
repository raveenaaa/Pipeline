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
  // Delete any previous copies of iTrust if they exist
  console.log(chalk.keyword('orange')('Deleting targets folder if it exists...'));
  let result = await sshSync('cd iTrust2-v6/iTrust2/ && mvn clean', 'vagrant@192.168.33.20');

  console.log(chalk.keyword('orange')('Deleting any previous copies of iTrust2 if exists...'));
  result = await sshSync('rm -rf iTrust2-v6/', 'vagrant@192.168.33.20');

  // Clone a fresh copy of the iTrust repository
  console.log(chalk.keyword('orange')('Cloning the iTrust repository...'));
  result = await sshSync(`rm -f iTrust2-v6/.git/index.lock ; git clone https://$GIT_USERNAME:$GIT_PASSWORD@github.ncsu.edu/engr-csc326-staff/iTrust2-v6.git`, 'vagrant@192.168.33.20');
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