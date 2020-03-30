const sshSync = require("../lib/ssh");

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

function run(c) {
  var result = sshSync(`node mutation_driver.js ${c}`, "vagrant@192.168.33.20");
  if (result.error) {
    console.log(result.error);
    process.exit(result.status);
  }
}