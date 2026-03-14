import { TopHeader } from "@/components/app/top-header";
import { CasesClient } from "@/components/app/cases-client";
import { getLocalCases, getLocalTransactions } from "@/lib/local/repository";
import { IS_LOCAL_DB_MODE } from "@/lib/mode";
import { createClient } from "@/lib/supabase/server";

export default async function CasesPage() {
  if (IS_LOCAL_DB_MODE) {
    const [cases, transactions] = await Promise.all([getLocalCases(), getLocalTransactions(30)]);
    return (
      <>
        <TopHeader title="Fraud Cases" subtitle="Triage, investigate, and close suspicious activities." />
        <div className="page-content">
          <CasesClient initialCases={cases ?? []} transactions={transactions ?? []} />
        </div>
      </>
    );
  }

  const supabase = await createClient();
  const [casesResult, txResult] = await Promise.all([
    supabase.from("fraud_cases").select("*").order("created_at", { ascending: false }),
    supabase.from("transactions").select("*").order("created_at", { ascending: false }).limit(30),
  ]);

  return (
    <>
      <TopHeader title="Fraud Cases" subtitle="Triage, investigate, and close suspicious activities." />
      <div className="page-content">
        <CasesClient initialCases={casesResult.data ?? []} transactions={txResult.data ?? []} />
      </div>
    </>
  );
}
