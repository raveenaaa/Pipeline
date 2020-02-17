#!/bin/bash

# Exit on error
set -e

# Trace commands as we run them:
set -x

# Script used to initialize your ansible server after provisioning.
sudo add-apt-repository ppa:ansible/ansible -y
sudo apt-get update
sudo apt-get install ansible -y
#ansible-galaxy install geerlingguy.java
#ansible-playbook /bakerx/main.yml -i /bakerx/inventory

# Ensure security key has proper permissions
chmod 700 ~/.ssh/jenkins_rsa

