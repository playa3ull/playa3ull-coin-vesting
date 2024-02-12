import { DeployFunction } from "hardhat-deploy/types";
import { HardhatRuntimeEnvironment } from "hardhat/types";

import { autoMine } from "../shared/config";

/**
 *
 * @notice Deploys the Token and TokenVesting contracts for testing purposes
 */
const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
    const { deployments, getNamedAccounts } = hre;
    const { deploy } = deployments;
    const { deployer } = await getNamedAccounts();

    const token = await deploy("Token", {
        from: deployer,
        contract: "Token",
        log: false,
        autoMine: autoMine(hre.network.name),
        args: ["TestToken", "TT", "1000000000000000000000000000000000"],
    });

    await deploy("tokenVesting", {
        from: deployer,
        contract: "TokenVesting",
        log: true,
        autoMine: autoMine(hre.network.name),
        args: [token.address],
    });
};
func.tags = ["test"];

export default func;
