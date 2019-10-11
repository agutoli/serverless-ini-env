const BbPromise = require('bluebird');
const fs = require('fs');
const path = require('path');
const ini = require('ini');
const isObject = require('lodash.isobject');

class ServerlessIniEnv {
  constructor(serverless, options) {
    this.serverless = serverless;
    this.provider = this.serverless.getProvider('aws');

    this.options = options;
    this.options.stage = options.stage || 'dev';
    this.options.region = this.provider.getRegion();

    let inboundSettings = (serverless.service.custom || {})['serverless-ini-env'];

    if (Array.isArray(inboundSettings)) {
      const config = inboundSettings[0];
      if (config.autoload) {
        const configDir = path.join(process.cwd(), `${config.autoload}`);
        const iniFiles = fs.readdirSync(configDir);
        inboundSettings = iniFiles
          .reduce((s, envFile) => {
            const name = envFile.replace('.ini', '');
            s[name] = path.join(config.autoload, envFile);
            return s;
          }, {});
      }
    }

    const defaultSettings = {
      [this.options.stage]: path.join(process.cwd(), `${this.options.stage}.ini`)
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
      'before:offline:start:init': () => BbPromise.bind(this)
        .then(() => this.loadOffLineRefEnvironments()),
      'update-environments:function:init': () => BbPromise.bind(this)
        .then(() => this.updateSingleFunction(this.settings[this.options.stage])),
      'update-environments:init': () => BbPromise.bind(this)
        .then(() => this.updateAllFunctions(this.settings[this.options.stage]))
    };
  }

  async resolveRef(part) {
    if (typeof part === 'string') {
      return part;
    }
    switch (part.Ref) {
      case 'AWS::Region':
        return this.provider.getRegion();
      case 'AWS::AccountId':
        const accountId = await this.provider.getAccountId();
        return this.provider.getAccountId();
      case 'AWS::StackName':
        const stackName = await this.provider.naming.getStackName();
        return stackName
    }
  }

  loadFile(filename) {
    try {
      return fs.readFileSync(filename, 'utf-8');
    } catch (e) {
      this.error(`can not find config file "${filename}"`);
      throw new Error('error');
    }
  }

  formatToSystemEnv(value, key) {
    switch (typeof value) {
      case 'boolean':
      case 'string':
      case 'number':
        return value;
    }
  }

  formatToServerless(value, key) {
    switch (typeof value) {
      case 'boolean':
        this.warn(`InvalidParameterType: [${key}=${value}] environment vars does not support boolean type!`);
        this.warn(`Consider using 1 or 0 ex. ${key}=1 or ${key}=0`);
        return value ? 1 : 0;
      case 'string':
      case 'number':
        return value;
    }
  }

  loadConfigEnvs(filename) {
    const config = ini.parse(this.loadFile(filename));
    const globalEnvs = {};
    for (const key in config) {
      const value = this.formatToServerless(config[key], key);
      if (value) {
        process.env[key] = this.formatToSystemEnv(config[key], key);
        globalEnvs[key] = this.formatToServerless(config[key], key);
      }
    }

    const environments = {};
    let functions = this.getFunctionsName();
    for(let func of functions) {
      environments[func] = { ...globalEnvs };
    }

    for (const key in config) {
      if (typeof config[key] === 'object') {
        const splittedKeys = key.split(',');
        splittedKeys.forEach(keyname => {
          const localVars = Object.assign({}, config[key]);
          for(let localVar in localVars) {
            if ( environments[keyname.trim()] ) {
              process.env[localVar] = this.formatToSystemEnv(localVars[localVar], localVar);
              environments[keyname.trim()][localVar] = this.formatToServerless(localVars[localVar], localVar);
            }
          }
        })
      }
    }
    return environments;
  }

  getFunctionName(ns) {
    const service = this.serverless.service.service;

    return `${service}-${this.options.stage}-${ns}`;
  }

  getFunctionsName() {
    return Object.keys(this.serverless.service.functions);
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
      this.log(`${FunctionName} - Updating environments... OK`);
    } catch (e) {
      this.error(`${FunctionName} - Updating environments... Error`);
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
        this.log(`${FunctionName} - Updating environments... OK`);
      } catch (e) {
        console.log(e.message);
        this.error(`${FunctionName} - Updating environments... Error`);
      }
    }

    return true;
  }

  async listStackResources(resources, nextToken) {
  	resources = resources || [];
  	return this.provider.request("CloudFormation", "listStackResources", { StackName: this.provider.naming.getStackName(), NextToken: nextToken })
  	.then(response => {
  		resources.push.apply(resources, response.StackResourceSummaries);
  		if (response.NextToken) {
  			return listStackResources(resources, response.NextToken);
  		}
  	})
    .catch(err => {
      this.error(`Can not resolve stack name: ${this.provider.naming.getStackName()}`);
      return [];
    })
  	.return(resources);
  }

  async loadOffLineRefEnvironments() {
    const environment = this.serverless.service.provider.environment;

    if (!isObject(environment)) return;

    try {
      const resources = await this.listStackResources();
      for(let key in environment) {
        if ( (isObject(environment[key])) && environment[key].Ref ) {
          const resource = resources.find(x => x.LogicalResourceId == environment[key].Ref);
          environment[key] = resource.PhysicalResourceId;
        } else if (environment[key]["Fn::Join"]) {
          const delimiter = environment[key]["Fn::Join"][0];
					const parts = environment[key]["Fn::Join"][1];
          const resolved = [];
          for (let x of parts) {
            const _ref = await this.resolveRef(x);
            resolved.push(_ref);
          }
          environment[key] = resolved.join(delimiter);
        }
      }
    } catch(e) {
      this.error(`error: ${e}`);
    }
  }

  async loadEnvironments(filename) {
    const config = this.loadConfigEnvs(filename);
    for (const ns in config) {
      const envs = this.mergeConfig(ns, config);
      const counts = Object.keys(envs).length;

      this.log(`function.${ns} - loading environments... (${counts} ${counts === 1 ? 'var' : 'vars'})`);

      if (!this.serverless.service.functions[ns]) {
        this.error(`function.${ns} does not exists!`);
        return;
      }

      this.serverless.service.functions[ns].environment = envs;
    }

    setTimeout(() => {
      this.log(`config: "${filename}", stage: ${this.options.stage}`);
    }, 3000);

    return true;
  }

  log(text) {
    this.serverless.cli.log(text, '[IniEnv]');
  }

  error(text) {
    this.serverless.cli.log(text, '[IniEnv]', { color: 'red' });
  }

  warn(text) {
    this.serverless.cli.log(text, '[IniEnv]', { color: 'orange' });
  }
}

module.exports = ServerlessIniEnv;
