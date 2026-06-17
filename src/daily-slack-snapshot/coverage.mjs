/** @import { CoverageByTime, SavingsPlansCoverage } from "@aws-sdk/client-cost-explorer" */
/** @import { Block, SectionBlock } from "@slack/types" */

import {
  CostExplorerClient,
  GetReservationCoverageCommand,
  GetSavingsPlansCoverageCommand,
} from "@aws-sdk/client-cost-explorer";
import { di, getDateStringsForRange, num } from "./util.mjs";

const ce = new CostExplorerClient({ apiVersion: "2017-10-25" });

/**
 * Returns daily savings plan coverage data for the given range and service
 * @param {Date} rangeStart
 * @param {Date} rangeEnd
 * @param {String} service
 * @returns {Promise<SavingsPlansCoverage[] | undefined>}
 */
async function savingsPlanCoverages(rangeStart, rangeEnd, service) {
  const coverageData = await ce.send(
    new GetSavingsPlansCoverageCommand({
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

  return coverageData.SavingsPlansCoverages;
}

/**
 * Returns daily reservation coverage data for the given range and service
 * @param {Date} rangeStart
 * @param {Date} rangeEnd
 * @param {String} service
 * @returns {Promise<CoverageByTime[] | undefined>}
 */
async function reservationCoverages(rangeStart, rangeEnd, service) {
  const coverageData = await ce.send(
    new GetReservationCoverageCommand({
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

  return coverageData.CoveragesByTime;
}

/**
 * Returns the
 * @param {CoverageByTime[] | SavingsPlansCoverage[]} coverages
 * @returns {(String | undefined)[]}
 */
function categoriesFromCoverages(coverages) {
  return coverages.map((c) => c.TimePeriod?.Start);
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
  const ec2Coverages = await savingsPlanCoverages(
    rangeStart,
    rangeEnd,
    "Amazon Elastic Compute Cloud - Compute",
  );
  const ecsCoverages = await savingsPlanCoverages(
    rangeStart,
    rangeEnd,
    "Amazon Elastic Container Service",
  );
  const lambdaCoverages = await savingsPlanCoverages(
    rangeStart,
    rangeEnd,
    "AWS Lambda",
  );
  const rdsCoverages = await reservationCoverages(
    rangeStart,
    rangeEnd,
    "Amazon Relational Database Service",
  );
  const ecCoverages = await reservationCoverages(
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
    title: `Savings Plans & Reservation Coverage`,
    chart: {
      type: "line",
      series: [
        {
          name: "EC2",
          data: last20Days.map((d) => {
            return {
              label: d,
              value: num(
                ec2Coverages?.find((c) => c.TimePeriod?.Start === d)?.Coverage
                  ?.CoveragePercentage,
              ),
            };
          }),
        },
        {
          name: "ECS",
          data: last20Days.map((d) => {
            return {
              label: d,
              value: num(
                ecsCoverages?.find((c) => c.TimePeriod?.Start === d)?.Coverage
                  ?.CoveragePercentage,
              ),
            };
          }),
        },
        {
          name: "Lambda",
          data: last20Days.map((d) => {
            return {
              label: d,
              value: num(
                lambdaCoverages?.find((c) => c.TimePeriod?.Start === d)
                  ?.Coverage?.CoveragePercentage,
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
                rdsCoverages?.find((c) => c.TimePeriod?.Start === d)?.Total
                  ?.CoverageHours?.CoverageHoursPercentage,
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
                ecCoverages?.find((c) => c.TimePeriod?.Start === d)?.Total
                  ?.CoverageHours?.CoverageHoursPercentage,
              ),
            };
          }),
        },
      ],
      axis_config: {
        categories: last20Days,
        y_label: "Coverage (%)",
      },
    },
  };
}
