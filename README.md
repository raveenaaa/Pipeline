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

Wait for the setup to complete. To build the checkbox.io project, run:

```
pipeline build checkbox.io
```

Check the displayed build log to see if the build `PASSED` or `FAILED`.

#### Task 1 - Automatically configure a jenkins server

#### Task 2 - Automatically configure a build environment

#### Task 3 - Create a build job

- The Ansible module to create a build job, using a Jenkinsfile, uses Jenkins V1 and hence, is discouraged. Instead `jenkins-job-builder` is the prefered way of implementing a build job. This utilizes a DSL that allows to build a pipeline as code.
- While executing `sudo` commands from within a build job in Jenkins, the user `jenkins` needs to have the right privileges. To ensure this, the user has to be added to the sudoers file as `jenkins ALL=(ALL) NOPASSWD: ALL`.
- `jenkins.build.log` prints the current log when it is called and so might not print the entire build log. To achieve this, we have to use `jenkins.build.logStream`. This polls the build job and keeps printing the log until the job finishes.
- Environment variables for mongodb such as `MONGO_USER` and `MONGO_PASSWORD` need to be set before jenkins is installed, to make sure that they are available from within Jenkins. If not, the database connection will fail while trying to do `npm test`.
