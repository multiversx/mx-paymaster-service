REST API facade template for microservices that interacts with the MultiversX blockchain.

## Quick start

1. Run `npm install` in the project directory
2. Optionally make edits to `config.yaml` or create `config.custom.yaml` for each microservice
	### Configuration
  - Set the address of a deployed Paymaster SC in `paymaster.contractAddress`
	- Set the path to a PEM file for the relayer account in `relayer.pemFilePath`
	- Set the address of the relayer in `relayer.address`
	- Add at least one entry under `tokens` . Eg :
```bash
tokens:
  - USDC-350c4e:
      feePercentage: 3
      feeAmount: '10000'
```
## Dependencies

1. Redis Server is required to be installed [docs](https://redis.io/).

You can run `docker-compose up` in a separate terminal to use a local Docker container for all these dependencies.

After running the sample, you can stop the Docker container with `docker-compose down`

## Available Features

These features can be enabled/disabled in config file

### `Public API`

Endpoints that can be used by anyone (public endpoints).

### `Private API`

Endpoints that are not exposed on the internet
For example: We do not want to expose our metrics and cache interactions to anyone (/metrics /cache)

### `Autoswap`

Cronjob that performs automatic swapping from token -> wrapped EGLD.

If enabled, the configuration for the tokens you want to automatically swap needs to contain some extra fields. Eg:
```bash
- RIDE-05b1bb:
    feePercentage: 5
    feeAmount: '0'
    swapContract: 'erd1qqqqqqqqqqqqqpgqpvfd0cuspuewm9z9p6lcmp66ylqg4js30n4sj2rjwh'
    swapParameters: 'swapTokensFixedInput@WEGLD-a28c59@01'
    swapMinAmount: '2000000000000000000'
    swapGasLimit: 12050000
```

## Available Scripts

This is a MultiversX project built on Nest.js framework.

### `npm run start:mainnet`

​
Runs the app in the production mode.
Make requests to [http://localhost:3001](http://localhost:3001).

Redis Server is required to be installed.

## Running the api

```bash
# development watch mode on devnet
$ npm run start:devnet:watch

# development debug mode on devnet
$ npm run start:devnet:debug

# development mode on devnet
$ npm run start:devnet

# production mode
$ npm run start:mainnet
```

Requests can be made to http://localhost:3001 for the api. The app will reload when you'll make edits (if opened in watch mode). You will also see any lint errors in the console.​

### `npm run test`

```bash
# unit tests
$ npm run test

# e2e tests
$ npm run test:e2e

# test coverage
$ npm run test:cov
```
