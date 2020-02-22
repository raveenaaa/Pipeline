pipeline {
      agent any
      stages {
            stage('Source'){
                  steps{
                        git 'https://github.com/chrisparnin/checkbox.io'
                  }
            }
            stage('Build'){
                  steps{
                        echo 'Installing node modules'
                        sh 'ls -la'
                        // sh 'cd checkbox.io'
                        sh 'npm install'
                        
                        echo 'Starting mongodb'
                        // sh 'sudo systemctl daemon-reload'
                        // sh 'sudo systemctl start mongod'
                        sh 'service mongod start '
                        
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