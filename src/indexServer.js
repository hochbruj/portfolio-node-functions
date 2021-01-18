const Web3 = require('web3');
const express = require('express');
const admin = require('firebase-admin');
const app = express();
const port = 8080; // default port to listen
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
const { DAIContract } = require('./config/contracts/DAI.json');

const { LendingPoolABI } = require('./config/contracts/AaveLendingPool.json');

// define a route handler for the default home page
app.get('/', async (req, res) => {
  //APY
  const lpAddressProviderContract = new web3.eth.Contract(
    LendingPoolAddressesProviderABI,
    LendingPoolAddressesProviderContract['main']
  );

  // Get the latest LendingPool contract address
  const lpAddress = await lpAddressProviderContract.methods
    .getLendingPool()
    .call();

  //lending pool contract
  const lendingPoolContract = new web3.eth.Contract(LendingPoolABI, lpAddress);

  //current block
  const currentBlock = await web3.eth.getBlockNumber();
  const block = currentBlock - 240;

  var result = await web3.eth.getBlock(block);

  const aaveResult = await lendingPoolContract.methods
    .getReserveData(USDCContract['main'])
    .call({}, block);

  const aaveAPY = parseFloat(aaveResult.liquidityRate) / 1e25;

  console.log('DAI APY', new Date(result.timestamp * 1000), aaveAPY);

  const data = {
    timestamp: admin.firestore.Timestamp.fromMillis(result.timestamp * 1000),
    block: block,
    apy: aaveAPY,
  };

  // Add a new document in collection "cities" with ID 'LA'
  const dbRes = await db
    .collection('aave')
    .doc()
    .set(data);

  res.json(dbRes);
});

// start the Express server
app.listen(port, () => {
  console.log(`server started at http://localhost:${port}`);
});
