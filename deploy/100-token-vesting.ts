import { DeployFunction } from "hardhat-deploy/types";
import { HardhatRuntimeEnvironment } from "hardhat/types";

import { autoMine } from "../shared/config";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
    const { deployments, getNamedAccounts } = hre;
    const { deploy } = deployments;
    const { deployer } = await getNamedAccounts();

    await deploy("tokenVesting", {
        from: deployer,
        contract: "TokenVesting",
        log: true,
        autoMine: autoMine(hre.network.name),
        args: [process.env.w3ULL_TOKEN],
    });
};
func.tags = ["token-vesting"];

export default func;
