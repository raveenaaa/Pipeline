# Pipeline > Build

## Checkpoint Report

A link to Milestone 1 checkpoint report can be found [here](/CHECKPOINT.md).  
A link to Milestone 2 checkpoint report can be found [here](/CHECKPOINT-M2.md).

## Milestone 1 Report

This milestone focused on building a pipeline in Jenkins using Ansible.

#### Instructions to build the pipeline and trigger the build job

Clone the repository. To setup the pipleline, run:

```
pipeline setup
```

Wait for the setup to complete.

To run the build job we need to supply the admin password which is used in `build.js` to generate the jenkins url.

- You can do this by setting an environment variable `ADMIN_PWD` in your local environment. If not the code will stick to the default value we have set.

To build the checkbox.io project, run:

```
pipeline build checkbox.io
```

Check the displayed build log to see if the build `PASSED` or `FAILED`.

#### Task 1 - Automatically configure a jenkins server

- In this task, a Jenkins server was configured completely using Ansible and the plugins required for building the pipeline were installed.
- A groovy script was created to turn off the initial jenkins setup wizard and automatically create a user for authentication. An attempt to do this task by just setting the line `JAVA_ARGS="-Djenkins.install.runSetupWizard=false"` in the jenkins file did not succeed. A task to restart the Jenkins server was included for allowing the changes to be applied.
- For the installation of plugins, a retry property was added in the ansible task to avoid possible failure due to trivial issues.
- The following plugins were installed to facilitate the build process:

  - Build Pipeline (build-pipeline-plugin)
  - Git (git)
  - Workspace Cleanup (ws-cleanup)
  - Pipeline (workflow-aggregator)

#### Task 2 - Automatically configure a build environment

In this task we configured the build environment for [checkbox.io](https://github.com/chrisparnin/checkbox.io), a nodejs web application. Checkbox.io has dependencies on nginx, node, and mongodb. All of these were installed using separate ansible roles:

- **[MongoDB-4.2.3](https://docs.mongodb.com/manual/tutorial/install-mongodb-on-ubuntu/)** : For this we had two options. Installation from Ubuntu Repository or from Mongo's own site repository. We chose the latter since that guarantees us the latest version of MongoDB.
- **Node**: We downloaded the version 12.16.1 which is the latest version
- **Nginx**: We downloaded the version 1.14.0

After installing the dependencies we create a mongo user with a password and `readWrite` role. The password is secured in the `vars/vars.yml` file using `ansible-vault`

Further we defined the following environment variables:

- `APP_PORT=3002`
- `MONGO_PORT=27017`
- `MONGO_USER=<user>`
- `MONGO_PASSWORD=<pass>`
- `MONGO_IP=localhost`

These were configured using the `blockinfile` module of ansible and the variables were permanently added to `/etc/environment` file

#### Task 3 - Create a build job

- The Ansible module to create a build job, using a Jenkinsfile, uses Jenkins V1 and hence, is discouraged. Instead `jenkins-job-builder` is the prefered way of implementing a build job. This utilizes a DSL that allows to build a pipeline as code.
- While executing `sudo` commands from within a build job in Jenkins, the user `jenkins` needs to have the right privileges. To ensure this, the user has to be added to the sudoers file as `jenkins ALL=(ALL) NOPASSWD: ALL`.
- `jenkins.build.log` prints the current log when it is called and so might not print the entire build log. To achieve this, we have to use `jenkins.build.logStream`. This polls the build job and keeps printing the log until the job finishes.
- Environment variables for mongodb such as `MONGO_USER` and `MONGO_PASSWORD` need to be set before jenkins is installed, to make sure that they are available from within Jenkins. If not, the database connection will fail while trying to do `npm test`.

#### Screencast:

The screencast for Milestone 1 can be founf [here](https://www.youtube.com/watch?v=z7zuAcYShhg&feature=youtu.be).

## Milestone 2 Report

This milestone focused on building the iTrust pipeline in Jenkins using Ansible, static code analysis and implementing a test suite analysis for detecting useful tests.

#### Task 1 - 🛠️ Automatically configure a build environment and build job (iTrust)

- The `ansible-srv` from Milestone 1 was used to setup the build environment for iTrust on the `jenkins-srv`.
  - Installed the follwoing:
    - maven
    - mysql
    - google chrome
    - cloudbees-credentials plugin
    - credentials-binding plugin
  - Change timezone to America/New_York for the tests to run
  - Added new arguments `--gh-user` and `--gh-pass` to the `pipeline setup` command
- Created a build job for iTrust
  - Update Jenkins `JAVA_ARGS` to exclude the web session check for crumb validation
  - Add git credentials to Jenkins Credentials Store that is used to clone the iTrust repo
  - Create a build job to build iTrust and run the various tests
- Hid all secrets

To setup the pipeline run,

```
pipeline setup --gh-user <username> --gh-pass <password>
```

and to trigger the build job run,

```
pipeline build iTrust
```

#### Task 2 - 🧪 Implement a test suite analysis for detecting useful tests

##### Fuzzer
We developed a fuzzer that performs the following fuzzing operations on 10% lines of a given file:

   - swap "==" with "!="
   - swap 0 with 1
   - change content of "strings" in code.
   - randomly change numbers in code
   - swap "<" with ">"
   - swap true with false

##### Test prioritization analysis

We used a driver node.js code that runs the entire test suite for 100 iterations and generates the report. In each iteration it does the following tasks for up to 10% of the files:

* Drop exisiting database
* Regenerate the test classes using `mvn -f pom-data.xml process-test-classes`
* Generate random changes with fuzzer.
* If changes result in compile failures, discard changes and restart process.
* Run tests with `mvn clean test verify`.
* Record which test cases have failed, and which have passed.
* Reset code, discarding your changes.

After 100 iterations, it generates a [report](https://github.ncsu.edu/cscdevops-spring2020/DEVOPS-11/blob/master/pipeline/report.txt). The format of the report is as follows:
```
<Classname>:<Testname> => Passed: _ Failed: _ Total: _
```

#### Task 3 - ✅ Implement a static analysis for checkbox.io

In this task, we implement a static JavaScript code analyzer using esprima. The static analysis is performed on all the javascript files present inside checkbox.io. The analyzer is implemented to detect the following code smells:
- Long Methods (LOC > 100)
- Long Message Chains (Chain length > 10)
- Max Nesting Depth (Depth > 5)

The jenkins build job for checkbox.io was extended to include a static analysis stage. In the build job, the analyzer is run across all the JS files and if any of the code smells are detected, the build will automatically fail.

#### Screencast:

The screencast for Milestone 2 can be found [here](https://youtu.be/8NVG1skrCVQ).
