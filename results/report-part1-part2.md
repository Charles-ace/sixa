# Sixa x402 broker — live demo report (Part 1 + Part 2)

Date: 2026-08-10. Target network: Base Sepolia (84532) and Base Mainnet (8453).

---

## Part 1 — Paid path on Base mainnet (raw receipts)

The following raw JSON receipts are queried directly from the Base mainnet RPC endpoint (`https://mainnet.base.org`).

### Mainnet Transaction 1 (`0xdbdbb3a9a4a3b8099907352aaef012067c6bd21adadb78e4b26dda1b33d77a76`)
This tx is a Base mainnet USDC transfer, status success, at block 49801385.

```json
{
  "blobGasUsed": "14800",
  "blockHash": "0xb8ac846784163d40242546ad45c54f16191496c150ed0584b6594120694d5353",
  "blockNumber": "49801385",
  "contractAddress": null,
  "cumulativeGasUsed": "4389349",
  "effectiveGasPrice": "6000000",
  "from": "0xa8ee74b6e4f84df415112a004758675407659a94",
  "gasUsed": "45047",
  "logs": [
    {
      "address": "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913",
      "blockHash": "0xb8ac846784163d40242546ad45c54f16191496c150ed0584b6594120694d5353",
      "blockNumber": "49801385",
      "data": "0x0000000000000000000000000000000000000000000000000000000000002710",
      "logIndex": 101,
      "removed": false,
      "topics": [
        "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef",
        "0x000000000000000000000000a8ee74b6e4f84df415112a004758675407659a94",
        "0x00000000000000000000000021db7753d81b14348926e3bf8369111ebd311a92"
      ],
      "transactionHash": "0xdbdbb3a9a4a3b8099907352aaef012067c6bd21adadb78e4b26dda1b33d77a76",
      "transactionIndex": 44
    }
  ],
  "status": "success",
  "to": "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913",
  "transactionHash": "0xdbdbb3a9a4a3b8099907352aaef012067c6bd21adadb78e4b26dda1b33d77a76",
  "transactionIndex": 44,
  "type": "eip1559"
}
```

### Mainnet Transaction 2 (`0x5050dee55b15c4f07bed31f8b1202fa242dd9fb6adef0ac880458b9e82b447ef`)
This tx is a Base mainnet USDC transfer, status success, at block 49801423.

```json
{
  "blobGasUsed": "14800",
  "blockHash": "0x8e7fe2df2b49f5849fc86812d58717f163bbddf54d48af3082c58229f08d218d",
  "blockNumber": "49801423",
  "contractAddress": null,
  "cumulativeGasUsed": "3837455",
  "effectiveGasPrice": "6000000",
  "from": "0xa8ee74b6e4f84df415112a004758675407659a94",
  "gasUsed": "45047",
  "logs": [
    {
      "address": "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913",
      "blockHash": "0x8e7fe2df2b49f5849fc86812d58717f163bbddf54d48af3082c58229f08d218d",
      "blockNumber": "49801423",
      "data": "0x000000000000000000000000000000000000000000000000000000000000c350",
      "logIndex": 75,
      "removed": false,
      "topics": [
        "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef",
        "0x000000000000000000000000a8ee74b6e4f84df415112a004758675407659a94",
        "0x000000000000000000000000e20405094c45b4f9adc050c429f2f45c72ff7467"
      ],
      "transactionHash": "0x5050dee55b15c4f07bed31f8b1202fa242dd9fb6adef0ac880458b9e82b447ef",
      "transactionIndex": 22
    }
  ],
  "status": "success",
  "to": "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913",
  "transactionHash": "0x5050dee55b15c4f07bed31f8b1202fa242dd9fb6adef0ac880458b9e82b447ef",
  "transactionIndex": 22,
  "type": "eip1559"
}
```

---

## Part 2 — Generation-fallback path on Base Sepolia (raw receipts)

The following raw JSON receipts are queried directly from the Base Sepolia RPC endpoint (`https://sepolia.base.org`).

### Base Sepolia Wallet Payment (`0x5e0ebff7a2ccf90c987d58ec867e207f503f8861fa3a446a12aed4bb5e8648a5`)
This tx is a Base Sepolia USDC transfer, status success, at block 45320348.

