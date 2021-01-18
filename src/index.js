const Web3 = require('web3');
const admin = require('firebase-admin');
const apiKey = require('./secrets/apiKeys.json');

//firbease initialization
const serviceAccount = require('./secrets/serviceAccountKey.json');
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});
const db = admin.firestore();

//web initialization
const ethNetwork = 'https://api.archivenode.io/' + apiKey.archiveNode;
const web3 = new Web3(new Web3.providers.HttpProvider(ethNetwork));

//Aave contrcts
const {
  LendingPoolAddressesProviderABI,
  LendingPoolAddressesProviderContract,
} = require('./config/contracts/AaveLendingAddressProvider.json');

//DAI/USDC
const { stableCoins } = require('./config/contracts/stableCoins.json');

//Aave Lending pool
const { LendingPoolABI } = require('./config/contracts/AaveLendingPool.json');
const lpAddressProviderContract = new web3.eth.Contract(
  LendingPoolAddressesProviderABI,
  LendingPoolAddressesProviderContract['main']
);

//ERC20 ABI for ctoken
const erc20ABI = require('./config/contracts/erc20.json');

const updateApy = async (coin) => {
  // Get the latest LendingPool contract address
  const lpAddress = await lpAddressProviderContract.methods
    .getLendingPool()
    .call();

  //lending pool contract
  const lendingPoolContract = new web3.eth.Contract(LendingPoolABI, lpAddress);

  //Compound c token
  const ctoken = new web3.eth.Contract(erc20ABI, stableCoins[coin]);

  //start block
  const startBlock = await web3.eth.getBlockNumber();
  //const startBlock = 9275708;

  //get apy for past blocks
  const maxEntries = 50;

  let sumApy = 0;
  let divider = 0;

  //get first block for datetermination
  let blockResult = await web3.eth.getBlock(startBlock);
  let old_date = new Date(blockResult.timestamp * 1000);

  for (i = 1; i <= maxEntries; i++) {
    const block = startBlock - i * 240; //hours
    let apy;
    try {
      console.log('Block', block);
      blockResult = await web3.eth.getBlock(block);

      if (coin.charAt(0) === 'a') {
        //APY for Aave
        const aaveResult = await lendingPoolContract.methods
          .getReserveData(stableCoins[coin])
          .call({}, block);
        apy = parseFloat(aaveResult.liquidityRate) / 1e25;
      } else if (coin.charAt(0) === 'c') {
        // //APY for compound
        const supplyRatePerBlock = await ctoken.methods
          .supplyRatePerBlock()
          .call();
        const ethMantissa = 1e18;
        const blocksPerDay = 4 * 60 * 24;
        const daysPerYear = 365;

        apy =
          (Math.pow(
            (supplyRatePerBlock / ethMantissa) * blocksPerDay + 1,
            daysPerYear - 1
          ) -
            1) *
          100;
      }

      var date = new Date(blockResult.timestamp * 1000);

      if (old_date.getUTCDate() === date.getUTCDate()) {
        sumApy += apy;
        divider++;
      } else {
        //prepare date for firebase
        const dateString = old_date.toISOString().split('T')[0];
        //save old values
        console.log(dateString);
        console.log('Value to save', sumApy / divider);

        const data = {
          date: dateString,
          block: block,
          apy: sumApy / divider,
        };

        // Add a new document in collection of aave coin
        const dbRes = await db
          .collection(coin)
          .doc(dateString)
          .set(data);
        //reset new ones
        sumAPY = apy;
        divider = 1;
      }

      console.log('Apy', apy);
      console.log('sum apy', apy);
      console.log('divider', divider);

      old_date = date;
    } catch (err) {
      console.log('error:', err);
    }
  }
};

updateApy('cDAI');
