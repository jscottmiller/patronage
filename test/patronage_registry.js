import {assertThrows} from './helpers.js';

contract('PatronageRegistry', function(accounts) {
  it("should not allow default sends", async function() {
    const registry = PatronageRegistry.deployed();
    const registrar = await registry.registrar();
    const other = accounts.find(function(a) { return a != registrar });
    const startingBalance = web3.eth.getBalance(registrar);
    await assertThrows(async () => {
      await web3.eth.sendTransaction({from: patron, to: address, value: donationAmount});
    });
    const endingBalance = await web3.eth.getBalance(registrar);
    assert.equal(startingBalance.toString(), endingBalance.toString());
  });

  it("should allow the registrar to update registrar", async function() {
    const registry = PatronageRegistry.deployed();
    const originalRegistrar = await registry.registrar();
    const newRegistrar = accounts.find(function(a) { return a != originalRegistrar });
    await registry.updateRegistrar(newRegistrar, {from: originalRegistrar});
    assert.equal(newRegistrar, await registry.registrar());
  });

  it("shouldn't allow others to update the registrar", async function() {
    const registry = PatronageRegistry.deployed();
    const originalRegistrar = await registry.registrar();
    const newRegistrar = accounts.find(function(a) { return a != originalRegistrar });
    await assertThrows(async () => {
      await registry.updateRegistrar(newRegistrar, {from: newRegistrar});
    });
    assert.equal(originalRegistrar, await registry.registrar());
  });

  it("should allow the registrar to register a new name", async function() {
    const registry = PatronageRegistry.deployed();
    const username = 'user' + Math.floor(10000 * Math.random());
    const registrar = await registry.registrar();
    const payoutAddress = accounts.find(function(a) { return a != registrar; });
    await registry.registerUsername(username, payoutAddress, {from: registrar});
    const contractAddress = await registry.patronageContractForUsername.call(username);
    const patronage = Patronage.at(contractAddress);
    assert.equal(payoutAddress, await patronage.payoutAddress());
  });

  it("shouldn't allow a non-registrar to register a name", async function() {
    const registry = PatronageRegistry.deployed();
    const username = 'user' + Math.floor(10000 * Math.random());
    const registrar = await registry.registrar();
    const other = accounts.find(function(a) { return a != registrar });
    await assertThrows(async () => {
      await registry.registerUsername(username, other, {from: other});
    });
  });

  it("shouldn't allow the same name to be registered twice", async function() {
    const registry = PatronageRegistry.deployed();
    const username = 'user' + Math.floor(10000 * Math.random());
    const registrar = await registry.registrar();
    const payoutAddress = accounts.find(function(a) { return a != registrar; });
    await registry.registerUsername(username, payoutAddress, {from: registrar});
    const patronageAddress = await registry.patronageContractForUsername.call(username);
    const patronage = Patronage.at(patronageAddress);
    assert.equal(payoutAddress, await patronage.payoutAddress());
    const other = accounts.find(function(a) { return [registrar, payoutAddress].indexOf(a) == -1; });
    await assertThrows(async () => {
      await registry.registerUsername(username, other, {from: registrar});
    });
    assert.equal(payoutAddress, await patronage.payoutAddress());
  });

  it("should allow patronage owners to update payout address", async function() {
    const registry = PatronageRegistry.deployed();
    const username = 'user' + Math.floor(10000 * Math.random());
    const registrar = await registry.registrar();
    const payoutAddress = accounts.find(function(a) { return a != registrar; });
    await registry.registerUsername(username, payoutAddress, {from: registrar});
    const patronageAddress = await registry.patronageContractForUsername.call(username);
    const patronage = Patronage.at(patronageAddress);
    assert.equal(payoutAddress, await patronage.payoutAddress());
    const newPayoutAddress = accounts.find(function(a) { 
      return [registrar, payoutAddress].indexOf(a) == -1;
    });
    await patronage.updatePayoutAddress(newPayoutAddress, {from: payoutAddress});
    assert.equal(newPayoutAddress, await patronage.payoutAddress());
  });

  it("shouldn't allow others to update payout address", async function() {
    const registry = PatronageRegistry.deployed();
    const username = 'user' + Math.floor(10000 * Math.random());
    const registrar = await registry.registrar();
    const payoutAddress = accounts.find(function(a) { return a != registrar; });
    await registry.registerUsername(username, payoutAddress, {from: registrar});
    const patronageAddress = await registry.patronageContractForUsername.call(username);
    const patronage = Patronage.at(patronageAddress);
    assert.equal(payoutAddress, await patronage.payoutAddress());
    const other = accounts.find(function(a) { 
      return [registrar, payoutAddress].indexOf(a) == -1;
    });
    await assertThrows(async () => {
      await patronage.updatePayoutAddress(other, {from: registrar});
    });
    assert.equal(payoutAddress, await patronage.payoutAddress());
  });

  it("should not allow withdrawals if balance is zero", async function() {
    const registry = PatronageRegistry.deployed();
    const username = 'user' + Math.floor(10000 * Math.random());
    const registrar =  await registry.registrar();
    const payoutAddress = accounts.find(function(a) { return a != registrar; });
    await registry.registerUsername(username, payoutAddress, {from: registrar});
    const patronageAddress = await registry.patronageContractForUsername.call(username);
    const patronage = Patronage.at(patronageAddress);
    await assertThrows(async () => patronage.withdrawal());
  });

  it("should pay balance to shareholders and owner", async function() {
    const registry = PatronageRegistry.deployed();
    const username = 'user' + Math.floor(10000 * Math.random());
    const donationAmount = 10000;
    const registrar = await registry.registrar();
    const shareholders = await registry.shareholders();
    const payoutAddress = accounts.find(function(a) { 
      return a != registrar && a != shareholders; 
    });
    const payoutBalance = await web3.eth.getBalance(payoutAddress);
    const shareholderBalance = await web3.eth.getBalance(shareholders);
    await registry.registerUsername(username, payoutAddress, {from: registrar});
    const patronageAddress = await registry.patronageContractForUsername.call(username);
    const patronage = Patronage.at(patronageAddress);
    const patron = accounts.find(function(a) { 
      return [registrar, payoutAddress, shareholders].indexOf(a) == -1; 
    });
    await web3.eth.sendTransaction({from: patron, to: patronageAddress, value: donationAmount});
    assert.equal(donationAmount, web3.eth.getBalance(patronageAddress).toNumber());
    await patronage.withdrawal({from: registrar});
    assert.equal(0, web3.eth.getBalance(patronageAddress).toNumber());
    assert.equal(payoutBalance.add(9000).toString(), web3.eth.getBalance(payoutAddress).toString());
    assert.equal(shareholderBalance.add(1000).toString(), web3.eth.getBalance(shareholders).toString());
  });
});
