/** @import { SavingsPlansUtilizationByTime, UtilizationByTime } from "@aws-sdk/client-cost-explorer" */
/** @import { Block, SectionBlock } from "@slack/types" */

import {
  CostExplorerClient,
  GetReservationUtilizationCommand,
  GetSavingsPlansUtilizationCommand,
} from "@aws-sdk/client-cost-explorer";
import { di, getDateStringsForRange, num } from "./util.mjs";

const ce = new CostExplorerClient({ apiVersion: "2017-10-25" });

/**
 * Returns daily savings plan utilization data for the given range
 * @param {Date} rangeStart
 * @param {Date} rangeEnd
 * @returns {Promise<SavingsPlansUtilizationByTime[] | undefined>}
 */
async function savingsPlansUtilizationsByTime(rangeStart, rangeEnd) {
  const savingsPlansUtilizationData = await ce.send(
    new GetSavingsPlansUtilizationCommand({
      Granularity: "DAILY",
      TimePeriod: {
        Start: di(rangeStart),
        End: di(rangeEnd),
      },
    }),
  );

  return savingsPlansUtilizationData.SavingsPlansUtilizationsByTime;
}

/**
 * Returns daily reservation utilization data for the given range and service
 * @param {Date} rangeStart
 * @param {Date} rangeEnd
 * @param {String} service
 * @returns {Promise<UtilizationByTime[] | undefined>}
 */
async function reservationUtilizationsByTime(rangeStart, rangeEnd, service) {
  const reservationPlansUtilizationData = await ce.send(
    new GetReservationUtilizationCommand({
      Granularity: "DAILY",
      TimePeriod: {
        Start: di(rangeStart),
        End: di(rangeEnd),
      },
      Filter: {
        Dimensions: {
          Key: "SERVICE",
          Values: [service],
        },
      },
    }),
  );

  return reservationPlansUtilizationData.UtilizationsByTime;
}

/**
 * @param {Date} rangeStart
 * @param {Date} rangeEnd
 * @returns {Promise<Block | SectionBlock>}
 */
export default async function daily(rangeStart, rangeEnd) {
  // TODO If these don't all return the same dates, an invalid block will be
  // created, since Slack requires that all series include data points for all
  // series.
  const savingsPlansUtilizationByTime = await savingsPlansUtilizationsByTime(
    rangeStart,
    rangeEnd,
  );
  const rdsReservationUtilizationByTime = await reservationUtilizationsByTime(
    rangeStart,
    rangeEnd,
    "Amazon Relational Database Service",
  );
  const ecReservationUtilizationByTime = await reservationUtilizationsByTime(
    rangeStart,
    rangeEnd,
    "Amazon ElastiCache",
  );

  const last20Days = getDateStringsForRange(rangeStart, rangeEnd).slice(
    -21,
    -1,
  );

  return {
    type: "data_visualization",
    // @ts-expect-error
    title: "Savings Plans & Reservation Utilization",
    chart: {
      type: "line",
      series: [
        {
          name: "Savings Plans",
          data: last20Days.map((d) => {
            return {
              label: d,
              value: num(
                savingsPlansUtilizationByTime?.find(
                  (u) => u.TimePeriod?.Start === d,
                )?.Utilization?.UtilizationPercentage,
              ),
            };
          }),
        },
        {
          name: "RDS",
          data: last20Days.map((d) => {
            return {
              label: d,
              value: num(
                rdsReservationUtilizationByTime?.find(
                  (u) => u.TimePeriod?.Start === d,
                )?.Total?.UtilizationPercentage,
              ),
            };
          }),
        },
        {
          name: "ElastiCache",
          data: last20Days.map((d) => {
            return {
              label: d,
              value: num(
                ecReservationUtilizationByTime?.find(
                  (u) => u.TimePeriod?.Start === d,
                )?.Total?.UtilizationPercentage,
              ),
            };
          }),
        },
      ],
      axis_config: {
        categories: last20Days,
        y_label: "Utilization (%)",
      },
    },
  };
}
