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
    });

    afterAll(() => {
        jest.restoreAllMocks();
    });

    it('should retry the request if the first attempt fails', async () => {
        const url = `https://circleci.com/api/v2/project/gh/some-owner/some-repo/pipeline`;
        const pollingUrl = `https://circleci.com/api/v2/pipeline/12345/workflow`;

        let requestCount = 0;

        nock(url)
            .post('')
            .reply(200, { created_at: "date", id: "12345", number: "1", state: "running" });

        nock(pollingUrl)
            .get('')
            .reply(500, () => {
                requestCount++;
                return { message: 'Internal Server Error' };
            })
            .get('')
            .reply(500, () => {
                requestCount++;
                return { message: 'Internal Server Error' };
            })
            .get('')
            .reply(500, () => {
                requestCount++;
                return { message: 'Internal Server Error' };
            })
            .get('')
            .reply(500, () => {
                requestCount++;
                return { message: 'Internal Server Error' };
            });

        await expect(async () => {
            await require("../index");
        }).not.toThrow();

        expect(requestCount).toBeGreaterThan(1);
    });
});