```json
{
  "blobGasPrice": "1",
  "blobGasUsed": "0",
  "blockHash": "0x40a7a0b37ab7c6f0e4fb90ca0ceaaef58a221f7edbd0fb676d6fc3a5cb4ae6e0",
  "blockNumber": "45320348",
  "contractAddress": null,
  "cumulativeGasUsed": "19409865",
  "effectiveGasPrice": "100000008",
  "from": "0xa8ee74b6e4f84df415112a004758675407659a94",
  "gasUsed": "51702",
  "logs": [
    {
      "address": "0x036cbd53842c5426634e7929541ec2318f3dcf7e",
      "blockHash": "0x40a7a0b37ab7c6f0e4fb90ca0ceaaef58a221f7edbd0fb676d6fc3a5cb4ae6e0",
      "blockNumber": "45320348",
      "data": "0x000000000000000000000000000000000000000000000000000000000000c350",
      "logIndex": 40,
      "removed": false,
      "topics": [
        "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef",
        "0x000000000000000000000000a8ee74b6e4f84df415112a004758675407659a94",
        "0x000000000000000000000000e20405094c45b4f9adc050c429f2f45c72ff7467"
      ],
      "transactionHash": "0x5e0ebff7a2ccf90c987d58ec867e207f503f8861fa3a446a12aed4bb5e8648a5",
      "transactionIndex": 35
    }
  ],
  "status": "success",
  "to": "0x036cbd53842c5426634e7929541ec2318f3dcf7e",
  "transactionHash": "0x5e0ebff7a2ccf90c987d58ec867e207f503f8861fa3a446a12aed4bb5e8648a5",
  "transactionIndex": 35,
  "type": "eip1559"
}
```

### Fallback Run 5 Execution (`0x2b84b3bcb9c8cf4661d6834f0b00f9bcef3d4830fc2ec2d8e86e40db7272fde7`)
This tx is a Base Sepolia fallback execution, status success, at block 45317577.

```json
{
  "blobGasPrice": "1",
  "blobGasUsed": "0",
  "blockHash": "0x4edcdcfd86bf128eb0fe9fb9be3d5e2e84860d5b94f6f89efebf4492bf22db2e",
  "blockNumber": "45317577",
  "contractAddress": null,
  "cumulativeGasUsed": "10023605",
  "effectiveGasPrice": "100000008",
  "from": "0xdcf4bac4bd805948168ff63483bc493894a29613",
  "gasUsed": "70087",
  "logs": [],
  "status": "success",
  "to": "0x5af5194b4b0909eb978e3cf1e25333852277f07d",
  "transactionHash": "0x2b84b3bcb9c8cf4661d6834f0b00f9bcef3d4830fc2ec2d8e86e40db7272fde7",
  "transactionIndex": 27,
  "type": "eip1559"
}
```

### Fallback Run 6 Execution (`0xe9aacb0f1a35f819314577ec57de5704d99f18d688f92d47d6de61e698e639c9`)
This tx is a Base Sepolia fallback execution, status success, at block 45317640.

```json
{
  "blobGasPrice": "1",
  "blobGasUsed": "0",
  "blockHash": "0xe295c07469aee3ff3952d7e5d2ff1f54316cf52fae7a04ddcd6fe6fc3a5cb4ae6e0",
  "blockNumber": "45317640",
  "contractAddress": null,
  "cumulativeGasUsed": "6724628",
  "effectiveGasPrice": "100000008",
  "from": "0xdcf4bac4bd805948168ff63483bc493894a29613",
  "gasUsed": "70087",
  "logs": [],
  "status": "success",
  "to": "0x5af5194b4b0909eb978e3cf1e25333852277f07d",
  "transactionHash": "0xe9aacb0f1a35f819314577ec57de5704d99f18d688f92d47d6de61e698e639c9",
  "transactionIndex": 17,
  "type": "eip1559"
}
```

### Fallback Run 4 Execution (`0xdab57c82560936ab0036e697953ae0ac7b659b5c0eb8a29de558f2225d2b6975`)
This tx is a Base Sepolia fallback execution, status success, at block 45317391.

```json
{
  "blobGasPrice": "1",
  "blobGasUsed": "0",
  "blockHash": "0xb695e1ebfb91b5c46dd6ea1b9efeb5386d4e837568eb2c1dff6bf690e808269e",
  "blockNumber": "45317391",
  "contractAddress": null,
  "cumulativeGasUsed": "13745974",
  "effectiveGasPrice": "100000008",
  "from": "0xdcf4bac4bd805948168ff63483bc493894a29613",
  "gasUsed": "70087",
  "logs": [],
  "status": "success",
  "to": "0x5af5194b4b0909eb978e3cf1e25333852277f07d",
  "transactionHash": "0xdab57c82560936ab0036e697953ae0ac7b659b5c0eb8a29de558f2225d2b6975",
  "transactionIndex": 23,
  "type": "eip1559"
}
```
