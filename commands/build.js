const yaml = require('js-yaml');
const fs = require('fs');
const path = require('path');

var password = process.env.ADMIN_PASSWORD || 'admin';
var jenkins_user;
var jenkins_url;

try {
  const vars_file =  path.join(__dirname, "../pipeline/vars/", "vars.yml");

  let fileContents = fs.readFileSync(vars_file);
  let data = yaml.safeLoad(fileContents);

  jenkins_user = data.jenkins_user;
  jenkins_url = data.jenkins_url;
  jenkins_url = jenkins_url.replace('http://', '');
}
catch(e) {
  console.log(e);
}

const jenkins = require("jenkins")({
  baseUrl: `http://${jenkins_user}:${password}@${jenkins_url}`,
  crumbIssuer: true,
  promisify: true
});

exports.command = "build <job>";
exports.desc = "Trigger the build job";

exports.handler = async argv => {
  const { job } = argv;
  (async () => {
    await run(job);
  })();
};

async function getBuildStatus(job, id) {
  return new Promise(async function(resolve, reject) {
    console.log(`Fetching ${job}: ${id}`);
    let result = await jenkins.build.get(job, id);
    resolve(result);
  });
}

async function waitOnQueue(id) {
  return new Promise(function(resolve, reject) {
    jenkins.queue.item(id, function(err, item) {
      if (err) throw err;
      if (item.executable) {
        console.log("number:", item.executable.number);
        resolve(item.executable.number);
      } else if (item.cancelled) {
        console.log("cancelled");
        reject("canceled");
      } else {
        setTimeout(async function() {
          resolve(await waitOnQueue(id));
        }, 5000);
      }
    });
  });
}

async function triggerBuild(job) {
  let queueId = await jenkins.job.build(job);
  let buildId = await waitOnQueue(queueId);
  return buildId;
}

async function run(job) {
  console.log(`Triggering build: ${job}`);
  let buildId = await triggerBuild(job).catch(e => console.log(e));

  console.log(`Received ${buildId}`);
  let build = await getBuildStatus(job, buildId);
  console.log(`Build result: ${build.result}`);

  console.log(`Build output`);
  var log = jenkins.build.logStream(job, buildId);

  log.on("data", function(text) {
    console.log(text);
  });

  log.on("error", function(err) {
    console.log("error", err);
  });

  log.on("end", function() {
    console.log("End of build log.");
  });
}
