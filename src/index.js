const BbPromise = require('bluebird');
const fs = require('fs')
const path = require('path')
const ini = require('ini')

class ServerlessIniEnv {
  constructor(serverless, options) {
    this.serverless = serverless
    this.provider = this.serverless.getProvider('aws');
    this.options = options

    this.options.stage = options.stage || 'dev';
    this.options.region = this.provider.getRegion();

    const inboundSettings = (serverless.service.custom || {})['serverless-ini-env']

    const defaultSettings = {
      [this.options.stage]: path.join(process.env.PWD, `${this.options.stage}.ini`)
    }

    this.settings = Object.assign({}, defaultSettings, inboundSettings)

    this.commands = {
      'update-environments': {
        usage: 'Update all lambda environments',
        lifecycleEvents: ['update-environments', 'init'],
        options: {
          stage: {
            usage: 'Stage of the service',
            shortcut: 's',
          },
          function: {
            usage: 'Update a single function environments vars',
            shortcut: 'f',
          },
        },
        commands: {
          function: {
            usage: 'Update a single function environments vars',
            lifecycleEvents: [
              'init',
              'end'
            ],
            options: {
              function: {
                usage: 'Name of the function',
                shortcut: 'f'
              },
            }
          }
        }
      },
    };

    this.loadEnvironments(this.settings[this.options.stage])

    this.hooks = {
      'update-environments:function:init': () => BbPromise.bind(this).then(() => {
        return this.updateSingleFunction(this.settings[this.options.stage])
      }),
      'update-environments:init': () => BbPromise.bind(this).then(() => {
        return this.updateAllFunctions(this.settings[this.options.stage])
      })
    }
  }

  loadFile(filename) {
    try {
      return fs.readFileSync(filename, 'utf-8')
    } catch(e) {
      this.serverless.cli.log(`can not find config file "${filename}"`)
      throw new Error("error")
    }
  }

  loadConfigEnvs(filename) {
    const config = ini.parse(this.loadFile(filename))

    let globalEnvs = {}
    for (let key in config) {
      if (typeof config[key] === 'string') {
        globalEnvs[key] = config[key]
      }
    }

    let environments = {}
    for (let key in config) {
      if (typeof config[key] != 'string') {
        environments[key] = {...globalEnvs, ...config[key] }
      }
    }

    return environments
  }

  getFunctionName(ns) {
    const service = this.serverless.service.service
    return `${service}-${this.options.stage}-${ns}`
  }

  mergeConfig(ns, config) {
    const environment = ((this.serverless.service.functions[ns] || {}).environment || {})
    return Object.assign({}, environment, config[ns])
  }

  async updateSingleFunction(filename) {
    const config = this.loadConfigEnvs(filename)
    const FunctionName = this.getFunctionName(this.options.f)

    const params = {
      FunctionName,
      Environment: {
        Variables: this.mergeConfig(this.options.f, config)
      }
    };

    try {
      await this.provider.request('Lambda', 'updateFunctionConfiguration', params)
      this.serverless.cli.log(`[${FunctionName}] - Updating environments... OK`)
    } catch(e) {
      console.error(e)
      this.serverless.cli.log(`[${FunctionName}] - Updating environments... Error`)
    }

    return true
  }

  async updateAllFunctions(filename) {
    const config = this.loadConfigEnvs(filename)

    for(let ns in config) {
      const FunctionName = this.getFunctionName(ns)
      const params = {
        FunctionName,
        Environment: {
          Variables: this.mergeConfig(ns, config)
        }
      };
      try {
        await this.provider.request('Lambda', 'updateFunctionConfiguration', params)
        this.serverless.cli.log(`[${FunctionName}] - Updating environments... OK`)
      } catch(e) {
        console.error(e)
        this.serverless.cli.log(`[${FunctionName}] - Updating environments... Error`)
      }
    }

    return true
  }

  async loadEnvironments(filename) {
    const config = this.loadConfigEnvs(filename)

    for (let ns in config) {
      const envs = this.mergeConfig(ns, config)
      const counts = Object.keys(envs).length
      this.serverless.cli.log(`[${ns}] - loading environments... (${counts} ${counts === 1? 'var': 'vars'})`)

      if (!this.serverless.service.functions[ns]) {
        throw new Error(`function ${ns} does not exists!`)
      }

      this.serverless.service.functions[ns].environment = envs
    }

    setTimeout(() => {
      this.serverless.cli.log(`IniEnv config: "${filename}", stage: ${this.options.stage}`)
    }, 3000)

    return true
  }
}

module.exports = ServerlessIniEnv;
