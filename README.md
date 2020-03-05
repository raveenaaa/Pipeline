# Pipeline > Build

## Checkpoint Report

A link to the checkpoint report can be found [here](/CHECKPOINT.md).

## Milestone Report

This milestone focused on building a pipeline in Jenkins using Ansible.

#### Instructions to build the pipeline and trigger the build job

Clone the repository. To setup the pipleline, run:

```
pipeline setup
```

Wait for the setup to complete. 

To run the build job we need to supply the admin password which is used in `build.js` to generate the jenkins url. 
* You can do this by setting an environment variable `ADMIN_PWD` in your local environment. If not the code will stick to the default value we have set.

To build the checkbox.io project, run:

```
pipeline build checkbox.io
```

Check the displayed build log to see if the build `PASSED` or `FAILED`.

#### Task 1 - Automatically configure a jenkins server

#### Task 2 - Automatically configure a build environment

In this task we configured the build environment for [checkbox.io](https://github.com/chrisparnin/checkbox.io), a nodejs web application. Checkbox.io has dependencies on nginx, node, and mongodb. All of these were installed using separate ansible roles:

* __[MongoDB-4.2.3](https://docs.mongodb.com/manual/tutorial/install-mongodb-on-ubuntu/)__ : For this we had two options. Installation from Ubuntu Repository or from Mongo's own site repository. We chose the latter since that guarantees us the latest version of MongoDB.
* __Node__: We downloaded the version 12.16.1 which is the latest version
* __Nginx__: We downloaded the version 1.14.0

After installing the dependencies we create a mongo user with a password ad `readWrite` role. The password is secured in the `vars/vars.yml` file using `ansible-vault`

Further we defined the following environment variables:

* `APP_PORT=3002`
* `MONGO_PORT=27017`
* `MONGO_USER=<user>`
* `MONGO_PASSWORD=<pass>`
* `MONGO_IP=localhost`
These were configured using the `blockinfile` module of ansible and the variables were permanently added to `/etc/environment` file

#### Task 3 - Create a build job

- The Ansible module to create a build job, using a Jenkinsfile, uses Jenkins V1 and hence, is discouraged. Instead `jenkins-job-builder` is the prefered way of implementing a build job. This utilizes a DSL that allows to build a pipeline as code.
- While executing `sudo` commands from within a build job in Jenkins, the user `jenkins` needs to have the right privileges. To ensure this, the user has to be added to the sudoers file as `jenkins ALL=(ALL) NOPASSWD: ALL`.
- `jenkins.build.log` prints the current log when it is called and so might not print the entire build log. To achieve this, we have to use `jenkins.build.logStream`. This polls the build job and keeps printing the log until the job finishes.
- Environment variables for mongodb such as `MONGO_USER` and `MONGO_PASSWORD` need to be set before jenkins is installed, to make sure that they are available from within Jenkins. If not, the database connection will fail while trying to do `npm test`.

#### Screencast:
* https://www.youtube.com/watch?v=z7zuAcYShhg&feature=youtu.be
