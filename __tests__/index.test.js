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

        // jest.spyOn(core, 'error').mockImplementation(jest.fn());
        // jest.spyOn(core, 'warning').mockImplementation(jest.fn());
        // jest.spyOn(core, 'info').mockImplementation(jest.fn());
        // jest.spyOn(core, 'debug').mockImplementation(jest.fn());
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
        // mock setTimeout to avoid waiting for 3 seconds
        //             await new Promise((resolve) => setTimeout(resolve, 3000));
        jest.spyOn(global, 'setTimeout').mockImplementation((cb) => cb());
    });

    afterAll(() => {
        jest.restoreAllMocks();
    });


    it('should retry the request if the first attempt fails', async () => {
        jest.mock('axios', () => {
          let counter = 0;
          const originalAxios = jest.requireActual('axios');
          return {
            ...originalAxios,
            get: (async(url, headers) => {
                console.log("Get request");
                ++counter;
                console.log("counter increased " + counter);
                return {
                  data: { items : [{ status : "success"}] }
                };             
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
        console.log("before promise");
        await require("../index");
        await new Promise((resolve) => setTimeout(resolve, 4000));
        console.log("It is fine till here");
      });
      
});
