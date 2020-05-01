#!/bin/bash

# Exit on error
set -e

# Trace commands as we run them:
# set -x

# Script used to initialize your ansible server after provisioning.
sudo add-apt-repository ppa:ansible/ansible -y
sudo apt-get update
sudo apt-get install ansible -y
# Ensure security key has proper permissions
chmod 700 ~/.ssh/deploy_rsa
echo "password" | tee vault_pass.txt

# ansible-playbook --vault-password-file vault_pass.txt "/bakerx/pipeline/$1-playbook.yml" -i "/bakerx/pipeline/$2" -vvvv