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


export class CircleCIPipelineTrigger {
    constructor(context) {
        axiosRetry(axios, { retries: 3, retryDelay: axiosRetry.exponentialDelay });
        (async () => {
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

        const url = `https://circleci.com/api/v2/project/gh/${repoOrg}/${repoName}/pipeline`;

        info(`Triggering CircleCI Pipeline for ${repoOrg}/${repoName}`);
        info(`Triggering URL: ${url}`);
        if (tag) {
            info(`Triggering tag: ${tag}`);
        } else {
            info(`Triggering branch: ${branch}`);
        }
        info(`Parameters:\n${JSON.stringify(parameters)}`);
        endGroup();

        let workFlowUrl = null;

        await axios
            .post(url, body, { headers: headers })
            .then(async (response) => {
            startGroup("Successfully triggered CircleCI Pipeline");
            info(`CircleCI API Response: ${JSON.stringify(response.data)}`);
            setOutput("created_at", response.data.created_at);
            setOutput("id", response.data.id);
            setOutput("number", response.data.number);
            setOutput("state", response.data.state);
            workFlowUrl = `https://circleci.com/api/v2/pipeline/${response.data.id}/workflow`;
            endGroup();
            notice(
                `Monitor the workflow in CircleCI with:  https://app.circleci.com/pipelines/github/${repoOrg}/${repoName}/${response.data.number}`
            );

            if (followWorkflow && workFlowUrl) {
                try {
                console.log("Testing the monitorWorkflow function");
                await monitorWorkflow(workFlowUrl, headers);
                console.log("monitorWorkflow function is completed");
                } catch (error) {
                setFailed(`Failed to monitor CircleCI workflow: ${error.message}`);
                }
            }
            })
            .catch((error) => {
            startGroup("Failed to trigger CircleCI Pipeline");
            coreError(error);
            setFailed(error.message);
            endGroup();
            followWorkflow = false;
            });
        });

    }   

    async monitorWorkflow(url, headers) {
        let workflowComplete = false;
        console.log("Starting monitorWorkflow");
        while (!workflowComplete) {
            try {
                console.log("Trying to get workflow status");
                const response = await axios.get(url, { headers });
                console.log("Got response");
                const status = response.data.items[0].status;

                if (!["not_run", "on_hold", "running"].includes(status)) {
                    console.log("Inside if");
                    workflowComplete = true;
                    if (status === "success") {
                        console.log("Is successful");
                        info("CircleCI Workflow is complete");
                        console.log("CCI workflow is complete");
                    } else {
                        setFailed(`Failure: CircleCI Workflow ${status}`);
                    }
                } else {
                    info(`Workflow status: ${status}. Continuing to monitor...`);
                }
                console.log("Going to sleep for 3 seconds");
                await new Promise((resolve) => setTimeout(resolve, 3000));
                console.log("Sleeping for 3 seconds done");
                console.log("End of while loop");
                console.log("workflowComplete: ", workflowComplete);
            } catch (error) {
                coreError(`Error monitoring workflow: ${error.message}`);
                throw error;
            }
        }
        console.log("End of monitorWorkflow");
    }

}



        // const pollWorkflow = () => {
        //   axios
        //     .get(workFlowUrl, {
        //       headers: headers,
        //     })
        //     .then((response) => {
        //       error(`called inside pollWorkflow`);
        //       error(response);
        //       if (
        //         !["not_run", "on_hold", "running"].includes(
        //           response.data.items[0].status
        //         )
        //       ) {
        //         followWorkflow = false;
        //         if (response.data.items[0].status == "success") {
        //           info("CircleCI Workflow is complete");
        //         } else {
        //           setFailed(
        //             `Failure: CircleCI Workflow ${response.data.items[0].status}`
        //           );
        //         }
        //       }
        //     })
        //     .catch((error) => {
        //       setFailed(`Failed after retries: ${error.message}`);
        //       followWorkflow = false;
        //     });
        // };

        // if (followWorkflow) {
        //   info("Polling CircleCI Workflow");
        //   const pollInterval = 3000; // in milliseconds
        //   const checkWorkflowStatus = setInterval(() => {
        //     if (!followWorkflow) {
        //       clearInterval(checkWorkflowStatus);
        //     } else {
        //       pollWorkflow();
        //     }
        //   }, pollInterval);
        // }