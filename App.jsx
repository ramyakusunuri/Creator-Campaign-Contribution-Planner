import React, { useState } from 'react';
import { processCampaignData } from './engine';

const fixtureData = {
  "records": {
    "campaigns": [
      { "creator_id": "CR1", "orders": 100, "returns": 20, "aov_inr": 1000, "discount_pct": 10, "pre_fee_contribution_pct": 40, "creator_fee_inr": 20000, "incremental_share_assumption": 0.5, "excluded": false },
      { "creator_id": "CR2", "orders": 100, "returns": 20, "aov_inr": 1000, "discount_pct": 10, "pre_fee_contribution_pct": 40, "creator_fee_inr": 20000, "incremental_share_assumption": 0.8, "excluded": false },
      { "creator_id": "CR3", "orders": 100, "returns": 20, "aov_inr": 1000, "discount_pct": 10, "pre_fee_contribution_pct": 40, "creator_fee_inr": 20000, "incremental_share_assumption": 0.5, "excluded": false },
      { "creator_id": "CR4", "orders": 100, "returns": 20, "aov_inr": 1000, "discount_pct": 10, "pre_fee_contribution_pct": 40, "creator_fee_inr": 20000, "incremental_share_assumption": 0.8, "excluded": false },
      { "creator_id": "CR5", "orders": 100, "returns": 20, "aov_inr": 1000, "discount_pct": 10, "pre_fee_contribution_pct": 40, "creator_fee_inr": 20000, "incremental_share_assumption": 0.5, "excluded": true },
      { "creator_id": "CR6", "orders": 100, "returns": 20, "aov_inr": 1000, "discount_pct": 10, "pre_fee_contribution_pct": 40, "creator_fee_inr": 20000, "incremental_share_assumption": 0.8, "excluded": false }
    ],
    "budget_inr": 2500000
  }
};

