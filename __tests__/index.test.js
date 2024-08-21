let { expect, test, jest, beforeAll, afterAll } = require("@jest/globals");
import * as github from '@actions/github';
import * as core from '@actions/core';
const axios = require('axios');
const nock = require('nock');
const axiosRetry = require('axios-retry');

let inputs = {
    "GHA_Data": JSON.stringify({
        "deployment_ref": "master",
        "environment_name": "qa1",
        "skip-github": "false",
        "skip-web": "false",
        "verbose": "false",
        "region": "us-west-1"
    }),
    "GHA_Meta": "qa1",
    "CCI_Context": "qa",
    "Follow": "true"
};
let originalContext = { ...github.context };
process.env["GITHUB_REPOSITORY"] = "testOwner/testRepo";
process.env["GITHUB_HEAD_REF"] = "";

axiosRetry(axios, { retries: 3, retryDelay: axiosRetry.exponentialDelay });

describe('Axios retry on failure', () => {
    beforeAll(() => {
        jest.spyOn(core, 'getInput').mockImplementation((name) => {
            return inputs[name];
        });

        jest.spyOn(core, 'error').mockImplementation(jest.fn());
        jest.spyOn(core, 'warning').mockImplementation(jest.fn());
        jest.spyOn(core, 'info').mockImplementation(jest.fn());
        jest.spyOn(core, 'debug').mockImplementation(jest.fn());

        jest.spyOn(github.context, 'repo', 'get').mockImplementation(() => {
            return {
                owner: 'some-owner',
                repo: 'some-repo'
            };
        });
        github.context.actor = 'test-actor';
        github.context.ref = 'refs/heads/some-ref';
        github.context.sha = '1234567890123456789012345678901234567890';
        
        jest.useFakeTimers(); // Use fake timers to control setInterval
    });

    afterAll(() => {
        jest.restoreAllMocks();
    });


    it('should retry the request if the first attempt fails', async () => {
        let counter = 0;
        jest.mock('axios', () => {
          const originalAxios = jest.requireActual('axios');
          return {
            ...originalAxios,
            get: (async(url, headers) => {
              throw new Error('Request failed');
            }),
            post: (async (url, body, headers) => {
              return {
                data: {
                  created_at: "date",
                  id: "12345",
                  number: "1",
                  state: "running"
                }
              };
            })
          }
        });
        require("../index");
        jest.advanceTimersByTime(10000);
        await waitForPollToFinish();
        
      });
});


function waitForPollToFinish() {
    return new Promise((resolve) => {
        const checkInterval = setInterval(() => {
            // Check a condition to see if polling is done
            if (!global.followWorkflow) { // Replace this with your actual condition
                clearInterval(checkInterval);
                resolve();
            }
        }, 100); // Check every 100ms
    });
}