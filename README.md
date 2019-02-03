# serverless-ini-env
[![serverless](http://public.serverless.com/badges/v3.svg)](http://www.serverless.com)
[![Issues](https://img.shields.io/github/issues/agutoli/serverless-ini-env.svg)](https://github.com/agutoli/serverless-ini-env/issues) [![License](https://img.shields.io/badge/license-MIT-blue.svg)](https://www.npmjs.com/package/serverless-ini-env)
[![NPM](https://img.shields.io/npm/v/serverless-ini-env.svg)](https://www.npmjs.com/package/serverless-ini-env)

## Install

`npm install -D serverless-ini-env`

Add the plugin to your `serverless.yml` file:

```yaml
plugins:
  - serverless-ini-env
```

## Configuration
```yaml
custom:
  serverless-ini-env:
    dev: "./you_configs/dev.ini"
    prod: "./you_configs/prod.ini"
```

`Note:` If you not specify any configuration, plugins will consider root folder and stage options ex.

`sls deploy --stage qa` -> `./qa.ini`
`sls deploy --stage dev` -> `./dev.ini`

## Ini File example

`./you_configs/dev.ini`

```ini
# will be available for both functions
MY_GLOBAL_VAR=DEV_VALUE

[my_function_name_a]
  NAME="function A"
  FOO=DEV_VALUE

[my_function_name_b]
  NAME="function B"
  BAR=DEV_VALUE
```

`./you_configs/prod.ini`

```ini
# will be available for both functions
MY_GLOBAL_VAR=PROD_VALUE

[my_function_name_a]
  NAME="function A"
  FOO=PROD_VALUE

[my_function_name_b]
  NAME="function B"
  BAR=PROD_VALUE
```


## Contributing

Yes, thank you!
This plugin is community-driven, most of its features are from different authors.
Please update the docs and tests and add your name to the package.json file.
We try to follow [Airbnb's JavaScript Style Guide](https://github.com/airbnb/javascript).

## License

MIT
