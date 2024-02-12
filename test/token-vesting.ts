import { time } from "@nomicfoundation/hardhat-network-helpers";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { expect } from "chai";
import { keccak256 } from "ethers/lib/utils";
import { ethers, network } from "hardhat";
import { ProtocolContracts, setup } from "../shared/setup-test";

describe.only("Token Vesting", async () => {
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

        contracts.mockToken.transfer(owner, 1000000000000000000000000000);

        await network.provider.send("hardhat_setBalance", [
            owner.address,
            "0x6124FEE993BC0000",
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
        await contracts.mockToken
            .connect(owner)
            .transfer(contracts.tokenVesting.address, "0x64");

        await contracts.tokenVesting
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
            await contracts.tokenVesting.getVestingSchedulesCount()
        ).to.be.equal(1);

        expect(
            await contracts.tokenVesting.getVestingSchedulesCountByBeneficiary(
                beneficiary.address
            )
        ).to.be.equal(1);

        const vestingScheduleId =
            await contracts.tokenVesting.computeVestingScheduleIdForAddressAndIndex(
                beneficiary.address,
                0
            );

        // Check that vested amount is 0
        expect(
            await contracts.tokenVesting.computeReleasableAmount(
                vestingScheduleId
            )
        ).to.be.equal(0);

        // Set time to half the vesting period
        await time.increaseTo(baseTime + duration / 2);

        // Check that only beneficiary can try to release vested tokens
        await expect(
            contracts.tokenVesting
                .connect(nonBeneficiary)
                .release(vestingScheduleId, 100)
        ).to.be.revertedWith(
            "TokenVesting: only beneficiary and owner can release vested tokens"
        );

        // Check that beneficiary cannot release more than the vested amount
        await expect(
            contracts.tokenVesting
                .connect(beneficiary)
                .release(vestingScheduleId, 100)
        ).to.be.revertedWith(
            "TokenVesting: cannot release tokens, not enough vested tokens"
        );

        // Check that beneficiary can release half the vested amount
        // (as we're halfway through the vesting period)
        expect(
            await contracts.tokenVesting
                .connect(beneficiary)
                .computeReleasableAmount(vestingScheduleId)
        ).to.be.equal(50);

        // TODO: Change transfer event to check balance
        // Release 10 tokens
        await contracts.tokenVesting
            .connect(beneficiary)
            .release(vestingScheduleId, 10);

        // Check that the vested amount is now 40
        expect(
            await contracts.tokenVesting
                .connect(beneficiary)
                .computeReleasableAmount(vestingScheduleId)
        ).to.be.equal(40);

        // Check that the released amount is 10
        expect(
            (await contracts.tokenVesting.getVestingSchedule(vestingScheduleId))
                .released
        ).to.be.equal(10);

        // Set current time after the end of the vesting period
        await time.increaseTo(baseTime + duration + 1);

        // Check that the vested amount is 90
        expect(
            await contracts.tokenVesting
                .connect(beneficiary)
                .computeReleasableAmount(vestingScheduleId)
        ).to.be.equal(90);

        // owner release vested tokens (45)
        await contracts.tokenVesting
            .connect(owner)
            .release(vestingScheduleId, 45);

        expect(
            (await contracts.tokenVesting.getVestingSchedule(vestingScheduleId))
                .released
        ).to.be.equal(55);

        // owner release vested tokens (45)
        await contracts.tokenVesting
            .connect(owner)
            .release(vestingScheduleId, 45);

        expect(
            (await contracts.tokenVesting.getVestingSchedule(vestingScheduleId))
                .released
        ).to.be.equal(100);

        // Check that the vested amount is 0
        expect(
            await contracts.tokenVesting
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

        await contracts.mockToken
            .connect(owner)
            .transfer(contracts.tokenVesting.address, "0x64");

        // create new vesting schedule
        await contracts.tokenVesting
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
            await contracts.tokenVesting.computeVestingScheduleIdForAddressAndIndex(
                beneficiary.address,
                0
            );

        // set time to half the vesting period
        await time.increaseTo(baseTime + duration / 2);

        const preBalance = await beneficiary.getBalance();

        await contracts.tokenVesting.connect(owner).revoke(vestingScheduleId);

        expect(await beneficiary.getBalance()).to.equal(preBalance);
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
                await contracts.tokenVesting.computeVestingScheduleIdForAddressAndIndex(
                    beneficiary.address,
                    0
                )
            ).toString()
        ).to.equal(expectedVestingScheduleId);
        expect(
            (
                await contracts.tokenVesting.computeNextVestingScheduleIdForHolder(
                    beneficiary.address
                )
            ).toString()
        ).to.equal(expectedVestingScheduleId);
    });

    it("Should check input parameters for createVestingSchedule method", async function () {
        await contracts.mockToken
            .connect(owner)
            .transfer(contracts.tokenVesting.address, "0x64");

        const time = Date.now();

        await expect(
            contracts.tokenVesting
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
        ).to.be.revertedWith("TokenVesting: duration must be > 0");
        await expect(
            contracts.tokenVesting
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
        ).to.be.revertedWith("TokenVesting: slicePeriodSeconds must be >= 1");
        await expect(
            contracts.tokenVesting
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
        ).to.be.revertedWith("TokenVesting: amount must be > 0");

        await expect(
            contracts.tokenVesting
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
        ).to.be.revertedWith("TokenVesting: duration must be >= cliff");
    });

    it("Should withdraw excess coins", async function () {
        await contracts.mockToken
            .connect(owner)
            .transfer(contracts.tokenVesting.address, "0x821AB0D4414980000");
        const time = Date.now();
        await contracts.tokenVesting
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
        const preBalance = await contracts.mockToken.balanceOf(owner.address);
        const expected = preBalance.add(ethers.utils.parseUnits("50", "ether"));
        await contracts.tokenVesting
            .connect(owner)
            .withdraw(ethers.utils.parseUnits("50", "ether"));
        expect(await contracts.mockToken.balanceOf(owner.address)).to.equal(
            expected
        );
    });

    it("Should not be able to withdraw more than the excess", async function () {
        await contracts.mockToken
            .connect(owner)
            .transfer(contracts.tokenVesting.address, "0x821AB0D4414980000");

        const time = Date.now();

        await contracts.tokenVesting
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
            contracts.tokenVesting
                .connect(owner)
                .withdraw(ethers.utils.parseUnits("55", "ether"))
        ).to.be.revertedWith("TokenVesting: not enough withdrawable funds");
    });

    it("Should be able to get vesting schedule ID", async function () {
        await contracts.mockToken
            .connect(owner)
            .transfer(contracts.tokenVesting.address, "0x821AB0D4414980000");
        const time = Date.now();

        await contracts.tokenVesting
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

        expect(await contracts.tokenVesting.getVestingIdAtIndex(0)).to.be.equal(
            keccak256(
                ethers.utils.solidityPack(
                    ["address", "uint256"],
                    [beneficiary.address, 0]
                )
            )
        );

        const vestingSchedule =
            await contracts.tokenVesting.getVestingScheduleByAddressAndIndex(
                beneficiary.address,
                0
            );

        expect(vestingSchedule.beneficiary).to.be.equal(beneficiary.address);
        expect(vestingSchedule.amountTotal).to.be.equal(
            ethers.utils.parseUnits("100", "ether")
        );
    });

    it("Should be able to get total vesting schedule ", async function () {
        await contracts.mockToken
            .connect(owner)
            .transfer(contracts.tokenVesting.address, "0x97C9CE4CF6D5C0000");

        const time = Date.now();

        await contracts.tokenVesting
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
            await contracts.tokenVesting.getVestingSchedulesTotalAmount()
        ).to.be.equal(ethers.utils.parseUnits("100", "ether"));

        // Add another vesting schedule to check total amount
        await contracts.tokenVesting
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
            await contracts.tokenVesting.getVestingSchedulesTotalAmount()
        ).to.be.equal(ethers.utils.parseUnits("175", "ether"));
    });

    it("Should not be able to create vesting schedule without enough coins ", async function () {
        const time = Date.now();

        await expect(
            contracts.tokenVesting
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
            "TokenVesting: cannot create vesting schedule because not sufficient tokens"
        );
    });

    it("Should be able to revoke revocable only ", async function () {
        await contracts.mockToken
            .connect(owner)
            .transfer(contracts.tokenVesting.address, "0x97C9CE4CF6D5C0000");

        const time = Date.now();

        // Create revocable vesting schedule
        await contracts.tokenVesting
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
        await contracts.tokenVesting
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
                await contracts.tokenVesting.getVestingSchedule(
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
            await contracts.tokenVesting
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
                await contracts.tokenVesting.getVestingSchedule(
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
        expect(
            await contracts.tokenVesting.getWithdrawableAmount()
        ).to.be.equal(ethers.utils.parseUnits("100", "ether"));

        // Check that it cannot be revoked again
        await expect(
            contracts.tokenVesting
                .connect(owner)
                .revoke(
                    keccak256(
                        ethers.utils.solidityPack(
                            ["address", "uint256"],
                            [beneficiary.address, 0]
                        )
                    )
                )
        ).to.be.revertedWith("TokenVesting: vesting schedule revoked");

        await expect(
            contracts.tokenVesting
                .connect(owner)
                .revoke(
                    keccak256(
                        ethers.utils.solidityPack(
                            ["address", "uint256"],
                            [beneficiary.address, 1]
                        )
                    )
                )
        ).to.be.revertedWith("TokenVesting: vesting is not revocable");

        // Check you can't revoke a non existing vesting schedule
        await expect(
            contracts.tokenVesting
                .connect(owner)
                .revoke(
                    keccak256(
                        ethers.utils.solidityPack(
                            ["address", "uint256"],
                            [beneficiary.address, 2]
                        )
                    )
                )
        ).to.be.revertedWith("TokenVesting: vesting schedule not initialized");
    });

    it("Should not be able to release a revoked schedule", async function () {
        const time = Date.now();

        await contracts.mockToken
            .connect(owner)
            .transfer(contracts.tokenVesting.address, "0x97c9ce4cf6d5c0000");

        // Create revocable vesting schedule
        await contracts.tokenVesting
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

        await contracts.tokenVesting
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
            contracts.tokenVesting.release(
                keccak256(
                    ethers.utils.solidityPack(
                        ["address", "uint256"],
                        [beneficiary.address, 0]
                    )
                ),
                1
            )
        ).to.be.revertedWith("TokenVesting: vesting schedule revoked");

        await expect(
            contracts.tokenVesting.computeReleasableAmount(
                keccak256(
                    ethers.utils.solidityPack(
                        ["address", "uint256"],
                        [beneficiary.address, 0]
                    )
                )
            )
        ).to.be.revertedWith("TokenVesting: vesting schedule revoked");
    });

    it("Should simulate real world vesting example", async function () {
        await contracts.mockToken
            .connect(owner)
            .transfer(contracts.tokenVesting.address, "0x821AB0D4414980000");

        const startTime = Date.now() + 60 * 60 * 24 * 7 * 52;
        const cliff = 0;
        const duration = 60 * 60 * 24 * 7 * 10; // 10 weeks in seconds
        const slices = 60 * 60 * 24 * 7;

        await contracts.tokenVesting
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
            contracts.tokenVesting
                .connect(owner)
                .withdraw(ethers.utils.parseUnits("55", "ether"))
        ).to.be.revertedWith("TokenVesting: not enough withdrawable funds");

        expect(
            await contracts.tokenVesting.computeReleasableAmount(
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
            await contracts.tokenVesting.computeReleasableAmount(
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
            await contracts.tokenVesting.computeReleasableAmount(
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
            await contracts.tokenVesting.computeReleasableAmount(
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
            await contracts.tokenVesting.computeReleasableAmount(
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
            await contracts.tokenVesting.computeReleasableAmount(
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
            await contracts.tokenVesting.computeReleasableAmount(
                keccak256(
                    ethers.utils.solidityPack(
                        ["address", "uint256"],
                        [beneficiary.address, 0]
                    )
                )
            )
        ).to.equal(ethers.utils.parseUnits("100", "ether"));

        const preBalance = await contracts.mockToken.balanceOf(
            beneficiary.address
        );

        await contracts.tokenVesting
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

        expect(
            await contracts.mockToken.balanceOf(beneficiary.address)
        ).to.be.equal(preBalance.add(ethers.utils.parseUnits("100", "ether")));
    });

    it("Should simulate daily release over a month", async function () {
        await contracts.mockToken
            .connect(owner)
            .transfer(
                contracts.tokenVesting.address,
                "0x39E7139A8C08FA06000000"
            );

        const startTime = Date.now() + 60 * 60 * 24 * 7 * 4; // 1 month from now
        const cliff = 0;
        const duration = 60 * 60 * 24 * 28; // 28 days in seconds
        const slices = 60 * 60 * 24; // 1 day
        const amount = ethers.utils.parseUnits("70000000", "ether");

        const expectedReleasePerSlice = amount.div(duration / slices);

        await contracts.tokenVesting
            .connect(owner)
            .createVestingSchedule(
                beneficiary.address,
                startTime,
                cliff,
                duration,
                slices,
                false,
                amount
            );

        await expect(
            contracts.tokenVesting
                .connect(owner)
                .withdraw(expectedReleasePerSlice)
        ).to.be.revertedWith("TokenVesting: not enough withdrawable funds");

        expect(
            await contracts.tokenVesting.computeReleasableAmount(
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
            await contracts.tokenVesting.computeReleasableAmount(
                keccak256(
                    ethers.utils.solidityPack(
                        ["address", "uint256"],
                        [beneficiary.address, 0]
                    )
                )
            )
        ).to.be.equal(0);

        await time.increaseTo(startTime + slices);
        expect(
            await contracts.tokenVesting.computeReleasableAmount(
                keccak256(
                    ethers.utils.solidityPack(
                        ["address", "uint256"],
                        [beneficiary.address, 0]
                    )
                )
            )
        ).to.equal(expectedReleasePerSlice);

        await time.increaseTo(startTime + slices * 2);
        expect(
            await contracts.tokenVesting.computeReleasableAmount(
                keccak256(
                    ethers.utils.solidityPack(
                        ["address", "uint256"],
                        [beneficiary.address, 0]
                    )
                )
            )
        ).to.equal(expectedReleasePerSlice.mul(2));

        await time.increaseTo(startTime + slices * 3);
        expect(
            await contracts.tokenVesting.computeReleasableAmount(
                keccak256(
                    ethers.utils.solidityPack(
                        ["address", "uint256"],
                        [beneficiary.address, 0]
                    )
                )
            )
        ).to.equal(expectedReleasePerSlice.mul(3));

        await time.increaseTo(startTime + slices * 28);
        expect(
            await contracts.tokenVesting.computeReleasableAmount(
                keccak256(
                    ethers.utils.solidityPack(
                        ["address", "uint256"],
                        [beneficiary.address, 0]
                    )
                )
            )
        ).to.equal(amount);
        const preBalance = await contracts.mockToken.balanceOf(
            beneficiary.address
        );
        const expected = preBalance.add(amount);

        await contracts.tokenVesting
            .connect(owner)
            .release(
                keccak256(
                    ethers.utils.solidityPack(
                        ["address", "uint256"],
                        [beneficiary.address, 0]
                    )
                ),
                amount
            );

        expect(
            await contracts.mockToken.balanceOf(beneficiary.address)
        ).to.be.equal(expected);
    });
});
