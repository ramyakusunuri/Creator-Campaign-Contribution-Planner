export function processCampaignData(fixtureData, userNegotiations = {}) {
  const { campaigns, budget_inr } = fixtureData.records;
  let totalAllocatedBudget = 0;
  let summaryRetainedSales = 0;
  let summaryScenarioContribution = 0;

  const processedCampaigns = campaigns.map((campaign) => {
    const cid = campaign.creator_id;
    const incrementalShare = userNegotiations[cid]?.incremental_share_assumption !== undefined 
      ? userNegotiations[cid].incremental_share_assumption 
      : campaign.incremental_share_assumption;
    const returnsCount = userNegotiations[cid]?.returns !== undefined 
      ? userNegotiations[cid].returns 
      : campaign.returns;

    if (campaign.excluded) {
      return { ...campaign, retainedSales: 0, scenarioContribution: 0, status: "Excluded", isRecommended: false };
    }

    const retainedOrders = Math.max(0, campaign.orders - returnsCount);
    const discountFactor = 1 - (campaign.discount_pct / 100);
    const retainedSales = retainedOrders * campaign.aov_inr * discountFactor;
    const rawContribution = retainedSales * (campaign.pre_fee_contribution_pct / 100);
    const incrementalContribution = rawContribution * incrementalShare;
    const scenarioContribution = incrementalContribution - campaign.creator_fee_inr;

    totalAllocatedBudget += campaign.creator_fee_inr;
    summaryRetainedSales += retainedSales;
    summaryScenarioContribution += scenarioContribution;

    const returnRate = campaign.orders > 0 ? (returnsCount / campaign.orders) : 0;
    const isRecommended = scenarioContribution > 0 && returnRate < 0.35 && incrementalShare >= 0.4;

    return {
      ...campaign,
      currentReturns: returnsCount,
      currentIncrementalShare: incrementalShare,
      retainedSales,
      scenarioContribution,
      isRecommended,
      status: isRecommended ? "Recommended" : "Reversed"
    };
  });

  const budgetExceeded = totalAllocatedBudget > budget_inr;
  return {
    campaigns: processedCampaigns,
    summary: { totalAllocatedBudget, budgetCap: budget_inr, budgetExceeded, summaryRetainedSales, summaryScenarioContribution }
  };
}
