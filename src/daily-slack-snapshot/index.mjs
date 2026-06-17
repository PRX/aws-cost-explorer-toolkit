/** @import { AllMessageEvents } from "@slack/types" */

import {
  EventBridgeClient,
  PutEventsCommand,
} from "@aws-sdk/client-eventbridge";
import dailyCost, { usageFilter } from "./cost.mjs";
import dailyCoverage from "./coverage.mjs";
import dailyUtilization from "./utilization.mjs";
import { getDateStringsForRange } from "./util.mjs";
import { log } from "console";

const eventbridge = new EventBridgeClient({ apiVersion: "2015-10-07" });

export const handler = async () => {
  const now = new Date(Date.now());

  // Cost Explorer API always works off UTC, and uses an exclusive end date. We
  // always use the current UTC midnight as the end date. So if it's currenly
  // 11 PM ET on the 15th, that would be 4 AM UTC on the 16th, and we would use
  // and end date of midnight on the 16th. In most cases CE will have data up
  // to and including the 15th, so an end date of the 16th is what we want.
  const rangeEnd = new Date(now);
  rangeEnd.setUTCHours(0, 0, 0);

  // Go back a bunch of days. We only ever show a max of 20 data point because
  // that's Slack's limit for a single series, but we fetch a few more days
  // than that because sometimes CE is missing the most recent day or two.
  const rangeStart = new Date(rangeEnd);
  rangeStart.setDate(rangeStart.getDate() - 24);

  const blocks = [
    // await dailyUtilization(rangeStart, rangeEnd),
    await dailyCoverage(rangeStart, rangeEnd),
    // await dailyCost(rangeStart, rangeEnd, false),
    // await dailyCost(rangeStart, rangeEnd, usageFilter),
  ];

  for (const block of blocks) {
    /** @type {AllMessageEvents} */
    const msg = {
      // channel: "G9MGS7W8N", // #ops-billing
      channel: "CHZTAGBM2", // #sandbox2
      username: "AWS Cost Explorer",
      // @ts-expect-error
      icon_emoji: ":ops-costexplorer:",
      blocks: [block],
    };

    await eventbridge.send(
      new PutEventsCommand({
        Entries: [
          {
            Source: "org.prx.cloudformation-notifications",
            DetailType: "Slack Message Relay Message Payload",
            Detail: JSON.stringify(msg),
          },
        ],
      }),
    );
  }
};
