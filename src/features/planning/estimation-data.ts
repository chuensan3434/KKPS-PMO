import type { EstimationState } from "./types";

export const defaultEstimationState: EstimationState = {
  version: 1,
  projects: [
    { projectId: "crm", requirements: [
      { id: "crm-profile", projectId: "crm", title: "Customer profile maintenance", description: "Allow operations users to update customer profile data.", category: "Feature", status: "estimated", estimates: [
        { squadId: "alpha", devMd: 20, testMd: 10 }, { squadId: "beta", devMd: 15, testMd: 5 },
      ] },
      { id: "crm-search", projectId: "crm", title: "Customer search", description: "Improve customer lookup and filtering.", category: "Feature", status: "estimated", estimates: [
        { squadId: "alpha", devMd: 20, testMd: 10 }, { squadId: "beta", devMd: 10, testMd: 10 }, { squadId: "gamma", devMd: 15, testMd: 5 },
      ] },
    ] },
    { projectId: "onboarding", requirements: [] },
    { projectId: "risk", requirements: [] },
  ],
};
