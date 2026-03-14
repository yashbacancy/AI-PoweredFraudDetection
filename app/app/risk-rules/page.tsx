import { TopHeader } from "@/components/app/top-header";
import { RiskRulesClient } from "@/components/app/risk-rules-client";
import { getLocalModelRegistry, getLocalRiskRules } from "@/lib/local/management-repository";
import { IS_LOCAL_DB_MODE } from "@/lib/mode";

export default async function RiskRulesPage() {
  const [rules, models] = IS_LOCAL_DB_MODE
    ? await Promise.all([getLocalRiskRules(120), getLocalModelRegistry(16)])
    : [[], []];

  return (
    <>
      <TopHeader
        title="Risk Rules"
        subtitle="Create, edit, activate, and retire rules that drive fraud decisions in real time."
      />
      <div className="page-content">
        {IS_LOCAL_DB_MODE ? (
          <RiskRulesClient initialRules={rules} initialModels={models} />
        ) : (
          <section className="content-card">
            <p>Full Risk Rules CRUD is currently enabled in local mode.</p>
          </section>
        )}
      </div>
    </>
  );
}