export default function App() {
  const [negotiations, setNegotiations] = useState({});
  const handleSliderChange = (creatorId, field, value) => {
    setNegotiations(prev => ({
      ...prev,
      [creatorId]: { ...prev[creatorId], [field]: parseFloat(value) }
    }));
  };

  const { campaigns, summary } = processCampaignData(fixtureData, negotiations);

  return (
    <div style={{ backgroundColor: '#0b0f19', color: '#f1f5f9', minHeight: '100vh', padding: '24px', fontFamily: 'sans-serif' }}>
      <header style={{ borderBottom: '1px solid #1e293b', paddingBottom: '20px', marginBottom: '32px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <span style={{ fontSize: '11px', color: '#10b981', backgroundColor: 'rgba(16,185,129,0.1)', padding: '4px 8px', borderRadius: '4px', border: '1px solid rgba(16,185,129,0.2)' }}>CASE CHECK: C24</span>
          <h1 style={{ fontSize: '24px', fontWeight: 'bold', margin: '6px 0 0 0' }}>Creator Campaign Contribution Planner</h1>
        </div>
        <div style={{ backgroundColor: '#161f38', border: '1px solid rgba(16,185,129,0.2)', padding: '8px 16px', borderRadius: '12px' }}>
          <span style={{ fontSize: '10px', color: '#10b981', display: 'block' }}>Aggregate Contribution</span>
          <div style={{ fontSize: '20px', fontWeight: 'bold' }}>INR {summary.summaryScenarioContribution.toLocaleString()}</div>
        </div>
      </header>

      <div style={{ backgroundColor: '#121826', border: '1px solid rgba(245,158,11,0.2)', padding: '16px', borderRadius: '12px', display: 'flex', gap: '16px', marginBottom: '24px' }}>
        <div style={{ color: '#f59e0b', fontWeight: 'bold' }}>⚠️</div>
        <div>
          <h4 style={{ fontSize: '13px', fontWeight: 'bold', margin: '0 0 4px 0' }}>Overlapping Multi-Channel Attribution Disclosure</h4>
          <p style={{ fontSize: '11px', color: '#94a3b8', margin: '0', lineHeight: '1.5' }}>
            System constraint active: Performance metrics strictly exclude creator accounts flagged with multi-channel overlap (e.g., CR5). Bypassed to ensure zero redundant budget depletion across concurrent campaigns.
          </p>
        </div>
      </div>

      <section style={{ display: 'flex', gap: '24px', marginBottom: '32px', flexWrap: 'wrap' }}>
        <div style={{ backgroundColor: '#121826', padding: '20px', borderRadius: '16px', border: '1px solid #1e293b', flex: 1 }}>
          <span style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 'bold' }}>Retained Gross Revenue Pipeline</span>
          <div style={{ fontSize: '26px', fontWeight: 'bold', marginTop: '4px' }}>INR {summary.summaryRetainedSales.toLocaleString()}</div>
        </div>
        <div style={{ backgroundColor: '#121826', padding: '20px', borderRadius: '16px', border: '1px solid #1e293b', flex: 1 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#94a3b8', fontWeight: 'bold' }}>
            <span>Budget Cap Tracker</span>
            <span style={{ color: summary.budgetExceeded ? '#f43f5e' : '#14b8a6' }}>INR 25 Lakh Max</span>
          </div>
          <div style={{ width: '100%', backgroundColor: '#0f172a', height: '10px', borderRadius: '9999px', overflow: 'hidden', border: '1px solid #334155', marginTop: '12px' }}>
            <div style={{ height: '100%', backgroundColor: summary.budgetExceeded ? '#f43f5e' : '#14b8a6', width: `${Math.min(100, (summary.totalAllocatedBudget / 2500000) * 100)}%` }}></div>
          </div>
        </div>
      </section>

      <main style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {campaigns.map((c) => (
          <div key={c.creator_id} style={{ padding: '20px', borderRadius: '12px', border: '1px solid #1e293b', backgroundColor: c.excluded ? 'rgba(18,24,38,0.2)' : c.isRecommended ? '#121826' : '#271625', opacity: c.excluded ? 0.6 : 1 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
              <div style={{ width: '150px' }}>
                <span style={{ fontWeight: 'bold', fontSize: '14px', backgroundColor: '#1e293b', padding: '4px 8px', borderRadius: '6px' }}>{c.creator_id}</span>
                <span style={{ fontSize: '10px', marginLeft: '8px', padding: '2px 6px', borderRadius: '4px', backgroundColor: c.isRecommended ? 'rgba(16,185,129,0.1)' : 'rgba(244,63,94,0.1)', color: c.isRecommended ? '#10b981' : '#f43f5e' }}>{c.status}</span>
                <div style={{ fontSize: '11px', marginTop: '8px', color: '#94a3b8' }}>Fee: INR {c.creator_fee_inr.toLocaleString()}</div>
              </div>

              {!c.excluded ? (
                <div style={{ flex: 1, display: 'flex', gap: '24px' }}>
                  <div style={{ flex: 1 }}>
                    <label style={{ display: 'block', fontSize: '11px', color: '#94a3b8' }}>Incrementality: {(c.currentIncrementalShare * 100).toFixed(0)}%</label>
                    <input type="range" min="0.1" max="1.0" step="0.05" value={c.currentIncrementalShare} onChange={(e) => handleSliderChange(c.creator_id, 'incremental_share_assumption', e.target.value)} style={{ width: '100%' }}/>
                  </div>
                  <div style={{ flex: 1 }}>
                    <label style={{ display: 'block', fontSize: '11px', color: '#94a3b8' }}>Returns: {c.currentReturns} Units</label>
                    <input type="range" min="0" max="50" step="1" value={c.currentReturns} onChange={(e) => handleSliderChange(c.creator_id, 'returns', e.target.value)} style={{ width: '100%' }}/>
                  </div>
                </div>
              ) : (
                <div style={{ flex: 1, fontSize: '11px', fontStyle: 'italic', color: '#475569' }}>Overlapping channel protection active.</div>
              )}

              <div style={{ width: '180px', textAlign: 'right', fontSize: '12px' }}>
                <div>Retained Sales: INR {c.retainedSales.toLocaleString()}</div>
                <div style={{ marginTop: '4px', fontWeight: 'bold', color: c.scenarioContribution <= 0 ? '#f43f5e' : '#10b981' }}>Net Value: INR {c.scenarioContribution.toLocaleString()}</div>
              </div>
            </div>
          </div>
        ))}
      </main>
    </div>
  );
}
