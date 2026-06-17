/** @import { AllMessageEvents } from "@slack/types" */

import {
  EventBridgeClient,
  PutEventsCommand,
} from "@aws-sdk/client-eventbridge";
import dailyCost, { usageFilter } from "./cost.mjs";
import dailyCoverage from "./coverage.mjs";
import dailyUtilization from "./utilization.mjs";

const eventbridge = new EventBridgeClient({ apiVersion: "2015-10-07" });

export const handler = async () => {
  const now = new Date(Date.now());
  const rangeStart = new Date(now.valueOf() - 1000 * 86400 * 19);
  // Cost Explorer treats the range end as exclusive, so if it's the 20th when
  // this is runs, the queried range will end on the 19th. Some CE APIs, though,
  // are a day or so behind, and won't return data for the 19th even if it is
  // the 20th; they will only return data as recent as the 18th. Other APIs are
  // more current. In order to avoid complexity of trying to handle both cases,
  // and since series in Slack data viz blocks must have values for every
  // category, we always ignore the current day and yesterday. I.e., we force
  // the range only include up to the 18th, which generally will normalize
  // results from the various APIs.
  const rangeEnd = new Date(now.valueOf() - 1000 * 86400 * 1);

  const blocks = [
    await dailyUtilization(rangeStart, rangeEnd),
    await dailyCoverage(rangeStart, rangeEnd),
    await dailyCost(rangeStart, rangeEnd, false),
    await dailyCost(rangeStart, rangeEnd, usageFilter),
  ];

  for (const block of blocks) {
    /** @type {AllMessageEvents} */
    const msg = {
      channel: "G9MGS7W8N", // #ops-billing
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
