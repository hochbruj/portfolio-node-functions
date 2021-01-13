const Web3 = require("web3");
const express = require("express");
const app = express();
const port = 8080; // default port to listen
const apiKey = require("./secrets/apiKeys.json");
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

// define a route handler for the default home page
app.get("/", async (req, res) => {
  //APY
  const lpAddressProviderContract = new web3.eth.Contract(
    LendingPoolAddressesProviderABI,
    LendingPoolAddressesProviderContract["main"]
  );

  // Get the latest LendingPool contract address
  const lpAddress = await lpAddressProviderContract.methods
    .getLendingPool()
    .call();

  //lending pool contract
  const lendingPoolContract = new web3.eth.Contract(LendingPoolABI, lpAddress);

  const block = 11633063 - 1300;

  const aaveResult = await lendingPoolContract.methods
    .getReserveData(DAIContract["main"])
    .call({}, block);

  const aaveAPY = parseFloat(aaveResult.liquidityRate) / 1e25;

  console.log("DAI APY", aaveAPY);

  res.send("All good");
});

// start the Express server
app.listen(port, () => {
  console.log(`server started at http://localhost:${port}`);
});
