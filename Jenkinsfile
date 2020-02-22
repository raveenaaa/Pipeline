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
                        sh '''
                        cd server-side/site
                        npm install'''
                        
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
                        sh '''
                        cd server-side/site
                        npm test'''
                  }
            }
      }
      post {
            always {
                  cleanWs()
            }
      }
}