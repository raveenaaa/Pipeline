#!groovy
import jenkins.model.*
import hudson.security.*
import jenkins.install.InstallState

def instance = Jenkins.getInstance()
def env = System.getenv()

String admin_pwd = env['ADMIN_PASSWORD']

println "--> creating local user 'admin'"
// Create user with custom pass
def user = instance.getSecurityRealm().createAccount('admin', admin_pwd)
user.save()

def strategy = new FullControlOnceLoggedInAuthorizationStrategy()
strategy.setAllowAnonymousRead(false)
instance.setAuthorizationStrategy(strategy)

instance.setInstallState(InstallState.INITIAL_SETUP_COMPLETED)


instance.save()