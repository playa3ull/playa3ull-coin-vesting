import { toAtto } from "./utils";

export const config = {
    EPOCH_REWARD: toAtto(6849315 / 24),
    EPOCH_SIZE_SECONDS: 60 * 60,
    INITAL_SUPPLY: toAtto(1387507487.99),
};

export const autoMine = (network: string): boolean => {
    return network === ("localhost" || "hardhat");
};
