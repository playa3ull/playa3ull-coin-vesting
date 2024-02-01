<br />
<a href="https://github.com/playa3ull/playa3ull-coin-vesting">
    <img src="https://playa3ull.games/assets/logos/3ull-head.svg" alt="Logo" width="80" height="80">
</a>

# PLAYA3ULL GAMES - Coin Vesting Template

🍴 This is a fork of https://github.com/AbdelStark/token-vesting-contracts

🎭 Original contract has been audited by Hacken [here](https://github.com/AbdelStark/token-vesting-contracts/blob/main/audits/hacken_audit_report.pdf)

Supports native Ether (3ULL) instead of ERC20 tokens and fit in with the rest of the PLAYA3ULL GAMES contracts deployment process, and testing suite.

`CoinVesting` contract can release its token balance gradually like a typical vesting scheme, with a cliff and vesting period.

## 📦 Installation

```console
$ pnpm
```

## ⛏️ Compile

```console
$ pnpm hardhat compile
```

-   `/typechain`
-   `/artifacts`

## 🌡️ Testing

```console
$ pnpm hardhat test
```

## 📊 Code coverage

```console
$ pnpm hardhat coverage
```

`/coverage/index.html` - View the coverage website
