# serverless-ini-env
[![serverless](http://public.serverless.com/badges/v3.svg)](http://www.serverless.com)

## Install

`npm install --save-dev serverless-ini-env`

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
