import { deployments, ethers, getNamedAccounts } from "hardhat";
import { CoinVesting, Token, TokenVesting } from "../typechain";

export const setup = async () => {
    // Deploy all contracts, as per "test"
    await deployments.fixture("test");

    return await getDeployments();
};

export type ProtocolContracts = {
    coinVesting: CoinVesting;
    tokenVesting: TokenVesting;
    mockToken: Token;
};

export const getDeployments = async () => {
    const { deployer, liquidity, treasury } = await getNamedAccounts();

    const contracts: ProtocolContracts = {
        coinVesting: await ethers.getContract("coinVesting"),
        tokenVesting: await ethers.getContract("tokenVesting"),
        mockToken: await ethers.getContract("Token"),
    };

    return {
        contracts,
        deployer: await ethers.getSigner(deployer),
    };
};
