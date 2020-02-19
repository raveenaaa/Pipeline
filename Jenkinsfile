pipeline {
      agent any
      stages {
            stage('Source'){
                  git 'clone https://github.com/chrisparnin/checkbox.io'
            }
            stage('Build'){
                  steps{
                        echo 'Installing node modules'
                        sh 'cd checkbox.io'
                        sh 'npm install'
                        
                        echo 'Starting mongodb'
                        // sh 'sudo systemctl daemon-reload'
                        // sh 'sudo systemctl start mongod'
                        sh 'sudo service mongod start '
                        
                        echo 'Starting node server'
                        sh 'node server-side/site/server.js'
                  }
            }
            stage('Test'){
                  steps{
                        sh 'npm test'
                  }
            }
      }
      post {
            always {
                  cleanWs()
            }
      }
}