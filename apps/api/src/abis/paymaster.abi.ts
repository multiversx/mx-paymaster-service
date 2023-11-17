export const PaymasterAbiJson =
  `{
  "buildInfo": {
      "rustc": {
          "version": "1.71.0-nightly",
          "commitHash": "a2b1646c597329d0a25efa3889b66650f65de1de",
          "commitDate": "2023-05-25",
          "channel": "Nightly",
          "short": "rustc 1.71.0-nightly (a2b1646c5 2023-05-25)"
      },
      "contractCrate": {
          "name": "paymaster",
          "version": "0.0.0"
      },
      "framework": {
          "name": "multiversx-sc",
          "version": "0.43.4"
      }
  },
  "name": "PaymasterContract",
  "constructor": {
      "inputs": [],
      "outputs": []
  },
  "endpoints": [
      {
          "name": "forwardExecution",
          "mutability": "mutable",
          "payableInTokens": [
              "*"
          ],
          "inputs": [
              {
                  "name": "relayer_addr",
                  "type": "Address"
              },
              {
                  "name": "dest",
                  "type": "Address"
              },
              {
                  "name": "endpoint_name",
                  "type": "bytes"
              },
              {
                  "name": "endpoint_args",
                  "type": "variadic<bytes>",
                  "multi_arg": true
              }
          ],
          "outputs": []
      }
  ],
  "events": [],
  "hasCallback": true,
  "types": {}
}
`;