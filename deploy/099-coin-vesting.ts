import { DeployFunction } from "hardhat-deploy/types";
import { HardhatRuntimeEnvironment } from "hardhat/types";

import { autoMine } from "../shared/config";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
    const { deployments, getNamedAccounts } = hre;
    const { deploy } = deployments;
    const { deployer } = await getNamedAccounts();

    await deploy("coinVesting", {
        from: deployer,
        contract: "CoinVesting",
        log: true,
        autoMine: autoMine(hre.network.name),
        args: [],
    });
};
func.tags = ["test"];

export default func;
