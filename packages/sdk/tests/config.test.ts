import { describe, it, expect } from "vitest";
import {
  loadDeploymentConfig,
  KerfvaultClient,
  type DeploymentFile,
} from "../src/index.js";

describe("Deployment configuration loader", () => {
  const sampleDeployment: DeploymentFile = {
    network: "testnet",
    rpcUrl: "https://soroban-testnet.stellar.org",
    networkPassphrase: "Test SDF Network ; September 2015",
    contracts: {
      kerfvault: "CBGA55JOTTZKW44Z6Y67RMJNT3ZKN42CGVXBA35KQRGL6R3AIZOKXGFE",
      testAssetSac: "CDE6VINFMZEDXBFM52ORE62FVN2NTHBFD27AVAF4TQO73IPJRZCL65XN",
      nativeSac: "CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC",
    },
    asset: {
      code: "KVUSD",
      issuer: "GCOQSUSRFKOLBTEMY5THMHIMLOLILMI6WI4R6XGT3LJ2YGHXFTADSTLD",
      id: "KVUSD:GCOQSUSRFKOLBTEMY5THMHIMLOLILMI6WI4R6XGT3LJ2YGHXFTADSTLD",
    },
  };

  it("loads configuration from a valid deployment object", () => {
    const config = loadDeploymentConfig(sampleDeployment);
    expect(config.contractId).toBe("CBGA55JOTTZKW44Z6Y67RMJNT3ZKN42CGVXBA35KQRGL6R3AIZOKXGFE");
    expect(config.rpcUrl).toBe("https://soroban-testnet.stellar.org");
    expect(config.networkPassphrase).toBe("Test SDF Network ; September 2015");
    expect(config.testAssetSac).toBe("CDE6VINFMZEDXBFM52ORE62FVN2NTHBFD27AVAF4TQO73IPJRZCL65XN");
    expect(config.nativeSac).toBe("CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC");
  });

  it("loads configuration from a valid JSON string", () => {
    const jsonStr = JSON.stringify(sampleDeployment);
    const config = loadDeploymentConfig(jsonStr);
    expect(config.contractId).toBe(sampleDeployment.contracts.kerfvault);
    expect(config.rpcUrl).toBe(sampleDeployment.rpcUrl);
  });

  it("instantiates KerfvaultClient via fromDeployment", () => {
    const client = KerfvaultClient.fromDeployment(sampleDeployment);
    expect(client).toBeInstanceOf(KerfvaultClient);
    expect(client.config.contractId).toBe(sampleDeployment.contracts.kerfvault);
    expect(client.config.rpcUrl).toBe(sampleDeployment.rpcUrl);
  });

  it("throws on invalid JSON string", () => {
    expect(() => loadDeploymentConfig("invalid json{")).toThrow("Invalid deployment JSON");
  });

  it("throws when kerfvault contract address is missing", () => {
    const invalid = {
      ...sampleDeployment,
      contracts: {},
    } as DeploymentFile;
    expect(() => loadDeploymentConfig(invalid)).toThrow("Missing contracts.kerfvault");
  });

  it("throws when rpcUrl is missing", () => {
    const invalid = {
      ...sampleDeployment,
      rpcUrl: "",
    };
    expect(() => loadDeploymentConfig(invalid)).toThrow("Missing rpcUrl");
  });

  it("throws when networkPassphrase is missing", () => {
    const invalid = {
      ...sampleDeployment,
      networkPassphrase: "",
    };
    expect(() => loadDeploymentConfig(invalid)).toThrow("Missing networkPassphrase");
  });
});
