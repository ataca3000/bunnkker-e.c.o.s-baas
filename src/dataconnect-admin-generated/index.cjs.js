const { validateAdminArgs } = require('firebase-admin/data-connect');

const connectorConfig = {
  connector: 'default',
  serviceId: 'admin-erp-pro-1-service',
  location: 'us-east4'
};
exports.connectorConfig = connectorConfig;

function createUser(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeMutation('CreateUser', inputVars, inputOpts);
}
exports.createUser = createUser;

function getMyCart(dcOrOptions, options) {
  const { dc: dcInstance, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrOptions, options, undefined);
  dcInstance.useGen(true);
  return dcInstance.executeQuery('GetMyCart', undefined, inputOpts);
}
exports.getMyCart = getMyCart;

function addToCart(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeMutation('AddToCart', inputVars, inputOpts);
}
exports.addToCart = addToCart;

function listAvailableProducts(dcOrOptions, options) {
  const { dc: dcInstance, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrOptions, options, undefined);
  dcInstance.useGen(true);
  return dcInstance.executeQuery('ListAvailableProducts', undefined, inputOpts);
}
exports.listAvailableProducts = listAvailableProducts;

