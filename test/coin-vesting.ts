import { time } from "@nomicfoundation/hardhat-network-helpers";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { expect } from "chai";
import { keccak256 } from "ethers/lib/utils";
import { ethers, network } from "hardhat";
import { ProtocolContracts, setup } from "../shared/setup-test";

describe.only("Coin Vesting", async () => {
    let owner: SignerWithAddress;
    let beneficiary: SignerWithAddress;
    let nonBeneficiary: SignerWithAddress;

    let contracts: ProtocolContracts;

    beforeEach(async () => {
        const signers = await ethers.getSigners();

        beneficiary = signers[1];
        nonBeneficiary = signers[2];

        const { contracts: setupContracts, deployer: setupDeployer } =
            await setup();

        contracts = setupContracts;
        owner = setupDeployer;

        await network.provider.send("hardhat_setBalance", [
            owner.address,
            "0x56BC75E2D63100000",
        ]);
    });

    it("Should vest tokens gradually", async () => {
        const baseTime = Math.floor(Date.now());
        const startTime = baseTime;
        const cliff = 0;
        const duration = 1000;
        const slicePeriodSeconds = 1;
        const revokable = true;
        const amount = 100;

        await network.provider.send("hardhat_setBalance", [
            contracts.coinVesting.address,
            "0x64",
        ]);

        await contracts.coinVesting
            .connect(owner)
            .createVestingSchedule(
                beneficiary.address,
                startTime,
                cliff,
                duration,
                slicePeriodSeconds,
                revokable,
                amount
            );

        expect(
            await contracts.coinVesting.getVestingSchedulesCount()
        ).to.be.equal(1);

        expect(
            await contracts.coinVesting.getVestingSchedulesCountByBeneficiary(
                beneficiary.address
            )
        ).to.be.equal(1);

        const vestingScheduleId =
            await contracts.coinVesting.computeVestingScheduleIdForAddressAndIndex(
                beneficiary.address,
                0
            );

        // Check that vested amount is 0
        expect(
            await contracts.coinVesting.computeReleasableAmount(
                vestingScheduleId
            )
        ).to.be.equal(0);

        // Set time to half the vesting period
        await time.increaseTo(baseTime + duration / 2);

        // Check that only beneficiary can try to release vested tokens
        await expect(
            contracts.coinVesting
                .connect(nonBeneficiary)
                .release(vestingScheduleId, 100)
        ).to.be.revertedWith(
            "CoinVesting: only beneficiary and owner can release vested tokens"
        );

        // Check that beneficiary cannot release more than the vested amount
        await expect(
            contracts.coinVesting
                .connect(beneficiary)
                .release(vestingScheduleId, 100)
        ).to.be.revertedWith(
            "CoinVesting: cannot release tokens, not enough vested tokens"
        );

        // Check that beneficiary can release half the vested amount
        // (as we're halfway through the vesting period)
        expect(
            await contracts.coinVesting
                .connect(beneficiary)
                .computeReleasableAmount(vestingScheduleId)
        ).to.be.equal(50);

        // TODO: Change transfer event to check balance
        // Release 10 tokens
        await contracts.coinVesting
            .connect(beneficiary)
            .release(vestingScheduleId, 10);

        // Check that the vested amount is now 40
        expect(
            await contracts.coinVesting
                .connect(beneficiary)
                .computeReleasableAmount(vestingScheduleId)
        ).to.be.equal(40);

        // Check that the released amount is 10
        expect(
            (await contracts.coinVesting.getVestingSchedule(vestingScheduleId))
                .released
        ).to.be.equal(10);

        // Set current time after the end of the vesting period
        await time.increaseTo(baseTime + duration + 1);

        // Check that the vested amount is 90
        expect(
            await contracts.coinVesting
                .connect(beneficiary)
                .computeReleasableAmount(vestingScheduleId)
        ).to.be.equal(90);

        // owner release vested tokens (45)
        await contracts.coinVesting
            .connect(owner)
            .release(vestingScheduleId, 45);

        expect(
            (await contracts.coinVesting.getVestingSchedule(vestingScheduleId))
                .released
        ).to.be.equal(55);

        // owner release vested tokens (45)
        await contracts.coinVesting
            .connect(owner)
            .release(vestingScheduleId, 45);

        expect(
            (await contracts.coinVesting.getVestingSchedule(vestingScheduleId))
                .released
        ).to.be.equal(100);

        // Check that the vested amount is 0
        expect(
            await contracts.coinVesting
                .connect(beneficiary)
                .computeReleasableAmount(vestingScheduleId)
        ).to.be.equal(0);
    });

    it("Should release vested tokens if revoked", async function () {
        // deploy vesting contract
        const baseTime = Math.floor(Date.now());
        const startTime = baseTime;
        const cliff = 0;
        const duration = 1000;
        const slicePeriodSeconds = 1;
        const revokable = true;
        const amount = 100;

        await network.provider.send("hardhat_setBalance", [
            contracts.coinVesting.address,
            "0x64",
        ]);

        // create new vesting schedule
        await contracts.coinVesting
            .connect(owner)
            .createVestingSchedule(
                beneficiary.address,
                startTime,
                cliff,
                duration,
                slicePeriodSeconds,
                revokable,
                amount
            );

        // compute vesting schedule id
        const vestingScheduleId =
            await contracts.coinVesting.computeVestingScheduleIdForAddressAndIndex(
                beneficiary.address,
                0
            );

        // set time to half the vesting period
        await time.increaseTo(baseTime + duration / 2);

        const preBalance = await beneficiary.getBalance();

        await contracts.coinVesting.connect(owner).revoke(vestingScheduleId);

        expect(await beneficiary.getBalance()).to.be.be.approximately(
            preBalance.add(50),
            3
        );
    });

    it("Should compute vesting schedule index", async function () {
        const expectedVestingScheduleId = keccak256(
            ethers.utils.solidityPack(
                ["address", "uint256"],
                [beneficiary.address, 0]
            )
        );
        expect(
            (
                await contracts.coinVesting.computeVestingScheduleIdForAddressAndIndex(
                    beneficiary.address,
                    0
                )
            ).toString()
        ).to.equal(expectedVestingScheduleId);
        expect(
            (
                await contracts.coinVesting.computeNextVestingScheduleIdForHolder(
                    beneficiary.address
                )
            ).toString()
        ).to.equal(expectedVestingScheduleId);
    });

    it("Should check input parameters for createVestingSchedule method", async function () {
        await network.provider.send("hardhat_setBalance", [
            contracts.coinVesting.address,
            "0x64",
        ]);

        const time = Date.now();

        await expect(
            contracts.coinVesting
                .connect(owner)
                .createVestingSchedule(
                    beneficiary.address,
                    time,
                    0,
                    0,
                    1,
                    false,
                    1
                )
        ).to.be.revertedWith("CoinVesting: duration must be > 0");
        await expect(
            contracts.coinVesting
                .connect(owner)
                .createVestingSchedule(
                    beneficiary.address,
                    time,
                    0,
                    1,
                    0,
                    false,
                    1
                )
        ).to.be.revertedWith("CoinVesting: slicePeriodSeconds must be >= 1");
        await expect(
            contracts.coinVesting
                .connect(owner)
                .createVestingSchedule(
                    beneficiary.address,
                    time,
                    0,
                    1,
                    1,
                    false,
                    0
                )
        ).to.be.revertedWith("CoinVesting: amount must be > 0");

        await expect(
            contracts.coinVesting
                .connect(owner)
                .createVestingSchedule(
                    beneficiary.address,
                    time,
                    2,
                    1,
                    1,
                    false,
                    1
                )
        ).to.be.revertedWith("CoinVesting: duration must be >= cliff");
    });

    it("Should withdraw excess coins", async function () {
        await network.provider.send("hardhat_setBalance", [
            contracts.coinVesting.address,
            "0x821AB0D4414980000",
        ]);

        const time = Date.now();

        await contracts.coinVesting
            .connect(owner)
            .createVestingSchedule(
                beneficiary.address,
                time,
                0,
                1,
                1,
                false,
                ethers.utils.parseUnits("100", "ether")
            );

        const preBalance = await owner.getBalance();

        await contracts.coinVesting
            .connect(owner)
            .withdraw(ethers.utils.parseUnits("50", "ether"));

        expect(await owner.getBalance()).to.be.approximately(
            preBalance.add(ethers.utils.parseUnits("50", "ether")),
            ethers.utils.parseUnits("1", "ether")
        );
    });

    it("Should not be able to withdraw more than the excess", async function () {
        await network.provider.send("hardhat_setBalance", [
            contracts.coinVesting.address,
            "0x821AB0D4414980000",
        ]);

        const time = Date.now();

        await contracts.coinVesting
            .connect(owner)
            .createVestingSchedule(
                beneficiary.address,
                time,
                0,
                1,
                1,
                false,
                ethers.utils.parseUnits("100", "ether")
            );

        await expect(
            contracts.coinVesting
                .connect(owner)
                .withdraw(ethers.utils.parseUnits("55", "ether"))
        ).to.be.revertedWith("CoinVesting: not enough withdrawable funds");
    });

    it("Should be able to get vesting schedule ID", async function () {
        await network.provider.send("hardhat_setBalance", [
            contracts.coinVesting.address,
            "0x821AB0D4414980000",
        ]);

        const time = Date.now();

        await contracts.coinVesting
            .connect(owner)
            .createVestingSchedule(
                beneficiary.address,
                time,
                0,
                1,
                1,
                false,
                ethers.utils.parseUnits("100", "ether")
            );

        expect(await contracts.coinVesting.getVestingIdAtIndex(0)).to.be.equal(
            keccak256(
                ethers.utils.solidityPack(
                    ["address", "uint256"],
                    [beneficiary.address, 0]
                )
            )
        );

        const vestingSchedule =
            await contracts.coinVesting.getVestingScheduleByAddressAndIndex(
                beneficiary.address,
                0
            );

        expect(vestingSchedule.beneficiary).to.be.equal(beneficiary.address);
        expect(vestingSchedule.amountTotal).to.be.equal(
            ethers.utils.parseUnits("100", "ether")
        );
    });

    it("Should be able to get total vesting schedule ", async function () {
        await network.provider.send("hardhat_setBalance", [
            contracts.coinVesting.address,
            "0x97C9CE4CF6D5C0000",
        ]);

        const time = Date.now();

        await contracts.coinVesting
            .connect(owner)
            .createVestingSchedule(
                beneficiary.address,
                time,
                0,
                1,
                1,
                false,
                ethers.utils.parseUnits("100", "ether")
            );

        await expect(
            await contracts.coinVesting.getVestingSchedulesTotalAmount()
        ).to.be.equal(ethers.utils.parseUnits("100", "ether"));

        // Add another vesting schedule to check total amount
        await contracts.coinVesting
            .connect(owner)
            .createVestingSchedule(
                beneficiary.address,
                time,
                0,
                1,
                1,
                false,
                ethers.utils.parseUnits("75", "ether")
            );

        await expect(
            await contracts.coinVesting.getVestingSchedulesTotalAmount()
        ).to.be.equal(ethers.utils.parseUnits("175", "ether"));
    });

    it("Should not be able to create vesting schedule without enough coins ", async function () {
        const time = Date.now();

        await expect(
            contracts.coinVesting
                .connect(owner)
                .createVestingSchedule(
                    beneficiary.address,
                    time,
                    0,
                    1,
                    1,
                    false,
                    ethers.utils.parseUnits("100", "ether")
                )
        ).to.be.revertedWith(
            "CoinVesting: cannot create vesting schedule because not sufficient tokens"
        );
    });

    it("Should be able to revoke revocable only ", async function () {
        await network.provider.send("hardhat_setBalance", [
            contracts.coinVesting.address,
            "0x97C9CE4CF6D5C0000",
        ]);

        const time = Date.now();

        // Create revocable vesting schedule
        await contracts.coinVesting
            .connect(owner)
            .createVestingSchedule(
                beneficiary.address,
                time,
                0,
                1,
                1,
                true,
                ethers.utils.parseUnits("100", "ether")
            );

        // Create non-revocable vesting schedule
        await contracts.coinVesting
            .connect(owner)
            .createVestingSchedule(
                beneficiary.address,
                time,
                0,
                1,
                1,
                false,
                ethers.utils.parseUnits("75", "ether")
            );

        // Check that the revocable schedule is not yet revoked
        expect(
            (
                await contracts.coinVesting.getVestingSchedule(
                    keccak256(
                        ethers.utils.solidityPack(
                            ["address", "uint256"],
                            [beneficiary.address, 0]
                        )
                    )
                )
            ).revoked
        ).to.be.false;

        expect(
            await contracts.coinVesting
                .connect(owner)
                .revoke(
                    keccak256(
                        ethers.utils.solidityPack(
                            ["address", "uint256"],
                            [beneficiary.address, 0]
                        )
                    )
                )
        ).to.not.be.reverted;

        // Check that the revocable schedule is revoked
        expect(
            (
                await contracts.coinVesting.getVestingSchedule(
                    keccak256(
                        ethers.utils.solidityPack(
                            ["address", "uint256"],
                            [beneficiary.address, 0]
                        )
                    )
                )
            ).revoked
        ).to.be.true;

        // Check that the revocable schedule balance can be withdrawn
        expect(await contracts.coinVesting.getWithdrawableAmount()).to.be.equal(
            ethers.utils.parseUnits("100", "ether")
        );

        // Check that it cannot be revoked again
        await expect(
            contracts.coinVesting
                .connect(owner)
                .revoke(
                    keccak256(
                        ethers.utils.solidityPack(
                            ["address", "uint256"],
                            [beneficiary.address, 0]
                        )
                    )
                )
        ).to.be.revertedWith("CoinVesting: vesting schedule revoked");

        await expect(
            contracts.coinVesting
                .connect(owner)
                .revoke(
                    keccak256(
                        ethers.utils.solidityPack(
                            ["address", "uint256"],
                            [beneficiary.address, 1]
                        )
                    )
                )
        ).to.be.revertedWith("CoinVesting: vesting is not revocable");

        // Check you can't revoke a non existing vesting schedule
        await expect(
            contracts.coinVesting
                .connect(owner)
                .revoke(
                    keccak256(
                        ethers.utils.solidityPack(
                            ["address", "uint256"],
                            [beneficiary.address, 2]
                        )
                    )
                )
        ).to.be.revertedWith("CoinVesting: vesting schedule not initialized");
    });

    it("Should not be able to release a revoked schedule", async function () {
        const time = Date.now();

        await network.provider.send("hardhat_setBalance", [
            contracts.coinVesting.address,
            "0x97C9CE4CF6D5C0000",
        ]);

        // Create revocable vesting schedule
        await contracts.coinVesting
            .connect(owner)
            .createVestingSchedule(
                beneficiary.address,
                time,
                0,
                1,
                1,
                true,
                ethers.utils.parseUnits("100", "ether")
            );

        await contracts.coinVesting
            .connect(owner)
            .revoke(
                keccak256(
                    ethers.utils.solidityPack(
                        ["address", "uint256"],
                        [beneficiary.address, 0]
                    )
                )
            );

        await expect(
            contracts.coinVesting.release(
                keccak256(
                    ethers.utils.solidityPack(
                        ["address", "uint256"],
                        [beneficiary.address, 0]
                    )
                ),
                1
            )
        ).to.be.revertedWith("CoinVesting: vesting schedule revoked");

        await expect(
            contracts.coinVesting.computeReleasableAmount(
                keccak256(
                    ethers.utils.solidityPack(
                        ["address", "uint256"],
                        [beneficiary.address, 0]
                    )
                )
            )
        ).to.be.revertedWith("CoinVesting: vesting schedule revoked");
    });

    it("Should simulate real world vesting example", async function () {
        await network.provider.send("hardhat_setBalance", [
            contracts.coinVesting.address,
            "0x821AB0D4414980000",
        ]);

        await network.provider.send("hardhat_setBalance", [
            beneficiary.address,
            "0x0",
        ]);

        const startTime = Date.now() + 60 * 60 * 24 * 7 * 52;
        const cliff = 0;
        const duration = 60 * 60 * 24 * 7 * 10; // 10 weeks in seconds
        const slices = 60 * 60 * 24 * 7;

        await contracts.coinVesting
            .connect(owner)
            .createVestingSchedule(
                beneficiary.address,
                startTime,
                cliff,
                duration,
                slices,
                false,
                ethers.utils.parseUnits("100", "ether")
            );

        await expect(
            contracts.coinVesting
                .connect(owner)
                .withdraw(ethers.utils.parseUnits("55", "ether"))
        ).to.be.revertedWith("CoinVesting: not enough withdrawable funds");

        expect(
            await contracts.coinVesting.computeReleasableAmount(
                keccak256(
                    ethers.utils.solidityPack(
                        ["address", "uint256"],
                        [beneficiary.address, 0]
                    )
                )
            )
        ).to.be.equal(0);

        await time.increaseTo(startTime);
        expect(
            await contracts.coinVesting.computeReleasableAmount(
                keccak256(
                    ethers.utils.solidityPack(
                        ["address", "uint256"],
                        [beneficiary.address, 0]
                    )
                )
            )
        ).to.be.equal(0);

        await time.increaseTo(startTime + 60 * 60 * 24 * 7 * 1);
        expect(
            await contracts.coinVesting.computeReleasableAmount(
                keccak256(
                    ethers.utils.solidityPack(
                        ["address", "uint256"],
                        [beneficiary.address, 0]
                    )
                )
            )
        ).to.equal(ethers.utils.parseUnits("10", "ether"));

        await time.increaseTo(startTime + 60 * 60 * 24 * 7 * 2);

        expect(
            await contracts.coinVesting.computeReleasableAmount(
                keccak256(
                    ethers.utils.solidityPack(
                        ["address", "uint256"],
                        [beneficiary.address, 0]
                    )
                )
            )
        ).to.equal(ethers.utils.parseUnits("20", "ether"));

        await time.increaseTo(startTime + 60 * 60 * 24 * 7 * 3);

        expect(
            await contracts.coinVesting.computeReleasableAmount(
                keccak256(
                    ethers.utils.solidityPack(
                        ["address", "uint256"],
                        [beneficiary.address, 0]
                    )
                )
            )
        ).to.equal(ethers.utils.parseUnits("30", "ether"));

        await time.increaseTo(startTime + 60 * 60 * 24 * 7 * 10);

        expect(
            await contracts.coinVesting.computeReleasableAmount(
                keccak256(
                    ethers.utils.solidityPack(
                        ["address", "uint256"],
                        [beneficiary.address, 0]
                    )
                )
            )
        ).to.equal(ethers.utils.parseUnits("100", "ether"));

        await time.increaseTo(startTime + 60 * 60 * 24 * 7 * 50);

        expect(
            await contracts.coinVesting.computeReleasableAmount(
                keccak256(
                    ethers.utils.solidityPack(
                        ["address", "uint256"],
                        [beneficiary.address, 0]
                    )
                )
            )
        ).to.equal(ethers.utils.parseUnits("100", "ether"));

        const preBalance = await beneficiary.getBalance();

        await contracts.coinVesting
            .connect(owner)
            .release(
                keccak256(
                    ethers.utils.solidityPack(
                        ["address", "uint256"],
                        [beneficiary.address, 0]
                    )
                ),
                ethers.utils.parseUnits("100", "ether")
            );

        expect(await beneficiary.getBalance()).to.be.equal(
            preBalance.add(ethers.utils.parseUnits("100", "ether"))
        );
    });
});
