import { CircleCIPipelineTrigger } from "./CircleCIPipelineTrigger";
import { context } from "@actions/github";

const trigger = new CircleCIPipelineTrigger(context);
trigger.triggerPipeline();
trigger.monitorWorkflow();
