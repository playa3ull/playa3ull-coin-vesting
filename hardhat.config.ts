import "@nomicfoundation/hardhat-toolbox";
import "@openzeppelin/hardhat-upgrades";
import "@typechain/hardhat";
import { config as dotenvConfig } from "dotenv";
import "hardhat-deploy";
import { HardhatUserConfig } from "hardhat/config";
import "solidity-coverage";

dotenvConfig();

if (!process.env.MAINNET_DEPLOYER_PRIVATE_KEY) {
    throw new Error("MAINNET_DEPLOYER_PRIVATE_KEY is not set");
}

if (!process.env.TESTNET_DEPLOYER_PRIVATE_KEY) {
    throw new Error("TESTNET_DEPLOYER_PRIVATE_KEY is not set");
}

const config: HardhatUserConfig = {
    gasReporter: {
        currency: "3ULL",
        enabled: true,
        gasPrice: 0.00005,
    },
    solidity: {
        compilers: [
            {
                version: "0.8.19",
                settings: {
                    optimizer: {
                        enabled: true,
                        runs: 20,
                    },
                },
            },
        ],
    },
    networks: {
        localhost: {
            live: false,
            saveDeployments: true,
            tags: ["local"],
        },
        hardhat: {
            accounts: {
                mnemonic:
                    "test test test test test test test test test test test junk",
                initialIndex: 0,
                path: "m/44'/60'/0'/0",
                count: 20,
                accountsBalance: "10000000000000000000000000",
                passphrase: "",
            },
            tags: ["local", "test"],
        },
        localsubnet: {
            live: false,
            saveDeployments: true,
            tags: ["subnet"],
            url: "http://127.0.0.1:9654/ext/bc/2GsbK9pBB7MGxyDP2Wv1ScLZBaDHatcYx54YAFeGhZwcsAbQmE/rpc",
            accounts: [process.env.TESTNET_DEPLOYER_PRIVATE_KEY],
        },
        testnet: {
            live: true,
            saveDeployments: true,
            tags: ["subnet"],
            url:
                process.env.TESTNET_RPC_URL ||
                "https://api.testnet.playa3ull.games",
            accounts: [process.env.TESTNET_DEPLOYER_PRIVATE_KEY],
        },
        mainnet: {
            live: true,
            saveDeployments: true,
            tags: ["subnet"],
            url:
                process.env.MAINNET_RPC_URL ||
                "https://api.mainnet.playa3ull.games",
            accounts: [process.env.MAINNET_DEPLOYER_PRIVATE_KEY],
        },
    },
    typechain: {
        target: "ethers-v5",
        outDir: "./typechain",
    },
    namedAccounts: {
        deployer: {
            default: 0,
            hardhat: 10,
        },
    },
};

export default config;
