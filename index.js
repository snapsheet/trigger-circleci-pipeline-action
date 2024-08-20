import {
  getInput,
  setFailed,
  startGroup,
  endGroup,
  info,
  notice,
  setOutput,
  error as coreError,
} from "@actions/core";
import { context } from "@actions/github";
import axios from "axios";
import axiosRetry from "axios-retry";

startGroup("Preparing CircleCI Pipeline Trigger");
const repoOrg = context.repo.owner;
const repoName = context.repo.repo;
info(`Org: ${repoOrg}`);
info(`Repo: ${repoName}`);
const ref = context.ref;
const headRef = process.env.GITHUB_HEAD_REF;

const getBranch = () => {
  if (ref.startsWith("refs/heads/")) {
    return ref.substring(11);
  } else if (ref.startsWith("refs/pull/") && headRef) {
    info(`This is a PR. Using head ref ${headRef} instead of ${ref}`);
    return headRef;
  }
  return ref;
};
const getTag = () => {
  if (ref.startsWith("refs/tags/")) {
    return ref.substring(10);
  }
};

const headers = {
  "content-type": "application/json",
  "x-attribution-login": context.actor,
  "x-attribution-actor-id": context.actor,
  "Circle-Token": `${process.env.CCI_TOKEN}`,
};
const parameters = {
  GHA_Actor: context.actor,
  GHA_Action: context.action,
  GHA_Event: context.eventName,
};

const ghaData = getInput("GHA_Data");
if (ghaData.length > 0) {
  Object.assign(parameters, { GHA_Data: ghaData });
}

const metaData = getInput("GHA_Meta");
if (metaData.length > 0) {
  Object.assign(parameters, { GHA_Meta: metaData });
}

const cciContext = getInput("CCI_Context");
if (cciContext.length > 0) {
  Object.assign(parameters, { CCI_Context: cciContext });
}

let followWorkflow = getInput("Follow").toLowerCase() == "true";

const body = {
  parameters: parameters,
};

const tag = getTag();
const branch = getBranch();

if (tag) {
  Object.assign(body, { tag });
} else {
  Object.assign(body, { branch });
}

const baseURL = "https://circleci.com/api/v2";

info(`Triggering CircleCI Pipeline for ${repoOrg}/${repoName}`);
if (tag) {
  info(`Triggering tag: ${tag}`);
} else {
  info(`Triggering branch: ${branch}`);
}
info(`Parameters:\n${JSON.stringify(parameters)}`);
endGroup();

let client = axios.create({baseURL, headers});

axiosRetry(
  client,
  {
    retries: 3,
    retryDelay: axiosRetry.exponentialDelay
  }
);

client
  .post(`/project/gh/${repoOrg}/${repoName}/pipeline`, body)
  .then((response) => {
    startGroup("Successfully triggered CircleCI Pipeline");
    info(`CircleCI API Response: ${JSON.stringify(response.data)}`);
    setOutput("created_at", response.data.created_at);
    setOutput("id", response.data.id);
    setOutput("number", response.data.number);
    setOutput("state", response.data.state);
    endGroup();
    notice(
      `Monitor the workflow in CircleCI with:  https://app.circleci.com/pipelines/github/${repoOrg}/${repoName}/${response.data.number}`
    );
    
    if (followWorkflow) {
      info("Polling CircleCI Workflow");
    }
  
    client.interceptors.response.use(async (response) => {
      // always reject and handle retry logic via axios-retry config
      return Promise.reject(response);
    });
    
    const maxDelay = 4;
    client
      .get(`/pipeline/${response.data.id}/workflow`, {
        'axios-retry': {
          retries: (60 / maxDelay) * 60, // retry for
          retryDelay: () => {
            // ...add any other custom logic for jitter.
            return maxDelay * 1000; // in milliseconds
          },
          retryCondition: (response) => {
            let result = axiosRetry.isNetworkOrIdempotentRequestError(response);
            result ||= ["not_run", "on_hold", "running"].includes(response.data.items[0].status);

            return result;
          },
          onMaxRetryTimesExceeded: (error, retryCount) => {
            setFailed(`Failure: CircleCI Workflow ${response.data.items[0].status}`);
          }
        }
      }).then((response) => {
        info("CircleCI Workflow is complete");
      })
    .catch((error) => {
      setFailed(`Failed after retries: ${error.message}`);
    });
  })
  .catch((error) => {
    startGroup("Failed to trigger CircleCI Pipeline");
    coreError(error);
    setFailed(error.message);
    endGroup();
  });
