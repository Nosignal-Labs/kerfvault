export interface DeploymentFile {
  network: string;
  rpcUrl: string;
  networkPassphrase: string;
  contracts: {
    kerfvault: string;
    testAssetSac?: string;
    nativeSac?: string;
  };
  asset?: {
    code: string;
    issuer: string;
    id: string;
  };
  accounts?: {
    deployer?: string;
    issuer?: string;
    merchant?: string;
  };
}

export interface ClientConfig {
  contractId: string;
  rpcUrl: string;
  networkPassphrase: string;
  testAssetSac?: string;
  nativeSac?: string;
}

/**
 * Loads and validates client network settings and contract IDs from a deployment configuration object or JSON string.
 */
export function loadDeploymentConfig(deployment: DeploymentFile | string): ClientConfig {
  let data: DeploymentFile;
  if (typeof deployment === "string") {
    try {
      data = JSON.parse(deployment);
    } catch {
      throw new Error("Invalid deployment JSON configuration string");
    }
  } else {
    data = deployment;
  }

  if (!data || typeof data !== "object") {
    throw new Error("Deployment configuration must be a valid object");
  }

  if (!data.contracts || typeof data.contracts !== "object" || !data.contracts.kerfvault) {
    throw new Error("Missing contracts.kerfvault contract address in deployment configuration");
  }

  if (!data.rpcUrl || typeof data.rpcUrl !== "string") {
    throw new Error("Missing rpcUrl in deployment configuration");
  }

  if (!data.networkPassphrase || typeof data.networkPassphrase !== "string") {
    throw new Error("Missing networkPassphrase in deployment configuration");
  }

  return {
    contractId: data.contracts.kerfvault,
    rpcUrl: data.rpcUrl,
    networkPassphrase: data.networkPassphrase,
    testAssetSac: data.contracts.testAssetSac,
    nativeSac: data.contracts.nativeSac,
  };
}
