const BbPromise = require('bluebird');
const fs = require('fs');
const path = require('path');
const ini = require('ini');

class ServerlessIniEnv {
  constructor(serverless, options) {
    this.serverless = serverless;
    this.provider = this.serverless.getProvider('aws');

    this.options = options;
    this.options.stage = options.stage || 'dev';
    this.options.region = this.provider.getRegion();

    const inboundSettings = (serverless.service.custom || {})['serverless-ini-env'];

    const defaultSettings = {
      [this.options.stage]: path.join(process.env.PWD, `${this.options.stage}.ini`)
    };

    this.settings = Object.assign({}, defaultSettings, inboundSettings);

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

    this.loadEnvironments(this.settings[this.options.stage]);

    this.hooks = {
      'update-environments:function:init': () => BbPromise.bind(this)
        .then(() => this.updateSingleFunction(this.settings[this.options.stage])),
      'update-environments:init': () => BbPromise.bind(this)
        .then(() => this.updateAllFunctions(this.settings[this.options.stage]))
    };
  }

  loadFile(filename) {
    try {
      return fs.readFileSync(filename, 'utf-8');
    } catch (e) {
      this.serverless.cli.log(`can not find config file "${filename}"`);
      throw new Error('error');
    }
  }

  loadConfigEnvs(filename) {
    const config = ini.parse(this.loadFile(filename));

    const globalEnvs = {};
    for (const key in config) {
      switch (typeof config[key]) {
        case 'boolean':
          this.serverless.cli.log(`InvalidParameterType: [${key}=${config[key]}] environment vars does not support boolean type!`);
          this.serverless.cli.log(`Consider using 1 or 0 ex. ${key}=1 or ${key}=0`);
          process.exit(1);
          break;
        case 'string':
        case 'number':
          globalEnvs[key] = config[key];
          break;
      }
    }

    const environments = {};
    for (const key in config) {
      if (typeof config[key] === 'object') {
        environments[key] = { ...globalEnvs, ...config[key] };
      }
    }
    console.log(environments);
    return environments;
  }

  getFunctionName(ns) {
    const service = this.serverless.service.service;

    return `${service}-${this.options.stage}-${ns}`;
  }

  mergeConfig(ns, config) {
    const environment = ((this.serverless.service.functions[ns] || {}).environment || {});

    return Object.assign({}, environment, config[ns]);
  }

  async updateSingleFunction(filename) {
    const config = this.loadConfigEnvs(filename);
    const FunctionName = this.getFunctionName(this.options.f);

    const params = {
      FunctionName,
      Environment: {
        Variables: this.mergeConfig(this.options.f, config)
      }
    };

    try {
      await this.provider.request('Lambda', 'updateFunctionConfiguration', params);
      this.serverless.cli.log(`[${FunctionName}] - Updating environments... OK`);
    } catch (e) {
      this.serverless.cli.log(`[${FunctionName}] - Updating environments... Error`);
    }

    return true;
  }

  async updateAllFunctions(filename) {
    const config = this.loadConfigEnvs(filename);

    for (const ns in config) {
      const FunctionName = this.getFunctionName(ns);
      const params = {
        FunctionName,
        Environment: {
          Variables: this.mergeConfig(ns, config)
        }
      };

      try {
        await this.provider.request('Lambda', 'updateFunctionConfiguration', params);
        this.serverless.cli.log(`[${FunctionName}] - Updating environments... OK`);
      } catch (e) {
        console.log(e.message);
        this.serverless.cli.log(`[${FunctionName}] - Updating environments... Error`);
      }
    }

    return true;
  }

  async loadEnvironments(filename) {
    const config = this.loadConfigEnvs(filename);

    for (const ns in config) {
      const envs = this.mergeConfig(ns, config);
      const counts = Object.keys(envs).length;

      this.serverless.cli.log(`[${ns}] - loading environments... (${counts} ${counts === 1 ? 'var' : 'vars'})`);

      if (!this.serverless.service.functions[ns]) {
        throw new Error(`function ${ns} does not exists!`);
      }

      this.serverless.service.functions[ns].environment = envs;
    }

    setTimeout(() => {
      this.serverless.cli.log(`IniEnv config: "${filename}", stage: ${this.options.stage}`);
    }, 3000);

    return true;
  }
}

module.exports = ServerlessIniEnv;
