/** @import { Expression, GetCostAndUsageCommandInput } from "@aws-sdk/client-cost-explorer" */
/** @import { Block, SectionBlock } from "@slack/types" */

import {
  CostExplorerClient,
  GetCostAndUsageCommand,
} from "@aws-sdk/client-cost-explorer";
import { di, getDateStringsForRange, num } from "./util.mjs";

const ce = new CostExplorerClient({ apiVersion: "2017-10-25" });

/** @type {Expression} */
export const usageFilter = {
  Not: {
    Dimensions: {
      Key: "RECORD_TYPE",
      Values: [
        "Refund",
        "Credit",
        "Upfront",
        "Recurring",
        "Tax",
        "Support",
        "SavingsPlanRecurringFee",
        "SavingsPlanUpfrontFee",
        "Other",
      ],
    },
  },
};

/**
 * @param {Date} rangeStart
 * @param {Date} rangeEnd
 * @param {Expression | false} filter
 * @returns {Promise<Block | SectionBlock>}
 */
export default async function daily(rangeStart, rangeEnd, filter) {
  /** @type {GetCostAndUsageCommandInput} */
  const commandInput = {
    Granularity: "DAILY",
    TimePeriod: {
      Start: di(rangeStart),
      End: di(rangeEnd),
    },
    Metrics: ["UnblendedCost"],
  };

  if (filter) {
    commandInput.Filter = filter;
  }

  const costData = await ce.send(new GetCostAndUsageCommand(commandInput));
  const costResultsByTime = costData.ResultsByTime;

  const last20Days = getDateStringsForRange(rangeStart, rangeEnd).slice(
    -21,
    -1,
  );

  return {
    type: "data_visualization",
    // @ts-expect-error
    title: `Cost`,
    chart: {
      type: "bar",
      series: [
        {
          name: "Unblended Cost",
          data: last20Days.map((d) => {
            return {
              label: d,
              value: num(
                costResultsByTime?.find((r) => r.TimePeriod?.Start === d)?.Total
                  ?.UnblendedCost.Amount,
              ),
            };
          }),
        },
      ],
      axis_config: {
        categories: last20Days,
        y_label: "Amount ($)",
      },
    },
  };
}
