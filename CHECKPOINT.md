# Checkpoint Report

## Checkpoint 1

![](/images/checkpoint1.JPG)

For this checkpoint, the 3 general tasks were assigned as follows:

#### Automatically configure a jenkins server - Rohit

Completed the following tasks:

- Provision a configuration server (`ansible-srv`) and a build server (`jenkins-srv`).
- Install Jenkins on `jenkins-srv`.

For the next milestone:

- Handle authentication.
- Install the required plugins on `jenkins-srv`.

#### Automatically configure a build environment for a node web application (checkbox.io) - Raveena

Completed the following tasks:

- Install mongodb and nodejs.
- Create mongo user with password and `readWrite` role.
- Define `APP_PORT=3002`,`MONGO_PORT=27012`, `MONGO_USER=<user>`, `MONGO_PASSWORD=<pass>`, and `MONGO_IP=localhost`.

For the next milestone:

- Secure passwords using Ansible Vault.

#### Create a build job - Zachariah

Completed the following tasks:

- Create a Jenkinsfile to configure the build stages and steps.

For the next milestone:

- Setup a jenkins build job using the Jenkinsfile.
- Create the `build` command that will trigger the build job.
