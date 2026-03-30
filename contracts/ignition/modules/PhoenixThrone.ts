import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

const PhoenixThroneModule = buildModule("PhoenixThroneModule", (m) => {
  const phoenixThrone = m.contract("PhoenixThrone");
  return { phoenixThrone };
});

export default PhoenixThroneModule;
