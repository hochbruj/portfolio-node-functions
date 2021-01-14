const Web3 = require("web3");
const admin = require("firebase-admin");
const apiKey = require("./secrets/apiKeys.json");

//firbease initialization
const serviceAccount = require("./secrets/serviceAccountKey.json");
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});
const db = admin.firestore();

//web initialization
const ethNetwork = "https://api.archivenode.io/" + apiKey.archiveNode;
const web3 = new Web3(new Web3.providers.HttpProvider(ethNetwork));

//Aave contrcts
const {
  LendingPoolAddressesProviderABI,
  LendingPoolAddressesProviderContract,
} = require("./config/contracts/AaveLendingAddressProvider.json");

//DAI/USDC
const { DAIContract } = require("./config/contracts/DAI.json");

const { LendingPoolABI } = require("./config/contracts/AaveLendingPool.json");

//APY
const lpAddressProviderContract = new web3.eth.Contract(
  LendingPoolAddressesProviderABI,
  LendingPoolAddressesProviderContract["main"]
);

const updateApy = async () => {
  // Get the latest LendingPool contract address
  const lpAddress = await lpAddressProviderContract.methods
    .getLendingPool()
    .call();

  //lending pool contract
  const lendingPoolContract = new web3.eth.Contract(LendingPoolABI, lpAddress);

  //start block
  const startBlock = await web3.eth.getBlockNumber();
  //const startBlock = 9346088;

  //get apy for past blocks
  const maxEntries = 48;

  let sumAPY = 0;
  let divider = 0;

  //get first block for datetermination
  let blockResult = await web3.eth.getBlock(startBlock);
  let old_date = new Date(blockResult.timestamp * 1000);

  for (i = 1; i <= maxEntries; i++) {
    const block = startBlock - i * 240; //hours
    blockResult = await web3.eth.getBlock(block);

    const aaveResult = await lendingPoolContract.methods
      .getReserveData(DAIContract["main"])
      .call({}, block);

    const aaveAPY = parseFloat(aaveResult.liquidityRate) / 1e25;

    // const data = {
    //   timestamp: admin.firestore.Timestamp.fromMillis(
    //     blockResult.timestamp * 1000
    //   ),
    //   block: block,
    //   apy: aaveAPY,
    // };

    var date = new Date(blockResult.timestamp * 1000);
    console.log(old_date);
    console.log(date);
    if (old_date.getDate() === date.getDate()) {
      sumAPY += aaveAPY;
      divider++;
    } else {
      //prepare date for firebase
      const dateFb = new Date(
        date.getFullYear(),
        date.getMonth(),
        date.getDate(),
        0,
        0,
        0,
        0
      );

      //save old values
      console.log(dateFb);
      console.log("Value to save", sumAPY / divider);

      const data = {
        timestamp: admin.firestore.Timestamp.fromDate(dateFb),
        block: block,
        apy: sumAPY / divider,
      };

      // Add a new document in collection "cities" with ID 'LA'
      const dbRes = await db.collection("aave").doc().set(data);
      //reset new ones
      sumAPY = aaveAPY;
      divider = 1;
    }

    console.log("Apy", aaveAPY);
    console.log("sum apy", sumAPY);
    console.log("divider", divider);

    old_date = date;

    //console.log("saved to db", dbRes);
  }
};

updateApy();
