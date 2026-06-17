/** @import { SavingsPlansUtilizationByTime, UtilizationByTime } from "@aws-sdk/client-cost-explorer" */
/** @import { Block, SectionBlock } from "@slack/types" */

import {
  CostExplorerClient,
  GetReservationUtilizationCommand,
  GetSavingsPlansUtilizationCommand,
} from "@aws-sdk/client-cost-explorer";
import { di, num } from "./util.mjs";

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

  if (
    !savingsPlansUtilizationByTime ||
    !rdsReservationUtilizationByTime ||
    !ecReservationUtilizationByTime
  ) {
    return {
      type: "section",
      text: {
        type: "mrkdwn",
        text: "Utilization chart data could not be found.",
      },
    };
  }

  return {
    type: "data_visualization",
    // @ts-expect-error
    title: "Savings Plans & Reservation Utilization",
    chart: {
      type: "bar",
      series: [
        {
          name: "Savings Plans",
          data: savingsPlansUtilizationByTime.map((u) => {
            return {
              label: u.TimePeriod?.Start,
              value: num(u.Utilization?.UtilizationPercentage),
            };
          }),
        },
        {
          name: "RDS",
          data: rdsReservationUtilizationByTime.map((u) => {
            return {
              label: u.TimePeriod?.Start,
              value: num(u.Total?.UtilizationPercentage),
            };
          }),
        },
        {
          name: "ElastiCache",
          data: ecReservationUtilizationByTime.map((u) => {
            return {
              label: u.TimePeriod?.Start,
              value: num(u.Total?.UtilizationPercentage),
            };
          }),
        },
      ],
      axis_config: {
        categories: savingsPlansUtilizationByTime.map(
          (u) => u.TimePeriod?.Start,
        ),
        y_label: "Utilization (%)",
      },
    },
  };
}
