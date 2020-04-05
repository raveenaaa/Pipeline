#!/bin/bash

cd iTrust2-v6/iTrust2/src/main/java/
cp db.properties.template db.properties
sed 's/password  /password password/g' db.properties > new && mv new db.properties
cp email.properties.template email.properties
sed 's/from /from csc519s20.11@gmail.com/g;s/username /username csc519s20.11/g;s/password /password devops11/g' email.properties > new && mv new email.properties