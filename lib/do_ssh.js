const path = require('path');
const os   = require('os');

const child = require('child_process');

module.exports = function(cmd, host) {
    let sshArgs = [];
    sshArgs.push(`-o`);
    sshArgs.push(`StrictHostKeyChecking=no`);
    sshArgs.push(`-o`);
    sshArgs.push(`UserKnownHostsFile=/dev/null`);
    sshArgs.push(host);
    sshArgs.push(`"${cmd}"`);

    return child.spawnSync(`ssh`, sshArgs, {stdio: 'inherit', shell: true});
}
