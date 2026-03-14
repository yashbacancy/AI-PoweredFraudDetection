import { TopHeader } from "@/components/app/top-header";
import { RiskRulesClient } from "@/components/app/risk-rules-client";
import { getLocalModelRegistry, getLocalRiskRules } from "@/lib/local/management-repository";
import { getSupabaseModelRegistry, getSupabaseRiskRules } from "@/lib/supabase/management-repository";
import { IS_LOCAL_DB_MODE } from "@/lib/mode";

export default async function RiskRulesPage() {
  const [rules, models] = await Promise.all(
    IS_LOCAL_DB_MODE
      ? [getLocalRiskRules(120), getLocalModelRegistry(16)]
      : [getSupabaseRiskRules(120), getSupabaseModelRegistry(16)],
  );

  return (
    <>
      <TopHeader
        title="Risk Rules"
        subtitle="Create, edit, activate, and retire rules that drive fraud decisions in real time."
      />
      <div className="page-content">
        <RiskRulesClient initialRules={rules} initialModels={models} />
      </div>
    </>
  );
}
