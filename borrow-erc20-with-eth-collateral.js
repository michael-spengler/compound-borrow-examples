// Example to supply ETH as collateral and borrow DAI
const Web3 = require('web3');
const web3 = new Web3('http://127.0.0.1:8545');
const {
  cEthAddress,
  cEthAbi,
  comptrollerAddress,
  comptrollerAbi,
  priceOracleAddress,
  priceOracleAbi,
  daiAddress,
  daiAbi,
  cDaiAddress,
  cDaiAbi
} = require('./contracts.json');

// Your Ethereum wallet private key
const privateKey = 'b8c1b5c1d81f9475fdf2e334517d29f733bdfa40682207571b12fc1142cbf329';

// Add your Ethereum wallet to the Web3 object
web3.eth.accounts.wallet.add('0x' + privateKey);
const myWalletAddress = web3.eth.accounts.wallet[0].address;

// Main Net Contract for cETH (the collateral-supply process is different for cERC20 tokens)
const cEth = new web3.eth.Contract(cEthAbi, cEthAddress);

// Main Net Contract for Compound's Comptroller
const comptroller = new web3.eth.Contract(comptrollerAbi, comptrollerAddress);

// Main Net Contract for Compound's Price Oracle
const priceOracle = new web3.eth.Contract(priceOracleAbi, priceOracleAddress);

// Main net address of DAI contract
// https://etherscan.io/address/0x6b175474e89094c44da98b954eedeac495271d0f
const dai = new web3.eth.Contract(daiAbi, daiAddress);

// Main Net Contract for cDAI (https://compound.finance/developers#networks)
const cDai = new web3.eth.Contract(cDaiAbi, cDaiAddress);

const logBalances = () => {
  return new Promise(async (resolve, reject) => {
    let myWalletEthBalance = +web3.utils.fromWei(await web3.eth.getBalance(myWalletAddress));
    let myWalletCEthBalance = await cEth.methods.balanceOf(myWalletAddress).call() / 1e8;
    let myWalletDaiBalance = +await dai.methods.balanceOf(myWalletAddress).call() / 1e18;

    console.log("My Wallet's  ETH Balance:", myWalletEthBalance);
    console.log("My Wallet's cETH Balance:", myWalletCEthBalance);
    console.log("My Wallet's  DAI Balance:", myWalletDaiBalance);

    resolve();
  });
};

const main = async () => {
  await logBalances();

  const ethToSupplyAsCollateral = '1';

  console.log('\nSupplying ETH to Compound as collateral (you will get cETH in return)...\n');
  let mint = await cEth.methods.mint().send({
    from: myWalletAddress,
    gasLimit: web3.utils.toHex(150000),      // posted at compound.finance/developers#gas-costs
    gasPrice: web3.utils.toHex(20000000000), // use ethgasstation.info (mainnet only)
    value: web3.utils.toHex(web3.utils.toWei(ethToSupplyAsCollateral, 'ether'))
  });

  await logBalances();

  console.log('\nEntering market (via Comptroller contract) for ETH (as collateral)...');
  let markets = [cEthAddress]; // This is the cToken contract(s) for your collateral
  let enterMarkets = await comptroller.methods.enterMarkets(markets).send({
    from: myWalletAddress,
    gasLimit: web3.utils.toHex(150000),      // posted at compound.finance/developers#gas-costs
    gasPrice: web3.utils.toHex(20000000000), // use ethgasstation.info (mainnet only)
  });

  console.log('Calculating your liquid assets in Compound...');
  let {1:liquidity} = await comptroller.methods.getAccountLiquidity(myWalletAddress).call();
  liquidity = web3.utils.fromWei(liquidity).toString();

  console.log("Fetching Compound's DAI collateral factor...");
  let {1:collateralFactor} = await comptroller.methods.markets(cDaiAddress).call();
  collateralFactor = (collateralFactor / 1e18) * 100; // Convert to percent


  console.log('Fetching DAI price from the price oracle...');
  let daiPriceInEth = await priceOracle.methods.getUnderlyingPrice(cDaiAddress).call();
  daiPriceInEth = daiPriceInEth / 1e18;


  console.log(`\nYou have ${liquidity} of liquid ETH pooled in Compound.`);
  console.log(`You can borrow up to ${collateralFactor}% of your total assets in Compound as DAI.`);
  console.log(`1 DAI == ${daiPriceInEth.toFixed(6)} ETH`);
  console.log(`You can borrow up to ${liquidity/daiPriceInEth} DAI from Compound.\n`);

  const daiToBorrow = 50;
  console.log(`Now attempting to borrow ${daiToBorrow} DAI...`);
  await cDai.methods.borrow(web3.utils.toWei(daiToBorrow.toString(), 'ether')).send({
    from: myWalletAddress,
    gasLimit: web3.utils.toHex(600000),      // posted at compound.finance/developers#gas-costs
    gasPrice: web3.utils.toHex(20000000000), // use ethgasstation.info (mainnet only)
  });

  await logBalances();
};

main().catch((err) => {
  console.error('ERROR:', err);
});
