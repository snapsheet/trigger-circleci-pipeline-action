// import { Context } from "@actions/github/lib/context";
let {expect, test, jest, beforeAll, afterAll} = require("@jest/globals");
import * as github from '@actions/github';
import * as core from '@actions/core';

let inputs = {
  "GHA_Data": "",
  "GHA_Meta": "",
  "CCI_Context": "",
  "Follow": "false"
};
let originalContext = {...github.context};
process.env["GITHUB_REPOSITORY"] = "testOwner/testRepo";
process.env["GITHUB_HEAD_REF"] = "";
// const originalGitHubWorkspace = process.env['GITHUB_WORKSPACE']

beforeAll(() => {
    // Mock getInput
    jest.spyOn(core, 'getInput').mockImplementation((name) => {
      return inputs[name]
    })

    // Mock error/warning/info/debug
    jest.spyOn(core, 'error').mockImplementation(jest.fn())
    jest.spyOn(core, 'warning').mockImplementation(jest.fn())
    jest.spyOn(core, 'info').mockImplementation(jest.fn())
    jest.spyOn(core, 'debug').mockImplementation(jest.fn())

    // Mock github context
    jest.spyOn(github.context, 'repo', 'get').mockImplementation(() => {
      return {
        owner: 'some-owner',
        repo: 'some-repo'
      }
    })
    github.context.ref = 'refs/heads/some-ref'
    github.context.sha = '1234567890123456789012345678901234567890'
});

afterAll(() => {
  // Restore @actions/github context
  github.context.ref = originalContext.ref
  github.context.sha = originalContext.sha

  // Restore
  jest.restoreAllMocks()
});

test("index should execute", async () => {
  await expect(async () => {
    await require("../index");
  }).not.toThrow();
});
