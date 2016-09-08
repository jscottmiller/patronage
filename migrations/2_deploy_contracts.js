module.exports = function(deployer, network) {
  if (network != 'live') {
    deployer.deploy(PatronageRegistry);
    deployer.deploy(SimpleCustodian);
    deployer.deploy(Exchange);
  }
  //deployer.deploy(RevenueSharing);
};
