import { CircleCIPipelineTrigger } from "./CircleCIPipelineTrigger";
import { context } from "@actions/github";

await new CircleCIPipelineTrigger(context);