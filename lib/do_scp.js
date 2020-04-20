const path = require('path');
const fs   = require('fs');
const os   = require('os');

const child = require('child_process');

module.exports = function(src, dest) {
    
    let scpArgs = [];
    scpArgs.push(`-o`);
    scpArgs.push(`StrictHostKeyChecking=no`);
    scpArgs.push(`-o`);
    scpArgs.push(`UserKnownHostsFile=/dev/null`);
    scpArgs.push(`-r`);
    scpArgs.push(`"${src}"`);
    scpArgs.push(`"${dest}"`);        
    return child.spawnSync(`scp`, scpArgs, {stdio: 'inherit', shell: true});
}
