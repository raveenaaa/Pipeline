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
                        sh 'sudo cd checkbox.io'
                        sh 'sudo npm install'
                        
                        echo 'Starting mongodb'
                        // sh 'sudo systemctl daemon-reload'
                        // sh 'sudo systemctl start mongod'
                        sh 'sudo service mongod start '
                        
                        echo 'Starting node server'
                        sh 'sudo node server-side/site/server.js'
                  }
            }
            stage('Test'){
                  steps{
                        sh 'sudo npm test'
                  }
            }
      }
      post {
            always {
                  cleanWs()
            }
      }
}