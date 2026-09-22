pipeline {
    agent {
        node {
            label '2.5_nodejs-20.9.0_cypress-13.6.3_jdk-17.0.9'
        }
    }

    options {
        buildDiscarder(logRotator(numToKeepStr: '10'))
        disableConcurrentBuilds()
    }

    parameters {
        booleanParam(name: 'execDockerBuild', defaultValue: true, description: 'Enable docker packaging on Artifactory')
        booleanParam(name: 'execDeploy',      defaultValue: true, description: 'Enable HELM deployment on AFTER')
        choice(name: 'targetEnv', choices: ['val', 'prod'], description: 'Choose the target environment')
    }

    environment {
        EXEC_DOCKER_BUILD   = "${params.execDockerBuild}"
        EXEC_DEPLOY         = "${params.execDeploy}"

        TARGET_ENV          = "${params.targetEnv ?: 'val'}"

        APP_NAME            = "app-dashboard"
		AFTER_APP_NAMESPACE = "7dae-atom-${TARGET_ENV}"

        ARTIFACTORY_HOST    = "r-2k77-devops-docker-releases-local.artifactory.fr.eu.airbus.corp"
        NPMRC_PATH          = 'config/.npmrc'

        BASE_HREF               = "/atom-app-dashboard"
        ATOM_API_URL_VAL        = "https://gateway-val.after-val.eu.airbus.corp/atom-synchronizer-val"
        ATOM_API_URL_PROD       = "https://gateway2.after.eu.airbus.corp/atom-synchronizer-prod"
    }

    stages {

        stage('System & Environment Check') {
            steps {
                sh '''
                    echo "=========================== SYSTEM & ENVIRONMENT INFO ==========================="
                    uname -a
                    cat /etc/os-release || true
                    echo "\\n[Node.js]" ; node -v || echo "Node.js not installed"
                    echo "\\n[NPM]"     ; npm -v  || echo "NPM not installed"
                    echo "\\n[Disk]"    ; df -h /
                    echo "\\n[Memory]"  ; free -h || echo "Memory info not available"
                    echo "================================================================================="
                '''
            }
        }

       stage('Initialize & Configure Workspace') {
			steps {
				// On ne récupère qu'un seul pack de credentials
				withCredentials([
					usernamePassword(
						credentialsId: 'artifactory-atom-credentials', 
						usernameVariable: 'ARTIFACTORY_USERNAME', 
						passwordVariable: 'ARTIFACTORY_PASSWORD' // On utilisera ceci comme token
					)
				]) {
					script {
						// Lecture de la version (comme avant)
						def packageJson = readJSON file: 'package.json'
						env.PROJECT_VERSION = packageJson.version
						
						// On prépare le contenu du .npmrc
						if (fileExists(env.NPMRC_PATH)) {
							def npmrcContent = readFile(env.NPMRC_PATH)
								// On utilise ARTIFACTORY_PASSWORD pour remplacer le token NPM
								.replace('${AIRBUS_NPM_VIRTUAL_TOKEN}', env.ARTIFACTORY_PASSWORD)
							
							writeFile(file: '.npmrc', text: npmrcContent)
							echo "Updated .npmrc using password/API key from artifactory-atom-credentials"
						}
                        
						
						// On définit les variables pour les étapes suivantes (Docker/Helm)
						env.FULL_IMAGE_NAME = "${env.ARTIFACTORY_HOST}/transversal/${env.APP_NAME}:${env.PROJECT_VERSION}"
					}
				}
			}
		}

        stage('NPM Install') {
            steps {
                sh 'rm -rf package-lock.json'
                sh 'npm install'
            }
        }

        stage('Build') {
            steps {
                script {
                    def atomApiUrl = TARGET_ENV == 'prod' ? ATOM_API_URL_PROD : ATOM_API_URL_VAL
                    sh "BASE_HREF=${BASE_HREF} NEXT_PUBLIC_BASE_HREF=${BASE_HREF} NEXT_PUBLIC_ATOM_API_BASE_URL=${atomApiUrl} npm run build"
                }
                echo "Stashing static export and Docker config for packaging..."
                stash includes: 'out/**,Dockerfile,deployment/nginx/nginx.conf,deployment/nginx/nginx-custom.conf', name: 'next-build'
            }
        }

        stage("Docker Image") {
            when { expression { return EXEC_DOCKER_BUILD == "true" } }
            agent { node '2.4_dind-20.10.14' }

            steps {
                withCredentials([
					usernamePassword(
						credentialsId: 'artifactory-atom-credentials', 
						usernameVariable: 'ARTIFACTORY_USERNAME', 
						passwordVariable: 'ARTIFACTORY_PASSWORD'
					)
				]) {
                    script {
                        // out/ (static export) + Dockerfile/nginx configs (from checkout)
                        unstash 'next-build'
                        echo "Building Image: ${env.FULL_IMAGE_NAME}"
                        sh "docker build --rm -t ${env.FULL_IMAGE_NAME} ."
                        echo "Pushing Image..."
                        sh "docker image push ${env.FULL_IMAGE_NAME}"
                    }
                }
            }
            post { always { cleanWs() } }
        }

        stage("Helm Deploy on AFTER") {
            when { expression { return EXEC_DEPLOY == "true" } }
            agent { node "2.4_helm-3.8.2" }
            environment {
                KUBECONFIG = credentials("atom-after-credentials-${TARGET_ENV}")
            }
            steps {
                sh "git config --global http.sslVerify false"
                checkout scm
                dir("deployment") {
                    sh "helm repo update"
                    echo "Deploying ${APP_NAME} to namespace: ${AFTER_APP_NAMESPACE} using values-${TARGET_ENV}.yaml with tag: ${env.PROJECT_VERSION}"
                    sh """
                        helm upgrade ${APP_NAME} ./helm \
                        --values ./values-${TARGET_ENV}.yaml \
                        --set app.image.name=${env.ARTIFACTORY_HOST}/transversal/${env.APP_NAME} \
                        --set app.image.tag=${env.PROJECT_VERSION} \
                        --kubeconfig=${KUBECONFIG} \
                        --namespace ${AFTER_APP_NAMESPACE} \
                        --kubeconfig=${KUBECONFIG} \
                        --wait \
                        --atomic \
                        --install
                    """
                    echo "Helm chart deployed successfully."
                }
            }
            post { always { cleanWs() } }
        }
    }

    post {
        always { cleanWs() }
    }
}
